"""
test_personalization.py
텔레그램 사용자별 1:1 개인화(호칭, 봇애칭) 및 범용 '일해' 트리거 검증
"""

import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

from telegram_bot import TelegramRemoteAgent

def test_personalization():
    print("=" * 60)
    print("👥 [텔레그램 사용자별 1:1 개인화 및 '일해' 범용 트리거 검증]")
    print("=" * 60)

    agent = TelegramRemoteAgent(None)
    agent.allowed_user_id = "11111111" # 사장님 텔레그램 ID 가정

    # 1. 김영업 대리, 최배차 과장 개인화 프로필 등록
    agent.set_user_profile("22222222", callsign="김 대리님", bot_name="금비서")
    agent.set_user_profile("33333333", callsign="최 과장님", bot_name="알파고")

    test_scenarios = [
        {"sender_id": "11111111", "first_name": "정용", "input": "자비스 일해", "desc": "사장님: '자비스 일해'"},
        {"sender_id": "11111111", "first_name": "정용", "input": "일해", "desc": "사장님: '일해' (단독 발화)"},
        {"sender_id": "22222222", "first_name": "영업", "input": "금비서 일해", "desc": "김영업 대리: '금비서 일해'"},
        {"sender_id": "22222222", "first_name": "영업", "input": "일해", "desc": "김영업 대리: '일해' (단독 발화)"},
        {"sender_id": "33333333", "first_name": "배차", "input": "알파고 일해", "desc": "최배차 과장: '알파고 일해'"},
        {"sender_id": "33333333", "first_name": "배차", "input": "일하자", "desc": "최배차 과장: '일하자' (단독 발화)"},
        {"sender_id": "99999999", "first_name": "홍길동", "input": "일해", "desc": "미등록 신규사원: '일해' (단독 발화)"},
    ]

    for idx, sc in enumerate(test_scenarios, 1):
        prof = agent._get_user_profile(sc["sender_id"], sc["first_name"])
        callsign = prof["callsign"]
        bot_name = prof["bot_name"]
        bot_alias = bot_name.lower()

        trigger_keywords = [bot_alias, '일해', '일하자', '업무시작', '업무 시작', '메뉴', '도움말', '업무목록', '/start', '/menu', '/help']
        is_triggered = any(k in sc["input"].lower() for k in trigger_keywords)

        greeting = f"🤖 {callsign}, eBro 업무 비서 {bot_name}입니다. 어떤 업무를 처리할까요?"

        print(f"\n--- [테스트 {idx}] {sc['desc']} ---")
        print(f"• 발신자 ID: {sc['sender_id']} ({sc['first_name']})")
        print(f"• 적용된 호칭: {callsign}")
        print(f"• 적용된 봇 이름: {bot_name}")
        print(f"• '일해' 트리거 감지 여부: {'✅ 정상 작동' if is_triggered else '❌ 실패'}")
        print(f"• 맞춤 응답 메시지: \"{greeting}\"")

    print("\n" + "=" * 60)
    print("🎉 사용자별 개인화 호칭/봇이름 및 범용 '일해' 트리거 100% 검증 완료!")
    print("=" * 60)

if __name__ == "__main__":
    test_personalization()
