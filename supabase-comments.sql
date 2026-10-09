-- Run this once in Supabase: SQL Editor -> New query -> Run.

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  page_id text not null check (char_length(page_id) between 1 and 200),
  user_id uuid not null references auth.users(id) on delete cascade,
  nickname text not null default 'Anonymous' check (char_length(nickname) between 1 and 80),
  body text not null check (char_length(body) between 2 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists comments_page_status_created_idx
  on public.comments (page_id, status, created_at);

alter table public.comments enable row level security;
revoke all on table public.comments from anon, authenticated;

create or replace function public.get_approved_comments(p_page_id text)
returns table (id bigint, nickname text, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select comments.id, comments.nickname, comments.body, comments.created_at
  from public.comments as comments
  where comments.page_id = p_page_id
    and comments.status = 'approved'
  order by comments.created_at asc;
$$;

create or replace function public.submit_comment(
  p_page_id text,
  p_nickname text,
  p_body text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  new_comment_id bigint;
  clean_nickname text := trim(coalesce(p_nickname, ''));
  clean_body text := trim(coalesce(p_body, ''));
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if char_length(p_page_id) not between 1 and 200 then
    raise exception 'Invalid page';
  end if;

  if clean_nickname = '' then
    clean_nickname := 'Anonymous';
  end if;

  if char_length(clean_nickname) > 80 then
    raise exception 'Name is too long';
  end if;

  if char_length(clean_body) not between 2 and 2000 then
    raise exception 'Comment must be between 2 and 2000 characters';
  end if;

  if exists (
    select 1
    from public.comments
    where user_id = current_user_id
      and created_at > now() - interval '1 minute'
  ) then
    raise exception 'Please wait before commenting again';
  end if;

  insert into public.comments (page_id, user_id, nickname, body)
  values (p_page_id, current_user_id, clean_nickname, clean_body)
  returning id into new_comment_id;

  return new_comment_id;
end;
$$;

revoke all on function public.get_approved_comments(text) from public, anon;
revoke all on function public.submit_comment(text, text, text) from public, anon;
grant execute on function public.get_approved_comments(text) to authenticated;
grant execute on function public.submit_comment(text, text, text) to authenticated;
