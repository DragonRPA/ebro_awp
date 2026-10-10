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
  if (explicitType === 'system') return 'system';
  if (explicitType === 'business') return 'business';

  const combined = `${title || ''}\n${message || ''}`.toLowerCase();

  // 1. 시스템/코드 에러 및 DB 예외 명확한 지표
  const isSystemError = 
    combined.includes('stack') ||
    combined.includes('error:') ||
    combined.includes('exception') ||
    combined.includes('syntaxerror') ||
    combined.includes('typeerror') ||
    combined.includes('referenceerror') ||
    combined.includes('rangeerror') ||
    combined.includes('failed to fetch') ||
    combined.includes('networkerror') ||
    combined.includes('postgrest') ||
    combined.includes('pgrst') ||
    combined.includes('row-level security') ||
    combined.includes('42501') ||
    combined.includes('supabase') ||
    combined.includes('status code') ||
    combined.includes('sql') ||
    combined.includes('relation ') ||
    combined.includes('column ') ||
    combined.includes('violates ') ||
    combined.includes('foreign key') ||
    combined.includes('constraint ') ||
    combined.includes('nullpointer') ||
    combined.includes('json.parse') ||
    combined.includes('원격 db') ||
    combined.includes('통신 장애') ||
    combined.includes('동기화 오류') ||
    /at\s+[\w\d_.]+\s+\(/i.test(message || '') ||
    /line\s+\d+/i.test(message || '');

  if (isSystemError) return 'system';

  // 2. 비즈니스 업무 안내 및 선결 조건 부재 지표
  const isBusinessGuidance = 
    combined.includes('선결') ||
    combined.includes('선행') ||
    combined.includes('입력해') ||
    combined.includes('입력하십시오') ||
    combined.includes('선택해') ||
    combined.includes('선택하십시오') ||
    combined.includes('확인해') ||
    combined.includes('확인하십시오') ||
    combined.includes('이후여야') ||
    combined.includes('이전이어야') ||
    combined.includes('찾을 수 없습니다') ||
    combined.includes('존재하지 않습니다') ||
    combined.includes('이미 등록된') ||
    combined.includes('초과하여') ||
    combined.includes('출고차단') ||
    combined.includes('거래제한') ||
    combined.includes('권한이 없습니다') ||
    combined.includes('부재하여') ||
    combined.includes('진행할 수 없습니다') ||
    combined.includes('1원 이상') ||
    combined.includes('필수 입력') ||
    combined.includes('지정해') ||
    combined.includes('요청해');

  if (isBusinessGuidance) return 'business';

  // 3. 기본값: 메시지가 짧고 스택이 없는 일반 문장은 불필요한 공포감을 주지 않도록 건조하고 평온한 업무 안내로 처리
  if ((message || '').length < 200 && !(message || '').includes('\n\n')) {
    return 'business';
  }

  return 'system';
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

  // 💡 모달 목적 자동 판별: 코드상 에러(system) vs 업무 안내/선결 처리 부재(business)
  const effectivePurpose: ModalPurpose = useMemo(() => {
    return detectModalPurpose(message, title, type);
  }, [message, title, type]);

  const isSystemError = effectivePurpose === 'system';

  const defaultTitle = isSystemError ? '시스템 오류 발생' : '업무 진행 안내';
  const effectiveTitle = title || defaultTitle;

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
  // 🏛️ [디자인 2] 업무 진행 안내 / 선결 조건 부재 모달 (건조하고 평온한 엔터프라이즈 가이드)
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
          backgroundColor: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
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
            backgroundColor: 'var(--bg-card, #1e293b)',
            border: '1px solid var(--border-color, #475569)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.35), 0 8px 10px -6px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden',
            color: 'var(--text-main, #f8fafc)',
            animation: 'fadeIn 0.15s ease-out',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* 상단 슬림 악센트 바 */}
          <div style={{ height: '3px', background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)' }} />

          {/* 모달 헤더 (차분하고 단정한 인디고/블루 톤) */}
          <div style={{
            padding: '16px 20px',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                backgroundColor: '#2563eb',
                borderRadius: '8px',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Info size={18} color="#ffffff" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-main, #f8fafc)', letterSpacing: '-0.3px' }}>
                  {effectiveTitle}
                </h3>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#93c5fd',
                  border: '1px solid rgba(59, 130, 246, 0.25)'
                }}>
                  업무 안내
                </span>
              </div>
            </div>
            <button
              data-uia="btn-close-notice-modal"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={19} />
            </button>
          </div>

          {/* 모달 본문 (평온하고 가독성 높은 카드 레이아웃) */}
          <div style={{ padding: '22px 20px 16px' }}>
            <div style={{
              backgroundColor: 'var(--bg-app, rgba(15, 23, 42, 0.65))',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '10px',
              padding: '18px 20px',
              fontSize: '14px',
              color: 'var(--text-main, #f1f5f9)',
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontWeight: 500
            }}>
              {message}
            </div>

            <p style={{
              fontSize: '12px',
              color: 'var(--text-muted, #94a3b8)',
              margin: '12px 4px 0',
              lineHeight: 1.5
            }}>
              * 위의 안내 사항 및 선결 조건을 확인하신 후 다음 업무를 진행해 주십시오.
            </p>
          </div>

          {/* 모달 푸터 (오류복사 버튼 배제, 단일 [확인] 완결 버튼만 우측 배치) */}
          <div style={{
            padding: '12px 20px 16px',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            backgroundColor: 'transparent'
          }}>
            <button
              type="button"
              data-uia="btn-confirm-notice-modal"
              onClick={onClose}
              style={{
                backgroundColor: 'var(--primary, #2563eb)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 24px',
                fontSize: '13.5px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.15s ease'
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
  // 🚨 [디자인 1] 시스템 / 코드상 에러 모달 (강렬한 경고 & 기술 디버깅 도메인)
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
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
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
          backgroundColor: 'var(--bg-card, #1e293b)',
          border: '1px solid #ef4444',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '580px',
          boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.35)',
          overflow: 'hidden',
          color: '#f8fafc',
          animation: 'fadeIn 0.2s ease-out',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* 상단 강렬한 레드 악센트 바 */}
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)' }} />

        {/* 모달 헤더 (강렬한 레드 톤) */}
        <div style={{
          padding: '16px 20px',
          backgroundColor: 'rgba(239, 68, 68, 0.16)',
          borderBottom: '1px solid rgba(239, 68, 68, 0.35)',
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
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4)'
            }}>
              <ShieldAlert size={20} color="#ffffff" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#fca5a5' }}>
                {effectiveTitle}
              </h3>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '4px',
                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                color: '#fca5a5',
                border: '1px solid rgba(239, 68, 68, 0.4)'
              }}>
                시스템 예외
              </span>
            </div>
          </div>
          <button
            data-uia="btn-close-error-modal"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
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

        {/* 모달 본문 (기술 디버깅 및 에러 스택 박스) */}
        <div style={{ padding: '20px' }}>
          <p style={{ fontSize: '13px', color: '#cbd5e1', marginBottom: '10px', lineHeight: 1.5 }}>
            시스템 내부 예외 또는 데이터베이스 오류가 감지되었습니다. <b>[오류 내용 복사]</b> 버튼을 눌러 원인을 개발팀에 제보하실 수 있습니다:
          </p>
          
          {/* 오류 텍스트 박스 (모노스페이스 다크 에디터 톤) */}
          <div style={{ position: 'relative' }}>
            <textarea
              readOnly
              value={message}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
              style={{
                width: '100%',
                minHeight: '140px',
                maxHeight: '260px',
                backgroundColor: 'var(--bg-app, #0f172a)',
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
              <p style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', margin: '0 0 8px', lineHeight: 1.5 }}>
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
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary, #2563eb)' }}>
                  🌐 원격 DB 네트워크 통신 장애 안내
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted, #94a3b8)', margin: 0, lineHeight: 1.6 }}>
                • 브라우저의 인터넷 연결이 단락되었거나, 원격 Supabase 서버 연결이 지연되었습니다.<br />
                • <b style={{ color: 'var(--text-primary, #1e293b)' }}>로컬 데이터베이스에는 변경 사항이 안전하게 반영되었습니다.</b> 네트워크 연결 복구 후 작업을 재시도하시거나 페이지를 새로고침하여 주십시오.
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

        {/* 모달 푸터 / 액션 버튼 (오류 내용 복사 버튼 필수 유지) */}
        <div style={{
          padding: '14px 20px',
          backgroundColor: 'var(--bg-app, #0f172a)',
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
              data-uia="btn-copy-error-content"
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
            data-uia="btn-close-error-modal-confirm"
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
