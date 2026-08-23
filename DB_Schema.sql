/*
  # MCQ Application Database Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, references auth.users)
      - `name` (text)
      - `email` (text)
      - `role` (enum: teacher, student)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `tests`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `duration` (integer, minutes)
      - `start_date` (timestamp)
      - `end_date` (timestamp)
      - `is_active` (boolean)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `questions`
      - `id` (uuid, primary key)
      - `test_id` (uuid, references tests)
      - `question_text` (text)
      - `options` (jsonb array)
      - `correct_answer` (integer)
      - `order_index` (integer)
      - `created_at` (timestamp)
    
    - `test_results`
      - `id` (uuid, primary key)
      - `test_id` (uuid, references tests)
      - `student_id` (uuid, references profiles)
      - `score` (numeric)
      - `total_questions` (integer)
      - `time_taken` (integer, seconds)
      - `answers` (jsonb array)
      - `completed_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on roles
    - Teachers can manage their own tests and view all results
    - Students can view available tests and their own results
*/

-- Create custom types
CREATE TYPE user_role AS ENUM ('teacher', 'student');

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create tests table
CREATE TABLE IF NOT EXISTS tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  duration integer NOT NULL DEFAULT 30,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz DEFAULT (now() + interval '7 days'),
  is_active boolean DEFAULT true,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create questions table
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]',
  correct_answer integer NOT NULL DEFAULT 0,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create test_results table
CREATE TABLE IF NOT EXISTS test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score numeric(5,2) NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 0,
  time_taken integer NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '[]',
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(test_id, student_id)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Tests policies
CREATE POLICY "Teachers can manage own tests"
  ON tests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'teacher'
      AND (tests.created_by = auth.uid() OR tests.is_active = true)
    )
  );

CREATE POLICY "Students can view active tests"
  ON tests
  FOR SELECT
  TO authenticated
  USING (
    is_active = true 
    AND start_date <= now() 
    AND end_date >= now()
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'student'
    )
  );

-- Questions policies
CREATE POLICY "Teachers can manage questions for own tests"
  ON questions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tests 
      JOIN profiles ON profiles.id = auth.uid()
      WHERE tests.id = questions.test_id 
      AND tests.created_by = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "Students can view questions for active tests"
  ON questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tests 
      JOIN profiles ON profiles.id = auth.uid()
      WHERE tests.id = questions.test_id 
      AND tests.is_active = true
      AND tests.start_date <= now() 
      AND tests.end_date >= now()
      AND profiles.role = 'student'
    )
  );

-- Test results policies
CREATE POLICY "Teachers can view results for own tests"
  ON test_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tests 
      JOIN profiles ON profiles.id = auth.uid()
      WHERE tests.id = test_results.test_id 
      AND tests.created_by = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

CREATE POLICY "Students can manage own results"
  ON test_results
  FOR ALL
  TO authenticated
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'student'
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tests_created_by ON tests(created_by);
CREATE INDEX IF NOT EXISTS idx_tests_active ON tests(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_questions_test_id ON questions(test_id);
CREATE INDEX IF NOT EXISTS idx_questions_order ON questions(test_id, order_index);
CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_test_results_student_id ON test_results(student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tests_updated_at 
  BEFORE UPDATE ON tests 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Add test_attempts table for tracking student test attempts
-- This table stores randomization metadata for questions and options

CREATE TABLE IF NOT EXISTS test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  started_at timestamptz DEFAULT now(),
  status text NOT NULL DEFAULT 'in_progress',
  question_order uuid[] NOT NULL DEFAULT '{}',
  option_orders jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT unique_student_test_attempt UNIQUE(test_id, student_id)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_test_attempts_test_id ON test_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_student_id ON test_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_test_attempts_status ON test_attempts(status);

-- Enable RLS
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;

-- Students can manage their own attempts
CREATE POLICY "Students can manage own attempts"
  ON test_attempts
  FOR ALL
  TO authenticated
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'student'
    )
  );

-- Teachers can view attempts for their tests
CREATE POLICY "Teachers can view attempts for own tests"
  ON test_attempts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tests 
      JOIN profiles ON profiles.id = auth.uid()
      WHERE tests.id = test_attempts.test_id 
      AND tests.created_by = auth.uid()
      AND profiles.role = 'teacher'
    )
  );

COMMENT ON TABLE test_attempts IS 'Tracks student test attempts with question/option randomization metadata';
/*
  # Add time_per_question column to tests table

  This migration adds a column to store the exact time allocated per question in seconds.
  This prevents rounding errors when calculating per-question time from total duration.

  1. Changes
    - Add `time_per_question` column (integer, optional)
    - Stores the exact seconds allocated per question as set by the teacher
*/

-- Add time_per_question column to tests table
ALTER TABLE tests 
ADD COLUMN IF NOT EXISTS time_per_question integer;

-- Add comment to document the column
COMMENT ON COLUMN tests.time_per_question IS 'Exact seconds allocated per question. Used to prevent rounding errors when duration is stored in minutes.';
/*
  # Add Reviews Table

  1. New Table
    - `reviews`
      - `id` (uuid, primary key)
      - `user_id` (text, clerk user id)
      - `name` (text)
      - `role` (text)
      - `rating` (integer, 1-5)
      - `comment` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Anyone can read reviews
    - Only authenticated users can create reviews
    - Users can update/delete their own reviews
*/

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  name text NOT NULL,
  role text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read reviews
CREATE POLICY "Anyone can read reviews"
  ON reviews
  FOR SELECT
  TO public
  USING (true);

-- Allow authenticated users to create reviews
CREATE POLICY "Authenticated users can create reviews"
  ON reviews
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow users to update their own reviews
CREATE POLICY "Users can update their own reviews"
  ON reviews
  FOR UPDATE
  TO public
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Allow users to delete their own reviews
CREATE POLICY "Users can delete their own reviews"
  ON reviews
  FOR DELETE
  TO public
  USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Create index for faster queries
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
-- Migration: Allow starting attempts on inactive tests (for shared links)
-- This removes the is_active check from start_test_attempt RPC function

CREATE OR REPLACE FUNCTION public.start_test_attempt(
  p_test_id uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempt_id uuid;
  v_question_ids uuid[];
  v_question_order uuid[];
  v_option_orders jsonb := '{}'::jsonb;
  v_q_id uuid;
  v_options jsonb;
  v_shuffled int[];
  v_status text;
  v_started_at timestamptz;
BEGIN
  -- Check if test exists (removed is_active check to allow shared links)
  IF NOT EXISTS (
    SELECT 1 FROM tests WHERE id = p_test_id
  ) THEN
    RAISE EXCEPTION 'Test not found or not accessible';
  END IF;

  -- Check for existing attempt
  SELECT id, status, started_at INTO v_attempt_id, v_status, v_started_at
  FROM test_attempts
  WHERE test_id = p_test_id AND student_id = p_student_id
  ORDER BY started_at DESC
  LIMIT 1;

  -- If attempt exists and not submitted, return it
  IF v_attempt_id IS NOT NULL AND v_status != 'submitted' THEN
    SELECT question_order, option_orders INTO v_question_order, v_option_orders
    FROM test_attempts
    WHERE id = v_attempt_id;
    
    RETURN jsonb_build_object(
      'attempt_id', v_attempt_id,
      'status', v_status,
      'started_at', v_started_at,
      'question_order', (SELECT array_agg(q::text) FROM unnest(v_question_order) q),
      'option_orders', v_option_orders
    );
  END IF;

  -- Create new attempt with randomization
  SELECT array_agg(id ORDER BY random()) INTO v_question_ids
  FROM questions
  WHERE test_id = p_test_id;

  v_question_order := v_question_ids;

  -- Randomize options for each question
  FOR v_q_id IN SELECT unnest(v_question_ids) LOOP
    SELECT options INTO v_options FROM questions WHERE id = v_q_id;
    v_shuffled := ARRAY(
      SELECT i FROM generate_series(0, jsonb_array_length(v_options) - 1) i ORDER BY random()
    );
    v_option_orders := v_option_orders || jsonb_build_object(v_q_id::text, to_jsonb(v_shuffled));
  END LOOP;

  INSERT INTO test_attempts (test_id, student_id, started_at, status, question_order, option_orders)
  VALUES (p_test_id, p_student_id, now(), 'in_progress', v_question_order, v_option_orders)
  RETURNING id, started_at INTO v_attempt_id, v_started_at;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt_id,
    'status', 'in_progress',
    'started_at', v_started_at,
    'question_order', (SELECT array_agg(q::text) FROM unnest(v_question_order) q),
    'option_orders', v_option_orders
  );
END;
$$;

COMMENT ON FUNCTION public.start_test_attempt(uuid, uuid) IS 'Creates or returns existing test attempt. Allows inactive tests for shared links.';
-- Add submit_test_result RPC function
-- This function handles test submission with automatic time calculation

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS public.submit_test_result(uuid, uuid, integer[]);

