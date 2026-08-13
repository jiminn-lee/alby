create table public.catalog_genres (
  provider text not null,
  external_id text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (provider, external_id),
  constraint catalog_genres_provider_format check (
    provider = lower(btrim(provider))
      and provider ~ '^[a-z0-9][a-z0-9_-]{0,31}$'
  ),
  constraint catalog_genres_external_id_present check (
    external_id = btrim(external_id)
      and char_length(external_id) between 1 and 200
  ),
  constraint catalog_genres_name_present check (
    name = btrim(name)
      and char_length(name) between 1 and 100
  )
);

create trigger catalog_genres_set_updated_at
before update on public.catalog_genres
for each row execute function public.set_updated_at();

create table public.album_genres (
  album_id uuid not null references public.albums (id) on delete cascade,
  provider text not null,
  genre_external_id text not null,
  vote_count integer not null,
  rank smallint not null,
  created_at timestamptz not null default now(),
  primary key (album_id, provider, genre_external_id),
  unique (album_id, provider, rank),
  foreign key (album_id, provider)
    references public.album_catalog_sources (album_id, provider)
    on update cascade
    on delete cascade,
  foreign key (provider, genre_external_id)
    references public.catalog_genres (provider, external_id)
    on update cascade,
  constraint album_genres_provider_format check (
    provider = lower(btrim(provider))
      and provider ~ '^[a-z0-9][a-z0-9_-]{0,31}$'
  ),
  constraint album_genres_positive_vote_count check (vote_count > 0),
  constraint album_genres_rank_range check (rank between 1 and 5)
);

create index album_genres_discovery_idx
on public.album_genres (provider, genre_external_id, rank, album_id);

alter table public.album_catalog_sources
add column genres_synced_at timestamptz;

alter table public.catalog_genres enable row level security;
alter table public.album_genres enable row level security;

create policy "catalog genres are readable"
on public.catalog_genres
for select
to authenticated
using (true);

create policy "album genres are readable"
on public.album_genres
for select
to authenticated
using (true);

revoke all on public.catalog_genres from public, anon, authenticated;
revoke all on public.album_genres from public, anon, authenticated;
grant select on public.catalog_genres to authenticated;
grant select on public.album_genres to authenticated;
grant select, insert, update, delete on public.catalog_genres to service_role;
grant select, insert, update, delete on public.album_genres to service_role;

