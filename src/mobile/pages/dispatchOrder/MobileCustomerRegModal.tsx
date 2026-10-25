// src/mobile/pages/dispatchOrder/MobileCustomerRegModal.tsx
// 모바일 출고 요청 내 신규 고객사 등록 및 기존 고객사 정보 수정 모달 (사업자등록증 AI 자동등록 연동)

import React, { useState } from 'react';
import {
  X,
  Building2,
  Sparkles,
  Check
} from 'lucide-react';
import {
  Customer,
  PaymentMethodType,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_DUE_MONTH_OPTIONS
} from '../../../services/db';
import { BusinessLicenseModal } from '../../../components/BusinessLicenseModal';

interface MobileCustomerRegModalProps {
  isOpen: boolean;
  editingCust: Partial<Customer> | null;
  setEditingCust: React.Dispatch<React.SetStateAction<Partial<Customer> | null>>;
  isSubmittingCust: boolean;
  onClose: () => void;
  onSaveSubmit: (e: React.FormEvent) => void;
  onBizLicenseOcrSuccess: (cust: Customer, isNew: boolean) => void;
}

export const MobileCustomerRegModal: React.FC<MobileCustomerRegModalProps> = ({
  isOpen,
  editingCust,
  setEditingCust,
  isSubmittingCust,
  onClose,
  onSaveSubmit,
  onBizLicenseOcrSuccess
}) => {
  const [showBizLicenseOcr, setShowBizLicenseOcr] = useState(false);

  if (!isOpen || !editingCust) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9400,
          backgroundColor: 'rgba(2, 6, 23, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px'
        }}
      >
        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          {/* 헤더 */}
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="w-4 h-4 text-purple-400 shrink-0" />
              <span className="text-sm font-black text-white whitespace-nowrap">
                {editingCust.id ? '고객사 정보 수정' : '신규 고객사 등록'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowBizLicenseOcr(true)}
                className="px-2.5 py-1 rounded-lg bg-indigo-700 hover:bg-indigo-600 text-white border border-indigo-500 text-[11px] font-bold flex items-center gap-1 whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>사업자등록증 자동인식</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 폼 본문 */}
          <form onSubmit={onSaveSubmit} className="p-4 flex flex-col gap-3 overflow-y-auto text-xs">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-200">고객사 상호 *</label>
                <input
                  type="text"
                  required
                  value={editingCust.name || ''}
                  onChange={e => setEditingCust(prev => (prev ? { ...prev, name: e.target.value } : prev))}
                  placeholder="법인 상호 입력"
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-200">사업자등록번호 *</label>
                <input
                  type="text"
                  value={editingCust.bizRegNo || ''}
                  onChange={e => setEditingCust(prev => (prev ? { ...prev, bizRegNo: e.target.value } : prev))}
                  placeholder="000-00-00000"
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-200">대표자명</label>
                <input
                  type="text"
                  value={editingCust.representative || ''}
                  onChange={e => setEditingCust(prev => (prev ? { ...prev, representative: e.target.value } : prev))}
                  placeholder="대표자 성명"
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-200">대표 연락처</label>
                <input
                  type="tel"
                  value={editingCust.repContact || ''}
                  onChange={e => setEditingCust(prev => (prev ? { ...prev, repContact: e.target.value } : prev))}
                  placeholder="02-000-0000"
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-200">사업장 주소</label>
              <input
                type="text"
                value={editingCust.address || ''}
                onChange={e => setEditingCust(prev => (prev ? { ...prev, address: e.target.value } : prev))}
                placeholder="사업장 도로명 주소"
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-slate-200">세금계산서 이메일</label>
              <input
                type="email"
                value={editingCust.repEmail || ''}
                onChange={e => setEditingCust(prev => (prev ? { ...prev, repEmail: e.target.value } : prev))}
                placeholder="tax@company.com"
                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs"
              />
            </div>

            {/* 정산 및 결제 기본값 */}
            <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
              <div className="text-xs font-bold text-amber-300">기본 정산 및 결제 조건</div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-300">명세서 마감일</label>
                  <select
                    value={editingCust.defaultStatementClosingDay || 25}
                    onChange={e =>
                      setEditingCust(prev =>
                        prev ? { ...prev, defaultStatementClosingDay: Number(e.target.value) } : prev
                      )
                    }
                    className="px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                  >
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>
                        {d === 31 ? '말일' : `${d}일`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-300">계산서 마감일</label>
                  <select
                    value={editingCust.defaultBillingDay ?? 30}
                    onChange={e =>
                      setEditingCust(prev => (prev ? { ...prev, defaultBillingDay: Number(e.target.value) } : prev))
                    }
                    className="px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                  >
                    <option value={0}>미지정</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={d}>
                        {d === 31 ? '말일' : `${d}일`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-300">발행조건</label>
                  <select
                    value={editingCust.defaultTaxInvoiceIssueType || 'FORWARD'}
                    onChange={e =>
                      setEditingCust(prev =>
                        prev ? { ...prev, defaultTaxInvoiceIssueType: e.target.value as 'FORWARD' | 'REVERSE' } : prev
                      )
                    }
                    className="px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                  >
                    <option value="FORWARD">정발행</option>
                    <option value="REVERSE">역발행</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-300">약정 결제수단</label>
                  <select
                    value={editingCust.defaultPaymentMethod || 'CASH'}
                    onChange={e =>
                      setEditingCust(prev =>
                        prev ? { ...prev, defaultPaymentMethod: e.target.value as PaymentMethodType } : prev
                      )
                    }
                    className="px-2 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                  >
                    {PAYMENT_METHOD_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-300">약정 결제일</label>
                  <div className="grid grid-cols-2 gap-1">
                    <select
                      value={editingCust.paymentDueMonthOffset ?? 1}
                      onChange={e =>
                        setEditingCust(prev =>
                          prev ? { ...prev, paymentDueMonthOffset: Number(e.target.value) } : prev
                        )
                      }
                      className="px-1.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                    >
                      {PAYMENT_DUE_MONTH_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editingCust.paymentDueDay || 25}
                      onChange={e =>
                        setEditingCust(prev => (prev ? { ...prev, paymentDueDay: Number(e.target.value) } : prev))
                      }
                      className="px-1.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs"
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                        <option key={d} value={d}>
                          {d === 31 ? '말일' : `${d}일`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs whitespace-nowrap"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmittingCust}
                className="py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs flex items-center justify-center gap-1 whitespace-nowrap"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmittingCust ? '저장 중...' : editingCust.id ? '정보 수정 완료' : '신규 고객사 등록'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {showBizLicenseOcr && (
        <BusinessLicenseModal
          isOpen={showBizLicenseOcr}
          onClose={() => setShowBizLicenseOcr(false)}
          targetCustomerId={editingCust.id}
          onSuccess={(cust, isNew) => {
            setShowBizLicenseOcr(false);
            onBizLicenseOcrSuccess(cust, isNew);
          }}
        />
      )}
    </>
  );
};
