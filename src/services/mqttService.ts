import { Buffer } from 'buffer';
import CryptoJS from 'crypto-js';
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
            console.log('[MQTT] STEP 2: Signing in to Cognito User Pool...');
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
     * Signs in to Cognito User Pool using USER_PASSWORD_AUTH flow.
     * Returns the ID Token string for use in the Identity Pool Logins map.
     */
    private getUserPoolIdToken(): Promise<string> {
        return new Promise((resolve, reject) => {
            const cognitoISP = new AWS.CognitoIdentityServiceProvider({
                region: MQTT_CONFIG.region,
            });

            // SECRET_HASH is only required when the App Client has a secret configured
            const authParameters: Record<string, string> = {
                USERNAME: MQTT_CONFIG.serviceAccount.email,
                PASSWORD: MQTT_CONFIG.serviceAccount.password,
            };
            if (MQTT_CONFIG.userPoolClientSecret) {
                // SECRET_HASH = Base64( HMAC-SHA256( username + clientId, clientSecret ) )
                const hmac = CryptoJS.HmacSHA256(
                    MQTT_CONFIG.serviceAccount.email + MQTT_CONFIG.userPoolClientId,
                    MQTT_CONFIG.userPoolClientSecret,
                );
                authParameters.SECRET_HASH = CryptoJS.enc.Base64.stringify(hmac);
                console.log('[MQTT] SECRET_HASH computed:', authParameters.SECRET_HASH.substring(0, 10) + '...');
            }

            const params = {
                AuthFlow: 'USER_PASSWORD_AUTH',
                ClientId: MQTT_CONFIG.userPoolClientId,
                AuthParameters: authParameters,
            };

            console.log('[MQTT] Calling InitiateAuth for:', MQTT_CONFIG.serviceAccount.email);
            cognitoISP.initiateAuth(params, (err: any, data: any) => {
                if (err) {
                    console.error('[MQTT] InitiateAuth failed:', err.message);
                    return reject(err);
                }
                const idToken = data?.AuthenticationResult?.IdToken;
                if (!idToken) {
                    return reject(new Error('InitiateAuth succeeded but no IdToken in response. Check AuthFlow or MFA settings.'));
                }
                resolve(idToken);
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

    public async publish(data: any) {
        if (!this.client) {
            console.warn('⚠️ [MQTT] CANNOT PUBLISH: No active client connection exists.');
            return;
        }

        const payload = JSON.stringify({
            timestamp: new Date().toISOString(),
            deviceId: data.deviceId,
            battery: data.battery,
            temperature: data.temperature,
            packetNumber: data.packetNumber,
            accelerometer: data.accelerometer,
            gyroscope: data.gyroscope,
            magnetometer: data.magnetometer
        });

        console.log(`📤 [MQTT] ATTEMPTING TO PUSH DATA...`);
        console.log(`   Topic: ${MQTT_CONFIG.topics.uplink}`);
        console.log(`   Payload: ${payload}`);

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
