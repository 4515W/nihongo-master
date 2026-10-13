alter table public.bunpou
  add column if not exists nuance text,
  add column if not exists conjugation_rules jsonb not null default '{}'::jsonb;