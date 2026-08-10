begin;
set local role postgres;
set local search_path = public, extensions, auth, storage;
select plan(8);
select hasnt_column('public', 'albums', 'genres', 'staging albums do not expose genres');
select has_column('public', 'albums', 'release_type', 'staging albums expose release types');
select is(
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'albums' and column_name = 'release_date'),
  'text',
  'staging release dates preserve Spotify precision'
);
select is((select count(*) from auth.users), 6::bigint, 'staging has six mock users');
select is((select count(*) from public.profiles), 6::bigint, 'staging has six mock profiles');
select is(
  (select count(*) from public.albums
    where id between '10000000-0000-0000-0000-000000000001'::uuid
      and '10000000-0000-0000-0000-000000000012'::uuid),
  12::bigint,
  'staging preserves all twelve mock albums'
);
select is((select count(*) from storage.buckets where id = 'media'), 1::bigint, 'staging has the media bucket');
select is((select count(*) from storage.objects where bucket_id = 'media'), 5::bigint, 'staging has five mock media files');
select * from finish();
rollback;
