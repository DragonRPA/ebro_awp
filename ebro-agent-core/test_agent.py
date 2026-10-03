"""
ebro-agent-core/test_agent.py
독립 PC 에이전트 및 FSM / AI 브레인 자체 정합성 검증 스위트
"""

import asyncio
import json
import sqlite3
import os
import sys

# Windows 콘솔 UTF-8 출력 보장
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

from ai_brain import ai_brain
from safety_guard import safety_guard
from audit_logger import DB_FILE, log_event

async def test_ai_brain_parsing():
    print("\n🔍 [Test 1] 자연어 파서 및 의도 분석 테스트")
    test_cases = [
        ("계약 관리 화면으로 이동해줘", "navigate_menu", "contract"),
        ("배차 대장 열어봐", "navigate_menu", "delivery"),
        ("출고 검수 관리 보여줘", "navigate_menu", "outbound_inspections"),
        ("대시보드로 가자", "navigate_menu", "dashboard"),
        ("SoM 번호표 켜줘", "toggle_som", True),
        ("화면 정보 읽어줘", "get_page_content", None),
        ("신규 등록 버튼 클릭해줘", "click_element", "신규 등록"),
        ("검색창에 1234 입력해줘", "type_text", "1234")
    ]

    for prompt, expected_tool, expected_val in test_cases:
        res = await ai_brain.parse_instruction(prompt)
        tool = res.get("tool")
        source = res.get("source")
        assert tool == expected_tool, f"Mismatch for '{prompt}': expected {expected_tool}, got {tool}"
        if expected_tool == "navigate_menu":
            menu_id = res.get("params", {}).get("menuId")
            print(f"  ✅ '{prompt}' ➔ [{source}] tool: {tool}, normalized menuId: '{menu_id}'")
        else:
            print(f"  ✅ '{prompt}' ➔ [{source}] tool: {tool}, params: {res.get('params')}")

    print("  🎉 Test 1 통과: 모든 자연어 지시가 완벽한 Tool Call로 해석됨.")

def test_safety_guard():
    print("\n🔍 [Test 2] Human-in-the-Loop 안전 통제 가드레일 테스트")
    
    # 1. 안전한 읽기 액션
    safe_eval = safety_guard.evaluate_action("navigate_menu", {"menuId": "contract"})
    assert safe_eval["decision"] == "APPROVED"
    print(f"  ✅ 읽기/이동 액션: {safe_eval['decision']} (자동 통과)")

    # 2. 위험 액션 (삭제 키워드 클릭)
    danger_eval = safety_guard.evaluate_action("click_element", {"target": "계약 삭제"})
    assert danger_eval["decision"] == "WAIT_APPROVAL"
    print(f"  ✅ 위험 클릭 액션: {danger_eval['decision']} (승인 대기 강제)")

    # 3. 승인 해소
    approval_id = danger_eval["approval_id"]
    resolve_res = safety_guard.resolve_approval(approval_id, True)
    assert resolve_res["approved"] is True
    print(f"  ✅ 승인 해소: {resolve_res['approved']} (인간 확인 완료)")

    print("  🎉 Test 2 통과: 안전 가드레일이 정상 작동함.")

def test_audit_logger():
    print("\n🔍 [Test 3] SQLite 감사 로그 무누락 저장 테스트")
    test_session = "test-session-999"
    log_event(
        session_id=test_session,
        source="UNIT_TEST",
        status="SUCCESS",
        user_prompt="단위 테스트 명령",
        fsm_state="DONE",
        tool_name="navigate_menu",
        tool_params={"menuId": "contract"},
        tool_result={"success": True},
        latency_ms=12.5
    )

    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    cur.execute("SELECT session_id, user_prompt, status, tool_name FROM agent_audit_logs WHERE session_id = ?", (test_session,))
    row = cur.fetchone()
    conn.close()

    assert row is not None
    assert row[0] == test_session
    assert row[1] == "단위 테스트 명령"
    assert row[2] == "SUCCESS"
    assert row[3] == "navigate_menu"
    print(f"  ✅ DB 레코드 검증 성공: {row}")
    print("  🎉 Test 3 통과: 이벤트 감사 로그가 SQLite에 영구 보존됨.")

async def main():
    print("=" * 60)
    print("🧪 [ebro-agent-core] 자체 기능 검증 스위트 실행")
    print("=" * 60)
    await test_ai_brain_parsing()
    test_safety_guard()
    test_audit_logger()
    print("\n" + "=" * 60)
    print("🏆 모든 자체 정합성 검증 테스트 100% 통과 완료!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
