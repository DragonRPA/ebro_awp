import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/eBroAgent.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the broken line
old_line = "const queryUrl = /tenants?select=features&tenant_code=eq.;"
# Actually I'll just use regex to replace the whole pollTenantPolicy block
pattern = re.compile(r'async function pollTenantPolicy\(\) \{[\s\S]*?setInterval\(\(\) => \{ pollTenantPolicy\(\)\.catch\(\(\) => \{\}\); \}, 15000\);\s*pollTenantPolicy\(\);\s*', re.MULTILINE)

new_code = '''async function pollTenantPolicy() {
  try {
    const { getAgentPolicy, updateAgentPolicy } = require('./studioEngine');
    const queryUrl = SUPABASE_REST_URL + '/tenants?select=features&tenant_code=eq.' + encodeURIComponent(TENANT_CODE);
    const res = await httpRequestJson(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    if (res && res.length > 0 && res[0].features) {
      const dbAiEnabled = Boolean(res[0].features.agentAiEnabled);
      const currentPolicy = getAgentPolicy();
      const currentAiEnabled = Boolean(currentPolicy.agentAiEnabled);
      if (dbAiEnabled !== currentAiEnabled) {
        agentLog('POLICY', '클라우드 관제센터 정책 동기화 감지 (AI모드: ' + (dbAiEnabled ? 'ON' : 'OFF') + ')');
        if (typeof updateAgentPolicy === 'function') {
          updateAgentPolicy({ agentAiEnabled: dbAiEnabled, tenantCode: TENANT_CODE });
        }
      }
    }
  } catch (err) {
    // ignore
  }
}
setInterval(() => { pollTenantPolicy().catch(() => {}); }, 15000);
pollTenantPolicy();
'''

text = pattern.sub(new_code, text)
with open('agent/eBroAgent.js', 'w', encoding='utf-8') as f:
    f.write(text)
print("Fixed broken poll block")
