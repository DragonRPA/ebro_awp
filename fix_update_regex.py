import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/studioEngine.js', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = re.compile(r'(function updateAgentPolicy\(newPolicy\)\s*\{[\s\S]*?broadcastStudioLog\([^\n]+\n\s*\})', re.MULTILINE)

new_update = '''\\1
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
    }'''

match = pattern.search(text)
if match:
    text = pattern.sub(new_update, text)
    with open('agent/studioEngine.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Fixed updateAgentPolicy with regex successfully!")
else:
    print("regex match failed")
