import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Button, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface QRScannerProps {
    onCodeScanned: (data: string) => void;
    onClose: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onCodeScanned, onClose }) => {
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    if (!permission) {
        return <View className="flex-1 justify-center items-center"><Text>Requesting permission...</Text></View>;
    }

    if (!permission.granted) {
        return (
            <View className="flex-1 justify-center items-center p-4">
                <Text className="text-center mb-4">We need your permission to show the camera</Text>
                <Button onPress={requestPermission} title="Grant Permission" />
                <TouchableOpacity onPress={onClose} className="mt-4">
                    <Text className="text-blue-500">Cancel</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);
        onCodeScanned(data);
    };

    return (
        <View className="flex-1 bg-black">
            <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr'],
                }}
            />
            <View className="absolute bottom-10 left-0 right-0 items-center">
                <TouchableOpacity 
                    onPress={onClose}
                    className="bg-white/20 px-6 py-3 rounded-full border border-white/30"
                >
                    <Text className="text-white font-bold">Cancel</Text>
                </TouchableOpacity>
            </View>
            <View className="flex-1 justify-center items-center">
                <View className="w-64 h-64 border-2 border-white/50 rounded-xl" />
                <Text className="text-white mt-4 font-semibold shadow-lg">Scan Device QR Code</Text>
            </View>
        </View>
    );
};
