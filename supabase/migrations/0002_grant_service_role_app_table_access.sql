-- Allow the trusted Edge Function service_role to access app data.
-- This does not grant these privileges to anon/authenticated client roles.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.users,
  public.profiles,
  public.ai_agents,
  public.conversations,
  public.messages,
  public.tools,
  public.integrations,
  public.permissions,
  public.activity_logs,
  public.agent_memory,
  public.generated_assets
TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
