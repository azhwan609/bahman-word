create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
create table public.profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  display_name text,
  language text not null default 'en',
  updated_at timestamptz not null default now()
);
create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null default 'Creator AI',
  provider text not null default 'auto',
  system_prompt text,
  created_at timestamptz not null default now()
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  agent_id uuid references public.ai_agents(id) on delete set null,
  title text,
  created_at timestamptz not null default now()
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null,
  tool_name text,
  created_at timestamptz not null default now()
);
create table public.tools (
  name text primary key,
  label text not null,
  requires_integration text,
  risk text not null default 'low' check (risk in ('low','medium','high'))
);
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null,
  external_id text,
  external_username text,
  encrypted_token text not null default '',
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active','revoked')),
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);
create table public.permissions (
  user_id uuid not null references public.users(id) on delete cascade,
  tool_name text not null references public.tools(name) on delete cascade,
  allowed boolean not null default true,
  primary key (user_id, tool_name)
);
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  action text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.agent_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);
create table public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('image','text')),
  module text not null,
  prompt text not null,
  output_url text,
  output_text text,
  created_at timestamptz not null default now()
);

insert into public.tools (name,label,requires_integration,risk) values
 ('generate_image','Image generation',null,'low'),
 ('generate_content','Captions, hashtags, brand, stickers',null,'low'),
 ('business_ideas','Business idea generator',null,'low'),
 ('username_search','Deep username search',null,'medium'),
 ('connect_instagram','Connect Instagram (OAuth)',null,'medium'),
 ('instagram_profile','Read Instagram profile','instagram','medium'),
 ('disconnect_integration','Disconnect an integration',null,'high');

-- Provision public.users + profiles on signup
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id,email) values (new.id,new.email);
  insert into public.profiles (user_id,display_name) values (new.id, split_part(new.email,'@',1));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Row Level Security
alter table public.users enable row level security;
create policy own_user on public.users for select using (id = auth.uid());

do $$ declare t text; begin
  foreach t in array array['profiles','ai_agents','conversations','agent_memory','generated_assets','permissions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy own_rows on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table public.messages enable row level security;
create policy own_messages on public.messages for all
  using (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id and c.user_id = auth.uid()));

alter table public.tools enable row level security;
create policy read_tools on public.tools for select to authenticated using (true);

alter table public.activity_logs enable row level security;
create policy read_own_logs on public.activity_logs for select using (user_id = auth.uid());

-- integrations: RLS on, NO client policies => tokens only reachable by service role (edge functions)
alter table public.integrations enable row level security;

-- Private storage for generated images
insert into storage.buckets (id,name,public) values ('creator-assets','creator-assets',false) on conflict do nothing;
create policy own_assets on storage.objects for all
  using (bucket_id = 'creator-assets' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'creator-assets' and (storage.foldername(name))[1] = auth.uid()::text);

