# Roles & Bias Detection — GradePulse

A practical reference for what each role can do, where their controls live in the app, and how the platform surfaces fairness signals to admins and department heads.

---

## Roles at a glance

| Role | Purpose | Primary surface |
|---|---|---|
| **Student** | View grades, attendance, appeal scores | `/student` |
| **Teacher** | Run a class — categories, scores, attendance, comments | `/teacher` |
| **Department Head** | Approve grade-change requests, review bias signals (dept-scoped) | `/department-head` |
| **Admin** | System owner — users, roles, audit, bias signals (system-wide) | `/admin` |
| **Parent** | Read-only window into linked children's grades + attendance | `/parent` |
| **Pending** | Awaiting role assignment from admin | `/pending` |

---

## Student

**Purpose.** Transparency into the student's own academic record.

**Can do.**
- Join a class via a teacher-issued class code.
- View per-period grades (Midterm / Finals / Final) with the PH equivalent.
- See CGPA and Dean's List eligibility for the current term.
- See own Risk Level (Low / Medium / High) on the dashboard.
- View attendance summary per class (% present, late, absent, excused).
- Read teacher comments tied to individual scores or grade items.
- File appeals on any specific score, with a written reason.
- Download a semester transcript as PDF.
- Explore analytics — grade trend over time, performance by category, contribution pie, and a per-period summary table.

**Cannot do.**
- See another student's grades or scores.
- Edit their own scores or change a published grade.
- Modify class structure (categories, items, weights).

**Where in the app.** `/student/*` — Dashboard, My Classes, Join Class, Analytics, Reports.

---

## Teacher

**Purpose.** Run a class end-to-end and enter grades fairly.

**Can do.**
- Create classes; a join code is generated automatically.
- Configure grade categories per period; the platform enforces weights summing to 100% before scores can be entered.
- Create grade items inside each category (quizzes, activities, exams).
- Enter and publish scores; mark items as `graded`, `missing`, `late`, or `excused`.
- Mark daily attendance with a per-day roster view.
- Add comments per score or per grade item — students see them next to their grade.
- Finalize / lock a period when grading is complete.
- File a grade-change request after a period is locked (the only post-lock edit path).
- Export per-class reports.

**Cannot do.**
- Assign roles or manage users.
- Bypass the lock on a finalized period — every post-lock change goes through Department Head approval.
- See classes they don't teach.

**Where in the app.** `/teacher/*` — Dashboard, My Classes, Reports. Each class detail page has Roster, Grades, Attendance, Comments, and Reports tabs.

---

## Department Head

**Purpose.** Quality gate for any grade change after lock, and first-line bias monitor for the department.

**Can do.**
- Read all classes, scores, and finalized grades within their department.
- Approve or reject teachers' grade-change requests — the only path to edit a score in a finalized period.
- View bias signals scoped to their department's classes.
- Teach classes too — a Department Head also holds a `teachers` row, so they can run sections like any teacher.

