import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SensorData } from '../utils/parser';

interface SensorTableProps {
    data: SensorData[];
    label: string;
}

export const SensorTable: React.FC<SensorTableProps> = ({ data, label }) => {
    return (
        <View className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-6">
            {/* Table Header */}
            <View className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex-row justify-between items-center">
                <Text className="text-slate-900 font-black text-xs uppercase tracking-widest">{label}</Text>
                <Text className="text-slate-400 text-[10px] font-bold">{data.length} SAMPLES</Text>
            </View>

            {/* Column Headers */}
            <View className="flex-row px-4 py-2 bg-slate-50/50 border-b border-slate-50">
                <View className="w-10"><Text className="text-[9px] font-black text-slate-400 uppercase">#</Text></View>
                <View className="flex-1"><Text className="text-[9px] font-black text-slate-400 uppercase text-center">X-Axis</Text></View>
                <View className="flex-1"><Text className="text-[9px] font-black text-slate-400 uppercase text-center">Y-Axis</Text></View>
                <View className="flex-1"><Text className="text-[9px] font-black text-slate-400 uppercase text-center">Z-Axis</Text></View>
            </View>

            {/* Scrollable Body */}
            <View style={{ height: 350 }}>
                <ScrollView nestedScrollEnabled={true}>
                    {data.map((item, index) => (
                        <View key={index} className={`flex-row px-4 py-2 items-center ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                            <View className="w-10">
                                <Text className="text-[10px] font-bold text-slate-300">{(index + 1).toString().padStart(2, '0')}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-[11px] font-mono font-bold text-slate-700 text-center">{item.x.toString().padStart(5, ' ')}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-[11px] font-mono font-bold text-slate-700 text-center">{item.y.toString().padStart(5, ' ')}</Text>
                            </View>
                            <View className="flex-1">
                                <Text className="text-[11px] font-mono font-bold text-slate-700 text-center">{item.z.toString().padStart(5, ' ')}</Text>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            </View>
        </View>
    );
};
