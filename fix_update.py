import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/studioEngine.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_update = '''function updateAgentPolicy(newPolicy) {
  if (typeof newPolicy === 'object' && newPolicy !== null) {
    agentPolicy = {
      ...agentPolicy,
      ...newPolicy,
      updatedAt: new Date().toISOString()
    };
    savePolicy();
    broadcastStudioLog('POLICY', 테넌트 정책 동기화 완료: AI기능=, 테넌트=);
  }
  return agentPolicy;
}'''

new_update = '''function updateAgentPolicy(newPolicy) {
  if (typeof newPolicy === 'object' && newPolicy !== null) {
    agentPolicy = {
      ...agentPolicy,
      ...newPolicy,
      updatedAt: new Date().toISOString()
    };
    savePolicy();
    broadcastStudioLog('POLICY', 테넌트 정책 동기화 완료: AI기능=, 테넌트=);

    if (!agentPolicy.agentAiEnabled) {
      if (typeof stopTelegramBot === 'function') {
        stopTelegramBot();
        broadcastStudioLog('SYSTEM', 'Silent Core 모드 전환에 따라 텔레그램 수신을 일시정지합니다.');
      }
    } else {
      if (typeof restartTelegramBot === 'function') {
        restartTelegramBot(async (text, onComplete) => {
          return await addTask(text, 'BROWSER', onComplete);
        }).catch(() => {});
        broadcastStudioLog('SYSTEM', 'Full AI Studio 모드 전환에 따라 텔레그램 수신을 재개합니다.');
      }
    }
  }
  return agentPolicy;
}'''

if old_update in text:
    text = text.replace(old_update, new_update)
    with open('agent/studioEngine.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed updateAgentPolicy successfully!")
else:
    print("updateAgentPolicy not found.")

