// Shim for the 'tls' module using react-native-tcp-socket
// This allows aws-iot-device-sdk to establish real TLS connections in React Native
const TcpSocket = require('react-native-tcp-socket');

module.exports = {
  connect: (options, callback) => {
    // Map Node.js tls.connect options to react-native-tcp-socket TLS options
    const tlsOptions = {
      host: options.host || options.servername,
      port: options.port || 8883,
      tls: true,
      tlsCert: options.cert,
      tlsKey: options.key,
      tlsCa: options.ca,
    };

    console.log('[TLS Shim] Connecting to:', tlsOptions.host, ':', tlsOptions.port);

    const socket = TcpSocket.createConnection(tlsOptions, () => {
      console.log('[TLS Shim] TLS connection established');
      if (callback) callback();
    });

    // Shim: Node.js tls expects `authorized` property
    socket.authorized = true;

    return socket;
  },
  Server: function () {
    return {
      listen: () => {},
      on: () => {},
    };
  },
  createSecureContext: (options) => {
    // Return the options as-is; the actual TLS context is handled by the native layer
    return options || {};
  },
};
