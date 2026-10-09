-- Run this once in Supabase: SQL Editor -> New query -> Run.

create table if not exists public.reaction_votes (
  page_id text not null check (char_length(page_id) between 1 and 200),
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'love', 'laugh', 'think')),
  created_at timestamptz not null default now(),
  primary key (page_id, user_id, reaction)
);

alter table public.reaction_votes enable row level security;
revoke all on table public.reaction_votes from anon, authenticated;

create or replace function public.get_reaction_counts(p_page_id text)
returns table (reaction text, count bigint, selected boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    votes.reaction,
    count(*)::bigint,
    bool_or(votes.user_id = auth.uid())
  from public.reaction_votes as votes
  where votes.page_id = p_page_id
  group by votes.reaction;
$$;

create or replace function public.toggle_reaction(p_page_id text, p_reaction text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(p_page_id) not between 1 and 200 then
    raise exception 'Invalid page';
  end if;

  if p_reaction not in ('like', 'love', 'laugh', 'think') then
    raise exception 'Invalid reaction';
  end if;

  if exists (
    select 1
    from public.reaction_votes
    where page_id = p_page_id
      and user_id = current_user_id
      and reaction = p_reaction
  ) then
    delete from public.reaction_votes
    where page_id = p_page_id
      and user_id = current_user_id
      and reaction = p_reaction;
    return false;
  end if;

  insert into public.reaction_votes (page_id, user_id, reaction)
  values (p_page_id, current_user_id, p_reaction);
  return true;
end;
$$;

revoke all on function public.get_reaction_counts(text) from public, anon;
revoke all on function public.toggle_reaction(text, text) from public, anon;
grant execute on function public.get_reaction_counts(text) to authenticated;
grant execute on function public.toggle_reaction(text, text) to authenticated;
