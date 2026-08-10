import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = JSON.parse(readFileSync(path.join(projectRoot, 'supabase', 'targets.json'), 'utf8'));
const linkedRef = readFileSync(path.join(projectRoot, 'supabase', '.temp', 'project-ref'), 'utf8').trim();
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

assert(process.argv.includes('--confirm=staging'), 'Refusing the remote write without --confirm=staging.');
assert.equal(linkedRef, targets.staging, 'The Supabase CLI must be linked to staging.');
assert.equal(process.env.EXPO_PUBLIC_APP_ENV, 'staging', '.env.local must select the staging app environment.');
assert(url?.includes(targets.staging), '.env.local must contain the staging Supabase URL.');
assert(publishableKey, '.env.local must contain the staging publishable key.');

const supabase = createClient(url, publishableKey, { auth: { persistSession: false } });
const blondeId = '3mH6qwIy9crq0I9YQbOuDf';
const discoveryId = '2noRn2Aes5aoNVsU6iWThc';
const blondeFixtureId = '10000000-0000-0000-0000-000000000005';

async function invoke(body) {
  const result = await supabase.functions.invoke('spotify-albums', { body });
  if (result.error) throw result.error;
  return result.data;
}

try {
  const signIn = await supabase.auth.signInWithPassword({ email: 'jimin@alby.local', password: 'password' });
  if (signIn.error) throw signIn.error;

  const search = await invoke({ action: 'search', query: 'Blonde Frank Ocean' });
  assert(Array.isArray(search.albums) && search.albums.length > 0, 'Authenticated Spotify search returned no albums.');

  const beforeRatings = await supabase.from('ratings').select('id', { count: 'exact', head: true }).eq('album_id', blondeFixtureId);
  if (beforeRatings.error) throw beforeRatings.error;
  const blonde = await invoke({ action: 'materialize', spotifyId: blondeId });
  assert.equal(blonde.album.id, blondeFixtureId, 'Blonde did not reconcile to its fixed fixture UUID.');
  assert(['reconciled', 'existing'].includes(blonde.outcome), 'Blonde returned an invalid materialization outcome.');
  const afterRatings = await supabase.from('ratings').select('id', { count: 'exact', head: true }).eq('album_id', blondeFixtureId);
  if (afterRatings.error) throw afterRatings.error;
  assert.equal(afterRatings.count, beforeRatings.count, 'Blonde ratings changed during reconciliation.');

  const discovery = await invoke({ action: 'materialize', spotifyId: discoveryId });
  const discoveryAgain = await invoke({ action: 'materialize', spotifyId: discoveryId });
  assert.equal(discoveryAgain.album.id, discovery.album.id, 'Repeated materialization returned a different Alby UUID.');
  assert.equal(discoveryAgain.outcome, 'existing', 'Repeated materialization did not report existing.');
  const count = await supabase.from('albums').select('id', { count: 'exact', head: true }).eq('spotify_id', discoveryId);
  if (count.error) throw count.error;
  assert.equal(count.count, 1, 'Discovery was materialized more than once.');

  console.log('Spotify staging smoke test passed: authenticated search, reconciliation, creation, and idempotency.');
} finally {
  await supabase.auth.signOut();
}
