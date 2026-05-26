# GradePulse

Real-time academic transparency and grade monitoring system built with React (Vite) + TypeScript + Tailwind + Supabase.

## Quick Start

### 1. Install dependencies

```powershell
npm install
```

### 2. Create a Supabase project

1. Go to https://supabase.com and create a new project.
2. In the SQL editor, paste and run `supabase/migrations/0001_initial.sql`.
3. Copy your project URL and anon key from Project Settings → API.

### 3. Configure environment

Copy `.env.example` to `.env.local` and fill in:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 4. Run dev server

```powershell
npm run dev
```

Open http://localhost:5173.

### 5. Bootstrap your first admin

After signing up the first time, manually promote the account via Supabase SQL editor:

```sql
update public.users set role = 'admin' where email = 'your-email@example.com';
```

From there, log in as that admin and approve future signups via `/admin/users`.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS, React Router DOM
- **Backend:** Supabase (Postgres, Auth, Realtime, Row Level Security)
- **Reports:** jsPDF + jspdf-autotable (PDF), native Blob (CSV)
- **Charts:** Recharts

## Project Structure

```
src/
├── lib/          # Supabase client
├── types/        # Database types
├── context/      # Auth context
├── hooks/        # Data hooks
├── components/   # Shared UI
├── pages/        # Route components (auth, student, teacher, admin)
└── utils/        # Conversion table, CSV/PDF helpers

supabase/
└── migrations/   # SQL schema, RLS, triggers, RPC
```

## Roles

- **Pending** — Just signed up, awaiting admin approval.
- **Student** — View own grades, join classes by code, file appeals.
- **Teacher** — Manage assigned classes, enter scores, publish grades.
- **Admin** — Manage users, subjects, audit logs, system settings.

## Roadmap

See `GRADEPULSE_V1.md` for the V1 spec.
