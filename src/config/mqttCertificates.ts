export const MQTT_CONFIG = {
    host: 'a2ii8y5ucbdcpr-ats.iot.ap-south-1.amazonaws.com',
    region: 'ap-south-1',

    // Cognito Identity Pool (Authenticated access only)
    identityPoolId: 'ap-south-1:74996a09-6e61-4fd0-a32d-6d9d730fbe5c',

    // ⚠️ TODO: Fill these in from AWS Console → Cognito → User Pools
    // User Pool ID format: ap-south-1_XXXXXXXXX
    userPoolId: 'ap-south-1_e7y3BpNkN',
    // This client ID must match the one registered in the Identity Pool
    userPoolClientId: '74cfrr2pk3hscr5ddaq10on74j',   // Dashboard_app
    // App Client Secret (confirmed for this client)
    userPoolClientSecret: '15rpm3brqltkjeh34tdjql6ukbcg5onbojcvoobd3k8gu2rp31gm',

    // Service account used to obtain authenticated credentials for IoT Core
    serviceAccount: {
        email: 'devika.n@gndsolutions.in',
        password: 'Devika@01',
    },

    clientId: `mobile_client_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`,
    topics: {
        uplink: 'gnd/areete/mobile/uplink',
        downlink: 'gnd/areete/mobile/downlink',
    },
};
