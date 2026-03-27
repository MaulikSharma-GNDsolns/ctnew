// Mock for the 'net' module for React Native
module.exports = {
  Socket: function() {
    return {
      connect: () => {},
      on: () => {},
      once: () => {},
      emit: () => {},
      end: () => {},
      destroy: () => {},
      write: () => {},
    };
  },
  connect: () => {},
  createConnection: () => {},
  createServer: () => {},
  isIP: () => 0,
  isIPv4: () => false,
  isIPv6: () => false,
};
