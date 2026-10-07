import os
from datetime import datetime

filepath = 'RELEASE_NOTES.md'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

import re
match = re.search(r'## \[v(\d+)\.(\d+)\.(\d+)\.Build\.(\d+)\]', content)
if match:
    v1, v2, v3, b = match.groups()
    new_version = f"v{v1}.{v2}.{v3}.Build.{int(b)+1}"
else:
    new_version = "v1.14.1.Build.45"

now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

new_release = f"""## [{new_version}] - {now_str}
### ✨ 주요 업데이트
- **중앙 연합 학습(Central Federated Learning) 아키텍처 도입**
  - Hindsight 스텔스 수집 통신 브릿지의 타겟을 개별 테넌트 DB에서 **중앙 관제 DB (Central Supabase)**로 변경했습니다.
  - 업종별로 공용 기억 테이블(`awp_shared_memories`, `it_shared_memories`)을 분리 적재하여, AI가 동종 업계의 공통 업무 방식과 베스트 프랙티스를 범용적으로 학습할 수 있는 기반을 마련했습니다.

"""

content = new_release + content

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Updated RELEASE_NOTES.md to {new_version}")
