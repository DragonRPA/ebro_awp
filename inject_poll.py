import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/eBroAgent.js', 'r', encoding='utf-8') as f:
    text = f.read()

poll_code = '''
async function pollTenantPolicy() {
  try {
    const { getAgentPolicy, updateAgentPolicy } = require('./studioEngine');
    const queryUrl = ${SUPABASE_REST_URL}/tenants?select=features&tenant_code=eq.;
    const res = await httpRequestJson(queryUrl, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': Bearer ,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    if (res && res.length > 0 && res[0].features) {
      const dbAiEnabled = Boolean(res[0].features.agentAiEnabled);
      const currentPolicy = getAgentPolicy();
      const currentAiEnabled = Boolean(currentPolicy.agentAiEnabled);
      if (dbAiEnabled !== currentAiEnabled) {
        agentLog('POLICY', 클라우드 관제센터 정책 동기화 감지 (AI모드: ));
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

if 'pollTenantPolicy' not in text:
    pattern = re.compile(r'setTimeout\(\(\) => \{ checkAndApplyUpdate')
    match = pattern.search(text)
    if match:
        text = text[:match.start()] + poll_code + "\n\n  " + text[match.start():]
        with open('agent/eBroAgent.js', 'w', encoding='utf-8') as f:
            f.write(text)
        print("Injected pollTenantPolicy successfully!")
    else:
        print("Could not find anchor for injection.")
else:
    print("Already injected.")
