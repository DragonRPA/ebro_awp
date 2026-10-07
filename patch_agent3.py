with open('agent/eBroAgent.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("{ encoding: 'utf8' }).trim();", "{ encoding: 'utf8', windowsHide: true }).trim();")
text = text.replace("{ stdio: 'ignore' });", "{ stdio: 'ignore', windowsHide: true });")

with open('agent/eBroAgent.js', 'w', encoding='utf-8') as f:
    f.write(text)
