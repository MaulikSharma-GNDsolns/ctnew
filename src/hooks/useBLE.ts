import { useState, useEffect, useMemo, useRef } from 'react';
import { BleManager, Device, Service, Characteristic, BleError } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

import { requestBluetoothPermissions } from '../utils/permissions';
import { ProtocolParser, ParsedPacket } from '../utils/parser';

const NUS_SERVICE_UUID = 'e9bcfbf3-bf6b-4f50-bb26-d2b64297c8c6';
const NUS_TX_CHARACTERISTIC_UUID = 'e9bcfbf5-bf6b-4f50-bb26-d2b64297c8c6'; // Notify from device
const NUS_RX_CHARACTERISTIC_UUID = 'e9bcfbf4-bf6b-4f50-bb26-d2b64297c8c6'; // Write to device

export const useBLE = () => {
    const manager = useMemo(() => new BleManager(), []);
    const parser = useMemo(() => new ProtocolParser(), []);
    const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [lastPacket, setLastPacket] = useState<ParsedPacket | null>(null);
    const [statusMessage, setStatusMessage] = useState<string>('Ready to scan');

    const addLog = (message: string) => {
        console.log(`[BLE]: ${message}`);
        setStatusMessage(message);
    };

    const connectToDevice = async (deviceName: string) => {
        // ALWAYS stop previous scan/connection attempts before starting a new one
        manager.stopDeviceScan();
        if (connectedDevice) {
            await disconnect();
        }

        setIsConnecting(true);
        setLastPacket(null);
        addLog(`Scanning...`);

        const hasPermissions = await requestBluetoothPermissions();
        if (!hasPermissions) {
            addLog('Permissions Denied');
            setIsConnecting(false);
            return;
        }

        try {
            manager.startDeviceScan(null, { allowDuplicates: false }, async (error, device) => {
                if (error) {
                    addLog(`Scan Error: ${error.message}`);
                    setIsConnecting(false);
                    return;
                }

                if (device && (device.name === deviceName || device.localName === deviceName)) {
                    manager.stopDeviceScan();
                    addLog(`Found ${deviceName}. Stabilizing...`);
                    await new Promise(resolve => setTimeout(resolve, 200));
                    addLog(`Connecting...`);
                    await setupDevice(device, deviceName);
                }
            });

            setTimeout(() => {
                if (!connectedDevice && isConnecting) {
                    manager.stopDeviceScan();
                    addLog('Device Not Found');
                    setIsConnecting(false);
                }
            }, 20000);

        } catch (err: any) {
            addLog(`Error: ${err.message}`);
            setIsConnecting(false);
        }
    };

    const setupDevice = async (device: Device, deviceName: string) => {
        let retryCount = 0;
        const maxRetries = 1;

        while (retryCount <= maxRetries) {
            try {
                let connected = device;
                const isAlreadyConnected = await device.isConnected();

                if (!isAlreadyConnected) {
                    if (retryCount > 0) addLog(`Retrying...`);
                    connected = await device.connect({ autoConnect: false, timeout: 15000 });
                }

                addLog('Negotiating...');
                try {
                    await connected.requestMTU(512);
                } catch (mtuErr) { }

                addLog('Preparing Services...');
                await new Promise(resolve => setTimeout(resolve, 200));
                await connected.discoverAllServicesAndCharacteristics();

                setConnectedDevice(connected);
                addLog(`Live Data Active`);

                connected.monitorCharacteristicForService(
                    NUS_SERVICE_UUID,
                    NUS_TX_CHARACTERISTIC_UUID,
                    (error, characteristic) => {
                        if (error) {
                            if (error.message.includes('Cancelled')) return;
                            if (error.message.includes('Disconnected')) {
                                setConnectedDevice(null);
                                addLog('Ready to Scan');
                            } else {
                                addLog('Connection Lost');
                            }
                            return;
                        }
                        if (characteristic?.value) {
                            const buffer = Buffer.from(characteristic.value, 'base64');
                            const packet = parser.addData(buffer);
                            if (packet) {
                                setLastPacket(packet);
                            }
                        }
                    }
                );

                setIsConnecting(false);
                break;

            } catch (err: any) {
                if (retryCount < maxRetries) {
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    addLog(`Disconnected`);
                    setIsConnecting(false);
                    break;
                }
            }
        }
    };

    const disconnect = async () => {
        manager.stopDeviceScan();
        if (connectedDevice) {
            try {
                await connectedDevice.cancelConnection();
            } catch (e: any) { }
            setConnectedDevice(null);
        }
        setLastPacket(null);
        setIsConnecting(false);
        addLog('Ready to Scan');
    };

    const sendData = async (data: string) => {
        if (!connectedDevice) return;
        try {
            const base64Data = Buffer.from(data).toString('base64');
            await connectedDevice.writeCharacteristicWithResponseForService(
                NUS_SERVICE_UUID,
                NUS_RX_CHARACTERISTIC_UUID,
                base64Data
            );
        } catch (err: any) {
            addLog(`Send Error: ${err.message}`);
        }
    };

    const reset = async () => {
        await disconnect();
    };

    const deviceRef = useRef<Device | null>(null);

    useEffect(() => {
        deviceRef.current = connectedDevice;
    }, [connectedDevice]);

    // Cleanup manager and persistent connections ONLY on unmount
    useEffect(() => {
        return () => {
            if (deviceRef.current) {
                deviceRef.current.cancelConnection().catch(() => { });
            }
            manager.destroy();
        };
    }, [manager]);

    return {
        connectToDevice,
        disconnect,
        reset,
        connectedDevice,
        statusMessage,
        isConnecting,
        sendData,
        lastPacket
    };
};
