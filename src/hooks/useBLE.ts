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
    const [logs, setLogs] = useState<string[]>([]);
    const [isConnecting, setIsConnecting] = useState(false);
    const [lastPacket, setLastPacket] = useState<ParsedPacket | null>(null);

    const addLog = (message: string) => {
        console.log(message);
        setLogs(prev => [...prev.slice(-49), `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const connectToDevice = async (deviceName: string) => {
        if (isConnecting) return;
        
        setIsConnecting(true);
        addLog(`Checking permissions...`);
        const hasPermissions = await requestBluetoothPermissions();
        if (!hasPermissions) {
            addLog('Bluetooth permissions denied.');
            setIsConnecting(false);
            return;
        }

        try {
            // STEP 1: Start scanning (Inclusive scan for reliability)
            addLog(`Scanning for ${deviceName}...`);
            manager.startDeviceScan(null, { allowDuplicates: false }, async (error, device) => {
                if (error) {
                    addLog(`Scan Error: ${error.message}`);
                    setIsConnecting(false);
                    manager.stopDeviceScan();
                    return;
                }

                if (device && (device.name === deviceName || device.localName === deviceName)) {
                    // STOP SCAN IMMEDIATELY
                    manager.stopDeviceScan();
                    
                    addLog(`Found ${deviceName}. Post-scan stabilization (1.5s)...`);
                    // IMPORTANT: Wait for the Bluetooth stack to clear the scan state
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    addLog(`Connecting to ${deviceName}...`);
                    await setupDevice(device, deviceName);
                }
            });

            // Timeout scan after 20 seconds
            setTimeout(() => {
                if (!connectedDevice && isConnecting) {
                    manager.stopDeviceScan();
                    addLog('Scan timed out. Device not found.');
                    setIsConnecting(false);
                }
            }, 20000);

        } catch (err: any) {
            addLog(`Setup Error: ${err.message}`);
            setIsConnecting(false);
        }
    };

    const setupDevice = async (device: Device, deviceName: string) => {
        let retryCount = 0;
        const maxRetries = 1;

        while (retryCount <= maxRetries) {
            try {
                // Ensure we are connected
                let connected = device;
                const isAlreadyConnected = await device.isConnected();
                
                if (!isAlreadyConnected) {
                    addLog(retryCount > 0 ? `Retrying connection (${retryCount}/${maxRetries})...` : 'Connecting (15s timeout)...');
                    connected = await device.connect({ autoConnect: false, timeout: 15000 });
                }

                addLog('Connection stable. Negotiating MTU...');
                try {
                    // Request MTU immediately after connecting
                    await connected.requestMTU(512);
                    addLog('MTU 512 Negotiated.');
                } catch (mtuErr) {
                    addLog('MTU Negotiation failed or skipped.');
                }

                // Small delay to allow GATT stack to settle
                addLog('Waiting for stabilization (1.5s)...');
                await new Promise(resolve => setTimeout(resolve, 1500));

                addLog('Discovering services...');
                await connected.discoverAllServicesAndCharacteristics();
                
                setConnectedDevice(connected);
                addLog(`Ready! Connected to ${deviceName}`);

                // Subscribe to TX characteristic
                addLog(`Waiting for data (NUS TX)...`);
                connected.monitorCharacteristicForService(
                    NUS_SERVICE_UUID,
                    NUS_TX_CHARACTERISTIC_UUID,
                    (error, characteristic) => {
                        if (error) {
                            if (error.message.includes('Cancelled')) return;
                            addLog(`Monitor Error: ${error.message}`);
                            if (error.message.includes('Disconnected')) {
                                setConnectedDevice(null);
                            }
                            return;
                        }
                        if (characteristic?.value) {
                            const buffer = Buffer.from(characteristic.value, 'base64');
                            const packet = parser.addData(buffer);
                            if (packet) {
                                setLastPacket(packet);
                                addLog(`[DATA]: Pkt #${packet.packetNumber}`);
                            }
                        }
                    }
                );
                
                // If we reached here, connection was successful
                setIsConnecting(false);
                break;

            } catch (err: any) {
                if (retryCount < maxRetries) {
                    addLog(`Connection attempt failed: ${err.message}. Waiting 1s before retry...`);
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    addLog(`Connection Error after retries: ${err.message}`);
                    setIsConnecting(false);
                    break;
                }
            }
        }
    };

    const disconnect = async () => {
        if (connectedDevice) {
            try {
                await connectedDevice.cancelConnection();
                addLog('Disconnected.');
            } catch (err: any) {
                addLog(`Disconnect Error: ${err.message}`);
            } finally {
                setConnectedDevice(null);
                setLastPacket(null);
            }
        }
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
            addLog(`Sent: ${data}`);
        } catch (err: any) {
            addLog(`Send Error: ${err.message}`);
        }
    };

    const deviceRef = useRef<Device | null>(null);

    useEffect(() => {
        deviceRef.current = connectedDevice;
    }, [connectedDevice]);

    // Cleanup manager and persistent connections ONLY on unmount
    useEffect(() => {
        return () => {
            if (deviceRef.current) {
                deviceRef.current.cancelConnection().catch(() => {});
            }
            manager.destroy();
        };
    }, [manager]);

    return {
        connectToDevice,
        disconnect,
        connectedDevice,
        logs,
        isConnecting,
        sendData,
        lastPacket
    };
};
