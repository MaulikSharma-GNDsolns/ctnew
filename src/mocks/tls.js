// Mock for the 'tls' module for React Native
module.exports = {
  connect: () => {
    return {
      on: () => {},
      once: () => {},
      emit: () => {},
      end: () => {},
      destroy: () => {},
      write: () => {},
    };
  },
  Server: function() {
    return {
      listen: () => {},
      on: () => {},
    };
  },
  createSecureContext: () => ({}),
};
