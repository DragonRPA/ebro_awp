"""
ebro-agent-core/ai_brain.py
Ollama 로컬 LLM (Qwen 2.5 3B) 및 고속 결정론적 시맨틱 파서 듀얼 엔진
"""

import httpx
import json
import re
import asyncio
import os
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

OLLAMA_API_URL = "http://127.0.0.1:11434/api/chat"
DEFAULT_MODEL = "ebro-qwen:3b"
FALLBACK_MODEL = "qwen2.5:0.5b"

# eBro ERP 메뉴 매핑 사전 (SSOT)
MENU_MAPPING = {
    '대시보드': 'dashboard',
    '메인': 'dashboard',
    '홈': 'dashboard',
    '고객': 'customer',
    '거래처': 'customer',
    '계약': 'contract',
    '청구': 'billing',
    '수납': 'billing',
    '미수금': 'receivable',
    '외상': 'receivable',
    '자산': 'asset',
    '장비': 'asset',
    '임차': 'rent_asset',
    '배차': 'delivery',
    '운송': 'delivery',
    '출고': 'outbound_inspections',
    '검수': 'outbound_inspections',
    '출고검수': 'outbound_inspections',
    '정비': 'repair',
    '수리': 'repair',
    '소모품': 'consumables',
    '은행': 'bank_matching',
    '통장': 'bank_matching',
    '프린트': 'print_queue_monitor',
    '라벨': 'print_queue_monitor',
    '입출고': 'daily_inout',
    '메일': 'official_mail',
    '이메일': 'official_mail',
    '공식메일': 'official_mail',
    '견적서': 'official_mail',
    '회사소개서': 'official_mail'
}

# 📚 eBro ERP 전사 57개 메뉴 기능정의서 지식 베이스 로드
KB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ebro_menu_knowledge.json')
MENU_KNOWLEDGE = {}
try:
    if os.path.exists(KB_FILE):
        with open(KB_FILE, 'r', encoding='utf-8') as f:
            MENU_KNOWLEDGE = json.load(f)
        print(f"📚 [AiBrain] eBro 전사 메뉴 기능정의서 지식 베이스 로드 완료 ({len(MENU_KNOWLEDGE)}개 메뉴)")
except Exception as e:
    print(f"⚠️ [AiBrain] 기능정의서 로드 실패: {e}")

def get_menu_context_prompt(current_menu_id: str = None, prompt_text: str = "") -> str:
    """
    현재 화면 또는 질문 키워드에 해당하는 메뉴 기능정의서를 시스템 프롬프트에 동적 삽입
    """
    target_menu = current_menu_id
    if not target_menu or target_menu == 'unknown' or target_menu == 'booting':
        # 프롬프트 텍스트에서 키워드 탐색
        for k, v in MENU_MAPPING.items():
            if k in prompt_text:
                target_menu = v
                break

    if not target_menu or target_menu not in MENU_KNOWLEDGE:
        return ""

    k = MENU_KNOWLEDGE[target_menu]
    lines = [
        f"\n[현재 화면 기능정의서: {k['menuName']} ({target_menu})]",
        f"- 업무 최종 목적: {k['objective']}",
        f"- 1-Way 조작 순서: {' -> '.join(k.get('steps', [])[:4])}",
        f"- 주요 버튼 목록: {', '.join(k.get('buttons', [])[:8])}"
    ]
    if k.get('modals'):
        modal_names = [m['name'] for m in k['modals']]
        lines.append(f"- 연동 팝업: {', '.join(modal_names)}")
    return "\n".join(lines)

