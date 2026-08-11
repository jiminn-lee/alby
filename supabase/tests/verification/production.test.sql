begin;
set local role postgres;
set local search_path = public, extensions, auth, storage;
select plan(8);
select hasnt_column('public', 'albums', 'genres', 'production albums do not expose genres');
select has_column('public', 'albums', 'release_type', 'production albums expose release types');
select is(
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'albums' and column_name = 'release_date'),
  'text',
  'production release dates preserve Spotify precision'
);
select is(
  (select count(*) from auth.users
    where id between '00000000-0000-0000-0000-000000000001'::uuid
      and '00000000-0000-0000-0000-000000000006'::uuid),
  0::bigint,
  'production has no mock users'
);
select is(
  (select count(*) from public.profiles
    where id between '00000000-0000-0000-0000-000000000001'::uuid
      and '00000000-0000-0000-0000-000000000006'::uuid),
  0::bigint,
  'production has no mock profiles'
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
