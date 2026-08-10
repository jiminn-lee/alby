create view public.rating_listen_numbers
with (security_invoker = true) as
select
  rating.id as rating_id,
  row_number() over (
    partition by rating.user_id, rating.album_id
    order by rating.created_at, rating.id
  ) as listen_number
from public.ratings rating;

grant select on public.rating_listen_numbers to authenticated;

drop function public.get_home_feed(integer, timestamptz);

create function public.get_home_feed(page_size integer default 20, before_time timestamptz default null)
returns table (
  id uuid, activity_type public.activity_type, actor_id uuid, actor_username text,
  actor_display_name text, actor_avatar_path text, album_id uuid, album_title text,
  artist_name text, cover_path text, rating_value numeric, rating_note text,
  rating_listen_number bigint, my_rating_value numeric, likes_count bigint,
  comments_count bigint, liked_by_me boolean, saved_by_me boolean, created_at timestamptz
) language sql stable security invoker set search_path = public, pg_temp as $$
  select event.id, event.activity_type, event.actor_id, profile.username::text,
    profile.display_name, profile.avatar_path, album.id, album.title, album.artist_name,
    album.cover_path, rating.value, rating.note, listen_number.listen_number,
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
  left join public.rating_listen_numbers listen_number on listen_number.rating_id = rating.id
  where (event.actor_id = auth.uid() or exists (
      select 1 from public.follows where follower_id = auth.uid() and followed_id = event.actor_id
    ))
    and (before_time is null or event.created_at < before_time)
  order by event.created_at desc
  limit least(greatest(page_size, 1), 50);
$$;

grant execute on function public.get_home_feed(integer, timestamptz) to authenticated;
