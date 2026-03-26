import React from 'react';
import { View, Text } from 'react-native';

interface SensorCardProps {
    title: string;
    value: string | number;
    unit?: string;
    subValue?: string;
    color?: string;
}

export const SensorCard: React.FC<SensorCardProps> = ({ title, value, unit, subValue, color = 'blue' }) => {
    return (
        <View className="flex-1 min-w-[45%] m-2 p-5 rounded-3xl bg-white border border-slate-100 shadow-sm">
            <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">{title}</Text>
            <View className="flex-row items-baseline mb-1">
                <Text className="text-2xl font-black text-slate-900">{value}</Text>
                {unit && <Text className="text-slate-400 text-xs ml-1 font-bold">{unit}</Text>}
            </View>
            {subValue && (
                <View className="bg-blue-50 px-2 py-0.5 rounded-full self-start mt-1">
                    <Text className="text-blue-500 text-[9px] font-bold">{subValue}</Text>
                </View>
            )}
        </View>
    );
};
