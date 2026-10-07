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
res = requests.get(f"{SUPABASE_URL}/rest/v1/", headers=headers)
print(res.status_code)
# Get a glimpse of the tables
# Let's try getting swagger definitions
res2 = requests.get(f"{SUPABASE_URL}/rest/v1/?apikey={SUPABASE_KEY}")
import json
data = res2.json()
print("Tables:", [k for k in data.get('definitions', {}).keys()])
