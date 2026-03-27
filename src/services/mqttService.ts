import { Buffer } from 'buffer';
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

        console.log('[MQTT] STEP 1: Initializing Legacy AWS Config...');
        console.log('[MQTT] Using Region:', MQTT_CONFIG.region);
        console.log('[MQTT] Using IdentityPoolId:', MQTT_CONFIG.identityPoolId);

        AWS.config.region = MQTT_CONFIG.region;
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: MQTT_CONFIG.identityPoolId,
        });

        console.log('[MQTT] STEP 2: Fetching Cognito Credentials...');
        // @ts-ignore
        AWS.config.credentials.get((err: any) => {
            if (err) {
                console.error("❌ [MQTT] ERROR: Cognito Credential Fetch Failed:", err.message);
                console.error("❌ [MQTT] ERROR DETAILED:", err);
                this.onStatusChange?.(false);
                return;
            }

            console.log("✅ [MQTT] STEP 3: Cognito Identity Credentials Fetched Successfully.");
            console.log("[MQTT] Cognito Identity ID:", AWS.config.credentials.identityId);
            
            // Log the actual credentials being used (for debugging - remove in production)
            console.log("🔑 [MQTT] AccessKeyId:", AWS.config.credentials.accessKeyId);
            console.log("🔑 [MQTT] SecretAccessKey:", AWS.config.credentials.secretAccessKey?.substring(0, 10) + "..."); // Partial for security
            console.log("🔑 [MQTT] SessionToken:", AWS.config.credentials.sessionToken?.substring(0, 20) + "..."); // Partial for security
            
            // Refresh credentials for React Native compatibility
            AWS.config.credentials.refresh((err) => {
                if (err) {
                    console.error("❌ Credential refresh failed", err);
                    // Still try to connect with current credentials
                    this.establishConnection();
                } else {
                    console.log("✅ Credentials refreshed");
                    // Log refreshed credentials
                    console.log("🔄 [MQTT] Refreshed AccessKeyId:", AWS.config.credentials.accessKeyId);
                    console.log("🔄 [MQTT] Refreshed SecretAccessKey:", AWS.config.credentials.secretAccessKey?.substring(0, 10) + "...");
                    console.log("🔄 [MQTT] Refreshed SessionToken:", AWS.config.credentials.sessionToken?.substring(0, 20) + "...");
                    this.establishConnection();
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

    public async publish(data: any): Promise<boolean> {
        if (!this.client) {
            console.warn('⚠️ [MQTT] CANNOT PUBLISH: No active client connection exists.');
            return false;
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

        return new Promise((resolve) => {
            try {
                this.client.publish(MQTT_CONFIG.topics.uplink, payload, {}, (err: any) => {
                    if (err) {
                        console.error("❌ [MQTT] PUBLISH FAILED (Protocol Level):", err.message);
                        console.error("   Detailed Error:", err);
                        resolve(false);
                    } else {
                        console.log("✅ [MQTT] PUBLISH CONFIRMED by AWS IoT Core.");
                        resolve(true);
                    }
                });
            } catch (error: any) {
                console.error('❌ [MQTT] PUBLISH INVOCATION FAILED (App Level):', error.message);
                resolve(false);
            }
        });
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
