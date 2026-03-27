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
        if (this.client) return;
        this.onStatusChange = onStatusChange;

        console.log('[MQTT] Initializing Legacy AWS Config...');
        AWS.config.region = MQTT_CONFIG.region;
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: MQTT_CONFIG.identityPoolId,
        });

        console.log('[MQTT] Fetching Cognito Credentials...');
        // @ts-ignore
        AWS.config.credentials.get((err: any) => {
            if (err) {
                console.error("[MQTT] Cognito Error:", err.message);
                this.onStatusChange?.(false);
                return;
            }

            console.log("[MQTT] Cognito Identity ID:", AWS.config.credentials.identityId);
            this.establishConnection();
        });
    }

    private establishConnection() {
        console.log('[MQTT] Establishing connection to:', MQTT_CONFIG.host);
        
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
            });

            this.client.on("connect", () => {
                console.log("✅ [MQTT] Connected to AWS IoT");
                this.onStatusChange?.(true);
                
                // Subscribe to downlink and uplink (as per user snippet)
                this.client.subscribe(MQTT_CONFIG.topics.downlink);
                this.client.subscribe(MQTT_CONFIG.topics.uplink);
            });

            this.client.on("message", (topic: string, payload: any) => {
                console.log("📩 [MQTT] Received:", topic, payload.toString());
            });

            this.client.on("error", (error: any) => {
                console.error("❌ [MQTT] Error:", error.message);
                this.onStatusChange?.(false);
            });

            this.client.on("close", () => {
                console.log("[MQTT] Connection Closed");
                this.onStatusChange?.(false);
            });

        } catch (error: any) {
            console.error("[MQTT] Connection Setup Error:", error.message);
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
            console.warn('[MQTT] Cannot publish: No active connection');
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

        try {
            this.client.publish(MQTT_CONFIG.topics.uplink, payload);
            console.log("✅ [MQTT] Message Published to:", MQTT_CONFIG.topics.uplink);
        } catch (error: any) {
            console.error('[MQTT] Publish failed:', error.message);
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
