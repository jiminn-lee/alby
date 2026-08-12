delete from public.albums
where spotify_id in (
  '0YNxRyJMnNXOfysgawFE8B',
  '0HhoqCRYpuH5sc9mlgCgrF'
);

create table public.album_catalog_sources (
  album_id uuid not null references public.albums (id) on delete cascade,
  provider text not null,
  external_id text not null,
  external_url text,
  created_at timestamptz not null default now(),
  primary key (provider, external_id),
  unique (album_id, provider),
  constraint album_catalog_sources_provider_format check (
    provider = lower(btrim(provider))
      and provider ~ '^[a-z0-9][a-z0-9_-]{0,31}$'
  ),
  constraint album_catalog_sources_external_id_present check (
    external_id = btrim(external_id) and external_id <> ''
  ),
  constraint album_catalog_sources_external_url_https check (
    external_url is null or external_url ~ '^https://'
  )
);

insert into public.album_catalog_sources (album_id, provider, external_id, external_url)
select album.id, 'spotify', btrim(album.spotify_id), album.spotify_url
from public.albums album
where nullif(btrim(album.spotify_id), '') is not null;

update public.albums album
set title = fixture.title,
    artist_name = fixture.artist_name,
    cover_path = 'https://coverartarchive.org/release-group/' || fixture.release_group_id || '/front-500',
    release_date = fixture.release_date,
    release_type = fixture.release_type::public.album_release_type
from (values
  ('2noRn2Aes5aoNVsU6iWThc', '48117b90-a16e-34ca-a514-19c702df1158', 'Discovery', 'Daft Punk', '2001-02-26', 'album'),
  ('392p3shh2jkxUxY2VHvlH8', 'f8f4167d-897c-4b25-a171-638374d1dfa4', 'channel ORANGE', 'Frank Ocean', '2012-07-10', 'album'),
  ('3JYSv64ZaFK2qHEBZ3suUD', '18be804e-9b7c-4b19-b6af-3eae9dc752e9', 'SS-POP 3', 'SYSTEM SEOUL', '2026-07-15', 'album'),
  ('4TJQ4ze7fqMJIzGB1Y4vTy', '4ddcc4fb-423b-4c98-9265-804071debce9', 'pullup to busan 4 morE hypEr summEr it’s gonna bE a fuckin moviE', 'Effie', '2025-08-01', 'ep')
) as fixture(spotify_id, release_group_id, title, artist_name, release_date, release_type)
where album.spotify_id = fixture.spotify_id;

insert into public.album_catalog_sources (album_id, provider, external_id, external_url)
select
  album.id,
  'musicbrainz',
  fixture.release_group_id,
  'https://musicbrainz.org/release-group/' || fixture.release_group_id
from (values
  ('2noRn2Aes5aoNVsU6iWThc', '48117b90-a16e-34ca-a514-19c702df1158'),
  ('392p3shh2jkxUxY2VHvlH8', 'f8f4167d-897c-4b25-a171-638374d1dfa4'),
  ('3JYSv64ZaFK2qHEBZ3suUD', '18be804e-9b7c-4b19-b6af-3eae9dc752e9'),
  ('4TJQ4ze7fqMJIzGB1Y4vTy', '4ddcc4fb-423b-4c98-9265-804071debce9')
) as fixture(spotify_id, release_group_id)
join public.albums album on album.spotify_id = fixture.spotify_id
on conflict (provider, external_id) do nothing;

drop function public.materialize_spotify_album(
  text,
  text,
  text,
  text,
  text,
  integer,
  public.album_release_type,
  text
);

alter table public.albums
  drop column spotify_id,
  drop column spotify_url;

create table public.catalog_request_slots (
  provider text primary key,
  next_allowed_at timestamptz not null,
  constraint catalog_request_slots_provider_format check (
    provider = lower(btrim(provider))
      and provider ~ '^[a-z0-9][a-z0-9_-]{0,31}$'
  )
);

alter table public.album_catalog_sources enable row level security;
alter table public.catalog_request_slots enable row level security;

create policy "album catalog sources are readable"
on public.album_catalog_sources
for select
to authenticated
using (true);

revoke all on public.album_catalog_sources from public, anon, authenticated;
revoke all on public.catalog_request_slots from public, anon, authenticated;
grant select on public.album_catalog_sources to authenticated;
grant select, insert, update, delete on public.album_catalog_sources to service_role;
grant select, insert, update, delete on public.catalog_request_slots to service_role;

