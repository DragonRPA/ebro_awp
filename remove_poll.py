import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('agent/eBroAgent.js', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = re.compile(r'async function pollTenantPolicy\(\) \{[\s\S]*?setInterval\(\(\) => \{ pollTenantPolicy\(\)\.catch\(\(\) => \{\}\); \}, 15000\);\s*pollTenantPolicy\(\);\s*', re.MULTILINE)

match = pattern.search(text)
if match:
    text = text[:match.start()] + text[match.end():]
    with open('agent/eBroAgent.js', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Removed pollTenantPolicy successfully!")
else:
    print("pollTenantPolicy not found.")
