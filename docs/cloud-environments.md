# Supabase Cloud and OAuth environments

## Environment contracts

| Target | Supabase project | Persistent data | App callbacks |
| --- | --- | --- | --- |
| Staging | `alby-staging` | Tracked mock fixtures plus OAuth users and their data | `alby-dev://auth/callback`, `alby-staging://auth/callback` |
| Production | `alby-production` | Legitimate production data only; tracked mocks are forbidden | `alby://auth/callback` |

Development and preview EAS environments use staging. The production EAS environment uses production. `app.config.ts` rejects a build when its app identity, `EXPO_PUBLIC_APP_ENV`, and Supabase project host do not agree.

Supabase Auth owns Alby sessions. Google enters through Supabase's hosted OAuth broker and returns a PKCE code to the app scheme. Google client secrets live only in the corresponding Supabase provider configuration; no app-side OAuth secret or Google client ID is required or permitted.

Google is the active provider for this milestone on native iOS and Android. Web OAuth is not enabled. Native Sign in with Apple is deferred until Apple Developer access is available and remains a release requirement before the iOS app is submitted.

## Spotify catalog credentials and deployment

Spotify is a server-to-server catalog dependency, not an Alby sign-in provider. Create one Spotify developer app with Web API access; under Spotify's current development-mode rules its owner needs Premium and new developers are limited to one Client ID. The same app credentials can be uploaded independently to both Supabase projects.

Copy `supabase/.env.spotify.example` to these ignored files and fill their values without committing them:

- `supabase/.env.spotify.staging.local`
- `supabase/.env.spotify.production.local`

Each file defines `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_MARKET=US`. Upload and deploy only through the guarded commands documented in the README. They verify the currently linked project; secret and deployment writes also require `--confirm=staging|production`. Deployment uses Supabase's server-side `--use-api` bundling and requires no Docker or local database.

The Edge Function requires an Alby user JWT. Search is read-only. Materialization uses the function's service-role client to call the protected database function, while Spotify access tokens and credentials never enter an Expo bundle or `EXPO_PUBLIC_*` variable.

## Google OAuth setup

Provider credentials cannot be invented by this repository. Create them in the Google developer account that will own the released app, then configure them directly in each Supabase project's **Authentication → Sign In / Providers → Google** page. The **Supabase OAuth Server** screen is unrelated; leave it disabled because Alby is an OAuth client, not an authorization server for third-party apps.

Create two Google OAuth **Web application** clients, one per Supabase project. Never put either client secret in Expo or the repository.

| Credential | Authorized redirect URI |
| --- | --- |
| Staging Google client | `https://mkyzcpatzryoegjrqznv.supabase.co/auth/v1/callback` |
| Production Google client | `https://mldevbbnjbbcbahnpgtn.supabase.co/auth/v1/callback` |

Enable Google separately in each Supabase project and paste that environment's client ID and client secret. The hosted Supabase callback is the URI registered with Google; the custom `alby-*://` callbacks stay in Supabase's redirect allow list.

In **Authentication → URL Configuration**, use these exact values:

| Target | Site URL | Redirect URLs |
| --- | --- | --- |
| Staging | `alby-staging://auth/callback` | `alby-dev://auth/callback`, `alby-staging://auth/callback` |
| Production | `alby://auth/callback` | `alby://auth/callback` |

Request only Google's `openid`, email, and profile scopes. Alby does not request Google API access, offline access, or provider refresh tokens.

## Deferred Apple setup

Before an iOS App Store release, activate the Apple Developer account, restore the `expo-apple-authentication` integration, and register these App IDs with **Sign in with Apple** enabled:

- `com.alby.app.dev`
- `com.alby.app.staging`
- `com.alby.app`

The future implementation should use native iOS `signInWithIdToken`, with the development and staging App IDs accepted by staging and only `com.alby.app` accepted by production. Hosted-web Apple OAuth, Services IDs, and signing-secret rotation remain out of scope. Keep any `.p8` key and generated secrets outside Expo and the repository.

## Verification after Google credentials are added

Build the development client and preview profiles first. For Google, verify cancellation, provider errors, first-time profile creation, username completion, returning-user sign-in, app restart/session persistence, token refresh, and sign-out on iOS and Android. Then repeat with the production client and callback before release, and confirm that production users never appear in staging.

The official references are [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google), [Supabase native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking), [Expo SDK 57 AuthSession](https://docs.expo.dev/versions/v57.0.0/sdk/auth-session/), and [Expo EAS environment variables](https://docs.expo.dev/eas/environment-variables/).
