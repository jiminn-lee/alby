create type public.album_release_type as enum ('album', 'ep');

alter table public.albums
  alter column release_date type text using to_char(release_date, 'YYYY-MM-DD'),
  add column release_type public.album_release_type not null default 'album';

alter table public.albums
  add constraint albums_release_date_format_check check (
    case
      when release_date is null then true
      when release_date ~ '^[0-9]{4}$' then true
      when release_date ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then true
      when release_date ~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
        then to_char(to_date(release_date, 'YYYY-MM-DD'), 'YYYY-MM-DD') = release_date
      else false
    end
  );

create or replace function public.materialize_spotify_album(
  spotify_album_id text,
  album_title text,
  album_artist_name text,
  album_cover_path text,
  album_release_date text,
  album_track_count integer,
  album_release_type public.album_release_type,
  album_spotify_url text
)
returns table (album_id uuid, outcome text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  resolved_album_id uuid;
  legacy_album_ids uuid[];
begin
  if spotify_album_id !~ '^[A-Za-z0-9]{22}$' then
    raise exception 'Invalid Spotify album ID.' using errcode = '22023';
  end if;

  if nullif(btrim(album_title), '') is null or nullif(btrim(album_artist_name), '') is null then
    raise exception 'Spotify albums require a title and artist.' using errcode = '22023';
  end if;

  select album.id
  into resolved_album_id
  from public.albums album
  where album.spotify_id = spotify_album_id;

  if found then
    return query select resolved_album_id, 'existing'::text;
    return;
  end if;

  select array_agg(candidate.id order by candidate.id)
  into legacy_album_ids
  from (
    select album.id
    from public.albums album
    where (album.spotify_id is null or album.spotify_id !~ '^[A-Za-z0-9]{22}$')
      and lower(btrim(album.title)) = lower(btrim(album_title))
      and lower(btrim(album.artist_name)) = lower(btrim(album_artist_name))
    order by album.created_at, album.id
    limit 2
    for update
  ) candidate;

  if coalesce(cardinality(legacy_album_ids), 0) = 1 then
    begin
      update public.albums
      set spotify_id = spotify_album_id,
          title = btrim(album_title),
          artist_name = btrim(album_artist_name),
          cover_path = album_cover_path,
          release_date = album_release_date,
          track_count = album_track_count,
          release_type = album_release_type,
          spotify_url = album_spotify_url
      where id = legacy_album_ids[1]
      returning id into resolved_album_id;

      return query select resolved_album_id, 'reconciled'::text;
      return;
    exception
      when unique_violation then
        select album.id
        into resolved_album_id
        from public.albums album
        where album.spotify_id = spotify_album_id;

        return query select resolved_album_id, 'existing'::text;
        return;
    end;
  end if;

  insert into public.albums (
    spotify_id,
    title,
    artist_name,
    cover_path,
    release_date,
    track_count,
    release_type,
    spotify_url
  )
  values (
    spotify_album_id,
    btrim(album_title),
    btrim(album_artist_name),
    album_cover_path,
    album_release_date,
    album_track_count,
    album_release_type,
    album_spotify_url
  )
  on conflict (spotify_id) do nothing
  returning id into resolved_album_id;

  if found then
    return query select resolved_album_id, 'created'::text;
    return;
  end if;

  select album.id
  into resolved_album_id
  from public.albums album
  where album.spotify_id = spotify_album_id;

  return query select resolved_album_id, 'existing'::text;
end;
$$;

revoke all on function public.materialize_spotify_album(
  text,
  text,
  text,
  text,
  text,
  integer,
  public.album_release_type,
  text
) from public, anon, authenticated;

grant execute on function public.materialize_spotify_album(
  text,
  text,
  text,
  text,
  text,
  integer,
  public.album_release_type,
  text
) to service_role;
