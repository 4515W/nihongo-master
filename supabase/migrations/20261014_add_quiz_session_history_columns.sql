alter table public.user_quiz_history
  add column if not exists quiz_type text,
  add column if not exists score integer,
  add column if not exists total_questions integer,
  add column if not exists points_earned integer,
  add column if not exists completed_at timestamptz;

alter table public.user_quiz_history
  alter column item_type drop not null,
  alter column item_id drop not null,
  alter column question_type drop not null,
  alter column selected_answer drop not null,
  alter column correct_answer drop not null,
  alter column is_correct drop not null;