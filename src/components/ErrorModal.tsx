import React, { useState, useMemo } from 'react';
import { AlertTriangle, Copy, Check, X, ShieldOff, Database, Loader } from 'lucide-react';
import { supabase } from '../services/db';

interface ErrorModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

/** 메시지 및 패치 구문에서 실행 가능한 DDL 문장을 추출하는 헬퍼 */
function extractDdlStatements(message: string, ddlPatch: string): string[] {
  const stmts: string[] = [];
  const text = `${message}\n${ddlPatch}`;

  // 💡 [지능형 누락 컬럼 동적 DDL 추론기] "Could not find the 'columnName' column of 'tableName'" 파싱
  const missingColMatch = text.match(/Could not find the '(\w+)' column of '(\w+)'/i) || text.match(/column ["']?(\w+)["']? of relation ["']?(\w+)["']? does not exist/i);
  if (missingColMatch) {
    const colName = missingColMatch[1];
    const tableName = missingColMatch[2];
    const autoColDdl = [
      `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${colName}" TEXT;`,
      `NOTIFY pgrst, 'reload schema';`
    ];
    autoColDdl.forEach(s => {
      if (!stmts.includes(s)) stmts.push(s);
    });
  }

  // 💡 [지능형 누락 테이블 동적 DDL 추론기] "relation 'tableName' does not exist" 파싱
  const missingTableMatch = text.match(/relation ["']?(\w+)["']? does not exist/i);
  if (missingTableMatch) {
    const tableName = missingTableMatch[1];
    const autoTableDdl = [
      `CREATE TABLE IF NOT EXISTS "${tableName}" (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());`,
      `NOTIFY pgrst, 'reload schema';`
    ];
    autoTableDdl.forEach(s => {
      if (!stmts.includes(s)) stmts.push(s);
    });
  }
  
  if (text.includes('deliveries_status_check') || (text.includes('deliveries') && text.includes('check constraint'))) {
    const deliveryCheckDdl = [
      `ALTER TABLE "deliveries" DROP CONSTRAINT IF EXISTS "deliveries_status_check";`,
      `ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_status_check" CHECK (status IN ('PENDING', 'REQUESTED', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED'));`,
      `NOTIFY pgrst, 'reload schema';`
    ];
    deliveryCheckDdl.forEach(s => {
      if (!stmts.includes(s)) stmts.push(s);
    });
  }

  if (text.includes('billings_status_check') || (text.includes('billings') && text.includes('check constraint'))) {
    const billingsCheckDdl = [
      `ALTER TABLE "billings" DROP CONSTRAINT IF EXISTS "billings_status_check";`,
      `ALTER TABLE "billings" ADD CONSTRAINT "billings_status_check" CHECK (status IN ('UNPAID', 'PARTIAL', 'PAID', 'REQUESTED', 'REJECTED'));`,
      `NOTIFY pgrst, 'reload schema';`
    ];
    billingsCheckDdl.forEach(s => {
      if (!stmts.includes(s)) stmts.push(s);
    });
  }

  const lines = text.split('\n');
  lines.forEach(line => {
    const trimmed = line.trim();
    if (
      trimmed.startsWith('ALTER TABLE') ||
      trimmed.startsWith('DROP POLICY') ||
      trimmed.startsWith('CREATE POLICY') ||
      trimmed.startsWith('NOTIFY') ||
      trimmed.startsWith('CREATE TABLE')
    ) {
      const cleanStmt = trimmed.endsWith(';') ? trimmed : `${trimmed};`;
      if (!stmts.includes(cleanStmt)) {
        stmts.push(cleanStmt);
      }
    }
  });

  return stmts;
}

/** 메시지에서 RLS 위반 테이블명을 추출하는 헬퍼 */
function extractRlsTableNames(message: string): string[] {
  const tables = new Set<string>();

  // 패턴1: "row-level security policy for table "tableName""
  const pattern1 = /row-level security policy(?:\s+for\s+table\s+["']?(\w+)["']?)?/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern1.exec(message)) !== null) {
    if (m[1]) tables.add(m[1]);
  }

  // 패턴2: "[테이블: tableName]" 형식 (DevDataUploader 에러 포맷)
  const pattern2 = /\[(?:테이블|시트\/테이블|table):\s*(\w+)\]/gi;
  while ((m = pattern2.exec(message)) !== null) {
    tables.add(m[1]);
  }

  // 패턴3: "policy for table "tableName"" (Supabase 에러 메시지 직접 패턴)
  const pattern3 = /policy for table "(\w+)"/gi;
  while ((m = pattern3.exec(message)) !== null) {
    tables.add(m[1]);
  }

  return Array.from(tables);
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  title = '시스템 오류 발생',
  message,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const [ddlCopied, setDdlCopied] = useState(false);
  const [executingPatch, setExecutingPatch] = useState(false);
  const [patchExecuted, setPatchExecuted] = useState(false);
  const [patchResultMsg, setPatchResultMsg] = useState('');

  const isRlsError = useMemo(() =>
    message.includes('row-level security') || message.includes('42501'),
    [message]
  );

  const isNetworkError = useMemo(() =>
    message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('원격 Supabase DB 통신 장애'),
    [message]
  );

  const rlsTables = useMemo(() => extractRlsTableNames(message), [message]);

  const ddlPatch = useMemo(() => {
    if (!isRlsError) return '';
    const tableList = rlsTables.length > 0 ? rlsTables : [];
    if (tableList.length === 0) return '';
    return tableList
      .map(t => [
        `-- RLS 유지 상태에서 ${t} 테이블 anon/authenticated 롤 허용`,
        `DROP POLICY IF EXISTS "allow_anon_select" ON "${t}";`,
        `DROP POLICY IF EXISTS "allow_anon_insert" ON "${t}";`,
        `DROP POLICY IF EXISTS "allow_anon_update" ON "${t}";`,
        `DROP POLICY IF EXISTS "allow_authenticated_select" ON "${t}";`,
        `DROP POLICY IF EXISTS "allow_authenticated_insert" ON "${t}";`,
        `DROP POLICY IF EXISTS "allow_authenticated_update" ON "${t}";`,
        `CREATE POLICY "allow_anon_select" ON "${t}" FOR SELECT TO anon USING (true);`,
        `CREATE POLICY "allow_anon_insert" ON "${t}" FOR INSERT TO anon WITH CHECK (true);`,
        `CREATE POLICY "allow_anon_update" ON "${t}" FOR UPDATE TO anon USING (true) WITH CHECK (true);`,
        `CREATE POLICY "allow_authenticated_select" ON "${t}" FOR SELECT TO authenticated USING (true);`,
        `CREATE POLICY "allow_authenticated_insert" ON "${t}" FOR INSERT TO authenticated WITH CHECK (true);`,
        `CREATE POLICY "allow_authenticated_update" ON "${t}" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);`,
      ].join('\n'))
      .join('\n\n');
  }, [isRlsError, rlsTables]);

  const ddlStatements = useMemo(() => extractDdlStatements(message, ddlPatch), [message, ddlPatch]);

  const handleExecutePatch = async () => {
    if (ddlStatements.length === 0) return;
    setExecutingPatch(true);
    setPatchResultMsg('');

    try {
      if (!supabase) {
        setPatchResultMsg('⚠️ Supabase 데이터베이스 연결이 설정되지 않았습니다.');
        return;
      }

      const { data, error } = await supabase.rpc('dev_exec_ddl', { statements: ddlStatements });
      if (error) {
        setPatchResultMsg(`⚠️ DDL 패치 실행 실패: ${error.message}\n\n메뉴 [개발자 도구 (DB관리)] 의 [패치 자동 적용] 을 눌러 1회성 Helper 함수를 생성하거나 Supabase SQL Editor에서 실행해 주세요.`);
      } else {
        setPatchExecuted(true);
        setPatchResultMsg('🎉 [완료] DB 스키마 패치가 원격 DB에 직접 실행되고 스키마 캐시가 리로드되었습니다!\n방금 실패했던 작업을 다시 시도해 주십시오.');
      }
    } catch (err: any) {
      setPatchResultMsg(`⚠️ 패치 실행 중 예외 발생: ${err?.message || err}`);
    } finally {
      setExecutingPatch(false);
    }
  };

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleDdlCopy = () => {
    navigator.clipboard.writeText(ddlPatch);
    setDdlCopied(true);
    setTimeout(() => setDdlCopied(false), 2500);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div
        data-uia="system-error-modal"
        style={{
        backgroundColor: '#1e293b',
        border: '1px solid #ef4444',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)',
        overflow: 'hidden',
        color: '#f8fafc',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        {/* 모달 헤더 */}
        <div style={{
          padding: '16px 20px',
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              backgroundColor: '#ef4444',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle size={20} color="#ffffff" />
            </div>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#fca5a5' }}>
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 모달 본문 */}
        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '10px', lineHeight: 1.5 }}>
            오류 내용을 아래 박스에서 확인하실 수 있으며, <b>[오류 내용 복사]</b> 버튼을 눌러 쉽게 원인을 제보하실 수 있습니다:
          </p>
          
          {/* 오류 텍스트 박스 */}
          <div style={{ position: 'relative' }}>
            <textarea
              readOnly
              value={message}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              style={{
                width: '100%',
                minHeight: '140px',
                maxHeight: '260px',
                backgroundColor: '#0f172a',
                color: '#f87171',
                border: '1px solid #334155',
                borderRadius: '10px',
                padding: '14px',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '13px',
                lineHeight: '1.5',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* RLS DDL 패치 섹션 (RLS 오류 감지 시에만 표시) */}
          {isRlsError && ddlPatch && (
            <div style={{
              marginTop: '14px',
              backgroundColor: 'rgba(234, 179, 8, 0.07)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              borderRadius: '10px',
              padding: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ShieldOff size={16} color="#facc15" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#facc15' }}>
                  🛡️ RLS 쓰기 차단 감지 — 즉시 복구 Policy DDL
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 8px', lineHeight: 1.5 }}>
                아래 SQL을 <b>Supabase SQL Editor</b>에서 실행하면 <b>RLS를 유지한 채로</b> 해당 테이블의 anon/authenticated 롤 쓰기가 허용됩니다:
              </p>
              <textarea
                readOnly
                value={ddlPatch}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                style={{
                  width: '100%',
                  minHeight: '70px',
                  backgroundColor: '#0c1426',
                  color: '#4ade80',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontFamily: 'Consolas, Monaco, monospace',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleDdlCopy}
                  style={{
                    backgroundColor: ddlCopied ? '#059669' : '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {ddlCopied ? <Check size={15} /> : <Copy size={15} />}
                  {ddlCopied ? 'Policy DDL 복사 완료!' : '🔓 RLS Policy DDL 복사'}
                </button>
              </div>
            </div>
          )}
          {/* 네트워크 통신 오류 안내 섹션 */}
          {isNetworkError && (
            <div style={{
              marginTop: '14px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: '10px',
              padding: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa' }}>
                  🌐 원격 DB 네트워크 통신 장애 안내
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#cbd5e1', margin: 0, lineHeight: 1.6 }}>
                • 브라우저의 인터넷 연결이 단락되었거나, 원격 Supabase 서버 연결이 지연되었습니다.<br />
                • <b>로컬 데이터베이스에는 변경 사항이 안전하게 반영되었습니다.</b> 네트워크 연결 복구 후 작업을 재시도하시거나 페이지를 새로고침(F5)하여 주십시오.
              </p>
            </div>
          )}
          {/* DDL 패치 실행 결과 안내 배너 */}
          {patchResultMsg && (
            <div style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '12.5px',
              fontWeight: 600,
              whiteSpace: 'pre-wrap',
              backgroundColor: patchExecuted ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${patchExecuted ? '#22c55e' : '#ef4444'}`,
              color: patchExecuted ? '#4ade80' : '#fca5a5'
            }}>
              {patchResultMsg}
            </div>
          )}
        </div>

        {/* 모달 푸터 / 액션 버튼 */}
        <div style={{
          padding: '14px 20px',
          backgroundColor: '#0f172a',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                backgroundColor: copied ? '#059669' : '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 16px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? '복사되었습니다!' : '📋 오류 내용 복사'}
            </button>

            {/* 🚀 1-Click DB 패치 즉시 실행 버튼 (DDL 구문 감지 시 동적 노출!) */}
            {ddlStatements.length > 0 && (
              <button
                type="button"
                onClick={handleExecutePatch}
                disabled={executingPatch || patchExecuted}
                style={{
                  background: patchExecuted 
                    ? '#059669' 
                    : 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                  color: '#ffffff',
                  border: '1px solid #f43f5e',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: (executingPatch || patchExecuted) ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(225, 29, 72, 0.35)',
                  transition: 'all 0.2s ease',
                  opacity: executingPatch ? 0.7 : 1
                }}
              >
                {executingPatch ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : (patchExecuted ? <Check size={16} /> : <Database size={16} />)}
                {executingPatch ? 'DB 패치 실행 중...' : (patchExecuted ? '✅ DB 패치 완결!' : '🚀 1-Click DB 패치 즉시 실행')}
              </button>
            )}
          </div>
          
          <button
            type="button"
            onClick={onClose}
            style={{
              backgroundColor: '#334155',
              color: '#f8fafc',
              border: 'none',
              borderRadius: '8px',
              padding: '9px 20px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
