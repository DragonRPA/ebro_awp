import re

with open('src/utils/hindsightTracker.ts', 'r', encoding='utf-8') as f:
    content = f.read()

new_func = """async function sendToHindsightAgent(payload: HindsightMemoryBundle) {
  // 1. Local Agent (Zero-Interference)
  fetch(LOCAL_AGENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(res => {
    if (!res.ok) console.warn('[HINDSIGHT] Local agent failed');
  }).catch(() => {});

  // 2. Direct insert to Central Supabase
  try {
    const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('tenantId') || 'unknown';
    const solution = (localStorage.getItem('ebro_current_solution') || 'AWP').toUpperCase();
    const tableName = solution === 'IT' ? 'it_shared_memories' : 'awp_shared_memories';
    
    await centralSupabase.from(tableName).insert({
      tenant_id: tenantId,
      action_name: payload.action_name,
      ui_context_bundle: payload.ui_context_bundle
    });
    console.log('[HINDSIGHT] Saved memory to ' + tableName);
  } catch (err) {
    console.warn('[HINDSIGHT] Failed to save central memory:', err);
  }
}"""

content = re.sub(r'function sendToHindsightAgent[\s\S]*$', new_func, content)

with open('src/utils/hindsightTracker.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Patched.')
