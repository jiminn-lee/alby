# Supabase Cloud and OAuth environments

## What is already configured

| Target | Supabase project | Persistent data | App callbacks |
| --- | --- | --- | --- |
| Staging | `alby-staging` | Mock users, albums, ratings, and five media fixtures | `alby-dev://auth/callback`, `alby-staging://auth/callback` |
| Production | `alby-production` | Empty; the public `media` bucket exists with no objects | `alby://auth/callback` |

Development and preview EAS environments use staging. The production EAS environment uses production. `app.config.ts` rejects a build when its app identity, `EXPO_PUBLIC_APP_ENV`, and Supabase project host do not agree.

Supabase Auth owns sessions for every provider. Google enters through Supabase's hosted OAuth broker and returns a PKCE code to the app scheme. Apple uses the native iOS API and exchanges Apple's identity token plus the original nonce for a Supabase session. No app-side OAuth secret is required or permitted.

## Spotify catalog credentials and deployment

Spotify is a server-to-server catalog dependency, not an Alby sign-in provider. Create one Spotify developer app with Web API access; under Spotify's current development-mode rules its owner needs Premium and new developers are limited to one Client ID. The same app credentials can be uploaded independently to both Supabase projects.

Copy `supabase/.env.spotify.example` to these ignored files and fill their values without committing them:

- `supabase/.env.spotify.staging.local`
- `supabase/.env.spotify.production.local`

Each file defines `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_MARKET=US`. Upload and deploy only through the guarded commands documented in the README. They verify the currently linked project; secret and deployment writes also require `--confirm=staging|production`. Deployment uses Supabase's server-side `--use-api` bundling and requires no Docker or local database.

The Edge Function requires an Alby user JWT. Search is read-only. Materialization uses the function's service-role client to call the protected database function, while Spotify access tokens and credentials never enter an Expo bundle or `EXPO_PUBLIC_*` variable.

## Credential-dependent OAuth setup

Provider credentials cannot be invented by this repository. Create them in the Google and Apple developer accounts that will own the released apps, then configure them directly in each Supabase project's **Authentication → Sign In / Providers** page.

### Google

Create two Google OAuth **Web application** clients, one per Supabase project. Never put either client secret in Expo or the repository.

| Credential | Authorized redirect URI |
| --- | --- |
| Staging Google client | `https://mkyzcpatzryoegjrqznv.supabase.co/auth/v1/callback` |
| Production Google client | `https://mldevbbnjbbcbahnpgtn.supabase.co/auth/v1/callback` |

Enable Google separately in each Supabase project and paste that environment's client ID and client secret. The hosted Supabase callback is the URI registered with Google; the custom `alby-*://` callbacks stay in Supabase's redirect allow list.

### Apple

An Apple Developer account is required for non-Expo-Go native builds. Register these App IDs and enable **Sign in with Apple**:

- `com.alby.app.dev`
- `com.alby.app.staging`
- `com.alby.app`

Enable the Apple provider in staging with the development and staging App IDs as accepted client IDs. Enable it in production with only `com.alby.app`. The current implementation is native iOS `signInWithIdToken`, so hosted-web Apple OAuth and its Services ID/signing-secret rotation remain deferred. If web or Android Apple OAuth is added later, create separate Services IDs/secrets per environment and keep the `.p8` key and generated secrets outside Expo.

## Verification after credentials are added

Build the development client and preview profiles first. For both Google and Apple, verify first-time profile creation, returning-user sign-in, app restart/session persistence, token refresh, and sign-out. Then repeat on production before release and confirm that the new production users never appear in staging.

The official references are [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase Apple Auth](https://supabase.com/docs/guides/auth/social-login/auth-apple), [Supabase native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), and [Expo EAS environment variables](https://docs.expo.dev/eas/environment-variables/).
