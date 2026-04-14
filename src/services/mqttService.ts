import { NativeModules, NativeEventEmitter } from 'react-native';
import { MQTT_CONFIG, ROOT_CA, DEVICE_CERT, PRIVATE_KEY } from '../config/mqttCertificates';
import { ParsedPacket } from '../utils/parser';

const { MqttCertModule } = NativeModules;
const mqttEventEmitter = new NativeEventEmitter(MqttCertModule);

class MqttService {
    private isConnected: boolean = false;
    private onStatusChange: ((connected: boolean) => void) | null = null;
    private statusSubscription: any = null;
    private messageSubscription: any = null;
    private mobileNumber: string = '0000000000'; // default; set via setMobileNumber()

    constructor() {
        this.statusSubscription = mqttEventEmitter.addListener('onMqttStatusChange', (event) => {
            console.log('[MQTT Native] Status Changed:', event.connected, event.error ? `| Reason: ${event.error}` : '');
            this.isConnected = event.connected;
            this.onStatusChange?.(this.isConnected);
        });

        this.messageSubscription = mqttEventEmitter.addListener('onMqttMessage', (event) => {
            console.log('[MQTT Native] 📩 Message on', event.topic, ':', event.payload);
        });
    }

    /** Set the mobile number used in gateway_id (format: MOB<number>) */
    public setMobileNumber(number: string) {
        this.mobileNumber = number.replace(/[^0-9]/g, ''); // digits only
    }

    public async connect(onStatusChange: (connected: boolean) => void) {
        if (this.isConnected) {
            console.log('[MQTT] Already connected.');
            return;
        }
        this.onStatusChange = onStatusChange;

        console.log('[MQTT] STEP 1: Initializing Native Certificate-Based Connection...');
        console.log('[MQTT] Host :', MQTT_CONFIG.host);
        console.log('[MQTT] Port :', MQTT_CONFIG.port);
        console.log('[MQTT] ID   :', MQTT_CONFIG.clientId);

        try {
            await MqttCertModule.connect(
                MQTT_CONFIG.host,
                MQTT_CONFIG.port,
                MQTT_CONFIG.clientId,
                ROOT_CA,
                DEVICE_CERT,
                PRIVATE_KEY,
                MQTT_CONFIG.topics.uplink
            );
            console.log('✅ [MQTT] CONNACK received — waiting for connectComplete event...');
        } catch (error: any) {
            console.error("❌ [MQTT] NATIVE CONNECTION FAILED:", error.message ?? error);
            this.onStatusChange?.(false);
        }
    }

    public async sendTestMessage() {
        if (!this.isConnected) {
            console.warn('[MQTT] sendTestMessage: not connected');
            return;
        }
        const payload = JSON.stringify({
            evt: "SAMPLES",
            gateway_id: `MOB${this.mobileNumber}`,
            packet_number: 0,
            utc_time: Math.floor(Date.now() / 1000),
            access_token: "asdfghjklasdfghjk",
            signal_strength: -12,
            comm_mode: "cellular",
            powered_by: "battery",
            battery: 92,
            sensor_data: "test_message"
        });
        try {
            await MqttCertModule.publish(MQTT_CONFIG.topics.uplink, payload, 1);
            console.log("✅ [MQTT] Test message published");
        } catch (error: any) {
            console.error('[MQTT] Test publish failed:', error.message);
        }
    }

    /**
     * Publish sensor data in the gateway-compatible format.
     *
     * sensor_data CSV format (per sample):
     *   accelX,accelY,accelZ,gyroX,gyroY,gyroZ,magX,magY,magZ
     * Samples are comma-separated in a single string along with a header.
     */
    public async publish(data: ParsedPacket): Promise<boolean> {
        if (!this.isConnected) {
            console.warn('⚠️ [MQTT] Cannot publish — not connected.');
            return false;
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

        console.log(`📤 [MQTT] Publishing to ${MQTT_CONFIG.topics.uplink}`);
        console.log(`   Packet #${data.packetNumber} | ${data.accelerometer.length} samples`);

        try {
            await MqttCertModule.publish(MQTT_CONFIG.topics.uplink, payload, 1);
            console.log("✅ [MQTT] Publish confirmed.");
            return true;
        } catch (error: any) {
            console.error('❌ [MQTT] Publish failed:', error.message);
            return false;
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
    private buildSensorDataString(data: ParsedPacket): string {
        const parts: (string | number)[] = [];

        // Header fields
        parts.push("00000");                           // placeholder
        parts.push(data.deviceId);                     // sensor ID
        parts.push("00:00:00:00:00:00");               // MAC placeholder
        parts.push(0);                                 // reserved
        parts.push(Math.round(data.temperature * 100)); // temperature (raw, *100)
        parts.push(data.sampledTime);                  // sampled time from sensor
        parts.push(100);                               // sample rate placeholder
        parts.push(100);                               // sample rate placeholder
        parts.push(data.battery);                      // battery from sensor
        parts.push(data.accelerometer.length);         // number of samples

        // Per-sample data: accelX,accelY,accelZ,gyroX,gyroY,gyroZ,magX,magY,magZ
        for (let i = 0; i < data.accelerometer.length; i++) {
            const a = data.accelerometer[i];
            const g = data.gyroscope[i];
            const m = data.magnetometer[i];
            parts.push(a.x, a.y, a.z);
            parts.push(g.x, g.y, g.z);
            parts.push(m.x, m.y, m.z);
        }

        return parts.join(',');
    }

    public async disconnect() {
        try {
            await MqttCertModule.disconnect();
        } catch (error: any) {
            console.error('[MQTT] Disconnect error:', error.message);
        } finally {
            this.isConnected = false;
        }
    }

    public destroy() {
        this.statusSubscription?.remove();
        this.messageSubscription?.remove();
    }
}

export const mqttService = new MqttService();
