# -*- coding: utf-8 -*-
"""
T2 웹 화면 조작 (ebro-web-agent 도구 호출 1건)

모델 출력: {"tool":..., "params":{...}} 한 줄. thought 없음. 출력 상한 60토큰.
도구와 파라미터는 ebro-web-agent/content.js 의 actions 와 ai_brain.py 의 SYSTEM_PROMPT 에서 가져왔다.
  navigate_menu {menuId} / click_element {target} / type_text {target,text,pressEnter}
  get_page_content {} / read_table {selector} / toggle_som {enable}
execute_workflow, finish_task 는 T1 과 코드가 담당하므로 T2 범위에서 제외한다.

menuId 닫힌 집합은 화면에서 이동 가능한 메뉴(src/App.tsx menuGroups + 대시보드) 56개다.
FineTune_Studio/datasets/ebro_v2/ui_labels.json 의 navigable_menu_ids 와 같아야 하며 build_t2.py 가 일치를 검사한다.
"""
import json
import os
import re

TASK = "T2"
OUTPUT_CAP_TOKENS = 60

TOOL_PARAMS = {
    "navigate_menu": ("menuId",),
    "click_element": ("target",),
    "type_text": ("target", "text", "pressEnter"),
    "get_page_content": (),
    "read_table": ("selector",),
    "toggle_som": ("enable",),
}

