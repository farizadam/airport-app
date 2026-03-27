const { withPodfile } = require('@expo/config-plugins');

const BUILD_SETTING =
  "config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'";

function injectNonModularHeaderSetting(contents) {
  if (contents.includes('CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES')) {
    return contents;
  }

  const reactNativePostInstallRegex = /react_native_post_install\([\s\S]*?\n\s*\)/m;
  const match = contents.match(reactNativePostInstallRegex);

  if (!match) {
    return contents;
  }

  const snippet = `\n\n  installer.pods_project.targets.each do |target|\n    target.build_configurations.each do |config|\n      ${BUILD_SETTING}\n    end\n  end`;

  return contents.replace(reactNativePostInstallRegex, `${match[0]}${snippet}`);
}

module.exports = function withNonModularHeaders(config) {
  return withPodfile(config, (configWithPodfile) => {
    configWithPodfile.modResults.contents = injectNonModularHeaderSetting(
      configWithPodfile.modResults.contents
    );
    return configWithPodfile;
  });
};
