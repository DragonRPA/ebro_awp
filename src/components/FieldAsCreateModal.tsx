import React, { useState } from 'react';
import { X, Wrench } from 'lucide-react';
import { db, FieldAsTicket } from '../services/db';

export interface FieldAsCreatePayload {
  source: 'DIRECT_INTAKE';
  customerName: string;
  siteName: string;
  siteAddress: string;
  assetNo: string;
  locationDetail: string;
  reporterName: string;
  reporterContact: string;
  issueCategory: string;
  issueDescription: string;
  errorCode: string;
  priority: 'NORMAL' | 'URGENT';
  status: 'SCHEDULED' | 'REQUESTED';
  visitDate: string;
  assignedMechanicId: string;
  billableType: 'FREE' | 'BILLABLE';
  billableAmount: number;
}

interface FieldAsCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: FieldAsCreatePayload) => Promise<void>;
  isSubmitting: boolean;
  eligibleAssignees: any[];
  categories: string[];
  initialMechanicId?: string;
  showToast: (msg: string, type?: 'success' | 'warning' | 'error') => void;
  showErrorModal: (msg: string) => void;
}

export const FieldAsCreateModal: React.FC<FieldAsCreateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  eligibleAssignees,
  categories,
  initialMechanicId = '',
  showToast,
  showErrorModal
}) => {
  const [customerName, setCustomerName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [assetNo, setAssetNo] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [category, setCategory] = useState('방지봉/협착');
  const [issueDesc, setIssueDesc] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignedMechanicId, setAssignedMechanicId] = useState(initialMechanicId);

  if (!isOpen) return null;

  // 장비번호 기준 계약/현장/고객/상세주소 자동 추적
  const handleAutoLookupByAssetNo = (inputAssetNo: string) => {
    const trimmed = inputAssetNo.trim().toUpperCase();
    if (!trimmed) return;
    const asset = (db.assets || []).find(a => a.assetNo?.toUpperCase() === trimmed);
    if (!asset) {
      showToast(`장비번호 ${trimmed}에 해당하는 등록 자산을 찾을 수 없습니다.`, 'warning');
      return;
    }
    const activeCa = (db.contractAssets || []).find(ca => ca.assetId === asset.id && ca.status !== 'RETURNED');
    if (!activeCa) {
      showToast(`장비 ${trimmed}은 현재 대여 중인 활성 계약이 없습니다.`, 'warning');
      return;
    }
    const contract = (db.contracts || []).find(c => c.id === activeCa.contractId);
    if (!contract) return;
    const customer = (db.customers || []).find(c => c.id === contract.customerId);
    const site = (db.customerSites || []).find(s => s.id === contract.siteId);

    if (customer?.name) setCustomerName(customer.name);
    if (site?.name) setSiteName(site.name);
    if (site?.address) setSiteAddress(site.address);
    else if (customer?.address) setSiteAddress(customer.address);

    showToast(`장비 [${trimmed}] 계약 정보 자동 연동 완료 (${customer?.name || ''} - ${site?.name || ''})`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!siteName.trim()) {
      showErrorModal('현장명을 입력해 주세요.');
      return;
    }
    if (!issueDesc.trim()) {
      showErrorModal('고장 내용을 입력해 주세요.');
      return;
    }

    await onSubmit({
      source: 'DIRECT_INTAKE',
      customerName: customerName.trim() || '현장 협력업체',
      siteName: siteName.trim(),
      siteAddress: siteAddress.trim(),
      assetNo: assetNo.trim() || '현장확인',
      locationDetail: locationDetail.trim(),
      reporterName: reporterName.trim(),
      reporterContact: reporterContact.trim(),
      issueCategory: category,
      issueDescription: issueDesc.trim(),
      errorCode: errorCode.trim(),
      priority,
      status: assignedMechanicId ? 'SCHEDULED' : 'REQUESTED',
      visitDate,
      assignedMechanicId,
      billableType: 'FREE',
      billableAmount: 0
    });
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
      <div style={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', width: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wrench size={18} color="#2563eb" />
            신규 현장 AS 접수 등록
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>현장명 *</label>
              <input
                type="text"
                required
                value={siteName}
                onChange={(e) => {
                  const val = e.target.value;
                  setSiteName(val);
                  const s = db.customerSites.find(cs => cs.name.includes(val.trim()) || val.trim().includes(cs.name));
                  if (s?.address?.trim()) setSiteAddress(s.address.trim());
                }}
                placeholder="예: 용인 SK하이닉스 팹동"
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>업체명 (고객사)</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  const val = e.target.value;
                  setCustomerName(val);
                  const cust = db.customers.find(c => c.name.includes(val.trim()) || val.trim().includes(c.name));
                  if (cust) {
                    const cs = db.customerSites.find(s => s.customerId === cust.id);
                    if (cs?.address?.trim()) setSiteAddress(cs.address.trim());
                    else if (cust.address?.trim()) setSiteAddress(cust.address.trim());
                  }
                }}
                placeholder="예: 세보, 화성"
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* 도로명 상세 주소 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                현장 도로명 주소 (T맵 연동)
              </label>
              {siteName.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    const s = (db.customerSites || []).find(cs => cs.name.includes(siteName.trim()) || siteName.trim().includes(cs.name));
                    if (s?.address?.trim()) {
                      setSiteAddress(s.address.trim());
                      showToast('현장 마스터 등록 주소를 반영했습니다.');
                    } else {
                      const cust = (db.customers || []).find(c => c.name.includes(customerName.trim()) || customerName.trim().includes(c.name));
                      if (cust?.address?.trim()) {
                        setSiteAddress(cust.address.trim());
                        showToast('고객사 기본 주소를 반영했습니다.');
                      } else {
                        showToast('해당 현장/고객사의 등록 주소를 찾을 수 없습니다.', 'warning');
                      }
                    }
                  }}
                  style={{
                    fontSize: '11px',
                    color: '#0284c7',
                    backgroundColor: 'rgba(2, 132, 199, 0.08)',
                    border: '1px solid rgba(2, 132, 199, 0.25)',
                    borderRadius: '4px',
                    padding: '1px 6px',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  📍 마스터 주소 자동적용
                </button>
              )}
            </div>
            <input
              type="text"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="도로명 주소 입력 (고객 정보 자동 연동)"
              style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>관리번호 (장비번호)</label>
                {assetNo.trim() && (
                  <button
                    type="button"
                    onClick={() => handleAutoLookupByAssetNo(assetNo)}
                    style={{
                      fontSize: '11px',
                      color: 'var(--primary)',
                      backgroundColor: 'rgba(37, 99, 235, 0.08)',
                      border: '1px solid rgba(37, 99, 235, 0.25)',
                      borderRadius: '4px',
                      padding: '1px 6px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    🔍 계약/현장/주소 자동완성
                  </button>
                )}
              </div>
              <input
                type="text"
                value={assetNo}
                onChange={(e) => setAssetNo(e.target.value)}
                onBlur={(e) => {
                  if (e.target.value.trim() && !siteName.trim()) {
                    handleAutoLookupByAssetNo(e.target.value);
                  }
                }}
                placeholder="예: G10032, 전체장비"
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>장비 세부 위치</label>
              <input
                type="text"
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder="예: 8층 X27 Y17"
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>고장 분류</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', backgroundColor: 'var(--bg-card)' }}
              >
                {categories.filter(c => c !== 'ALL').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>에러코드 (선택)</label>
              <input
                type="text"
                value={errorCode}
                onChange={(e) => setErrorCode(e.target.value)}
                placeholder="예: LD, U038"
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>고장 상세 내용 *</label>
            <textarea
              rows={3}
              required
              value={issueDesc}
              onChange={(e) => setIssueDesc(e.target.value)}
              placeholder="고장 증상을 입력해 주세요."
              style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>현장 접수자 연락처</label>
              <input
                type="text"
                value={reporterContact}
                onChange={(e) => setReporterContact(e.target.value)}
                placeholder="예: 010-1234-5678"
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>담당자지정</label>
              <select
                value={assignedMechanicId}
                onChange={(e) => setAssignedMechanicId(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', backgroundColor: 'var(--bg-card)' }}
              >
                <option value="">담당자지정 (추후 지정)</option>
                {eligibleAssignees.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ padding: '8px 20px', backgroundColor: 'var(--primary)', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, color: '#ffffff', cursor: 'pointer' }}
            >
              {isSubmitting ? '등록중...' : '접수 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
