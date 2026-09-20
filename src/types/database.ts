export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Profile {
  id: string; // references auth.users
  full_name?: string | null;
  academic_group: string;
  course: string;
  created_at?: string;
  updated_at?: string;
}

export interface Subject {
  id: string;
  name: string;
  code?: string | null;
  created_at?: string;
}

export interface Teacher {
  id: string;
  name: string;
  department?: string | null;
  created_at?: string;
}

export interface ClassSchedule {
  id: string;
  academic_group: string;
  day_of_week: string; // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sun', 'Sat'
  start_time: string; // 'HH:MM'
  end_time: string; // 'HH:MM'
  room: string;
  subject_id?: string | null;
  subject_name?: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  colspan?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ClassInstance {
  id: string;
  schedule_id: string;
  class_date: string; // 'YYYY-MM-DD'
  status?: "scheduled" | "cancelled" | "completed";
  created_at?: string;
}

export interface AttendanceRecord {
  id: string;
  user_id: string;
  class_instance_id: string;
  status: "present" | "absent" | "excused";
  created_at?: string;
  updated_at?: string;
}

export interface ClassComment {
  id: string;
  schedule_id?: string | null;
  class_instance_id?: string | null;
  academic_group?: string | null;
  user_id: string;
  user_name?: string | null;
  message: string;
  created_at: string;
}

export type NoteTaskType = "reminder" | "assignment" | "bring_item" | "note";

export interface NoteAndTask {
  id: string;
  user_id: string;
  academic_group?: string | null;
  subject_id?: string | null;
  subject_name?: string | null;
  title: string;
  description?: string | null;
  type: NoteTaskType;
  due_date?: string | null;
  is_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserHoliday {
  id: string;
  user_id: string;
  holiday_date: string; // 'YYYY-MM-DD'
  academic_group?: string | null;
  title?: string | null;
  created_at?: string;
}

export interface UserSubjectAttendance {
  user_id: string;
  subject_name: string;
  total_classes: number;
  attended_classes: number;
  attendance_percentage: number;
  classes_can_skip: number;
  classes_needed_to_catchup: number;
}

