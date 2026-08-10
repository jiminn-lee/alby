# Alby

Alby is an Expo app for sharing and discovering music through friends' ratings and listening activity.

## Hosted environments

Alby uses two Supabase Cloud projects and never requires a local Supabase stack:

| App | App identity | Backend |
| --- | --- | --- |
| Development | `Alby Dev` / `com.alby.app.dev` / `alby-dev://` | staging |
| Preview | `Alby Staging` / `com.alby.app.staging` / `alby-staging://` | staging |
| Production | `Alby` / `com.alby.app` / `alby://` | production |

The `supabase/` directory is the migration source of truth, and the guarded CLI commands below link directly to the hosted projects for migrations, tests, type generation, configuration, and staging fixtures.

## App development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example` and insert the staging Project URL and publishable key. Only publishable keys may use the `EXPO_PUBLIC_` prefix.

3. Start the development client:

   ```bash
   npm start
   ```

The staging sign-in screen includes the seeded `jimin@alby.local` mock account. It is not rendered in the production experience. OAuth callbacks require a development or EAS build; Expo Go cannot represent the app's custom native identities reliably.

## Database deployment

The guarded commands compare the currently linked Supabase project with `supabase/targets.json`. Remote writes additionally require an explicit confirmation argument.

```bash
# Staging: link, review, deploy, seed fixtures, and verify
npm run db:link:staging
npm run db:migrations:staging
npm run db:dry-run:staging
npm run db:push:staging -- --confirm=staging
npm run db:seed:staging -- --confirm=staging
npm run db:config:staging -- --confirm=staging
npm run db:lint
npm run db:test
npm run db:verify:staging
npm run db:types

# Production: link, review, and deploy migrations only
npm run db:link:production
npm run db:migrations:production
npm run db:dry-run:production
npm run db:push:production -- --confirm=production
npm run db:config:production -- --confirm=production
npm run db:verify:production

# Restore the normal development link
npm run db:link:staging
```

Create new migrations with `npx supabase migration new <name>`, deploy them to staging first, and promote the identical files to production. Never add `--include-seed` or run Storage fixture uploads against production.

The pgTAP suite rebuilds its fixtures inside a transaction and rolls back, so running `npm run db:test` does not leave test data behind on shared staging. The test command also refuses to run if its fixture include has drifted from `seed.sql`. The verification commands assert the expected environment split: staging contains the mock users/albums/media while production contains an empty dataset and an empty configured bucket.

## Spotify album search

Explore searches Spotify through the authenticated `spotify-albums` Supabase Edge Function. The Expo app never receives Spotify credentials. Selecting a result materializes its canonical metadata in Alby, or reconciles one matching legacy row, before opening the existing album page.

Create one app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), copy `supabase/.env.spotify.example` to both ignored target files, and enter the same Client ID with Client Secret in each:

```text
supabase/.env.spotify.staging.local
supabase/.env.spotify.production.local
```

Spotify currently requires the app owner to have Premium for development-mode Web API access. The integration uses Client Credentials, so it requires no redirect URI and is unrelated to Alby user OAuth.

Run the helper tests locally, then upload and deploy to each explicitly linked target:

```bash
npm run test:spotify

npm run db:link:staging
npm run spotify:secrets:staging -- --confirm=staging
npm run spotify:deploy:staging -- --confirm=staging
npm run spotify:functions:staging
npm run spotify:smoke:staging

npm run db:link:production
npm run spotify:secrets:production -- --confirm=production
npm run spotify:deploy:production -- --confirm=production
npm run spotify:functions:production

npm run db:link:staging
```

The staging smoke test signs into the fixed mock account and writes catalog rows, so it is guarded and must never target production. Production function deployment does not invoke materialization.

## APIs and secrets

The app talks directly to the selected Supabase project's Auth, generated Data API, Storage API, and PostgreSQL RPC functions. Switching the Project URL switches all of those endpoints; there is no separate `EXPO_PUBLIC_API_URL`.

The Spotify catalog integration is the first privileged Supabase Edge Function and is deployed separately to staging and production. Future administrative imports and webhooks belong there as well. Spotify credentials, OAuth client secrets, webhook secrets, service-role keys, and Supabase secret keys must never be placed in Expo variables or committed to the repository.

See [docs/cloud-environments.md](docs/cloud-environments.md) for the exact Google/Apple credential and callback checklist.