# (메뉴 ID, 사이드바 표시명). 출처: eBro/src/App.tsx menuGroups
MENU_TABLE = (
    ("dashboard", "대시보드"),
    ("approvalInbox", "내 결재함 (수신)"),
    ("approvalRules", "결재선 규칙 설정"),
    ("customer", "고객 관리"),
    ("site_options", "현장별 옵션 관리"),
    ("contract", "계약 관리"),
    ("billing", "청구 / 수납 관리"),
    ("receivable", "외상미수금 대장"),
    ("smart_dispatch4", "출고 요청"),
    ("smart_return", "회수 요청"),
    ("smart_as_request", "AS 요청"),
    ("delinquency", "미수 채권 연체 관리"),
    ("official_mail", "공식 메일 발송"),
    ("public_construction_permits", "인허가 건축공정 조회"),
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
    ("tenant_management", "테넌트 관리"),
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
NAV_MENU_IDS = tuple(i for i, _ in MENU_TABLE)

BUTTON_PREFIX = "노출 버튼: "
FIELD_PREFIX = "노출 입력: "
INSTRUCTION_PREFIX = "지시: "
LIST_SEP = " | "

DEFAULT_UI_LABELS = r"D:\01.AntiGravity\FineTune_Studio\datasets\ebro_v2\ui_labels.json"
_UI_CACHE = {}


def build_system_prompt(**ctx):
    menus = " ".join("%s=%s" % (i, n) for i, n in MENU_TABLE)
    return (
        "웹 화면 조작 도구 호출 1건을 JSON 한 줄로 출력한다. 설명 문장 금지.\n"
        "도구: navigate_menu{menuId} click_element{target} type_text{target,text,pressEnter} "
        "get_page_content{} read_table{selector:\"table\"} toggle_som{enable}\n"
        "규칙: menuId는 메뉴 목록의 ID. click_element target은 노출 버튼 목록의 문자열. "
        "type_text target은 노출 입력 목록의 문자열, text는 지시 원문의 연속 부분 문자열, "
        "pressEnter는 지시에 엔터가 있을 때만 true.\n"
        "메뉴 목록: " + menus
    )


def build_user_message(instruction, buttons=(), fields=(), **ctx):
    lines = []
    lines.append(BUTTON_PREFIX + LIST_SEP.join(buttons))
    lines.append(FIELD_PREFIX + LIST_SEP.join(fields))
    lines.append(INSTRUCTION_PREFIX + instruction)
    return "\n".join(lines)


def parse_user_message(user_message):
    """user 메시지에서 노출 버튼, 노출 입력, 지시문을 분리한다."""
    buttons, fields, instruction = [], [], ""
    pos = user_message.find("\n" + INSTRUCTION_PREFIX)
    head = user_message
    if pos >= 0:
        head = user_message[:pos]
        instruction = user_message[pos + 1 + len(INSTRUCTION_PREFIX):]
    for line in head.split("\n"):
        if line.startswith(BUTTON_PREFIX):
            body = line[len(BUTTON_PREFIX):]
            buttons = [x for x in body.split(LIST_SEP)] if body else []
        elif line.startswith(FIELD_PREFIX):
            body = line[len(FIELD_PREFIX):]
            fields = [x for x in body.split(LIST_SEP)] if body else []
    return {"buttons": buttons, "fields": fields, "instruction": instruction}


def _ui_real_sets(path):
    if path in _UI_CACHE:
        return _UI_CACHE[path]
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    btn, fld = set(), set()
    for m in d["menus"].values():
        btn.update(b["label"] for b in m["buttons"])
        fld.update(x["label"] for x in m["fields"])
    _UI_CACHE[path] = (btn, fld)
    return _UI_CACHE[path]


def validate_output(obj, user_message, ctx=None):
    """위반 사유 목록. 빈 리스트면 통과."""
    ctx = ctx or {}
    errs = []
    if not isinstance(obj, dict):
        return ["NOT_OBJECT"]
    if set(obj.keys()) != {"tool", "params"}:
        errs.append("KEYS:%s" % sorted(obj.keys()))
    tool = obj.get("tool")
    params = obj.get("params")
    if tool not in TOOL_PARAMS:
        errs.append("UNKNOWN_TOOL:%s" % tool)
        return errs
    if not isinstance(params, dict):
        errs.append("PARAMS_NOT_OBJECT")
        return errs
    allowed = set(TOOL_PARAMS[tool])
    extra = set(params.keys()) - allowed
    if extra:
        errs.append("EXTRA_PARAM:%s" % sorted(extra))
    parsed = parse_user_message(user_message)
    instr = parsed["instruction"]

    def need(k):
        if k not in params:
            errs.append("MISSING_PARAM:%s" % k)
            return False
        return True

    if tool == "navigate_menu":
        if need("menuId") and params["menuId"] not in NAV_MENU_IDS:
            errs.append("MENU_ID_NOT_IN_SET:%s" % params["menuId"])
    elif tool == "click_element":
        if need("target") and params["target"] not in parsed["buttons"]:
            errs.append("TARGET_NOT_IN_EXPOSED_BUTTONS:%s" % params["target"])
    elif tool == "type_text":
        if need("target") and params["target"] not in parsed["fields"]:
            errs.append("TARGET_NOT_IN_EXPOSED_FIELDS:%s" % params["target"])
        if need("text"):
            t = params["text"]
            if not isinstance(t, str) or not t:
                errs.append("TEXT_EMPTY")
            elif t not in instr and re.sub(r"\s+", " ", t) not in re.sub(r"\s+", " ", instr):
                errs.append("TEXT_NOT_SUBSTRING:%s" % t)
        if "pressEnter" in params:
            if params["pressEnter"] is not True:
                errs.append("PRESS_ENTER_NOT_TRUE")
            elif not re.search(r"엔터|enter", instr, re.I):
                errs.append("PRESS_ENTER_WITHOUT_ENTER_IN_INSTRUCTION")
    elif tool == "read_table":
        if need("selector") and params["selector"] != "table":
            errs.append("SELECTOR_NOT_TABLE")
    elif tool == "toggle_som":
        if need("enable") and not isinstance(params["enable"], bool):
            errs.append("ENABLE_NOT_BOOL")
    # get_page_content: 파라미터 없음 (extra 검사로 충분)

    if ctx.get("check_ui_real", True):
        path = ctx.get("ui_labels_path", DEFAULT_UI_LABELS)
        if os.path.isfile(path):
            btn, fld = _ui_real_sets(path)
            for b in parsed["buttons"]:
                if b not in btn:
                    errs.append("EXPOSED_BUTTON_NOT_IN_UI_SOURCE:%s" % b)
            for x in parsed["fields"]:
                if x not in fld:
                    errs.append("EXPOSED_FIELD_NOT_IN_UI_SOURCE:%s" % x)
    return errs
