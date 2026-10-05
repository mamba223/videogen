-- ReelForge schema. Run in the Supabase SQL editor.
-- (Run this whole file once on a fresh project.)

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  credits int not null default 5,
  credits_refreshed_on date not null default current_date,
  created_at timestamptz not null default now()
);

create type video_status as enum ('queued','generating','moderating','ready','failed','rejected');
create type video_visibility as enum ('public','private','unlisted');

create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  prompt text not null,
  title text,
  status video_status not null default 'queued',
  progress int not null default 0,
  visibility video_visibility not null default 'private',
  video_url text,
  clips text[],
  thumbnail_url text,
  preview_url text,
  duration_sec int not null default 5,
  model text not null default 'wan-2.1',
  like_count int not null default 0,
  comment_count int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.videos (visibility, status, created_at desc);
create index on public.videos (user_id, created_at desc);

create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos on delete cascade,
  idx int not null,
  prompt text not null,
  clip_url text,
  status video_status not null default 'queued'
);

create table public.likes (
  user_id uuid references public.profiles on delete cascade,
  video_id uuid references public.videos on delete cascade,
  primary key (user_id, video_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid references public.profiles on delete cascade,
  following_id uuid references public.profiles on delete cascade,
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references public.videos on delete cascade,
  reporter_id uuid references public.profiles on delete set null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table public.credit_ledger (
  id bigserial primary key,
  user_id uuid not null references public.profiles on delete cascade,
  delta int not null,
  reason text not null,
  created_at timestamptz not null default now()
);

-- Row level security
alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.scenes enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.follows enable row level security;
alter table public.reports enable row level security;
alter table public.credit_ledger enable row level security;

create policy "profiles readable" on public.profiles for select using (true);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);

create policy "videos visible" on public.videos for select
  using ((visibility in ('public','unlisted') and status = 'ready') or user_id = auth.uid());
create policy "videos insert own" on public.videos for insert with check (user_id = auth.uid());
create policy "videos update own" on public.videos for update using (user_id = auth.uid());
create policy "videos delete own" on public.videos for delete using (user_id = auth.uid());

create policy "scenes via video" on public.scenes for select
  using (exists (select 1 from public.videos v where v.id = video_id and v.user_id = auth.uid()));

create policy "likes read" on public.likes for select using (true);
create policy "likes write" on public.likes for insert with check (user_id = auth.uid());
create policy "likes delete" on public.likes for delete using (user_id = auth.uid());

create policy "comments read" on public.comments for select using (true);
create policy "comments write" on public.comments for insert with check (user_id = auth.uid());
create policy "comments delete" on public.comments for delete using (user_id = auth.uid());

create policy "follows read" on public.follows for select using (true);
create policy "follows write" on public.follows for insert with check (follower_id = auth.uid());
create policy "follows delete" on public.follows for delete using (follower_id = auth.uid());

create policy "reports insert" on public.reports for insert with check (reporter_id = auth.uid());
create policy "ledger own read" on public.credit_ledger for select using (user_id = auth.uid());

-- Auto-create profile on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, split_part(new.email,'@',1) || floor(random()*1000)::int, split_part(new.email,'@',1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Spend credits atomically, refilling 5 free credits each day
create or replace function public.spend_credits(cost int) returns boolean
language plpgsql security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from profiles where id = auth.uid() for update;
  if p.credits_refreshed_on < current_date then
    update profiles set credits = greatest(credits, 5), credits_refreshed_on = current_date where id = p.id;
    p.credits := greatest(p.credits, 5);
  end if;
  if p.credits < cost then return false; end if;
  update profiles set credits = credits - cost where id = p.id;
  insert into credit_ledger (user_id, delta, reason) values (p.id, -cost, 'generation');
  return true;
end $$;

-- Keep like/comment counters in sync
create or replace function public.bump_like() returns trigger language plpgsql as $$
begin
  update videos set like_count = like_count + (case when tg_op='INSERT' then 1 else -1 end)
  where id = coalesce(new.video_id, old.video_id);
  return null;
end $$;
create trigger likes_count after insert or delete on public.likes for each row execute function public.bump_like();

create or replace function public.bump_comment() returns trigger language plpgsql as $$
begin
  update videos set comment_count = comment_count + (case when tg_op='INSERT' then 1 else -1 end)
  where id = coalesce(new.video_id, old.video_id);
  return null;
end $$;
create trigger comments_count after insert or delete on public.comments for each row execute function public.bump_comment();

-- Series & episodes: a series groups numbered episodes (videos made of several scenes)
create table public.series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  title text not null,
  description text,
  bible text,
  cover_url text,
  visibility video_visibility not null default 'public',
  created_at timestamptz not null default now()
);
alter table public.series enable row level security;
create policy "series read" on public.series for select using (visibility = 'public' or user_id = auth.uid());
create policy "series write" on public.series for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table public.videos add column series_id uuid references public.series on delete set null;
alter table public.videos add column episode_number int;
create index on public.videos (series_id, episode_number);

-- Long-form episodes: scenes are persisted as they finish so generation can resume / run on a worker
alter table public.videos add column scene_count int not null default 1;
alter table public.scenes add column narration text;
alter table public.scenes add column duration_sec int not null default 5;
alter table public.scenes add unique (video_id, idx);

drop policy "scenes via video" on public.scenes;
create policy "scenes read" on public.scenes for select using (
  exists (select 1 from public.videos v where v.id = video_id
    and (v.user_id = auth.uid() or (v.visibility in ('public','unlisted') and v.status = 'ready'))));
create policy "scenes insert" on public.scenes for insert with check (
  exists (select 1 from public.videos v where v.id = video_id and v.user_id = auth.uid()));
create policy "scenes update" on public.scenes for update using (
  exists (select 1 from public.videos v where v.id = video_id and v.user_id = auth.uid()));
create policy "scenes delete" on public.scenes for delete using (
  exists (select 1 from public.videos v where v.id = video_id and v.user_id = auth.uid()));

-- Story library: scripts, documents, reference images and audio attached to a user or a series
create type asset_kind as enum ('script','document','image','audio');
create table public.story_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  series_id uuid references public.series on delete set null,
  kind asset_kind not null,
  name text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  extracted_text text,
  created_at timestamptz not null default now()
);
create index on public.story_assets (user_id, series_id);
alter table public.story_assets enable row level security;
create policy "assets own" on public.story_assets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into storage.buckets (id, name, public) values ('story-assets', 'story-assets', false)
  on conflict do nothing;
