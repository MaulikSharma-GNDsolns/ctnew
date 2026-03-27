export const MQTT_CONFIG = {
    host: 'a2ii8y5ucbdcpr-ats.iot.ap-south-1.amazonaws.com',
    region: 'ap-south-1',
    identityPoolId: 'ap-south-1:6e11968f-cda2-4515-a68d-4915e04fdc04',
    clientId: `mobile_client_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    topics: {
        uplink: 'gnd/areete/mobile/uplink',
        downlink: 'gnd/areete/mobile/downlink',
    }
};
