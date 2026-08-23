import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'student';
  created_at: string;
  updated_at: string;
}

export interface Test {
  id: string;
  title: string;
  description: string;
  duration: number;
  time_per_question?: number; // Exact seconds per question, prevents rounding errors
  start_date: string;
  end_date: string;
  is_active: boolean;
  negative_marking_enabled?: boolean; // When true, students lose marks for wrong answers
  default_marks?: number; // Default marks for new questions
  negative_marks?: number; // Marks to deduct for wrong answers (e.g. 0.25, 1)
  created_by: string;
  created_at: string;
  updated_at: string;
  questions?: Question[];
  creator?: Profile;
}

export interface Question {
  id: string;
  test_id: string;
  question_text: string;
  options: string[];
  correct_answer: number;
  order_index: number;
  marks?: number; // Point value for this question (default 1)
  section?: string; // e.g. 'C++', 'Python', 'General'
  created_at: string;
}

export interface Review {
  id: string;
  user_id: string;
  name: string;
  role: string;
  rating: number;
  comment: string;
  created_at: string;
  updated_at: string;
}

export interface TestResult {
  id: string;
  test_id: string;
  student_id: string;
  score: number;
  total_questions: number;
  time_taken: number;
  answers: number[];
  completed_at: string;
  created_at: string;
  test?: Test;
  student?: Profile;
}