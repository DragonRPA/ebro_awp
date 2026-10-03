"""
ebro-agent-core/server.py
독립 데스크톱 PC 에이전트 메인 서버 (WebSocket 9001 & HTTP API)
"""

import asyncio
import json
import time
import uuid
import sys
import os

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass
from websockets.server import serve
from aiohttp import web
from dotenv import load_dotenv

load_dotenv()

from fsm_engine import FsmEngine
from safety_guard import safety_guard
from audit_logger import init_db
from telegram_bot import TelegramRemoteAgent
from ai_brain import ai_brain

WS_PORT = 9001
HTTP_PORT = 9002

class BrowserCommunicator:
    def __init__(self):
        self.active_extension_ws = None
        self.pending_tool_calls = {} # callId -> asyncio.Future

    def set_extension_ws(self, ws):
        self.active_extension_ws = ws
        print(f"🟢 [BrowserCommunicator] 브라우저 확장 프로그램(ebro-web-agent) 등록 완료")

    def remove_extension_ws(self, ws):
        if self.active_extension_ws == ws:
            self.active_extension_ws = None
            print(f"🔴 [BrowserCommunicator] 브라우저 확장 프로그램 연결 해제됨")

    async def execute_tool(self, tool_name: str, params: dict, timeout: float = 8.0) -> dict:
        # 브라우저 확장이 일시적으로 유휴 상태인 경우 최대 4초간 연결 대기 (핫 재연결 지원)
        if not self.active_extension_ws:
            print("⏳ [BrowserCommunicator] 브라우저 확장 프로그램 연결 대기 중...")
            for _ in range(20):
                await asyncio.sleep(0.2)
                if self.active_extension_ws:
                    print("🟢 [BrowserCommunicator] 브라우저 확장 연결 감지됨!")
                    break

        if not self.active_extension_ws:
            return {"success": False, "error": "브라우저 확장 프로그램이 연결되어 있지 않습니다. Chrome 브라우저 및 ebro web agent를 확인하십시오."}

        call_id = str(uuid.uuid4())[:8]
        fut = asyncio.get_event_loop().create_future()
        self.pending_tool_calls[call_id] = fut

        msg = {
            "type": "EXECUTE_TOOL",
            "callId": call_id,
            "tool": tool_name,
            "params": params,
            "timestamp": time.time()
        }

        try:
            await self.active_extension_ws.send(json.dumps(msg))
            result = await asyncio.wait_for(fut, timeout=timeout)
            return result
        except asyncio.TimeoutError:
            self.pending_tool_calls.pop(call_id, None)
            return {"success": False, "error": f"브라우저 도구 실행 타임아웃 ({timeout}s)"}
        except Exception as e:
            self.pending_tool_calls.pop(call_id, None)
            return {"success": False, "error": f"도구 실행 중 오류: {str(e)}"}

    def resolve_tool_result(self, call_id: str, result: dict):
        fut = self.pending_tool_calls.pop(call_id, None)
        if fut and not fut.done():
            fut.set_result(result)

browser_comm = BrowserCommunicator()
fsm = FsmEngine(browser_comm)
telegram_agent = TelegramRemoteAgent(fsm)

# WebSocket 메시지 핸들러
async def ws_handler(websocket):
    print(f"🔗 [WebSocket] 새 클라이언트 접속: {websocket.remote_address}")
    try:
        async for raw_msg in websocket:
            try:
                data = json.loads(raw_msg)
                msg_type = data.get("type")

                if msg_type == "REGISTER_EXTENSION":
                    browser_comm.set_extension_ws(websocket)
                    await websocket.send(json.dumps({
                        "type": "REGISTER_ACK",
                        "status": "ONLINE",
                        "version": "1.0.0"
                    }))

                elif msg_type == "TOOL_RESULT":
                    call_id = data.get("callId")
                    result = data.get("result", {})
                    browser_comm.resolve_tool_result(call_id, result)

                elif msg_type == "NATURAL_COMMAND":
                    prompt = data.get("prompt", "")
                    print(f"💬 [WebSocket] 자연어 명령 수신: '{prompt}'")
                    # 백그라운드에서 FSM 실행
                    exec_res = await fsm.execute_instruction(prompt, source="BROWSER_POPUP")
                    await websocket.send(json.dumps({
                        "type": "COMMAND_RESULT",
                        "prompt": prompt,
                        "result": exec_res
                    }))

                elif msg_type == "UPDATE_CONFIG":
                    token = str(data.get("telegram_bot_token", "")).strip()
                    user_id = str(data.get("telegram_allowed_user_id", "")).strip()
                    model = str(data.get("ai_model", "")).strip()
                    if model:
                        ai_brain.preferred_model = model
                    env_path = os.path.join(os.path.dirname(__file__), '.env')
                    with open(env_path, 'w', encoding='utf-8') as f:
                        f.write(f"TELEGRAM_BOT_TOKEN={token}\nTELEGRAM_ALLOWED_USER_ID={user_id}\n")
                    await telegram_agent.update_credentials(token, user_id)
                    await websocket.send(json.dumps({
                        "type": "CONFIG_UPDATED",
                        "telegram_running": telegram_agent.is_running,
                        "ai_model": ai_brain.preferred_model
                    }))

                elif msg_type == "PING":
                    await websocket.send(json.dumps({"type": "PONG"}))

            except json.JSONDecodeError:
                pass
            except Exception as e:
                print(f"⚠️ [WebSocket] 메시지 처리 오류: {e}")

    finally:
        browser_comm.remove_extension_ws(websocket)

