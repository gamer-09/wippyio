-- ===========================================================================
-- wippy — security hardening
-- ===========================================================================
-- Idempotent. Safe to run more than once. Run in the Supabase SQL Editor
-- (Project → SQL Editor → New query → paste → Run).
--
-- What it does:
--   1. Caps the size of anonymous rows in `requests` (was: unbounded).
--   2. Forces new requests to status = 'new' (clients can't self-accept).
--   3. Caps comment `name` length.
--   4. Caps anonymous uploads to the private `request-env` bucket (was: any size).
--   5. Adds a lightweight per-IP rate limit to public inserts (requests +
--      comments) so a script can't flood the tables or the storage bucket.
--
-- It does NOT change any normal flow: the website sends values that are well
-- inside these caps, new rows already default to status 'new', uploads are
-- capped at 100 KB client-side (limit below is 256 KB), and the rate limits are
-- far above what a real visitor would ever hit.
-- ---------------------------------------------------------------------------

-- 1 + 2. Tighten the "anyone may insert a request" policy.
drop policy if exists "anon insert requests" on public.requests;
create policy "anon insert requests"
  on public.requests for insert
  to anon
  with check (
    char_length(coalesce(name, ''))            <= 120
    and char_length(title)                     between 1 and 200
    and char_length(description)               between 1 and 5000
    and char_length(scope)                     between 1 and 80
    and char_length(contact_method)            between 1 and 40
    and char_length(contact_value)             between 1 and 400
    and char_length(coalesce(env_content, '')) <= 8000
    and char_length(coalesce(env_file_path,''))<= 400
    and char_length(coalesce(env_file_name,''))<= 300
    and status = 'new'   -- column default; prevents self-set status
  );

-- 3. Tighten comments: cap the optional name (body is already 1..1000).
drop policy if exists "public insert project_comments" on public.project_comments;
create policy "public insert project_comments"
  on public.project_comments for insert
  to anon, authenticated
  with check (
    char_length(body) between 1 and 1000
    and char_length(coalesce(name, '')) <= 100
  );

-- 4. Cap anonymous uploads to the private .env bucket (client allows 100 KB).
drop policy if exists "anon upload env" on storage.objects;
create policy "anon upload env"
  on storage.objects for insert
  to anon
  with check (
    bucket_id = 'request-env'
    and coalesce((metadata ->> 'size')::bigint, 0) <= 262144  -- 256 KB
  );

-- 5. Per-IP rate limiting for public inserts.
create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);

alter table public.rate_limits enable row level security;
-- No policies on purpose: only the SECURITY DEFINER function below touches it.
-- Direct client access is therefore denied.

create or replace function public.enforce_insert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hdr     text;
  ip      text;
  k       text;
  win     interval;
  max_cnt integer;
  r       public.rate_limits%rowtype;
begin
  -- Only throttle real API traffic. PostgREST sets `request.headers`; direct
  -- SQL (SQL editor, migrations, service_role) does not, so it is never limited.
  begin
    hdr := current_setting('request.headers', true);
  exception when others then
    hdr := null;
  end;
  if hdr is null or hdr = '' then
    return new;
  end if;

  begin
    ip := coalesce((hdr::json ->> 'x-forwarded-for'), 'unknown');
    if position(',' in ip) > 0 then ip := split_part(ip, ',', 1); end if;
    ip := btrim(ip);
    if ip = '' then ip := 'unknown'; end if;
  exception when others then
    ip := 'unknown';
  end;

  -- Per-endpoint budgets (generous; tweak if needed).
  if tg_table_name = 'requests' then
    win := interval '10 minutes'; max_cnt := 10;
  elsif tg_table_name = 'project_comments' then
    win := interval '2 minutes';  max_cnt := 20;
  else
    win := interval '1 minute';   max_cnt := 30;
  end if;

  k := tg_table_name || ':' || ip;

  insert into public.rate_limits (key, window_start, count)
  values (k, now(), 1)
  on conflict (key) do update
    set count = case when public.rate_limits.window_start < now() - win
                     then 1 else public.rate_limits.count + 1 end,
        window_start = case when public.rate_limits.window_start < now() - win
                            then now() else public.rate_limits.window_start end
  returning * into r;

  if r.count > max_cnt then
    raise exception 'Too many requests — please slow down and try again shortly.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists requests_rate_limit on public.requests;
create trigger requests_rate_limit
  before insert on public.requests
  for each row execute function public.enforce_insert_rate_limit();

drop trigger if exists comments_rate_limit on public.project_comments;
create trigger comments_rate_limit
  before insert on public.project_comments
  for each row execute function public.enforce_insert_rate_limit();

-- Optional housekeeping: old rate-limit rows are harmless but you can clear
-- them any time with:  delete from public.rate_limits where window_start < now() - interval '1 day';

-- ---------------------------------------------------------------------------
-- ROLLBACK (only if you ever need to undo):
--   drop trigger if exists requests_rate_limit on public.requests;
--   drop trigger if exists comments_rate_limit on public.project_comments;
--   drop function if exists public.enforce_insert_rate_limit();
--   drop table if exists public.rate_limits;
--   -- then re-create the original permissive policies from SETUP.md.
-- ---------------------------------------------------------------------------
