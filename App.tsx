import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QRScanner } from './src/components/QRScanner';
import { SensorCard } from './src/components/SensorCard';
import { useBLE } from './src/hooks/useBLE';
import './global.css';

export default function App() {
    const [showScanner, setShowScanner] = useState(false);
    const { connectToDevice, disconnect, connectedDevice, logs, isConnecting, lastPacket } = useBLE();

    const handleQRScanned = (data: string) => {
        setShowScanner(false);
        connectToDevice(data);
    };

    return (
        <SafeAreaProvider>
            <SafeAreaView className="flex-1 bg-slate-950">
                <StatusBar barStyle="light-content" />
                
                {showScanner ? (
                    <QRScanner 
                        onCodeScanned={handleQRScanned} 
                        onClose={() => setShowScanner(false)} 
                    />
                ) : (
                    <View className="flex-1 px-4 py-2">
                        <View className="items-center mt-6 mb-8">
                            <Text className="text-3xl font-extrabold text-white tracking-tight">
                                C-Tag <Text className="text-blue-500">Live</Text>
                            </Text>
                        </View>

                        <View className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-2xl mb-4">
                            <View className="flex-row justify-between items-center mb-4">
                                <View>
                                    <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Connection</Text>
                                    <View className="flex-row items-center">
                                        <View className={`w-2 h-2 rounded-full mr-2 ${connectedDevice ? 'bg-green-500' : isConnecting ? 'bg-blue-500 animate-pulse' : 'bg-slate-600'}`} />
                                        <Text className={`text-base font-bold ${connectedDevice ? 'text-white' : 'text-slate-500'}`}>
                                            {connectedDevice ? (connectedDevice.name || 'Device Connected') : isConnecting ? 'Connecting...' : 'Disconnected'}
                                        </Text>
                                    </View>
                                </View>
                                {!connectedDevice ? (
                                    <TouchableOpacity 
                                        onPress={() => setShowScanner(true)}
                                        disabled={isConnecting}
                                        className="bg-blue-600 px-4 py-2 rounded-xl shadow-lg"
                                    >
                                        <Text className="text-white font-bold text-sm">Scan QR</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity 
                                        onPress={disconnect}
                                        className="bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl"
                                    >
                                        <Text className="text-red-500 font-bold text-sm">Stop</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {lastPacket && (
                                <View className="flex-row flex-wrap -m-2 pt-2">
                                    <SensorCard 
                                        title="Battery" 
                                        value={lastPacket.battery} 
                                        unit="%" 
                                        color={lastPacket.battery > 20 ? 'green' : 'orange'}
                                    />
                                    <SensorCard 
                                        title="Temperature" 
                                        value={lastPacket.temperature.toFixed(2)} 
                                        unit="°C" 
                                        color="orange"
                                    />
                                    <SensorCard 
                                        title="Accelerometer" 
                                        value={`${lastPacket.accelerometer.x}`}
                                        subValue={`Y: ${lastPacket.accelerometer.y} Z: ${lastPacket.accelerometer.z}`}
                                        color="blue"
                                    />
                                    <SensorCard 
                                        title="Gyroscope" 
                                        value={`${lastPacket.gyroscope.x}`}
                                        subValue={`Y: ${lastPacket.gyroscope.y} Z: ${lastPacket.gyroscope.z}`}
                                        color="purple"
                                    />
                                </View>
                            )}
                        </View>

                        <View className="flex-1 bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
                            <View className="bg-slate-800/50 px-5 py-3 border-b border-slate-800 flex-row justify-between items-center">
                                <Text className="text-white font-bold text-sm italic">Raw Activity</Text>
                                {lastPacket && (
                                    <Text className="text-slate-500 text-[10px] font-mono">Pkt: #{lastPacket.packetNumber}</Text>
                                )}
                            </View>
                            <ScrollView 
                                className="flex-1 p-4"
                                contentContainerStyle={{ paddingBottom: 20 }}
                                ref={(ref) => ref?.scrollToEnd({ animated: true })}
                            >
                                {logs.length === 0 ? (
                                    <Text className="text-slate-600 italic text-center mt-10">Waiting for connection...</Text>
                                ) : (
                                    logs.map((log, i) => (
                                        <Text key={i} className="text-slate-400 font-mono text-[9px] mb-1 leading-4">
                                            {log}
                                        </Text>
                                    ))
                                )}
                            </ScrollView>
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </SafeAreaProvider>
    );
}
