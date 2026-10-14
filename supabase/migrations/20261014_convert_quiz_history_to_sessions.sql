alter table public.user_quiz_history
  add column if not exists quiz_type text,
  add column if not exists score integer,
  add column if not exists total_questions integer,
  add column if not exists points_earned integer,
  add column if not exists completed_at timestamptz;

update public.user_quiz_history
set
  quiz_type = coalesce(quiz_type, case
    when item_type = 'kanji' then 'kanji_' || question_type
    when item_type is not null then item_type
    else 'review'
  end),
  score = coalesce(score, case when is_correct then 100 else 0 end),
  total_questions = coalesce(total_questions, 1),
  points_earned = coalesce(points_earned, case when is_correct then 10 else 0 end),
  completed_at = coalesce(completed_at, created_at, now());

alter table public.user_quiz_history
  alter column quiz_type set not null,
  alter column score set not null,
  alter column total_questions set not null,
  alter column points_earned set not null,
  alter column completed_at set not null,
  alter column item_type drop not null,
  alter column item_id drop not null,
  alter column question_type drop not null,
  alter column selected_answer drop not null,
  alter column correct_answer drop not null,
  alter column is_correct drop not null;