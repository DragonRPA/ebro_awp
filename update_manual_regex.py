import sys
import io
import re

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('docs/e_Bro_Manual.md', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update Dispatch
# Find [M-06] ... and the next ###
m06_pattern = re.compile(r'### [^\n]*\[M-06\] 스마트 발주(.*?)(?=### |$)', re.DOTALL)
new_dispatch = '''### 🚜 [M-06] 스마트 발주 / 출고 의뢰 (src/components/smart_dispatch4.tsx)
- **화면 목적**: 현장으로 기계를 보내기 위해 필요한 계약서, 배차의뢰서, 검수요청서를 한 번에 발행합니다.
- **UI 아키타입**: 마스터 스튜디오 (유형 A)
- **14세 눈높이 조작 순서 (Z-동선)**:
  1. **① 왼쪽 위**: 기계를 보낼 현장 이름을 고릅니다. (전체 목록을 뒤질 필요 없이 **초성 검색** 기능으로 빠르게 찾을 수 있습니다!) 중복 버튼을 최소화하여 화면이 직관적입니다.
  2. **② 오른쪽 위**: 필요한 기계 모델과 수량을 고릅니다.
  3. **③ 가운데 넓은 곳**: 현장 주소, 하차 방식(셀프로더), 인수자 전화번호가 맞는지 눈으로 확인합니다.
  4. **④ 오른쪽 아래**: **[스마트 발주 확정]** 버튼을 누르면 계약서와 배차의뢰서, 검수요청서가 한 번에 완성됩니다!

### 🎙️ [M-06-A] AI 통화음성 출고 (개발중) (src/components/voice_dispatch.tsx)
- **화면 목적**: 통화 녹음 파일이나 음성을 올려서 AI가 내용을 알아듣고 알아서 출고 의뢰서를 작성해 주는 자동화 메뉴입니다.
- **상태**: 현재 한창 개발 중이므로, 완성될 때까지 일반 직원들의 눈에 띄지 않도록 따로 숨겨서 관리합니다.

'''
text = m06_pattern.sub(new_dispatch, text)

# 2. Add SiteOptionManage
# Find [M-03] ... and insert after it ends (before [M-04])
m03_pattern = re.compile(r'(### [^\n]*\[M-03\] 계약 대장.*?(?=### \[M-04\]))', re.DOTALL)
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
    # Insert site_option_manual right after the end of M-03
    text = text[:match.end()] + site_option_manual + text[match.end():]

with open('docs/e_Bro_Manual.md', 'w', encoding='utf-8') as f:
    f.write(text)

print("regex manual update done!")
