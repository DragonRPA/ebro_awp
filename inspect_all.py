with open('agent/eBroAgent.js', 'r', encoding='utf-8') as f:
    for line in f:
        if 'exec' in line and 'powershell' in line:
            print(line.strip())
