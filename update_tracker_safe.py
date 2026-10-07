import re

filepath = 'src/utils/hindsightTracker.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace LOCAL_AGENT_URL with Direct Supabase REST call
central_url = "'https://nyfashwbdcepncpdwpdb.supabase.co/rest/v1/awp_shared_memories'"
central_key = "'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmFzaHdiZGNlcG5jcGR3cGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTUwMjgsImV4cCI6MjEwNjc3MTAyOH0.xw2XKKzjPj_HjQzPJDMKkkbaO7htojYioIMGt4l8VLM'"

new_fetch = f"""
    const CENTRAL_SUPABASE_REST_URL = {central_url};
    const CENTRAL_SUPABASE_ANON_KEY = {central_key};

    fetch(CENTRAL_SUPABASE_REST_URL, {{
      method: 'POST',
      headers: {{
        'Content-Type': 'application/json',
        'apikey': CENTRAL_SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${{CENTRAL_SUPABASE_ANON_KEY}}`,
        'Prefer': 'return=minimal'
      }},
      body: JSON.stringify({{
        tenant_id: window.location.hostname || 'unknown-tenant',
        action_name: bundle.action_name,
        ui_context_bundle: bundle.ui_context_bundle
      }})
    }}).catch(err => console.error('[Hindsight] Failed to sync memory:', err))"""

start_fetch = content.find("fetch(LOCAL_AGENT_URL")
if start_fetch != -1:
    end_fetch = content.find(".catch(err => console.error", start_fetch)
    if end_fetch == -1:
        end_fetch = content.find("});", start_fetch) + 2
    else:
        end_fetch = content.find(");", end_fetch) + 2

    # Let's use regex to find the exact block to replace
    content = re.sub(r'fetch\(LOCAL_AGENT_URL.*?\}\)\.catch\([^)]+\);', new_fetch + ';', content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated hindsightTracker.ts to use direct Central Supabase REST")
