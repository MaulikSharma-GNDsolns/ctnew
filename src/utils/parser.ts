import { Buffer } from 'buffer';

export interface SensorData {
    x: number;
    y: number;
    z: number;
}

export interface ParsedPacket {
    deviceId: string;
    packetNumber: number;
    sampledTime: number;
    battery: number;
    temperature: number;
    accelerometer: SensorData[];
    gyroscope: SensorData[];
    magnetometer: SensorData[];
}

export class ProtocolParser {
    private buffer: Buffer = Buffer.alloc(0);
    private readonly PACKET_SIZE = 1030;
    private readonly START_BYTE = 0xC1;
    private readonly SAMPLES_PER_PACKET = 56;

    public addData(newData: Buffer): ParsedPacket | null {
        this.buffer = Buffer.concat([this.buffer, newData]);

        const startIndex = this.buffer.indexOf(this.START_BYTE);
        if (startIndex === -1) {
            if (this.buffer.length > this.PACKET_SIZE * 2) {
                this.buffer = Buffer.alloc(0);
            }
            return null;
        }

        if (startIndex > 0) {
            this.buffer = this.buffer.slice(startIndex);
        }

        if (this.buffer.length < this.PACKET_SIZE) {
            return null;
        }

        const packet = this.buffer.slice(0, this.PACKET_SIZE);
        this.buffer = this.buffer.slice(this.PACKET_SIZE);

        return this.parsePacket(packet);
    }

    private parsePacket(buf: Buffer): ParsedPacket {
        const deviceId = buf.slice(1, 11).toString('ascii').replace(/\0/g, '');
        const packetNumber = buf.readUInt32BE(11);
        const sampledTime = buf.readUInt32BE(15);
        const battery = buf.readUInt8(19);
        const temperature = buf.readInt16BE(20) / 100;

        const accelerometer: SensorData[] = [];
        const gyroscope: SensorData[] = [];
        const magnetometer: SensorData[] = [];

        // Body starts at offset 22
        // Each record is 18 bytes (6 Accel + 6 Gyro + 6 Mag)
        for (let i = 0; i < this.SAMPLES_PER_PACKET; i++) {
            const offset = 22 + (i * 18);
            accelerometer.push(this.parseSensor(buf.slice(offset, offset + 6)));
            gyroscope.push(this.parseSensor(buf.slice(offset + 6, offset + 12)));
            magnetometer.push(this.parseSensor(buf.slice(offset + 12, offset + 18)));
        }

        return {
            deviceId,
            packetNumber,
            sampledTime,
            battery,
            temperature,
            accelerometer,
            gyroscope,
            magnetometer
        };
    }

    private parseSensor(buf: Buffer): SensorData {
        return {
            x: buf.readInt16BE(0),
            y: buf.readInt16BE(2),
            z: buf.readInt16BE(4)
        };
    }
}
