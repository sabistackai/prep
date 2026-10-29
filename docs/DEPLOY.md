# Deploying PREP

PREP uses its own accounts (GitHub `sabistackai`, plus separate Vercel, Supabase and Claude accounts).
Don't use the Vercel CLI on this machine: it is signed in to a different account.

## 1. Supabase (cloud project)

```sh
# Token from the PREP Supabase account: Account → Access Tokens. Never commit it.
export SUPABASE_ACCESS_TOKEN=...
npx supabase link --project-ref <project-ref>
npx supabase db push                     # applies supabase/migrations
npx supabase functions deploy send-notification --no-verify-jwt
```

Function secrets (generate fresh values for production; don't reuse the local ones):

```sh
npx supabase secrets set \
  VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:<contact email> \
  PREP_FUNCTIONS_SECRET=<random 32+ chars>
```

Generate VAPID keys with `npx web-push generate-vapid-keys`.

Tell the database where the function lives (SQL editor):

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'prep_functions_url');
select vault.create_secret('<same PREP_FUNCTIONS_SECRET>', 'prep_functions_secret');
```

Auth settings (Dashboard → Authentication):
- Site URL: the Vercel production URL. Add `<url>/**` to the redirect URLs.
- Minimum password length: 6 (nanny passwords are derived, parents are held to 8 by the app).

## 2. Vercel

Import `sabistackai/prep` from the PREP Vercel account. Environment variables:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API keys |
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API keys (secret) |
| `NEXT_PUBLIC_SITE_URL` | the production URL |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | same as `VAPID_PUBLIC_KEY` above |
| `NANNY_PIN_SECRET` | random 32+ chars. **Keep a copy**: losing it means every nanny needs a new setup link |

## 3. Check it works

1. Sign up as a parent, add a child and a nanny, open the setup link on a phone.
2. On the nanny's phone: turn on notifications, tap **Send test notification**.
3. In Settings, set the list time a few minutes ahead and wait for the checklist push.

## Local development

```sh
npm run db:start     # local Supabase on ports 553xx
npm run db:vault     # point the local DB at the local functions (after every db reset)
npm run db:seed      # demo parent + nanny setup link (local only)
npm run dev
npm run test:db      # database checks
```

Local secrets live in `.env.local` and `supabase/.env` (both gitignored).
