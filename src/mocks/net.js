// Shim for the 'net' module using react-native-tcp-socket
// This allows aws-iot-device-sdk to create raw TCP connections in React Native
const TcpSocket = require('react-native-tcp-socket');

function Socket() {
  const socket = TcpSocket.createConnection({ host: '0.0.0.0', port: 0 }, () => {});
  return socket;
}

module.exports = {
  Socket: Socket,
  connect: (options, callback) => {
    const connectOptions = {
      host: options.host || 'localhost',
      port: options.port || 0,
    };
    console.log('[NET Shim] Connecting to:', connectOptions.host, ':', connectOptions.port);
    return TcpSocket.createConnection(connectOptions, callback);
  },
  createConnection: (options, callback) => {
    const connectOptions = {
      host: options.host || 'localhost',
      port: options.port || 0,
    };
    return TcpSocket.createConnection(connectOptions, callback);
  },
  createServer: () => {
    return {
      listen: () => {},
      on: () => {},
      close: () => {},
    };
  },
  isIP: (input) => {
    // Basic IP check
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(input)) return 4;
    if (input.includes(':')) return 6;
    return 0;
  },
  isIPv4: (input) => /^(\d{1,3}\.){3}\d{1,3}$/.test(input),
  isIPv6: (input) => input.includes(':'),
};
