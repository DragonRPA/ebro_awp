with open('agent/eBroAgent.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix API printers call
text = text.replace(
    "execSync(powershell -NoProfile -Command \"\", { encoding: 'utf8' })",
    "execSync(powershell -NoProfile -Command \"\", { encoding: 'utf8', windowsHide: true })"
)

# Fix print-dispatch
text = text.replace(
    "execSync(powershell -NoProfile -Command \"\", { stdio: 'ignore' })",
    "execSync(powershell -NoProfile -Command \"\", { stdio: 'ignore', windowsHide: true })"
)

# Fix printQueue execution
text = text.replace(
    "execSync(powershell -NoProfile -Command \"\", { stdio: 'ignore' });",
    "execSync(powershell -NoProfile -Command \"\", { stdio: 'ignore', windowsHide: true });"
)

with open('agent/eBroAgent.js', 'w', encoding='utf-8') as f:
    f.write(text)
