begin;
set local role postgres;
set local search_path = public, extensions, auth, storage;
select plan(17);
select hasnt_column('public', 'albums', 'genres', 'production albums do not expose genres');
select has_column('public', 'albums', 'release_type', 'production albums expose release types');
select has_table('public', 'album_catalog_sources', 'production exposes provider-neutral album sources');
select has_table('public', 'catalog_genres', 'production exposes provider-neutral catalog genres');
select has_table('public', 'album_genres', 'production exposes normalized album genres');
select has_column('public', 'album_catalog_sources', 'genres_synced_at', 'production tracks catalog genre synchronization');
select hasnt_column('public', 'albums', 'spotify_id', 'production albums do not store Spotify IDs');
select hasnt_column('public', 'albums', 'spotify_url', 'production albums do not store Spotify URLs');
select is(
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'albums' and column_name = 'release_date'),
  'text',
  'production release dates preserve catalog precision'
);
select is(
  (select count(*) from public.album_catalog_sources
    where provider = 'spotify'
      and external_id in ('0YNxRyJMnNXOfysgawFE8B', '0HhoqCRYpuH5sc9mlgCgrF')),
  0::bigint,
  'production does not contain SS-POP 1 or 2000 TAPE'
);
select is(
  (select count(*) from public.album_catalog_sources where provider = 'musicbrainz'),
  0::bigint,
  'production has no pre-existing MusicBrainz albums to backfill'
);
select is(
  (select count(*) from public.album_genres),
  0::bigint,
  'production has no album genre assignments before catalog use'
);
select is(
  (select count(*) from auth.users
    where id between '00000000-0000-0000-0000-000000000001'::uuid
        and '00000000-0000-0000-0000-000000000006'::uuid
      or id between 'f17e0000-0000-4000-8000-000000000001'::uuid
        and 'f17e0000-0000-4000-8000-000000000003'::uuid
      or email in (
        'jimin@alby.local',
        'cody@alby.local',
        'aaron@alby.local',
        'maya@alby.local',
        'lena@alby.local',
        'devon@alby.local',
        'sample-cody@fixtures.alby.test',
        'sample-maya@fixtures.alby.test',
        'sample-lena@fixtures.alby.test'
      )),
  0::bigint,
  'production has no tracked fixture principals'
);
select is(
  (select count(*) from public.profiles
    where id between '00000000-0000-0000-0000-000000000001'::uuid
        and '00000000-0000-0000-0000-000000000006'::uuid
      or id between 'f17e0000-0000-4000-8000-000000000001'::uuid
        and 'f17e0000-0000-4000-8000-000000000003'::uuid),
  0::bigint,
  'production has no tracked fixture profiles'
);
select is(
  (select count(*) from public.albums
    where id between '10000000-0000-0000-0000-000000000001'::uuid
      and '10000000-0000-0000-0000-000000000012'::uuid),
  0::bigint,
  'production has no mock albums'
);
select is((select count(*) from storage.buckets where id = 'media'), 1::bigint, 'production has the media bucket');
select is(
  (select count(*) from storage.objects
    where bucket_id = 'media'
      and name in (
        'albums/album-rest-in-bass.png',
        'albums/album-to-pimp-a-butterfly.png',
        'albums/album-brat.png',
        'albums/album-i-barely-know-her.png',
        'avatars/jimin.png'
      )),
  0::bigint,
  'production media bucket has no mock files'
);
select * from finish();
rollback;
