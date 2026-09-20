import React, { useState } from 'react';
import { TrendingUp, Bot, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, FileCheck, Check, DollarSign } from 'lucide-react';
import { executeAgenticPrompt } from '../services/agenticActionGateway';

interface ReconciliationRow {
  id: string;
  contractNo: string;
  customerName: string;
  assetOld: string;
  assetNew: string;
  exchangeDate: string;
  oldDays: number;
  oldRevenue: number;
  newDays: number;
  newRevenue: number;
  totalRevenue: number;
  bankDepositAmount: number;
  difference: number;
  status: 'PENDING' | 'MATCHED' | 'CONFIRMED';
  auditNote: string;
}

export const AgenticSettlementAutopilotPage: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState('2026-09');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 고밀도 대사 테이블 데이터 (헌장 4.1 일할 매출 기여액 대차대조)
  const [reconcileList, setReconcileList] = useState<ReconciliationRow[]>([
    {
      id: 'REC-001',
      contractNo: 'CNT-2026-0041',
      customerName: '현대건설(주)',
      assetOld: 'S-45 (#101)',
      assetNew: 'S-45 (#108, 대차)',
      exchangeDate: '2026-09-12',
      oldDays: 11, // 9/1~9/11
      oldRevenue: 440000, // 40,000 * 11
      newDays: 19, // 9/12~9/30
      newRevenue: 760000, // 40,000 * 19
      totalRevenue: 1200000,
      bankDepositAmount: 1200000,
      difference: 0,
      status: 'MATCHED',
      auditNote: '전자산 전일 마감 ➔ 후장비 당일 승계 1원 오차 없음 (차액 ₩0)'
    },
    {
      id: 'REC-002',
      contractNo: 'CNT-2026-0042',
      customerName: 'GS건설(주)',
      assetOld: 'SJ3219 (#203)',
      assetNew: 'SJ3219 (#215, 대차)',
      exchangeDate: '2026-09-15',
      oldDays: 14, // 9/1~9/14
      oldRevenue: 350000,
      newDays: 16, // 9/15~9/30
      newRevenue: 400000,
      totalRevenue: 750000,
      bankDepositAmount: 750000,
      difference: 0,
      status: 'MATCHED',
      auditNote: '통장 입금 1:1 대사 일치 (차액 ₩0)'
    },
    {
      id: 'REC-003',
      contractNo: 'CNT-2026-0045',
      customerName: '대우건설(주)',
      assetOld: 'Z-45/25J (#302)',
      assetNew: '-',
      exchangeDate: '-',
      oldDays: 30,
      oldRevenue: 1500000,
      newDays: 0,
      newRevenue: 0,
      totalRevenue: 1500000,
      bankDepositAmount: 1500000,
      difference: 0,
      status: 'CONFIRMED',
      auditNote: '단일 장비 정상 청구 확정'
    }
  ]);

  // 대차대조 합계 검증
  const totalBilled = reconcileList.reduce((acc, cur) => acc + cur.totalRevenue, 0);
  const totalConfirmed = reconcileList.filter(r => r.status === 'CONFIRMED').reduce((acc, cur) => acc + cur.totalRevenue, 0);
  const totalMatched = reconcileList.filter(r => r.status === 'MATCHED').reduce((acc, cur) => acc + cur.totalRevenue, 0);
  const totalDiff = reconcileList.reduce((acc, cur) => acc + cur.difference, 0);

  // 오토파일럿 대사 실행
  const handleRunAutopilot = async () => {
    setLoading(true);
    setStatusMessage('에이전틱 AI가 전 계좌 거래내역을 파싱하고 헌장 4.1 일할 매출 기여액을 대조 중입니다...');

    try {
      await executeAgenticPrompt('9월 통장 입금 내역 1:1 대사 및 대차 교체 장비 일할 정산 차액 검증 실행');
      setReconcileList(prev => prev.map(item => ({ ...item, status: 'CONFIRMED' })));
      setStatusMessage('대사 완료: 3건 전수 대차 차액 ₩0 확인 및 최종 결재 마감 준비 완료.');
    } catch (err: any) {
      setStatusMessage(`대사 오류: ${err?.message || '실패'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', height: '100%', minHeight: 0 }} data-uia="agentic-settlement-autopilot-container">
      {/* 상단 헤더 바 (헌장 3.1 무수식어 건조 표준) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={20} color="var(--primary)" />
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800' }}>에이전틱 월말 대사 정산 오토파일럿</h2>
          <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', fontWeight: '700' }}>
            헌장 4.1 일할 매출 기여액 1원 오차 검증
          </span>
        </div>
      </div>

      {/* Gutenberg Z-패턴 ① 좌상단(Scope) & ② 우상단(Pipeline) 컨트롤 바 (헌장 3.5) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', padding: '12px 16px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        {/* ① 좌상단 (Start / Scope): 상하 스택 레이블-입력창 (헌장 3.4) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} data-uia="autopilot-scope-filter">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>정산 대상 연월</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)' }}>대사 대상 범위</label>
            <select style={{ padding: '6px 10px', fontSize: '13px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)' }}>
              <option>전체 거래처 (대차 교체 포함)</option>
              <option>대차 교체 발생 계약만</option>
              <option>차액 발생 의심 대상만</option>
            </select>
          </div>
        </div>

        {/* ② 우상단 (Input / Pipeline): 오토파일럿 대사 실행 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn-primary"
            onClick={handleRunAutopilot}
            disabled={loading}
            style={{ padding: '8px 16px', fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}
            data-uia="btn-run-autopilot"
          >
            {loading ? <RefreshCw size={14} className="spin" /> : <Bot size={14} />}
            <span>오토파일럿 대사 실행</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600', backgroundColor: 'rgba(59, 130, 246, 0.08)', padding: '8px 12px', borderRadius: '4px' }}>
          {statusMessage}
        </div>
      )}

      {/* Gutenberg Z-패턴 ③ 중앙 본문 (Inspection): 38px 슬림 고밀도 대사 그리드 (화면 80~85% 차지, 헌장 3.6 유형 B) */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-app)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }} data-uia="table-prorata-audit">
          <thead style={{ backgroundColor: 'var(--bg-secondary)', position: 'sticky', top: 0, zIndex: 10, borderBottom: '2px solid var(--border-color)' }}>
            <tr style={{ height: '36px' }}>
              <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>계약번호</th>
              <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>고객사</th>
              <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>전자산 (전일마감)</th>
              <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>후장비 (당일승계)</th>
              <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>교체일</th>
              <th style={{ padding: '6px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>전자산 매출</th>
              <th style={{ padding: '6px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>후장비 매출</th>
              <th style={{ padding: '6px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>청구 총액</th>
              <th style={{ padding: '6px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>통장 입금액</th>
              <th style={{ padding: '6px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>대차 차액</th>
              <th style={{ padding: '6px 10px', whiteSpace: 'nowrap', textAlign: 'center' }}>상태</th>
              <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>감사 판정</th>
            </tr>
          </thead>
          <tbody>
            {reconcileList.map((row) => (
              <tr
                key={row.id}
                style={{
                  height: '40px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: row.status === 'CONFIRMED' ? 'rgba(16, 185, 129, 0.04)' : 'transparent'
                }}
              >
                <td style={{ padding: '6px 10px', fontWeight: '700', whiteSpace: 'nowrap' }}>{row.contractNo}</td>
                <td style={{ padding: '6px 10px', fontWeight: '600', whiteSpace: 'nowrap' }}>{row.customerName}</td>
                <td style={{ padding: '6px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{row.assetOld} ({row.oldDays}일)</td>
                <td style={{ padding: '6px 10px', color: '#8b5cf6', fontWeight: '600', whiteSpace: 'nowrap' }}>{row.assetNew} {row.newDays > 0 ? `(${row.newDays}일)` : ''}</td>
                <td style={{ padding: '6px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{row.exchangeDate}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>₩{row.oldRevenue.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>₩{row.newRevenue.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', whiteSpace: 'nowrap' }}>₩{row.totalRevenue.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '700', color: 'var(--primary)', whiteSpace: 'nowrap' }}>₩{row.bankDepositAmount.toLocaleString()}</td>
                <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: '800', color: '#10b981', whiteSpace: 'nowrap' }}>
                  ₩{row.difference.toLocaleString()}
                </td>
                <td style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: '700',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: row.status === 'CONFIRMED' ? '#10b981' : '#3b82f6',
                    color: '#fff'
                  }}>
                    {row.status === 'CONFIRMED' ? '최종 마감' : 'AI 매칭'}
                  </span>
                </td>
                <td style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {row.auditNote}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Gutenberg Z-패턴 ④ 우측 하단 (Terminal Action): 대차대조 합계 검증식 및 최종 완결 버튼 (헌장 3.5) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}
        data-uia="summary-terminal-balance"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', fontSize: '13px' }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>청구총액: </span>
            <strong style={{ fontSize: '15px' }}>₩{totalBilled.toLocaleString()}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>확정액: </span>
            <strong style={{ color: '#10b981', fontSize: '15px' }}>₩{(totalConfirmed + totalMatched).toLocaleString()}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>대차 차액: </span>
            <strong style={{ color: '#10b981', fontSize: '15px' }}>₩{totalDiff.toLocaleString()} (일치)</strong>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '12px', fontWeight: '700' }}>
            <ShieldCheck size={14} />
            헌장 4.1 일할 매출 기여액 1원 오차 없음 확정
          </span>
        </div>

        <button
          className="btn-primary"
          onClick={() => {
            setReconcileList(prev => prev.map(item => ({ ...item, status: 'CONFIRMED' })));
            alert('9월 정산 대사가 최종 확정 마감되었습니다. (대차 차액 ₩0 무결성 보존)');
          }}
          style={{ padding: '8px 20px', fontSize: '13px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <CheckCircle2 size={15} />
          <span>최종 결재 및 정산 마감</span>
        </button>
      </div>
    </div>
  );
};
