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

res = requests.get(f'{SUPABASE_URL}/rest/v1/agent_registry?limit=1', headers=headers)
print(f"Status: {res.status_code}")
print(res.text)