CREATE OR REPLACE FUNCTION public.submit_test_result(
  p_test_id uuid,
  p_student_id uuid,
  p_answers int[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempt_id uuid;
  v_started_at timestamptz;
  v_time_taken int;
  v_question_ids uuid[];
  v_option_orders jsonb;
  v_correct_count int := 0;
  v_total_questions int;
  v_score numeric;
  v_result_id uuid;
  v_original_question_ids uuid[];
  v_remapped_answers int[];
  v_question_position int;
BEGIN
  -- Get the attempt details
  SELECT id, started_at, question_order, option_orders 
  INTO v_attempt_id, v_started_at, v_question_ids, v_option_orders
  FROM test_attempts
  WHERE test_id = p_test_id AND student_id = p_student_id
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_attempt_id IS NULL THEN
    RAISE EXCEPTION 'No attempt found for this test';
  END IF;

  -- Calculate time taken in seconds
  v_time_taken := EXTRACT(EPOCH FROM (now() - v_started_at))::int;

  -- Get total number of questions
  v_total_questions := array_length(v_question_ids, 1);

  -- Verify answers array length matches
  IF array_length(p_answers, 1) != v_total_questions THEN
    RAISE EXCEPTION 'Answers count does not match questions count';
  END IF;

  -- Get original question order from the questions table
  SELECT array_agg(id ORDER BY order_index)
  INTO v_original_question_ids
  FROM questions
  WHERE test_id = p_test_id;

  -- Initialize remapped array with -1 (unanswered)
  v_remapped_answers := array_fill(-1, ARRAY[v_total_questions]);

  -- Calculate score and remap answers simultaneously
  -- p_answers is in randomized question order (question_order from attempt)
  -- We need to remap to original question order for storage
  FOR i IN 1..v_total_questions LOOP
    DECLARE
      v_question_id uuid := v_question_ids[i]; -- Question ID in randomized order
      v_user_answer_original int := p_answers[i]; -- User's answer (original option index)
      v_correct_answer_original int;
    BEGIN
      -- Get the correct answer (original index)
      SELECT correct_answer INTO v_correct_answer_original
      FROM questions
      WHERE id = v_question_id;

      -- Find where this question appears in the original order
      v_question_position := array_position(v_original_question_ids, v_question_id);
      
      IF v_question_position IS NOT NULL THEN
        -- Store answer in original question position
        v_remapped_answers[v_question_position] := v_user_answer_original;
      END IF;

      -- Skip unanswered questions (-1) for score calculation
      IF v_user_answer_original != -1 THEN
        -- Check if answer is correct (direct comparison)
        IF v_user_answer_original = v_correct_answer_original THEN
          v_correct_count := v_correct_count + 1;
        END IF;
      END IF;
    END;
  END LOOP;

  -- Calculate percentage score
  v_score := (v_correct_count::numeric / v_total_questions::numeric) * 100;

  -- Insert or update the test result with remapped answers
  INSERT INTO test_results (test_id, student_id, score, total_questions, time_taken, answers, completed_at)
  VALUES (p_test_id, p_student_id, v_score, v_total_questions, v_time_taken, to_jsonb(v_remapped_answers), now())
  ON CONFLICT (test_id, student_id) 
  DO UPDATE SET
    score = EXCLUDED.score,
    total_questions = EXCLUDED.total_questions,
    time_taken = EXCLUDED.time_taken,
    answers = EXCLUDED.answers,
    completed_at = EXCLUDED.completed_at
  RETURNING id INTO v_result_id;

  -- Update attempt status to submitted
  UPDATE test_attempts
  SET status = 'submitted'
  WHERE id = v_attempt_id;

  RETURN jsonb_build_object(
    'result_id', v_result_id,
    'status', 'submitted',
    'score', v_score,
    'time_taken', v_time_taken
  );
END;
$$;

COMMENT ON FUNCTION public.submit_test_result(uuid, uuid, int[]) IS 'Submits test result with automatic time calculation and score grading considering answer randomization.';
/*
  # Add Marking System to Questions
  
  This migration adds a marks field to questions table to support weighted scoring.
  
  Changes:
  1. Add `marks` column to questions table (default 1 mark per question)
  2. Update RPC functions to handle weighted scoring
  3. Maintain backward compatibility with existing tests
*/

-- Add marks column to questions table
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS marks integer NOT NULL DEFAULT 1;

-- Add comment explaining the field
COMMENT ON COLUMN questions.marks IS 'Point value for this question (default 1)';

-- Add earned_marks and total_marks columns to test_results table
ALTER TABLE test_results
ADD COLUMN IF NOT EXISTS earned_marks integer,
ADD COLUMN IF NOT EXISTS total_marks integer;

-- Add comments
COMMENT ON COLUMN test_results.earned_marks IS 'Marks earned by the student';
COMMENT ON COLUMN test_results.total_marks IS 'Total marks possible for the test';

-- Create or replace function to calculate total marks for a test
CREATE OR REPLACE FUNCTION get_test_total_marks(test_uuid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total integer;
BEGIN
  SELECT COALESCE(SUM(marks), 0)
  INTO total
  FROM questions
  WHERE test_id = test_uuid;
  
  RETURN total;
END;
$$;

-- Update the submit_test_result function to use weighted scoring
CREATE OR REPLACE FUNCTION submit_test_result(
  p_test_id uuid,
  p_student_id uuid,
  p_answers jsonb,
  p_time_taken integer,
  p_attempt_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_questions jsonb;
  v_total_marks integer := 0;
  v_earned_marks integer := 0;
  v_score numeric;
  v_result_id uuid;
  v_question record;
  v_user_answer integer;
  v_correct_answer integer;
  v_question_marks integer;
  v_question_index integer := 0;
  v_total_questions integer := 0;
BEGIN
  -- Get questions with their marks in ORIGINAL ORDER (order_index)
  -- NO RANDOMIZATION - answers[i] will always match questions[i]
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'correct_answer', correct_answer,
      'marks', marks,
      'order_index', order_index
    ) ORDER BY order_index
  )
  INTO v_questions
  FROM questions
  WHERE test_id = p_test_id;

  v_total_questions := jsonb_array_length(v_questions);

  -- Calculate total possible marks
  FOR v_question IN 
    SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_question_marks := (v_question.value->>'marks')::integer;
    v_total_marks := v_total_marks + v_question_marks;
  END LOOP;

  -- Calculate earned marks based on correct answers
  -- SIMPLE: answers[i] directly maps to questions[i] (no randomization)
  FOR v_question IN 
    SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_correct_answer := (v_question.value->>'correct_answer')::integer;
    v_question_marks := (v_question.value->>'marks')::integer;
    
    -- Get user's answer at this position (direct 1:1 mapping)
    v_user_answer := COALESCE((p_answers->>v_question_index)::integer, -1);
    
    -- Award marks if answer is correct
    IF v_user_answer = v_correct_answer AND v_user_answer >= 0 THEN
      v_earned_marks := v_earned_marks + v_question_marks;
    END IF;
    
    v_question_index := v_question_index + 1;
  END LOOP;

  -- Calculate percentage score
  IF v_total_marks > 0 THEN
    v_score := (v_earned_marks::numeric / v_total_marks::numeric) * 100;
  ELSE
    v_score := 0;
  END IF;

  -- Insert result
  INSERT INTO test_results (
    test_id,
    student_id,
    score,
    earned_marks,
    total_marks,
    total_questions,
    time_taken,
    answers,
    completed_at
  )
  VALUES (
    p_test_id,
    p_student_id,
    v_score,
    v_earned_marks,
    v_total_marks,
    v_total_questions,
    p_time_taken,
    p_answers,
    now()
  )
  RETURNING id INTO v_result_id;

  -- Mark attempt as completed if attempt_id provided
  IF p_attempt_id IS NOT NULL THEN
    UPDATE test_attempts
    SET status = 'completed', completed_at = now()
    WHERE id = p_attempt_id;
  END IF;

  -- Return result with marks information
  RETURN jsonb_build_object(
    'result_id', v_result_id,
    'score', v_score,
    'earned_marks', v_earned_marks,
    'total_marks', v_total_marks,
    'total_questions', v_total_questions
  );
END;
$$;

-- Create helper view to show test statistics with marks
CREATE OR REPLACE VIEW test_statistics AS
SELECT 
  t.id as test_id,
  t.title,
  COUNT(q.id) as total_questions,
  COALESCE(SUM(q.marks), 0) as total_marks,
  COALESCE(AVG(q.marks), 1) as avg_marks_per_question,
  MIN(q.marks) as min_marks,
  MAX(q.marks) as max_marks
FROM tests t
LEFT JOIN questions q ON q.test_id = t.id
GROUP BY t.id, t.title;

COMMENT ON VIEW test_statistics IS 'Aggregated statistics for tests including marking information';
-- Fix: Allow students to read all tests (for shared links)
-- Previously, students could only see active tests within date range
-- This prevented accessing tests via shared links

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Students can view active tests" ON tests;

-- Create new policy that allows students to read any test
-- This enables shared link access while maintaining security
CREATE POLICY "Students can view all tests"
  ON tests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'student'
    )
  );

COMMENT ON POLICY "Students can view all tests" ON tests IS 'Allows students to view any test via shared links. Write operations still restricted to teachers.';
-- Fix submit_test_result function to calculate marks-based score
-- This updates the function to match the frontend call signature and use marks-based calculation

DROP FUNCTION IF EXISTS public.submit_test_result(uuid, uuid, integer[]);

