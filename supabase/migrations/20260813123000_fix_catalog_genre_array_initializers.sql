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
  seen_external_ids text[] := array[]::text[];
  seen_ranks smallint[] := array[]::smallint[];
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
