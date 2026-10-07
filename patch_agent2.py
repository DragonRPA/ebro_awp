import re
with open('agent/eBroAgent.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = re.sub(r"execSync\(powershell -NoProfile -Command \"\$\{psCmd\}\", \{ encoding: 'utf8' \}\)", "execSync(powershell -NoProfile -Command \"\", { encoding: 'utf8', windowsHide: true })", text)
text = re.sub(r"execSync\(powershell -NoProfile -Command \"\$\{printCmd\}\", \{ stdio: 'ignore' \}\)", "execSync(powershell -NoProfile -Command \"\", { stdio: 'ignore', windowsHide: true })", text)

with open('agent/eBroAgent.js', 'w', encoding='utf-8') as f:
    f.write(text)
