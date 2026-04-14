import './src/polyfills';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Modal,
  Animated,
  Image,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QRScanner } from './src/components/QRScanner';
import { SensorCard } from './src/components/SensorCard';
import { SensorTable } from './src/components/SensorTable';
import { useBLE } from './src/hooks/useBLE';
import { mqttService } from './src/services/mqttService';
import './global.css';

export default function App() {
  const [showScanner, setShowScanner] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<'accel' | 'gyro' | 'mag'>('accel');
  const [isCloudUploading, setIsCloudUploading] = useState(false);
  const [cloudUploadSuccess, setCloudUploadSuccess] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const tickAnim = useRef(new Animated.Value(0)).current;
  const {
    connectToDevice,
    disconnect,
    reset,
    connectedDevice,
    isConnecting,
    lastPacket,
    statusMessage,
    mqttStatus,
  } = useBLE();

  // Reset cloud upload success when new data arrives
  useEffect(() => {
    if (lastPacket && cloudUploadSuccess) {
      setCloudUploadSuccess(false);
      tickAnim.setValue(0);
    }
  }, [lastPacket]);

  const handleScanPress = () => {
    // Animate button press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setShowScanner(true);
    // sendTestMessage removed — publish only via the Cloud button
  };

  const handleQRScanned = (data: string) => {
    setShowScanner(false);
    connectToDevice(data);
  };

  const handleCloudPress = async () => {
    // Animate button press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    if (lastPacket && !isCloudUploading && !cloudUploadSuccess) {
      setIsCloudUploading(true);
      try {
        const success = await mqttService.publish(lastPacket);
        if (success) {
          setCloudUploadSuccess(true);
          // Animate tick mark
          Animated.timing(tickAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        }
      } catch (error) {
        console.error('Cloud upload failed:', error);
      } finally {
        setIsCloudUploading(false);
      }
    }
  };

  const handleBack = () => {
    reset();
  };

  const SensorTabs = () => (
    <View className="mb-4 flex-row rounded-2xl bg-slate-100 p-1.5">
      {(['accel', 'gyro', 'mag'] as const).map((tab) => (
        <TouchableOpacity
          key={tab}
          onPress={() => setSelectedSensor(tab)}
          className={`flex-1 items-center rounded-xl py-2 ${selectedSensor === tab ? 'bg-white shadow-sm' : ''}`}>
          <Text
            className={`text-[10px] font-black uppercase tracking-widest ${selectedSensor === tab ? 'text-blue-500' : 'text-slate-400'}`}>
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

        <ScrollView className="flex-1">
          <View className="px-6 py-4">
            {/* Header */}
            <View className="mb-8 mt-12 flex-row items-center justify-between">
              <View className="flex-row items-center">
                {(connectedDevice || isConnecting) && (
                  <TouchableOpacity
                    onPress={handleBack}
                    className="mr-4 rounded-full border border-slate-100 bg-white p-2 shadow-sm">
                    <Text className="text-xs font-bold uppercase text-blue-500">← Back</Text>
                  </TouchableOpacity>
                )}
                <View>
                  <Text className="text-2xl font-black tracking-tight text-slate-900">
                    C-Tag <Text className="text-blue-500">Live</Text>
                  </Text>
                  <View className="mt-1 flex-row items-center">
                    {isConnecting && !connectedDevice && (
                      <ActivityIndicator size="small" color="#3B82F6" className="mr-2 scale-75" />
                    )}
                    <View
                      className={`mr-2 h-1.5 w-1.5 rounded-full ${connectedDevice ? 'bg-green-500' : isConnecting ? 'bg-blue-500' : 'bg-slate-300'}`}
                    />
                    <Text className="mr-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {statusMessage}
                    </Text>

                    {/* MQTT Status */}
                    <View
                      className={`mr-2 h-1.5 w-1.5 rounded-full ${mqttStatus ? 'bg-cyan-400 shadow-sm shadow-cyan-200' : 'bg-slate-200'}`}
                    />
                    <Text
                      className={`text-[10px] font-bold uppercase tracking-widest ${mqttStatus ? 'text-cyan-500' : 'text-slate-300'}`}>
                      {mqttStatus ? 'Cloud Connected' : 'Cloud Offline'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Summary Cards */}
            {lastPacket ? (
              <View>
                <View className="-m-2 mb-4 flex-row">
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
                  label={
                    selectedSensor === 'accel'
                      ? 'Accelerometer'
                      : selectedSensor === 'gyro'
                        ? 'Gyroscope'
                        : 'Magnetometer'
                  }
                  data={
                    selectedSensor === 'accel'
                      ? lastPacket.accelerometer
                      : selectedSensor === 'gyro'
                        ? lastPacket.gyroscope
                        : lastPacket.magnetometer
                  }
                />

                {/* Stats Footer */}
                <View className="mt-6 items-center">
                  <View className="rounded-full border border-slate-100 bg-white/50 px-4 py-2 italic"></View>
                </View>
              </View>
            ) : (
              <View className="mt-20 items-center justify-center">
                {isConnecting || (connectedDevice && !lastPacket) ? (
                  <View className="items-center">
                    <ActivityIndicator size="large" color="#3B82F6" className="mb-6" />
                    <Text
                      numberOfLines={1}
                      className="animate-pulse text-lg font-bold italic text-slate-900">
                      {connectedDevice ? 'Awaiting Sensor Data' : 'Establishing Sensor Link'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-blue-50">
                      <Text className="text-3xl font-bold text-blue-500">?</Text>
                    </View>
                    <Text className="text-lg font-bold text-slate-900">No Active Data</Text>
                    <Text className="mt-2 px-10 text-center text-sm leading-5 text-slate-400">
                      Scan a device QR code to begin real-time sensor monitoring.
                    </Text>
                  </>
                )}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Floating Circular Scan Button */}
        {!connectedDevice && (
          <View className="absolute bottom-1/4 left-0 right-0 items-center">
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                onPress={handleScanPress}
                className="h-24 w-24 items-center justify-center rounded-full border-2 border-blue-500 bg-white shadow-lg"
                style={{
                  shadowColor: '#3B82F6',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 12,
                }}>
                <Image
                  source={require('./assets/qr_.png')}
                  className="h-12 w-12"
                  resizeMode="contain"
                />
              </TouchableOpacity>
            </Animated.View>
            <Text className="mt-2 text-center text-sm font-bold text-blue-500">
              {isConnecting ? 'RESCAN' : 'SCAN'}
            </Text>
          </View>
        )}

        {/* Cloud Upload Button - Only show when connected and have data */}
        {connectedDevice && lastPacket && (
          <View className="absolute bottom-7 left-0 right-0 items-center pb-8">
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <TouchableOpacity
                onPress={handleCloudPress}
                disabled={isCloudUploading || cloudUploadSuccess}
                className={`h-24 w-24 items-center justify-center rounded-full border-2 bg-white shadow-lg ${
                  cloudUploadSuccess
                    ? 'border-green-500'
                    : isCloudUploading
                      ? 'border-orange-500'
                      : 'border-blue-500'
                }`}
                style={{
                  shadowColor: cloudUploadSuccess
                    ? '#10B981'
                    : isCloudUploading
                      ? '#F97316'
                      : '#3B82F6',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 12,
                }}>
                {isCloudUploading ? (
                  <ActivityIndicator size="large" color="#F97316" />
                ) : cloudUploadSuccess ? (
                  <Animated.View style={{ opacity: tickAnim }}>
                    <Image
                      source={require('./assets/tick.png')}
                      style={{ width: 50, height: 50 }}
                    />
                  </Animated.View>
                ) : (
                  <Image source={require('./assets/cloud.jpg')} style={{ width: 57, height: 57 }} />
                )}
              </TouchableOpacity>
            </Animated.View>{' '}
            <Text className="mt-2 text-center text-sm font-bold text-blue-500">
              {cloudUploadSuccess
                ? 'UPLOADED'
                : isCloudUploading
                  ? 'UPLOADING...'
                  : 'PUSH TO CLOUD'}
            </Text>{' '}
          </View>
        )}

        <Modal
          visible={showScanner}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setShowScanner(false)}>
          <QRScanner onCodeScanned={handleQRScanned} onClose={() => setShowScanner(false)} />
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
