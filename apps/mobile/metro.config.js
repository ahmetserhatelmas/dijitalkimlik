const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);
const mobileModules = path.resolve(projectRoot, "node_modules");
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [mobileModules, path.resolve(workspaceRoot, "node_modules")];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pinned =
    moduleName === "react" || moduleName.startsWith("react/")
      ? path.join(mobileModules, "react/package.json")
      : moduleName === "react-native" || moduleName.startsWith("react-native/")
        ? path.join(mobileModules, "react-native/package.json")
        : null;
  if (pinned) {
    return context.resolveRequest({ ...context, originModulePath: pinned }, moduleName, platform);
  }
  if (moduleName.startsWith(".") && moduleName.endsWith(".js") && context.originModulePath) {
    const candidate = path.resolve(path.dirname(context.originModulePath), `${moduleName.slice(0, -3)}.ts`);
    if (fs.existsSync(candidate)) return { type: "sourceFile", filePath: candidate };
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
