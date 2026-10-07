import os
import requests
from dotenv import load_dotenv
import json

load_dotenv('.env')
SUPABASE_URL = os.environ.get('VITE_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('VITE_SUPABASE_ANON_KEY')

# We can run this via the supabase pgcrypto / rest API or we can just use python to execute raw sql if we have postgres url.
# Wait, we might not have the postgres connection string in env.
# Let's check env vars.
