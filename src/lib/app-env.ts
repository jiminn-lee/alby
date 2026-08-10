import Constants from 'expo-constants';

export type AppEnvironment = 'staging' | 'production';

const environment = process.env.EXPO_PUBLIC_APP_ENV;
const configuredSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const configuredSupabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (environment !== 'staging' && environment !== 'production') {
  throw new Error('EXPO_PUBLIC_APP_ENV must be either staging or production.');
}

if (!configuredSupabaseUrl || !configuredSupabasePublishableKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');
}

const supabaseUrl: string = configuredSupabaseUrl;
const supabasePublishableKey: string = configuredSupabasePublishableKey;
const parsedSupabaseUrl = new URL(supabaseUrl);
if (parsedSupabaseUrl.protocol !== 'https:') {
  throw new Error('EXPO_PUBLIC_SUPABASE_URL must use HTTPS and point to Supabase Cloud.');
}

if (['127.0.0.1', 'localhost', '10.0.2.2'].includes(parsedSupabaseUrl.hostname)) {
  throw new Error('Local Supabase URLs are not supported; use the hosted staging or production project.');
}

const configuredScheme = Constants.expoConfig?.scheme;
const appScheme = Array.isArray(configuredScheme) ? configuredScheme[0] : configuredScheme;
if (!appScheme) {
  throw new Error('The Expo app variant is missing its OAuth callback scheme.');
}

const expectedAppEnvironment = Constants.expoConfig?.extra?.expectedAppEnvironment;
const expectedSupabaseProjectRef = Constants.expoConfig?.extra?.supabaseProjectRef;
if (environment !== expectedAppEnvironment) {
  throw new Error(`This app variant requires the ${String(expectedAppEnvironment)} backend, not ${environment}.`);
}

if (parsedSupabaseUrl.hostname !== `${expectedSupabaseProjectRef}.supabase.co`) {
  throw new Error('The Supabase Project URL does not match this app variant.');
}

export const appEnvironment: AppEnvironment = environment;
export const isStaging = environment === 'staging';
export { appScheme, supabasePublishableKey, supabaseUrl };
