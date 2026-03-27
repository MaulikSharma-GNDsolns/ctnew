// Mock for the 'fs' module to allow aws-iot-device-sdk to run in React Native
module.exports = {
  readFile: () => {},
  readFileSync: () => {},
  writeFile: () => {},
  writeFileSync: () => {},
  readdir: () => {},
  readdirSync: () => {},
  stat: () => {},
  statSync: () => {},
  exists: () => {},
  existsSync: () => { return false; },
  mkdir: () => {},
  mkdirSync: () => {},
};