SYSTEM_PROMPT = """당신은 eBro ERP의 57개 메뉴 기능정의서를 완벽히 숙지한 전문 AI 에이전트 'ebro web agent'의 두뇌입니다.
사용자의 자연어 업무 지시를 분석하여 제공된 [현재 화면 기능정의서]의 조작 순서와 버튼을 참조하여 JSON 규격의 도구 실행 계획(actions)을 응답하십시오. 불필요한 설명은 금지합니다.

[지원 가능한 도구]
1. {"tool": "navigate_menu", "params": {"menuId": "메뉴ID(예: contract, delivery, outbound_inspections, dashboard 등)"}}
2. {"tool": "click_element", "params": {"target": "버튼텍스트 또는 agent-id"}}
3. {"tool": "type_text", "params": {"target": "입력필드텍스트 또는 agent-id", "text": "입력값", "pressEnter": true/false}}
4. {"tool": "get_page_content", "params": {}}
5. {"tool": "read_table", "params": {"selector": "table"}}
6. {"tool": "toggle_som", "params": {"enable": true/false}}
7. {"tool": "execute_workflow", "params": {"workflow": "CONTRACT_EXTEND|CONTRACT_SHORTEN", "customer": "고객사명", "site": "현장명", "duration_months": 개월수, "target_date": "YYYY-MM-DD", "reason": "사유"}}
8. {"tool": "finish_task", "params": {"summary": "완료 요약"}}

[출력 JSON 규격]
- 단일 또는 복합 다단계 지시 모두 {"actions": [{"tool": "...", "params": {...}}, ...]} 형식으로 응답하십시오.
- 계약 기간 연장 지시 예: "에이치엔아이씨 1공구 신축현장 계약을 6개월 연장해"
  {"actions": [
    {"tool": "execute_workflow", "params": {"workflow": "CONTRACT_EXTEND", "customer": "에이치엔아이씨", "site": "1공구", "duration_months": 6, "reason": "6개월 계약 기간 연장"}}
  ]}
- 단순 다단계 지시 예: "계약 관리 가서 전부 조회하고 엑셀 다운로드해줘"
  {"actions": [
    {"tool": "navigate_menu", "params": {"menuId": "contract"}},
    {"tool": "click_element", "params": {"target": "조회"}},
    {"tool": "click_element", "params": {"target": "엑셀 다운로드"}}
  ]}
"""

