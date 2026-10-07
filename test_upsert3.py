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

payload = {
    'id': 'HEARTBEAT-TEST-001',
    'tenant_id': 'giyeun',
    'device_id': 'DEV-001',
    'pc_name': 'TEST-PC',
    'engine_version': 'v1.0.0'
}

res = requests.post(f'{SUPABASE_URL}/rest/v1/agent_heartbeats', headers={**headers, 'Prefer': 'resolution=merge-duplicates'}, json=payload)
print(f"Status: {res.status_code}")
print(res.text)
