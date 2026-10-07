filepath = 'src/pages/Customers.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if "현장 기본상속 옵션/보양 설정" in line:
        # Find the start of the wrapping div
        for j in range(i, i-10, -1):
            if "<!-- 현장 기본상속 옵션/보양 설정 -->" in lines[j] or "{/*" in lines[j]:
                start_idx = j
                break
        
        # Now find the end of this div block.
        # Let's count open/close divs.
        div_count = 0
        started = False
        for k in range(start_idx, i+200):
            line_str = lines[k]
            div_count += line_str.count("<div")
            div_count -= line_str.count("</div")
            if "<div" in line_str:
                started = True
            
            if started and div_count == 0:
                end_idx = k
                break
        break

if start_idx != -1 and end_idx != -1:
    print(f"Removing lines {start_idx} to {end_idx}")
    lines = lines[:start_idx] + lines[end_idx+1:]
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
else:
    print("Could not find the bounds!")
