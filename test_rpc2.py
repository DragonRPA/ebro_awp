import os
import requests
from dotenv import load_dotenv

load_dotenv('.env')
SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('VITE_SUPABASE_ANON_KEY')

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}'
}
sql = """
CREATE TABLE IF NOT EXISTS public.tenant_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(50) NOT NULL,
    action_name VARCHAR(100) NOT NULL,
    ui_context_bundle JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tenant_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert for all" ON public.tenant_memories;
CREATE POLICY "Allow insert for all" ON public.tenant_memories FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select for all" ON public.tenant_memories;
CREATE POLICY "Allow select for all" ON public.tenant_memories FOR SELECT USING (true);
"""
# Note: gen_random_uuid() is better than uuid_generate_v4() without extensions
res = requests.post(f"{SUPABASE_URL}/rest/v1/rpc/dev_exec_ddl", headers=headers, json={"query": sql})
print(res.status_code)
print(res.text)
