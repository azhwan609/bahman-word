create extension if not exists pgcrypto;

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null,
  content text not null default '',
  tool_name text null,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_memory (
  user_id uuid not null,
  key text not null,
  value text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists public.integrations (
  user_id uuid not null,
  provider text not null,
  external_id text,
  external_username text,
  encrypted_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

create table if not exists public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  module text not null,
  prompt text not null default '',
  output_text text,
  output_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tools (
  name text primary key,
  requires_integration text null
);

create table if not exists public.permissions (
  user_id uuid not null,
  tool_name text not null,
  allowed boolean not null default true,
  primary key (user_id, tool_name)
);

create index if not exists idx_conversations_user_id on public.conversations(user_id);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_generated_assets_user_id on public.generated_assets(user_id);
create index if not exists idx_integrations_user_id on public.integrations(user_id);
create index if not exists idx_activity_logs_user_id on public.activity_logs(user_id);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.agent_memory enable row level security;
alter table public.integrations enable row level security;
alter table public.generated_assets enable row level security;
alter table public.activity_logs enable row level security;
alter table public.permissions enable row level security;

create policy "users can view own conversations"
on public.conversations
for select
using (auth.uid() = user_id);

create policy "users can insert own conversations"
on public.conversations
for insert
with check (auth.uid() = user_id);

create policy "users can update own conversations"
on public.conversations
for update
using (auth.uid() = user_id);

create policy "users can view own messages"
on public.messages
for select
using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  )
);

create policy "users can insert own messages"
on public.messages
for insert
with check (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id and c.user_id = auth.uid()
  )
);

create policy "users can view own memory"
on public.agent_memory
for select
using (auth.uid() = user_id);

create policy "users can upsert own memory"
on public.agent_memory
for insert
with check (auth.uid() = user_id);

create policy "users can update own memory"
on public.agent_memory
for update
using (auth.uid() = user_id);

create policy "users can view own integrations"
on public.integrations
for select
using (auth.uid() = user_id);

create policy "users can upsert own integrations"
on public.integrations
for insert
with check (auth.uid() = user_id);

create policy "users can update own integrations"
on public.integrations
for update
using (auth.uid() = user_id);

create policy "users can view own generated assets"
on public.generated_assets
for select
using (auth.uid() = user_id);

create policy "users can insert own generated assets"
on public.generated_assets
for insert
with check (auth.uid() = user_id);

create policy "users can view own activity logs"
on public.activity_logs
for select
using (auth.uid() = user_id);

create policy "users can insert own activity logs"
on public.activity_logs
for insert
with check (auth.uid() = user_id);

create policy "users can view own permissions"
on public.permissions
for select
using (auth.uid() = user_id);

create policy "users can update own permissions"
on public.permissions
for update
using (auth.uid() = user_id);
