CREATE TABLE IF NOT EXISTS public.tenant_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(50) NOT NULL,
    action_name VARCHAR(100) NOT NULL,
    ui_context_bundle JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tenant_memories ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert (eBroAgent uses anon/service role or anon with specific RLS, but let's just create a policy for anon/authenticated for now for the PoC)
CREATE POLICY "Allow insert for all" ON public.tenant_memories
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow select for all" ON public.tenant_memories
    FOR SELECT USING (true);
