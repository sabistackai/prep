# PREP (Parents' Routine & Errands Planner): Build Spec

> PREP = **P**arents' **R**outine & **E**rrands **P**lanner.
> Client: the Okafor household, Port Harcourt (sample names used throughout).
> Reference demo: Homebase Prep Assistant prototype.

---

## 1. The problem

Each child has a fixed weekly pattern: uniform on some days, sportswear or native attire on others, plus several weekend activities (sports, board games, swimming). The nanny often forgets to prepare the right outfit or pack what an activity needs, and the parents only find out in the morning when it's too late.

## 2. What PREP does

1. **Parents set each child's week once**: the outfit for every weekday, and recurring activities with a time and what to bring.
2. **Every evening the nanny gets a push notification** with tomorrow's checklist for each child, built automatically from the routine.
3. **She ticks items off as she lays them out.** Parents see progress live.
4. **If prep isn't finished by the deadline**, both parents get a push alert, and the nanny gets a firmer reminder.
5. **Activity reminders** go to the nanny before each activity, with a leave-by time and what to pack.
6. **Parents can send the nanny one-off tasks** that arrive instantly as push notifications. She marks them done and the parents are notified.
7. ~~**School notices**: a parent pastes the school's broadcast message, AI reads the date and dress code, the parent confirms, and that day's checklist updates.~~ Dropped on 2026-10-30: PREP uses no AI.

## 3. Out of scope

Not part of this build:

- Household inventory, shopping lists, custom measurement units
- Chores, points and approvals
- Screen time tracking or NextDNS integration
- Kids' accounts (children are profiles only)
- Photo proof of prep
- WhatsApp messaging

---

## 4. Users and roles

| Role | Signs in with | Can do |
|---|---|---|
| **Parent** (1–2 per household) | Email + password | Everything: children, routine, activities, timings, tasks, school notices, add or remove nannies, see all status and history |
| **Nanny** (1+ per household) | Phone number + 6-digit PIN | See tonight's prep and tick items, see and complete her tasks, see upcoming activities and her notification history. Cannot edit the routine, activities, timings or other users. |
| **Child** | No account | Profile only (name, class, colour) |

**Nanny onboarding:** a parent adds the nanny (name and phone number), and the app generates a one-time setup link. The nanny opens it on her phone, sets a 6-digit PIN, installs the PWA and allows notifications. Behind the scenes this creates a Supabase Auth user with a synthetic email (for example `2348030000000@nanny.prep.app`) and the PIN as its password. A 6-digit PIN is used because Supabase requires passwords of at least 6 characters.

---

## 5. Features in detail

### 5.1 Children
- Add, edit or remove a child: name, class (for example "JSS 2", "Primary 4", "Nursery 2"), colour.
- The class is optional and shown next to the child's name.

### 5.2 Outfits
- Each household has a list of outfits, and each outfit has a default checklist.
- Seed defaults (editable):

| Outfit | Default items |
|---|---|
| Uniform | School uniform (ironed), school shoes (polished), school bag, lunch box |
| Sportswear | House sportswear, trainers, school bag, lunch box, water bottle |
| Native attire | Native attire (ironed), sandals, school bag, lunch box |
| Church clothes | Sunday clothes (ironed), church shoes |
| Casual | Casual clothes laid out |

### 5.3 Weekly routine
- A Mon–Sun grid per child, with one outfit per day.
- Tapping a cell cycles through outfits; long-press or a menu picks one directly.

### 5.4 Activities
- Fields: child, weekday, start time, title, items to bring (list), active on/off.
- Example: Tobi, Saturday, 8:00 AM, Football academy, bring boots, shin guards, jersey, water bottle.

### 5.5 Date overrides and holidays
- **Override:** for a specific date and child, change the outfit and/or add extra items. These come from school notices or are added manually.
- **Holiday ranges:** the parent marks term breaks or public holidays, and school-day outfits switch to Casual for those dates. Activities still apply unless paused.

### 5.6 Evening prep (core feature)
- At **prep release time** (default 6:30 PM, Lagos time), the system creates a **prep session** for tomorrow and **snapshots** the checklist items. Later routine edits don't change tonight's list unless a parent taps "Rebuild tonight's list".
- Items are built from tomorrow's outfit (after any override or holiday), plus items from tomorrow's activities, plus override extra items, grouped by outfit and activity.
- The nanny gets a push: *"Prep for Friday: 3 children, 16 items. Finish by 8:00 PM."*
- **Nanny view:** one card per child, items with large tick boxes, and a child shows Ready with a time once every item is ticked.
- **Parent view:** progress per child, each item ticked or not, and a ready time.
- The parent gets a push when all children are ready (on by default, can be turned off).

