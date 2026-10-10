# Build requests — Supabase setup

The site is static (GitHub Pages), so requests are stored in a free
[Supabase](https://supabase.com) database. Visitors can **only insert**;
only your logged-in admin account can **read** them.

Follow these steps once. Takes ~5 minutes.

---

## 1. Create a Supabase project

1. Go to https://supabase.com and sign in (free).
2. **New project** → pick a name, a strong database password, and a region close to you.
3. Wait ~2 minutes for it to finish provisioning.

## 2. Create the table + security rules

Open **SQL Editor** → **New query**, paste the following, then click **Run**.

> ⚠️ Replace `YOUR-ADMIN-USER-UUID` with your actual user id — you'll get it in
> step 4. If you run the SQL before creating the user, the policies still work;
> just make sure the uuid is correct.

```sql
create table if not exists public.requests (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  name              text,
  title             text not null,
  description       text not null,
  scope             text not null,
  contact_method    text not null,
  contact_value     text not null,
  uses_ai           boolean not null default false,
  env_content       text,
  env_file_path     text,
  env_file_name     text,
  out_of_scope_flag boolean not null default false,
  status            text not null default 'new'
);

alter table public.requests enable row level security;

-- Visitors may only CREATE requests.
create policy "anon insert requests"
  on public.requests for insert
  to anon
  with check (true);

-- Only your admin account may READ requests.
create policy "admin read requests"
  on public.requests for select
  to authenticated
  using (auth.uid() = 'YOUR-ADMIN-USER-UUID');

-- Only your admin account may UPDATE status.
create policy "admin update requests"
  on public.requests for update
  to authenticated
  using (auth.uid() = 'YOUR-ADMIN-USER-UUID')
  with check (auth.uid() = 'YOUR-ADMIN-USER-UUID');

-- Only your admin account may DELETE requests.
create policy "admin delete requests"
  on public.requests for delete
  to authenticated
  using (auth.uid() = 'YOUR-ADMIN-USER-UUID');

-- ==========================================================================
-- Likes + comments (project pages)
-- ==========================================================================

-- One row per project; keeps a server-side count anyone can +1 / -1.
create table if not exists public.project_likes (
  project_id text primary key,
  likes integer not null default 0
);

alter table public.project_likes enable row level security;

create policy "public read project_likes"
  on public.project_likes for select
  to anon, authenticated
  using (true);

-- Likes are guarded server-side so the count can never go negative.
create or replace function public.adjust_project_likes(p_project_id text, p_delta integer)
returns integer
language sql
security definer
set search_path = public
as $$
  insert into public.project_likes (project_id, likes)
  values (p_project_id, greatest(0, p_delta))
  on conflict (project_id)
  do update set likes = greatest(0, project_likes.likes + p_delta)
  returning likes;
$$;

grant execute on function public.adjust_project_likes(text, integer) to anon, authenticated;

create table if not exists public.project_comments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  project_id text not null,
  name text,
  body text not null check (char_length(body) between 1 and 1000)
);

alter table public.project_comments enable row level security;

create policy "public read project_comments"
  on public.project_comments for select
  to anon, authenticated
  using (true);

-- Visitors may POST comments (name is optional; body required).
create policy "public insert project_comments"
  on public.project_comments for insert
  to anon, authenticated
  with check (true);

-- Only your admin account may delete comments.
create policy "admin delete project_comments"
  on public.project_comments for delete
  to authenticated
  using (auth.uid() = 'YOUR-ADMIN-USER-UUID');

-- Private bucket for uploaded .env files (visitors backup their own AI keys).
insert into storage.buckets (id, name, public)
values ('request-env', 'request-env', false)
on conflict (id) do nothing;

create policy "anon upload env"
  on storage.objects for insert to anon
  with check (bucket_id = 'request-env');

create policy "admin read env"
  on storage.objects for select to authenticated
  using (bucket_id = 'request-env' and auth.uid() = 'YOUR-ADMIN-USER-UUID');

create policy "admin delete env"
  on storage.objects for delete to authenticated
  using (bucket_id = 'request-env' and auth.uid() = 'YOUR-ADMIN-USER-UUID');
```

> Already created the table? Just run the `alter table ... add column` lines,
> the `insert into storage.buckets` line, and the three `storage.objects`
> policies.

## 3. Lock down sign-ups (important)

**Authentication → Sign In / Providers → Email** and turn **OFF**
“Allow new users to sign up”.

This stops anyone from creating an account and passing the `authenticated`
check. You'll add your admin user manually in the next step (dashboard-created
users still work with sign-ups disabled).

## 4. Create your admin user

1. **Authentication → Users → Add user → Create new user**.
2. Enter your email + a strong password. Tick **Auto Confirm User**.
3. After it's created, click the user and copy the **User UID** (a uuid).
4. Go back to the SQL from step 2 and replace every
   `YOUR-ADMIN-USER-UUID` with that uuid, then run it again (drop and recreate,
   or edit the policies).

## 5. Copy your API keys into the site

**Project Settings → API**:

- **Project URL** → copy into `supabase-config.js` → `supabaseUrl`
- **Project API keys → anon public** → copy into `supabase-config.js` → `supabaseAnonKey`

`supabase-config.js`:

```js
window.WIPPY_CONFIG = {
  supabaseUrl: "https://xxxxxxxx.supabase.co",
  supabaseAnonKey: "eyJhbGci...",
};
```

The anon key is **safe to publish** — the RLS policies above mean it can only
insert. Keep the **service_role** key secret and never put it in this repo.

## 6. Deploy & test

1. Commit and push. GitHub Pages redeploys automatically.
2. On the live site, open the **Request** section, submit a test request.
3. Visit **`https://<your-site>/admin.html`**, log in, and you should see it.

---

## How it works

| File | Purpose |
| --- | --- |
| `index.html` | Adds the `#request` section + nav link (public form). |
| `requests.js` | Validates the form, enforces scope rules, inserts into Supabase. |
| `app.js` | Renders projects; now also like buttons + comments on cards & popup. |
| `admin.html` | Hidden admin page (`noindex`, not linked from the site). |
| `admin.js` | Supabase email/password login + dashboard (read/status/delete). |
| `admin-bg.js` | Admin-only live node-network background (distinct from home). |
| `supabase-config.js` | Your public URL + anon key. |

### Notes

- **Admin page is unlisted**, not linked anywhere and marked `noindex`. The URL
  is still guessable, so the login + RLS are what actually protect it.
- **Scope limits** are enforced in the form: requests flagged as AI/ML or
  enterprise-scale are blocked unless the visitor explicitly ticks
  “Submit anyway”, and the admin dashboard shows a ⚠︎ flag.
- To rotate access later, just create a new admin user and update the uuid in
  the RLS policies.

## 7. Security hardening (recommended)

Run [`supabase/security_hardening.sql`](supabase/security_hardening.sql) once in
the **SQL Editor**. It is idempotent (safe to re-run) and does not change any
normal flow. It:

- caps the size of anonymous request rows and comment names,
- forces new requests to `status = 'new'` (clients can't self-accept),
- caps anonymous uploads to the private `request-env` bucket (256 KB),
- adds a generous per-IP rate limit to public inserts (requests & comments).

The last block is a rollback snippet if you ever want to undo it.

Fonts are self-hosted from `fonts/` (see `fonts.css`) so the site makes no
third-party font requests. Deployment publishes only the files the site needs
(see the “Stage static site” step in `.github/workflows/deploy.yml`) — if you
add a new top-level asset, add it to that copy list.
