create extension if not exists "citext" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;

create type public.activity_type as enum ('rating_created', 'rating_updated', 'listen_later_added');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username extensions.citext unique,
  display_name text,
  avatar_path text,
  bio text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username is null or username::text ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_display_name_length check (display_name is null or char_length(display_name) between 1 and 50),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 240)
);

create table public.albums (
  id uuid primary key default extensions.gen_random_uuid(),
  spotify_id text unique,
  title text not null,
  artist_name text not null,
  cover_path text,
  release_date date,
  track_count integer check (track_count is null or track_count > 0),
  genres text[] not null default '{}',
  spotify_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ratings (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  album_id uuid not null references public.albums (id) on delete cascade,
  value numeric(2,1) not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, album_id),
  constraint ratings_half_point check (value between 0.5 and 5.0 and mod(value * 2, 1) = 0),
  constraint ratings_note_length check (note is null or char_length(note) <= 1000)
);

create table public.listen_later_items (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  album_id uuid not null references public.albums (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, album_id)
);

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_no_self check (follower_id <> followed_id)
);

create table public.activity_events (
  id uuid primary key default extensions.gen_random_uuid(),
  activity_type public.activity_type not null,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  album_id uuid not null references public.albums (id) on delete cascade,
  rating_id uuid references public.ratings (id) on delete cascade,
  listen_later_item_id uuid references public.listen_later_items (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint activity_source_matches_type check (
    (activity_type in ('rating_created', 'rating_updated') and rating_id is not null and listen_later_item_id is null)
    or (activity_type = 'listen_later_added' and rating_id is null and listen_later_item_id is not null)
  )
);

create unique index activity_rating_source_idx on public.activity_events (rating_id) where rating_id is not null;
create unique index activity_listen_later_source_idx on public.activity_events (listen_later_item_id) where listen_later_item_id is not null;
create index activity_actor_created_idx on public.activity_events (actor_id, created_at desc);
create index activity_album_created_idx on public.activity_events (album_id, created_at desc);
create index ratings_album_idx on public.ratings (album_id);
create index ratings_user_updated_idx on public.ratings (user_id, updated_at desc);
create index listen_later_user_created_idx on public.listen_later_items (user_id, created_at desc);
create index follows_followed_idx on public.follows (followed_id);

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity_event_id uuid not null references public.activity_events (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, activity_event_id)
);

create table public.comments (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  activity_event_id uuid not null references public.activity_events (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_body_length check (char_length(btrim(body)) between 1 and 500)
);

create index comments_activity_idx on public.comments (activity_event_id, created_at);

create or replace function public.set_updated_at() returns trigger language plpgsql
set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger albums_set_updated_at before update on public.albums for each row execute function public.set_updated_at();
create trigger ratings_set_updated_at before update on public.ratings for each row execute function public.set_updated_at();
create trigger comments_set_updated_at before update on public.comments for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.profiles (id, display_name, avatar_path)
  values (
    new.id,
    nullif(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), ''),
    nullif(coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_mutual_follow(target_user_id uuid, viewer_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select viewer_id is not null
    and viewer_id <> target_user_id
    and exists (select 1 from public.follows where follower_id = viewer_id and followed_id = target_user_id)
    and exists (select 1 from public.follows where follower_id = target_user_id and followed_id = viewer_id);
$$;

create or replace function public.can_view_profile_content(target_user_id uuid, viewer_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select viewer_id = target_user_id
    or coalesce((select not is_private from public.profiles where id = target_user_id), false)
    or public.is_mutual_follow(target_user_id, viewer_id);
$$;

create or replace function public.sync_rating_activity() returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.activity_events (activity_type, actor_id, album_id, rating_id, created_at)
  values (
    case when tg_op = 'INSERT' then 'rating_created'::public.activity_type else 'rating_updated'::public.activity_type end,
    new.user_id, new.album_id, new.id,
    case when tg_op = 'INSERT' then new.created_at else new.updated_at end
  )
  on conflict (rating_id) where rating_id is not null do update set
    activity_type = 'rating_updated', actor_id = excluded.actor_id,
    album_id = excluded.album_id, created_at = excluded.created_at;
  return new;
end;
$$;

create trigger ratings_sync_activity after insert or update of value, note on public.ratings
for each row execute function public.sync_rating_activity();

create or replace function public.sync_listen_later_activity() returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.activity_events (activity_type, actor_id, album_id, listen_later_item_id, created_at)
  values ('listen_later_added', new.user_id, new.album_id, new.id, new.created_at)
  on conflict (listen_later_item_id) where listen_later_item_id is not null do nothing;
  return new;
end;
$$;

create trigger listen_later_sync_activity after insert on public.listen_later_items
for each row execute function public.sync_listen_later_activity();

alter table public.profiles enable row level security;
alter table public.albums enable row level security;
alter table public.ratings enable row level security;
alter table public.listen_later_items enable row level security;
alter table public.follows enable row level security;
alter table public.activity_events enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;

create policy "profiles are discoverable" on public.profiles for select to authenticated using (true);
create policy "users insert their profile" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "users update their profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "albums are readable" on public.albums for select to authenticated using (true);

create policy "visible ratings are readable" on public.ratings for select to authenticated using (public.can_view_profile_content(user_id));
create policy "users create their ratings" on public.ratings for insert to authenticated with check (user_id = auth.uid());
create policy "users update their ratings" on public.ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete their ratings" on public.ratings for delete to authenticated using (user_id = auth.uid());

create policy "visible listen later items are readable" on public.listen_later_items for select to authenticated using (public.can_view_profile_content(user_id));
create policy "users create their listen later items" on public.listen_later_items for insert to authenticated with check (user_id = auth.uid());
create policy "users delete their listen later items" on public.listen_later_items for delete to authenticated using (user_id = auth.uid());

create policy "follow graph is discoverable" on public.follows for select to authenticated using (true);
create policy "users create their follows" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "users delete their follows" on public.follows for delete to authenticated using (follower_id = auth.uid());

create policy "visible activity is readable" on public.activity_events for select to authenticated using (public.can_view_profile_content(actor_id));
create policy "likes on visible activity are readable" on public.likes for select to authenticated
using (exists (select 1 from public.activity_events event where event.id = activity_event_id));
create policy "users create their likes" on public.likes for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from public.activity_events event where event.id = activity_event_id));
create policy "users delete their likes" on public.likes for delete to authenticated using (user_id = auth.uid());

create policy "comments on visible activity are readable" on public.comments for select to authenticated
using (exists (select 1 from public.activity_events event where event.id = activity_event_id));
create policy "users create their comments" on public.comments for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from public.activity_events event where event.id = activity_event_id));
create policy "users update their comments" on public.comments for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete their comments" on public.comments for delete to authenticated using (user_id = auth.uid());

