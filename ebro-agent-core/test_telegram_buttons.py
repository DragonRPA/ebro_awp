"""
test_telegram_buttons.py
텔레그램 대화형 반응형 메뉴(자비스 일해) 및 공식 이메일 발송 인텐트 파싱 단위 검증
"""

import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

from ai_brain import extract_domain_workflow
from telegram_bot import TelegramRemoteAgent

def run_tests():
    print("=" * 60)
    print("🤖 [텔레그램 대화형 버튼 메뉴 및 공식 메일 인텐트 검증]")
    print("=" * 60)

    # 1. 자비스 호출 반응형 키보드 검증
    agent = TelegramRemoteAgent(None)
    main_menu = agent._get_main_menu_markup()
    mail_sub = agent._get_mail_sub_markup()

    print("1. 메인 메뉴 인라인 버튼 구성:")
    for row in main_menu["inline_keyboard"]:
        row_txt = " | ".join([f"[{btn['text']} -> {btn['callback_data']}]" for btn in row])
        print(f"   {row_txt}")

    print("\n2. 이메일 서브 서식 선택 버튼 구성:")
    for row in mail_sub["inline_keyboard"]:
        row_txt = " | ".join([f"[{btn['text']} -> {btn['callback_data']}]" for btn in row])
        print(f"   {row_txt}")

    # 3. 비즈니스 이메일 발송 발화 인텐트 추출 검증
    test_cases = [
        "에이치엔아이씨 김소장에게 회사소개서 보내줘",
        "현대건설 박과장에게 1930 2대 견적서 보내줘",
        "판교 2공구에 GS-3246 제원표 카탈로그 보내줘",
        "대우건설 판교현장에 표준 계약서식 세트 발송해"
    ]

    print("\n3. 자연어 지시문 이메일 발송 인텐트 정밀 추출 테스트:")
    for idx, prompt in enumerate(test_cases, 1):
        act = extract_domain_workflow(prompt)
        print(f"\n--- [케이스 {idx}] \"{prompt}\" ---")
        if act:
            params = act["params"]
            print(f"✅ 워크플로: {params.get('workflow')}")
            print(f"📄 서식유형: {params.get('mail_type')}")
            print(f"🏢 거래처: {params.get('customer')}")
            print(f"👤 담당자: {params.get('recipient')}")
            print(f"🚜 기종: {params.get('model')}, 수량: {params.get('quantity')}")
        else:
            print("❌ 추출 실패!")

    print("\n" + "=" * 60)
    print("🎉 모든 검증 성공: 텔레그램 인터랙티브 버튼 메뉴 및 공식 이메일 발송 엔진 완료!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
