import os
from datetime import datetime

filepath = 'RELEASE_NOTES.md'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# find current version
# e.g., ## [v1.14.1.Build.43] - 2026-10-07 16:16
import re
match = re.search(r'## \[v(\d+)\.(\d+)\.(\d+)\.Build\.(\d+)\]', content)
if match:
    v1, v2, v3, b = match.groups()
    new_version = f"v{v1}.{v2}.{v3}.Build.{int(b)+1}"
else:
    new_version = "v1.14.1.Build.44"

now_str = datetime.now().strftime("%Y-%m-%d %H:%M")

new_release = f"""## [{new_version}] - {now_str}
### ✨ 주요 업데이트
- **에이전트 관제 화면(Agent Monitoring) 실시간 하트비트 연동 완료**
  - 가짜(하드코딩) 관제 데이터 UI를 제거하고, 실제 로컬망에서 `print_stations` 통신 외에 글로벌 에이전트 관제망(`agent_heartbeats` DB 테이블)으로 직접 15초 단위 하트비트를 송신하도록 연동했습니다.
  - 이제 테넌트 관제 화면에서 실제 설치 및 가동 중인 로컬 에이전트 대수, PC 이름(호스트), 접속 IP, 버전 상태, 그리고 **마지막 접속 경과 시간**을 실시간으로 추적하여 표시합니다.
  - **오프라인/온라인 상태 감지 로직 적용:** 1분(60초) 이상 하트비트가 끊기면 즉각 빨간색(오프라인) 상태로 전환되며, 대기 큐로 통신이 이관되는 상태를 정확하게 표시합니다.

"""

content = new_release + content

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Updated RELEASE_NOTES.md to {new_version}")
