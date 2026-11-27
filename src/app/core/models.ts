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
