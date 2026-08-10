alter table public.ratings
  drop constraint if exists ratings_user_id_album_id_key;

create index if not exists ratings_user_album_created_idx
  on public.ratings (user_id, album_id, created_at desc, id desc);

create or replace function public.get_album_rating_summary(target_album_id uuid)
returns table (global_average numeric, global_count bigint, friend_average numeric, friend_count bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  with latest_ratings as (
    select distinct on (rating.user_id)
      rating.user_id,
      rating.value
    from public.ratings rating
    where rating.album_id = target_album_id
    order by rating.user_id, rating.created_at desc, rating.id desc
  )
  select
    round(avg(rating.value) filter (where not profile.is_private), 1),
    count(*) filter (where not profile.is_private),
    round(avg(rating.value) filter (
      where rating.user_id <> auth.uid() and public.is_mutual_follow(rating.user_id)
    ), 1),
    count(*) filter (
      where rating.user_id <> auth.uid() and public.is_mutual_follow(rating.user_id)
    )
  from latest_ratings rating
  join public.profiles profile on profile.id = rating.user_id;
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
    (
      select own_rating.value
      from public.ratings own_rating
      where own_rating.album_id = event.album_id and own_rating.user_id = auth.uid()
      order by own_rating.created_at desc, own_rating.id desc
      limit 1
    ),
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

create or replace view public.public_album_aggregates with (security_barrier = true) as
with latest_ratings as (
  select distinct on (rating.user_id, rating.album_id)
    rating.user_id,
    rating.album_id,
    rating.value
  from public.ratings rating
  order by rating.user_id, rating.album_id, rating.created_at desc, rating.id desc
)
select album.id as album_id,
  round(avg(rating.value) filter (where not coalesce(profile.is_private, true)), 1) as average_rating,
  count(rating.user_id) filter (where not coalesce(profile.is_private, true)) as ratings_count
from public.albums album
left join latest_ratings rating on rating.album_id = album.id
left join public.profiles profile on profile.id = rating.user_id
group by album.id;