### 5.7 Deadline escalation
- At the **prep deadline** (default 8:00 PM), if the session isn't complete:
  - The session is marked `overdue`.
  - **Both parents** get a push listing which children aren't finished and how many items are left.
  - The **nanny** gets a push: *"Prep is overdue. Ejiro is not finished. Madam and Oga have been notified."*
- Optional mid-way nudge to the nanny (for example 7:30 PM) if nothing has been ticked yet.

### 5.8 Activity reminders
- Sent to the nanny **N minutes before** each activity (default 60), with a **leave-by** time = start time − travel buffer (default 30 min).
- Example: *"Tobi: Football academy at 8:00 AM. Leave by 7:30 AM. Bring boots, shin guards, jersey, water bottle."*
- Parents can optionally get them too (setting).

### 5.9 Tasks
- A parent creates a task: title, optional due date and time, assigned nanny.
- The nanny gets a push **immediately**: *"New task from Mrs Okafor: Iron Ada's choir robe. Due Sat 6:00 PM."*
- The nanny taps Done and the parent gets a push.
- Overdue open tasks get one reminder push to the nanny at the due time.

### 5.10 School notice reader (dropped)

> **Dropped on 2026-10-30.** PREP doesn't use AI or need a Claude API key. One-day changes are entered by hand (5.5). The design below is kept for reference only.

- A parent pastes the school's message into a text box.
- An edge function calls the Claude API and returns structured JSON (below).
- The parent sees the proposed change ("Monday 27 Oct: Ada and Tobi wear Sportswear, plus water bottle") and taps **Apply** or **Cancel**. **Nothing changes without confirmation.**
- On Apply, override rows are created and the nanny gets a push about the change.

Expected AI output:
```json
{
  "date": "2026-10-27",
  "outfit": "Sportswear",
  "applies_to_classes": ["Primary", "JSS"],
  "extra_items": ["Water bottle"],
  "summary": "Inter-House Sports Day",
  "confidence": "high"
}
```
- If there's no date or no dress code, show a clear message and change nothing.

### 5.11 Settings (per household)
- Prep release time, prep deadline, optional nudge time
- Activity reminder lead time, leave-by buffer
- Parent notifications: all ready, activity reminders (on/off)

---

## 6. Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 15** (App Router, TypeScript) |
| Hosting | **Vercel** |
| Database, auth, storage, functions | **Supabase** (Postgres, Auth, Edge Functions, pg_cron, pg_net) |
| Styling | **Tailwind CSS** |
| Fonts | **Manrope** (UI), **JetBrains Mono** (times and numbers) |
| Theme | Dark canvas `#0A0F14`, lime accent `#84CC16` |
| App type | **PWA** (installable, offline-tolerant, Web Push) |
| Push | **Web Push** with VAPID keys, sent from a Supabase Edge Function (`npm:web-push`) |

One codebase serves both roles: `/parent/*` and `/nanny/*` routes, guarded by role.

---

## 7. Data model (Postgres)

```sql
-- enums
create type member_role as enum ('parent','nanny');
create type session_status as enum ('pending','complete','overdue');
create type override_source as enum ('manual','school_notice');
create type notice_status as enum ('pending','applied','cancelled','failed');

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Africa/Lagos',
  prep_release_time time not null default '18:30',
  prep_nudge_time time,                       -- optional, e.g. '19:30'
  prep_deadline_time time not null default '20:00',
  activity_lead_minutes int not null default 60,
  leave_buffer_minutes int not null default 30,
  notify_parents_all_ready boolean not null default true,
  notify_parents_activities boolean not null default false,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  user_id uuid unique references auth.users on delete cascade,
  role member_role not null,
  display_name text not null,
  phone text,                                   -- E.164, nanny sign-in
  setup_token text unique,                      -- one-time nanny setup link
  setup_token_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table children (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null,
  class_name text,
  color text not null default '#84CC16',
  sort int not null default 0
);

create table outfits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  name text not null,
  items text[] not null default '{}',
  sort int not null default 0,
  unique (household_id, name)
);

create table weekly_routine (
  child_id uuid references children on delete cascade,
  weekday smallint check (weekday between 1 and 7),  -- 1 = Monday (ISO)
  outfit_id uuid not null references outfits,
  primary key (child_id, weekday)
);

create table activities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  child_id uuid not null references children on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  title text not null,
  bring text[] not null default '{}',
  active boolean not null default true
);

create table overrides (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references children on delete cascade,
  on_date date not null,
  outfit_id uuid references outfits,
  extra_items text[] not null default '{}',
  source override_source not null default 'manual',
  note text,
  unique (child_id, on_date, source)
);

create table holidays (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  starts_on date not null,
  ends_on date not null,
  label text
);

create table prep_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  for_date date not null,
  released_at timestamptz not null default now(),
  deadline_at timestamptz not null,
  status session_status not null default 'pending',
  completed_at timestamptz,
  unique (household_id, for_date)
);

create table prep_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references prep_sessions on delete cascade,
  child_id uuid not null references children on delete cascade,
  label text not null,
  group_label text not null,        -- outfit name or "Football academy · 8:00 AM"
  sort int not null default 0,
  checked_at timestamptz,
  checked_by uuid references members
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  created_by uuid not null references members,
  assigned_to uuid not null references members,
  title text not null,
  due_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  member_id uuid not null references members on delete cascade,
  kind text not null,               -- prep_release | prep_nudge | prep_overdue | all_ready | activity | task_new | task_done | task_due | notice_applied
  dedupe_key text not null,         -- e.g. 'activity:<activity_id>:2026-10-31'
  title text not null,
  body text not null,
  link text,                        -- deep link inside the app
  channels text[] not null default '{push}',
  sent_at timestamptz not null default now(),
  read_at timestamptz,
  unique (member_id, dedupe_key)
);

create table school_notices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households on delete cascade,
  created_by uuid not null references members,
  raw_text text not null,
  parsed jsonb,
  status notice_status not null default 'pending',
  created_at timestamptz not null default now()
);
```

