-- Central DB에 생성할 공유 기억 테이블 스키마

CREATE TABLE IF NOT EXISTS public.awp_shared_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL,
    action_name VARCHAR(100) NOT NULL,
    ui_context_bundle JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.awp_shared_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow insert for all" ON public.awp_shared_memories;
CREATE POLICY "Allow insert for all" ON public.awp_shared_memories FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow select for all" ON public.awp_shared_memories;
CREATE POLICY "Allow select for all" ON public.awp_shared_memories FOR SELECT USING (true);


CREATE TABLE IF NOT EXISTS public.it_shared_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL,
    action_name VARCHAR(100) NOT NULL,
    ui_context_bundle JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.it_shared_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow insert for all" ON public.it_shared_memories;
CREATE POLICY "Allow insert for all" ON public.it_shared_memories FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow select for all" ON public.it_shared_memories;
CREATE POLICY "Allow select for all" ON public.it_shared_memories FOR SELECT USING (true);