def extract_domain_workflow(prompt: str) -> dict:
    """
    자연어 지시문에서 고수준 비즈니스 워크플로(계약 연장/단축 등) 의도와 슬롯을 정밀 추출
    """
    p = prompt.strip()
    p_lower = p.lower()

    # 1. 계약 기간 연장 / 단축 의도 판별
    is_extend = any(k in p_lower for k in ['연장', '늘려', '늘려줘', '늘려봐', '추가'])
    is_shorten = any(k in p_lower for k in ['단축', '줄여', '줄여줘', '조기종료', '조기 종료'])

    if (is_extend or is_shorten) and any(k in p_lower for k in ['계약', '현장', '공구', '개월', '만료일', '종료일', '건설', '이앤씨', '기업']):
        workflow = 'CONTRACT_SHORTEN' if is_shorten else 'CONTRACT_EXTEND'

        # 개월 수 추출 (예: 6개월, 3달, 1년 등)
        duration_months = 0
        m_month = re.search(r'(\d+)\s*(?:개?월|달)', p)
        if m_month:
            duration_months = int(m_month.group(1))
        else:
            m_year = re.search(r'(\d+)\s*년', p)
            if m_year:
                duration_months = int(m_year.group(1)) * 12

        # 특정 날짜 추출 (예: 2027-04-30, 2027.05.31, 2027년 6월 30일)
        target_date = None
        m_date = re.search(r'(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})', p)
        if m_date:
            y = m_date.group(1)
            m = str(int(m_date.group(2))).zfill(2)
            d = str(int(m_date.group(3))).zfill(2)
            target_date = f"{y}-{m}-{d}"

        # 현장명 추출 (예: 1공구, 2현장, 판교현장 등)
        site = ""
        m_site = re.search(r'([0-9가-힣a-zA-Z]+(?:공구|현장))', p)
        if m_site:
            site = m_site.group(1)

        # 고객사명 추출: 불용어 제거 후 핵심 명사 탐색
        cleaned = re.sub(r'(\d+\s*(?:개?월|달|년)|계약을?|계약은?|만료일을?|종료일을?|신축현장|신축공사|현장을?|공구를?|연장해줘?|연장해?|연장|늘려줘?|늘려?|단축해줘?|단축해?|단축|조기종료|으로|까지|로)', ' ', p)
        tokens = [t.strip() for t in cleaned.split() if len(t.strip()) >= 2]

        customer = ""
        for t in tokens:
            if t != site and not any(k in t for k in ['공구', '현장', '신축', '공사']):
                customer = t
                break
        if not customer and tokens:
            customer = tokens[0]

        default_reason = f"{duration_months}개월 계약 기간 연장" if is_extend and duration_months else ("계약 기간 단축" if is_shorten else "계약 기간 연장")

        return {
            "tool": "execute_workflow",
            "params": {
                "workflow": workflow,
                "customer": customer,
                "site": site,
                "duration_months": duration_months,
                "target_date": target_date,
                "reason": default_reason
            }
        }

    # 2. 🚚 출고 배차 의뢰 (DISPATCH_REQUEST) 의도 판별
    is_dispatch_req = any(k in p_lower for k in ['출고요청', '출고 요청', '출고의뢰', '출고 의뢰', '배차요청', '배차 요청', '배차의뢰', '배차 의뢰', '출고해', '장비 보내'])
    has_dispatch_signals = any(k in p_lower for k in ['출고', '배차']) and any(k in p_lower for k in ['대', '공구', '현장', '1930', '3246', 'sj', 'gs'])
    if is_dispatch_req or has_dispatch_signals:
        # 모델명 추출 (예: 1930, 3246, 1230, GS-1930, SJ3219 등)
        model = ""
        m_model = re.search(r'([A-Za-z]*[-_]?\d{4}[A-Za-z]*)', p)
        if m_model:
            raw_mod = m_model.group(1).upper()
            model = f"GS-{raw_mod}" if raw_mod in ['1930', '3246', '1530', '2032', '2632'] else raw_mod

        # 수량 추출 (예: 2대, 1 대 등)
        quantity = 1
        m_qty = re.search(r'(\d+)\s*대', p)
        if m_qty:
            quantity = int(m_qty.group(1))

        # 납기 희망일시 추출 (예: 내일, 낼아침, 모레, 10월 5일, 08시 등)
        delivery_time = ""
        if '내일' in p_lower or '낼' in p_lower:
            delivery_time += "내일 "
        if '아침' in p_lower or '오전' in p_lower:
            delivery_time += "오전 "
        m_hour = re.search(r'(\d+)\s*시', p)
        if m_hour:
            delivery_time += f"{m_hour.group(1)}시 "
        m_spec_date = re.search(r'(\d{1,2})월\s*(\d{1,2})일', p)
        if m_spec_date:
            delivery_time = f"{m_spec_date.group(1)}월 {m_spec_date.group(2)}일 {delivery_time}".strip()

        # 현장명 추출 (예: 1공구, 2현장 등)
        site = ""
        m_site = re.search(r'([0-9가-힣a-zA-Z]+(?:공구|현장))', p)
        if m_site:
            site = m_site.group(1)

        # 고객사명 추출
        cleaned = re.sub(r'([A-Za-z]*[-_]?\d{4}[A-Za-z]*|\d+\s*대|출고요청|출고\s*요청|출고의뢰|출고\s*의뢰|배차요청|배차\s*요청|배차의뢰|배차\s*의뢰|출고해줘?|출고|배차|내일|낼아침|아침|오전|오후|\d+시|\d+월\s*\d+일|현장을?|공구를?|신축|공사|착불|선불)', ' ', p)
        tokens = [t.strip() for t in cleaned.split() if len(t.strip()) >= 2]
        customer = ""
        for t in tokens:
            if t != site and not any(k in t for k in ['공구', '현장', '신축', '공사']):
                customer = t
                break
        if not customer and tokens:
            customer = tokens[0]

        billable = '착불' in p_lower

        missing_slots = []
        if not customer and not site:
            missing_slots.append("거래처/현장명")
        if not model:
            missing_slots.append("요구 장비 모델명")

        return {
            "tool": "execute_workflow",
            "params": {
                "workflow": "DISPATCH_REQUEST",
                "customer": customer,
                "site": site,
                "model": model or "GS-1930",
                "quantity": quantity,
                "delivery_time": delivery_time.strip() or "익일 오전",
                "billable": billable,
                "missing_slots": missing_slots,
                "raw_text": p
            }
        }

    # 3. 🚛 배차 정보 입력 (기사/차량/운송비 배정 - DISPATCH_ASSIGN)
    is_dispatch_assign = any(k in p_lower for k in ['배정', '기사', '배차입력', '배차정보', '배차 완료', '배차완료']) and any(k in p_lower for k in ['만원', '원', '톤', 't', '공구', '현장', '기사'])
    if is_dispatch_assign:
        # 기사명 추출
        driver_name = ""
        for cand in re.findall(r'([가-힣]{2,4}(?:기사)?)', p):
            if cand.endswith('기사'):
                driver_name = cand
                break
        if not driver_name:
            m_d = re.search(r'([가-힣]{2,3})\s*(?:기사|차주)', p)
            if m_d:
                driver_name = f"{m_d.group(1)}기사"

        # 전화번호 추출
        driver_contact = ""
        m_phone = re.search(r'(01[016789][-.\s]?\d{3,4}[-.\s]?\d{4})', p)
        if m_phone:
            driver_contact = m_phone.group(1)

        # 차종 추출 (예: 1톤, 3.5톤, 5톤 등)
        vehicle_type = "5T"
        m_veh = re.search(r'(\d+(?:\.\d+)?)\s*(?:톤|t|T)', p)
        if m_veh:
            vehicle_type = f"{m_veh.group(1)}T"

        # 운송비 추출 (예: 15만원 ➔ 150000)
        cost = 0
        m_manwon = re.search(r'(\d+)\s*만\s*원?', p)
        if m_manwon:
            cost = int(m_manwon.group(1)) * 10000
        else:
            m_won = re.search(r'(\d{1,3}(?:,\d{3})+|\d{4,8})\s*원?', p)
            if m_won:
                cost = int(m_won.group(1).replace(',', ''))

        site = ""
        m_site = re.search(r'([0-9가-힣a-zA-Z]+(?:공구|현장))', p)
        if m_site:
            site = m_site.group(1)

        cleaned = re.sub(r'(\d+\s*만\s*원?|\d+(?:\.\d+)?\s*(?:톤|t|T)|[가-힣]{2,4}기사|배정|배차|입력|완료|현장|공구|01[016789][-.\s]?\d{3,4}[-.\s]?\d{4})', ' ', p)
        tokens = [t.strip() for t in cleaned.split() if len(t.strip()) >= 2]
        customer = tokens[0] if tokens else ""

        return {
            "tool": "execute_workflow",
            "params": {
                "workflow": "DISPATCH_ASSIGN",
                "customer": customer,
                "site": site,
                "driver_name": driver_name or "김기사",
                "driver_contact": driver_contact,
                "vehicle_type": vehicle_type,
                "cost": cost or 150000,
                "raw_text": p
            }
        }

    # 4. ✉️ 공식 이메일 발송 (MAIL_SEND) 의도 판별
    is_mail_action = any(k in p_lower for k in ['보내', '보내줘', '송부', '발송', '메일', '이메일'])
    is_mail_target = any(k in p_lower for k in ['회사소개서', '견적서', '제원표', '카탈로그', '브로셔', '계약서식', '서식'])
    if is_mail_action and is_mail_target:
        mail_type = "CUSTOM"
        if '회사소개서' in p_lower:
            mail_type = "COMPANY_PROFILE"
        elif '견적' in p_lower:
            mail_type = "QUOTE"
        elif any(k in p_lower for k in ['제원표', '카탈로그', '브로셔']):
            mail_type = "CATALOG_SPEC"
        elif any(k in p_lower for k in ['계약서식', '서식']):
            mail_type = "CONTRACT_BUNDLE"

        model = ""
        m_model = re.search(r'([A-Za-z]*[-_]?\d{4}[A-Za-z]*)', p)
        if m_model:
            raw_mod = m_model.group(1).upper()
            model = f"GS-{raw_mod}" if raw_mod in ['1930', '3246', '1530', '2032', '2632'] else raw_mod

        quantity = 1
        m_qty = re.search(r'(\d+)\s*대', p)
        if m_qty:
            quantity = int(m_qty.group(1))

        recipient = ""
        m_recip = re.search(r'([가-힣]{1,4}(?:부장|과장|차장|대리|소장|팀장|대표|기사|주임))', p)
        if m_recip:
            recipient = m_recip.group(1)

        cleaned = re.sub(r'([가-힣]{1,4}(?:부장|과장|차장|대리|소장|팀장|대표|기사|주임)|[A-Za-z]*[-_]?\d{4}[A-Za-z]*|\d+\s*대|회사소개서|견적서|제원표|카탈로그|브로셔|계약서식|서식|보내줘?|송부|발송|이?메일로?|에게|한테)', ' ', p)
        tokens = [t.strip() for t in cleaned.split() if len(t.strip()) >= 2]
        customer = tokens[0] if tokens else ""

        return {
            "tool": "execute_workflow",
            "params": {
                "workflow": "MAIL_SEND",
                "mail_type": mail_type,
                "customer": customer,
                "recipient": recipient,
                "model": model or "GS-1930",
                "quantity": quantity,
                "raw_text": p
            }
        }

    return None

