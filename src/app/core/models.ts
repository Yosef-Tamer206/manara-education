export interface Profile {
  id: string;
  full_name: string;
  role: 'teacher' | 'student';
  approved: boolean;
  grade: string | null;
  created_at?: string;
}

export interface CatalogCourse {
  id: string;
  title: string;
  grade: string;
  cover_url: string | null;
  lessons: string[] | null;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  grade: string;
  cover_url: string | null;
  published: boolean;
}

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  video_url: string | null;
  body: string;
  position: number;
}

export interface QuizQuestion {
  id: string;
  lesson_id: string;
  question: string;
  options: string[];
}

export interface AdminQuizQuestion extends QuizQuestion {
  correct: number;
}

export interface Homework {
  id: string;
  student_id: string;
  lesson_id: string;
  content: string;
  submitted_at: string;
}

export interface Announcement {
  id: string;
  body: string;
  created_at: string;
}

export interface QuizResult {
  score: number;
  total: number;
  taken_at: string;
}

export interface Subscription {
  id: string;
  student_id: string;
  student_name: string;
  plan: 'month' | 'lesson';
  lesson_id: string | null;
  lesson_title: string | null;
  amount: number;
  reference: string;
  receipt_path: string | null;
  status: 'active' | 'rejected' | 'revoked';
  reject_reason: string | null;
  starts_at: string | null;
  ends_at: string | null;
  confirmed_at: string | null;
  created_at: string;
  live: boolean;
  /** When access really ends (null = no end). Earlier than ends_at while the teacher has not confirmed the transfer. */
  effective_end: string | null;
}

export interface CatalogLesson {
  course_id: string;
  course_title: string;
  grade: string;
  lesson_id: string;
  title: string;
  position: number;
  unlocked: boolean;
}

export interface BotDecision {
  ok: boolean;
  code?: string;
  message?: string;
  ends_at?: string | null;
  unconfirmed_hours?: number;
}

export interface PaymentSettings {
  price_month: string;
  price_lesson: string;
  payment_number: string;
  payment_methods: string;
  unconfirmed_hours: string;
}
