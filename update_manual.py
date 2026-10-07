import re

filepath = 'src/data/allMenuManuals.ts'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

new_process = """        {
          "processId": "process_site_master_options",
          "title": "옵션 품목 마스터 정렬 및 삭제",
          "description": "전사 기준 풀에 등록된 옵션 품목들을 헤더를 클릭하여 정렬하고, 불필요한 마스터 옵션은 수정 모달에서 삭제합니다.",
          "steps": [
            {
              "seq": 1,
              "selector": "th:contains('분류'), th:contains('옵션 품목명'), th:contains('기준단가'), th:contains('단위'), th:contains('설명'), th:contains('상태')",
              "type": "click_ripple",
              "label": "헤더 클릭 정렬",
              "description": "테이블 헤더를 클릭하여 오름차순, 내림차순, 정렬 안 함 순으로 목록을 정렬합니다.",
              "positionHint": "bottom"
            },
            {
              "seq": 2,
              "selector": "td button:contains('수정')",
              "type": "click_ripple",
              "label": "옵션 수정 버튼",
              "description": "수정할 옵션의 우측 수정 버튼을 클릭하여 수정 모달을 엽니다."
            },
            {
              "seq": 3,
              "selector": "button:contains('삭제')",
              "type": "highlight",
              "label": "옵션 마스터 삭제",
              "description": "수정 모달 하단의 삭제 버튼을 눌러 불필요한 옵션 마스터를 전사 풀에서 제거합니다.",
              "positionHint": "top"
            }
          ]
        },
"""

# Find the processes array for site_options
site_options_idx = content.find('"menuId": "site_options",')
if site_options_idx != -1:
    processes_idx = content.find('"processes": [', site_options_idx)
    if processes_idx != -1:
        insert_idx = processes_idx + len('"processes": [\n')
        content = content[:insert_idx] + new_process + content[insert_idx:]
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print("Updated manual")
    else:
        print("Could not find processes array")
else:
    print("Could not find site_options")

