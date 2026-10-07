import os
import re

filepath = 'agent/eBroAgent.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken interpolation
content = re.sub(r'deviceId = DEV-;', r'deviceId = `DEV-${pcName}`;', content)
content = re.sub(r'id = HEARTBEAT--', r'id = `HEARTBEAT-${tenantId}-${deviceId}`;', content)

# I should replace the whole function to be safe.
target = r"""async function sendAgentHeartbeat\(\) \{.*?\nasync function sendStationHeartbeat"""

replacement = """async function sendAgentHeartbeat() {
  try {
    const pcName = os.hostname();
    const deviceId = `DEV-${pcName}`;
    const tenantId = (TENANT_CODE === 'GIYEONLIFT' || TENANT_CODE === 'GIYEUN') ? 'giyeun' : TENANT_CODE.toLowerCase();
    const id = `HEARTBEAT-${tenantId}-${deviceId}`;
    
    const netInterfaces = os.networkInterfaces();
    let ipAddress = '127.0.0.1';
    for (const dev of Object.keys(netInterfaces)) {
      for (const details of netInterfaces[dev]) {
        if (details.family === 'IPv4' && !details.internal) {
          ipAddress = details.address;
          break;
        }
      }
    }
    
    const payload = {
      id: id,
      tenant_id: tenantId,
      device_id: deviceId,
      pc_name: pcName,
      user_id: CALLSIGN,
      user_name: '사용자',
      ip_address: ipAddress,
      engine_version: VERSION,
      status: 'ONLINE',
      last_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    await httpRequestJson(`${SUPABASE_REST_URL}/agent_heartbeats`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      timeout: 4000
    }, payload);
  } catch (e) {}
}

async function sendStationHeartbeat"""

content = re.sub(target, replacement, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Fixed eBroAgent.js")