create policy "story assets read" on storage.objects for select
  using (bucket_id = 'story-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "story assets upload" on storage.objects for insert
  with check (bucket_id = 'story-assets' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "story assets delete" on storage.objects for delete
  using (bucket_id = 'story-assets' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- Server-side job queue. Each scene row is a job; a worker process claims
-- jobs with FOR UPDATE SKIP LOCKED, so many workers can run safely in parallel.
-- Clients can no longer insert/update videos or scenes directly: they go
-- through enqueue_episode / cancel_episode / set_visibility below.
-- =====================================================================
alter table public.scenes add column attempts int not null default 0;
alter table public.scenes add column locked_at timestamptz;
alter table public.scenes add column worker_id text;
alter table public.scenes add column error text;
alter table public.scenes add column created_at timestamptz not null default now();
alter table public.videos add column style text;
alter table public.videos add column reference_asset_ids uuid[] not null default '{}';
alter table public.videos add column error text;
create index scenes_queue_idx on public.scenes (status, idx, created_at);

drop policy "videos insert own" on public.videos;
drop policy "videos update own" on public.videos;
drop policy "scenes insert" on public.scenes;
drop policy "scenes update" on public.scenes;
drop policy "scenes delete" on public.scenes;

-- Public bucket for finished clips (random UUID paths; moderation will gate publishing later)
insert into storage.buckets (id, name, public) values ('clips', 'clips', true) on conflict do nothing;

-- Recompute a video's progress/status/clip list from its scenes
create or replace function public.refresh_video(p_video uuid) returns void
language plpgsql security definer set search_path = public as $$
declare total int; n_ready int; n_failed int; n_active int; n_gen int; clip_list text[];
begin
  select count(*),
         count(*) filter (where status = 'ready'),
         count(*) filter (where status = 'failed'),
         count(*) filter (where status in ('queued','generating')),
         count(*) filter (where status = 'generating')
    into total, n_ready, n_failed, n_active, n_gen
    from scenes where video_id = p_video;
  select array_agg(clip_url order by idx) into clip_list
    from scenes where video_id = p_video and status = 'ready';
  update videos set
    progress = case when total = 0 then 0 else n_ready * 100 / total end,
    clips = case when n_active = 0 and n_failed = 0 then clip_list else clips end,
    video_url = case when n_active = 0 and n_failed = 0 then clip_list[1] else video_url end,
    status = case
      when n_active = 0 and n_failed > 0 then 'failed'::video_status
      when n_active = 0 then 'ready'::video_status
      when n_ready > 0 or n_gen > 0 then 'generating'::video_status
      else 'queued'::video_status end,
    error = case when n_active = 0 and n_failed > 0
                 then 'Some scenes failed or were cancelled. Credits for them were refunded.' else null end
  where id = p_video;
end $$;

-- Retry a failed attempt, or fail permanently and refund 1 credit
create or replace function public.fail_scene(p_scene uuid, p_error text, p_max_attempts int default 3) returns void
language plpgsql security definer set search_path = public as $$
declare s scenes; owner uuid;
begin
  select * into s from scenes where id = p_scene for update;
  if not found or s.status <> 'generating' then return; end if;
  if s.attempts < p_max_attempts then
    update scenes set status = 'queued', locked_at = null, worker_id = null, error = p_error where id = p_scene;
  else
    update scenes set status = 'failed', locked_at = null, worker_id = null, error = p_error where id = p_scene;
    select user_id into owner from videos where id = s.video_id;
    update profiles set credits = credits + 1 where id = owner;
    insert into credit_ledger (user_id, delta, reason) values (owner, 1, 'refund: scene failed');
    perform refresh_video(s.video_id);
  end if;
end $$;

create or replace function public.complete_scene(p_scene uuid, p_clip text) returns void
language plpgsql security definer set search_path = public as $$
declare vid uuid;
begin
  update scenes set status = 'ready', clip_url = p_clip, locked_at = null, error = null
    where id = p_scene and status = 'generating' returning video_id into vid;
  if vid is not null then perform refresh_video(vid); end if;
end $$;

-- Claim up to p_limit queued scenes. Ordering by scene index first interleaves episodes,
-- so one 120-scene episode can't starve everyone else. Also recovers crashed workers' jobs.
create or replace function public.claim_scenes(p_worker text, p_limit int) returns setof public.scenes
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from scenes where status = 'generating' and locked_at < now() - interval '10 minutes' loop
    perform fail_scene(r.id, 'timed out', 3);
  end loop;
  return query
    update scenes s set status = 'generating', locked_at = now(), worker_id = p_worker, attempts = s.attempts + 1
    where s.id in (
      select sc.id from scenes sc where sc.status = 'queued'
      order by sc.idx, sc.created_at limit p_limit for update skip locked)
    returning s.*;
  update videos set status = 'generating'
    where status = 'queued' and id in (select video_id from scenes where worker_id = p_worker and status = 'generating');
end $$;

revoke execute on function public.refresh_video(uuid), public.fail_scene(uuid, text, int),
  public.complete_scene(uuid, text), public.claim_scenes(text, int) from public, anon, authenticated;

-- Client entry point: charge credits and create the episode + all its scene jobs atomically
create or replace function public.enqueue_episode(
  p_title text, p_prompt text, p_series uuid, p_episode int, p_visibility video_visibility,
  p_scenes jsonb, p_style text, p_refs uuid[], p_scene_seconds int,
  p_model text default 'wan-2.1'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare n int := jsonb_array_length(p_scenes); vid uuid; ok boolean; safe_refs uuid[];
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if n < 1 or n > 120 then raise exception 'invalid_scene_count'; end if;
  if p_scene_seconds not in (3, 5, 8) then raise exception 'invalid_duration'; end if;
  if p_series is not null and not exists (select 1 from series where id = p_series and user_id = auth.uid()) then
    raise exception 'invalid_series';
  end if;
  select coalesce(array_agg(id), '{}') into safe_refs from story_assets
    where id = any(coalesce(p_refs, '{}')) and user_id = auth.uid() and kind = 'image';
  select spend_credits(n) into ok;
  if not ok then raise exception 'insufficient_credits'; end if;
  insert into videos (user_id, title, prompt, series_id, episode_number, visibility, status, scene_count,
                      duration_sec, style, reference_asset_ids, model)
    values (auth.uid(), nullif(p_title, ''), left(p_prompt, 500), p_series, p_episode, p_visibility, 'queued', n,
            n * p_scene_seconds, p_style, safe_refs, coalesce(p_model, 'wan-2.1'))
    returning id into vid;
  insert into scenes (video_id, idx, prompt, narration, duration_sec, status)
    select vid, (e.ord - 1)::int, left(e.val ->> 'prompt', 1000), e.val ->> 'narration',
           coalesce(nullif(e.val ->> 'durationSec', '')::int, p_scene_seconds), 'queued'
    from jsonb_array_elements(p_scenes) with ordinality as e(val, ord);
  return vid;
end $$;

-- Cancel queued scenes of an episode and refund them; scenes already rendering finish normally
create or replace function public.cancel_episode(p_video uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not exists (select 1 from videos where id = p_video and user_id = auth.uid()) then
    raise exception 'not_found';
  end if;
  with c as (
    update scenes set status = 'failed', error = 'cancelled' where video_id = p_video and status = 'queued' returning 1
  ) select count(*) into n from c;
  if n > 0 then
    update profiles set credits = credits + n where id = auth.uid();
    insert into credit_ledger (user_id, delta, reason) values (auth.uid(), n, 'refund: cancelled');
  end if;
  perform refresh_video(p_video);
  return n;
end $$;

create or replace function public.set_visibility(p_video uuid, p_visibility video_visibility) returns void
language sql security definer set search_path = public as $$
  update videos set visibility = p_visibility where id = p_video and user_id = auth.uid();
$$;

