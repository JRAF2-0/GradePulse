# Academic Lens - V2 (Production-Level Expansion)

## Goal
Transform V1 from a basic grade tracking app into a full university-grade academic transparency platform.

V2 focuses on:
- fairness
- transparency
- analytics
- parent/student visibility
- scalability
- audit trails
- anti-bias mechanisms

---

# 1. Advanced Grade Analytics

## Student Performance Dashboard
Student can see:

- Midterm performance
- Final performance
- Quiz trends
- Assignment trends
- Attendance impact
- Overall GPA trend

### Charts
- Line Chart → Grade improvement over time
- Bar Chart → Quiz vs Assignment comparison
- Pie Chart → Subject weight distribution

Purpose:
Students can identify weak areas.

---

# 2. GPA / Auto Academic Computation

Automatically compute:

- Subject Final Grade
- Semester Average
- GPA
- CGPA (Cumulative GPA)
- Passed / Failed
- Dean’s List Eligibility

Example:
Quiz = 20%
Midterm = 30%
Project = 20%
Final = 30%

System auto computes final output.

No manual mistakes.

---

# 3. Grade Breakdown Transparency

Student can open a subject.

Then view:

Mathematics:
- Quiz 1 = 85
- Quiz 2 = 90
- Midterm = 87
- Attendance = 100
- Project = 92
- Final Exam = 88

Then:
Final Grade = 89.4

This solves:
"Sir/Ma'am bakit 2.5 lang po ako?"

Everything is visible.

---

# 4. Teacher Audit Trail

Every grade change is logged.

Track:
- old value
- new value
- teacher name
- reason
- timestamp

Example:
88 → 78
Reason: Wrong encoding corrected.

Purpose:
Prevents silent grade manipulation.

---

# 5. Grade Change Approval Workflow

Sensitive grade edits require approval.

Flow:
Teacher → Submit Grade Change  
Department Head → Review  
Approve / Reject

This improves fairness.

---

# 6. Bias Detection (Smart Transparency)

Detect unusual grading behavior.

System flags:

- Teacher gives unusually low grades
- One section is significantly lower than others
- Sudden mass failed students
- Extreme outlier grading

Example:
Teacher A average = 65  
University average = 82

Flag as anomaly.

(Analytics only, no accusations.)

---

# 7. Grade Appeal / Dispute System

Student can file grade concerns.

Example:
"Quiz 2 score appears missing."

Workflow:
Student → Submit Appeal  
Teacher → Review  
Admin → Resolve

Statuses:
- Pending
- Under Review
- Resolved
- Rejected

---

# 8. Notification Center

Realtime notifications.

Student gets alerts when:

- New grade posted
- Grade updated
- Appeal approved
- Appeal rejected
- Semester GPA released
- Teacher comment added

Can use Supabase Realtime.

---

# 9. Teacher Comments / Feedback

Teachers can attach comments.

Examples:
- Improve problem solving.
- Late submission.
- Great participation.
- Excellent final project.

This helps academic growth.

---

# 10. Parent Portal

Parents can monitor:

- Student grades
- Attendance
- Failed subjects
- GPA
- Alerts

Useful for universities with parent access.

---

# 11. Attendance + Grade Correlation

Show relationship between attendance and performance.

Examples:
Attendance = 95% → Grade = 90  
Attendance = 40% → Grade = 68

Useful analytics.

---

# 12. Academic Risk Prediction

Flag students at risk.

Indicators:
- GPA dropping
- Repeated absences
- Failed quizzes
- Missing requirements

Status:
- Low Risk
- Medium Risk
- High Risk

Can later evolve into AI prediction.

---

# 13. Role-Based Access Control (RBAC)

Roles:

## Student
Can:
- View grades
- Submit appeals
- View analytics

## Teacher
Can:
- Encode grades
- Add comments
- Edit records

## Department Head
Can:
- Approve grade changes
- Review anomalies

## Admin
Can:
- Full access

---

# 14. Export Reports

Download:

- PDF grade reports
- Semester transcript
- Attendance summary
- GPA summary

Good for registrar.

---

# 15. Security Improvements

Production-level security:

- Row Level Security (Supabase)
- JWT authentication
- Protected API routes
- Input validation
- Rate limiting
- Activity logs
- Secure file uploads
- Session handling

---

# 16. Realtime Grade Updates

No refresh needed.

Teacher enters grade →
Student instantly sees update.

Powered by Supabase Realtime.

---

# 17. Multi-Campus Scalability

If university has many campuses.

Support:

- Campus A
- Campus B
- Campus C

Single system.

---

# 18. Data Backup / Recovery

Prevent data loss.

Include:
- automated backups
- restore points
- version history

---

# Suggested Tech Stack V2

## Frontend
- React.js (Vite)
- TypeScript
- TailwindCSS
- React Router
- TanStack Query
- Recharts
- Zustand

## Backend
- Supabase
- PostgreSQL
- Edge Functions
- Row Level Security

## Authentication
- Supabase Auth

## Storage
- Supabase Storage

## Notifications
- Supabase Realtime

---

# Suggested Priority Order

High Priority:
1. Grade breakdown
2. Audit trail
3. Notifications
4. Grade appeals
5. Role-based access
6. GPA computation

Medium Priority:
7. Analytics
8. Teacher comments
9. Parent portal
10. Export reports

Advanced:
11. Bias detection
12. Academic risk prediction
13. Multi-campus scaling

---

# Final Vision

Academic Lens V2 becomes:

Not just a grade viewer.

It becomes a
University Academic Transparency & Fair Grading Management System.

Core value:
Transparency + Fairness + Accountability + Analytics