### Row-level security
- Enable RLS on every table.
- Helper: `current_member()` returns the member row for `auth.uid()`.
- **Parents:** full read and write on rows where `household_id` matches their own.
- **Nannies:**
  - Read: `children`, `outfits`, `weekly_routine`, `activities`, `overrides`, `holidays`, `prep_sessions`, `prep_items`, and their own `tasks`, `notifications` and `push_subscriptions`.
  - Write: only `prep_items.checked_at` and `checked_by`, `tasks.done_at` on tasks assigned to them, `notifications.read_at` on their own, and their own `push_subscriptions`.
  - No access to other members' phone numbers, `school_notices`, or household settings.
- Use column-limited `update` policies, or a `security definer` RPC (`tick_item(item_id, checked boolean)`, `complete_task(task_id)`), so nannies can't edit labels.

---

## 8. Scheduled jobs and functions

All times are computed in the household's timezone (`Africa/Lagos`).

**`pg_cron` every 5 minutes calls Edge Function `scheduler`**, which runs for each household:

1. **Release prep.** If local time ≥ `prep_release_time` and there's no `prep_sessions` row for tomorrow:
   - Resolve each child's outfit for tomorrow (override, then holiday rule, then weekly routine).
   - Build items: outfit items, plus active activities for tomorrow's weekday, plus override extra items.
   - Insert the session and its items, then notify nannies (`prep_release`).
2. **Nudge** (optional). If ≥ `prep_nudge_time`, the session is pending and no items are checked, notify nannies (`prep_nudge`).
3. **Deadline.** If ≥ `prep_deadline_time` and the session is still pending, set it to `overdue`. Notify parents and nannies (`prep_overdue`).
4. **Activity reminders.** For today's active activities where `now >= start_time - activity_lead_minutes` and `now < start_time`, notify nannies (and parents if enabled) with dedupe key `activity:<id>:<date>`.
5. **Task due.** For open tasks where `now >= due_at`, notify the assignee once (`task_due:<id>`).

**Database triggers (via `pg_net` or Supabase Database Webhooks):**
- `tasks` insert: push to the assignee (`task_new`).
- `tasks.done_at` set: push to the creator (`task_done`).
- `prep_items` update: if every item in the session is checked, set the session to `complete` and push to parents (`all_ready`) if enabled.

**Edge Function `send-notification`** (used by everything above):
- Inserts into `notifications`. On a `(member_id, dedupe_key)` conflict, skip, which keeps sends idempotent.
- Sends Web Push to every subscription for that member. On a 404 or 410 response, delete the subscription.

**Edge Function `parse-notice`:**
- Input: `raw_text` and the household's children and classes.
- Calls Claude with a strict JSON-only prompt, validates the JSON against a schema (zod), stores it in `school_notices.parsed`, and returns a preview.
- **`apply-notice`:** creates `overrides` rows with `source = 'school_notice'` and notifies nannies. If the notice is for tomorrow and tonight's session has already been released, rebuild that session's items for the affected children while keeping existing ticks.

---

## 9. PWA and push details