create or replace function public.get_profile_overview(profile_username text)
returns table (
  id uuid, username text, display_name text, avatar_path text, bio text,
  is_private boolean, can_view_content boolean, is_following boolean, is_mutual boolean,
  ratings_count bigint, followers_count bigint, following_count bigint, saved_count bigint,
  member_since timestamptz
) language sql stable security definer set search_path = public, pg_temp as $$
  select profile.id, profile.username::text, profile.display_name, profile.avatar_path, profile.bio,
    profile.is_private, public.can_view_profile_content(profile.id),
    exists (select 1 from public.follows where follower_id = auth.uid() and followed_id = profile.id),
    public.is_mutual_follow(profile.id),
    (select count(*) from public.ratings where user_id = profile.id),
    (select count(*) from public.follows where followed_id = profile.id),
    (select count(*) from public.follows where follower_id = profile.id),
    (select count(*) from public.listen_later_items where user_id = profile.id),
    profile.created_at
  from public.profiles profile where profile.username = profile_username::extensions.citext;
$$;

create or replace function public.get_album_rating_summary(target_album_id uuid)
returns table (global_average numeric, global_count bigint, friend_average numeric, friend_count bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  select
    round(avg(rating.value) filter (where not profile.is_private), 1),
    count(*) filter (where not profile.is_private),
    round(avg(rating.value) filter (where rating.user_id <> auth.uid() and public.is_mutual_follow(rating.user_id)), 1),
    count(*) filter (where rating.user_id <> auth.uid() and public.is_mutual_follow(rating.user_id))
  from public.ratings rating
  join public.profiles profile on profile.id = rating.user_id
  where rating.album_id = target_album_id;
$$;

create or replace function public.get_home_feed(page_size integer default 20, before_time timestamptz default null)
returns table (
  id uuid, activity_type public.activity_type, actor_id uuid, actor_username text,
  actor_display_name text, actor_avatar_path text, album_id uuid, album_title text,
  artist_name text, cover_path text, rating_value numeric, rating_note text, my_rating_value numeric,
  likes_count bigint, comments_count bigint, liked_by_me boolean, saved_by_me boolean,
  created_at timestamptz
) language sql stable security invoker set search_path = public, pg_temp as $$
  select event.id, event.activity_type, event.actor_id, profile.username::text,
    profile.display_name, profile.avatar_path, album.id, album.title, album.artist_name,
    album.cover_path, rating.value, rating.note,
    (select own_rating.value from public.ratings own_rating where own_rating.album_id = event.album_id and own_rating.user_id = auth.uid()),
    (select count(*) from public.likes where activity_event_id = event.id),
    (select count(*) from public.comments where activity_event_id = event.id),
    exists (select 1 from public.likes where activity_event_id = event.id and user_id = auth.uid()),
    exists (select 1 from public.listen_later_items where album_id = event.album_id and user_id = auth.uid()),
    event.created_at
  from public.activity_events event
  join public.profiles profile on profile.id = event.actor_id
  join public.albums album on album.id = event.album_id
  left join public.ratings rating on rating.id = event.rating_id
  where (event.actor_id = auth.uid() or exists (
      select 1 from public.follows where follower_id = auth.uid() and followed_id = event.actor_id
    ))
    and (before_time is null or event.created_at < before_time)
  order by event.created_at desc
  limit least(greatest(page_size, 1), 50);
$$;

create view public.public_album_aggregates with (security_barrier = true) as
select album.id as album_id,
  round(avg(rating.value) filter (where not coalesce(profile.is_private, true)), 1) as average_rating,
  count(rating.id) filter (where not coalesce(profile.is_private, true)) as ratings_count
from public.albums album
left join public.ratings rating on rating.album_id = album.id
left join public.profiles profile on profile.id = rating.user_id
group by album.id;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated, service_role;
grant select on public.profiles, public.albums, public.ratings, public.listen_later_items,
  public.follows, public.activity_events, public.likes, public.comments, public.public_album_aggregates to authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.ratings to authenticated;
grant insert, delete on public.listen_later_items, public.follows, public.likes to authenticated;
grant insert, update, delete on public.comments to authenticated;
grant insert, update, delete on public.albums to service_role;
grant execute on function public.is_mutual_follow(uuid, uuid) to authenticated;
grant execute on function public.can_view_profile_content(uuid, uuid) to authenticated;
grant execute on function public.get_profile_overview(text) to authenticated;
grant execute on function public.get_album_rating_summary(uuid) to authenticated;
grant execute on function public.get_home_feed(integer, timestamptz) to authenticated;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.sync_rating_activity() from public;
revoke execute on function public.sync_listen_later_activity() from public;