CREATE OR REPLACE FUNCTION public.submit_test_result(
  p_test_id uuid,
  p_student_id uuid,
  p_answers int[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempt_id uuid;
  v_started_at timestamptz;
  v_time_taken int;
  v_question_ids uuid[];
  v_option_orders jsonb;
  v_total_marks int := 0;
  v_earned_marks int := 0;
  v_total_questions int;
  v_score numeric;
  v_result_id uuid;
  v_original_question_ids uuid[];
  v_remapped_answers int[];
  v_question_position int;
BEGIN
  -- Get the attempt details
  SELECT id, started_at, question_order, option_orders 
  INTO v_attempt_id, v_started_at, v_question_ids, v_option_orders
  FROM test_attempts
  WHERE test_id = p_test_id AND student_id = p_student_id
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_attempt_id IS NULL THEN
    RAISE EXCEPTION 'No attempt found for this test';
  END IF;

  -- Calculate time taken in seconds
  v_time_taken := EXTRACT(EPOCH FROM (now() - v_started_at))::int;

  -- Get total number of questions
  v_total_questions := array_length(v_question_ids, 1);

  -- Verify answers array length matches
  IF array_length(p_answers, 1) != v_total_questions THEN
    RAISE EXCEPTION 'Answers count (%) does not match questions count (%)', 
      array_length(p_answers, 1), v_total_questions;
  END IF;

  -- Get original question order from the questions table
  SELECT array_agg(id ORDER BY order_index)
  INTO v_original_question_ids
  FROM questions
  WHERE test_id = p_test_id;

  -- Initialize remapped array with -1 (unanswered)
  v_remapped_answers := array_fill(-1, ARRAY[v_total_questions]);

  -- Calculate total possible marks first
  SELECT COALESCE(SUM(marks), v_total_questions) 
  INTO v_total_marks
  FROM questions
  WHERE test_id = p_test_id;

  -- Calculate earned marks and remap answers simultaneously
  -- p_answers is in question order from attempt (should be sequential now)
  -- We need to remap to original question order for storage
  FOR i IN 1..v_total_questions LOOP
    DECLARE
      v_question_id uuid := v_question_ids[i]; -- Question ID in test order
      v_user_answer_original int := p_answers[i]; -- User's answer (option index)
      v_correct_answer_original int;
      v_question_marks int;
    BEGIN
      -- Get the correct answer and marks for this question
      SELECT correct_answer, COALESCE(marks, 1) 
      INTO v_correct_answer_original, v_question_marks
      FROM questions
      WHERE id = v_question_id;

      -- Find where this question appears in the original order
      v_question_position := array_position(v_original_question_ids, v_question_id);
      
      IF v_question_position IS NOT NULL THEN
        -- Store answer in original question position
        v_remapped_answers[v_question_position] := v_user_answer_original;
      END IF;

      -- Skip unanswered questions (-1) for score calculation
      IF v_user_answer_original != -1 THEN
        -- Check if answer is correct (direct comparison)
        IF v_user_answer_original = v_correct_answer_original THEN
          v_earned_marks := v_earned_marks + v_question_marks;
        END IF;
      END IF;
    END;
  END LOOP;

  -- Calculate percentage score based on marks (not questions)
  IF v_total_marks > 0 THEN
    v_score := (v_earned_marks::numeric / v_total_marks::numeric) * 100;
  ELSE
    v_score := 0;
  END IF;

  -- Insert or update the test result with marks-based scoring
  INSERT INTO test_results (
    test_id, 
    student_id, 
    score, 
    earned_marks,
    total_marks,
    total_questions, 
    time_taken, 
    answers, 
    completed_at
  )
  VALUES (
    p_test_id, 
    p_student_id, 
    v_score, 
    v_earned_marks,
    v_total_marks,
    v_total_questions, 
    v_time_taken, 
    to_jsonb(v_remapped_answers), 
    now()
  )
  ON CONFLICT (test_id, student_id) 
  DO UPDATE SET
    score = EXCLUDED.score,
    earned_marks = EXCLUDED.earned_marks,
    total_marks = EXCLUDED.total_marks,
    total_questions = EXCLUDED.total_questions,
    time_taken = EXCLUDED.time_taken,
    answers = EXCLUDED.answers,
    completed_at = EXCLUDED.completed_at
  RETURNING id INTO v_result_id;

  -- Update attempt status to submitted
  UPDATE test_attempts
  SET status = 'submitted'
  WHERE id = v_attempt_id;

  -- Return result with marks information
  RETURN jsonb_build_object(
    'result_id', v_result_id,
    'status', 'submitted',
    'score', v_score,
    'earned_marks', v_earned_marks,
    'total_marks', v_total_marks,
    'total_questions', v_total_questions,
    'time_taken', v_time_taken
  );
END;
$$;

COMMENT ON FUNCTION public.submit_test_result(uuid, uuid, int[]) IS 
  'Submits test result with marks-based scoring. Score = (earned_marks / total_marks) * 100';

-- Recalculate all existing test results to use marks-based scoring
DO $$
DECLARE
  v_result record;
  v_test_id uuid;
  v_total_marks int;
  v_earned_marks int;
  v_new_score numeric;
BEGIN
  RAISE NOTICE 'Recalculating existing test results with marks-based scoring...';
  
  FOR v_result IN 
    SELECT tr.id, tr.test_id, tr.answers, tr.student_id
    FROM test_results tr
  LOOP
    v_test_id := v_result.test_id;
    v_total_marks := 0;
    v_earned_marks := 0;
    
    -- Calculate total marks for the test
    SELECT COALESCE(SUM(marks), COUNT(*))
    INTO v_total_marks
    FROM questions
    WHERE test_id = v_test_id;
    
    -- Calculate earned marks
    SELECT COALESCE(SUM(
      CASE 
        WHEN (v_result.answers->(q.order_index - 1))::int = q.correct_answer 
        THEN COALESCE(q.marks, 1)
        ELSE 0
      END
    ), 0)
    INTO v_earned_marks
    FROM questions q
    WHERE q.test_id = v_test_id
    AND (v_result.answers->(q.order_index - 1))::int IS NOT NULL
    AND (v_result.answers->(q.order_index - 1))::int >= 0;
    
    -- Calculate new percentage score
    IF v_total_marks > 0 THEN
      v_new_score := (v_earned_marks::numeric / v_total_marks::numeric) * 100;
    ELSE
      v_new_score := 0;
    END IF;
    
    -- Update the result
    UPDATE test_results
    SET 
      score = v_new_score,
      earned_marks = v_earned_marks,
      total_marks = v_total_marks
    WHERE id = v_result.id;
    
    RAISE NOTICE 'Updated result % for test %: % marks / % marks = %%%',
      v_result.id, v_test_id, v_earned_marks, v_total_marks, ROUND(v_new_score, 1);
  END LOOP;
  
  RAISE NOTICE 'Recalculation complete!';
END $$;
-- Remove Question Randomization
-- This migration simplifies the test system by removing ALL question randomization
-- Questions will now appear in their original order (sorted by order_index)
-- This fixes the answer mapping bug where answers[i] didn't match questions[i]

-- Update start_test_attempt function to NOT randomize questions
CREATE OR REPLACE FUNCTION public.start_test_attempt(
  p_test_id uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempt_id uuid;
  v_existing_attempt_id uuid;
  v_question_ids uuid[];
BEGIN
  -- Check for existing in-progress attempt
  SELECT id INTO v_existing_attempt_id
  FROM test_attempts
  WHERE test_id = p_test_id 
    AND student_id = p_student_id 
    AND status = 'in_progress'
  ORDER BY started_at DESC
  LIMIT 1;

  -- Get question IDs in ORIGINAL ORDER (no randomization)
  SELECT array_agg(id ORDER BY order_index)
  INTO v_question_ids
  FROM questions
  WHERE test_id = p_test_id;

  IF v_existing_attempt_id IS NOT NULL THEN
    -- Resume existing attempt
    v_attempt_id := v_existing_attempt_id;
    
    -- Update started_at to current time
    UPDATE test_attempts
    SET started_at = now(),
        status = 'in_progress',
        question_order = v_question_ids -- Update to original order
    WHERE id = v_attempt_id;
  ELSE
    -- Create new attempt with questions in original order
    INSERT INTO test_attempts (test_id, student_id, question_order, option_orders, status)
    VALUES (p_test_id, p_student_id, v_question_ids, '{}'::jsonb, 'in_progress')
    RETURNING id INTO v_attempt_id;
  END IF;

  RETURN jsonb_build_object(
    'attempt_id', v_attempt_id,
    'question_order', v_question_ids,
    'option_orders', '{}'::jsonb,
    'status', 'in_progress',
    'started_at', now()
  );
END;
$$;

COMMENT ON FUNCTION public.start_test_attempt(uuid, uuid) IS 'Starts a test attempt with questions in original order (NO randomization)';

-- Update all existing attempts to use original question order
UPDATE test_attempts ta
SET question_order = (
  SELECT array_agg(id ORDER BY order_index)
  FROM questions q
  WHERE q.test_id = ta.test_id
)
WHERE status = 'in_progress';

-- Log the change
DO $$
BEGIN
  RAISE NOTICE '✅ Question randomization removed';
  RAISE NOTICE '✅ All questions now appear in original order';
  RAISE NOTICE '✅ Answer mapping bug fixed: answers[i] = questions[i]';
END $$;
-- Verify and Fix Scores Migration
-- This script verifies the submit_test_result function is updated and recalculates existing scores

-- Step 1: Verify the function exists and uses marks-based scoring
DO $$
DECLARE
  function_exists boolean;
  function_source text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'submit_test_result'
  ) INTO function_exists;
  
  IF function_exists THEN
    SELECT pg_get_functiondef(oid) INTO function_source
    FROM pg_proc
    WHERE proname = 'submit_test_result';
    
    IF function_source LIKE '%v_earned_marks%' AND function_source LIKE '%v_total_marks%' THEN
      RAISE NOTICE '✅ submit_test_result function is using marks-based scoring';
    ELSE
      RAISE WARNING '⚠️ submit_test_result function may not be updated. Please run 20260201_add_question_marks.sql';
    END IF;
  ELSE
    RAISE WARNING '❌ submit_test_result function not found. Please run 20260201_add_question_marks.sql';
  END IF;
END $$;

-- Step 2: Create a function to recalculate a single test result score
CREATE OR REPLACE FUNCTION recalculate_test_result_score(p_result_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_test_id uuid;
  v_student_id uuid;
  v_answers jsonb;
  v_old_score numeric;
  v_questions jsonb;
  v_total_marks integer := 0;
  v_earned_marks integer := 0;
  v_score numeric;
  v_question record;
  v_user_answer integer;
  v_correct_answer integer;
  v_question_marks integer;
  v_question_index integer := 0;
BEGIN
  -- Get the test result details including old score
  SELECT test_id, student_id, answers, score
  INTO v_test_id, v_student_id, v_answers, v_old_score
  FROM test_results
  WHERE id = p_result_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Test result not found'
    );
  END IF;
  
  -- Get questions with their marks
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'correct_answer', correct_answer,
      'marks', marks,
      'order_index', order_index
    ) ORDER BY order_index
  )
  INTO v_questions
  FROM questions
  WHERE test_id = v_test_id;
  
  -- Calculate total possible marks
  FOR v_question IN 
    SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_question_marks := (v_question.value->>'marks')::integer;
    v_total_marks := v_total_marks + v_question_marks;
  END LOOP;
  
  -- Calculate earned marks based on correct answers
  -- SIMPLE: answers[i] directly maps to questions[i] (no randomization)
  FOR v_question IN 
    SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_correct_answer := (v_question.value->>'correct_answer')::integer;
    v_question_marks := (v_question.value->>'marks')::integer;
    
    -- Get user's answer at this position (direct 1:1 mapping)
    v_user_answer := COALESCE((v_answers->>v_question_index)::integer, -1);
    
    -- Award marks if answer is correct
    IF v_user_answer = v_correct_answer AND v_user_answer >= 0 THEN
      v_earned_marks := v_earned_marks + v_question_marks;
    END IF;
    
    v_question_index := v_question_index + 1;
  END LOOP;
  
  -- Calculate percentage score
  IF v_total_marks > 0 THEN
    v_score := (v_earned_marks::numeric / v_total_marks::numeric) * 100;
  ELSE
    v_score := 0;
  END IF;
  
  -- Update the result with new score AND marks
  UPDATE test_results
  SET 
    score = v_score,
    earned_marks = v_earned_marks,
    total_marks = v_total_marks
  WHERE id = p_result_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'result_id', p_result_id,
    'old_score', round(v_old_score, 2),
    'new_score', round(v_score, 2),
    'earned_marks', v_earned_marks,
    'total_marks', v_total_marks,
    'calculation', format('%s / %s * 100 = %s%%', v_earned_marks, v_total_marks, round(v_score, 2))
  );
