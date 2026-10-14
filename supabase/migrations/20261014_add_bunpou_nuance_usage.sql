alter table public.bunpou
  add column if not exists nuance_usage text,
  add column if not exists example_meaning text;

update public.bunpou
set nuance_usage = nuance
where nuance_usage is null and nuance is not null;