import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QRScanner } from './src/components/QRScanner';
import { SensorCard } from './src/components/SensorCard';
import { SensorTable } from './src/components/SensorTable';
import { useBLE } from './src/hooks/useBLE';
import './global.css';

export default function App() {
    const [showScanner, setShowScanner] = useState(false);
    const { connectToDevice, disconnect, reset, connectedDevice, isConnecting, lastPacket, statusMessage } = useBLE();

    const handleQRScanned = (data: string) => {
        setShowScanner(false);
        connectToDevice(data);
    };

    const [selectedSensor, setSelectedSensor] = useState<'accel' | 'gyro' | 'mag'>('accel');

    const handleBack = () => {
        reset();
    };

    const SensorTabs = () => (
        <View className="flex-row bg-slate-100 p-1.5 rounded-2xl mb-4">
            {(['accel', 'gyro', 'mag'] as const).map((tab) => (
                <TouchableOpacity
                    key={tab}
                    onPress={() => setSelectedSensor(tab)}
                    className={`flex-1 py-2 rounded-xl items-center ${selectedSensor === tab ? 'bg-white shadow-sm' : ''}`}
                >
                    <Text className={`text-[10px] font-black uppercase tracking-widest ${selectedSensor === tab ? 'text-blue-500' : 'text-slate-400'}`}>
                        {tab === 'accel' ? 'Accelerometer' : tab === 'gyro' ? 'Gyroscope' : 'Magnetometer'}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    return (
        <SafeAreaProvider>
            <SafeAreaView className="flex-1 bg-slate-50">
                <StatusBar barStyle="dark-content" />
                
                {showScanner ? (
                    <QRScanner 
                        onCodeScanned={handleQRScanned} 
                        onClose={() => setShowScanner(false)} 
                    />
                ) : (
                    <ScrollView className="flex-1">
                        <View className="px-6 py-4">
                            {/* Header */}
                            <View className="flex-row justify-between items-center mt-12 mb-8">
                                <View className="flex-row items-center">
                                    {(connectedDevice || isConnecting) && (
                                        <TouchableOpacity 
                                            onPress={handleBack}
                                            className="mr-4 p-2 bg-white rounded-full border border-slate-100 shadow-sm"
                                        >
                                            <Text className="text-blue-500 font-bold text-xs uppercase">← Back</Text>
                                        </TouchableOpacity>
                                    )}
                                    <View>
                                        <Text className="text-2xl font-black text-slate-900 tracking-tight">
                                            C-Tag <Text className="text-blue-500">Live</Text>
                                        </Text>
                                        <View className="flex-row items-center mt-1">
                                            {isConnecting && !connectedDevice && (
                                                <ActivityIndicator size="small" color="#3B82F6" className="mr-2 scale-75" />
                                            )}
                                            <View className={`w-1.5 h-1.5 rounded-full mr-2 ${connectedDevice ? 'bg-green-500' : isConnecting ? 'bg-blue-500' : 'bg-slate-300'}`} />
                                            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {statusMessage}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                
                                {!connectedDevice && (
                                    <TouchableOpacity 
                                        onPress={() => setShowScanner(true)}
                                        className="bg-blue-500 px-5 py-2.5 rounded-2xl shadow-blue-200 shadow-lg"
                                    >
                                        <Text className="text-white font-bold text-xs uppercase tracking-wider">
                                            {isConnecting ? 'Rescan' : 'Scan QR'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Summary Cards */}
                            {lastPacket ? (
                                <View>
                                    <View className="flex-row -m-2 mb-4">
                                        <SensorCard 
                                            title="Battery" 
                                            value={lastPacket.battery} 
                                            unit="%" 
                                            subValue={lastPacket.battery > 20 ? 'Healthy' : 'Low'}
                                        />
                                        <SensorCard 
                                            title="Temp" 
                                            value={lastPacket.temperature.toFixed(1)} 
                                            unit="°C" 
                                            subValue="Ambient"
                                        />
                                    </View>

                                    {/* Tab Selector */}
                                    <SensorTabs />

                                    {/* High Density Table */}
                                    <SensorTable 
                                        label={selectedSensor === 'accel' ? 'Accelerometer' : selectedSensor === 'gyro' ? 'Gyroscope' : 'Magnetometer'}
                                        data={selectedSensor === 'accel' ? lastPacket.accelerometer : selectedSensor === 'gyro' ? lastPacket.gyroscope : lastPacket.magnetometer}
                                    />

                                    {/* Stats Footer */}
                                    <View className="mt-6 items-center">
                                        <View className="bg-white/50 px-4 py-2 rounded-full border border-slate-100 italic">
                                            <Text className="text-slate-400 text-[10px]">
                                                Update Frequency: 1Hz  •  Packet #{lastPacket.packetNumber}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            ) : (
                                <View className="mt-20 items-center justify-center">
                                    {isConnecting || (connectedDevice && !lastPacket) ? (
                                        <View className="items-center">
                                            <ActivityIndicator size="large" color="#3B82F6" className="mb-6" />
                                            <Text className="text-slate-900 text-lg font-bold italic animate-pulse">
                                                {connectedDevice ? 'Awaiting Sensor Data...' : 'Establishing Sensor Link...'}
                                            </Text>
                                        </View>
                                    ) : (
                                        <>
                                            <View className="w-20 h-20 bg-blue-50 rounded-full items-center justify-center mb-6">
                                                <Text className="text-3xl text-blue-500 font-bold">?</Text>
                                            </View>
                                            <Text className="text-slate-900 text-lg font-bold">No Active Data</Text>
                                            <Text className="text-slate-400 text-center mt-2 px-10 text-sm leading-5">
                                                Scan a device QR code to begin real-time sensor monitoring.
                                            </Text>
                                        </>
                                    )}
                                </View>
                            )}
                        </View>
                    </ScrollView>
                )}
            </SafeAreaView>
        </SafeAreaProvider>
    );
}
