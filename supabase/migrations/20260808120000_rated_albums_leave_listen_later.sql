delete from public.listen_later_items saved
using public.ratings rating
where rating.user_id = saved.user_id
  and rating.album_id = saved.album_id;

drop policy "users create their listen later items" on public.listen_later_items;

create policy "users create unrated listen later items"
on public.listen_later_items for insert to authenticated
with check (
  user_id = auth.uid()
  and not exists (
    select 1
    from public.ratings rating
    where rating.user_id = listen_later_items.user_id
      and rating.album_id = listen_later_items.album_id
  )
);

create or replace function public.reject_rated_listen_later_item() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (
    select 1
    from public.ratings rating
    where rating.user_id = new.user_id
      and rating.album_id = new.album_id
  ) then
    raise exception 'Rated albums cannot be saved for later.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger listen_later_reject_rated
before insert on public.listen_later_items
for each row execute function public.reject_rated_listen_later_item();

create or replace function public.remove_listen_later_after_rating() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.listen_later_items
  where user_id = new.user_id
    and album_id = new.album_id;
  return new;
end;
$$;

create trigger ratings_remove_listen_later
after insert on public.ratings
for each row execute function public.remove_listen_later_after_rating();

revoke execute on function public.reject_rated_listen_later_item() from public;
revoke execute on function public.remove_listen_later_after_rating() from public;
