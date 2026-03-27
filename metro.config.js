const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  util: require.resolve('util'),
  events: require.resolve('events'),
  path: require.resolve('path-browserify'),
  stream: require.resolve('stream-browserify'),
  buffer: require.resolve('buffer'),
  process: require.resolve('process'),
  url: require.resolve('url'),
  fs: require.resolve('./src/mocks/fs'),
  tls: require.resolve('./src/mocks/tls'),
  net: require.resolve('./src/mocks/net'),
  'crypto-js/hmac-sha256': require.resolve('crypto-js/hmac-sha256'),
  'crypto-js/sha256': require.resolve('crypto-js/sha256'),
};

module.exports = withNativeWind(config, { input: './global.css' });