def normalize_menu_id(raw_menu: str) -> str:
    if not raw_menu:
        return 'dashboard'
    raw_str = str(raw_menu).strip()
    # 1. 괄호 안 영문 키워드 추출: 예) 계약(contract) -> contract
    match = re.search(r'\(([a-zA-Z0-9_]+)\)', raw_str)
    if match:
        return match.group(1).lower()
    # 2. 영문 ID 단독 존재 확인
    match = re.search(r'^[a-zA-Z0-9_]+$', raw_str)
    if match:
        return match.group(0).lower()
    # 3. 한글 키워드 사전 매핑
    for k, v in MENU_MAPPING.items():
        if k in raw_str:
            return v
    return raw_str.lower()

class AiBrain:
    def __init__(self):
        self.preferred_model = DEFAULT_MODEL
        self.http_client = httpx.AsyncClient(timeout=10.0)

    async def check_ollama_available(self) -> bool:
        try:
            res = await self.http_client.get("http://127.0.0.1:11434/api/tags")
            return res.status_code == 200
        except Exception:
            return False

    async def parse_instruction(self, user_prompt: str, current_context: dict = None) -> dict:
        """
        사용자 지시를 분석하여 단일 또는 다단계 Tool Call 액션 큐(actions) 생성
        """
        prompt = user_prompt.strip()

        # 0. 🏛️ 도메인 고수준 비즈니스 워크플로(계약 연장/단축 등) 1순위 시맨틱 인터셉트
        domain_act = extract_domain_workflow(prompt)
        if domain_act:
            return {
                "source": "DOMAIN_WORKFLOW_ENGINE",
                "model": "deterministic-domain-v1",
                "thought": f"고수준 도메인 워크플로 감지: {domain_act['params']['workflow']}",
                "tool": domain_act["tool"],
                "params": domain_act["params"],
                "actions": [domain_act]
            }

        # 1. Ollama 구동 여부 확인 및 LLM 추론
        ollama_online = await self.check_ollama_available()
        if ollama_online:
            try:
                plan = await self._call_ollama(prompt, current_context)
                if plan:
                    actions = []
                    if "actions" in plan and isinstance(plan["actions"], list):
                        actions = plan["actions"]
                    elif "tool" in plan:
                        actions = [{"tool": plan["tool"], "params": plan.get("params", {})}]

                    # 정규화
                    for act in actions:
                        if act.get("tool") == "navigate_menu" and "params" in act:
                            act["params"]["menuId"] = normalize_menu_id(act["params"].get("menuId"))

                    # 🔥 사용자 지시문(prompt)의 핵심 의도 누락 시 자동 보완
                    p_lower = prompt.lower()
                    has_search = any(a.get("tool") == "click_element" and any(k in str(a.get("params", {}).get("target", "")) for k in ['조회', '검색']) for a in actions)
                    has_excel = any(a.get("tool") == "click_element" and any(k in str(a.get("params", {}).get("target", "")) for k in ['엑셀', '다운로드', '다운', '내보내기']) for a in actions)

                    if not has_search and any(w in p_lower for w in ['조회', '검색', '전부 조회', '필터']):
                        actions.append({"tool": "click_element", "params": {"target": "조회"}})

                    if not has_excel and any(w in p_lower for w in ['엑셀', '다운로드', '다운', '내보내기']):
                        actions.append({"tool": "click_element", "params": {"target": "엑셀 다운로드"}})

                    if actions:
                        return {
                            "source": "OLLAMA_LLM",
                            "model": self.preferred_model,
                            "thought": plan.get("thought", ""),
                            "tool": actions[0]["tool"],
                            "params": actions[0].get("params", {}),
                            "actions": actions
                        }
            except Exception as e:
                print(f"⚠️ [AiBrain] Ollama 추론 실패/지연 -> 내장 규칙 엔진 폴백: {e}")

        # 2. 내장 고속 결정론적 규칙 파서 (다단계 파이프라인 지원)
        return self._rule_based_fallback(prompt, current_context)

    async def _call_ollama(self, prompt: str, context: dict) -> dict:
        cur_menu = context.get('currentMenu') if context else None
        menu_knowledge_chunk = get_menu_context_prompt(cur_menu, prompt)
        full_system_prompt = f"{SYSTEM_PROMPT}\n{menu_knowledge_chunk}" if menu_knowledge_chunk else SYSTEM_PROMPT

        context_str = f"\n[현재 화면 컨텍스트]\n{json.dumps(context or {}, ensure_ascii=False)}" if context else ""
        payload = {
            "model": self.preferred_model,
            "messages": [
                {"role": "system", "content": full_system_prompt},
                {"role": "user", "content": f"{prompt}{context_str}"}
            ],
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.1,
                "num_predict": 256
            }
        }

        res = await self.http_client.post(OLLAMA_API_URL, json=payload)
        if res.status_code == 200:
            content = res.json().get("message", {}).get("content", "").strip()
            match = re.search(r'\{.*\}', content, re.DOTALL)
            if match:
                return json.loads(match.group(0))
        return None

    def _rule_based_fallback(self, prompt: str, context: dict) -> dict:
        """
        100% 무중단 보장을 위한 결정론적 시맨틱 파서 (다단계 파이프라인 생성)
        """
        p = prompt.lower()
        actions = []

        # 1. SoM 번호표 제어
        if any(w in p for w in ['번호표', 'som', '라벨', '마크', 'set-of-mark']):
            enable = not any(w in p for w in ['꺼', '닫', '해제', 'off'])
            return {
                "source": "RULE_ENGINE",
                "tool": "toggle_som",
                "params": {"enable": enable},
                "actions": [{"tool": "toggle_som", "params": {"enable": enable}}]
            }

        # 2. 메뉴 식별
        target_menu = None
        for keyword, menu_id in MENU_MAPPING.items():
            if keyword in p:
                target_menu = menu_id
                break

        if target_menu:
            actions.append({"tool": "navigate_menu", "params": {"menuId": target_menu}})

        # 3. 조회/검색 의도
        if any(w in p for w in ['조회', '검색', '전부 조회', '필터']):
            actions.append({"tool": "click_element", "params": {"target": "조회"}})

        # 4. 엑셀 다운로드 의도
        if any(w in p for w in ['엑셀', '다운로드', '다운']):
            actions.append({"tool": "click_element", "params": {"target": "엑셀 다운로드"}})

        # 복합 액션이 구성된 경우 즉시 반환
        if len(actions) > 0:
            return {
                "source": "RULE_ENGINE",
                "thought": f"다단계 작업 지시 감지: 총 {len(actions)}개 단계 순차 실행",
                "tool": actions[0]["tool"],
                "params": actions[0].get("params", {}),
                "actions": actions
            }

        # 5. 화면 읽기 / 데이터 조회
        if any(w in p for w in ['화면 읽', 'dom', '요약', '상태 확인', '정보 읽']):
            return {"source": "RULE_ENGINE", "tool": "get_page_content", "params": {}, "actions": [{"tool": "get_page_content", "params": {}}]}

        if any(w in p for w in ['테이블', '그리드', '목록 읽', '데이터 읽']):
            return {"source": "RULE_ENGINE", "tool": "read_table", "params": {"selector": "table"}, "actions": [{"tool": "read_table", "params": {"selector": "table"}}]}

        # 6. 단순 클릭 판별
        click_match = re.search(r'["\']?([^"\']+)["\']?\s*(?:버튼\s*)?(?:클릭|눌러|선택)', prompt)
        if click_match:
            target = click_match.group(1).strip()
            return {"source": "RULE_ENGINE", "tool": "click_element", "params": {"target": target}, "actions": [{"tool": "click_element", "params": {"target": target}}]}

        # 7. 텍스트 입력 판별
        type_match = re.search(r'["\']?([^"\']+)["\']?\s*(?:에|란에|창에)\s*["\']?([^"\']+)["\']?\s*(?:입력|작성|써)', prompt)
        if type_match:
            target = type_match.group(1).strip()
            text = type_match.group(2).strip()
            act = {"tool": "type_text", "params": {"target": target, "text": text, "pressEnter": True}}
            return {"source": "RULE_ENGINE", "tool": "type_text", "params": act["params"], "actions": [act]}

        # 기본값: 화면 상태 진단
        return {"source": "RULE_ENGINE", "tool": "get_page_content", "params": {}, "actions": [{"tool": "get_page_content", "params": {}}]}

    async def analyze_call_transcript(self, transcript_text: str) -> dict:
        """
        통화 녹취 전문을 분석하여:
        1. 통화 요약(1~2줄)
        2. 비즈니스 업무 인텐트(출고배차, 계약연장 등) 및 슬롯
        3. 정제된 실행 계획(actions) 생성
        """
        text = transcript_text.strip()

        # 1. Ollama LLM 추론 시도
        ollama_online = await self.check_ollama_available()
        if ollama_online:
            try:
                system_prompt = (
                    "당신은 건설장비 렌탈 ERP 시스템의 통화 녹취 분석 전문 AI입니다.\n"
                    "고객사/현장소장과의 통화 녹취록 전문을 읽고, 일상 대화나 안부를 제외한 핵심 비즈니스 요구사항을 분석하여 JSON으로 응답하십시오.\n\n"
                    "지원 업무(workflow):\n"
                    "- DISPATCH_REQUEST: 신규 출고 배차 의뢰 (장비 보내달라, 출고해달라)\n"
                    "- CONTRACT_EXTEND: 계약 기간 연장 (공기 연장, 더 쓰겠다)\n"
                    "- CONTRACT_SHORTEN: 조기 반납/종료 (일찍 빼겠다)\n"
                    "- DISPATCH_ASSIGN: 배차 기사 배정 및 운송비\n"
                    "- GENERAL_INQUIRY: 단순 문의/잡담\n\n"
                    "응답 JSON 규격:\n"
                    "{\n"
                    '  "summary": "1~2줄 건조한 명사형 통화 요약",\n'
                    '  "workflow": "DISPATCH_REQUEST|CONTRACT_EXTEND|CONTRACT_SHORTEN|DISPATCH_ASSIGN|GENERAL_INQUIRY",\n'
                    '  "customer": "거래처명",\n'
                    '  "site": "현장명",\n'
                    '  "model": "장비모델명(예: GS-1930, GS-3246 등)",\n'
                    '  "quantity": 1,\n'
                    '  "target_date": "희망일시",\n'
                    '  "duration_months": 0,\n'
                    '  "memo": "특이사항 메모"\n'
                    "}"
                )
                payload = {
                    "model": self.preferred_model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"[통화 녹취록]\n{text}"}
                    ],
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.1, "num_predict": 300}
                }
                res = await self.http_client.post(OLLAMA_API_URL, json=payload, timeout=15.0)
                if res.status_code == 200:
                    content = res.json().get("message", {}).get("content", "").strip()
                    match = re.search(r'\{.*\}', content, re.DOTALL)
                    if match:
                        parsed = json.loads(match.group(0))
                        wf = parsed.get("workflow", "DISPATCH_REQUEST")
                        return {
                            "source": "OLLAMA_CALL_ANALYZER",
                            "summary": parsed.get("summary", "통화 분석 완료"),
                            "workflow": wf,
                            "params": {
                                "workflow": wf,
                                "customer": parsed.get("customer", ""),
                                "site": parsed.get("site", ""),
                                "model": parsed.get("model", "GS-1930"),
                                "quantity": int(parsed.get("quantity") or 1),
                                "delivery_time": parsed.get("target_date", "익일 오전"),
                                "target_date": parsed.get("target_date"),
                                "duration_months": int(parsed.get("duration_months") or 0),
                                "memo": parsed.get("memo", f"[통화녹취] {text[:60]}...")
                            }
                        }
            except Exception as e:
                print(f"⚠️ [AiBrain] LLM 통화 분석 실패 -> 규칙 엔진 폴백: {e}")

        # 2. 내장 시맨틱 파서 폴백
        domain_act = extract_domain_workflow(text)
        if domain_act:
            wf = domain_act["params"]["workflow"]
            return {
                "source": "RULE_CALL_ANALYZER",
                "summary": f"{domain_act['params'].get('customer', '')} {domain_act['params'].get('site', '')} 업무 요청 감지",
                "workflow": wf,
                "params": domain_act["params"]
            }

        return {
            "source": "FALLBACK",
            "summary": "일반 통화 (특정 비즈니스 업무 미감지)",
            "workflow": "GENERAL_INQUIRY",
            "params": {"raw_text": text}
        }

ai_brain = AiBrain()
