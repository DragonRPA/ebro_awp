"""
test_queue_and_buttons.py
FIFO 비동기 작업 큐 및 동적 다음 선택지 버튼(Inline Keyboard) 퍼널 단위 테스트
"""

import sys
import asyncio
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

from telegram_bot import TelegramRemoteAgent

class MockFsmEngine:
    def __init__(self):
        self.execution_log = []

    async def execute_instruction(self, prompt: str, source: str = "TEST"):
        self.execution_log.append(f"START: {prompt}")
        await asyncio.sleep(0.3) # 300ms 작업 시뮬레이션
        self.execution_log.append(f"END: {prompt}")
        return {
            "success": True,
            "status": "DONE",
            "total_steps": 1,
            "steps": [{"step": 1, "tool": "execute_workflow", "result": {"message": f"{prompt} 완료"}}],
            "latency_ms": 300.0
        }

async def run_tests():
    print("=" * 60)
    print("🧪 [1. 동적 다음 선택지 버튼(Inline Keyboard) 마크업 검증]")
    print("=" * 60)

    fsm = MockFsmEngine()
    agent = TelegramRemoteAgent(fsm)

    # 1. 거래처 확정 후 다음 액션 버튼 검증
    markup1 = agent._get_customer_next_actions_markup("에이치아이엔씨")
    buttons1 = [b["text"] for row in markup1["inline_keyboard"] for b in row]
    print("• 거래처 확정 버튼 4종:", buttons1)
    assert any("계약 연장" in b for b in buttons1)
    assert any("출고 배차" in b for b in buttons1)
    assert any("견적서 발송" in b for b in buttons1)
    print("✅ 거래처 다음 액션 버튼 검증 통과!")

    # 2. 계약 연장 기간 버튼 검증
    markup2 = agent._get_extend_duration_markup("에이치아이엔씨")
    buttons2 = [b["text"] for row in markup2["inline_keyboard"] for b in row]
    print("• 연장 기간 버튼 6종:", buttons2)
    assert "1개월 연장" in buttons2
    assert "3개월 연장" in buttons2
    assert "6개월 연장" in buttons2
    assert "1년 연장" in buttons2
    print("✅ 연장 기간 선택 버튼 검증 통과!")

    # 3. 출고 배차 기종 버튼 검증
    markup3 = agent._get_dispatch_model_markup("에이치아이엔씨")
    buttons3 = [b["text"] for row in markup3["inline_keyboard"] for b in row]
    print("• 출고 기종 버튼 5종:", buttons3)
    assert any("GS-1930" in b for b in buttons3)
    assert any("GS-3246" in b for b in buttons3)
    print("✅ 출고 기종 선택 버튼 검증 통과!")

    print("\n" + "=" * 60)
    print("🧪 [2. FIFO 비동기 작업 큐 (명령 대기열 순차 처리) 검증]")
    print("=" * 60)

    # 워커 루프 활성화
    agent.is_running = True
    worker_task = asyncio.create_task(agent._queue_worker_loop())

    class MockClient:
        def __init__(self):
            self.sent_messages = []
        async def post(self, url, json=None):
            if json and "text" in json:
                self.sent_messages.append(json["text"])
            return None

    client = MockClient()

    # 사장님이 3개 명령을 빠른 속도로 연속 전송하는 상황 시뮬레이션
    prompts = [
        "에이치아이엔씨 1공구 6개월 연장",
        "삼정건설 판교현장 GS-1930 2대 내일 출고요청",
        "현대건설 김소장에게 견적서 발송"
    ]

    print("▶ 3개 연속 지시 큐에 신속 등록...")
    for p in prompts:
        await agent.enqueue_job(client, chat_id=12345, prompt=p, source="TEST")
        await asyncio.sleep(0.05) # 50ms 간격 초고속 전송

    # 큐의 모든 작업이 끝날 때까지 대기
    await agent.job_queue.join()
    agent.is_running = False
    worker_task.cancel()

    print("\n▶ FSM 실행 시계열 로그 확인:")
    for log in fsm.execution_log:
        print(f"  {log}")

    # 순차적 실행 검증 (START 1 -> END 1 -> START 2 -> END 2 -> START 3 -> END 3)
    expected_order = [
        "START: 에이치아이엔씨 1공구 6개월 연장",
        "END: 에이치아이엔씨 1공구 6개월 연장",
        "START: 삼정건설 판교현장 GS-1930 2대 내일 출고요청",
        "END: 삼정건설 판교현장 GS-1930 2대 내일 출고요청",
        "START: 현대건설 김소장에게 견적서 발송",
        "END: 현대건설 김소장에게 견적서 발송"
    ]
    assert fsm.execution_log == expected_order, f"순서 불일치: {fsm.execution_log}"

    print("\n▶ 텔레그램 안내 메시지 검증:")
    has_queue_notice = any("명령 대기열 등록" in m for m in client.sent_messages)
    print(f"• 대기열 알림 발송 여부: {has_queue_notice}")
    assert has_queue_notice, "대기열 등록 알림이 발송되지 않았습니다."

    print("\n" + "=" * 60)
    print("🎉 전 테스트 통과: 동적 버튼 퍼널 및 FIFO 작업 큐 무결성 입증 완료!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_tests())
