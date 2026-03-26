import React from 'react';
import { View, Text } from 'react-native';
import { SensorData } from '../utils/parser';

interface SensorTableProps {
    data: {
        accelerometer: SensorData;
        gyroscope: SensorData;
        magnetometer: SensorData;
    };
}

export const SensorTable: React.FC<SensorTableProps> = ({ data }) => {
    const Row = ({ label, values }: { label: string, values: SensorData }) => (
        <View className="flex-row border-b border-slate-100 py-3 items-center">
            <View className="flex-1 px-2">
                <Text className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">{label}</Text>
            </View>
            <View className="w-20 px-1 items-center">
                <Text className="text-slate-900 font-mono text-xs">{values.x}</Text>
            </View>
            <View className="w-20 px-1 items-center">
                <Text className="text-slate-900 font-mono text-xs">{values.y}</Text>
            </View>
            <View className="w-20 px-1 items-center">
                <Text className="text-slate-900 font-mono text-xs">{values.z}</Text>
            </View>
        </View>
    );

    return (
        <View className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm mt-4">
            <View className="flex-row border-b-2 border-slate-100 pb-2 mb-1">
                <View className="flex-1 px-2">
                    <Text className="text-slate-400 font-bold text-[9px] uppercase">Sensor</Text>
                </View>
                <View className="w-20 px-1 items-center">
                    <Text className="text-slate-400 font-bold text-[9px] uppercase">X-Axis</Text>
                </View>
                <View className="w-20 px-1 items-center">
                    <Text className="text-slate-400 font-bold text-[9px] uppercase">Y-Axis</Text>
                </View>
                <View className="w-20 px-1 items-center">
                    <Text className="text-slate-400 font-bold text-[9px] uppercase">Z-Axis</Text>
                </View>
            </View>
            
            <Row label="Accel" values={data.accelerometer} />
            <Row label="Gyro" values={data.gyroscope} />
            <Row label="Mag" values={data.magnetometer} />
        </View>
    );
};