create or replace function public.materialize_catalog_album(
  catalog_provider text,
  catalog_external_id text,
  catalog_external_url text,
  album_title text,
  album_artist_name text,
  album_cover_path text,
  album_release_date text,
  album_track_count integer,
  album_release_type public.album_release_type
)
returns table (album_id uuid, outcome text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_provider text := lower(btrim(catalog_provider));
  normalized_external_id text := btrim(catalog_external_id);
  resolved_album_id uuid;
  legacy_album_ids uuid[];
begin
  if normalized_provider is null or normalized_provider !~ '^[a-z0-9][a-z0-9_-]{0,31}$' then
    raise exception 'Invalid catalog provider.' using errcode = '22023';
  end if;

  if nullif(normalized_external_id, '') is null then
    raise exception 'Catalog albums require an external ID.' using errcode = '22023';
  end if;

  if catalog_external_url is not null and catalog_external_url !~ '^https://' then
    raise exception 'Catalog URLs must use HTTPS.' using errcode = '22023';
  end if;

  if nullif(btrim(album_title), '') is null or nullif(btrim(album_artist_name), '') is null then
    raise exception 'Catalog albums require a title and artist.' using errcode = '22023';
  end if;

  if album_track_count is not null and album_track_count < 1 then
    raise exception 'Album track counts must be positive.' using errcode = '22023';
  end if;

  select source.album_id
  into resolved_album_id
  from public.album_catalog_sources source
  where source.provider = normalized_provider
    and source.external_id = normalized_external_id;

  if found then
    return query select resolved_album_id, 'existing'::text;
    return;
  end if;

  select array_agg(candidate.id order by candidate.id)
  into legacy_album_ids
  from (
    select album.id
    from public.albums album
    where not exists (
        select 1
        from public.album_catalog_sources source
        where source.album_id = album.id
          and source.provider = normalized_provider
      )
      and lower(btrim(album.title)) = lower(btrim(album_title))
      and lower(btrim(album.artist_name)) = lower(btrim(album_artist_name))
    order by album.created_at, album.id
    limit 2
    for update
  ) candidate;

  if coalesce(cardinality(legacy_album_ids), 0) = 1 then
    begin
      update public.albums album
      set title = btrim(album_title),
          artist_name = btrim(album_artist_name),
          cover_path = album_cover_path,
          release_date = album_release_date,
          track_count = coalesce(album_track_count, album.track_count),
          release_type = album_release_type
      where album.id = legacy_album_ids[1]
      returning album.id into resolved_album_id;

      insert into public.album_catalog_sources (album_id, provider, external_id, external_url)
      values (
        resolved_album_id,
        normalized_provider,
        normalized_external_id,
        catalog_external_url
      );

      return query select resolved_album_id, 'reconciled'::text;
      return;
    exception
      when unique_violation then
        select source.album_id
        into resolved_album_id
        from public.album_catalog_sources source
        where source.provider = normalized_provider
          and source.external_id = normalized_external_id;

        if found then
          return query select resolved_album_id, 'existing'::text;
          return;
        end if;
    end;
  end if;

  begin
    insert into public.albums (
      title,
      artist_name,
      cover_path,
      release_date,
      track_count,
      release_type
    ) values (
      btrim(album_title),
      btrim(album_artist_name),
      album_cover_path,
      album_release_date,
      album_track_count,
      album_release_type
    ) returning id into resolved_album_id;

    insert into public.album_catalog_sources (album_id, provider, external_id, external_url)
    values (
      resolved_album_id,
      normalized_provider,
      normalized_external_id,
      catalog_external_url
    );

    return query select resolved_album_id, 'created'::text;
    return;
  exception
    when unique_violation then
      select source.album_id
      into resolved_album_id
      from public.album_catalog_sources source
      where source.provider = normalized_provider
        and source.external_id = normalized_external_id;

      if found then
        return query select resolved_album_id, 'existing'::text;
        return;
      end if;
      raise;
  end;
end;
$$;

create or replace function public.reserve_catalog_request_slot(
  catalog_provider text,
  minimum_interval_ms integer default 1100,
  maximum_wait_ms integer default 5000
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_provider text := lower(btrim(catalog_provider));
  observed_at timestamptz;
  scheduled_time timestamptz;
  wait_ms integer;
begin
  if normalized_provider is null or normalized_provider !~ '^[a-z0-9][a-z0-9_-]{0,31}$' then
    raise exception 'Invalid catalog provider.' using errcode = '22023';
  end if;

  if minimum_interval_ms < 100 or minimum_interval_ms > 60000
      or maximum_wait_ms < 0 or maximum_wait_ms > 60000 then
    raise exception 'Invalid catalog request timing.' using errcode = '22023';
  end if;

  observed_at := clock_timestamp();

  insert into public.catalog_request_slots (provider, next_allowed_at)
  values (normalized_provider, observed_at)
  on conflict (provider) do nothing;

  select greatest(slot.next_allowed_at, observed_at)
  into scheduled_time
  from public.catalog_request_slots slot
  where slot.provider = normalized_provider
  for update;

  wait_ms := greatest(
    0,
    ceil(extract(epoch from (scheduled_time - clock_timestamp())) * 1000)::integer
  );

  if wait_ms > maximum_wait_ms then
    return -1;
  end if;

  update public.catalog_request_slots
  set next_allowed_at = scheduled_time + make_interval(secs => minimum_interval_ms / 1000.0)
  where provider = normalized_provider;

  return wait_ms;
end;
$$;

revoke all on function public.materialize_catalog_album(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  public.album_release_type
) from public, anon, authenticated;

grant execute on function public.materialize_catalog_album(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  public.album_release_type
) to service_role;

revoke all on function public.reserve_catalog_request_slot(text, integer, integer)
from public, anon, authenticated;

grant execute on function public.reserve_catalog_request_slot(text, integer, integer)
to service_role;
