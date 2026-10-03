# ebro web agent (브라우저 확장 프로그램)

eBro ERP를 제어하는 공식 로컬 인텔리전스 브라우저 확장 프로그램입니다.

## 🚀 브라우저 등록 방법 (Chrome / Edge / Whale)
1. 브라우저 주소창에 `chrome://extensions` (또는 `edge://extensions`) 입력 후 이동합니다.
2. 우측 상단의 **[개발자 모드]** 스위치를 켭니다.
3. 좌측 상단의 **[압축해제된 확장 프로그램을 로드합니다]** (Load unpacked) 버튼을 클릭합니다.
4. 현재 폴더(`d:\01.AntiGravity\Giyuen_Lift\ebro-web-agent`)를 선택합니다.
5. 브라우저 상단 툴바의 퍼즐 아이콘에서 **[ebro web agent]**를 고정(Pin)합니다.

## 🛠️ 주요 기능
- **PC 독립 에이전트(ws://127.0.0.1:9001) 연동**: 로컬 Ollama 3B(Qwen) 두뇌와 실시간 양방향 통신.
- **Set-of-Mark (SoM) 오버레이**: 화면 상의 모든 버튼/입력창에 시각적 번호표(`[1]`, `[2]`, ...)를 렌더링하여 AI가 100% 정합성으로 클릭.
- **DOM 간소화 및 상태 감지**: eBro ERP의 `data-erp-status`, `data-erp-menu`, 상호작용 요소를 실시간 추상화.
- **원클릭 빠른 제어 및 자연어 지시**: 대시보드/계약/배차/출고검수 즉시 전환 및 임의 자연어 작업 지시 실행.