# CORS 미들웨어 (브라우저 확장 직접 fetch 지원)
@web.middleware
async def cors_middleware(request, handler):
    if request.method == "OPTIONS":
        response = web.Response()
    else:
        response = await handler(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

# HTTP REST 핸들러 (포트 9002)
async def handle_status(request):
    return web.json_response({
        "agent": "ebro-agent-core",
        "status": "ONLINE",
        "version": "1.0.0",
        "browser_extension_connected": browser_comm.active_extension_ws is not None,
        "active_sessions": len(fsm.active_sessions),
        "telegram_running": telegram_agent.is_running,
        "ai_model": ai_brain.preferred_model
    })

async def handle_get_config(request):
    return web.json_response({
        "success": True,
        "telegram_bot_token": telegram_agent.bot_token or "",
        "telegram_allowed_user_id": telegram_agent.allowed_user_id or "",
        "telegram_running": telegram_agent.is_running,
        "ai_model": ai_brain.preferred_model
    })

async def handle_update_config(request):
    try:
        body = await request.json()
        token = str(body.get("telegram_bot_token", "")).strip()
        user_id = str(body.get("telegram_allowed_user_id", "")).strip()
        model = str(body.get("ai_model", "")).strip()

        if model:
            ai_brain.preferred_model = model

        # .env 파일 영구 보존
        env_path = os.path.join(os.path.dirname(__file__), '.env')
        env_lines = [
            f"TELEGRAM_BOT_TOKEN={token}",
            f"TELEGRAM_ALLOWED_USER_ID={user_id}"
        ]
        with open(env_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(env_lines) + "\n")

        # 텔레그램 봇 자격증명 실시간 핫 리로드
        await telegram_agent.update_credentials(token, user_id)

        return web.json_response({
            "success": True,
            "message": "환경설정 저장 및 텔레그램 봇 갱신 완료",
            "telegram_running": telegram_agent.is_running,
            "ai_model": ai_brain.preferred_model
        })
    except Exception as e:
        return web.json_response({"success": False, "error": str(e)}, status=500)

async def handle_telegram_test(request):
    try:
        res = await telegram_agent.send_test_message()
        return web.json_response(res)
    except Exception as e:
        return web.json_response({"success": False, "error": str(e)}, status=500)

async def handle_execute(request):
    try:
        body = await request.json()
        prompt = body.get("prompt", "")
        source = body.get("source", "HTTP_API")
        if not prompt:
            return web.json_response({"success": False, "error": "prompt 누락"}, status=400)

        res = await fsm.execute_instruction(prompt, source=source)
        return web.json_response(res)
    except Exception as e:
        return web.json_response({"success": False, "error": str(e)}, status=500)

async def main():
    init_db()
    print("=" * 60)
    print("🏢 [eBro ERP] 독립 PC 에이전트 코어 (ebro-agent-core)")
    print(f"🚀 WebSocket 서버 구동 중: ws://127.0.0.1:{WS_PORT}")
    print(f"🚀 HTTP API 서버 구동 중: http://127.0.0.1:{HTTP_PORT}")
    print("=" * 60)

    # 1. 텔레그램 봇 기동
    await telegram_agent.start()

    # 2. HTTP 서버 앱 설정
    app = web.Application(middlewares=[cors_middleware])
    app.router.add_get('/status', handle_status)
    app.router.add_get('/health', handle_status)
    app.router.add_get('/config', handle_get_config)
    app.router.add_post('/config', handle_update_config)
    app.router.add_post('/telegram/test', handle_telegram_test)
    app.router.add_post('/execute', handle_execute)
    runner = web.AppRunner(app)
    await runner.setup()
    http_site = web.TCPSite(runner, '127.0.0.1', HTTP_PORT)
    await http_site.start()

    # 3. WebSocket 서버 시작
    async with serve(ws_handler, "127.0.0.1", WS_PORT):
        await asyncio.Future() # 영구 대기

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 [ebro-agent-core] 종료되었습니다.")
