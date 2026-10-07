import datetime
with open('RELEASE_NOTES.md', 'r', encoding='utf-8') as f:
    text = f.read()

now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
new_entry = f'''v1.14.1.Build.43
{now}
1. [버그 수정] 매뉴얼 화면 기본안내(basicGuide)와 기능정의(annotations) 표시 갯수 불일치 오류 수정
   - 화면 오버레이에 그려지는 요소 갯수와 우측 브리핑 모달이 출력하는 요소 갯수가 서로 다른 소스에서 기인하던 버그 수정.
2. [UI 개편] 현장별 옵션관리 메뉴 기능 단순화
   - 사용자 요청에 따라 '새로운 옵션 등록 기능'을 숨김 처리하고, 이미 등록된 옵션을 현장에 매핑하는 본연의 기능에 집중하도록 UI 단순화.
3. [문서 업데이트] 현장별 옵션관리 UI 개편에 따른 매뉴얼 최신화
   - 없어진 옵션 마스터 관리 버튼을 매뉴얼 데이터(basicGuide/annotations)에서 삭제 후 DB 동기화 완료.
4. [에이전트 배포] eBroAgent 2.0 최신 기능(WebSocket 통신, 시스템 트레이, UI 설정) 반영 버전 CDN 재배포 완료

'''

with open('RELEASE_NOTES.md', 'w', encoding='utf-8') as f:
    f.write(new_entry + text)
