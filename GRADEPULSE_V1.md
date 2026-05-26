# GradePulse V1
## Real-Time Academic Transparency and Grade Monitoring System

---

# Project Overview

GradePulse is a web-based academic transparency platform designed to help students, teachers, and administrators manage, monitor, and review academic grades in real time.

The system aims to improve:
- Grade transparency
- Fairness
- Real-time monitoring
- Secure academic record handling
- Accurate grade computation

---

# Tech Stack

## Frontend
- React.js (Vite)
- TypeScript
- TailwindCSS
- React Router DOM

## Backend / BaaS
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Realtime
- Row Level Security (RLS)

## Development
- VS Code
- Git / GitHub

---

# Version
V1 (MVP - Production Ready Foundation)

---

# Core Problem Statement

Many universities still lack transparent and real-time grade visibility for students.

Common issues:
- Delayed grade posting
- Unclear grade computation
- No live grade monitoring
- Manual grade errors
- Limited teacher accountability
- Lack of audit visibility

GradePulse solves this by creating a live and transparent grading platform.

---

# User Roles

## Student
Can:
- View own grades
- View subject breakdown
- Track average
- Download reports
- Receive notifications

Cannot:
- Edit grades

---

## Teacher
Can:
- Manage assigned classes
- Create grade items
- Enter scores
- Edit scores
- Publish grades
- Review appeals

Cannot:
- Modify system settings

---

## Admin
Can:
- Manage users
- Manage semesters
- Manage subjects
- Manage grade rules
- View audit logs
- System monitoring

---

# V1 Core Modules

## 1. Authentication & Security
Features:
- Login
- Session handling
- Password reset
- Protected routes
- Role-based access
- Secure auth

---

## 2. Role-Based Access Control (RBAC)
Roles:
- Student
- Teacher
- Admin

Rules:
- Students only access own grades
- Teachers only access assigned classes
- Admin controls entire system

---

## 3. Student Dashboard
Features:
- Current average
- GPA overview
- Subject list
- Grade breakdown
- Grade trend
- Passing / At Risk / Failing indicator
- Notifications

---

## 4. Teacher Dashboard
Features:
- Class overview
- Student list
- Pending grading
- Draft grades
- Publish grades
- Appeals

---

## 5. Subject & Class Management
Features:
- Create subjects
- Assign teachers
- Assign sections
- Semester handling
- School year handling
- Enrollment mapping

---

## 6. Grade Category Management
Examples:
- Quiz
- Assignment
- Attendance
- Midterm
- Final Exam
- Project

Features:
- Weight percentages
- Flexible grading setup

---

## 7. Grade Item Management
Examples:
- Quiz 1
- Quiz 2
- Midterm Exam
- Final Exam

Features:
- Max score
- Due date
- Publish state
- Category linking

---

## 8. Score Entry System
Features:
- Single score input
- Bulk input
- Edit score
- Save draft
- Missing / Late / Excused status

---

## 9. Grade Computation Engine
Responsible for:
- Weighted computation
- Average computation
- Midterm calculation
- Final calculation
- Grade remarks
- Locking finalized grades

---

## 10. Real-Time Updates
Features:
- Live score updates
- Auto dashboard refresh
- Instant data sync

Powered by:
- Supabase Realtime

---

## 11. Notifications
Examples:
- Grade posted
- Grade changed
- Appeal approved
- Low average alert
- Draft pending

---

## 12. Audit Logs
Tracks:
- Who changed
- What changed
- Old value
- New value
- Timestamp

Critical for transparency.

---

## 13. Reports & Export
Features:
- Student grade summary
- Midterm report
- Final report
- CSV export
- PDF export

---

## 14. Basic Admin Panel
Manage:
- Students
- Teachers
- Departments
- Semesters
- School year
- Grade rules
- Logs

---

## 15. Security Hardening
Must have:
- Supabase Auth
- Password security
- RLS
- Route protection
- Input validation
- Sanitization
- Secure env handling

---

# Database Design (V1)

## users
- id
- email
- full_name
- role
- created_at

---

## students
- id
- user_id
- student_no
- course
- year_level
- section

---

## teachers
- id
- user_id
- employee_no
- department

---

## subjects
- id
- code
- title
- units

---

## classes
- id
- subject_id
- teacher_id
- semester
- school_year
- section

---

## enrollments
- id
- class_id
- student_id

---

## grade_categories
- id
- class_id
- name
- weight

---

## grade_items
- id
- category_id
- title
- max_score
- due_date
- is_published

---

## scores
- id
- student_id
- grade_item_id
- score
- remarks
- updated_at

---

## notifications
- id
- user_id
- message
- is_read

---

## audit_logs
- id
- actor_id
- action
- target_type
- old_value
- new_value
- created_at

---

# Core Relationships

Teacher
→ owns many Classes

Subject
→ belongs to many Classes

Class
→ has many Students

Class
→ has many Grade Categories

Category
→ has many Grade Items

Grade Item
→ has many Scores

Student
→ has many Scores

---

# Development Roadmap (V1)

## Phase 1
Project Setup
- Vite
- TypeScript
- Tailwind
- Folder architecture

---

## Phase 2
Supabase Setup
- Auth
- Database
- Environment variables
- Connection layer

---

## Phase 3
Authentication + RBAC

---

## Phase 4
Core Academic Models
- Subjects
- Classes
- Enrollments

---

## Phase 5
Grading Engine
- Categories
- Grade items
- Scores
- Computation

---

## Phase 6
Dashboards
- Student
- Teacher
- Admin

---

## Phase 7
Realtime + Notifications

---

## Phase 8
Audit Logs + Reports

---

## Phase 9
Testing + Refactor + Deploy

---

# Success Criteria (V1)
Project is considered complete when:
- Students can view grades live
- Teachers can manage grading
- Admin can manage system
- Grade computation is accurate
- Real-time updates work
- Roles are secured
- Audit logs track changes
- Reports can be exported

---

# V1 Goal
Build a secure, scalable, production-level academic transparency platform using React + Supabase.