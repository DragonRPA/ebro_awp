import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/agent-bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('openConfigModal')
if idx != -1:
    print('Found openConfigModal!')
    print(text[idx:idx+100])
else:
    print('openConfigModal NOT FOUND in agent-bundle.js!!!')
