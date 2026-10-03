"""
ebro-agent-core/safety_guard.py
전사 표준 헌장 카테고리 I 및 [모듈 5] 준수: 휴먼인더루프(Human-in-the-Loop) 및 안전 통제
"""

import uuid

# 읽기/이동 전용 도구 (안전: 즉시 자동 승인)
READ_ONLY_TOOLS = {
    'navigate_menu',
    'get_page_content',
    'read_table',
    'toggle_som',
    'check_readiness',
    'scroll_to'
}

# 데이터 영구 변경 및 결재 도구 (위험: 사전 인라인 승인 필수)
MUTATING_TOOLS = {
    'submit_contract',
    'delete_record',
    'approve_inspection',
    'issue_invoice',
    'update_billing',
    'delete_asset'
}

class SafetyGuard:
    def __init__(self):
        self.pending_approvals = {} # approval_id -> request_dict

    def evaluate_action(self, tool_name: str, params: dict, context: dict = None) -> dict:
        """
        도구 실행 위험도를 평가하여 즉시 실행 여부 또는 승인 대기 상태 반환
        """
        if tool_name in READ_ONLY_TOOLS:
            return {
                "decision": "APPROVED",
                "risk_level": "LOW",
                "message": "안전한 읽기/탐색 액션입니다."
            }

        # 클릭 및 입력은 대상 속성에 따라 동적 평가
        if tool_name in ('click_element', 'type_text'):
            target_str = str(params.get('target', '')).lower()
            text_str = str(params.get('text', '')).lower()
            
            # 위험 키워드 감지 (삭제, 결재, 마감, 승인)
            dangerous_keywords = ['삭제', 'delete', '결재', '승인', '마감', '확정', '전환', '취소']
            if any(k in target_str for k in dangerous_keywords) or any(k in text_str for k in dangerous_keywords):
                approval_id = str(uuid.uuid4())[:8]
                req = {
                    "approval_id": approval_id,
                    "tool": tool_name,
                    "params": params,
                    "risk_level": "HIGH",
                    "reason": f"위험 키워드 감지: {target_str or text_str}"
                }
                self.pending_approvals[approval_id] = req
                return {
                    "decision": "WAIT_APPROVAL",
                    "approval_id": approval_id,
                    "risk_level": "HIGH",
                    "message": f"데이터 변경 위험 액션입니다. 인간 승인이 필요합니다: {req['reason']}"
                }

            return {
                "decision": "APPROVED",
                "risk_level": "MEDIUM",
                "message": "일반 입력/조작 액션 자동 통과"
            }

        # 명시적 Mutating 도구인 경우
        if tool_name in MUTATING_TOOLS:
            approval_id = str(uuid.uuid4())[:8]
            req = {
                "approval_id": approval_id,
                "tool": tool_name,
                "params": params,
                "risk_level": "CRITICAL",
                "reason": f"데이터 영구 변경 도구 실행: {tool_name}"
            }
            self.pending_approvals[approval_id] = req
            return {
                "decision": "WAIT_APPROVAL",
                "approval_id": approval_id,
                "risk_level": "CRITICAL",
                "message": f"핵심 비즈니스 데이터 변경 액션입니다. 최종 결재/승인이 강제됩니다."
            }

        return {
            "decision": "APPROVED",
            "risk_level": "LOW",
            "message": "기본 통과"
        }

    def resolve_approval(self, approval_id: str, approved: bool) -> dict:
        if approval_id not in self.pending_approvals:
            return {"success": False, "error": "존재하지 않거나 만료된 승인 요청입니다."}
        
        req = self.pending_approvals.pop(approval_id)
        return {
            "success": True,
            "approved": approved,
            "request": req
        }

safety_guard = SafetyGuard()
