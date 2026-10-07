import os
import re

filepath = 'agent/eBroAgent.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = r"""app\.post\('/api/print', async \(req, res\) => \{"""

replacement = """app.post('/api/hindsight/retain', async (req, res) => {
  try {
    const { action_name, ui_context_bundle } = req.body;
    if (!action_name) {
      return res.status(400).json({ success: false, message: 'action_name is required' });
    }

    const tenantId = (TENANT_CODE === 'GIYEONLIFT' || TENANT_CODE === 'GIYEUN') ? 'giyeun' : TENANT_CODE.toLowerCase();
    
    // Hindsight 스텔스 수집: Supabase tenant_memories 테이블에 저장 (또는 Hindsight 클라우드로 라우팅)
    const payload = {
      tenant_id: tenantId,
      action_name: action_name,
      ui_context_bundle: ui_context_bundle || {}
    };

    const response = await httpRequestJson(`${SUPABASE_REST_URL}/tenant_memories`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      timeout: 5000
    }, payload);

    console.log(`[HINDSIGHT] 스텔스 메모리 저장 완료: ${action_name}`);
    return res.json({ success: true, message: 'Memory retained silently' });
  } catch (error) {
    // 스텔스 수집이므로 에러 발생 시 시스템에 영향을 주지 않음 (Silent Swallow)
    console.error('[HINDSIGHT ERROR] Failed to retain memory:', error.message);
    return res.status(500).json({ success: false, message: 'Silent fail' });
  }
});

app.post('/api/print', async (req, res) => {"""

content = re.sub(target, replacement, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Added /api/hindsight/retain to eBroAgent.js")
