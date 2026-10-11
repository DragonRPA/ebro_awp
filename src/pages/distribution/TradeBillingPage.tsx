import React, { useState } from 'react';
import { useTrade } from '../../context/TradeContext';
import { CheckCircle, FileText, X } from 'lucide-react';

export const TradeBillingPage: React.FC = () => {
  const { salesOrders, outbounds, issueBilling } = useTrade();
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofTitle, setProofTitle] = useState<string>('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
      <div style={{ paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 data-mid="trade_billing-header" style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
            <FileText size={18} color="var(--primary)" />
            유통 청구 및 명세
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            납품증빙 서명이 완료된 유통 매출건을 검증하고 월별 거래명세서 및 전자세금계산서 청구 발행
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        <table data-mid="trade_billing-table" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'var(--bg-card)', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>주문번호</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>고객사</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>납품증빙 서명 확인</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>매출액 (원)</th>
              <th style={{ padding: '12px 14px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>청구 발행</th>
            </tr>
          </thead>
          <tbody>
            {salesOrders.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                  수주 내역이 없습니다.
                </td>
              </tr>
            ) : (
              salesOrders.map(o => {
                const matchedOutbound = outbounds.find(ob => ob.orderId === o.id);
                const isDelivered = o.status === 'DELIVERED' || matchedOutbound?.status === 'DELIVERED';
                const hasProof = Boolean(matchedOutbound?.proofUrl);

                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px 14px', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{o.id.substring(0, 10)}</td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: 'var(--text-muted)' }}>현대건설(주)</td>
                    
                    {/* Proof Status */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      {hasProof ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor: '#dcfce7',
                            color: '#15803d',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <CheckCircle size={12} />
                            서명 확인됨
                          </span>
                          <button
                            data-uia="btn-view-billing-proof"
                            onClick={() => {
                              setProofUrl(matchedOutbound?.proofUrl || null);
                              setProofTitle(`납품확인서 증빙 - 주문번호 ${o.id.substring(0, 10)}`);
                            }}
                            style={{
                              padding: '3px 8px',
                              backgroundColor: 'var(--bg-app)',
                              color: 'var(--success)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <FileText size={12} />
                            납품증
                          </button>
                        </div>
                      ) : isDelivered ? (
                        <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: 600 }}>납품 완료 (증빙 대기)</span>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>배송/납품 전</span>
                      )}
                    </td>

                    <td style={{ padding: '12px 14px', fontSize: '14px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                      {o.totalSalesAmount.toLocaleString()}원
                    </td>
                    
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <button 
                        data-mid="trade_billing-issue-btn" 
                        onClick={() => issueBilling(o.customerId, '2026-10').catch(err => alert(err.message))} 
                        style={{ 
                          padding: '6px 14px', 
                          backgroundColor: '#4f46e5', 
                          color: '#fff', 
                          border: 'none', 
                          borderRadius: '6px', 
                          cursor: 'pointer',
                          fontSize: '12.5px',
                          fontWeight: 700
                        }}
                      >
                        명세서 일괄 발행
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Proof Modal */}
      {proofUrl && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}>
          <div style={{ backgroundColor: 'var(--bg-card)', width: '800px', maxHeight: '92vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
            <div style={{ padding: '14px 20px', backgroundColor: '#064e3b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} />
                {proofTitle}
              </h3>
              <button onClick={() => setProofUrl(null)} style={{ border: 'none', background: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
            </div>
            <div style={{ flex: 1, padding: '20px', overflow: 'auto', textAlign: 'center', backgroundColor: 'var(--bg-app)' }}>
              <img src={proofUrl} alt="서명된 납품확인서" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
            </div>
            <div style={{ padding: '12px 20px', backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>※ 회계 청구 전 최종 검증용 인수자 서명 문서입니다.</span>
              <button onClick={() => setProofUrl(null)} style={{ padding: '6px 16px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}>닫기</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
export default TradeBillingPage;