END;
$$;

-- Step 3: Show all test results that might need recalculation
SELECT 
  tr.id as result_id,
  t.title as test_title,
  tr.score as current_score,
  tr.total_questions,
  (SELECT COUNT(*) FROM questions q WHERE q.test_id = tr.test_id) as actual_questions,
  (SELECT SUM(marks) FROM questions q WHERE q.test_id = tr.test_id) as total_marks_available,
  tr.completed_at
FROM test_results tr
JOIN tests t ON t.id = tr.test_id
ORDER BY tr.completed_at DESC
LIMIT 20;

-- Step 4: Instructions for recalculating scores
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'To recalculate a specific test result:';
  RAISE NOTICE 'SELECT recalculate_test_result_score(''<result_id>'');';
  RAISE NOTICE '';
  RAISE NOTICE 'To recalculate ALL test results:';
  RAISE NOTICE 'SELECT recalculate_test_result_score(id) FROM test_results;';
  RAISE NOTICE '========================================';
END $$;
-- Add negative_marking_enabled column to tests table
-- This allows teachers to toggle negative marking on/off for each test
-- Default is false (negative marking disabled) for backward compatibility

ALTER TABLE tests ADD COLUMN IF NOT EXISTS negative_marking_enabled boolean DEFAULT false;

-- Add comment to explain the field
COMMENT ON COLUMN tests.negative_marking_enabled IS 'When true, students lose 1 mark for each wrong answer';
-- ============================================================================
-- MIGRATION: Update Scoring Logic to Support Negative Marking
-- ============================================================================
-- Updates the submit_test_result function to apply negative marking when enabled
-- - Checks test.negative_marking_enabled flag
-- - Applies -1 penalty for wrong answers when enabled
-- - Ensures score never goes below 0
-- ============================================================================

CREATE OR REPLACE FUNCTION submit_test_result(
  p_test_id uuid,
  p_student_id uuid,
  p_answers jsonb,
  p_time_taken integer,
  p_attempt_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_questions jsonb;
  v_total_marks integer := 0;
  v_earned_marks integer := 0;
  v_score numeric;
  v_result_id uuid;
  v_question record;
  v_user_answer integer;
  v_correct_answer integer;
  v_question_marks integer;
  v_question_index integer := 0;
  v_total_questions integer := 0;
  v_negative_marking_enabled boolean;
BEGIN
  -- Get the test's negative marking setting
  SELECT negative_marking_enabled INTO v_negative_marking_enabled
  FROM tests
  WHERE id = p_test_id;
  
  -- Default to false if not found
  v_negative_marking_enabled := COALESCE(v_negative_marking_enabled, false);

  -- Get questions with their marks in ORIGINAL ORDER (order_index)
  -- NO RANDOMIZATION - answers[i] will always match questions[i]
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'correct_answer', correct_answer,
      'marks', marks,
      'order_index', order_index
    ) ORDER BY order_index
  )
  INTO v_questions
  FROM questions
  WHERE test_id = p_test_id;

  v_total_questions := jsonb_array_length(v_questions);

  -- Calculate total possible marks
  FOR v_question IN 
    SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_question_marks := (v_question.value->>'marks')::integer;
    v_total_marks := v_total_marks + v_question_marks;
  END LOOP;

  -- Calculate earned marks based on correct answers AND negative marking flag
  FOR v_question IN 
    SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_correct_answer := (v_question.value->>'correct_answer')::integer;
    v_question_marks := (v_question.value->>'marks')::integer;
    
    -- Get user's answer at this position (direct 1:1 mapping)
    v_user_answer := COALESCE((p_answers->>v_question_index)::integer, -1);
    
    -- Award marks if answer is correct
    IF v_user_answer = v_correct_answer AND v_user_answer >= 0 THEN
      v_earned_marks := v_earned_marks + v_question_marks;
    -- Apply penalty for wrong answers if negative marking is enabled
    ELSIF v_negative_marking_enabled AND v_user_answer >= 0 AND v_user_answer != v_correct_answer THEN
      -- Deduct 1 mark for wrong answer (only if answered, not blank)
      v_earned_marks := v_earned_marks - 1;
    END IF;
    
    v_question_index := v_question_index + 1;
  END LOOP;

  -- Ensure earned marks never go below 0
  v_earned_marks := GREATEST(0, v_earned_marks);

  -- Calculate percentage score
  IF v_total_marks > 0 THEN
    v_score := (v_earned_marks::numeric / v_total_marks::numeric) * 100;
  ELSE
    v_score := 0;
  END IF;

  -- Insert result
  INSERT INTO test_results (
    test_id,
    student_id,
    score,
    earned_marks,
    total_marks,
    total_questions,
    time_taken,
    answers,
    completed_at
  )
  VALUES (
    p_test_id,
    p_student_id,
    v_score,
    v_earned_marks,
    v_total_marks,
    v_total_questions,
    p_time_taken,
    p_answers,
    now()
  )
  RETURNING id INTO v_result_id;

  -- Mark attempt as completed if attempt_id provided
  IF p_attempt_id IS NOT NULL THEN
    UPDATE test_attempts
    SET status = 'completed', completed_at = now()
    WHERE id = p_attempt_id;
  END IF;

  -- Return result with marks information and negative marking flag
  RETURN jsonb_build_object(
    'result_id', v_result_id,
    'score', v_score,
    'earned_marks', v_earned_marks,
    'total_marks', v_total_marks,
    'total_questions', v_total_questions,
    'negative_marking_applied', v_negative_marking_enabled
  );
END;
$$;

-- Add comment explaining the function updates
COMMENT ON FUNCTION submit_test_result(uuid, uuid, jsonb, integer, uuid) IS 
'Calculates and stores test results with support for negative marking. When test.negative_marking_enabled is true, students lose 1 mark for each wrong answer. Score is never below 0.';
-- Fix: Separate teacher read vs write permissions on tests table
-- Previously, "Teachers can manage own tests" used FOR ALL with:
--   created_by = auth.uid() OR is_active = true
-- This allowed ANY teacher to UPDATE/DELETE other teachers' public tests.

-- Drop the overly-permissive policy
DROP POLICY IF EXISTS "Teachers can manage own tests" ON tests;

-- Teachers can READ their own tests AND other public (active) tests
CREATE POLICY "Teachers can view tests"
  ON tests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'teacher'
    )
    AND (tests.created_by = auth.uid() OR tests.is_active = true)
  );

-- Teachers can only INSERT/UPDATE/DELETE their OWN tests
CREATE POLICY "Teachers can manage own tests"
  ON tests
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'teacher'
    )
    AND tests.created_by = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'teacher'
    )
    AND tests.created_by = auth.uid()
  );
-- Add section column to questions table
-- This allows grouping questions by languages/categories

ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS section varchar(255) DEFAULT 'General';

-- Update existing records to have 'General' as their section if it's somehow null
UPDATE public.questions 
SET section = 'General' 
WHERE section IS NULL;

-- Log the migration completion
DO $$
BEGIN
  RAISE NOTICE '✅ Successfully added section column to questions table';
END $$;
-- Fix Android issues:
-- 1. Add public stats function (SECURITY DEFINER) so landing page can fetch counts without auth
-- 2. Fix submit_test_result to use ON CONFLICT for duplicate submission safety

-- ============================================
-- 1. Public stats function for landing page
-- ============================================
-- This function bypasses RLS to return public counts for the landing page.
-- All RLS policies are TO authenticated, so the anon role gets 0 rows from direct queries.
-- Using SECURITY DEFINER lets the function read counts regardless of the caller's role.

CREATE OR REPLACE FUNCTION get_public_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_users integer;
  v_tests integer;
  v_questions integer;
