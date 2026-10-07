with open('RELEASE_NOTES.md', 'r', encoding='utf-16') as f:
    old_content = f.read()

new_notes = f"""v1.14.1.Build.42
2026-10-07 13:30
1. [도메인 정책] 현장(Site) 독립성 보장을 위한 스키마 및 UI/UX 개편
   - 현장은 특정 고객사의 소유가 아니라는 전사 도메인 원칙에 따라 CustomerSite 스키마에서 customerId 종속성을 분리(선택 속성화).
   - [현장 옵션 관리] 메뉴 내 고객사 필터링 및 리스트 내 고객사명 표기를 전면 제거하여 현장 본연의 관리 체계로 일원화.
   - [현장 옵션 관리] 마스터 품목이 0건일 때 우측 패널이 비어보이는 UX 결함 수정 (등록 가이드 Empty State 문구 및 시각적 안내 추가).
2. [기능 추가] 현장 옵션 속성 복사 시 대상 현장 '초성 검색' 지원
   - 고객 관리 메뉴의 [옵션 속성 복사] 팝업에서 현장명을 한글 초성만으로 빠르게 찾을 수 있도록 hangulSearch 로직 적용.
3. [UX 개선] 로컬 AI 모델 로딩 지연에 대한 시각적 피드백(프로그레스 뷰) 추가
   - ebro-qwen:3b 등 로컬 온디바이스 모델의 최초 Wake-up 시간(5~15초) 동안 지루함을 방지하고 상태를 직관적으로 전달하는 <LocalAiLoadingIndicator /> 컴포넌트 신규 구축 및 AI 메뉴(에이전틱 배차 스튜디오, AI 연구소) 전면 적용.

"""

with open('RELEASE_NOTES.md', 'w', encoding='utf-8') as f:
    f.write(new_notes + old_content)
