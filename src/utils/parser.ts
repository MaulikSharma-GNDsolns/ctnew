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
    accelerometer: SensorData;
    gyroscope: SensorData;
    magnetometer: SensorData;
}

export class ProtocolParser {
    private buffer: Buffer = Buffer.alloc(0);
    private readonly PACKET_SIZE = 1030;
    private readonly START_BYTE = 0xC1;

    public addData(newData: Buffer): ParsedPacket | null {
        // Append new data to current buffer
        this.buffer = Buffer.concat([this.buffer, newData]);

        // Find the start byte
        const startIndex = this.buffer.indexOf(this.START_BYTE);
        if (startIndex === -1) {
            // No start byte found, clear buffer if it's getting too large without a header
            if (this.buffer.length > this.PACKET_SIZE * 2) {
                this.buffer = Buffer.alloc(0);
            }
            return null;
        }

        // Trim buffer to start at the header
        if (startIndex > 0) {
            this.buffer = this.buffer.slice(startIndex);
        }

        // Check if we have a full packet
        if (this.buffer.length < this.PACKET_SIZE) {
            return null;
        }

        // Extract packet
        const packet = this.buffer.slice(0, this.PACKET_SIZE);
        this.buffer = this.buffer.slice(this.PACKET_SIZE);

        return this.parsePacket(packet);
    }

    private parsePacket(buf: Buffer): ParsedPacket {
        const deviceId = buf.slice(1, 11).toString('ascii').replace(/\0/g, '');
        const packetNumber = buf.readUInt32BE(11);
        const sampledTime = buf.readUInt32BE(15);
        const battery = buf.readUInt8(19);
        const temperature = buf.readInt16BE(20) / 100; // Assuming 2 decimal places

        // For the UI, we'll just show the first sample in the packet
        const accel = this.parseSensor(buf.slice(22, 28));
        const gyro = this.parseSensor(buf.slice(28, 34));
        const mag = this.parseSensor(buf.slice(34, 40));

        return {
            deviceId,
            packetNumber,
            sampledTime,
            battery,
            temperature,
            accelerometer: accel,
            gyroscope: gyro,
            magnetometer: mag
        };
    }

    private parseSensor(buf: Buffer): SensorData {
        // Assuming 16-bit signed Big Endian values for X, Y, Z
        return {
            x: buf.readInt16BE(0),
            y: buf.readInt16BE(2),
            z: buf.readInt16BE(4)
        };
    }
}
