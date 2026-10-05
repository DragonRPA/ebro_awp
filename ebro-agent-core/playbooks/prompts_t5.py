# -*- coding: utf-8 -*-
"""
T5 메뉴 사용법 안내

모델 출력: {"type":"MENU_GUIDE","menuId":...} 한 줄. 출력 상한 30토큰.
안내문은 모델이 쓰지 않고 코드가 src/data/allMenuManuals.ts 에서 menuId 로 조회한다.
menuId 닫힌 집합은 allMenuManuals.ts 의 메뉴 57개다 (ebro_menu_knowledge.json 키와 동일).
이 값은 지시 원문의 부분 문자열이 아니라 닫힌 집합의 선택이므로 부분 문자열 검사 대상이 아니다.
"""
TASK = "T5"
OUTPUT_CAP_TOKENS = 30

# (메뉴 ID, 메뉴명). 출처: eBro/src/data/allMenuManuals.ts
MENU_TABLE = (
    ("dashboard", "ERP 대시보드"),
    ("approvalInbox", "내 결재함 (수신)"),
    ("approvalRules", "결재선 규칙 설정"),
    ("customer", "고객 관리"),
    ("site_options", "현장별 옵션 관리"),
    ("contract", "계약 관리"),
    ("contract_create", "신규 계약 등록"),
    ("billing", "청구 / 수납 관리"),
    ("billing_wizard", "미청구 정산"),
    ("billing_invoice", "청구서통합"),
    ("billing_waiver", "청구 면제 대장"),
    ("receivable", "외상미수금 대장"),
    ("smart_dispatch4", "출고 요청"),
    ("smart_return", "회수 요청"),
    ("smart_as_request", "AS 요청"),
    ("delinquency", "미수 채권 연체 관리"),
    ("product", "제품 관리"),
    ("asset", "자산 관리 (대장)"),
    ("acquisition_disposal", "당사자산 취득 / 매각"),
    ("rent_asset", "임차 장비 관리"),
    ("delivery", "배차 / 운송 관리"),
    ("transport_master", "운송 거래처 관리"),
    ("daily_inout", "일일 입출고 조회"),
    ("asset_inout_history", "자산 입출고"),
    ("dispatch_assign", "장비 할당 / 매핑"),
    ("outbound_inspections", "출고 검수 관리"),
    ("consumable_stock", "주기장 소모품 재고"),
    ("print_queue_monitor", "프린트 큐 모니터"),
    ("consumable_purchase", "소모품 구매"),
    ("consumable_inout", "소모품 입출고"),
    ("field_as", "현장 AS 관리"),
    ("repair", "주기장 정비 관리"),
    ("inspection_checklist_manage", "정비 항목 관리"),
    ("leave_application", "연차신청"),
    ("ot_management", "OT 관리"),
    ("vehicle_log", "차량 / 주유관리"),
    ("purchase_settlement", "월말 매입 정산"),
    ("vendors", "매입처 (공급자 / 외주처) 관리"),
    ("bank_matching", "은행 입출금 대장"),
    ("corporate_card", "법인카드 매입정산"),
    ("cash_flow", "자금 흐름 분석"),
    ("depreciation_execution", "감가상각 마감 실행"),
    ("regular_reports", "정기보고서 생성"),
    ("organization", "조직 / 인사 관리"),
    ("permission", "사용자 및 권한"),
    ("payroll", "급여 정산"),
    ("leave_management", "연차관리"),
    ("privacy_audit", "개인정보 접속 감사"),
    ("operations_manual", "업무매뉴얼"),
    ("error_report", "오류 신고"),
    ("agentic_ai_lab", "에이전틱 AI 샌드박스 랩"),
    ("agentic_dispatch_studio", "에이전틱 배차 관제 스튜디오"),
    ("agentic_settlement_autopilot", "에이전틱 월말 대사 정산 오토파일럿"),
    ("agentic_asset_lifecycle", "에이전틱 자산 라이프사이클 관제"),
    ("initial_db_upload", "초기DB 업로드"),
    ("google_config", "구글 관리자 설정"),
    ("dev_uploader", "[개발] DB 데이터 업로더"),
)
MANUAL_MENU_IDS = tuple(i for i, _ in MENU_TABLE)


def build_system_prompt(**ctx):
    menus = " ".join("%s=%s" % (i, n) for i, n in MENU_TABLE)
    return (
        "메뉴 사용법 질문의 대상 메뉴를 고른다. JSON 한 줄만 출력한다: "
        "{\"type\":\"MENU_GUIDE\",\"menuId\":\"메뉴ID\"}\n"
        "menuId는 메뉴 목록의 ID.\n"
        "메뉴 목록: " + menus
    )


def build_user_message(question, **ctx):
    return question


def validate_output(obj, user_message, ctx=None):
    """위반 사유 목록. 빈 리스트면 통과."""
    errs = []
    if not isinstance(obj, dict):
        return ["NOT_OBJECT"]
    if set(obj.keys()) != {"type", "menuId"}:
        errs.append("KEYS:%s" % sorted(obj.keys()))
    if obj.get("type") != "MENU_GUIDE":
        errs.append("TYPE_NOT_MENU_GUIDE:%s" % obj.get("type"))
    mid = obj.get("menuId")
    if not isinstance(mid, str) or mid not in MANUAL_MENU_IDS:
        errs.append("MENU_ID_NOT_IN_SET:%s" % mid)
    return errs
