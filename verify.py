with open('docs/e_Bro_Manual.md', 'r', encoding='utf-8') as f:
    text = f.read()
    if '초성 검색' in text:
        print("초성 검색 added!")
    else:
        print("초성 검색 failed!")
    if 'M-03-A' in text:
        print("M-03-A added!")
    else:
        print("M-03-A failed!")