**Cannot do.**
- Approve grade changes outside their own department.
- Assign roles.
- See system-wide bias signals (only what's in their department).

**Where in the app.** `/department-head/*` — Dashboard, Approvals, Bias Signals.

---

## Admin

**Purpose.** System owner — controls who joins, who teaches what, who leads which department, and watches for anomalies across the institution.

**Can do.**
- Approve pending users and assign roles (Student / Teacher / Department Head / Parent / Admin).
- Create and maintain subjects, classes, departments.
- Link parents to one or more students.
- Resolve student appeals as an escalation tier (above the teacher).
- View the full audit log of every score change (who changed what, when, old vs new value).
- View bias signals across the whole institution.
- Read system counters — high-risk students, current-term Dean's List, pending approvals, open appeals.

**Cannot do.**
- Quietly rewrite a teacher's grade entries — every write the admin makes is still audit-logged and surfaced under Audit Logs, and the same Department-Head approval bypass guard applies.

**Where in the app.** `/admin/*` — Dashboard, Users, Departments, Subjects, Classes, Appeals, Bias Signals, Parent Links, Audit Logs.

---

## Parent

**Purpose.** A read-only window into one or more linked children's academic life — designed for guardians who want to follow along without interfering.

**Can do.**
- See the list of children linked to their account by an admin.
- For each linked child, view the same grade overview, attendance, finalized grades, and notifications the child sees on their own dashboard.

**Cannot do.**
- Edit anything anywhere in the app.
- See children they aren't explicitly linked to (RLS enforces this row-by-row).
- File appeals on behalf of a child.

**Where in the app.** `/parent` — dashboard with a card per linked child, each linking through to a child-detail mirror of the student dashboard.

---

## Pending

**Purpose.** Holding state immediately after signup, before an admin assigns a role.

**Can do.**
- Fill out personal info while waiting — phone, birthdate, gender, civil status, nationality, address, emergency contact, and avatar.

**Cannot do.**
- Access any role dashboard or any class data.

**Where in the app.** `/pending`.

---

## How GradePulse surfaces bias and bad signals

GradePulse does **not** automatically accuse anyone. It computes statistical flags that admins and department heads can review. Every signal is a **prompt to look closer**, never a conclusion.

All signals are computed from **finalized `finals`-period grades** so incomplete terms don't generate noise. Source: `compute_bias_signals()` RPC in [`supabase/migrations/0018_bias_signals.sql`](../supabase/migrations/0018_bias_signals.sql).

**Who sees what.**
- **Admins** — system-wide signals at `/admin/bias-signals`.
- **Department Heads** — signals filtered to their own department at `/department-head/bias-signals`.

### Signal 1 — `below_dept_avg`

A teacher's class average is more than **1 standard deviation below the mean of all finalized classes in the department**. Only triggers when the department has at least 3 finalized classes and a non-zero spread — small departments don't false-flag.

> **What it might mean.** Unusually hard grading, a mismatch between class difficulty and department norms, or a real cohort issue. Worth a one-on-one with the teacher before any judgement.

### Signal 2 — `section_divergence`

A section's average is **more than 10 percentage points below other sections of the same subject and the same teacher**.

> **What it might mean.** The same teacher is grading their own sections inconsistently. Often the cleanest evidence of differential treatment because both subject and teacher are held constant.

### Signal 3 — `high_fail_rate`

**At least 30% of students in the class have a failing final grade.**

> **What it might mean.** Systemic difficulty, weak onboarding, or a pass bar far from institutional norms. The action is usually a conversation, not a penalty.

### Signal 4 — `entry_burst`

**More than 50 score writes (inserts or updates) on a single class in a single day** — detected from `audit_logs`.

> **What it might mean.** A possible bulk override around finalization. Cross-check the audit log to see whether the writes were legitimate term-end bulk entry or a sudden mass adjustment.

---

## Risk Level — student-side early warning

Distinct from bias signals: the per-student **Risk Level badge** (`compute_risk_level()` in [`0016_analytics_rpcs.sql`](../supabase/migrations/0016_analytics_rpcs.sql)) is a rule-based early warning shown on the student's own dashboard and to their teacher on the roster.

- **High Risk** — ≥ 3 failing scores in any class, **OR** overall average < 70%, **OR** attendance < 60%.
- **Medium Risk** — 1–2 failing scores, **OR** average 70–75%, **OR** attendance 60–75%.
- **Low Risk** — none of the above.

The rules are deliberately transparent so students aren't surprised by an opaque "algorithm."

---

## Responding to a signal

A signal is the start of a conversation, not the end. Recommended sequence:

1. **Open the class.** Check the grade distribution, the categories' weights, recent grade-change requests, and any teacher comments.
2. **Pull the audit log** for that class at `/admin/audit`. Look for patterns: bulk edits at unusual times, repeated targeting of the same students.
3. **Talk to the teacher** before any action. Many signals have legitimate explanations — a hard term, an honors section, a make-up assessment week.
4. **Document the outcome** — either dismiss with a note, route a re-grade through the Department-Head approval flow, or escalate per institution policy.

Never treat a signal as a sanction. The platform's job is to make patterns visible; the people's job is to interpret them fairly.

---

## References

- Spec authority: [`GRADEPULSE_V1.md`](../GRADEPULSE_V1.md), [`V2_FEATURES.md`](../V2_FEATURES.md).
- Schema and rule source of truth: [`supabase/migrations/`](../supabase/migrations/).
- Per-role nav surfaces (authoritative list of routes per role): [`src/components/navConfig.ts`](../src/components/navConfig.ts).
