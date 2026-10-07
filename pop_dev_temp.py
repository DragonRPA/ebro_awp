with open('dev_temp.md', 'r', encoding='utf-8') as f:
    lines = f.readlines()

with open('dev_temp.md', 'w', encoding='utf-8') as f:
    for line in lines:
        if '로컬 AI 모델 로딩 시 사용자에게 예상 소요시간 안내 UI 추가' in line:
            continue
        f.write(line)
