with open('agent/eBroAgent.js', 'r', encoding='utf-8') as f:
    for line in f:
        if 'execSync' in line and 'powershell' in line and 'Command' in line:
            print(line.strip())
