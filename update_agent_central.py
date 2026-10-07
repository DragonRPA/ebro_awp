import os
import re

filepath = 'agent/eBroAgent.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Add central constants
central_constants = """const CENTRAL_SUPABASE_REST_URL = 'https://nyfashwbdcepncpdwpdb.supabase.co/rest/v1';
const CENTRAL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55ZmFzaHdiZGNlcG5jcGR3cGRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTExOTUwMjgsImV4cCI6MjEwNjc3MTAyOH0.xw2XKKzjPj_HjQzPJDMKkkbaO7htojYioIMGt4l8VLM';
"""
if 'CENTRAL_SUPABASE_REST_URL' not in content:
    target = r"""const SUPABASE_ANON_KEY = '.*?';"""
    replacement = r"\g<0>\n" + central_constants
    content = re.sub(target, replacement, content)

# Add route
route_logic = """
  if (req.method === 'POST' && pathname === '/api/hindsight/retain') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const { action_name, ui_context_bundle } = payload;
        if (!action_name) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'action_name is required' }));
          return;
        }

        const tenantId = (TENANT_CODE === 'GIYEONLIFT' || TENANT_CODE === 'GIYEUN') ? 'giyeun' : TENANT_CODE.toLowerCase();
        
        // 업종 분기 (임시: 모두 AWP로 간주)
        const targetTable = 'awp_shared_memories';
        
        const dbPayload = {
          tenant_id: tenantId,
          action_name: action_name,
          ui_context_bundle: ui_context_bundle || {}
        };

        await httpRequestJson(`${CENTRAL_SUPABASE_REST_URL}/${targetTable}`, {
          method: 'POST',
          headers: {
            'apikey': CENTRAL_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${CENTRAL_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          timeout: 5000
        }, dbPayload);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, message: 'Memory retained silently in CENTRAL DB' }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: 'Silent fail' }));
      }
    });
    return;
  }
"""

if '/api/hindsight/retain' not in content:
    target = r"""// 7\. û   0 ̷Ʈ μ API"""
    replacement = route_logic + "\n  " + target
    content = re.sub(target, replacement, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated eBroAgent.js")
