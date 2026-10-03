"""
ebro-agent-core/telegram_bot.py
전사 표준 헌장 [7절] 준수: 텔레그램 Bot API 기반 사외 원격 제어 파이프라인
Long Polling 방식을 사용하여 사내 방화벽/포트포워딩 없이 외부 모바일 원격 제어 수행
"""

import os
import asyncio
import httpx
import json

class TelegramRemoteAgent:
    def __init__(self, fsm_engine):
        self.fsm = fsm_engine
        self.bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        self.allowed_user_id = os.environ.get('TELEGRAM_ALLOWED_USER_ID')
        self.is_running = False
        self.last_update_id = 0
        self.debounce_tasks = {}       # chat_id -> asyncio.Task
        self.message_buffers = {}      # chat_id -> [text1, text2, ...]
        self.conversation_slots = {}   # chat_id -> {customer, site, model, ...}

    async def start(self):
        if not self.bot_token:
            print("ℹ️ [TelegramAgent] TELEGRAM_BOT_TOKEN 미설정 (사외 모바일 텔레그램 제어 대기 모드)")
            return

        print("🚀 [TelegramAgent] 텔레그램 Long Polling 원격 제어기 활성화 시작...")
        self.is_running = True
        asyncio.create_task(self._poll_loop())

    async def _poll_loop(self):
        url = f"https://api.telegram.org/bot{self.bot_token}/getUpdates"
        async with httpx.AsyncClient(timeout=35.0) as client:
            while self.is_running:
                try:
                    params = {"offset": self.last_update_id + 1, "timeout": 30}
                    res = await client.get(url, params=params)
                    if res.status_code == 200:
                        data = res.json()
                        for update in data.get("result", []):
                            self.last_update_id = update["update_id"]
                            await self._handle_update(client, update)
                except Exception as e:
                    await asyncio.sleep(5)

    async def _handle_update(self, client: httpx.AsyncClient, update: dict):
        message = update.get("message")
        if not message:
            return

        sender_id = str(message.get("from", {}).get("id"))
        chat_id = message.get("chat", {}).get("id")
        text = (message.get("text") or "").strip()

        # 화이트리스트 사용자 검증
        if self.allowed_user_id and sender_id != self.allowed_user_id:
            return

        if not text:
            return

        # /start 최초 접속 인사말
        if text == '/start':
            self.conversation_slots.pop(chat_id, None)
            self.message_buffers.pop(chat_id, None)
            send_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            welcome_msg = (
                "👋 안녕하세요 사장님!\neBro ERP PC 에이전트와 모바일 텔레그램 연동이 완료되었습니다.\n\n"
                "자연어 및 단문 파편 지시를 입력하시면 사무실 PC 브라우저가 실시간 자동 처리합니다.\n"
                "• 계약 연장: '에이치엔아이씨 1공구 계약 6개월 연장해'\n"
                "• 출고 배차: '에이치 1공구 1930 2대 내일 아침 출고요청'\n"
                "• 기사 배정: '에이치 1공구 김기사 5톤 15만원 배정'\n"
                "• 단문 파편: 2~3초 간격으로 쪼개서 보내셔도 하나로 결합 처리됩니다."
            )
            await client.post(send_url, json={"chat_id": chat_id, "text": welcome_msg})
            return

        # /reset 세션 초기화
        if text == '/reset':
            self.conversation_slots.pop(chat_id, None)
            self.message_buffers.pop(chat_id, None)
            send_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            await client.post(send_url, json={"chat_id": chat_id, "text": "🔄 대화 세션 및 입력 버퍼가 초기화되었습니다."})
            return

        # 🔄 파편 지시 디바운스 버퍼링 (Debounce Buffering: 2.5초 대기)
        if chat_id in self.debounce_tasks and not self.debounce_tasks[chat_id].done():
            self.debounce_tasks[chat_id].cancel()

        self.message_buffers.setdefault(chat_id, []).append(text)

        # 2.5초 타이머 시작 (영업사원이 후속 단문을 보내면 타이머가 리셋됨)
        task = asyncio.create_task(self._debounce_and_execute(client, chat_id))
        self.debounce_tasks[chat_id] = task

    async def _debounce_and_execute(self, client: httpx.AsyncClient, chat_id: int):
        try:
            await asyncio.sleep(2.5) # 단문 입력 대기 윈도우
        except asyncio.CancelledError:
            return

        # 모인 텍스트 병합
        raw_texts = self.message_buffers.pop(chat_id, [])
        if not raw_texts:
            return

        current_prompt = " ".join(raw_texts)

        # 이전 턴에 보존된 슬롯 컨텍스트가 있다면 결합
        saved_context = self.conversation_slots.get(chat_id)
        if saved_context:
            context_prefix = f"{saved_context.get('customer', '')} {saved_context.get('site', '')}".strip()
            full_prompt = f"{context_prefix} {current_prompt}".strip()
        else:
            full_prompt = current_prompt

        send_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        await client.post(send_url, json={"chat_id": chat_id, "text": f"⏳ eBro ERP 작업 처리 중: '{full_prompt}'"})

        # FSM 에이전트 실행
        exec_res = await self.fsm.execute_instruction(full_prompt, source="TELEGRAM")

        if exec_res.get("success"):
            # 성공 시 대화 슬롯 초기화
            self.conversation_slots.pop(chat_id, None)
            total_steps = exec_res.get('total_steps', 1)
            steps_info = ""
            detail_msg = ""
            if exec_res.get("steps"):
                steps_info = "\n" + "\n".join([f"  ↳ [{s['step']}단계] {s['tool']}" for s in exec_res["steps"]])
                last_step_res = exec_res["steps"][-1].get("result", {})
                if isinstance(last_step_res, dict) and last_step_res.get("message"):
                    detail_msg = f"\n\n📢 {last_step_res.get('message')}"
            reply = f"✅ 작업 완료! (총 {total_steps}단계){steps_info}{detail_msg}\n- 처리시간: {exec_res.get('latency_ms', 0)}ms"
        elif exec_res.get("status") == "WAIT_APPROVAL":
            reply = f"⚠️ 결재/승인 필요 액션입니다.\n- 사유: {exec_res.get('message')}\n- 승인 ID: {exec_res.get('approval_id')}"
        else:
            err_msg = exec_res.get('error')
            if not err_msg and exec_res.get('steps'):
                for s in exec_res['steps']:
                    step_err = s.get('result', {}).get('error')
                    if step_err:
                        err_msg = f"[{s.get('step')}단계 ({s.get('tool')})] {step_err}"
                        break
            reply = f"❌ 실행 오류 발생: {err_msg or '상태 확인 불가'}"

        await client.post(send_url, json={"chat_id": chat_id, "text": reply})

    async def update_credentials(self, token: str, allowed_user_id: str):
        """환경설정 UI에서 변경된 봇 토큰 및 사용자 ID 핫 리로드"""
        self.is_running = False
        await asyncio.sleep(0.5)
        self.bot_token = token.strip() if token else None
        self.allowed_user_id = allowed_user_id.strip() if allowed_user_id else None
        self.last_update_id = 0
        if self.bot_token:
            await self.start()

    async def send_test_message(self, chat_id: str = None) -> dict:
        """연동 확인용 테스트 메시지 전송"""
        target_id = chat_id or self.allowed_user_id
        if not self.bot_token:
            return {"success": False, "error": "TELEGRAM_BOT_TOKEN이 설정되지 않았습니다."}
        if not target_id:
            return {"success": False, "error": "TELEGRAM_ALLOWED_USER_ID가 설정되지 않았습니다."}

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.post(url, json={
                    "chat_id": target_id,
                    "text": "🔔 [ebro web agent] PC 에이전트와 모바일 텔레그램 연동이 성공적으로 완료되었습니다."
                })
                if res.status_code == 200:
                    return {"success": True, "message": "테스트 메시지 발송 완료"}
                else:
                    err_desc = res.json().get("description", res.text)
                    return {"success": False, "error": f"텔레그램 응답 실패: {err_desc}"}
            except Exception as e:
                return {"success": False, "error": f"네트워크 통신 오류: {str(e)}"}
