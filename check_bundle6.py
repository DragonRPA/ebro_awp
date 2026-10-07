import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/agent-bundle.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Look for DOM manipulation inside renderStudioHtml script tag
idx = text.find('function checkOllama')
if idx != -1:
    print(text[idx:idx+1500])
