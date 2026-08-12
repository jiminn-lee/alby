alter table public.comments
add column parent_comment_id uuid references public.comments (id) on delete cascade;

drop index if exists public.comments_activity_idx;

create index comments_activity_root_created_idx
on public.comments (activity_event_id, created_at desc, id desc)
where parent_comment_id is null;

create index comments_parent_created_idx
on public.comments (parent_comment_id, created_at, id)
where parent_comment_id is not null;

create or replace function public.validate_comment_thread()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  parent_activity_event_id uuid;
  parent_parent_comment_id uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  if new.parent_comment_id = new.id then
    raise exception using
      errcode = '23514',
      message = 'A comment cannot reply to itself.';
  end if;

  select comment.activity_event_id, comment.parent_comment_id
  into parent_activity_event_id, parent_parent_comment_id
  from public.comments comment
  where comment.id = new.parent_comment_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'The reply parent does not exist.';
  end if;

  if parent_parent_comment_id is not null then
    raise exception using
      errcode = '23514',
      message = 'Replies must belong to a root comment.';
  end if;

  if parent_activity_event_id <> new.activity_event_id then
    raise exception using
      errcode = '23514',
      message = 'Replies must belong to the same activity as their root comment.';
  end if;

  return new;
end;
$$;

create trigger comments_validate_thread
before insert or update of activity_event_id, parent_comment_id on public.comments
for each row execute function public.validate_comment_thread();

create table public.comment_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index comment_likes_comment_idx on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;

create policy "likes on visible comments are readable"
on public.comment_likes for select to authenticated
using (exists (
  select 1
  from public.comments comment
  where comment.id = comment_id
));

create policy "users create their comment likes"
on public.comment_likes for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.comments comment
    where comment.id = comment_id
  )
);

create policy "users delete their comment likes"
on public.comment_likes for delete to authenticated
using (user_id = auth.uid());

drop policy "users update their comments" on public.comments;

create policy "users update their comments"
on public.comments for update to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.activity_events event
    where event.id = activity_event_id
  )
);

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
    (
      select count(*)
      from public.comments comment
      where comment.activity_event_id = event.id
        and comment.parent_comment_id is null
    ),
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

grant select, insert, delete on public.comment_likes to authenticated;
grant execute on function public.get_home_feed(integer, timestamptz) to authenticated;

revoke execute on function public.validate_comment_thread() from public;
