delete from public.activity_events
where activity_type = 'listen_later_added'
  and listen_later_item_id is null;

drop index if exists public.activity_listen_later_actor_album_idx;

alter table public.activity_events
drop constraint activity_events_listen_later_item_id_fkey;

alter table public.activity_events
add constraint activity_events_listen_later_item_id_fkey
foreign key (listen_later_item_id)
references public.listen_later_items (id)
on delete cascade;

alter table public.activity_events
drop constraint activity_source_matches_type;

alter table public.activity_events
add constraint activity_source_matches_type check (
  (activity_type in ('rating_created', 'rating_updated') and rating_id is not null and listen_later_item_id is null)
  or (activity_type = 'listen_later_added' and rating_id is null and listen_later_item_id is not null)
);

create or replace function public.sync_listen_later_activity() returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  insert into public.activity_events (activity_type, actor_id, album_id, listen_later_item_id, created_at)
  values ('listen_later_added', new.user_id, new.album_id, new.id, new.created_at)
  on conflict (listen_later_item_id) where listen_later_item_id is not null do nothing;
  return new;
end;
$$;

drop policy "visible activity is readable" on public.activity_events;

create policy "visible activity is readable"
on public.activity_events for select to authenticated
using (
  public.can_view_profile_content(actor_id)
  and (
    activity_type <> 'listen_later_added'
    or created_at <= now() - interval '5 seconds'
  )
);
