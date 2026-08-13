# Alby

Alby is an Expo app for sharing and discovering music through friends' ratings and listening activity.

## Hosted environments

Alby uses two Supabase Cloud projects and never requires a local Supabase stack:

| App | App identity | Backend |
| --- | --- | --- |
| Development | `Alby Dev` / `com.alby.app.dev` / `alby-dev://` | staging |
| Preview | `Alby Staging` / `com.alby.app.staging` / `alby-staging://` | staging |
| Production | `Alby` / `com.alby.app` / `alby://` | production |

The `supabase/` directory is the migration source of truth, and the guarded CLI commands below link directly to the hosted projects for migrations, tests, type generation, configuration, and fixture cleanup.

## App development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example` and insert the staging Project URL and publishable key. Only publishable keys may use the `EXPO_PUBLIC_` prefix.

3. Build and install the development client the first time, or whenever native configuration changes:

   ```bash
   npm run ios
   # or: npm run android
   ```

4. For later JavaScript-only sessions, start Metro for the installed development client with `npm start`.

Google OAuth is the only active sign-in path and is currently mobile-only. It requires a development or EAS build so the app's custom callback scheme is registered by the native app. `npm run start:expo-go` remains available for UI-only work, but Google sign-in deliberately reports that Expo Go is unsupported. OAuth creates real users, the database trigger creates their profiles, and MusicBrainz searches materialize albums. Staging can additionally host three non-loginable social personas through the explicit fixture command below; they are never installed by the persistent seed or in production. Native Sign in with Apple is deferred until the Apple Developer account is active and must be completed before an iOS App Store release.

## Database deployment

The guarded commands compare the currently linked Supabase project with `supabase/targets.json`. Remote writes additionally require an explicit confirmation argument.

```bash
# Staging: link, review, deploy, and verify
npm run db:link:staging
npm run db:migrations:staging
npm run db:dry-run:staging
npm run db:push:staging -- --confirm=staging
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

The staging-only social seed materializes its four tracked MusicBrainz albums and then installs the deterministic social dataset:

```bash
npm run db:link:staging
npm run db:seed-fixtures:staging -- --confirm=staging
npm run db:verify:staging
```

The seed creates Cody, Maya, and Lena as public sample personas with ratings, saves, follows, likes, and comments. Their reserved `.test` Auth principals have no password and no identity, so they cannot sign in. Every completed Google profile follows the three personas; rerun the seed after completing another staging OAuth profile to populate its home feed.

To reset the fixture-owned social data without touching OAuth users or the shared catalog, purge it, reseed it, and then verify staging:

```bash
npm run db:link:staging
npm run db:purge-fixtures:staging -- --confirm=staging
npm run db:seed-fixtures:staging -- --confirm=staging
npm run db:verify:staging
```

Create new migrations with `npx supabase migration new <name>`, deploy them to staging first, and promote the identical files to production. The persistent seed is intentionally empty. Both social fixture commands validate the linked staging project, require `--confirm=staging`, and refuse to target production. Purge preserves the shared catalog and legitimate OAuth data, and aborts if a legitimate user has authored a like or comment on fixture activity.

The pgTAP suite builds synthetic Google identities and social data inside a transaction and rolls back, so running `npm run db:test` does not leave test data behind on shared staging. Staging verification requires the exact social fixture dataset while allowing legitimate OAuth users and additional MusicBrainz-created catalog data. Production verification rejects both retired and current fixture principals, albums, and media.

## MusicBrainz album search

Explore searches MusicBrainz release groups by album or EP title through the authenticated `musicbrainz-albums` Supabase Edge Function. Selecting a result materializes its canonical metadata in Alby, or reconciles one exact title-and-artist match, before opening the existing album page. Album artwork uses release-group images from Cover Art Archive, and catalog identities live in provider-neutral `album_catalog_sources` records. Materialization also imports the release group's top five positive-vote MusicBrainz genres into normalized `catalog_genres` and `album_genres` records. Album Detail presents those ranked genres as display-only tags; the normalized identities are reserved for later discovery work.

MusicBrainz requires no API credential. The Edge Function sends Alby's contactable User-Agent and uses a database-backed request slot to keep upstream calls at least 1.1 seconds apart across function instances.

Run the helper tests locally, then deploy to each explicitly linked target:

```bash
npm run test:musicbrainz

npm run db:link:staging
npm run musicbrainz:deploy:staging -- --confirm=staging
npm run musicbrainz:functions:staging

npm run db:link:production
npm run musicbrainz:deploy:production -- --confirm=production
npm run musicbrainz:functions:production

npm run db:link:staging
```

The automated MusicBrainz tests cover release-group validation, top-level genre filtering and ranking, catalog mapping, request construction, attribution, and upstream error handling. Authenticated remote search and materialization are exercised through the mobile app; there is no password-based smoke account.

After each environment passes its database and function verification, retire the previous hosted function and credentials once:

```bash
npm run db:link:staging
npm run musicbrainz:retire-spotify:staging -- --confirm=staging

npm run db:link:production
npm run musicbrainz:retire-spotify:production -- --confirm=production

npm run db:link:staging
```

These guarded commands delete the hosted legacy album-search function and unset its three provider secrets. Run them only after the MusicBrainz deployment is healthy.

## APIs and secrets

The app talks directly to the selected Supabase project's Auth, generated Data API, Storage API, and PostgreSQL RPC functions. Switching the Project URL switches all of those endpoints; there is no separate `EXPO_PUBLIC_API_URL`.

The MusicBrainz catalog integration is a privileged Supabase Edge Function deployed separately to staging and production. Future administrative imports and webhooks belong there as well. OAuth client secrets, webhook secrets, service-role keys, and Supabase secret keys must never be placed in Expo variables or committed to the repository.

See [docs/cloud-environments.md](docs/cloud-environments.md) for the exact Google credential and callback checklist, plus the deferred Apple release requirement.
