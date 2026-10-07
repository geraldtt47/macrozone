const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const withAndroidReleaseSigning = require('./plugins/withAndroidReleaseSigning');

const projectRoot = require('node:path').dirname(require.resolve('./app.config.js'));

function loadEnvLocal() {
  const envPath = join(projectRoot, '.env.local');
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

const credentialsExample = JSON.parse(
  readFileSync(join(projectRoot, 'credentials.example.json'), 'utf8'),
);

const androidReleaseSigningMode =
  process.env.ANDROID_RELEASE_SIGNING_MODE ?? 'prod';
const keystoreRelativePath = '../credentials/release.keystore';
const keystoreAbsolutePath = join(
  projectRoot,
  credentialsExample.android.keystoreFile,
);

if (
  androidReleaseSigningMode === 'prod' &&
  !existsSync(keystoreAbsolutePath)
) {
  console.warn(
    `[app.config.js] Release keystore not found at ${credentialsExample.android.keystoreFile}. Run: bun run keystore:create`,
  );
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'MacroZone',
    slug: 'macrozone',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'macrozone',
    userInterfaceStyle: 'automatic',
    ios: {
      icon: './assets/expo.icon',
      bundleIdentifier: 'com.anonymous.macrozone',
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      package: 'com.anonymous.macrozone',
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#208AEF',
          android: {
            image: './assets/images/splash-icon.png',
            imageWidth: 76,
          },
        },
      ],
      [
        withAndroidReleaseSigning,
        {
          signingMode: androidReleaseSigningMode,
          keystoreRelativePath,
          keyAlias:
            process.env.ANDROID_KEY_ALIAS ?? credentialsExample.android.keyAlias,
          storePassword: process.env.ANDROID_KEYSTORE_PASSWORD ?? '',
          keyPassword:
            process.env.ANDROID_KEY_PASSWORD ??
            process.env.ANDROID_KEYSTORE_PASSWORD ??
            '',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: '6ea729d8-cce3-463a-a1f2-2ef8745d36ea',
      },
    },
    owner: 'btraversy',
  },
};
