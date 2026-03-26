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
    const colorClass = color === 'blue' ? 'text-blue-400' : color === 'green' ? 'text-green-400' : color === 'orange' ? 'text-orange-400' : 'text-purple-400';
    const bgClass = color === 'blue' ? 'bg-blue-500/10' : color === 'green' ? 'bg-green-500/10' : color === 'orange' ? 'bg-orange-500/10' : 'bg-purple-500/10';
    const borderClass = color === 'blue' ? 'border-blue-500/20' : color === 'green' ? 'border-green-500/20' : color === 'orange' ? 'border-orange-500/20' : 'border-purple-500/20';

    return (
        <View className={`flex-1 min-w-[45%] m-2 p-4 rounded-3xl border ${borderClass} ${bgClass}`}>
            <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-1">{title}</Text>
            <View className="flex-row items-baseline">
                <Text className={`text-2xl font-black ${colorClass}`}>{value}</Text>
                {unit && <Text className="text-slate-500 text-xs ml-1 font-bold">{unit}</Text>}
            </View>
            {subValue && (
                <Text className="text-slate-400 text-[9px] mt-1 font-medium">{subValue}</Text>
            )}
        </View>
    );
};