BEGIN
  SELECT COUNT(*) INTO v_users FROM profiles;
  SELECT COUNT(*) INTO v_tests FROM tests WHERE is_active = true;
  SELECT COUNT(*) INTO v_questions FROM questions;

  RETURN jsonb_build_object(
    'active_users', v_users,
    'total_tests', v_tests,
    'total_questions', v_questions
  );
END;
$$;

-- Grant anon access to the function so unauthenticated users can call it
GRANT EXECUTE ON FUNCTION get_public_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_public_stats() TO authenticated;

-- ============================================
-- 2. Fix submit_test_result with ON CONFLICT
-- ============================================
-- The FINAL_FIX.sql dropped all versions and recreated without ON CONFLICT.
-- This causes duplicate key violations when students double-tap submit on mobile.
-- We add ON CONFLICT (test_id, student_id) DO UPDATE to handle re-submissions gracefully.

DROP FUNCTION IF EXISTS submit_test_result(uuid, uuid, jsonb, integer, uuid);

CREATE FUNCTION submit_test_result(
  p_test_id uuid,
  p_student_id uuid,
  p_answers jsonb,
  p_time_taken integer DEFAULT 0,
  p_attempt_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_questions jsonb;
  v_total_marks integer := 0;
  v_earned_marks integer := 0;
  v_score numeric;
  v_result_id uuid;
  v_question record;
  v_user_answer integer;
  v_correct_answer integer;
  v_question_marks integer;
  v_question_index integer := 0;
  v_total_questions integer := 0;
  v_negative_marking_enabled boolean;
  v_negative_marks numeric;
BEGIN
  -- Get negative marking settings
  SELECT 
    COALESCE(negative_marking_enabled, false),
    COALESCE(negative_marks, 1)
  INTO v_negative_marking_enabled, v_negative_marks
  FROM tests
  WHERE id = p_test_id;

  -- Get questions ordered by order_index
  SELECT jsonb_agg(
    jsonb_build_object(
      'correct_answer', correct_answer,
      'marks', COALESCE(marks, 1)
    ) ORDER BY order_index
  )
  INTO v_questions
  FROM questions
  WHERE test_id = p_test_id;

  v_total_questions := jsonb_array_length(COALESCE(v_questions, '[]'::jsonb));

  -- Calculate total and earned marks
  FOR v_question IN SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_question_marks := COALESCE((v_question.value->>'marks')::integer, 1);
    v_correct_answer := (v_question.value->>'correct_answer')::integer;
    v_user_answer := COALESCE((p_answers->>v_question_index)::integer, -1);
    
    v_total_marks := v_total_marks + v_question_marks;
    
    IF v_user_answer = v_correct_answer AND v_user_answer >= 0 THEN
      -- Correct answer: add question marks
      v_earned_marks := v_earned_marks + v_question_marks;
    ELSIF v_negative_marking_enabled AND v_user_answer >= 0 AND v_user_answer != v_correct_answer THEN
      -- Wrong answer with negative marking: deduct negative_marks value
      v_earned_marks := v_earned_marks - v_negative_marks;
    END IF;
    
    v_question_index := v_question_index + 1;
  END LOOP;

  -- Clamp earned marks to 0 minimum
  v_earned_marks := GREATEST(0, v_earned_marks);

  -- Calculate score percentage
  v_score := CASE 
    WHEN v_total_marks > 0 THEN (v_earned_marks::numeric / v_total_marks::numeric) * 100
    ELSE 0
  END;

  -- Insert or update result (ON CONFLICT handles double-submission on mobile)
  INSERT INTO test_results (test_id, student_id, score, earned_marks, total_marks, total_questions, time_taken, answers, completed_at)
  VALUES (p_test_id, p_student_id, v_score, v_earned_marks, v_total_marks, v_total_questions, p_time_taken, p_answers, now())
  ON CONFLICT (test_id, student_id) DO UPDATE SET
    score = EXCLUDED.score,
    earned_marks = EXCLUDED.earned_marks,
    total_marks = EXCLUDED.total_marks,
    total_questions = EXCLUDED.total_questions,
    time_taken = EXCLUDED.time_taken,
    answers = EXCLUDED.answers,
    completed_at = EXCLUDED.completed_at
  RETURNING id INTO v_result_id;

  -- Update attempt status if provided
  IF p_attempt_id IS NOT NULL THEN
    UPDATE test_attempts SET status = 'completed' WHERE id = p_attempt_id;
  END IF;

  -- Also update any in-progress attempts for this student+test
  UPDATE test_attempts 
  SET status = 'submitted'
  WHERE test_id = p_test_id 
    AND student_id = p_student_id 
    AND status = 'in_progress';

  RETURN jsonb_build_object(
    'result_id', v_result_id,
    'score', v_score,
    'earned_marks', v_earned_marks,
    'total_marks', v_total_marks,
    'total_questions', v_total_questions,
    'negative_marking_applied', v_negative_marking_enabled,
    'status', 'submitted'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION submit_test_result(uuid, uuid, jsonb, integer, uuid) TO anon;
GRANT EXECUTE ON FUNCTION submit_test_result(uuid, uuid, jsonb, integer, uuid) TO authenticated;
-- ============================================
-- COMPREHENSIVE FIX: Results page stuck + Landing page empty on Android
-- ============================================
-- ROOT CAUSE: All RLS policies use auth.uid() which requires Supabase Auth.
-- But this app uses Clerk for authentication (not Supabase Auth), so auth.uid() is always NULL.
-- Direct table queries from the anon client get 0 rows.
-- SOLUTION: Create SECURITY DEFINER RPCs that bypass RLS for all data access.
-- The client will call these RPCs instead of direct table queries.

-- ============================================
-- 1. RPC: Get test with questions for results page
-- ============================================
-- Used after submission to show the student their answers vs correct answers.
-- SECURITY DEFINER bypasses RLS so it works regardless of auth state.

CREATE OR REPLACE FUNCTION get_test_for_results(p_test_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'description', t.description,
    'duration', t.duration,
    'time_per_question', t.time_per_question,
    'negative_marking_enabled', COALESCE(t.negative_marking_enabled, false),
    'default_marks', t.default_marks,
    'negative_marks', t.negative_marks,
    'created_by', t.created_by,
    'start_date', t.start_date,
    'end_date', t.end_date,
    'is_active', t.is_active,
    'created_at', t.created_at,
    'questions', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', q.id,
          'question_text', q.question_text,
          'options', q.options,
          'correct_answer', q.correct_answer,
          'marks', COALESCE(q.marks, 1),
          'order_index', q.order_index,
          'section', COALESCE(q.section, 'General')
        ) ORDER BY q.order_index
      )
      FROM questions q WHERE q.test_id = t.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM tests t
  WHERE t.id = p_test_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_test_for_results(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_test_for_results(uuid) TO authenticated;

-- ============================================
-- 2. RPC: Get a student's test result
-- ============================================
-- Fetches the most recent test result for a given student+test combination.
-- Returns null if no result found.

CREATE OR REPLACE FUNCTION get_student_test_result(p_test_id uuid, p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', r.id,
    'test_id', r.test_id,
    'student_id', r.student_id,
    'score', r.score,
    'earned_marks', r.earned_marks,
    'total_marks', r.total_marks,
    'total_questions', r.total_questions,
    'time_taken', r.time_taken,
    'answers', r.answers,
    'completed_at', r.completed_at,
    'created_at', r.created_at,
    'student_name', COALESCE(p.name, 'Unknown Student')
  )
  INTO v_result
  FROM test_results r
  LEFT JOIN profiles p ON p.id = r.student_id
  WHERE r.test_id = p_test_id AND r.student_id = p_student_id
  ORDER BY r.completed_at DESC
  LIMIT 1;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_student_test_result(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_student_test_result(uuid, uuid) TO authenticated;

-- ============================================
-- 3. RPC: Get public reviews (bypass any RLS issues)
-- ============================================
-- Reviews table has TO public policy, but some Android browsers have issues.
-- This RPC ensures reviews are always accessible.

CREATE OR REPLACE FUNCTION get_public_reviews()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'user_id', r.user_id,
        'name', r.name,
        'role', r.role,
        'rating', r.rating,
        'comment', r.comment,
        'created_at', r.created_at
      ) ORDER BY r.created_at DESC
    )
    FROM reviews r
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_reviews() TO anon;
GRANT EXECUTE ON FUNCTION get_public_reviews() TO authenticated;

-- ============================================
-- 4. Ensure get_public_stats exists (idempotent)
-- ============================================

CREATE OR REPLACE FUNCTION get_public_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_users integer;
  v_tests integer;
  v_questions integer;
BEGIN
  SELECT COUNT(*) INTO v_users FROM profiles;
  SELECT COUNT(*) INTO v_tests FROM tests WHERE is_active = true;
  SELECT COUNT(*) INTO v_questions FROM questions;

  RETURN jsonb_build_object(
    'active_users', v_users,
    'total_tests', v_tests,
    'total_questions', v_questions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_stats() TO anon;
GRANT EXECUTE ON FUNCTION get_public_stats() TO authenticated;

-- ============================================
-- 5. Ensure submit_test_result has ON CONFLICT (idempotent)
-- ============================================

DROP FUNCTION IF EXISTS submit_test_result(uuid, uuid, jsonb, integer, uuid);

CREATE FUNCTION submit_test_result(
  p_test_id uuid,
  p_student_id uuid,
  p_answers jsonb,
  p_time_taken integer DEFAULT 0,
  p_attempt_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_questions jsonb;
  v_total_marks integer := 0;
  v_earned_marks integer := 0;
  v_score numeric;
  v_result_id uuid;
  v_question record;
  v_user_answer integer;
  v_correct_answer integer;
  v_question_marks integer;
  v_question_index integer := 0;
  v_total_questions integer := 0;
  v_negative_marking_enabled boolean;
  v_negative_marks numeric;
BEGIN
  -- Get negative marking settings
  SELECT 
    COALESCE(negative_marking_enabled, false),
    COALESCE(negative_marks, 1)
  INTO v_negative_marking_enabled, v_negative_marks
  FROM tests
  WHERE id = p_test_id;

  -- Get questions ordered by order_index
  SELECT jsonb_agg(
    jsonb_build_object(
      'correct_answer', correct_answer,
      'marks', COALESCE(marks, 1)
    ) ORDER BY order_index
  )
  INTO v_questions
  FROM questions
  WHERE test_id = p_test_id;

  v_total_questions := jsonb_array_length(COALESCE(v_questions, '[]'::jsonb));

  -- Calculate total and earned marks
  FOR v_question IN SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_question_marks := COALESCE((v_question.value->>'marks')::integer, 1);
    v_correct_answer := (v_question.value->>'correct_answer')::integer;
    v_user_answer := COALESCE((p_answers->>v_question_index::text)::integer, -1);
    
    v_total_marks := v_total_marks + v_question_marks;
    
    IF v_user_answer = v_correct_answer AND v_user_answer >= 0 THEN
      v_earned_marks := v_earned_marks + v_question_marks;
    ELSIF v_negative_marking_enabled AND v_user_answer >= 0 AND v_user_answer != v_correct_answer THEN
      v_earned_marks := v_earned_marks - v_negative_marks;
    END IF;
    
    v_question_index := v_question_index + 1;
  END LOOP;

  -- Clamp earned marks to 0 minimum
  v_earned_marks := GREATEST(0, v_earned_marks);

  -- Calculate score percentage
  v_score := CASE 
    WHEN v_total_marks > 0 THEN (v_earned_marks::numeric / v_total_marks::numeric) * 100
    ELSE 0
  END;

  -- Insert or update result (ON CONFLICT handles double-submission on mobile)
  INSERT INTO test_results (test_id, student_id, score, earned_marks, total_marks, total_questions, time_taken, answers, completed_at)
  VALUES (p_test_id, p_student_id, v_score, v_earned_marks, v_total_marks, v_total_questions, p_time_taken, p_answers, now())
  ON CONFLICT (test_id, student_id) DO UPDATE SET
    score = EXCLUDED.score,
    earned_marks = EXCLUDED.earned_marks,
    total_marks = EXCLUDED.total_marks,
    total_questions = EXCLUDED.total_questions,
    time_taken = EXCLUDED.time_taken,
    answers = EXCLUDED.answers,
    completed_at = EXCLUDED.completed_at
  RETURNING id INTO v_result_id;

  -- Update attempt status (safe: no completed_at column on test_attempts)
  IF p_attempt_id IS NOT NULL THEN
    UPDATE test_attempts SET status = 'completed' WHERE id = p_attempt_id;
  END IF;

  UPDATE test_attempts 
  SET status = 'submitted'
  WHERE test_id = p_test_id 
    AND student_id = p_student_id 
    AND status = 'in_progress';

  RETURN jsonb_build_object(
    'result_id', v_result_id,
    'score', v_score,
    'earned_marks', v_earned_marks,
    'total_marks', v_total_marks,
    'total_questions', v_total_questions,
    'negative_marking_applied', v_negative_marking_enabled,
    'status', 'submitted'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_test_result(uuid, uuid, jsonb, integer, uuid) TO anon;
GRANT EXECUTE ON FUNCTION submit_test_result(uuid, uuid, jsonb, integer, uuid) TO authenticated;
-- ============================================
-- ADDITIONAL SECURITY DEFINER RPCs
-- Fixes Android: auth.uid() = NULL with Clerk auth, so direct table queries on
-- test_results and test_attempts return 0 rows. These RPCs bypass RLS.
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================

-- ============================================
-- 1. Get all results for a student
-- ============================================
-- Used by student performance/history page.
-- Returns an empty array [] when student has no results (never null).

CREATE OR REPLACE FUNCTION get_student_results(p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',              r.id,
        'test_id',         r.test_id,
        'student_id',      r.student_id,
        'score',           r.score,
        'earned_marks',    r.earned_marks,
        'total_marks',     r.total_marks,
        'total_questions', r.total_questions,
        'time_taken',      r.time_taken,
        'answers',         r.answers,
        'completed_at',    r.completed_at,
        'created_at',      r.created_at,
        'student_name',    COALESCE(p.name, 'Unknown Student')
      ) ORDER BY r.completed_at DESC
    )
    FROM test_results r
    LEFT JOIN profiles p ON p.id = r.student_id
    WHERE r.student_id = p_student_id
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_student_results(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_student_results(uuid) TO authenticated;

-- ============================================
-- 2. Get current test attempt for a student
-- ============================================
-- Used by TakeTest.tsx to restore in-progress attempt state on page refresh.
-- Returns NULL when no attempt or result exists.

CREATE OR REPLACE FUNCTION get_test_attempt(p_test_id uuid, p_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempt_row record;
BEGIN
  -- ONLY check for in_progress attempts — submitted attempts should be ignored
  -- so that students can retake tests (start_test_attempt will create a new attempt)
  SELECT id, started_at, status, question_order, option_orders
  INTO   v_attempt_row
  FROM   test_attempts
  WHERE  test_id    = p_test_id
    AND  student_id = p_student_id
    AND  status     = 'in_progress'  -- Only active attempts
  ORDER  BY started_at DESC
  LIMIT  1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'attempt_id',    v_attempt_row.id,
      'started_at',    v_attempt_row.started_at,
      'status',        v_attempt_row.status,
      'question_order', v_attempt_row.question_order,
      'option_orders',  v_attempt_row.option_orders
    );
  END IF;

  -- No in_progress attempt found — student can start fresh
  -- Let the client call start_test_attempt to create a new attempt
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION get_test_attempt(uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_test_attempt(uuid, uuid) TO authenticated;
-- ============================================
-- Teacher results RPC (SECURITY DEFINER)
-- Allows teacher to fetch results for their tests even with Clerk auth (auth.uid() = NULL).
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================

CREATE OR REPLACE FUNCTION get_teacher_results(p_test_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_test_ids IS NULL OR array_length(p_test_ids, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id',              r.id,
        'test_id',         r.test_id,
        'student_id',      r.student_id,
        'score',           r.score,
        'earned_marks',    r.earned_marks,
        'total_marks',     r.total_marks,
        'total_questions', r.total_questions,
        'time_taken',      r.time_taken,
        'answers',         r.answers,
        'completed_at',    r.completed_at,
        'created_at',      r.created_at,
        'student_name',    COALESCE(p.name, 'Unknown Student')
      ) ORDER BY r.completed_at DESC
    )
    FROM test_results r
    LEFT JOIN profiles p ON p.id = r.student_id
    WHERE r.test_id = ANY(p_test_ids)
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_teacher_results(uuid[]) TO anon;
GRANT EXECUTE ON FUNCTION get_teacher_results(uuid[]) TO authenticated;
-- ============================================
-- FIX: start_test_attempt should NOT reset started_at on resume
-- ============================================
-- The previous version reset started_at = now() when resuming an in-progress attempt,
-- which gave students infinite time (timer resets on every page refresh).
-- This fix preserves the original started_at when resuming.

CREATE OR REPLACE FUNCTION public.start_test_attempt(
  p_test_id uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempt_id uuid;
  v_existing_attempt record;
  v_question_ids uuid[];
BEGIN
  -- Check for existing in-progress attempt
  SELECT id, started_at INTO v_existing_attempt
  FROM test_attempts
  WHERE test_id = p_test_id 
    AND student_id = p_student_id 
    AND status = 'in_progress'
  ORDER BY started_at DESC
  LIMIT 1;

  -- Get question IDs in ORIGINAL ORDER (no randomization)
  SELECT array_agg(id ORDER BY order_index)
  INTO v_question_ids
  FROM questions
  WHERE test_id = p_test_id;

  IF v_existing_attempt.id IS NOT NULL THEN
    -- Resume existing attempt — DO NOT reset started_at!
    -- Keep the original start time so the timer continues from where it left off
    v_attempt_id := v_existing_attempt.id;
    
    -- Only update question_order if needed (keep started_at unchanged)
    UPDATE test_attempts
    SET question_order = v_question_ids
    WHERE id = v_attempt_id;
    
    -- Return the ORIGINAL started_at (not now())
    RETURN jsonb_build_object(
      'attempt_id', v_attempt_id,
      'question_order', v_question_ids,
      'option_orders', '{}'::jsonb,
      'status', 'in_progress',
      'started_at', v_existing_attempt.started_at  -- Original start time!
    );
  ELSE
    -- Create new attempt with questions in original order
    INSERT INTO test_attempts (test_id, student_id, question_order, option_orders, status, started_at)
    VALUES (p_test_id, p_student_id, v_question_ids, '{}'::jsonb, 'in_progress', now())
    RETURNING id INTO v_attempt_id;
    
    RETURN jsonb_build_object(
      'attempt_id', v_attempt_id,
      'question_order', v_question_ids,
      'option_orders', '{}'::jsonb,
      'status', 'in_progress',
      'started_at', now()
    );
  END IF;
END;
$$;

COMMENT ON FUNCTION public.start_test_attempt(uuid, uuid) IS 'Starts or resumes a test attempt. On resume, preserves original start time so timer continues correctly.';

-- Log the fix
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed start_test_attempt: timer no longer resets on page refresh';
  RAISE NOTICE '✅ Resuming an in-progress test now preserves original started_at';
END $$;
-- Add missing columns for configurable test marks
ALTER TABLE tests 
ADD COLUMN IF NOT EXISTS default_marks NUMERIC DEFAULT 1,
ADD COLUMN IF NOT EXISTS negative_marks NUMERIC DEFAULT 1;

-- If you want to update existing records to have these defaults (optional, but recommended for consistency)
UPDATE tests 
SET default_marks = 1 
WHERE default_marks IS NULL;

UPDATE tests 
SET negative_marks = 1 
WHERE negative_marks IS NULL;
-- CRITICAL FIX: Drop ALL versions including old integer[] version that's causing conflicts

-- Drop ALL possible variants
DROP FUNCTION IF EXISTS submit_test_result(uuid, uuid, integer[]);
DROP FUNCTION IF EXISTS submit_test_result(uuid, uuid, integer[], integer);
DROP FUNCTION IF EXISTS submit_test_result(uuid, uuid, integer[], integer, uuid);
DROP FUNCTION IF EXISTS submit_test_result(uuid, uuid, jsonb);
DROP FUNCTION IF EXISTS submit_test_result(uuid, uuid, jsonb, integer);
DROP FUNCTION IF EXISTS submit_test_result(uuid, uuid, jsonb, integer, uuid);

-- Create the ONLY version we need (with jsonb)
CREATE FUNCTION submit_test_result(
  p_test_id uuid,
  p_student_id uuid,
  p_answers jsonb,
  p_time_taken integer DEFAULT 0,
  p_attempt_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_questions jsonb;
  v_total_marks integer := 0;
  v_earned_marks integer := 0;
  v_score numeric;
  v_result_id uuid;
  v_question record;
  v_user_answer integer;
  v_correct_answer integer;
  v_question_marks integer;
  v_question_index integer := 0;
  v_total_questions integer := 0;
  v_negative_marking_enabled boolean;
BEGIN
  -- Get negative marking setting
  SELECT COALESCE(negative_marking_enabled, false) INTO v_negative_marking_enabled
  FROM tests
  WHERE id = p_test_id;

  -- Get questions
  SELECT jsonb_agg(
    jsonb_build_object(
      'correct_answer', correct_answer,
      'marks', marks
    ) ORDER BY order_index
  )
  INTO v_questions
  FROM questions
  WHERE test_id = p_test_id;

  v_total_questions := jsonb_array_length(v_questions);

  -- Calculate total and earned marks
  FOR v_question IN SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_question_marks := COALESCE((v_question.value->>'marks')::integer, 1);
    v_correct_answer := (v_question.value->>'correct_answer')::integer;
    v_user_answer := COALESCE((p_answers->>v_question_index)::integer, -1);
    
    v_total_marks := v_total_marks + v_question_marks;
    
    IF v_user_answer = v_correct_answer AND v_user_answer >= 0 THEN
      v_earned_marks := v_earned_marks + v_question_marks;
    ELSIF v_negative_marking_enabled AND v_user_answer >= 0 AND v_user_answer != v_correct_answer THEN
      v_earned_marks := v_earned_marks - 1;
    END IF;
    
    v_question_index := v_question_index + 1;
  END LOOP;

  v_earned_marks := GREATEST(0, v_earned_marks);

  v_score := CASE 
    WHEN v_total_marks > 0 THEN (v_earned_marks::numeric / v_total_marks::numeric) * 100
    ELSE 0
  END;

  INSERT INTO test_results (test_id, student_id, score, earned_marks, total_marks, total_questions, time_taken, answers, completed_at)
  VALUES (p_test_id, p_student_id, v_score, v_earned_marks, v_total_marks, v_total_questions, p_time_taken, p_answers, now())
  RETURNING id INTO v_result_id;

  IF p_attempt_id IS NOT NULL THEN
    UPDATE test_attempts SET status = 'completed', completed_at = now() WHERE id = p_attempt_id;
  END IF;

  RETURN jsonb_build_object(
    'result_id', v_result_id,
    'score', v_score,
    'earned_marks', v_earned_marks,
    'total_marks', v_total_marks,
    'total_questions', v_total_questions,
    'negative_marking_applied', v_negative_marking_enabled
  );
END;
$$;

-- Update existing results with negative marking
UPDATE test_results tr
SET 
  earned_marks = (
    SELECT GREATEST(0, 
      SUM(CASE 
        WHEN (tr.answers->>q.order_index)::integer = q.correct_answer AND (tr.answers->>q.order_index)::integer >= 0 THEN q.marks
        WHEN (tr.answers->>q.order_index)::integer >= 0 AND (tr.answers->>q.order_index)::integer != q.correct_answer AND t.negative_marking_enabled THEN -1
        ELSE 0
      END)
    )
    FROM questions q
    JOIN tests t ON q.test_id = t.id
    WHERE q.test_id = tr.test_id
  ),
  score = (
    SELECT 
      CASE 
        WHEN SUM(q.marks) > 0 THEN
          (GREATEST(0, 
            SUM(CASE 
              WHEN (tr.answers->>q.order_index)::integer = q.correct_answer AND (tr.answers->>q.order_index)::integer >= 0 THEN q.marks
              WHEN (tr.answers->>q.order_index)::integer >= 0 AND (tr.answers->>q.order_index)::integer != q.correct_answer AND t.negative_marking_enabled THEN -1
              ELSE 0
            END)
          )::numeric / SUM(q.marks)::numeric) * 100
        ELSE 0
      END
    FROM questions q
    JOIN tests t ON q.test_id = t.id
    WHERE q.test_id = tr.test_id
  )
FROM tests t
WHERE tr.test_id = t.id AND t.negative_marking_enabled = true;
-- =================================================================
-- FIX 1: Update existing test results with correct negative marking
-- =================================================================
-- This will recalculate scores for all tests with negative_marking_enabled = true

DO $$
DECLARE
    result_record RECORD;
    question_record RECORD;
    v_earned_marks INTEGER;
    v_total_marks INTEGER;
    v_score NUMERIC;
    v_user_answer INTEGER;
    v_old_earned_marks INTEGER;
    v_old_score NUMERIC;
BEGIN
    -- Loop through all results for tests with negative marking enabled
    FOR result_record IN 
        SELECT tr.id, tr.test_id, tr.answers, tr.student_id, tr.earned_marks as old_earned_marks, tr.score as old_score
        FROM test_results tr
        JOIN tests t ON tr.test_id = t.id
        WHERE t.negative_marking_enabled = true
    LOOP
        v_earned_marks := 0;
        v_total_marks := 0;
        v_old_earned_marks := result_record.old_earned_marks;
        v_old_score := result_record.old_score;
        
        -- Get questions for this test
        FOR question_record IN
            SELECT correct_answer, marks, order_index
            FROM questions
            WHERE test_id = result_record.test_id
            ORDER BY order_index
        LOOP
            v_total_marks := v_total_marks + question_record.marks;
            
            -- Get user's answer
            v_user_answer := COALESCE((result_record.answers->>question_record.order_index)::integer, -1);
            
            -- Calculate marks
            IF v_user_answer = question_record.correct_answer AND v_user_answer >= 0 THEN
                -- Correct answer
                v_earned_marks := v_earned_marks + question_record.marks;
            ELSIF v_user_answer >= 0 AND v_user_answer != question_record.correct_answer THEN
                -- Wrong answer (not blank) - apply penalty
                v_earned_marks := v_earned_marks - 1;
            END IF;
            -- Blank answer (v_user_answer = -1): no change
        END LOOP;
        
        -- Ensure marks never go below 0
        v_earned_marks := GREATEST(0, v_earned_marks);
        
        -- Calculate percentage
        IF v_total_marks > 0 THEN
            v_score := (v_earned_marks::numeric / v_total_marks::numeric) * 100;
        ELSE
            v_score := 0;
        END IF;
        
        -- Update the result
        UPDATE test_results
        SET earned_marks = v_earned_marks,
            score = v_score
        WHERE id = result_record.id;
        
        RAISE NOTICE 'Updated result % - OLD: %/% (%), NEW: %/% (%)', 
            result_record.id, 
            v_old_earned_marks,
            v_total_marks,
            v_old_score,
            v_earned_marks, 
            v_total_marks, 
            v_score;
    END LOOP;
END $$;

-- =================================================================
-- FIX 2: Force recreate the submit_test_result function
-- =================================================================
DROP FUNCTION IF EXISTS submit_test_result(uuid, uuid, jsonb, integer, uuid);

CREATE OR REPLACE FUNCTION submit_test_result(
  p_test_id uuid,
  p_student_id uuid,
  p_answers jsonb,
  p_time_taken integer DEFAULT 0,
  p_attempt_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_questions jsonb;
  v_total_marks integer := 0;
  v_earned_marks integer := 0;
  v_score numeric;
  v_result_id uuid;
  v_question record;
  v_user_answer integer;
  v_correct_answer integer;
  v_question_marks integer;
  v_question_index integer := 0;
  v_total_questions integer := 0;
  v_negative_marking_enabled boolean;
BEGIN
  -- Get the test's negative marking setting
  SELECT negative_marking_enabled INTO v_negative_marking_enabled
  FROM tests
  WHERE id = p_test_id;
  
  v_negative_marking_enabled := COALESCE(v_negative_marking_enabled, false);

  -- Get questions in order
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'correct_answer', correct_answer,
      'marks', marks,
      'order_index', order_index
    ) ORDER BY order_index
  )
  INTO v_questions
  FROM questions
  WHERE test_id = p_test_id;

  v_total_questions := jsonb_array_length(v_questions);

  -- Calculate total marks
  FOR v_question IN 
    SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_question_marks := (v_question.value->>'marks')::integer;
    v_total_marks := v_total_marks + v_question_marks;
  END LOOP;

  -- Calculate earned marks with negative marking
  FOR v_question IN 
    SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_correct_answer := (v_question.value->>'correct_answer')::integer;
    v_question_marks := (v_question.value->>'marks')::integer;
    v_user_answer := COALESCE((p_answers->>v_question_index)::integer, -1);
    
    IF v_user_answer = v_correct_answer AND v_user_answer >= 0 THEN
      v_earned_marks := v_earned_marks + v_question_marks;
    ELSIF v_negative_marking_enabled AND v_user_answer >= 0 AND v_user_answer != v_correct_answer THEN
      v_earned_marks := v_earned_marks - 1;
    END IF;
    
    v_question_index := v_question_index + 1;
  END LOOP;

  v_earned_marks := GREATEST(0, v_earned_marks);

  IF v_total_marks > 0 THEN
    v_score := (v_earned_marks::numeric / v_total_marks::numeric) * 100;
  ELSE
    v_score := 0;
  END IF;

  INSERT INTO test_results (
    test_id,
    student_id,
    score,
    earned_marks,
    total_marks,
    total_questions,
    time_taken,
    answers,
    completed_at
  )
  VALUES (
    p_test_id,
    p_student_id,
    v_score,
    v_earned_marks,
    v_total_marks,
    v_total_questions,
    p_time_taken,
    p_answers,
    now()
  )
  RETURNING id INTO v_result_id;

  IF p_attempt_id IS NOT NULL THEN
    UPDATE test_attempts
    SET status = 'completed', completed_at = now()
    WHERE id = p_attempt_id;
  END IF;

  RETURN jsonb_build_object(
    'result_id', v_result_id,
    'score', v_score,
    'earned_marks', v_earned_marks,
    'total_marks', v_total_marks,
    'total_questions', v_total_questions,
    'negative_marking_applied', v_negative_marking_enabled
  );
END;
$$;
-- MIGRATION 1: Add negative_marking_enabled column
-- Run this first in Supabase SQL Editor
ALTER TABLE tests ADD COLUMN IF NOT EXISTS negative_marking_enabled boolean DEFAULT false;

-- MIGRATION 2: Update submit_test_result function
-- Run this second in Supabase SQL Editor
CREATE OR REPLACE FUNCTION submit_test_result(
  p_test_id uuid,
  p_student_id uuid,
  p_answers jsonb,
  p_time_taken integer,
  p_attempt_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_questions jsonb;
  v_total_marks integer := 0;
  v_earned_marks integer := 0;
  v_score numeric;
  v_result_id uuid;
  v_question record;
  v_user_answer integer;
  v_correct_answer integer;
  v_question_marks integer;
  v_question_index integer := 0;
  v_total_questions integer := 0;
  v_negative_marking_enabled boolean;
BEGIN
  SELECT negative_marking_enabled INTO v_negative_marking_enabled
  FROM tests
  WHERE id = p_test_id;
  
  v_negative_marking_enabled := COALESCE(v_negative_marking_enabled, false);

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'correct_answer', correct_answer,
      'marks', marks,
      'order_index', order_index
    ) ORDER BY order_index
  )
  INTO v_questions
  FROM questions
  WHERE test_id = p_test_id;

  v_total_questions := jsonb_array_length(v_questions);

  FOR v_question IN 
    SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_question_marks := (v_question.value->>'marks')::integer;
    v_total_marks := v_total_marks + v_question_marks;
  END LOOP;

  FOR v_question IN 
    SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_correct_answer := (v_question.value->>'correct_answer')::integer;
    v_question_marks := (v_question.value->>'marks')::integer;
    
    v_user_answer := COALESCE((p_answers->>v_question_index)::integer, -1);
    
    IF v_user_answer = v_correct_answer AND v_user_answer >= 0 THEN
      v_earned_marks := v_earned_marks + v_question_marks;
    ELSIF v_negative_marking_enabled AND v_user_answer >= 0 AND v_user_answer != v_correct_answer THEN
      v_earned_marks := v_earned_marks - 1;
    END IF;
    
    v_question_index := v_question_index + 1;
  END LOOP;

  v_earned_marks := GREATEST(0, v_earned_marks);

  IF v_total_marks > 0 THEN
    v_score := (v_earned_marks::numeric / v_total_marks::numeric) * 100;
  ELSE
    v_score := 0;
  END IF;

  INSERT INTO test_results (
    test_id,
    student_id,
    score,
    earned_marks,
    total_marks,
    total_questions,
    time_taken,
    answers,
    completed_at
  )
  VALUES (
    p_test_id,
    p_student_id,
    v_score,
    v_earned_marks,
    v_total_marks,
    v_total_questions,
    p_time_taken,
    p_answers,
    now()
  )
  RETURNING id INTO v_result_id;

  IF p_attempt_id IS NOT NULL THEN
    UPDATE test_attempts
    SET status = 'completed', completed_at = now()
    WHERE id = p_attempt_id;
  END IF;

  RETURN jsonb_build_object(
    'result_id', v_result_id,
    'score', v_score,
    'earned_marks', v_earned_marks,
    'total_marks', v_total_marks,
    'total_questions', v_total_questions,
    'negative_marking_applied', v_negative_marking_enabled
  );
END;
$$;
-- Run this in Supabase SQL Editor to fix negative marking

-- Step 1: Drop the old function completely
DROP FUNCTION IF EXISTS submit_test_result(uuid, uuid, jsonb, integer, uuid);
DROP FUNCTION IF EXISTS submit_test_result(uuid, uuid, jsonb, integer);
DROP FUNCTION IF EXISTS submit_test_result(uuid, uuid, jsonb);

-- Step 2: Create the new function with correct negative marking logic
CREATE FUNCTION submit_test_result(
  p_test_id uuid,
  p_student_id uuid,
  p_answers jsonb,
  p_time_taken integer DEFAULT 0,
  p_attempt_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_questions jsonb;
  v_total_marks integer := 0;
  v_earned_marks integer := 0;
  v_score numeric;
  v_result_id uuid;
  v_question record;
  v_user_answer integer;
  v_correct_answer integer;
  v_question_marks integer;
  v_question_index integer := 0;
  v_total_questions integer := 0;
  v_negative_marking_enabled boolean;
BEGIN
  -- Get negative marking setting
  SELECT COALESCE(negative_marking_enabled, false) INTO v_negative_marking_enabled
  FROM tests
  WHERE id = p_test_id;

  -- Get questions
  SELECT jsonb_agg(
    jsonb_build_object(
      'correct_answer', correct_answer,
      'marks', marks
    ) ORDER BY order_index
  )
  INTO v_questions
  FROM questions
  WHERE test_id = p_test_id;

  v_total_questions := jsonb_array_length(v_questions);

  -- Calculate total and earned marks
  FOR v_question IN SELECT * FROM jsonb_array_elements(v_questions)
  LOOP
    v_question_marks := COALESCE((v_question.value->>'marks')::integer, 1);
    v_correct_answer := (v_question.value->>'correct_answer')::integer;
    v_user_answer := COALESCE((p_answers->>v_question_index)::integer, -1);
    
    v_total_marks := v_total_marks + v_question_marks;
    
    IF v_user_answer = v_correct_answer AND v_user_answer >= 0 THEN
      v_earned_marks := v_earned_marks + v_question_marks;
    ELSIF v_negative_marking_enabled AND v_user_answer >= 0 AND v_user_answer != v_correct_answer THEN
      v_earned_marks := v_earned_marks - 1;
    END IF;
    
    v_question_index := v_question_index + 1;
  END LOOP;

  v_earned_marks := GREATEST(0, v_earned_marks);

  v_score := CASE 
    WHEN v_total_marks > 0 THEN (v_earned_marks::numeric / v_total_marks::numeric) * 100
    ELSE 0
  END;

  INSERT INTO test_results (test_id, student_id, score, earned_marks, total_marks, total_questions, time_taken, answers, completed_at)
  VALUES (p_test_id, p_student_id, v_score, v_earned_marks, v_total_marks, v_total_questions, p_time_taken, p_answers, now())
  RETURNING id INTO v_result_id;

  IF p_attempt_id IS NOT NULL THEN
    UPDATE test_attempts SET status = 'completed', completed_at = now() WHERE id = p_attempt_id;
  END IF;

  RETURN jsonb_build_object(
    'result_id', v_result_id,
    'score', v_score,
    'earned_marks', v_earned_marks,
    'total_marks', v_total_marks,
    'total_questions', v_total_questions,
    'negative_marking_applied', v_negative_marking_enabled
  );
END;
$$;

-- Step 3: Update existing results
UPDATE test_results tr
SET 
  earned_marks = (
    SELECT GREATEST(0, 
      SUM(CASE 
        WHEN (tr.answers->>q.order_index)::integer = q.correct_answer AND (tr.answers->>q.order_index)::integer >= 0 THEN q.marks
        WHEN (tr.answers->>q.order_index)::integer >= 0 AND (tr.answers->>q.order_index)::integer != q.correct_answer AND t.negative_marking_enabled THEN -1
        ELSE 0
      END)
    )
    FROM questions q
    JOIN tests t ON q.test_id = t.id
    WHERE q.test_id = tr.test_id
  ),
  score = (
    SELECT 
      CASE 
        WHEN SUM(q.marks) > 0 THEN
          (GREATEST(0, 
            SUM(CASE 
              WHEN (tr.answers->>q.order_index)::integer = q.correct_answer AND (tr.answers->>q.order_index)::integer >= 0 THEN q.marks
              WHEN (tr.answers->>q.order_index)::integer >= 0 AND (tr.answers->>q.order_index)::integer != q.correct_answer AND t.negative_marking_enabled THEN -1
              ELSE 0
            END)
          )::numeric / SUM(q.marks)::numeric) * 100
        ELSE 0
      END
    FROM questions q
    JOIN tests t ON q.test_id = t.id
    WHERE q.test_id = tr.test_id
  )
FROM tests t
WHERE tr.test_id = t.id AND t.negative_marking_enabled = true;
