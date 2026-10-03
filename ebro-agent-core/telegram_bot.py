"""
ebro-agent-core/telegram_bot.py
전사 표준 헌장 [7절] 준수: 텔레그램 Bot API 기반 사외 원격 제어 파이프라인
Long Polling 방식을 사용하여 사내 방화벽/포트포워딩 없이 외부 모바일 원격 제어 수행
"""

import os
import sys
import asyncio
import httpx
import json
import time
import difflib
from stt_engine import stt_engine
from ai_brain import ai_brain

KNOWN_CUSTOMERS = [
    "에이치아이엔씨", "에이치엔아이씨", "현대건설", "대우건설",
    "포스코이앤씨", "삼성물산", "GS건설", "판교건설", "대현테크",
    "삼정건설", "AJ네트웍스", "한국종합렌탈", "롯데건설", "한화건설"
]

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
        self.job_queue = asyncio.Queue()  # FIFO 비동기 작업 큐
        self.is_processing_job = False    # 현재 FSM 실행 중 여부
        self.current_job_name = ""        # 현재 실행 중인 작업 명칭
        self.queue_worker_task = None     # 큐 워커 백그라운드 태스크

    def _get_user_profile(self, sender_id: str, first_name: str = "") -> dict:
        """개별 사용자별 맞춤 호칭(callsign) 및 봇 애칭(bot_name) 조회 (개인화 엔진)"""
        if sender_id in self.user_profiles:
            return self.user_profiles[sender_id]

        # 기본 관리자/사장님 (TELEGRAM_ALLOWED_USER_ID)
        if self.allowed_user_id and str(sender_id) == str(self.allowed_user_id):
            return {"callsign": "사장님", "bot_name": "자비스"}

        # 일반 임직원: 텔레그램 프로필 이름 반영
        default_name = first_name.strip() if first_name else "임직원"
        return {"callsign": f"{default_name}님", "bot_name": "eBro 비서"}

    def set_user_profile(self, sender_id: str, callsign: str, bot_name: str):
        """특정 사용자의 호칭 및 봇 애칭 등록"""
        self.user_profiles[str(sender_id)] = {
            "callsign": callsign.strip(),
            "bot_name": bot_name.strip()
        }

    async def start(self):
        if not self.bot_token:
            print("ℹ️ [TelegramAgent] TELEGRAM_BOT_TOKEN 미설정 (사외 모바일 텔레그램 제어 대기 모드)")
            return

        print("🚀 [TelegramAgent] 텔레그램 Long Polling 원격 제어기 활성화 시작...")
        self.is_running = True
        self.queue_worker_task = asyncio.create_task(self._queue_worker_loop())
        asyncio.create_task(self._poll_loop())

    async def _queue_worker_loop(self):
        """명령 처리 큐 순차 집행 루프 (FIFO Queue Worker)"""
        while self.is_running:
            try:
                job = await self.job_queue.get()
            except asyncio.CancelledError:
                break

            self.is_processing_job = True
            self.current_job_name = job["prompt"]
            try:
                await self._execute_job_in_fsm(
                    job["client"],
                    job["chat_id"],
                    job["prompt"],
                    job.get("source", "TELEGRAM")
                )
            except Exception as e:
                print(f"❌ [QueueWorker] 작업 집행 예외: {e}")
            finally:
                self.is_processing_job = False
                self.current_job_name = ""
                self.job_queue.task_done()

    async def enqueue_job(self, client: httpx.AsyncClient, chat_id: int, prompt: str, source: str = "TELEGRAM"):
        """FIFO 작업 대기열에 등록 및 대기 안내"""
        send_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        qsize = self.job_queue.qsize()

        if self.is_processing_job or qsize > 0:
            wait_msg = (
                f"📥 [명령 대기열 등록 (FIFO Queue)]\n"
                f"• 현재 처리 중인 작업: '{self.current_job_name}'\n"
                f"• 대기 번호: {qsize + 1}번\n\n"
                f"앞선 작업이 브라우저에서 완료되는 즉시 순서대로 실행됩니다."
            )
            await client.post(send_url, json={"chat_id": chat_id, "text": wait_msg})

        await self.job_queue.put({
            "client": client,
            "chat_id": chat_id,
            "prompt": prompt,
            "source": source
        })

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

    def _get_main_menu_markup(self):
        """메인 대화형 인라인 키보드 메뉴"""
        return {
            "inline_keyboard": [
                [
                    {"text": "📋 1. 출고 요청", "callback_data": "BTN_DISPATCH_REQ"},
                    {"text": "🚛 2. 배차 정보 입력", "callback_data": "BTN_DISPATCH_ASSIGN"}
                ],
                [
                    {"text": "✉️ 3. 공식 이메일 발송", "callback_data": "BTN_MAIL_MENU"},
                    {"text": "📄 4. 계약 연장/단축", "callback_data": "BTN_CONTRACT_MENU"}
                ],
                [
                    {"text": "🔄 대화 세션 초기화", "callback_data": "BTN_RESET"}
                ]
            ]
        }

    def _get_customer_next_actions_markup(self, customer: str):
        """거래처 확정 후 다음 추천 액션 선택 메뉴"""
        return {
            "inline_keyboard": [
                [
                    {"text": f"⏱️ 계약 연장 / 단축", "callback_data": f"SUB_EXT_{customer}"},
                    {"text": f"🚛 출고 배차 요청", "callback_data": f"SUB_DISP_{customer}"}
                ],
                [
                    {"text": f"✉️ 공식 견적서 발송", "callback_data": f"SUB_MAIL_{customer}"},
                    {"text": "🔄 거래처 초기화", "callback_data": "BTN_RESET"}
                ]
            ]
        }

    def _get_extend_duration_markup(self, customer: str):
        """계약 연장 기간 선택 메뉴"""
        return {
            "inline_keyboard": [
                [
                    {"text": "1개월 연장", "callback_data": f"ACT_DO_EXT_{customer}_1m"},
                    {"text": "3개월 연장", "callback_data": f"ACT_DO_EXT_{customer}_3m"}
                ],
                [
                    {"text": "6개월 연장", "callback_data": f"ACT_DO_EXT_{customer}_6m"},
                    {"text": "1년 연장", "callback_data": f"ACT_DO_EXT_{customer}_12m"}
                ],
                [
                    {"text": "종료일 미정 (상시대여)", "callback_data": f"ACT_DO_EXT_{customer}_open"},
                    {"text": "🔙 뒤로가기", "callback_data": f"SUB_EXT_BACK_{customer}"}
                ]
            ]
        }

    def _get_dispatch_model_markup(self, customer: str):
        """출고 기종 선택 메뉴"""
        return {
            "inline_keyboard": [
                [
                    {"text": "GS-1930 1대 (익일)", "callback_data": f"ACT_DO_DISP_{customer}_1930_1"},
                    {"text": "GS-1930 2대 (익일)", "callback_data": f"ACT_DO_DISP_{customer}_1930_2"}
                ],
                [
                    {"text": "GS-3246 1대 (익일)", "callback_data": f"ACT_DO_DISP_{customer}_3246_1"},
                    {"text": "1012E 1대 (익일)", "callback_data": f"ACT_DO_DISP_{customer}_1012E_1"}
                ],
                [
                    {"text": "🔙 뒤로가기", "callback_data": f"SUB_EXT_BACK_{customer}"}
                ]
            ]
        }

    def _get_mail_sub_markup(self):
        """공식 이메일 서식 선택 서브 메뉴"""
        return {
            "inline_keyboard": [
                [
                    {"text": "🏢 회사소개서 발송", "callback_data": "BTN_MAIL_PROFILE"},
                    {"text": "📊 장비 견적서 발송", "callback_data": "BTN_MAIL_QUOTE"}
                ],
                [
                    {"text": "📖 장비 제원표 발송", "callback_data": "BTN_MAIL_SPEC"},
                    {"text": "📑 표준 계약 서식 발송", "callback_data": "BTN_MAIL_CONTRACT"}
                ],
                [
                    {"text": "🔙 메인 메뉴", "callback_data": "BTN_MAIN_MENU"}
                ]
            ]
        }

    async def _handle_update(self, client: httpx.AsyncClient, update: dict):
        # 1. 🔘 인라인 키보드 버튼 클릭(콜백 쿼리) 감지
        callback_query = update.get("callback_query")
        if callback_query:
            await self._handle_callback_query(client, callback_query)
            return

        message = update.get("message")
        if not message:
            return

        sender_id = str(message.get("from", {}).get("id"))
        chat_id = message.get("chat", {}).get("id")
        text = (message.get("text") or "").strip()

        # 🎙️ 음성 통화 자동 녹음 파일(.m4a, .mp3 등) 및 텔레그램 음성 메시지 감지
        voice_obj = message.get("voice") or message.get("audio")
        doc_obj = message.get("document")
        is_audio_doc = doc_obj and any(doc_obj.get("file_name", "").lower().endswith(ext) for ext in ['.m4a', '.mp3', '.wav', '.ogg', '.aac', '.flac'])

        target_audio = voice_obj or (doc_obj if is_audio_doc else None)
        if target_audio:
            await self._handle_audio_message(client, chat_id, target_audio)
            return

        if not text:
            return

        # 🤖 개인화 호출 엔진: 봇 애칭, "일해", "일하자", "/start", "/menu", "도움말" 반응형 메뉴 표출
        user_prof = self._get_user_profile(sender_id, message.get("from", {}).get("first_name", ""))
        bot_alias = user_prof["bot_name"].lower()
        callsign = user_prof["callsign"]

        # 트리거 단어: 사용자가 지정한 봇 이름, "일해", "일하자", "업무시작", "메뉴", "도움말", "/start", "/menu"
        trigger_keywords = [bot_alias, '일해', '일하자', '업무시작', '업무 시작', '메뉴', '도움말', '업무목록', '/start', '/menu', '/help']
        is_trigger_call = any(k in text.lower() for k in trigger_keywords)

        if is_trigger_call:
            self.conversation_slots.pop(chat_id, None)
            self.message_buffers.pop(chat_id, None)
            send_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
            welcome_msg = (
                f"🤖 {callsign}, eBro 업무 비서 {user_prof['bot_name']}입니다.\n\n"
                "어떤 업무를 처리할까요? 아래 버튼을 터치하시거나 직접 음성 또는 텍스트로 편하게 말씀해 주세요."
            )
            await client.post(send_url, json={
                "chat_id": chat_id,
                "text": welcome_msg,
                "reply_markup": self._get_main_menu_markup()
            })
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
            await asyncio.sleep(2.0) # 단문 입력 대기 윈도우
        except asyncio.CancelledError:
            return

        # 모인 텍스트 병합
        raw_texts = self.message_buffers.pop(chat_id, [])
        if not raw_texts:
            return

        current_prompt = " ".join(raw_texts).strip()
        send_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"

        # 1. 🔍 행동 의도(Action Verb) 존재 여부 검사
        ACTION_KEYWORDS = [
            '연장', '단축', '늘려', '줄여', '조기종료',
            '출고', '배차', '보내', '넣어', '빼줘',
            '배정', '기사', '만원', '운송비',
            '메일', '견적서', '회사소개서', '제원표', '카탈로그', '발송',
            '조회', '검색', '엑셀', '다운로드'
        ]
        has_action = any(k in current_prompt.lower() for k in ACTION_KEYWORDS)

        # 1-1. 💡 오타 추천에 대한 긍정 수락 ("응", "맞아", "네" 등) 처리
        AFFIRM_WORDS = ['응', '맞아', '네', '예', 'ㅇㅇ', '맞음', '그거', '그거야', '그래', '어', '맞소', '오케이', 'ok', 'yes']
        saved = self.conversation_slots.setdefault(chat_id, {})
        if current_prompt.lower().strip() in AFFIRM_WORDS and saved.get('suggested_customer'):
            suggested = saved.pop('suggested_customer')
            saved['customer'] = suggested
            cust_val = saved.get('customer')
            site_val = saved.get('site')
            msg = (
                f"✅ 거래처를 '{cust_val}'(으)로 확정했습니다.\n"
                f"• 거래처: {cust_val}\n"
                f"• 현장: {site_val or '미지정'}\n\n"
                f"원하시는 업무 버튼을 터치하시거나 말씀해 주세요."
            )
            await client.post(send_url, json={
                "chat_id": chat_id,
                "text": msg,
                "reply_markup": self._get_customer_next_actions_markup(cust_val)
            })
            return

        # 2. 🛑 행동 의도가 없는 순수 명사 파편 (예: "에이티아이엔씨", "1공구 신축현장", "에이치아이엔씨")
        if not has_action:
            # 현장 키워드가 있으면 site 슬롯으로 저장, 그렇지 않으면 customer 슬롯으로 저장/갱신
            if any(k in current_prompt for k in ['공구', '현장', '신축', '물류', '센터', '아파트', '빌딩', '공사']):
                saved['site'] = current_prompt
            else:
                saved['customer'] = current_prompt

            cust_val = saved.get('customer')
            site_val = saved.get('site')

            # 거래처 오타 검증 (Fuzzy Match)
            sugg_text = ""
            if cust_val:
                clean_cust = cust_val.replace(' ', '')
                matches = difflib.get_close_matches(clean_cust, KNOWN_CUSTOMERS, n=2, cutoff=0.35)
                if clean_cust not in KNOWN_CUSTOMERS and matches:
                    saved['suggested_customer'] = matches[0]
                    sugg_text = f"\n⚠️ 등록된 거래처 중 '{cust_val}'(은)는 없습니다.\n💡 혹시 '{matches[0]}' 거래처인가요? (맞으면 '응', 아니면 올바른 상호를 말씀해 주세요)"
                else:
                    saved.pop('suggested_customer', None)

            msg = (
                f"📥 [지시 접수 중]\n"
                f"• 거래처: {cust_val or '미지정'}\n"
                f"• 현장: {site_val or '미지정'}{sugg_text}\n\n"
                f"원하시는 업무(예: '6개월 연장', '1930 2대 내일 출고요청', '견적서 보내줘')를 이어서 말씀해 주시거나 아래 버튼을 터치해 주세요."
            )
            msg_payload = {"chat_id": chat_id, "text": msg}
            if cust_val and not sugg_text:
                msg_payload["reply_markup"] = self._get_customer_next_actions_markup(cust_val)

            await client.post(send_url, json=msg_payload)
            return

        # 3. 🚀 행동 의도가 있는 경우: 이전 대화 슬롯 컨텍스트와 안전하게 결합 후 FIFO 작업 큐 등록
        saved_context = self.conversation_slots.get(chat_id, {})
        saved_customer = saved_context.get('customer', '')
        saved_site = saved_context.get('site', '')

        prefix_parts = []
        if saved_customer and saved_customer not in current_prompt:
            prefix_parts.append(saved_customer)
        if saved_site and saved_site not in current_prompt:
            prefix_parts.append(saved_site)

        if prefix_parts:
            full_prompt = f"{' '.join(prefix_parts)} {current_prompt}".strip()
        else:
            full_prompt = current_prompt

        # FIFO 명령 처리 큐에 안전 등록
        await self.enqueue_job(client, chat_id, full_prompt, source="TELEGRAM")

    async def _execute_job_in_fsm(self, client: httpx.AsyncClient, chat_id: int, full_prompt: str, source: str = "TELEGRAM"):
        """FSM 실행 엔진 호출 및 완료/오류 영수증 회신"""
        send_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        await client.post(send_url, json={"chat_id": chat_id, "text": f"⏳ eBro ERP 작업 처리 중: '{full_prompt}'"})

        exec_res = await self.fsm.execute_instruction(full_prompt, source=source)

        if exec_res.get("success"):
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
            reply = f"❌ 실행 오류 발생: {err_msg or '상태 확인 불가'}\n\n💡 거래처명이나 현장명을 다시 말씀해 주시면 수정하여 다시 처리합니다."

        await client.post(send_url, json={"chat_id": chat_id, "text": reply})

    async def _download_telegram_file(self, client: httpx.AsyncClient, file_id: str, dest_path: str) -> bool:
        """텔레그램 Bot API getFile을 통해 파일 다운로드"""
        try:
            get_file_url = f"https://api.telegram.org/bot{self.bot_token}/getFile"
            res = await client.get(get_file_url, params={"file_id": file_id})
            if res.status_code != 200:
                print(f"❌ [TelegramAgent] getFile 실패: {res.text}")
                return False

            file_path = res.json().get("result", {}).get("file_path")
            if not file_path:
                return False

            download_url = f"https://api.telegram.org/file/bot{self.bot_token}/{file_path}"
            async with client.stream("GET", download_url) as stream:
                if stream.status_code != 200:
                    return False
                with open(dest_path, "wb") as f:
                    async for chunk in stream.aiter_bytes():
                        f.write(chunk)
            return True
        except Exception as e:
            print(f"❌ [TelegramAgent] 파일 다운로드 예외: {e}")
            return False

    async def _handle_audio_message(self, client: httpx.AsyncClient, chat_id: int, audio_obj: dict):
        """스마트폰 통화 녹음 파일 및 음성 메시지 수신/STT/AI분석/ERP실행 파이프라인"""
        send_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        file_id = audio_obj.get("file_id")
        file_name = audio_obj.get("file_name") or f"audio_{int(time.time())}.m4a"
        file_ext = os.path.splitext(file_name)[1].lower() or ".m4a"

        # 1. 안내 메시지 발송
        await client.post(send_url, json={
            "chat_id": chat_id,
            "text": "🎙️ [음성 수신] 스마트폰 통화 녹음 파일을 수신했습니다.\n사내 보안 GPU(RTX 5080) 기반 초고속 음성 인식을 진행합니다..."
        })

        # 2. 임시 파일 다운로드
        temp_dir = os.path.join(os.path.dirname(__file__), "temp_audio")
        os.makedirs(temp_dir, exist_ok=True)
        temp_file_path = os.path.join(temp_dir, f"{file_id[:16]}_{int(time.time())}{file_ext}")

        try:
            download_ok = await self._download_telegram_file(client, file_id, temp_file_path)
            if not download_ok:
                await client.post(send_url, json={"chat_id": chat_id, "text": "❌ 음성 파일 다운로드에 실패했습니다."})
                return

            # 3. Faster-Whisper GPU STT 실행
            loop = asyncio.get_running_loop()
            transcript = await loop.run_in_executor(None, stt_engine.transcribe, temp_file_path)

            if not transcript or not transcript.strip():
                await client.post(send_url, json={"chat_id": chat_id, "text": "⚠️ 음성이 감지되지 않았거나 무음 구간입니다."})
                return

            # 4. 녹취 전문 전송
            await client.post(send_url, json={
                "chat_id": chat_id,
                "text": f"📝 [통화 녹취 전문]\n\"{transcript}\"\n\n🧠 AI 비즈니스 분석 및 ERP 작업 추출 중..."
            })

            # 5. AI 비즈니스 분석
            analysis = await ai_brain.analyze_call_transcript(transcript)
            summary = analysis.get("summary", "통화 분석 완료")
            wf = analysis.get("workflow", "GENERAL_INQUIRY")
            params = analysis.get("params", {})

            if wf == "GENERAL_INQUIRY":
                await client.post(send_url, json={
                    "chat_id": chat_id,
                    "text": f"ℹ️ [통화 요약]\n{summary}\n\n※ 특정 ERP 업무 지시가 감지되지 않아 자동 집행을 건너뜁니다."
                })
                return

            # 6. 업무 지시문 합성 및 FSM 실행
            if wf == "DISPATCH_REQUEST":
                customer = params.get("customer", "")
                site = params.get("site", "")
                model = params.get("model", "GS-1930")
                qty = params.get("quantity", 1)
                dtime = params.get("delivery_time", "익일 오전")
                memo = params.get("memo", f"[통화녹취] {transcript[:40]}")
                exec_prompt = f"{customer} {site} {model} {qty}대 출고요청 {dtime} {memo}".strip()
            elif wf in ["CONTRACT_EXTEND", "CONTRACT_SHORTEN"]:
                customer = params.get("customer", "")
                site = params.get("site", "")
                months = params.get("duration_months", 0)
                t_date = params.get("target_date")
                act_word = "연장" if wf == "CONTRACT_EXTEND" else "단축"
                date_part = f"{months}개월 {act_word}" if months else (f"{t_date}까지 {act_word}" if t_date else f"계약 {act_word}")
                exec_prompt = f"{customer} {site} {date_part}".strip()
            elif wf == "DISPATCH_ASSIGN":
                customer = params.get("customer", "")
                site = params.get("site", "")
                driver = params.get("driver_name", "기사")
                vtype = params.get("vehicle_type", "5T")
                cost = params.get("cost", 150000)
                exec_prompt = f"{customer} {site} {driver} {vtype} {cost}원 배정".strip()
            else:
                exec_prompt = transcript

            await client.post(send_url, json={
                "chat_id": chat_id,
                "text": f"📋 [업무 요약]: {summary}\n🚀 [ERP 자동 실행]: '{exec_prompt}'"
            })

            # FSM 에이전트 작업 큐(FIFO Queue)에 등록하여 순차 집행
            await self.enqueue_job(client, chat_id, exec_prompt, source="VOICE_CALL_RECORD")

        except Exception as e:
            print(f"❌ [TelegramAgent] 음성 처리 중 예외: {e}")
            await client.post(send_url, json={"chat_id": chat_id, "text": f"❌ 음성 처리 오류: {str(e)}"})
        finally:
            if os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception:
                    pass

    async def _handle_callback_query(self, client: httpx.AsyncClient, query: dict):
        """인라인 버튼 클릭(콜백 쿼리) 상호작용 처리기"""
        query_id = query.get("id")
        data = query.get("data", "")
        message = query.get("message", {})
        chat_id = message.get("chat", {}).get("id")
        from_user = query.get("from", {})
        sender_id = str(from_user.get("id"))
        first_name = from_user.get("first_name", "")
        user_prof = self._get_user_profile(sender_id, first_name)
        callsign = user_prof["callsign"]
        bot_name = user_prof["bot_name"]

        # 1. 텔레그램 로딩 인디케이터 해제
        try:
            ack_url = f"https://api.telegram.org/bot{self.bot_token}/answerCallbackQuery"
            await client.post(ack_url, json={"callback_query_id": query_id})
        except Exception:
            pass

        send_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"

        # 2. 버튼별 상호작용 분기
        if data == "BTN_MAIN_MENU":
            msg = (
                f"🤖 {callsign}, eBro 업무 비서 {bot_name}입니다.\n\n"
                "어떤 업무를 처리할까요? 아래 버튼을 터치하시거나 직접 음성 또는 텍스트로 편하게 말씀해 주세요."
            )
            await client.post(send_url, json={
                "chat_id": chat_id,
                "text": msg,
                "reply_markup": self._get_main_menu_markup()
            })

        elif data == "BTN_DISPATCH_REQ":
            guide_msg = (
                "📋 [1. 출고 요청 안내]\n\n"
                "현장명, 요구 기종, 수량, 납기일시를 음성 또는 텍스트로 말씀해 주세요.\n\n"
                "💡 발화 예시:\n"
                "• '에이치 1공구 1930 2대 내일 아침 출고요청'\n"
                "• '판교 힐스테이트 GS-3246 1대 10월 5일 착불로 보내줘'\n\n"
                "※ 단문으로 쪼개서 ('에이치 1공구', '1930 2대') 보내셔도 하나로 결합 처리됩니다."
            )
            await client.post(send_url, json={"chat_id": chat_id, "text": guide_msg})

        elif data == "BTN_DISPATCH_ASSIGN":
            guide_msg = (
                "🚛 [2. 배차 정보 입력 안내]\n\n"
                "현장명, 기사명, 차종, 운송비를 음성 또는 텍스트로 말씀해 주세요.\n\n"
                "💡 발화 예시:\n"
                "• '에이치 1공구 김기사 5톤 15만원 배정'\n"
                "• '송도 3공구 이진수기사 16만원 배차 완료'"
            )
            await client.post(send_url, json={"chat_id": chat_id, "text": guide_msg})

        elif data == "BTN_MAIL_MENU":
            mail_msg = (
                "✉️ [3. 공식 이메일 발송]\n\n"
                "고객사/현장에 어떤 서식 문서를 발송할까요? 아래 서식을 선택해 주세요."
            )
            await client.post(send_url, json={
                "chat_id": chat_id,
                "text": mail_msg,
                "reply_markup": self._get_mail_sub_markup()
            })

        elif data == "BTN_CONTRACT_MENU":
            guide_msg = (
                "📄 [4. 계약 연장 / 단축 안내]\n\n"
                "고객사명, 현장명, 변경할 개월수 또는 날짜를 말씀해 주세요.\n\n"
                "💡 발화 예시:\n"
                "• '에이치엔아이씨 1공구 계약 6개월 연장해줘'\n"
                "• '동탄 물류센터 현장 1개월 단축해줘'"
            )
            await client.post(send_url, json={"chat_id": chat_id, "text": guide_msg})

        elif data == "BTN_MAIL_PROFILE":
            guide_msg = (
                "🏢 [회사소개서 공식 발송]\n\n"
                "수신할 거래처 또는 담당자를 말씀해 주세요.\n\n"
                "💡 발화 예시:\n"
                "• '에이치엔아이씨 김소장에게 회사소개서 보내줘'\n"
                "• '현대건설에 공식 회사소개서 이메일 발송해'"
            )
            await client.post(send_url, json={"chat_id": chat_id, "text": guide_msg})

        elif data == "BTN_MAIL_QUOTE":
            guide_msg = (
                "📊 [장비 견적서 공식 발송]\n\n"
                "거래처, 담당자, 장비 기종 및 수량을 말씀해 주세요.\n\n"
                "💡 발화 예시:\n"
                "• '현대건설 박과장에게 1930 2대 견적서 보내줘'\n"
                "• '에이치 1공구 3246 1대 견적서 발송'"
            )
            await client.post(send_url, json={"chat_id": chat_id, "text": guide_msg})

        elif data == "BTN_MAIL_SPEC":
            guide_msg = (
                "📖 [장비 제원표 / 카탈로그 발송]\n\n"
                "거래처와 장비 기종을 말씀해 주세요.\n\n"
                "💡 발화 예시:\n"
                "• '판교 2공구에 GS-3246 제원표 카탈로그 보내줘'\n"
                "• '에이치 김부장에게 1930 제원표 보내줘'"
            )
            await client.post(send_url, json={"chat_id": chat_id, "text": guide_msg})

        elif data == "BTN_MAIL_CONTRACT":
            guide_msg = (
                "📑 [표준 계약 서식 세트 발송]\n\n"
                "수신할 거래처명을 말씀해 주세요.\n\n"
                "💡 발화 예시:\n"
                "• '에이치엔아이씨 계약서식 세트 보내줘'\n"
                "• '대우건설 판교현장에 임대계약서 양식 보내줘'"
            )
            await client.post(send_url, json={"chat_id": chat_id, "text": guide_msg})

        elif data.startswith("SUB_EXT_BACK_"):
            cust_name = data.replace("SUB_EXT_BACK_", "")
            msg = f"🏢 '{cust_name}' 거래처 업무 메뉴입니다. 아래 버튼을 터치해 주세요."
            await client.post(send_url, json={
                "chat_id": chat_id,
                "text": msg,
                "reply_markup": self._get_customer_next_actions_markup(cust_name)
            })

        elif data.startswith("SUB_EXT_"):
            cust_name = data.replace("SUB_EXT_", "")
            msg = f"⏱️ [계약 연장 기간 선택]\n'{cust_name}' 거래처의 변경 기간을 선택해 주세요."
            await client.post(send_url, json={
                "chat_id": chat_id,
                "text": msg,
                "reply_markup": self._get_extend_duration_markup(cust_name)
            })

        elif data.startswith("SUB_DISP_"):
            cust_name = data.replace("SUB_DISP_", "")
            msg = f"🚛 [출고 배차 모델 선택]\n'{cust_name}' 현장에 출고할 기종을 선택해 주세요."
            await client.post(send_url, json={
                "chat_id": chat_id,
                "text": msg,
                "reply_markup": self._get_dispatch_model_markup(cust_name)
            })

        elif data.startswith("SUB_MAIL_"):
            cust_name = data.replace("SUB_MAIL_", "")
            msg = f"✉️ [공식 이메일 발송]\n'{cust_name}' 거래처에 발송할 서식을 선택해 주세요."
            await client.post(send_url, json={
                "chat_id": chat_id,
                "text": msg,
                "reply_markup": self._get_mail_sub_markup()
            })

        elif data.startswith("ACT_DO_EXT_"):
            # 예: ACT_DO_EXT_에이치아이엔씨_6m
            parts = data.replace("ACT_DO_EXT_", "").split("_")
            cust_name = parts[0]
            dur = parts[1] if len(parts) > 1 else "6m"
            dur_map = {
                "1m": "1개월 연장",
                "3m": "3개월 연장",
                "6m": "6개월 연장",
                "12m": "1년 연장",
                "open": "종료일 미정 연장"
            }
            dur_text = dur_map.get(dur, "6개월 연장")
            saved_site = self.conversation_slots.get(chat_id, {}).get("site", "")
            cmd_prompt = f"{cust_name} {saved_site} {dur_text}".strip()
            await self.enqueue_job(client, chat_id, cmd_prompt, source="TELEGRAM_BUTTON")

        elif data.startswith("ACT_DO_DISP_"):
            # 예: ACT_DO_DISP_에이치아이엔씨_1930_2
            parts = data.replace("ACT_DO_DISP_", "").split("_")
            cust_name = parts[0]
            model = parts[1] if len(parts) > 1 else "GS-1930"
            qty = parts[2] if len(parts) > 2 else "1"
            saved_site = self.conversation_slots.get(chat_id, {}).get("site", "")
            cmd_prompt = f"{cust_name} {saved_site} {model} {qty}대 출고요청 익일 오전".strip()
            await self.enqueue_job(client, chat_id, cmd_prompt, source="TELEGRAM_BUTTON")

        elif data == "BTN_RESET":
            self.conversation_slots.pop(chat_id, None)
            self.message_buffers.pop(chat_id, None)
            await client.post(send_url, json={
                "chat_id": chat_id,
                "text": "🔄 대화 세션 및 입력 버퍼가 초기화되었습니다.\n다시 편하게 말씀해 주시거나 '자비스'를 불러주세요."
            })

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
