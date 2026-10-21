import React, { useState, useMemo } from 'react';
import { AlertTriangle, Copy, Check, X, ShieldOff, Database, Loader, Info, ShieldAlert } from 'lucide-react';
import { supabase } from '../services/db';

export type ModalPurpose = 'system' | 'business';

export interface ErrorModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  type?: ModalPurpose;
  onClose: () => void;
}

/** 지능형 에러 모달 목적 자동 판별 엔진 */
export function detectModalPurpose(
  message: string, 
  title?: string, 
  explicitType?: ModalPurpose
): ModalPurpose {
  // 1. 명시적 지정이 있는 경우 최우선 적용
  if (explicitType === 'system') return 'system';
  if (explicitType === 'business') return 'business';

  const rawMessage = (message || '').trim();
  const rawTitle = (title || '').trim();
  const combined = `${rawTitle}\n${rawMessage}`.toLowerCase();

  // 2. 명백한 시스템 / JS 런타임 / DB / 네트워크 기술적 예외
  const isSystemError = 
    // JS/TS 런타임 에러
    combined.includes('stack') ||
    combined.includes('typeerror') ||
    combined.includes('syntaxerror') ||
    combined.includes('referenceerror') ||
    combined.includes('rangeerror') ||
    combined.includes('cannot read properties of') ||
    combined.includes('undefined is not') ||
    combined.includes('nullpointer') ||
    combined.includes('json.parse') ||
    combined.includes('uncaught exception') ||
    /at\s+[\w\d_.<>]+\s+\(/i.test(rawMessage) ||
    /line\s+\d+:\d+/i.test(rawMessage) ||
    // DB 및 원격 Supabase/SQL 에러
    combined.includes('pgrst') ||
    combined.includes('postgrest') ||
    combined.includes('row-level security') ||
    combined.includes('42501') ||
    combined.includes('relation "') ||
    combined.includes('column "') ||
    combined.includes('violates foreign key') ||
    combined.includes('violates check constraint') ||
    combined.includes('violates unique constraint') ||
    combined.includes('sqlstate') ||
    combined.includes('syntax error at or near') ||
    // 통신 장애
    combined.includes('failed to fetch') ||
    combined.includes('networkerror') ||
    combined.includes('원격 supabase db 통신 장애') ||
    combined.includes('원격 db 통신 장애');

  if (isSystemError) return 'system';

  // 3. 비즈니스 업무 안내 및 제약 펜딩 지표
  const isBusinessGuidance = 
    combined.includes('불가') ||
    combined.includes('할 수 없습니다') ||
    combined.includes('수 없습니다') ||
    combined.includes('존재합니다') ||
    combined.includes('존재하지 않습니다') ||
    combined.includes('찾을 수 없습니다') ||
    combined.includes('선결') ||
    combined.includes('선행') ||
    combined.includes('입력') ||
    combined.includes('선택') ||
    combined.includes('확인') ||
    combined.includes('지정') ||
    combined.includes('요청') ||
    combined.includes('필수') ||
    combined.includes('미입력') ||
    combined.includes('미등록') ||
    combined.includes('미완료') ||
    combined.includes('부족') ||
    combined.includes('초과') ||
    combined.includes('중복') ||
    combined.includes('권한') ||
    combined.includes('차단') ||
    combined.includes('제한') ||
    combined.includes('종료') ||
    combined.includes('계약') ||
    combined.includes('장비') ||
    combined.includes('현장');

  if (isBusinessGuidance) return 'business';

  // 4. 기본값: 기술적 영문 에러/스택이 없는 한, 사용자를 놀라게 하지 않도록 '업무 처리 안내'로 처리
  return 'business';
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
  
  if (text.includes('deliveries_status_check') || text.includes('deliveries_reconciliationStatus_check') || text.includes('deliveries_dispatchCategory_check') || (text.includes('deliveries') && text.includes('check constraint'))) {
    const deliveryCheckDdl = [
      `ALTER TABLE "deliveries" DROP CONSTRAINT IF EXISTS "deliveries_status_check";`,
      `ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_status_check" CHECK (status IN ('PENDING', 'REQUESTED', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED'));`,
      `ALTER TABLE "deliveries" DROP CONSTRAINT IF EXISTS "deliveries_reconciliationStatus_check";`,
      `ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_reconciliationStatus_check" CHECK ("reconciliationStatus" IN ('PENDING', 'MATCHED', 'MISMATCH', 'RECONCILED', 'PAYMENT_REQUESTED', 'PAID', 'SETTLED', 'UNRECONCILED', 'NONE'));`,
      `ALTER TABLE "deliveries" DROP CONSTRAINT IF EXISTS "deliveries_dispatchCategory_check";`,
      `ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_dispatchCategory_check" CHECK ("dispatchCategory" IN ('출고', '입고', '반납', '정비', '이동', '교환'));`,
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

  const pattern1 = /row-level security policy(?:\s+for\s+table\s+["']?(\w+)["']?)?/gi;
  let m: RegExpExecArray | null;
  while ((m = pattern1.exec(message)) !== null) {
    if (m[1]) tables.add(m[1]);
  }

  const pattern2 = /\[(?:테이블|시트\/테이블|table):\s*(\w+)\]/gi;
  while ((m = pattern2.exec(message)) !== null) {
    tables.add(m[1]);
  }

  const pattern3 = /policy for table "(\w+)"/gi;
  while ((m = pattern3.exec(message)) !== null) {
    tables.add(m[1]);
  }

  return Array.from(tables);
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  title,
  message,
  type,
  onClose
}) => {
  const [copied, setCopied] = useState(false);
  const [ddlCopied, setDdlCopied] = useState(false);
  const [executingPatch, setExecutingPatch] = useState(false);
  const [patchExecuted, setPatchExecuted] = useState(false);
  const [patchResultMsg, setPatchResultMsg] = useState('');

  // 💡 모달 목적 자동 판별: 코드상 에러 vs 업무 안내/선결 처리 부재
  const effectivePurpose: ModalPurpose = useMemo(() => {
    return detectModalPurpose(message, title, type);
  }, [message, title, type]);

  const isSystemError = effectivePurpose === 'system';

  const defaultTitle = isSystemError ? '시스템 오류 (개발팀 제보 대상)' : '업무 처리 안내';
  const effectiveTitle = (title && title !== '시스템 오류 발생') ? title : defaultTitle;

  const isRlsError = useMemo(() =>
    isSystemError && (message.includes('row-level security') || message.includes('42501')),
    [isSystemError, message]
  );

  const isNetworkError = useMemo(() =>
    isSystemError && (message.includes('Failed to fetch') || message.includes('NetworkError') || message.includes('원격 Supabase DB 통신 장애')),
    [isSystemError, message]
  );

  const rlsTables = useMemo(() => isSystemError ? extractRlsTableNames(message) : [], [isSystemError, message]);

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

  const ddlStatements = useMemo(() => isSystemError ? extractDdlStatements(message, ddlPatch) : [], [isSystemError, message, ddlPatch]);

  const handleExecutePatch = async () => {
    if (ddlStatements.length === 0) return;
    setExecutingPatch(true);
    setPatchResultMsg('');

    try {
      if (!supabase) {
        setPatchResultMsg('⚠️ Supabase 데이터베이스 연결이 설정되지 않았습니다.');
        return;
      }

      const { error } = await supabase.rpc('dev_exec_ddl', { statements: ddlStatements });
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

  // ─────────────────────────────────────────────────────────────
  // 🏛️ [유형 1] 업무 진행 안내 / 제약 펜딩 모달 (건조하고 명확한 비즈니스 가이드)
  // ─────────────────────────────────────────────────────────────
  if (!isSystemError) {
    return (
      <div 
        data-uia="business-notice-overlay"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '20px'
        }}
      >
        <div
          data-uia="business-notice-modal"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 12px 28px -6px rgba(0, 0, 0, 0.18)',
            overflow: 'hidden',
            color: 'var(--text-main)',
            animation: 'fadeIn 0.15s ease-out',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* 상단 슬림 악센트 바 */}
          <div style={{ height: '3px', background: 'var(--primary)' }} />

          {/* 모달 헤더 (단정하고 건조한 블루 톤) */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-header)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={18} color="var(--primary)" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
                {effectiveTitle}
              </h3>
            </div>
            <button
              data-uia="btn-close-notice-modal"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* 모달 본문 (핵심 사유 고대비 표시) */}
          <div style={{ padding: '18px' }}>
            <div style={{
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '16px 18px',
              fontSize: '13.5px',
              color: 'var(--text-main)',
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              wordBreak: 'keep-all',
              fontWeight: 500
            }}>
              {message}
            </div>
          </div>

          {/* 모달 푸터 (오류복사 버튼 배제, 단일 [확인] 완결 버튼만 우측 배치) */}
          <div style={{
            padding: '10px 18px 16px',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            backgroundColor: 'transparent'
          }}>
            <button
              type="button"
              className="btn-primary"
              data-uia="btn-confirm-notice-modal"
              onClick={onClose}
              style={{
                height: '34px',
                padding: '0 24px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '6px',
                cursor: 'pointer'
              }}
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 🚨 [유형 2] 시스템 / 코드상 에러 모달 (강렬한 경고 & 기술 디버깅 도메인)
  // ─────────────────────────────────────────────────────────────
  return (
    <div 
      data-uia="system-error-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px'
      }}
    >
      <div
        data-uia="system-error-modal"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1.5px solid #dc2626',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '560px',
          boxShadow: '0 20px 40px -8px rgba(220, 38, 38, 0.28)',
          overflow: 'hidden',
          color: 'var(--text-main)',
          animation: 'fadeIn 0.2s ease-out',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* 상단 강렬한 레드 악센트 바 */}
        <div style={{ height: '3px', background: '#dc2626' }} />

        {/* 모달 헤더 (강렬한 크림슨 레드 톤) */}
        <div style={{
          padding: '14px 18px',
          backgroundColor: 'rgba(220, 38, 38, 0.08)',
          borderBottom: '1px solid rgba(220, 38, 38, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              backgroundColor: '#dc2626',
              borderRadius: '6px',
              padding: '5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldAlert size={16} color="#ffffff" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#dc2626' }}>
                {effectiveTitle}
              </h3>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '4px',
                backgroundColor: '#dc2626',
                color: '#ffffff'
              }}>
                개발팀 제보 대상
              </span>
            </div>
          </div>
          <button
            data-uia="btn-close-error-modal"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 모달 본문 (기술 디버깅 및 에러 스택 박스) */}
        <div style={{ padding: '18px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-main)', margin: '0 0 10px', lineHeight: 1.5, fontWeight: 600 }}>
            시스템 내부 예외 또는 데이터베이스 오류가 감지되었습니다. 아래 <b>[오류 내용 복사]</b> 버튼을 눌러 원인을 개발팀에 제보해 주십시오:
          </p>
          
          {/* 오류 텍스트 박스 (모노스페이스 다크 터미널 콘솔) */}
          <div style={{
            borderRadius: '8px',
            overflow: 'hidden',
            border: '1px solid #334155',
            backgroundColor: '#0b0f19'
          }}>
            {/* 터미널 상단 타이틀바 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 12px',
              backgroundColor: '#1e293b',
              borderBottom: '1px solid #334155'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#ef4444', display: 'inline-block' }} />
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8', marginLeft: '6px', fontWeight: 600 }}>
                  시스템 오류 상세 기록
                </span>
              </div>
              <span style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#ef4444', fontWeight: 700 }}>
                CRITICAL
              </span>
            </div>
            <textarea
              readOnly
              className="system-error-terminal"
              value={message}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              style={{
                width: '100%',
                minHeight: '130px',
                maxHeight: '240px',
                backgroundColor: '#0b0f19',
                color: '#f87171',
                border: 'none',
                padding: '12px 14px',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '12.5px',
                lineHeight: '1.55',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
                display: 'block'
              }}
            />
          </div>

          {/* RLS DDL 패치 섹션 (RLS 오류 감지 시에만 표시) */}
          {isRlsError && ddlPatch && (
            <div style={{
              marginTop: '12px',
              backgroundColor: 'rgba(234, 179, 8, 0.08)',
              border: '1px solid rgba(234, 179, 8, 0.35)',
              borderRadius: '8px',
              padding: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <ShieldOff size={15} color="#d97706" />
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#d97706' }}>
                  RLS 쓰기 차단 감지 — 복구 Policy DDL
                </span>
              </div>
              <textarea
                readOnly
                className="system-error-terminal"
                value={ddlPatch}
                onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                style={{
                  width: '100%',
                  minHeight: '65px',
                  backgroundColor: '#0c1426',
                  color: '#4ade80',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  borderRadius: '6px',
                  padding: '10px',
                  fontFamily: 'Consolas, Monaco, monospace',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleDdlCopy}
                  style={{
                    backgroundColor: ddlCopied ? '#059669' : '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  {ddlCopied ? <Check size={14} /> : <Copy size={14} />}
                  {ddlCopied ? '복사 완료' : 'RLS Policy DDL 복사'}
                </button>
              </div>
            </div>
          )}

          {/* DDL 패치 실행 결과 안내 배너 */}
          {patchResultMsg && (
            <div style={{
              marginTop: '10px',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'pre-wrap',
              backgroundColor: patchExecuted ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${patchExecuted ? '#22c55e' : '#ef4444'}`,
              color: patchExecuted ? '#047857' : '#dc2626'
            }}>
              {patchResultMsg}
            </div>
          )}
        </div>

        {/* 모달 푸터 / 액션 버튼 */}
        <div style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'nowrap'
        }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn-primary"
              data-uia="btn-copy-error-content"
              onClick={handleCopy}
              style={{
                height: '34px',
                padding: '0 16px',
                fontSize: '12.5px',
                fontWeight: 700,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? '복사 완료!' : '오류 내용 복사'}</span>
            </button>

            {ddlStatements.length > 0 && (
              <button
                type="button"
                className="btn-danger"
                onClick={handleExecutePatch}
                disabled={executingPatch || patchExecuted}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  cursor: (executingPatch || patchExecuted) ? 'default' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {executingPatch ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : (patchExecuted ? <Check size={14} /> : <Database size={14} />)}
                <span>{executingPatch ? '패치 중...' : (patchExecuted ? '패치 완료' : '1-Click 패치')}</span>
              </button>
            )}
          </div>
          
          <button
            type="button"
            className="btn-reset"
            data-uia="btn-close-error-modal-confirm"
            onClick={onClose}
            style={{
              height: '34px',
              padding: '0 18px',
              fontSize: '12.5px',
              fontWeight: 600,
              borderRadius: '6px'
            }}
          >
            확인 및 닫기
          </button>
        </div>
      </div>
    </div>
  );
};
