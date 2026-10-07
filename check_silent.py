import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/studioEngine.js', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function renderSilentCoreHtml')
print(text[idx:idx+1500])