- `manifest.webmanifest`: name "PREP", short_name "PREP", `display: standalone`, theme `#0A0F14`, icons at 192 and 512 px (plus maskable).
- Service worker: handles `push` (shows the notification with title, body and a deep-link URL) and `notificationclick` (focuses or opens the app at the link). Cache the app shell so it opens offline; ticks made offline go into a queue and sync when the connection returns.
- Ask for notification permission **after** a clear explanation screen during setup, not on first load.
- **iPhone:** push only works after "Add to Home Screen" (iOS 16.4+), so show iOS-specific install steps.
- **Android battery optimisation:** Tecno, Infinix, itel and similar phones often kill background delivery. Include a setup screen with brand-specific steps to set the browser or app to "No restrictions" or "Allow background activity", plus a **"Send test notification"** button.
- Store a `last_ok_at` on each subscription. If a nanny has had no working subscription for 24 hours, show the parents a warning: *"Blessing's notifications may be off."*
- **Fallback:** the nanny's home screen always shows tonight's prep and open tasks when opened, so nothing depends only on a push arriving.

---

## 10. Screens

**Parent**
1. **Today**: tonight's prep status (X of Y ready, per child, item by item), open tasks, next activity reminders, any overdue alert.
2. **Routine**: the Mon–Sun outfit grid per child.
3. **Activities**: list and add/edit form.
4. **Tasks**: create a task, plus open and done lists.
5. **School notice**: paste box, preview, Apply.
6. **Settings**: children, outfits and their items, holidays, timings, notification preferences, nannies (add, setup link, remove).

**Nanny** (large tap targets, plain English, 3 tabs)
1. **Prep**: tonight's checklist cards per child, with a Ready badge.
2. **Tasks**: open tasks with a Done button, then completed ones.
3. **Alerts**: notification history plus upcoming activities with leave-by times.

---

## 11. Acceptance criteria

- [ ] A parent can add 3 children, set a full week of outfits and add weekend activities in under 5 minutes.
- [ ] At 6:30 PM Lagos time, the nanny receives a push for tomorrow's prep, and the list matches the outfit, activities and any override exactly.
- [ ] Ticking an item updates the parent view within 2 seconds (Supabase Realtime).
- [ ] A child shows Ready with a timestamp when all of their items are ticked; parents get an "all ready" push when every child is done.
- [ ] At 8:00 PM, if prep is incomplete, both parents get a push naming the unfinished children, and the nanny gets an overdue push. No duplicates are sent.
- [ ] Activity reminders arrive 60 minutes before each activity with the correct leave-by time.
- [ ] A new task reaches the nanny's phone within 10 seconds; marking it done notifies the parent.
- [ ] Pasting a school message produces a correct preview, and nothing changes until the parent taps Apply.
- [ ] Holiday dates switch school-day outfits to Casual.
- [ ] The nanny cannot edit the routine, activities, settings or other users (verified against the RLS policies).
- [ ] The app installs as a PWA on Android and iPhone, and the test notification works on a Tecno or Infinix phone after following the battery steps.

---

## 12. Build plan (about 3 weeks, solo with Claude Code)

**Week 1: foundation**
- Supabase project, schema, RLS, seed outfits
- Parent auth, nanny setup link and PIN flow
- Children, routine grid, activities, settings screens

**Week 2: the core loop**
- PWA manifest, service worker, push subscription flow, test notification
- `send-notification`, the `scheduler` cron (release, nudge, deadline)
- Nanny Prep tab with ticking, parent live status via Realtime

**Week 3: tasks, AI, polish**
- Tasks plus triggers, activity reminders, task due reminders
- ~~`parse-notice` and `apply-notice` with Claude~~ (dropped), holidays
- Android battery guide, offline queue, notification health warning
- 3–5 day live trial with the household, then fixes

---

## 13. Running costs (one household)

| Item | Cost |
|---|---|
| Vercel (Hobby/Pro) | Free tier is enough for one household |
| Supabase | Free tier is enough to start (move to Pro at about $25/month for backups and no project pausing) |
| Web Push | Free |
| Play Store (optional, later) | One-time $25 developer fee if wrapped as an Android app (TWA) |

On the free Supabase tier, projects pause after a period of inactivity. Use Pro for the live client, or make sure the cron job keeps it active.

---

## 14. Questions to confirm with the client

1. One nanny or several? Do they share the checklist or split it by child?
2. What time do the kids leave for school? This confirms the 8:00 PM deadline and whether a **morning** check would also help.
3. Should both parents get every alert, or only one?
4. School terms and holidays: can the parents enter them once per term?
5. Does the nanny have an Android phone with data, and who pays for it?
6. Should "all ready" pushes go to the parents every night, or only failures?

---

## 15. Later (if PREP becomes a product for other families)

- Multi-household sign-up and a subscription (Paystack)
- Shared outfit templates by school
- Weekly report for parents (on-time rate, missed items)
- Optional photo proof per item
- Inventory module (from the earlier Homebase prototype) as an add-on
