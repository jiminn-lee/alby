import type { ConfigContext, ExpoConfig } from 'expo/config';

const variants = {
  development: {
    name: 'Alby Dev',
    identifier: 'com.alby.app.dev',
    scheme: 'alby-dev',
    appEnvironment: 'staging',
    supabaseProjectRef: 'mkyzcpatzryoegjrqznv',
  },
  staging: {
    name: 'Alby Staging',
    identifier: 'com.alby.app.staging',
    scheme: 'alby-staging',
    appEnvironment: 'staging',
    supabaseProjectRef: 'mkyzcpatzryoegjrqznv',
  },
  production: {
    name: 'Alby',
    identifier: 'com.alby.app',
    scheme: 'alby',
    appEnvironment: 'production',
    supabaseProjectRef: 'mldevbbnjbbcbahnpgtn',
  },
} as const;

export type AppVariant = keyof typeof variants;

function getAppVariant(): AppVariant {
  const requestedVariant = process.env.APP_VARIANT ?? 'development';
  if (!(requestedVariant in variants)) {
    throw new Error(`APP_VARIANT must be one of ${Object.keys(variants).join(', ')}.`);
  }
  return requestedVariant as AppVariant;
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appVariant = getAppVariant();
  const variant = variants[appVariant];

  return {
    ...config,
    name: variant.name,
    owner: 'lee-ji-min',
    slug: 'alby',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: variant.scheme,
    userInterfaceStyle: 'light',
    ios: {
      ...config.ios,
      bundleIdentifier: variant.identifier,
      usesAppleSignIn: true,
      supportsTablet: false,
    },
    android: {
      ...config.android,
      package: variant.identifier,
      predictiveBackGestureEnabled: false,
    },
    web: {
      ...config.web,
      output: 'static',
    },
    plugins: [
      'expo-router',
      'expo-apple-authentication',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#FCF9F3',
          image: './assets/images/alby/disc-gold.png',
          imageWidth: 76,
        },
      ],
      'expo-asset',
      'expo-secure-store',
      'expo-web-browser',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      ...config.extra,
      eas: {
        projectId: '3d67e971-6211-4dba-a0b4-dab24cdc715a',
      },
      appScheme: variant.scheme,
      appVariant,
      expectedAppEnvironment: variant.appEnvironment,
      supabaseProjectRef: variant.supabaseProjectRef,
    },
  };
};
