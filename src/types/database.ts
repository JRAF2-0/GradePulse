/**
 * Supabase database types.
 *
 * Matches the pattern that `supabase gen types typescript` produces, so the
 * client correctly infers .from() / .rpc() shapes.
 *
 * REGENERATE after every migration with:
 *   npx supabase gen types typescript --project-id <your-project-id> > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole =
  | 'pending'
  | 'student'
  | 'teacher'
  | 'admin'
  | 'department_head'
  | 'parent';
export type Period = 'midterm' | 'finals';
export type Semester = '1st' | '2nd' | 'summer';
export type ScoreStatus = 'graded' | 'missing' | 'late' | 'excused';
export type AppealStatus = 'pending' | 'approved' | 'rejected';
export type GradeChangeStatus = 'pending' | 'approved' | 'rejected';
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type RiskLevel = 'low' | 'medium' | 'high';
export type BiasSignalType =
  | 'below_dept_avg'
  | 'section_divergence'
  | 'high_fail_rate'
  | 'entry_burst';

export interface BiasSignal {
  signal_type: BiasSignalType;
  class_id: string;
  subject_code: string;
  subject_title: string;
  section: string | null;
  teacher_name: string | null;
  department_name: string | null;
  metric: number;
  benchmark: number;
  detail: string;
}
export type NotificationType =
  | 'grade_posted'
  | 'grade_changed'
  | 'appeal_approved'
  | 'appeal_rejected'
  | 'low_average'
  | 'role_assigned'
  | 'enrolled'
  | 'grade_change_approved'
  | 'grade_change_rejected'
  | 'comment_added';
export type AuditAction =
  | 'insert'
  | 'update'
  | 'delete'
  | 'publish'
  | 'lock'
  | 'grade_change_approved'
  | 'grade_change_rejected';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type CivilStatus = 'single' | 'married' | 'widowed' | 'separated' | 'divorced';

export interface DbUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  birthdate: string | null;
  gender: Gender | null;
  address: string | null;
  avatar_url: string | null;
  civil_status: CivilStatus | null;
  nationality: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  address_street: string | null;
  address_city: string | null;
  address_province: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  updated_at: string | null;
  created_at: string;
}

export interface DbStudent {
  id: string;
  user_id: string;
  student_no: string | null;
  course: string | null;
  year_level: number | null;
  section: string | null;
}

export interface DbTeacher {
  id: string;
  user_id: string;
  employee_no: string | null;
  department: string | null;
  department_id: string | null;
}

export interface DbDepartment {
  id: string;
  code: string;
  name: string;
  head_id: string | null;
  created_at: string;
}

export interface DbParentStudent {
  id: string;
  parent_id: string;
  student_id: string;
  relationship: string | null;
  created_at: string;
}

export interface DbAttendance {
  id: string;
  class_id: string;
  student_id: string;
  attended_at: string;
  status: AttendanceStatus;
  remarks: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendance_pct: number;
}

export interface DbScoreComment {
  id: string;
  score_id: string | null;
  grade_item_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface DbGradeChangeRequest {
  id: string;
  score_id: string;
  requested_by: string;
  old_score: number | null;
  new_score: number | null;
  reason: string;
  status: GradeChangeStatus;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface DbSubject {
  id: string;
  code: string;
  title: string;
  units: number | null;
  department_id: string | null;
}

export interface DbClass {
  id: string;
  subject_id: string;
  teacher_id: string;
  semester: Semester;
  school_year: string;
  section: string | null;
  class_code: string;
  is_archived: boolean;
  created_at: string;
}

export interface DbEnrollment {
  id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
}

export interface DbGradeCategory {
  id: string;
  class_id: string;
  name: string;
  weight: number;
  period: Period;
}

export interface DbGradeItem {
  id: string;
  category_id: string;
  title: string;
  max_score: number;
  due_date: string | null;
  is_published: boolean;
}

export interface DbScore {
  id: string;
  student_id: string;
  grade_item_id: string;
  score: number | null;
  status: ScoreStatus;
  remarks: string | null;
  is_draft: boolean;
  updated_at: string;
  updated_by: string | null;
}

export interface DbFinalizedGrade {
  id: string;
  class_id: string;
  student_id: string;
  period: Period;
  percentage: number;
  numeric_grade: number;
  remarks: string;
  locked_at: string;
  locked_by: string;
}

export interface DbAppeal {
  id: string;
  score_id: string;
  student_id: string;
  reason: string;
  status: AppealStatus;
  teacher_response: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface DbNotification {
  id: string;
  user_id: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  related_class_id: string | null;
  created_at: string;
}

export interface DbAuditLog {
  id: string;
  actor_id: string | null;
  action: AuditAction;
  target_type: string;
  target_id: string;
  old_value: Json | null;
  new_value: Json | null;
  created_at: string;
}

interface PeriodGradeReturn {
  percentage: number;
  numeric_grade: number;
  remarks: string;
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: DbUser;
        Insert: Partial<DbUser> & { id: string; email: string; full_name: string };
        Update: Partial<DbUser>;
        Relationships: [];
      };
      students: {
        Row: DbStudent;
        Insert: Partial<DbStudent> & { user_id: string };
        Update: Partial<DbStudent>;
        Relationships: [];
      };
      teachers: {
        Row: DbTeacher;
        Insert: Partial<DbTeacher> & { user_id: string };
        Update: Partial<DbTeacher>;
        Relationships: [];
      };
      subjects: {
        Row: DbSubject;
        Insert: Partial<DbSubject> & { code: string; title: string };
        Update: Partial<DbSubject>;
        Relationships: [];
      };
      classes: {
        Row: DbClass;
        Insert: Partial<DbClass> & {
          subject_id: string;
          teacher_id: string;
          semester: Semester;
          school_year: string;
        };
        Update: Partial<DbClass>;
        Relationships: [];
      };
      enrollments: {
        Row: DbEnrollment;
        Insert: Partial<DbEnrollment> & { class_id: string; student_id: string };
        Update: Partial<DbEnrollment>;
        Relationships: [];
      };
      grade_categories: {
        Row: DbGradeCategory;
        Insert: Partial<DbGradeCategory> & {
          class_id: string;
          name: string;
          weight: number;
          period: Period;
        };
        Update: Partial<DbGradeCategory>;
        Relationships: [];
      };
      grade_items: {
        Row: DbGradeItem;
        Insert: Partial<DbGradeItem> & {
          category_id: string;
          title: string;
          max_score: number;
        };
        Update: Partial<DbGradeItem>;
        Relationships: [];
      };
      scores: {
        Row: DbScore;
        Insert: Partial<DbScore> & { student_id: string; grade_item_id: string };
        Update: Partial<DbScore>;
        Relationships: [];
      };
      finalized_grades: {
        Row: DbFinalizedGrade;
        Insert: Partial<DbFinalizedGrade>;
        Update: Partial<DbFinalizedGrade>;
        Relationships: [];
      };
      appeals: {
        Row: DbAppeal;
        Insert: Partial<DbAppeal> & {
          score_id: string;
          student_id: string;
          reason: string;
        };
        Update: Partial<DbAppeal>;
        Relationships: [];
      };
      notifications: {
        Row: DbNotification;
        Insert: Partial<DbNotification> & {
          user_id: string;
          message: string;
          type: NotificationType;
        };
        Update: Partial<DbNotification>;
        Relationships: [];
      };
      audit_logs: {
        Row: DbAuditLog;
        Insert: Partial<DbAuditLog>;
        Update: Partial<DbAuditLog>;
        Relationships: [];
      };
      departments: {
        Row: DbDepartment;
        Insert: Partial<DbDepartment> & { code: string; name: string };
        Update: Partial<DbDepartment>;
        Relationships: [];
      };
      parent_students: {
        Row: DbParentStudent;
        Insert: Partial<DbParentStudent> & { parent_id: string; student_id: string };
        Update: Partial<DbParentStudent>;
        Relationships: [];
      };
      grade_change_requests: {
        Row: DbGradeChangeRequest;
        Insert: Partial<DbGradeChangeRequest> & {
          score_id: string;
          requested_by: string;
          reason: string;
        };
        Update: Partial<DbGradeChangeRequest>;
        Relationships: [];
      };
      score_comments: {
        Row: DbScoreComment;
        Insert: Partial<DbScoreComment> & { author_id: string; body: string };
        Update: Partial<DbScoreComment>;
        Relationships: [];
      };
      attendance: {
        Row: DbAttendance;
        Insert: Partial<DbAttendance> & {
          class_id: string;
          student_id: string;
          attended_at: string;
          status: AttendanceStatus;
        };
        Update: Partial<DbAttendance>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      join_class_by_code: {
        Args: { p_class_code: string };
        Returns: { class_id: string; subject_code: string; subject_title: string }[];
      };
      convert_percentage_to_numeric: {
        Args: { pct: number };
        Returns: number;
      };
      compute_period_grade: {
        Args: { p_class_id: string; p_student_id: string; p_period: Period };
        Returns: PeriodGradeReturn[];
      };
      compute_final_grade: {
        Args: { p_class_id: string; p_student_id: string };
        Returns: PeriodGradeReturn[];
      };
      compute_gpa: {
        Args: { p_student_id: string; p_school_year: string; p_semester: Semester };
        Returns: number;
      };
      finalize_period: {
        Args: { p_class_id: string; p_period: Period };
        Returns: number;
      };
      set_user_role: {
        Args: {
          p_user_id: string;
          p_role: UserRole;
          p_student_no?: string | null;
          p_course?: string | null;
          p_year_level?: number | null;
          p_section?: string | null;
          p_employee_no?: string | null;
          p_department?: string | null;
          p_department_id?: string | null;
        };
        Returns: undefined;
      };
      get_user_directory: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          created_at: string;
          student_no: string | null;
          course: string | null;
          year_level: number | null;
          section: string | null;
          employee_no: string | null;
          department: string | null;
          department_id: string | null;
          department_code: string | null;
          department_name: string | null;
          is_department_head: boolean;
        }[];
      };
      request_grade_change: {
        Args: { p_score_id: string; p_new_score: number; p_reason: string };
        Returns: string;
      };
      review_grade_change: {
        Args: {
          p_request_id: string;
          p_decision: 'approve' | 'reject';
          p_review_note?: string | null;
        };
        Returns: undefined;
      };
      get_attendance_summary: {
        Args: { p_class_id: string; p_student_id: string };
        Returns: AttendanceSummary[];
      };
      compute_cgpa: {
        Args: { p_student_id: string };
        Returns: number;
      };
      is_dean_list_eligible: {
        Args: {
          p_student_id: string;
          p_school_year: string;
          p_semester: Semester;
        };
        Returns: boolean;
      };
      compute_risk_level: {
        Args: { p_student_id: string; p_class_id?: string | null };
        Returns: RiskLevel;
      };
      compute_bias_signals: {
        Args: Record<string, never>;
        Returns: BiasSignal[];
      };
      count_high_risk_students: {
        Args: Record<string, never>;
        Returns: number;
      };
      count_deans_list_current_term: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_audit_logs: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_action?: string | null;
          p_target_type?: string | null;
        };
        Returns: {
          id: string;
          created_at: string;
          action: AuditAction;
          target_type: string;
          target_id: string;
          old_value: Json | null;
          new_value: Json | null;
          actor_id: string | null;
          actor_name: string | null;
          actor_email: string | null;
          student_name: string | null;
          item_title: string | null;
        }[];
      };
      count_audit_logs: {
        Args: {
          p_action?: string | null;
          p_target_type?: string | null;
        };
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
