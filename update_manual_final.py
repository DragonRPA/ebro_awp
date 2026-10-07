import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('docs/e_Bro_Manual.md', 'r', encoding='utf-8') as f:
    text = f.read()

m03_pattern = re.compile(r'(### [^\n]*\[M-03\] 계약 관리.*?(?=### [^\n]*\[M-04\]))', re.DOTALL)
site_option_manual = '''### 🛠️ [M-03-A] 현장별 옵션 관리 (src/pages/SiteOptionManage.tsx)
- **화면 목적**: 각 현장에 기계가 들어갈 때 꼭 필요한 유상 옵션, 보양 작업, 특수 요구 사양을 미리 지정해 둡니다.
- **핵심 정책**: 이 옵션들은 고객(건설사 등)이 아니라 **오로지 "현장"에 묶입니다**. 한 현장에 여러 협력사가 들어오더라도 현장 규칙은 똑같기 때문입니다.
- **UI 아키타입**: 마스터 스튜디오 (유형 A)
- **14세 눈높이 조작 순서 (Z-동선)**:
  1. **① 왼쪽 위**: 왼쪽에 뜬 현장 목록에서 옵션을 설정할 현장을 하나 고릅니다.
  2. **② 오른쪽 위**: 유상 옵션이나 요구 사양 섹션 상단에 있는 **드롭다운(셀렉터)**을 누릅니다.
  3. **③ 가운데 넓은 곳**: 등록된 "마스터 품목" 리스트가 쭈욱 뜨면, 그중 현장에 필요한 걸 골라 **쏙 추가**합니다. 수백 개 체크박스에 시달릴 필요 없이, 추가된 옵션만 깔끔하게 보입니다. 단가나 메모를 수정할 수 있고, 잘못 추가했으면 [제외] 버튼으로 뺍니다.
  4. **④ 오른쪽 아래**: 추가된 옵션들로 계산된 총액을 확인하고 **[저장]** 버튼을 누릅니다.

'''
match = m03_pattern.search(text)
if match:
    text = text[:match.end()] + site_option_manual + text[match.end():]
    with open('docs/e_Bro_Manual.md', 'w', encoding='utf-8') as f:
        f.write(text)
    print("M-03-A added successfully!")
else:
    print("M-03 STILL NOT MATCHED")
