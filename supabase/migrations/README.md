# GradePulse — Supabase Migrations

All schema changes, RLS policies, triggers, and RPC functions live here as numbered SQL files. Each file is **idempotent** (uses `create … if not exists`, `create or replace`, `drop policy if exists` patterns) so re-running is safe.

## How to apply

### Fresh Supabase project

1. Create a new project sa https://supabase.com
2. Open the **SQL Editor** sa Supabase dashboard
3. Open each `.sql` file **in order** (lowest number first), paste sa editor, click **Run**
4. Copy the project URL + anon key into your `.env.local`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. Bootstrap the first admin (sign up via the app, then sa SQL editor):
   ```sql
   update public.users set role = 'admin' where email = 'you@example.com';
   ```

### Existing project — apply new migrations only

When you pull new migrations from this repo, run only the new files (the highest-numbered ones) sa SQL editor.

## V1 migrations (already applied to the live Supabase project)

| File | Purpose |
|---|---|
| `0001_initial.sql` | Base schema (13 tables), RLS, triggers, RPCs for grade computation |
| `0002_role_helpers.sql` | `set_user_role()` + `get_user_directory()` RPCs for admin user management |
| `0003_audit_view.sql` | `get_audit_logs()` + `count_audit_logs()` enriched with names |
| `0004_fix_rls_recursion.sql` | SECURITY DEFINER helpers to break RLS infinite recursion |
| `0005_appeals_notify.sql` | Trigger to notify student when their appeal is resolved |
| `0006_fix_join_class_ambiguity.sql` | `#variable_conflict use_column` for PL/pgSQL output param conflict |
| `0007_users_visibility.sql` | `can_see_user()` so teachers/students can read names of class-mates |
| `0008_student_leave_class.sql` | RLS policy allowing students to unenroll themselves |

## V2 migrations (Phase A / B / C — added incrementally)

V2 introduces new roles (`department_head`, `parent`), tables (`departments`, `parent_students`, `grade_change_requests`, `score_comments`, `attendance`), and extends the existing RPCs. Each V2 migration starts at `0009_…` and depends on the V1 chain above.

| File | Purpose |
|---|---|
| `0009_departments_and_roles.sql` | `departments` table, `department_head` + `parent` role values, dept-scoped RLS, dept_head helpers, expanded `can_see_user()` |
| `0010_parent_links.sql` | `parent_students` linkage table, parent-scoped RLS on student data, `is_parent_of()` + `parent_can_see_class()` helpers |
| `0011_grade_change_requests.sql` | `grade_change_requests` table, `request_grade_change()` + `review_grade_change()` RPCs, updates the lock trigger to honor an approval-bypass session flag |
| `0012_role_helpers_v2.sql` | Updates `set_user_role()` + `get_user_directory()` to support `department_head` and `parent` roles + the `departments.head_id` linkage |
| `0013_score_comments.sql` | `score_comments` table (score-level or item-level), RLS for all roles, notification trigger on insert, realtime |
| `0014_fix_v2_rls_recursion.sql` | Fixes infinite RLS recursion in `grade_categories` / `grade_items` / `scores` / `score_comments` policies introduced by 0009 + 0010 (was breaking categories add + Appeals tab) |
| `0015_attendance.sql` | `attendance` table (date + status per student/class), RLS, `get_attendance_summary()` RPC, realtime |
| `0016_analytics_rpcs.sql` | `compute_cgpa()` + `is_dean_list_eligible()` + `compute_risk_level()` + admin count RPCs for V2 analytics surfaces |
| `0017_view_student_authz.sql` | `can_view_student()` guard baked into the 4 student-scoped analytics RPCs so they can't be called for unauthorized students |
| `0018_bias_signals.sql` | `compute_bias_signals()` RPC — read-only statistical anomaly flags for admins (system-wide) + department heads (dept-scoped) |
| `0019_security_hardening.sql` | Lock-bypass now requires admin/dept_head actor; pins `search_path` on every SECURITY DEFINER function (anti search-path hijack) |

## Convention

- File names: `NNNN_short_description.sql`
- Always `idempotent` patterns:
  - `create table if not exists`
  - `create or replace function`
  - `drop policy if exists … create policy …`
  - `alter table … add column if not exists`
- One logical change per migration (avoid mixing unrelated DDL)
- Include a top comment explaining **why** the migration exists, not just what it does
