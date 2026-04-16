export const MQTT_CONFIG = {
    host: 'a2ii8y5ucbdcpr-ats.iot.ap-south-1.amazonaws.com',
    region: 'ap-south-1',

    // Cognito Identity Pool (Authenticated access only)
    identityPoolId: 'ap-south-1:74996a09-6e61-4fd0-a32d-6d9d730fbe5c',

    // ⚠️ TODO: Fill these in from AWS Console → Cognito → User Pools
    // User Pool ID format: ap-south-1_XXXXXXXXX
    userPoolId: 'ap-south-1_90iFviUYd',
    // This client ID must match the one registered in the Identity Pool
    userPoolClientId: '5l795q7hl6b2d1obegdk6b36qq',
    // App Client Secret
    userPoolClientSecret: '',

    // Service account used to obtain authenticated credentials for IoT Core
    serviceAccount: {
        email: 'devika.n@gndsolutions.in',
        password: 'Devika@2026',
    },

    clientId: `mobile_client_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    topics: {
        uplink: 'gnd/areete/mobile/uplink',
        downlink: 'gnd/areete/mobile/downlink',
    },
};
