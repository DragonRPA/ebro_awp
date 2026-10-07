import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/agent-bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('renderStudioHtml')
if idx != -1:
    print(text[idx:idx+500])
else:
    print('Not found')
