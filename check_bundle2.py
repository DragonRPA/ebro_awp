import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/agent-bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('Ollama')
if idx != -1:
    print(text[idx-200:idx+200])
else:
    print('Not found')
