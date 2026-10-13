create table if not exists public.user_item_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('kanji', 'kotoba', 'bunpou')),
  item_id text not null,
  streak_count integer not null default 0 check (streak_count >= 0),
  is_mastered boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

alter table public.user_item_progress enable row level security;

create policy "Users can read their own item progress"
  on public.user_item_progress for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own item progress"
  on public.user_item_progress for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own item progress"
  on public.user_item_progress for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.user_quiz_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null check (item_type in ('kanji', 'kotoba', 'bunpou')),
  item_id text not null,
  question_type text not null check (question_type in ('reading', 'meaning')),
  selected_answer text not null,
  correct_answer text not null,
  is_correct boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists user_quiz_history_user_created_idx
  on public.user_quiz_history (user_id, created_at desc);

alter table public.user_quiz_history enable row level security;

create policy "Users can read their own quiz history"
  on public.user_quiz_history for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own quiz history"
  on public.user_quiz_history for insert
  to authenticated
  with check (auth.uid() = user_id);