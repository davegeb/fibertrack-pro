# FiberTrack Pro — Deployment Guide

A full-stack fiber conduit project scheduler built with:
- **React + Vite** (frontend)
- **Supabase** (Postgres database + REST API)
- **Vercel** (hosting + CI/CD)
- **Tailwind CSS** (styling)

---

## Project Structure

```
fibertrack/
├── src/
│   ├── App.jsx           ← Main application (all UI)
│   ├── api.js            ← Supabase data access layer
│   ├── supabaseClient.js ← Supabase client singleton
│   ├── main.jsx          ← React entry point
│   └── index.css         ← Tailwind directives
├── supabase/
│   └── migration.sql     ← Run this once in Supabase SQL Editor
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json           ← Zero-config Vercel deployment
├── .env.example          ← Copy to .env and fill in your keys
└── package.json
```

---

## Step 1 — Set Up Supabase (free tier)

1. Go to **https://supabase.com** and create a free account
2. Click **New Project** → choose a name (e.g. `fibertrack`) and a strong database password → **Create Project**
3. Wait ~2 minutes for the project to spin up
4. In the left sidebar go to **SQL Editor** → **New Query**
5. Paste the entire contents of `supabase/migration.sql` and click **Run**
   - This creates the `tasks` and `permits` tables and seeds the sample project data
6. Go to **Settings → API** and copy:
   - **Project URL** → looks like `https://abcdefgh.supabase.co`
   - **anon / public** key → a long JWT string

---

## Step 2 — Configure Environment Variables Locally

```bash
# In the project root, copy the example file
cp .env.example .env

# Edit .env and paste your Supabase values:
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> ⚠️ Never commit `.env` to git — it's already in `.gitignore`

---

## Step 3 — Run Locally

```bash
# Install dependencies
npm install

# Start the dev server
npm run dev
```

Open **http://localhost:3000** — you should see FiberTrack Pro with live data from Supabase.

---

## Step 4 — Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit — FiberTrack Pro"

# Create a new repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/fibertrack.git
git push -u origin main
```

---

## Step 5 — Deploy to Vercel

1. Go to **https://vercel.com** and sign in with GitHub
2. Click **Add New → Project**
3. Select your `fibertrack` repository and click **Import**
4. Vercel auto-detects Vite — no framework settings to change
5. Before clicking **Deploy**, expand **Environment Variables** and add:

   | Name                    | Value                                  |
   |-------------------------|----------------------------------------|
   | `VITE_SUPABASE_URL`     | `https://your-project-id.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY`| `your-anon-key-here`                  |

6. Click **Deploy** — Vercel builds and publishes in ~60 seconds
7. You'll get a live URL like `https://fibertrack-abc123.vercel.app`

**Every `git push` to `main` triggers an automatic redeploy.** ✅

---

## Ongoing: Adding Teammates

Since the current Row-Level Security policy is open (any anonymous user can read/write), you can share the Vercel URL with your team immediately. 

When you're ready to lock it down with user accounts:

1. In Supabase, go to **Authentication → Providers** and enable Email
2. Wrap the React app in a Supabase auth flow
3. Update the RLS policies in `migration.sql` to:
   ```sql
   -- Only authenticated users
   create policy "Auth users only" on public.tasks
     for all using (auth.role() = 'authenticated');
   ```

---

## Environment Variables Reference

| Variable                | Required | Description                          |
|-------------------------|----------|--------------------------------------|
| `VITE_SUPABASE_URL`     | ✅ Yes   | Your Supabase project URL            |
| `VITE_SUPABASE_ANON_KEY`| ✅ Yes   | Supabase anon/public API key         |

---

## Cost

| Service  | Free Tier                                     |
|----------|-----------------------------------------------|
| Supabase | 500MB DB, 2GB bandwidth, unlimited API calls  |
| Vercel   | Unlimited deploys, 100GB bandwidth/month      |

**Total cost to run this: $0/month** until you scale significantly.

---

## Troubleshooting

**"Missing Supabase env vars" error**
→ Make sure your `.env` file exists and both variables are set. Restart `npm run dev` after editing `.env`.

**Data not saving / 401 errors**
→ Check that you ran `migration.sql` in Supabase and that your anon key is correct.

**Vercel build fails**
→ Check that environment variables are set in the Vercel project settings (not just locally).

**Blank screen in production**
→ The `vercel.json` `rewrites` rule handles client-side routing — make sure it wasn't deleted.
