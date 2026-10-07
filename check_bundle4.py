import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/agent-bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('renderStudioHtml')
if idx != -1:
    idx2 = text.find('ollamaModelSelect', idx)
    if idx2 != -1:
        print(text[idx2-200:idx2+400])
