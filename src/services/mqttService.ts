import { Buffer } from 'buffer';
import CryptoJS from 'crypto-js';
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';
// @ts-ignore
import AWS from "aws-sdk/dist/aws-sdk-react-native";
// @ts-ignore
import awsIot from "aws-iot-device-sdk";
import { MQTT_CONFIG } from '../config/mqttCertificates';

// @ts-ignore
if (typeof global.crypto === 'undefined') {
    // @ts-ignore
    global.crypto = {
        getRandomValues: (array: any) => {
            for (let i = 0; i < array.length; i++) {
                array[i] = Math.floor(Math.random() * 256);
            }
            return array;
        }
    };
}

class MqttService {
    private client: any = null;
    private onStatusChange: ((connected: boolean) => void) | null = null;

    public async connect(onStatusChange: (connected: boolean) => void) {
        if (this.client) {
            console.log('[MQTT] ALREADY CONNECTED: Client already exists');
            return;
        }
        this.onStatusChange = onStatusChange;

        console.log('[MQTT] STEP 1: Initializing AWS Config...');
        console.log('[MQTT] Using Region:', MQTT_CONFIG.region);
        console.log('[MQTT] Using IdentityPoolId:', MQTT_CONFIG.identityPoolId);

        AWS.config.region = MQTT_CONFIG.region;

        try {
            // STEP 2: Sign in to Cognito User Pool to get ID Token
            console.log('[MQTT] STEP 2: Signing in to Cognito User Pool (SRP Flow)...');
            const idToken = await this.getUserPoolIdToken();
            console.log('✅ [MQTT] STEP 2: User Pool sign-in successful, ID token obtained.');

            // STEP 3: Exchange ID Token for authenticated Identity Pool credentials
            console.log('[MQTT] STEP 3: Fetching authenticated Cognito Identity Credentials...');
            const loginKey = `cognito-idp.${MQTT_CONFIG.region}.amazonaws.com/${MQTT_CONFIG.userPoolId}`;
            AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                IdentityPoolId: MQTT_CONFIG.identityPoolId,
                Logins: {
                    [loginKey]: idToken,
                },
            });

