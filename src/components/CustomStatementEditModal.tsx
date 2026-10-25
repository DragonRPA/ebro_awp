import React, { useState } from 'react';
import { Edit3, Plus } from 'lucide-react';
import { Billing, Contract, Customer, SiteMaster, CustomStatementItem } from '../services/db';
import { useApproval } from '../hooks/useApproval';

interface CustomStatementEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetBilling: Billing;
  targetContract: Contract | null;
  targetCustomer: Customer | null;
  targetSite: SiteMaster | null;
  initialReason: string;
  initialItems: CustomStatementItem[];
  onSave: (reason: string, items: CustomStatementItem[]) => Promise<void>;
  onRestore: (billingId: string) => Promise<void>;
}

export const CustomStatementEditModal: React.FC<CustomStatementEditModalProps> = ({
  isOpen,
  onClose,
  targetBilling,
  targetContract,
  targetCustomer,
  targetSite,
  initialReason,
  initialItems,
  onSave,
  onRestore,
}) => {
  // 모달 자체의 독립 로컬 상태 (부모 거대 컴포넌트의 리렌더링 차단)
  const { isRuleEnabled } = useApproval();
  const [reasonInput, setReasonInput] = useState(initialReason);
  const [itemsDraft, setItemsDraft] = useState<CustomStatementItem[]>(initialItems);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const originalSupply = targetBilling.totalAmount || 0;
  const originalVat = Math.round(originalSupply * 0.1);
  const originalGrand = originalSupply + originalVat;

  const draftSupply = itemsDraft.reduce((s, it) => s + (it.supplyAmount || 0), 0);
  const draftVat = itemsDraft.reduce((s, it) => s + (it.vatAmount || 0), 0);
  const draftGrand = draftSupply + draftVat;
  const diffGrand = draftGrand - originalGrand;

  const handleAddItem = () => {
    setItemsDraft(prev => [
      ...prev,
      {
        id: `cs-item-${Date.now()}-${prev.length}`,
        itemDescription: '',
        specification: '',
        quantity: 1,
        unitPrice: 0,
        supplyAmount: 0,
        vatAmount: 0,
        notes: ''
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItemsDraft(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, updates: Partial<CustomStatementItem>) => {
    setItemsDraft(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await onSave(reasonInput, itemsDraft);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestore = async () => {
    setIsSubmitting(true);
    try {
      await onRestore(targetBilling.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        style={{
          maxWidth: '1000px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          padding: '20px'
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Edit3 size={18} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: 'var(--primary)' }}>
              특수 거래명세서 품목 편집 ({targetBilling.billingYm} - {targetCustomer?.name || '고객사'})
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '18px',
              color: 'var(--text-muted)'
            }}
          >
            ✕
          </button>
        </div>

        {/* 안내 배너 */}
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#faf5ff',
            borderRadius: '6px',
            border: '1px solid #e9d5ff',
            fontSize: '12px',
            color: '#5b21b6'
          }}
        >
          💡 실제 계약 회계 원장 DB(Billing & BillingDetail)는 원본 그대로 보존되며, 거래명세서 출력 및 이메일 발송 시 교부될 품목명과 금액만 임의 수정됩니다.
        </div>

        {/* 기준 정보 카드 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            padding: '8px 12px',
            backgroundColor: 'var(--bg-app)',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            fontSize: '12px'
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block' }}>계약번호 / 현장</span>
            <strong>{targetContract?.contractNo || '-'} / {targetSite?.name || '직납'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block' }}>청구귀속월 / 발행일</span>
            <strong>{targetBilling.billingYm} / {targetBilling.billingDate}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block' }}>회계 원장 정상 총액</span>
            <strong style={{ color: 'var(--primary)' }}>
              ₩{originalGrand.toLocaleString()} (공급가 ₩{originalSupply.toLocaleString()})
            </strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block' }}>현재 상태</span>
            <strong>
              {targetBilling.status === 'PAID' ? '완납' : '미납'}{' '}
              {targetBilling.hasCustomStatement ? '(특수명세서 적용중)' : '(정상원장 기준)'}
            </strong>
          </div>
        </div>

        {/* 거래명세서 변환 사유 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', fontWeight: 800, color: '#6d28d9' }}>
            거래명세서 변환 사유 및 차이 내역 (필수) *
          </label>
          <input
            type="text"
            value={reasonInput}
            onChange={(e) => setReasonInput(e.target.value)}
            placeholder="예: 고객사 요청에 따라 장비 명칭 통합 표기 및 단가 조정..."
            style={{
              width: '100%',
              padding: '6px 10px',
              fontSize: '12.5px',
              borderRadius: '4px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-app)'
            }}
          />
        </div>

        {/* 품목 헤더 & 추가 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 700 }}>
            명세서 품목 목록 ({itemsDraft.length}건)
          </span>
          <button
            type="button"
            className="btn-primary"
            onClick={handleAddItem}
            style={{
              fontSize: '11px',
              padding: '3px 8px',
              backgroundColor: 'var(--primary)',
              borderColor: 'var(--primary-hover)'
            }}
          >
            <Plus size={11} /> 행 추가
          </button>
        </div>

        {/* 품목 테이블 */}
        <div
          className="table-container"
          style={{
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            overflowX: 'auto',
            maxHeight: '300px'
          }}
        >
          <table style={{ width: '100%', fontSize: '11.5px', borderCollapse: 'collapse', whiteSpace: 'nowrap' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--bg-app)' }}>
              <tr>
                <th style={{ width: '36px', textAlign: 'center', padding: '4px 6px' }}>순번</th>
                <th style={{ minWidth: '160px', textAlign: 'left', padding: '4px 8px' }}>품목명 *</th>
                <th style={{ width: '120px', textAlign: 'left', padding: '4px 8px' }}>규격/상세</th>
                <th style={{ width: '60px', textAlign: 'right', padding: '4px 8px' }}>수량 *</th>
                <th style={{ width: '100px', textAlign: 'right', padding: '4px 8px' }}>단가 *</th>
                <th style={{ width: '110px', textAlign: 'right', padding: '4px 8px' }}>공급가액 *</th>
                <th style={{ width: '90px', textAlign: 'right', padding: '4px 8px' }}>부가세</th>
                <th style={{ width: '110px', textAlign: 'right', padding: '4px 8px' }}>합계</th>
                <th style={{ minWidth: '100px', textAlign: 'left', padding: '4px 8px' }}>비고</th>
                <th style={{ width: '40px', textAlign: 'center', padding: '4px 6px' }}>삭제</th>
              </tr>
            </thead>
            <tbody>
              {itemsDraft.map((item, idx) => {
                const total = (item.supplyAmount || 0) + (item.vatAmount || 0);
                return (
                  <tr key={item.id} style={{ height: '36px', borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4px 6px' }}>{idx + 1}</td>
                    <td style={{ padding: '3px 6px' }}>
                      <input
                        type="text"
                        value={item.itemDescription}
                        onChange={(e) => handleUpdateItem(idx, { itemDescription: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '3px 6px',
                          fontSize: '11.5px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)'
                        }}
                      />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <input
                        type="text"
                        value={item.specification || ''}
                        onChange={(e) => handleUpdateItem(idx, { specification: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '3px 6px',
                          fontSize: '11.5px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)'
                        }}
                      />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <input
                        type="number"
                        value={item.quantity}
                        min={1}
                        onChange={(e) => {
                          const qty = Math.max(1, Number(e.target.value) || 1);
                          const supply = qty * (item.unitPrice || 0);
                          handleUpdateItem(idx, {
                            quantity: qty,
                            supplyAmount: supply,
                            vatAmount: Math.round(supply * 0.1)
                          });
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '3px 6px',
                          fontSize: '11.5px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)'
                        }}
                      />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <input
                        type="number"
                        value={item.unitPrice}
                        min={0}
                        step={1000}
                        onChange={(e) => {
                          const uPrice = Math.max(0, Number(e.target.value) || 0);
                          const supply = (item.quantity || 1) * uPrice;
                          handleUpdateItem(idx, {
                            unitPrice: uPrice,
                            supplyAmount: supply,
                            vatAmount: Math.round(supply * 0.1)
                          });
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '3px 6px',
                          fontSize: '11.5px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)'
                        }}
                      />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <input
                        type="number"
                        value={item.supplyAmount}
                        min={0}
                        step={1000}
                        onChange={(e) => {
                          const sAmt = Math.max(0, Number(e.target.value) || 0);
                          const uPrice = item.quantity > 0 ? Math.round(sAmt / item.quantity) : 0;
                          handleUpdateItem(idx, {
                            supplyAmount: sAmt,
                            unitPrice: uPrice,
                            vatAmount: Math.round(sAmt * 0.1)
                          });
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '3px 6px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)'
                        }}
                      />
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <input
                        type="number"
                        min={0}
                        value={item.vatAmount}
                        onChange={(e) => {
                          const vAmt = Math.max(0, Number(e.target.value) || 0);
                          handleUpdateItem(idx, { vatAmount: vAmt });
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '3px 6px',
                          fontSize: '11.5px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-muted)'
                        }}
                      />
                    </td>
                    <td style={{ textAlign: 'right', padding: '3px 8px', fontWeight: 700, color: 'var(--primary)' }}>
                      ₩{total.toLocaleString()}
                    </td>
                    <td style={{ padding: '3px 6px' }}>
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => handleUpdateItem(idx, { notes: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '3px 6px',
                          fontSize: '11.5px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)'
                        }}
                      />
                    </td>
                    <td style={{ textAlign: 'center', padding: '3px 6px' }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 푸터 합계 & 액션 버튼 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '12px',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12.5px' }}>
            <span>원장: ₩{originalGrand.toLocaleString()}</span>
            <span>➔</span>
            <span style={{ fontWeight: 800, color: 'var(--primary)' }}>명세서: ₩{draftGrand.toLocaleString()}</span>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: '4px',
                fontWeight: 800,
                fontSize: '11.5px',
                backgroundColor: diffGrand === 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: diffGrand === 0 ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${diffGrand === 0 ? 'var(--success)' : 'var(--danger)'}44`
              }}
            >
              {diffGrand === 0
                ? '⚖️ 총액 일치 (저장 승인 가능)'
                : `🚫 저장 불가: 총액 불일치 (차액: ₩${diffGrand.toLocaleString()})`}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {targetBilling.hasCustomStatement && (
              <button
                type="button"
                className="btn-danger"
                disabled={isSubmitting}
                onClick={handleRestore}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                정상 복원
              </button>
            )}
            <button
              type="button"
              className="btn-secondary"
              disabled={isSubmitting}
              onClick={onClose}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              닫기
            </button>
            <button
              data-hs-trigger="Save"
              type="button"
              className="btn-primary"
              disabled={isSubmitting || diffGrand !== 0 || !reasonInput.trim() || itemsDraft.length === 0}
              onClick={handleSave}
              style={{
                fontSize: '12px',
                padding: '6px 16px',
                backgroundColor: diffGrand === 0 && reasonInput.trim() ? 'var(--primary)' : 'var(--bg-secondary)',
                borderColor: diffGrand === 0 && reasonInput.trim() ? 'var(--primary-hover)' : 'var(--border-color)',
                color: diffGrand === 0 && reasonInput.trim() ? '#ffffff' : 'var(--text-muted)',
                fontWeight: 800,
                cursor: diffGrand !== 0 || !reasonInput.trim() || isSubmitting ? 'not-allowed' : 'pointer',
                opacity: diffGrand !== 0 || !reasonInput.trim() || isSubmitting ? 0.6 : 1
              }}
              title={
                diffGrand !== 0
                  ? '원청구 합계와 특수명세서 품목 합계가 정확히 일치해야만 저장할 수 있습니다.'
                  : !reasonInput.trim()
                  ? '거래명세서 변환 사유를 입력해 주세요.'
                  : '특수 거래명세서 품목 저장'
              }
            >
              {isSubmitting ? '처리중...' : (isRuleEnabled('CUSTOM_BILLING_CREATE') ? '상신' : '명세서 저장')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
