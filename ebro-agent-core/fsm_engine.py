"""
ebro-agent-core/fsm_engine.py
전사 표준 헌장 [모듈 2] 준수: 결정론적 FSM 라이프사이클 엔진
[INIT] -> [PARSE] -> [STATE_CHECK] -> [ACTION] -> [VERIFY] -> [DONE]
"""

import time
import uuid
import asyncio
from ai_brain import ai_brain
from safety_guard import safety_guard
from audit_logger import log_event

class FsmEngine:
    def __init__(self, browser_communicator):
        self.browser = browser_communicator
        self.active_sessions = {} # session_id -> context

    async def execute_instruction(self, user_prompt: str, source: str = "BROWSER_POPUP") -> dict:
        session_id = str(uuid.uuid4())[:8]
        start_time = time.time()
        
        ctx = {
            "session_id": session_id,
            "source": source,
            "prompt": user_prompt,
            "state": "INIT",
            "history": []
        }
        self.active_sessions[session_id] = ctx

        try:
            # 1. [INIT] -> [PARSE]
            ctx["state"] = "PARSE"
            parsed_plan = await ai_brain.parse_instruction(user_prompt)
            actions = parsed_plan.get("actions", [])
            if not actions and "tool" in parsed_plan:
                actions = [{"tool": parsed_plan["tool"], "params": parsed_plan.get("params", {})}]

            ctx["parsed_plan"] = parsed_plan
            ctx["actions"] = actions
            ctx["executed_results"] = []

            # 2. 다단계 액션 순차 실행 루프
            for idx, act in enumerate(actions):
                tool_name = act.get("tool")
                tool_params = act.get("params", {})

                # [STATE_CHECK] (안전 가드레일 및 승인 검증)
                safety_eval = safety_guard.evaluate_action(tool_name, tool_params)
                if safety_eval["decision"] == "WAIT_APPROVAL":
                    ctx["state"] = "WAIT_APPROVAL"
                    ctx["approval_id"] = safety_eval["approval_id"]
                    latency = (time.time() - start_time) * 1000
                    log_event(
                        session_id=session_id, source=source, status="WAIT_APPROVAL",
                        user_prompt=user_prompt, fsm_state="WAIT_APPROVAL",
                        tool_name=tool_name, tool_params=tool_params, latency_ms=latency
                    )
                    return {
                        "success": False,
                        "status": "WAIT_APPROVAL",
                        "approval_id": safety_eval["approval_id"],
                        "message": safety_eval["message"],
                        "plan": parsed_plan
                    }

                # [ACTION] 브라우저 실행
                step_no = idx + 1
                ctx["state"] = f"ACTION_STEP_{step_no}"
                action_res = await self.browser.execute_tool(tool_name, tool_params)

                step_record = {
                    "step": step_no,
                    "tool": tool_name,
                    "params": tool_params,
                    "result": action_res
                }
                ctx["executed_results"].append(step_record)

                # 다음 단계가 남아있으면 화면 렌더링/데이터 로딩 안정화 대기
                if idx < len(actions) - 1:
                    wait_time = 1.2 if tool_name == 'navigate_menu' else 0.6
                    await asyncio.sleep(wait_time)

            # 3. [VERIFY] -> [DONE]
            all_success = all(r.get("result", {}).get("success", False) for r in ctx["executed_results"]) if ctx["executed_results"] else False
            ctx["state"] = "DONE" if all_success else "PARTIAL_SUCCESS"
            latency = (time.time() - start_time) * 1000

            log_event(
                session_id=session_id, source=source,
                status="SUCCESS" if all_success else "FAILED",
                user_prompt=user_prompt, fsm_state=ctx["state"],
                tool_name=actions[-1]["tool"] if actions else "unknown",
                tool_params={"total_steps": len(actions)},
                tool_result={"steps": ctx["executed_results"]}, latency_ms=latency
            )

            last_res = ctx["executed_results"][-1]["result"] if ctx["executed_results"] else {}
            return {
                "success": all_success,
                "status": ctx["state"],
                "session_id": session_id,
                "total_steps": len(actions),
                "steps": ctx["executed_results"],
                "result": last_res,
                "latency_ms": round(latency, 2)
            }

        except Exception as e:
            ctx["state"] = "ERROR"
            latency = (time.time() - start_time) * 1000
            log_event(
                session_id=session_id, source=source, status="FAILED",
                user_prompt=user_prompt, fsm_state="ERROR",
                tool_result={"error": str(e)}, latency_ms=latency
            )
            return {
                "success": False,
                "status": "ERROR",
                "error": str(e)
            }
