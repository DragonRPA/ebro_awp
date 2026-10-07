from supabase import create_client, Client
import json
import os

from dotenv import load_dotenv
load_dotenv('.env.local')

supabase: Client = create_client(os.environ.get('VITE_SUPABASE_URL'), os.environ.get('VITE_SUPABASE_ANON_KEY'))

res = supabase.table('tenants').select('*').eq('code', 'GIYEONLIFT').execute()
if res.data:
    print(json.dumps(res.data[0]['features'], ensure_ascii=False, indent=2))
else:
    print("Not found")