            // @ts-ignore
            AWS.config.credentials.get((err: any) => {
                if (err) {
                    console.error("❌ [MQTT] ERROR: Cognito Credential Fetch Failed:", err.message);
                    console.error("❌ [MQTT] ERROR DETAILED:", err);
                    this.onStatusChange?.(false);
                    return;
                }

                console.log("✅ [MQTT] STEP 3: Authenticated Identity Credentials obtained.");
                console.log("[MQTT] Cognito Identity ID:", AWS.config.credentials.identityId);
                console.log("🔑 [MQTT] AccessKeyId:", AWS.config.credentials.accessKeyId);
                console.log("🔑 [MQTT] SessionToken:", AWS.config.credentials.sessionToken?.substring(0, 20) + "...");

                this.establishConnection();
            });
        } catch (err: any) {
            console.error("❌ [MQTT] STEP 2 FAILED: User Pool sign-in error:", err.message);
            console.error("❌ [MQTT] ERROR DETAILED:", err);
            this.onStatusChange?.(false);
        }
    }

    /**
     * Signs in to Cognito using amazon-cognito-identity-js (SRP flow).
     * This avoids the "USER_PASSWORD_AUTH flow not enabled" error.
     */
    private getUserPoolIdToken(): Promise<string> {
        return new Promise((resolve, reject) => {
            const poolData = {
                UserPoolId: MQTT_CONFIG.userPoolId,
                ClientId: MQTT_CONFIG.userPoolClientId
            };
            const userPool = new CognitoUserPool(poolData);
            
            const authenticationDetails = new AuthenticationDetails({
                Username: MQTT_CONFIG.serviceAccount.email,
                Password: MQTT_CONFIG.serviceAccount.password,
            });
            
            const cognitoUser = new CognitoUser({
                Username: MQTT_CONFIG.serviceAccount.email,
                Pool: userPool
            });
            
            console.log('[MQTT] Calling authenticateUser for:', MQTT_CONFIG.serviceAccount.email);
            
            cognitoUser.authenticateUser(authenticationDetails, {
                onSuccess: (result) => {
                    resolve(result.getIdToken().getJwtToken());
                },
                onFailure: (err) => {
                    console.error('[MQTT] authenticateUser failed:', err.message || err);
                    reject(err);
                },
                newPasswordRequired: (userAttributes, requiredAttributes) => {
                    console.log('[MQTT] Account requires password change (FORCE_CHANGE_PASSWORD state). Doing it automatically...');
                    // Removing read-only attributes that cause errors if sent back
                    delete userAttributes.email_verified;
                    delete userAttributes.phone_number_verified;
                    
                    cognitoUser.completeNewPasswordChallenge(
                        MQTT_CONFIG.serviceAccount.password, 
                        userAttributes, 
                        {
                            onSuccess: (result: any) => resolve(result.getIdToken().getJwtToken()),
                            onFailure: (err: any) => reject(err)
                        }
                    );
                }
            });
        });
    }

    private establishConnection() {
        console.log('[MQTT] STEP 4: Initializing IoT Device Client...');
        console.log('[MQTT] Connecting to Host:', MQTT_CONFIG.host);
        console.log('[MQTT] Client ID:', MQTT_CONFIG.clientId);
        
        try {
            this.client = awsIot.device({
                region: MQTT_CONFIG.region,
                host: MQTT_CONFIG.host,
                protocol: "wss",
                // @ts-ignore
                accessKeyId: AWS.config.credentials.accessKeyId,
                // @ts-ignore
                secretKey: AWS.config.credentials.secretAccessKey,
                // @ts-ignore
                sessionToken: AWS.config.credentials.sessionToken,
                clientId: MQTT_CONFIG.clientId,
                reconnectPeriod: 5000,
                keepalive: 300, // 5 minutes
                resubscribe: true,
                connectTimeout: 10000, // 10 seconds
            });

            this.client.on("connect", () => {
                console.log("✅ [MQTT] STEP 5: CONNECTED TO AWS IOT CORE SUCCESSFUL");
                console.log("   Connected with Client ID:", MQTT_CONFIG.clientId);
                this.onStatusChange?.(true);
                
                console.log("[MQTT] Subscribing to Uplink Topic:", MQTT_CONFIG.topics.uplink);
                this.client.subscribe(MQTT_CONFIG.topics.uplink, { qos: 1 }, (err, granted) => {
                    if (err) {
                        console.error("❌ [MQTT] Failed to subscribe to uplink:", err);
                    } else {
                        console.log("✅ [MQTT] Successfully subscribed to uplink:", granted);
                    }
                });
            });

            this.client.on("message", (topic: string, payload: any) => {
                console.log("📩 [MQTT] INCOMING MESSAGE RECEIVED:");
                console.log("   Topic:", topic);
                console.log("   Payload:", payload.toString());
            });

            this.client.on("error", (error: any) => {
                console.error("❌ [MQTT] CLIENT ERROR OCCURRED");
                console.error("   Message:", error.message);
                console.error("   Detailed Error:", error);
                this.onStatusChange?.(false);
            });

            this.client.on("close", () => {
                console.warn("⚠️ [MQTT] CONNECTION CLOSED BY REMOTE/LOCAL HOST");
                console.warn("   Client ID:", MQTT_CONFIG.clientId);
                console.warn("   Host:", MQTT_CONFIG.host);
                console.warn("   Checking if credentials are still valid...");
                
                // Check if credentials are expired
                if (AWS.config.credentials && AWS.config.credentials.expireTime) {
                    const now = new Date();
                    const expireTime = new Date(AWS.config.credentials.expireTime);
                    console.warn("   Credentials expire at:", expireTime.toISOString());
                    console.warn("   Current time:", now.toISOString());
                    console.warn("   Time until expiry:", Math.floor((expireTime.getTime() - now.getTime()) / 1000), "seconds");
                }
                
                this.onStatusChange?.(false);
            });

            this.client.on("reconnect", () => {
                console.log("🔄 [MQTT] RECONNECTING... (Attempting to restore session)");
            });

        } catch (error: any) {
            console.error("❌ [MQTT] CONNECTION INITIALIZATION FAILED:", error.message);
            this.onStatusChange?.(false);
        }
    }

    public async sendTestMessage() {
        if (!this.client) return;
        
        const payload = JSON.stringify({
            msg: "testing sample data from ctag mobile app to aws cloud",
            timestamp: new Date().toISOString()
        });

        try {
            this.client.publish(MQTT_CONFIG.topics.uplink, payload);
            console.log("✅ [MQTT] Test Message Published");
        } catch (error: any) {
            console.error('[MQTT] Test Publish failed:', error.message);
        }
    }

    private mobileNumber: string = '0000000000'; // default; set via setMobileNumber()

    /** Set the mobile number used in gateway_id (format: MOB<number>) */
    public setMobileNumber(number: string) {
        this.mobileNumber = number.replace(/[^0-9]/g, ''); // digits only
    }

    public async publish(data: any) {
        if (!this.client) {
            console.warn('⚠️ [MQTT] CANNOT PUBLISH: No active client connection exists.');
            return;
        }

        // Build the sensor_data CSV string
        const sensorDataStr = this.buildSensorDataString(data);

        const payload = JSON.stringify({
            evt: "SAMPLES",
            gateway_id: `MOB${this.mobileNumber}`,
            packet_number: data.packetNumber,
            utc_time: Math.floor(Date.now() / 1000),
            access_token: "asdfghjklasdfghjk",
            signal_strength: -12,
            comm_mode: "cellular",
            powered_by: "battery",
            battery: 92,
            sensor_data: sensorDataStr
        });

        console.log(`📤 [MQTT] ATTEMPTING TO PUSH DATA...`);
        console.log(`   Topic: ${MQTT_CONFIG.topics.uplink}`);
        console.log(`   Packet #${data.packetNumber} | ${data.accelerometer?.length || 0} samples`);

        try {
            this.client.publish(MQTT_CONFIG.topics.uplink, payload, {}, (err: any) => {
                if (err) {
                    console.error("❌ [MQTT] PUBLISH FAILED (Protocol Level):", err.message);
                    console.error("   Detailed Error:", err);
                } else {
                    console.log("✅ [MQTT] PUBLISH CONFIRMED by AWS IoT Core.");
                }
            });
        } catch (error: any) {
            console.error('❌ [MQTT] PUBLISH INVOCATION FAILED (App Level):', error.message);
        }
    }

    /**
     * Build the sensor_data string from parsed packet.
     * 
     * Format matches the gateway protocol:
     * "00000,<deviceId>,00:00:00:00:00:00,0,<temperature>,<sampledTime>,100,100,
     *  <battery>,<numSamples>,<accelX>,<accelY>,<accelZ>,<gyroX>,<gyroY>,<gyroZ>,
     *  <magX>,<magY>,<magZ>,..."
     */
    private buildSensorDataString(data: any): string {
        const parts: (string | number)[] = [];

        // Header fields
        parts.push("00000");                           // placeholder
        parts.push(data.deviceId || "UNKNOWN");        // sensor ID
        parts.push("00:00:00:00:00:00");               // MAC placeholder
        parts.push(0);                                 // reserved
        parts.push(Math.round((data.temperature || 0) * 100)); // temperature (raw, *100)
        parts.push(data.sampledTime || 0);             // sampled time from sensor
        parts.push(100);                               // sample rate placeholder
        parts.push(100);                               // sample rate placeholder
        parts.push(data.battery || 0);                 // battery from sensor
        
        const numSamples = data.accelerometer?.length || 0;
        parts.push(numSamples);                        // number of samples

        // Per-sample data: accelX,accelY,accelZ,gyroX,gyroY,gyroZ,magX,magY,magZ
        for (let i = 0; i < numSamples; i++) {
            const a = data.accelerometer[i] || { x: 0, y: 0, z: 0 };
            const g = data.gyroscope[i] || { x: 0, y: 0, z: 0 };
            const m = data.magnetometer[i] || { x: 0, y: 0, z: 0 };
            parts.push(a.x, a.y, a.z);
            parts.push(g.x, g.y, g.z);
            parts.push(m.x, m.y, m.z);
        }

        return parts.join(',');
    }

    public async disconnect() {
        if (this.client) {
            console.log('[MQTT] Disconnecting...');
            this.client.end();
            this.client = null;
            this.onStatusChange?.(false);
        }
    }
}

export const mqttService = new MqttService();
