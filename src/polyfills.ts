import { Buffer } from 'buffer';
import 'react-native-get-random-values';

// Polyfill Buffer
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Polyfill process
if (typeof global.process === 'undefined') {
  // @ts-ignore
  global.process = require('process');
} else {
  const bProcess = require('process');
  for (var p in bProcess) {
    if (!(p in global.process)) {
      // @ts-ignore
      global.process[p] = bProcess[p];
    }
  }
}

// Ensure process.env is defined
if (!global.process.env) {
  global.process.env = { NODE_ENV: __DEV__ ? 'development' : 'production' };
}

// Polyfill crypto if needed (react-native-get-random-values handles standard crypto.getRandomValues)
if (typeof global.crypto === 'undefined') {
  // @ts-ignore
  global.crypto = {};
}

console.log('[Polyfills] Node.js environment polyfills initialized');
