import os
import requests
from dotenv import load_dotenv

load_dotenv('.env')
SUPABASE_URL = os.environ.get('VITE_CENTRAL_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('VITE_CENTRAL_SUPABASE_ANON_KEY')

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}'
}

# we don't have dev_exec_ddl, so user needs to run central_memories_table.sql
