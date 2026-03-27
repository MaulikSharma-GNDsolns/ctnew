const { withProjectBuildGradle } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to add the missing local Maven repository for @react-native-async-storage/async-storage.
 * This is required for version 3.0.x which uses a local storage engine.
 */
const withAsyncStorageRepo = (config) => {
  return withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      config.modResults.contents = addAsyncStorageRepo(config.modResults.contents);
    }
    return config;
  });
};

function addAsyncStorageRepo(buildGradle) {
  const repo = 'maven { url "$rootDir/../node_modules/@react-native-async-storage/async-storage/android/local_repo" }';
  
  // Check if repository already exists to avoid duplication
  if (buildGradle.includes(repo)) {
    return buildGradle;
  }

  // Find the allprojects repositories block and inject the repo
  // We look for the first 'repositories {' block after 'allprojects {'
  const allProjectsIndex = buildGradle.indexOf('allprojects {');
  if (allProjectsIndex === -1) return buildGradle;

  const repositoriesMatch = buildGradle.slice(allProjectsIndex).match(/repositories\s*{/);
  if (!repositoriesMatch) return buildGradle;

  const insertIndex = allProjectsIndex + repositoriesMatch.index + repositoriesMatch[0].length;
  
  return (
    buildGradle.slice(0, insertIndex) +
    `\n        ${repo}` +
    buildGradle.slice(insertIndex)
  );
}

module.exports = withAsyncStorageRepo;
