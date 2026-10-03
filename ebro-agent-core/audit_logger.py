"""
ebro-agent-core/audit_logger.py
전사 표준 헌장 카테고리 I(1.2) 및 V(5.2) 준수: 이벤트 감사 로그 무누락 DB 보존
"""

import sqlite3
import datetime
import os
import json

DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ebro_audit.db')

def init_db():
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS agent_audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            session_id TEXT NOT NULL,
            source TEXT NOT NULL, -- 'BROWSER_POPUP', 'TELEGRAM', 'CLI', 'API'
            user_prompt TEXT,
            fsm_state TEXT,
            tool_name TEXT,
            tool_params TEXT,
            tool_result TEXT,
            status TEXT NOT NULL, -- 'SUCCESS', 'WAIT_APPROVAL', 'REJECTED', 'FAILED'
            latency_ms REAL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def log_event(session_id: str, source: str, status: str, 
              user_prompt: str = None, fsm_state: str = None,
              tool_name: str = None, tool_params: dict = None, 
              tool_result: dict = None, latency_ms: float = 0.0):
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        now_iso = datetime.datetime.now().isoformat()
        cursor.execute('''
            INSERT INTO agent_audit_logs 
            (timestamp, session_id, source, user_prompt, fsm_state, tool_name, tool_params, tool_result, status, latency_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            now_iso,
            session_id,
            source,
            user_prompt,
            fsm_state,
            tool_name,
            json.dumps(tool_params, ensure_ascii=False) if tool_params else None,
            json.dumps(tool_result, ensure_ascii=False) if tool_result else None,
            status,
            latency_ms
        ))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"⚠️ [AuditLogger] DB 기록 실패: {e}")

# 초기화 실행
init_db()