create or replace function public.sync_catalog_album_genres(
  target_album_id uuid,
  catalog_provider text,
  genre_payload jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  normalized_provider text := lower(btrim(catalog_provider));
  genre jsonb;
  genre_external_id text;
  genre_name text;
  genre_vote_count integer;
  genre_rank smallint;
  seen_external_ids text[] := '{}';
  seen_ranks smallint[] := '{}';
begin
  if target_album_id is null then
    raise exception 'Catalog genre sync requires an album.' using errcode = '22023';
  end if;

  if normalized_provider is null
      or normalized_provider !~ '^[a-z0-9][a-z0-9_-]{0,31}$' then
    raise exception 'Invalid catalog provider.' using errcode = '22023';
  end if;

  if genre_payload is null or jsonb_typeof(genre_payload) <> 'array' then
    raise exception 'Catalog genres must be a JSON array.' using errcode = '22023';
  end if;

  if jsonb_array_length(genre_payload) > 5 then
    raise exception 'Catalog albums support at most five genres.' using errcode = '22023';
  end if;

  perform 1
  from public.album_catalog_sources source
  where source.album_id = target_album_id
    and source.provider = normalized_provider
  for update;

  if not found then
    raise exception 'The album does not have a matching catalog source.' using errcode = '23503';
  end if;

  delete from public.album_genres album_genre
  where album_genre.album_id = target_album_id
    and album_genre.provider = normalized_provider;

  for genre in select value from jsonb_array_elements(genre_payload)
  loop
    if jsonb_typeof(genre) <> 'object' then
      raise exception 'Each catalog genre must be an object.' using errcode = '22023';
    end if;

    genre_external_id := btrim(genre ->> 'external_id');
    genre_name := btrim(genre ->> 'name');

    begin
      genre_vote_count := (genre ->> 'vote_count')::integer;
      genre_rank := (genre ->> 'rank')::smallint;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Catalog genre counts and ranks must be integers.' using errcode = '22023';
    end;

    if genre_external_id is null or char_length(genre_external_id) not between 1 and 200
        or genre_name is null or char_length(genre_name) not between 1 and 100
        or genre_vote_count is null or genre_vote_count < 1
        or genre_rank is null or genre_rank not between 1 and 5
        or genre_rank <> cardinality(seen_ranks) + 1 then
      raise exception 'Invalid catalog genre.' using errcode = '22023';
    end if;

    if genre_external_id = any(seen_external_ids) or genre_rank = any(seen_ranks) then
      raise exception 'Catalog genre IDs and ranks must be unique.' using errcode = '22023';
    end if;

    seen_external_ids := array_append(seen_external_ids, genre_external_id);
    seen_ranks := array_append(seen_ranks, genre_rank);

    insert into public.catalog_genres (provider, external_id, name)
    values (normalized_provider, genre_external_id, genre_name)
    on conflict (provider, external_id) do update set name = excluded.name;

    insert into public.album_genres (
      album_id,
      provider,
      genre_external_id,
      vote_count,
      rank
    ) values (
      target_album_id,
      normalized_provider,
      genre_external_id,
      genre_vote_count,
      genre_rank
    );
  end loop;

  update public.album_catalog_sources source
  set genres_synced_at = clock_timestamp()
  where source.album_id = target_album_id
    and source.provider = normalized_provider;

  return jsonb_array_length(genre_payload);
end;
$$;

revoke all on function public.sync_catalog_album_genres(uuid, text, jsonb)
from public, anon, authenticated;

grant execute on function public.sync_catalog_album_genres(uuid, text, jsonb)
to service_role;

do $$
declare
  source record;
  genres jsonb;
begin
  for source in
    select album_source.album_id, album_source.external_id
    from public.album_catalog_sources album_source
    where album_source.provider = 'musicbrainz'
      and album_source.external_id in (
        '48117b90-a16e-34ca-a514-19c702df1158',
        'f8f4167d-897c-4b25-a171-638374d1dfa4',
        '18be804e-9b7c-4b19-b6af-3eae9dc752e9',
        '4ddcc4fb-423b-4c98-9265-804071debce9',
        'a3e9a60a-90c0-4830-a09e-5c413e2ebdce'
      )
  loop
    genres := case source.external_id
      when '48117b90-a16e-34ca-a514-19c702df1158' then jsonb_build_array(
        jsonb_build_object('external_id', 'a2782cb6-1cd0-477c-a61d-b3f8b42dd1b3', 'name', 'house', 'vote_count', 20, 'rank', 1),
        jsonb_build_object('external_id', '89255676-1f14-4dd8-bbad-fca839d6aff4', 'name', 'electronic', 'vote_count', 14, 'rank', 2),
        jsonb_build_object('external_id', '5acda04e-995d-4f79-9a66-5fe6a977ce15', 'name', 'french house', 'vote_count', 8, 'rank', 3),
        jsonb_build_object('external_id', '70adb285-e1f7-458a-823f-5cbda5e291c4', 'name', 'progressive house', 'vote_count', 4, 'rank', 4),
        jsonb_build_object('external_id', 'e5bba957-8c91-496a-a675-c6d0c6b51c33', 'name', 'dance', 'vote_count', 3, 'rank', 5)
      )
      when 'f8f4167d-897c-4b25-a171-638374d1dfa4' then jsonb_build_array(
        jsonb_build_object('external_id', '4bb4043a-0ee5-4b84-93fa-6ba4567a6ba0', 'name', 'contemporary r&b', 'vote_count', 3, 'rank', 1),
        jsonb_build_object('external_id', '4e03fb35-d571-4111-824d-88c9f8a3d0c9', 'name', 'alternative r&b', 'vote_count', 2, 'rank', 2),
        jsonb_build_object('external_id', '911c7bbb-172d-4df8-9478-dbff4296e791', 'name', 'pop', 'vote_count', 1, 'rank', 3),
        jsonb_build_object('external_id', '31be54b2-4d0c-42df-aa44-c496c7b4c3c3', 'name', 'r&b', 'vote_count', 1, 'rank', 4)
      )
      else '[]'::jsonb
    end;

    perform public.sync_catalog_album_genres(source.album_id, 'musicbrainz', genres);
  end loop;
end;
$$;
