import os

filepath = 'agent/eBroAgent.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

target = """async function sendStationHeartbeat() {
  if (!activeStationConfig || !activeStationConfig.stationId) return;"""

replacement = """async function sendAgentHeartbeat() {
  try {
    const pcName = os.hostname();
    const deviceId = DEV-;
    const tenantId = (TENANT_CODE === 'GIYEONLIFT' || TENANT_CODE === 'GIYEUN') ? 'giyeun' : TENANT_CODE.toLowerCase();
    const id = HEARTBEAT--;
    
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
    
    await httpRequestJson(${SUPABASE_REST_URL}/agent_heartbeats, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': Bearer ,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      },
      timeout: 4000
    }, payload);
  } catch (e) {}
}

async function sendStationHeartbeat() {
  if (!activeStationConfig || !activeStationConfig.stationId) return;"""

content = content.replace(target, replacement)

target2 = "setInterval(() => { sendStationHeartbeat().catch(() => {}); }, 30000);"
replacement2 = "setInterval(() => { sendStationHeartbeat().catch(() => {}); }, 30000);\n  }\n  setInterval(() => { sendAgentHeartbeat().catch(() => {}); }, 15000);\n  sendAgentHeartbeat();"
# Wait, let's carefully replace target2
# Original:
#     if (activeStationConfig && activeStationConfig.stationId) {
#      scheduleNextPrintQueueCheck(5000);
#      setInterval(() => { sendStationHeartbeat().catch(() => {}); }, 30000);
#    }

target_call = """  if (activeStationConfig && activeStationConfig.stationId) {
    scheduleNextPrintQueueCheck(5000);
    setInterval(() => { sendStationHeartbeat().catch(() => {}); }, 30000);
  }"""

replacement_call = """  if (activeStationConfig && activeStationConfig.stationId) {
    scheduleNextPrintQueueCheck(5000);
    setInterval(() => { sendStationHeartbeat().catch(() => {}); }, 30000);
  }
  
  setInterval(() => { sendAgentHeartbeat().catch(() => {}); }, 15000);
  sendAgentHeartbeat();"""

content = content.replace(target_call, replacement_call)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated eBroAgent.js")
