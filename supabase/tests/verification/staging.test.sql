begin;
set local role postgres;
set local search_path = public, extensions, auth, storage;
select plan(9);
select hasnt_column('public', 'albums', 'genres', 'staging albums do not expose genres');
select has_column('public', 'albums', 'release_type', 'staging albums expose release types');
select is(
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'albums' and column_name = 'release_date'),
  'text',
  'staging release dates preserve Spotify precision'
);
select is(
  (select count(*) from auth.users
    where id between '00000000-0000-0000-0000-000000000001'::uuid
      and '00000000-0000-0000-0000-000000000006'::uuid
      or email in (
        'jimin@alby.local', 'cody@alby.local', 'aaron@alby.local',
        'maya@alby.local', 'lena@alby.local', 'devon@alby.local'
      )),
  0::bigint,
  'staging has no tracked mock users'
);
select is(
  (select count(*) from public.profiles
    where id between '00000000-0000-0000-0000-000000000001'::uuid
      and '00000000-0000-0000-0000-000000000006'::uuid),
  0::bigint,
  'staging has no tracked mock profiles'
);
select is(
  (select count(*) from public.albums
    where id between '10000000-0000-0000-0000-000000000001'::uuid
      and '10000000-0000-0000-0000-000000000012'::uuid),
  0::bigint,
  'staging has no tracked mock albums'
);
select is(
  (select count(*)
    from auth.identities identity
    left join public.profiles profile on profile.id = identity.user_id
    where identity.provider = 'google' and profile.id is null),
  0::bigint,
  'every staging Google identity has a profile'
);
select is((select count(*) from storage.buckets where id = 'media'), 1::bigint, 'staging has the media bucket');
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
  'staging has no tracked mock media files'
);
select * from finish();
rollback;
