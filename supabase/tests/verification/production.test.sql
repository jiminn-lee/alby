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
select is((select count(*) from auth.users), 0::bigint, 'production has no users');
select is((select count(*) from public.profiles), 0::bigint, 'production has no profiles');
select is((select count(*) from public.albums), 0::bigint, 'production has no albums');
select is((select count(*) from storage.buckets where id = 'media'), 1::bigint, 'production has the media bucket');
select is((select count(*) from storage.objects where bucket_id = 'media'), 0::bigint, 'production media bucket has no mock files');
select * from finish();
rollback;
