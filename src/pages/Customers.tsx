// src/pages/Customers.tsx - 전사 표준 헌장 준수 거래처 고객사 및 현장/담당자 마스터 스튜디오
import { useApproval } from '../hooks/useApproval';
import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Plus, Search, MapPin, Phone, User, Mail, PlusCircle, Download, 
  CreditCard, ShieldCheck, Zap, Sparkles, CheckCircle2, AlertCircle, 
  X, Edit2, Trash2, RefreshCw, Layers, Check, Building2, Circle,
  Sliders, Tag, Settings, CheckSquare, Square, ChevronDown, ChevronUp, FileText, FolderOpen,
  ShieldAlert, FileSpreadsheet, SlidersHorizontal, Copy, ExternalLink
} from 'lucide-react';
import { db, Customer, CustomerContact, CustomerSite, SiteMaster, CustomerBankAccount, StandardOption, logPrivacyAccess, SiteContactPerson, SiteContactType, SITE_CONTACT_TYPE_CONFIG, PAYMENT_DUE_MONTH_OPTIONS, PaymentMethodType, PAYMENT_METHOD_OPTIONS, getPaymentMethodLabel, formatPaymentDueCondition, CustomerTransactionStatus, isCustomerRestricted, isCustomerTotalBlocked, getCustomerTransactionStatusLabel } from '../services/db';
import { exportToExcel } from '../services/excel';
import { isPrivilegedPrivacyUser, maskPhoneNumber, maskEmail, maskName, maskAddress } from '../utils/privacyMasking';
import { matchHangul, matchesChosungFilter, sortCustomersByName, createHangulMatcher } from '../utils/hangulSearch';
import { ChosungFilterBar } from '../components/ChosungFilterBar';
import { BusinessLicenseModal } from '../components/BusinessLicenseModal';
import { BatchBusinessLicenseModal } from '../components/BatchBusinessLicenseModal';
import { ContactCardOcrModal } from '../components/ContactCardOcrModal';
import { NtsStatusAuditModal } from '../components/NtsStatusAuditModal';
import { ExcelUploadModal, ExcelColumnDef } from '../components/ExcelUploadModal';
import { SortableTh } from '../components/SortableTh';
import { useSortableData } from '../hooks/useSortableData';
import {
  isMissingSiteAddress,
  sanitizeSiteAddressInput,
  findMatchingSiteMaster
} from '../utils/siteMatcher';
import { splitMasterAwareOptions } from '../types/siteOption';

// 🕒 KST(한국 표준시) 기준 입력일시/수정일시 포맷 헬퍼 (YYYY-MM-DD HH:mm)
const formatDateTimeKst = (raw?: string | null): string => {
  if (!raw) return '-';
  const str = String(raw).trim();
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str.slice(0, 16).replace('T', ' ');
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  const hh = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')} ${hh}:${get('minute')}`;
};

// ⚡ 좌측 고객 목록 개별 아이템 메모이제이션 (선택 고객 변경 시 타 고객 불필요 재렌더링 방지)
interface CustomerListItemProps {
  cust: Customer;
  isSelected: boolean;
  custSitesCount: number;
  custContactsCount: number;
  noticeCount: number;
  canSave: boolean;
  onSelect: (id: string) => void;
  onUploadBizCert: (id: string) => void;
  onViewBizCert: (cust: Customer) => void;
  onEditCust: (cust: Customer) => void;
}

const CustomerListItem = React.memo<CustomerListItemProps>(({
  cust,
  isSelected,
  custSitesCount,
  custContactsCount,
  noticeCount,
  canSave,
  onSelect,
  onUploadBizCert,
  onViewBizCert,
  onEditCust
}) => {
  const isMissingBiz = !cust.businessCertFileUrl || cust.businessCertFileUrl.trim() === '';

  return (
    <div
      id={`customer-item-${cust.id}`}
      data-mid='customer-grid-item'
      onClick={() => onSelect(cust.id)}
      style={{
        padding: '8px 10px',
        borderRadius: '5px',
        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
        backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-app)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '13px', color: isSelected ? 'var(--primary)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '210px' }}>
          {cust.name}
        </strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {isMissingBiz ? (
            <>
              <span style={{ fontSize: '9.5px', color: 'var(--danger)', backgroundColor: 'rgba(239,68,68,0.08)', padding: '1px 4px', borderRadius: '3px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                등록증 미첨부
              </span>
              {canSave && (
                <button
                  data-hs-trigger="Register"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUploadBizCert(cust.id);
                  }}
                  title="사업자등록증 업로드로 사업자 정보 등록"
                  style={{
                    padding: '1px 5px',
                    fontSize: '9.5px',
                    border: '1px solid #059669',
                    borderRadius: '3px',
                    backgroundColor: 'rgba(5,150,105,0.12)',
                    color: 'var(--success)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <FileText size={10} /> 등록증 첨부
                </button>
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '9.5px', color: 'var(--success)', backgroundColor: 'rgba(5,150,105,0.08)', padding: '1px 4px', borderRadius: '3px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px', whiteSpace: 'nowrap' }}>
                <Check size={10} /> 등록증 첨부
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onViewBizCert(cust);
                }}
                title="사업자등록증 사본 열람"
                style={{
                  padding: '1px 5px',
                  fontSize: '9.5px',
                  border: '1px solid #0284c7',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(2,132,199,0.12)',
                  color: '#0284c7',
                  cursor: 'pointer',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
              >
                <FileText size={9} /> 보기
              </button>
            </div>
          )}
          {cust.isClosed ? (
            <span className="badge badge-danger" style={{ fontSize: '9.5px', padding: '1px 4px' }}>폐업</span>
          ) : cust.transactionStatus === 'RESTRICT_NEW' ? (
            <span className="badge" style={{ fontSize: '9.5px', padding: '1px 4px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #f59e0b' }}>추가금지</span>
          ) : isCustomerTotalBlocked(cust.transactionStatus) ? (
            <span className="badge badge-danger" style={{ fontSize: '9.5px', padding: '1px 4px' }}>전면차단</span>
          ) : null}
          {noticeCount > 0 && (
            <span style={{ fontSize: '9.5px', color: '#7e22ce', backgroundColor: '#f3e8ff', padding: '1px 4px', borderRadius: '3px', fontWeight: 800 }}>
              📜 내용증명 {noticeCount}건
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
        <span>대표: {cust.representative || '-'}</span>
        <span>등록번호: {cust.bizRegNo || '-'}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
        <span>현장 {custSitesCount}개소 · 담당 {custContactsCount}명</span>
        {canSave && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEditCust(cust); }}
            style={{
              padding: '1px 5px',
              fontSize: '11.5px',
              border: '1px solid var(--border-color)',
              borderRadius: '3px',
              backgroundColor: 'transparent',
              color: 'var(--primary)',
              cursor: 'pointer'
            }}
          >
            수정
          </button>
        )}
      </div>
    </div>
  );
});

export const Customers: React.FC = () => {
  
  const {
    users, customers, contacts, sites, siteMasters, saveSiteMaster, contracts, contractAssets, assets, billings, receivables, saveCustomer, deleteCustomer, saveContact, deleteContact, saveSite, deleteSite, hasPermission,
    navigationPayload, setNavigationPayload, currentUser, refreshAllData, legalNoticeLogs,
    standardOptions, saveStandardOption, deleteStandardOption, setActiveTab, showErrorModal
  } = useApp();

  const canSave = hasPermission('customer', 'save');
  const isDeveloper = currentUser?.id === 'sys-admin' || currentUser?.id === 'u-1' || currentUser?.loginId === 'admin' || currentUser?.position === 'D.RPA' || currentUser?.department?.includes('개발');

  // 토스트 알림 상태
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 검색 및 필터 상태 (헌장 1.1 & 1.2: 지연 조회 제거)
  const [searchTerm, setSearchTerm] = useState('');
  const [chosungFilter, setChosungFilter] = useState<string>('전체');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED' | 'RESTRICT_NEW' | 'BLOCKED_ALL' | 'CLOSED'>('ALL');
  const [showOnlyIncomplete, setShowOnlyIncomplete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // 선택된 고객 상태
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(customers[0]?.id || null);

  // 등록/수정 모달 상태
  const [showCustModal, setShowCustModal] = useState(false);
  const [editingCust, setEditingCust] = useState<Partial<Customer> | null>(null);
  const [showCustSpecs, setShowCustSpecs] = useState(false);
  const [isSubmittingCust, setIsSubmittingCust] = useState(false);

  // 📄 사업자등록증 AI 모달 상태
  const [showBizLicenseModal, setShowBizLicenseModal] = useState(false);
  const [targetBizLicenseCustId, setTargetBizLicenseCustId] = useState<string | undefined>(undefined);
  const [showBatchLicenseModal, setShowBatchLicenseModal] = useState(false);
  const [showNtsAuditModal, setShowNtsAuditModal] = useState(false);

  // 📄 사업자등록증 사본 열람 모달 상태 및 핸들러
  const [viewingBizCertCust, setViewingBizCertCust] = useState<Customer | null>(null);
  const handleViewBizCert = (cust: Customer) => {
    if (!cust.businessCertFileUrl || cust.businessCertFileUrl.trim() === '') {
      showErrorModal(`[${cust.name}] 고객사에 등록된 사업자등록증 파일(이미지/PDF)이 없습니다. '사업자등록증 보완' 버튼을 통해 등록해 주십시오.`);
      return;
    }
    setViewingBizCertCust(cust);
  };

  // 📇 명함/이메일 AI 모달 상태
  const [showContactCardModal, setShowContactCardModal] = useState(false);
  const [targetContactCardCustId, setTargetContactCardCustId] = useState<string | undefined>(undefined);

  // 엑셀 일괄 고객/현장/담당자 등록 모달 상태
  const [custExcelModalOpen, setCustExcelModalOpen] = useState(false);

  const custExcelColumns: ExcelColumnDef[] = [
    { key: 'name', label: '고객사명', required: true, sample: '(주)미래이엔씨' },
    { key: 'businessNumber', label: '사업자등록번호', sample: '123-45-67890' },
    { key: 'representative', label: '대표자명', sample: '홍길동' },
    { key: 'contactPhone', label: '대표전화', sample: '02-1234-5678' },
    { key: 'address', label: '본사주소', sample: '서울시 서초구 강남대로 100' },
    { key: 'siteName', label: '현장명', sample: '송도 바이오단지 1공구' },
    { key: 'siteAddress', label: '현장주소', sample: '인천 연수구 송도동 200' },
    { key: 'contactName', label: '담당자명', sample: '김소장' },
    { key: 'contactMobile', label: '담당자연락처', sample: '010-9876-5432' },
    { key: 'contactRole', label: '담당자직함', sample: '현장소장' },
  ];

  const handleBatchUploadCustomers = async (rows: Record<string, any>[]) => {
    try {
      let successCount = 0;
      for (const row of rows) {
        const name = String(row.name || '').trim();
        if (!name) continue;

        let targetCust = db.customers.find(c => 
          (row.businessNumber && c.bizRegNo && c.bizRegNo.replace(/[^0-9]/g, '') === String(row.businessNumber).replace(/[^0-9]/g, '')) ||
          (c.name || '').trim().toLowerCase() === name.toLowerCase()
        );

        let customerId = targetCust?.id;

        if (!targetCust) {
          const savedCust = await saveCustomer({
            name,
            bizRegNo: String(row.businessNumber || ''),
            representative: String(row.representative || ''),
            repContact: String(row.contactPhone || ''),
            address: String(row.address || '본사 주소 미지정'),
            repEmail: '',
            isClosed: false,
            transactionStatus: 'ALLOWED'
          });
          customerId = savedCust?.id || db.customers.find(c => c.name === name)?.id;
        }

        if (customerId && row.siteName) {
          const rawSiteName = String(row.siteName).trim();
          const siteAddress = sanitizeSiteAddressInput(row.siteAddress);

          await saveSite({
            customerId,
            name: rawSiteName,
            address: siteAddress,
            isActive: true,
            contactName: String(row.contactName || '').trim(),
            contact: String(row.contactMobile || '').trim(),
            email: ''
          });
        }

        if (customerId && row.contactName) {
          await saveContact({
            customerId,
            name: String(row.contactName).trim(),
            contact: String(row.contactMobile || '').trim(),
            position: String(row.contactRole || '담당자').trim(),
            email: ''
          });
        }

        successCount++;
      }

      await db.awaitPendingWrites();
      await refreshAllData();
      showToast(`${successCount}개사의 고객사 및 현장/담당자가 일괄 등록되었습니다.`);
      return { successCount, message: '고객사 일괄 등록 완료' };
    } catch (err: any) {
      showErrorModal(`고객사 일괄 등록 오류: ${err?.message || String(err)}`, '엑셀 일괄 업로드 실패');
      throw err;
    }
  };

  const handleBizLicenseSuccess = async (savedCustomer: Customer, isNew: boolean) => {
    setSearchTerm(savedCustomer.name);
    setStatusFilter('ALL');
    setShowOnlyIncomplete(false);
    setSelectedCustomerId(savedCustomer.id);
    await refreshAllData();
    showToast(isNew ? `신규 고객사 [${savedCustomer.name}] 등록 완료` : `고객사 [${savedCustomer.name}] 정보 보완 완료`, 'success');
  };

  const handleContactCardSuccess = async (savedContact: CustomerContact, isNewCust: boolean) => {
    setSelectedCustomerId(savedContact.customerId);
    await refreshAllData();
    showToast(isNewCust ? `가등록 고객사 및 담당자 [${savedContact.name}] 등록 완료` : `담당자 [${savedContact.name}] 등록 완료`, 'success');
  };

  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Partial<CustomerContact> | null>(null);

  const [showSiteModal, setShowSiteModal] = useState(false);
  const [editingSite, setEditingSite] = useState<Partial<CustomerSite> | null>(null);
  const [showSiteSpecs, setShowSiteSpecs] = useState(false);

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<CustomerBankAccount> | null>(null);

  // 🏷️ 전사 표준 옵션 마스터 모달 상태
  const [showOptionMasterModal, setShowOptionMasterModal] = useState(false);
  const [editingOption, setEditingOption] = useState<Partial<StandardOption> | null>(null);
  const [optionCategoryFilter, setOptionCategoryFilter] = useState<'ALL' | 'PAID' | 'PROTECTION' | 'ATTACHMENT' | 'SPEC'>('ALL');

  // 🛡️ 고객사 기본 옵션 관리 모달 상태
  const [showCustOptionModal, setShowCustOptionModal] = useState(false);
  const [custOptionForm, setCustOptionForm] = useState<{
    defaultPaidOptions: string;
    defaultProtection: string;
    defaultAttachments: string;
    specialNotes: string;
  }>({ defaultPaidOptions: '', defaultProtection: '', defaultAttachments: '', specialNotes: '' });

  // 🏗️ 현장 전용 옵션 관리 모달 상태
  const [showSiteOptionModal, setShowSiteOptionModal] = useState(false);
  const [editingSiteOption, setEditingSiteOption] = useState<CustomerSite | null>(null);
  const [siteOptionForm, setSiteOptionForm] = useState<{
    paidOptions: string;
    protection: string;
    attachments: string;
    checkedSpecs?: Record<string, boolean>;
  }>({ paidOptions: '', protection: '', attachments: '', checkedSpecs: {} });

  // 🔍 현장별 옵션관리 기등록 현장 참조 검색 및 옵션 복사 상태
  const [siteOptionRefSearch, setSiteOptionRefSearch] = useState('');
  const [selectedRefSiteId, setSelectedRefSiteId] = useState('');

  // 외부 네비게이션 연동
  useEffect(() => {
    if (navigationPayload?.editCustomerId) {
      const targetCust = customers.find(c => c.id === navigationPayload.editCustomerId);
      if (targetCust) {
        setSelectedCustomerId(targetCust.id);
        setEditingCust({ ...targetCust });
        setShowCustModal(true);
      }
      setNavigationPayload(null);
    }
  }, [navigationPayload, customers, setNavigationPayload]);

  // 기본 선택 고객사 보정
  useEffect(() => {
    if (!selectedCustomerId && customers.length > 0) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);


  const activeCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // 🏢 고객사 ID ➔ 고객사 매핑 맵
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    (customers || []).forEach(c => map.set(c.id, c));
    return map;
  }, [customers]);

  // 🗺️ 현장 마스터 ID ➔ 현장 마스터 매핑 맵
  const siteMasterMap = useMemo(() => {
    const map = new Map<string, SiteMaster>();
    (siteMasters || []).forEach(sm => map.set(sm.id, sm));
    return map;
  }, [siteMasters]);

  // 🏗️ 고객사별 현장 개수 매핑 맵 (O(1) 검색)
  const customerSiteCountMap = useMemo(() => {
    const map = new Map<string, number>();
    (sites || []).forEach(s => {
      if (s.customerId) {
        map.set(s.customerId, (map.get(s.customerId) || 0) + 1);
      }
    });
    return map;
  }, [sites]);

  // 👤 고객사별 담당자 개수 매핑 맵 (O(1) 검색)
  const customerContactCountMap = useMemo(() => {
    const map = new Map<string, number>();
    (contacts || []).forEach(c => {
      if (c.customerId) {
        map.set(c.customerId, (map.get(c.customerId) || 0) + 1);
      }
    });
    return map;
  }, [contacts]);

  // 📜 고객사별 내용증명 개수 매핑 맵 (O(1) 검색)
  const customerLegalNoticeCountMap = useMemo(() => {
    const map = new Map<string, number>();
    (legalNoticeLogs || []).forEach(l => {
      if (l.customerId) {
        map.set(l.customerId, (map.get(l.customerId) || 0) + 1);
      }
    });
    return map;
  }, [legalNoticeLogs]);

  // 📋 현장별 활성 계약 및 투입 장비 개수 매핑 맵 (O(1) 검색)
  const siteContractAssetStatsMap = useMemo(() => {
    const contractAssetCountMap = new Map<string, number>();
    (contractAssets || []).forEach(ca => {
      if (ca.contractId && ca.status !== 'RETURNED') {
        contractAssetCountMap.set(ca.contractId, (contractAssetCountMap.get(ca.contractId) || 0) + 1);
      }
    });

    const statsMap = new Map<string, { contractCount: number; assetCount: number }>();
    (contracts || []).forEach(c => {
      if (c.siteId && (c.status === 'ACTIVE' || c.status === 'EXTENDED')) {
        const current = statsMap.get(c.siteId) || { contractCount: 0, assetCount: 0 };
        current.contractCount += 1;
        current.assetCount += (contractAssetCountMap.get(c.id) || 0);
        statsMap.set(c.siteId, current);
      }
    });
    return statsMap;
  }, [contracts, contractAssets]);

  // 🎯 현장별 옵션관리 등록 옵션 그룹 목록 (검색 필터 및 옵션 보유 그룹 상위 정렬)
  const optionReferenceSites = useMemo(() => {
    const matcher = createHangulMatcher(siteOptionRefSearch);
    return (siteMasters || []).filter(s => {
      if (siteOptionRefSearch.trim()) {
        const sName = s.name || '';
        const sOpts = (s.paidOptions || '') + ' ' + (s.protection || '') + ' ' + (s.attachments || '');
        return matcher.testAny([sName, sOpts]);
      }
      return true;
    }).sort((a, b) => {
      const aHasOpts = Boolean(a.paidOptions || (a.protection && a.protection !== 'NONE') || a.attachments || (a.checkedSpecs && Object.keys(a.checkedSpecs).length > 0));
      const bHasOpts = Boolean(b.paidOptions || (b.protection && b.protection !== 'NONE') || b.attachments || (b.checkedSpecs && Object.keys(b.checkedSpecs).length > 0));
      if (aHasOpts && !bHasOpts) return -1;
      if (!aHasOpts && bHasOpts) return 1;
      return (a.name || '').localeCompare(b.name || '', 'ko');
    });
  }, [siteMasters, siteOptionRefSearch]);

  const selectedRefSite = useMemo(() => {
    if (!selectedRefSiteId) return null;
    return (siteMasters || []).find(s => s.id === selectedRefSiteId) || null;
  }, [siteMasters, selectedRefSiteId]);

  const selectedRefCustomer = useMemo(() => {
    if (!selectedRefSite) return null;
    const linkedCustSite = (sites || []).find(s => s.siteMasterId === selectedRefSite.id);
    return customerMap.get(linkedCustSite?.customerId || '') || null;
  }, [sites, customerMap, selectedRefSite]);

  const refCheckedSpecsSummary = useMemo(() => {
    if (!selectedRefSite?.checkedSpecs) return '';
    const activeSpecNames = (standardOptions || [])
      .filter(o => o.category === 'SPEC' && selectedRefSite.checkedSpecs?.[o.id])
      .map(o => o.name);
    return activeSpecNames.length > 0 ? activeSpecNames.join(', ') : '';
  }, [selectedRefSite, standardOptions]);

  const customerContacts = useMemo(() => {
    return contacts
      .filter(cc => cc.customerId === selectedCustomerId)
      .sort((a, b) => {
        const aActive = a.isActive !== false;
        const bActive = b.isActive !== false;
        if (aActive !== bActive) return aActive ? -1 : 1;
        return a.name.localeCompare(b.name, 'ko');
      });
  }, [contacts, selectedCustomerId]);

  const customerSites = useMemo(() => {
    return sites
      .filter(cs => cs.customerId === selectedCustomerId)
      .sort((a, b) => {
        const aActive = a.isActive !== false;
        const bActive = b.isActive !== false;
        if (aActive !== bActive) return aActive ? -1 : 1;
        return a.name.localeCompare(b.name, 'ko');
      });
  }, [sites, selectedCustomerId]);

  const { items: sortedCustomerContacts, requestSort: requestSortContacts, sortConfig: sortConfigContacts } = useSortableData(customerContacts);
  const { items: sortedCustomerSites, requestSort: requestSortSites, sortConfig: sortConfigSites } = useSortableData(customerSites);

  // 📄 사업자등록증 원본 파일 누락 여부 판정 (실제 파일 첨부/등록 여부)
  const isMissingBizCert = (c: Customer) => {
    return !c.businessCertFileUrl || c.businessCertFileUrl.trim() === '';
  };

  // 필수 기본정보 누락 판정 (등록증 파일, 사업자번호, 대표자명, 주소 중 핵심 식별정보 결손 여부)
  const isIncompleteCustomer = (c: Customer) => {
    return isMissingBizCert(c) ||
           !c.bizRegNo || c.bizRegNo.trim() === '' || c.bizRegNo === '미상' ||
           !c.representative || c.representative === '미상' ||
           !c.address || c.address === '미상';
  };

  // 필터링 (초성 칩 필터 및 정규화 가나다 오름차순 정렬 통합)
  const filteredCustomers = useMemo(() => {
    const list = customers.filter(c => {
      const matchesSearch = 
        !searchTerm ||
        matchHangul(c.name, searchTerm) ||
        (c.bizRegNo || '').includes(searchTerm) ||
        matchHangul(c.representative, searchTerm) ||
        (c.repContact || '').includes(searchTerm);

      const matchesChosung = matchesChosungFilter(c.name, chosungFilter);

      const matchesStatus = 
        statusFilter === 'ALL' ? true :
        statusFilter === 'ACTIVE' ? (!isCustomerRestricted(c.transactionStatus) && !c.isClosed) :
        statusFilter === 'RESTRICT_NEW' ? (c.transactionStatus === 'RESTRICT_NEW') :
        statusFilter === 'BLOCKED_ALL' ? isCustomerTotalBlocked(c.transactionStatus) :
        statusFilter === 'BLOCKED' ? isCustomerRestricted(c.transactionStatus) :
        (c.isClosed === true);

      const matchesIncomplete = !showOnlyIncomplete || isMissingBizCert(c);

      return matchesSearch && matchesChosung && matchesStatus && matchesIncomplete;
    });

    return sortCustomersByName(list);
  }, [customers, searchTerm, chosungFilter, statusFilter, showOnlyIncomplete]);

  // 선택된 고객사 목록 스크롤 동기화
  useEffect(() => {
    if (selectedCustomerId) {
      const el = document.getElementById(`customer-item-${selectedCustomerId}`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedCustomerId, filteredCustomers]);

  // KPI 집계
  const kpiStats = useMemo(() => {
    let activeCust = 0;
    let blockedCust = 0;
    let closedCust = 0;
    for (const c of customers) {
      if (c.isClosed) {
        closedCust++;
      } else if (isCustomerRestricted(c.transactionStatus)) {
        blockedCust++;
      } else {
        activeCust++;
      }
    }

    let activeSites = 0;
    for (const s of sites) {
      if (s.isActive !== false) {
        activeSites++;
      }
    }

    return {
      totalCust: customers.length,
      activeCust,
      blockedCust,
      closedCust,
      totalSites: sites.length,
      activeSites,
      totalContacts: contacts.length
    };
  }, [customers, sites, contacts.length]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAllData();
      showToast('최신 고객사 데이터를 동기화하였습니다.');
    } catch (err: any) {
      showErrorModal(`데이터 동기화에 실패했습니다: ${err?.message || String(err)}`, '동기화 오류');
    } finally {
      setRefreshing(false);
    }
  };

  // 엑셀 다운로드 (경영진/개발자는 전체 정보, 일반 직원은 개인정보 마스킹)
  const handleExportAllCustomers = () => {
    const isPrivileged = isPrivilegedPrivacyUser(currentUser);
    const excelData = filteredCustomers.map((c, idx) => ({
      '순번': idx + 1,
      '고객명': c.name,
      '대표자': isPrivileged ? c.representative : maskName(c.representative),
      '업태': c.bizType || '-',
      '종목': c.bizItem || '-',
      '대표 연락처': isPrivileged ? (c.repContact || '-') : maskPhoneNumber(c.repContact),
      '대표 이메일': isPrivileged ? (c.repEmail || '-') : maskEmail(c.repEmail),
      '사업자등록번호': c.bizRegNo || '-',
      '계산서 마감일': c.defaultBillingDay === 0 ? '미지정' : `매월 ${(c.defaultBillingDay || 30) === 31 ? '말일' : `${c.defaultBillingDay || 30}일`}`,
      '계산서 발행조건': c.defaultTaxInvoiceIssueType === 'REVERSE' ? '역발행' : '정발행',
      '명세서 마감일': `매월 ${(c.defaultStatementClosingDay || 25) === 31 ? '말일' : `${c.defaultStatementClosingDay || 25}일`}`,
      '약정 결제조건': getPaymentMethodLabel(c.defaultPaymentMethod),
      '약정 결제일': formatPaymentDueCondition(c.paymentDueMonthOffset, c.paymentDueDay, c.defaultPaymentMethod, c.defaultPaymentTermsNote),
      '약정 결제비고': c.defaultPaymentTermsNote || '-',
      '본사 주소': isPrivileged ? (c.address || '-') : maskAddress(c.address),
      '영업 상태': c.isClosed ? '폐업' : '영업중',
      '거래 상태': getCustomerTransactionStatusLabel(c.transactionStatus),
      '등록 일시': c.createdAt?.substring(0, 10) || '-'
    }));
    exportToExcel(excelData, `고객정보_조회목록_${new Date().toISOString().split('T')[0]}`, '고객사대장');
    logPrivacyAccess(
      'EXCEL_DOWNLOAD',
      'customers',
      `고객사 대장 ${excelData.length}건 엑셀 다운로드 (${isPrivileged ? '경영진/개발자 전체 원본' : '개인정보 마스킹 적용'})`,
      { isMasked: !isPrivileged }
    );
    showToast(`고객사 목록 (${filteredCustomers.length}건) 엑셀이 다운로드되었습니다. (${isPrivileged ? '전체 정보' : '마스킹 적용'})`);
  };

  const handleExportContacts = () => {
    if (!activeCustomer) return;
    const isPrivileged = isPrivilegedPrivacyUser(currentUser);
    const excelData = sortedCustomerContacts.map((cc, idx) => ({
      '순번': idx + 1,
      '고객사명': activeCustomer.name,
      '담당자명': isPrivileged ? cc.name : maskName(cc.name),
      '직급': cc.position || '-',
      '연락처': isPrivileged ? cc.contact : maskPhoneNumber(cc.contact),
      '이메일': isPrivileged ? (cc.email || '-') : maskEmail(cc.email),
      '사용여부': cc.isActive !== false ? '사용' : '미사용',
      '등록 일시': cc.createdAt?.substring(0, 10) || '-'
    }));
    exportToExcel(excelData, `담당자목록_${activeCustomer.name}_${new Date().toISOString().split('T')[0]}`, '담당자리스트');
    logPrivacyAccess(
      'EXCEL_DOWNLOAD',
      'customer_contacts',
      `고객사 [${activeCustomer.name}] 담당자 목록 ${excelData.length}건 엑셀 다운로드 (${isPrivileged ? '경영진/개발자 전체 원본' : '개인정보 마스킹 적용'})`,
      { targetSubjectId: activeCustomer.id, targetSubjectName: activeCustomer.name, isMasked: !isPrivileged }
    );
    showToast(`담당자 목록 (${sortedCustomerContacts.length}건) 엑셀이 다운로드되었습니다. (${isPrivileged ? '전체 정보' : '마스킹 적용'})`);
  };

  const handleExportSites = () => {
    if (!activeCustomer) return;
    const isPrivileged = isPrivilegedPrivacyUser(currentUser);
    const excelData = sortedCustomerSites.map((cs, idx) => {
      const stmtDay = cs.statementClosingDay || activeCustomer.defaultStatementClosingDay || 25;
      const isReverse = ((cs.taxInvoiceIssueType || (cs.checkedSpecs as any)?.__taxInvoiceIssueType || activeCustomer.defaultTaxInvoiceIssueType) === 'REVERSE');
      const rawBillDay = cs.billingDay !== undefined && cs.billingDay !== null ? cs.billingDay : (activeCustomer.defaultBillingDay !== undefined ? activeCustomer.defaultBillingDay : (isReverse ? 0 : 30));
      const payMethod = cs.paymentMethod || (cs.checkedSpecs as any)?.__paymentMethod || activeCustomer.defaultPaymentMethod || 'CASH';
      const payNote = cs.paymentTermsNote !== undefined ? cs.paymentTermsNote : ((cs.checkedSpecs as any)?.__paymentTermsNote ?? activeCustomer.defaultPaymentTermsNote ?? '');
      return {
        '순번': idx + 1,
        '고객사명': activeCustomer.name,
        '현장명': cs.name,
        '명세서 마감일': `당월 ${stmtDay === 31 ? '말일' : `${stmtDay}일`}`,
        '계산서 마감일': rawBillDay === 0 ? '' : `당월 ${rawBillDay === 31 ? '말일' : `${rawBillDay}일`}`,
        '계산서 발행조건': isReverse ? '역발행' : '정발행',
        '약정 결제조건': getPaymentMethodLabel(payMethod),
        '약정 결제일': formatPaymentDueCondition(
          cs.paymentDueMonthOffset !== undefined ? cs.paymentDueMonthOffset : activeCustomer.paymentDueMonthOffset,
          cs.paymentDueDay || activeCustomer.paymentDueDay,
          payMethod,
          payNote
        ),
        '약정 결제비고': payNote || '',
        '현장 주소': isPrivileged ? (cs.address || '-') : maskAddress(cs.address),
        '현장 담당자': (() => {
          const activeContacts = (cs.contacts || []).filter(c => c.isActive !== false);
          if (activeContacts.length > 0) {
            return activeContacts.map(c => {
              const n = isPrivileged ? c.name : maskName(c.name);
              return c.position ? `${n}(${c.position})` : n;
            }).join(', ');
          }
          return isPrivileged ? (cs.contactName || '-') : maskName(cs.contactName);
        })(),
        '연락처': (() => {
          const activeContacts = (cs.contacts || []).filter(c => c.isActive !== false);
          if (activeContacts.length > 0) {
            return activeContacts.map(c => isPrivileged ? c.contact : maskPhoneNumber(c.contact)).join(', ');
          }
          return isPrivileged ? (cs.contact || '-') : maskPhoneNumber(cs.contact);
        })(),
        '유상옵션': normalizeOptionString(cs.paidOptions) || normalizeOptionString(activeCustomer.defaultPaidOptions) || '-',
        '무상옵션': normalizeOptionString(cs.protection) || normalizeOptionString(activeCustomer.defaultProtection) || '-',
        '사용여부': cs.isActive !== false ? '가동중' : '완공/종료',
        '등록 일시': cs.createdAt?.substring(0, 10) || '-'
      };
    });
    exportToExcel(excelData, `현장목록_${activeCustomer.name}_${new Date().toISOString().split('T')[0]}`, '현장리스트');
    logPrivacyAccess(
      'EXCEL_DOWNLOAD',
      'customer_sites',
      `고객사 [${activeCustomer.name}] 현장 목록 ${excelData.length}건 엑셀 다운로드 (${isPrivileged ? '경영진/개발자 전체 원본' : '개인정보 마스킹 적용'})`,
      { targetSubjectId: activeCustomer.id, targetSubjectName: activeCustomer.name, isMasked: !isPrivileged }
    );
    showToast(`현장 목록 (${customerSites.length}건) 엑셀이 다운로드되었습니다. (${isPrivileged ? '전체 정보' : '마스킹 적용'})`);
  };

  const handleExportAllSitesClosingSchedule = () => {
    const custMap = new Map(customers.map(c => [c.id, c]));
    const sortedAllSites = [...(sites || [])].sort((a, b) => {
      const custA = custMap.get(a.customerId || '')?.name || '';
      const custB = custMap.get(b.customerId || '')?.name || '';
      const cCmp = custA.localeCompare(custB, 'ko');
      if (cCmp !== 0) return cCmp;
      return (a.name || '').localeCompare(b.name || '', 'ko');
    });
    const excelData = sortedAllSites.map((cs, idx) => {
      const cust = custMap.get(cs.customerId || '');
      const stmtDay = cs.statementClosingDay || cust?.defaultStatementClosingDay || 25;
      const isReverse = ((cs.taxInvoiceIssueType || (cs.checkedSpecs as any)?.__taxInvoiceIssueType || cust?.defaultTaxInvoiceIssueType) === 'REVERSE');
      const rawBillDay = cs.billingDay !== undefined && cs.billingDay !== null ? cs.billingDay : (cust?.defaultBillingDay !== undefined ? cust.defaultBillingDay : (isReverse ? 0 : 30));
      const payMethod = cs.paymentMethod || (cs.checkedSpecs as any)?.__paymentMethod || cust?.defaultPaymentMethod || 'CASH';
      const payNote = cs.paymentTermsNote !== undefined ? cs.paymentTermsNote : ((cs.checkedSpecs as any)?.__paymentTermsNote ?? cust?.defaultPaymentTermsNote ?? '');
      const closingContact = (cs.contacts || []).find(c => c.isActive !== false && c.contactType === 'CLOSING');
      return {
        '순번': idx + 1,
        '사업자등록번호': cust?.bizRegNo || '-',
        '고객사명': cust?.name || '-',
        '고객현장명': cs.name || '-',
        '명세서 마감일': `당월 ${stmtDay === 31 ? '말일' : `${stmtDay}일`}`,
        '계산서 마감일': rawBillDay === 0 ? '' : `당월 ${rawBillDay === 31 ? '말일' : `${rawBillDay}일`}`,
        '약정 결제일': formatPaymentDueCondition(
          cs.paymentDueMonthOffset !== undefined ? cs.paymentDueMonthOffset : cust?.paymentDueMonthOffset,
          cs.paymentDueDay || cust?.paymentDueDay,
          payMethod,
          payNote
        ),
        '약정 결제조건': getPaymentMethodLabel(payMethod),
        '약정 결제비고': payNote || '',
        '계산서발행': isReverse ? '역발행' : '정발행',
        '현장 상태': cs.isActive !== false ? '가동중' : '완공/종료',
        '마감담당자': closingContact?.name || cs.billingContactName || cs.contactName || '-',
        '마감담당 연락처': closingContact?.contact || cs.billingContactPhone || cs.contact || '-',
        '명세서/계산서 이메일': closingContact?.email || cs.billingContactEmail || cs.email || cust?.repEmail || '-',
        '현장 주소': cs.address || '-'
      };
    });
    exportToExcel(excelData, `전체고객_고객현장별_명세서_계산서_마감일_${new Date().toISOString().split('T')[0]}`, '고객현장별마감일');
    showToast(`전체 고객현장 마감일 현황 (${excelData.length}개 현장) 엑셀이 다운로드되었습니다.`);
  };

  const handleExportAllCustomerContacts = () => {
    const sortedCusts = sortCustomersByName([...customers]);
    const rows: Record<string, any>[] = [];
    let seq = 1;

    for (const cust of sortedCusts) {
      const cName = cust.name || '-';
      const cBizNo = cust.bizRegNo || '-';
      const cCeo = cust.representative || '-';
      const cSites = (sites || [])
        .filter(st => st.customerId === cust.id)
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ko'));
      const cContacts = (contacts || []).filter(cc => cc.customerId === cust.id);
      let pushedForCust = false;

      for (const st of cSites) {
        const sName = st.name || '-';
        const sAddr = st.address || '-';
        const stmtDay = st.statementClosingDay || cust.defaultStatementClosingDay || 25;
        const billDay = st.billingDay || cust.defaultBillingDay || 30;
        const stmtStr = `매월 ${stmtDay === 31 ? '말일' : `${stmtDay}일`}`;
        const billStr = `매월 ${billDay === 31 ? '말일' : `${billDay}일`}`;
        const arr = Array.isArray(st.contacts) ? st.contacts : [];

        if (arr.length > 0) {
          for (const sc of arr) {
            if (!sc) continue;
            if (!sc.name && !sc.contact && !sc.email) continue;
            const typeLabel =
              sc.contactType === 'EQUIPMENT' ? '장비담당자' :
              sc.contactType === 'CLOSING' ? '마감담당자' :
              sc.contactType === 'SAFETY' ? '안전담당자' : '현장담당자';
            rows.push({
              '순번': seq++,
              '고객사명': cName,
              '사업자등록번호': cBizNo,
              '대표자': cCeo,
              '고객현장명': sName,
              '현장주소': sAddr,
              '담당구분': typeLabel,
              '대표지정': sc.isPrimary ? '대표' : '',
              '담당자 성명': sc.name || '-',
              '직책/역할': sc.position || '-',
              '전화번호(휴대폰)': sc.contact || '-',
              '이메일주소': sc.email || '-',
              '명세서 마감일': stmtStr,
              '계산서 마감일': billStr,
              '사용상태': sc.isActive !== false ? '사용중' : '미사용'
            });
            pushedForCust = true;
          }
        } else if (st.contactName || st.contact || st.email) {
          rows.push({
            '순번': seq++,
            '고객사명': cName,
            '사업자등록번호': cBizNo,
            '대표자': cCeo,
            '고객현장명': sName,
            '현장주소': sAddr,
            '담당구분': '장비담당자',
            '대표지정': '대표',
            '담당자 성명': st.contactName || '-',
            '직책/역할': '-',
            '전화번호(휴대폰)': st.contact || '-',
            '이메일주소': st.email || '-',
            '명세서 마감일': stmtStr,
            '계산서 마감일': billStr,
            '사용상태': st.isActive !== false ? '사용중' : '완공/종료'
          });
          pushedForCust = true;
        }
      }

      const cleanContactPersonName = (str?: string) =>
        String(str || '')
          .replace(/\s+/g, '')
          .replace(/(부장님|차장님|과장님|대리님|팀장님|소장님|사원님|주임님|대표님|상무님|이사님|책임님|선임님|관리부장|공무차장|공무과장|안전과장|현장담당자|현장담당|마감담당자|마감담당|부장|차장|과장|대리|팀장|소장|사원|주임|대표|상무|이사|책임|선임|프로|실장|계장|반장|리더|매니저|공무|기사|직원|담당자|안전|양중|공사|공부|님)/g, '');

      for (const cc of cContacts) {
        if (!cc.name && !cc.contact && !cc.email) continue;
        const dup = rows.some(
          r =>
            r['고객사명'] === cName &&
            (cleanContactPersonName(r['담당자 성명']) === cleanContactPersonName(cc.name || '-') ||
              (cc.contact && r['전화번호(휴대폰)'] === cc.contact))
        );
        if (dup) continue;
        rows.push({
          '순번': seq++,
          '고객사명': cName,
          '사업자등록번호': cBizNo,
          '대표자': cCeo,
          '고객현장명': '본사/공통',
          '현장주소': cust.address || '-',
          '담당구분': '고객사담당자',
          '대표지정': (cc as any).isPrimary ? '대표' : '',
          '담당자 성명': cc.name || '-',
          '직책/역할': cc.position || '-',
          '전화번호(휴대폰)': cc.contact || '-',
          '이메일주소': cc.email || '-',
          '명세서 마감일': `매월 ${(cust.defaultStatementClosingDay || 25) === 31 ? '말일' : `${cust.defaultStatementClosingDay || 25}일`}`,
          '계산서 마감일': `매월 ${(cust.defaultBillingDay || 30) === 31 ? '말일' : `${cust.defaultBillingDay || 30}일`}`,
          '사용상태': cc.isActive !== false ? '사용중' : '미사용'
        });
        pushedForCust = true;
      }

      if (!pushedForCust && (cust.repContact || cust.repEmail)) {
        const repC = (cust.repContact || '').trim();
        const isPhone = /[0-9]{2,4}-[0-9]{3,4}-[0-9]{4}/.test(repC);
        rows.push({
          '순번': seq++,
          '고객사명': cName,
          '사업자등록번호': cBizNo,
          '대표자': cCeo,
          '고객현장명': '본사/기본',
          '현장주소': cust.address || '-',
          '담당구분': '기본담당',
          '대표지정': '대표',
          '담당자 성명': !isPhone && repC ? repC : cCeo,
          '직책/역할': '-',
          '전화번호(휴대폰)': isPhone ? repC : '-',
          '이메일주소': cust.repEmail || '-',
          '명세서 마감일': `매월 ${(cust.defaultStatementClosingDay || 25) === 31 ? '말일' : `${cust.defaultStatementClosingDay || 25}일`}`,
          '계산서 마감일': `매월 ${(cust.defaultBillingDay || 30) === 31 ? '말일' : `${cust.defaultBillingDay || 30}일`}`,
          '사용상태': cust.isClosed ? '폐업' : '사용중'
        });
      }
    }

    exportToExcel(rows, `등록된_모든_고객_담당자_목록_${new Date().toISOString().split('T')[0]}`, '전체고객담당자목록');
    showToast(`등록된 전체 고객 담당자 (${rows.length}명) 엑셀이 다운로드되었습니다.`);
  };

  // 고객사 등록/수정 핸들러
  const handleOpenAddCust = () => {
    setEditingCust({ 
      name: '', bizRegNo: '', isClosed: false, address: '', 
      representative: '', repContact: '', repEmail: '', 
      defaultBillingDay: 30, defaultStatementClosingDay: 25, paymentDueMonthOffset: 1, paymentDueDay: 25,
      defaultTaxInvoiceIssueType: 'FORWARD',
      defaultPaymentMethod: 'CASH',
      defaultPaymentTermsNote: '',
      transactionStatus: 'ALLOWED'
    });
    setShowCustModal(true);
  };

  const handleOpenEditCust = (cust: Customer) => {
    setEditingCust({
      defaultBillingDay: cust.defaultBillingDay !== undefined && cust.defaultBillingDay !== null ? cust.defaultBillingDay : 30,
      defaultStatementClosingDay: cust.defaultStatementClosingDay || 25,
      paymentDueMonthOffset: cust.paymentDueMonthOffset !== undefined ? cust.paymentDueMonthOffset : 1,
      paymentDueDay: cust.paymentDueDay || 25,
      defaultTaxInvoiceIssueType: cust.defaultTaxInvoiceIssueType || ((cust.defaultCheckedSpecs as any)?.__taxInvoiceIssueType === 'REVERSE' ? 'REVERSE' : 'FORWARD'),
      defaultPaymentMethod: cust.defaultPaymentMethod || (cust.defaultCheckedSpecs as any)?.__paymentMethod || 'CASH',
      defaultPaymentTermsNote: cust.defaultPaymentTermsNote !== undefined ? cust.defaultPaymentTermsNote : ((cust.defaultCheckedSpecs as any)?.__paymentTermsNote || ''),
      ...cust
    });
    setShowCustModal(true);
  };

  const { createApprovalRequest, fetchRuleForEvent } = useApproval();

  const handleSaveCustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCust || !editingCust.name || isSubmittingCust) return;

    try {
      setIsSubmittingCust(true);
      const isNew = !editingCust.id;
      const resolvedPayMethod: PaymentMethodType = (editingCust.defaultPaymentMethod === 'BILL' || editingCust.defaultPaymentMethod === 'BOND') ? editingCust.defaultPaymentMethod : 'CASH';
      const resolvedPayNote = (editingCust.defaultPaymentTermsNote || '').trim();
      const rawBillingDay = editingCust.defaultBillingDay !== undefined && editingCust.defaultBillingDay !== null ? Number(editingCust.defaultBillingDay) : 30;
      const sanitizedCust = {
        ...editingCust,
        defaultBillingDay: rawBillingDay === 0 ? 0 : Math.min(31, Math.max(1, rawBillingDay || 30)),
        defaultStatementClosingDay: Math.min(31, Math.max(1, Number(editingCust.defaultStatementClosingDay) || 25)),
        paymentDueDay: Math.min(31, Math.max(1, Number(editingCust.paymentDueDay) || 25)),
        paymentDueMonthOffset: Math.max(0, Number(editingCust.paymentDueMonthOffset) || 0),
        defaultTaxInvoiceIssueType: editingCust.defaultTaxInvoiceIssueType === 'REVERSE' ? 'REVERSE' : 'FORWARD',
        defaultPaymentMethod: resolvedPayMethod,
        defaultPaymentTermsNote: resolvedPayNote,
        defaultCheckedSpecs: {
          ...(editingCust.defaultCheckedSpecs || {}),
          __taxInvoiceIssueType: editingCust.defaultTaxInvoiceIssueType === 'REVERSE' ? 'REVERSE' : 'FORWARD',
          __paymentMethod: resolvedPayMethod,
          __paymentTermsNote: resolvedPayNote
        }
      };
      const saved = await saveCustomer(sanitizedCust as Omit<Customer, 'id' | 'createdAt'>);
      
      // 결재선(RWTT 용): 신규 고객 등록 시 CUSTOMER_REGISTRATION 결재 태우기
      if (isNew) {
        const { rule } = await fetchRuleForEvent('CUSTOMER_REGISTRATION');
        if (rule) {
          const validOriginatorId = (currentUser?.id && !['sys-admin', 'usr-admin'].includes(currentUser.id) && (users || []).some((u: any) => u && u.id === currentUser.id))
            ? currentUser.id
            : ((users || []).find((u: any) => u && u.id === 'u-1')?.id || (users || [])[0]?.id || 'u-1');
          await createApprovalRequest(
            rule.id!,
            validOriginatorId,
            saved.id!,
            'customers',
            rule.required_tier // 기본 결재선 티어
          );
        }
      }

      showToast(`고객사 [${saved.name}] 정보가 저장되었습니다.${isNew ? ' (결재 상신 완료)' : ''}`);
      setShowCustModal(false);
      setEditingCust(null);
      setSelectedCustomerId(saved.id);
      setSearchTerm(saved.name);
      setStatusFilter('ALL');
      setShowOnlyIncomplete(false);
      await refreshAllData();
    } catch (err: any) {
      showErrorModal(`고객 정보 저장 실패: ${err?.message || err}`, '고객 정보 저장 오류');
    } finally {
      setIsSubmittingCust(false);
    }
  };

  // 담당자 등록/수정
  const handleOpenAddContact = () => {
    if (!selectedCustomerId) return;
    setEditingContact({ customerId: selectedCustomerId, name: '', position: '', contact: '', email: '', isActive: true });
    setShowContactModal(true);
  };

  const handleOpenEditContact = (cc: CustomerContact) => {
    setEditingContact(cc);
    setShowContactModal(true);
  };

  const handleSaveContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !editingContact.name || !editingContact.customerId) return;

    try {
      await saveContact(editingContact as Omit<CustomerContact, 'id' | 'createdAt'>);
      showToast(`담당자 [${editingContact.name}] 정보가 저장되었습니다.`);
      setShowContactModal(false);
      setEditingContact(null);
      await refreshAllData();
    } catch (err: any) {
      showErrorModal(`담당자 저장 실패: ${err?.message || err}`, '담당자 저장 오류');
    }
  };

  const handleDeleteCustomer = async (custId: string, custName: string) => {
    // 1. 사전 무결성 검사: 유지중인 계약이나 보호 대상 고객 현장이 존재하면 입력 프롬프트 전에 즉시 차단 및 안내 모달 출력
    const custSites = (sites || []).filter(s => s.customerId === custId);
    const custSiteIds = new Set(custSites.map(s => s.id));

    const custContracts = (contracts || []).filter(c =>
      c.customerId === custId ||
      (c.siteId && custSiteIds.has(c.siteId))
    );
    const lockedSites = custSites.filter(s =>
      (contracts || []).some(c => c.siteId === s.id) ||
      (assets || []).some((a: any) => a.currentSiteId === s.id)
    );
    const custAssets = (assets || []).filter((a: any) =>
      a.currentCustomerId === custId ||
      (a.currentSiteId && custSiteIds.has(a.currentSiteId))
    );
    const custBillings = (billings || []).filter((b: any) => b.customerId === custId);
    const custReceivables = (receivables || []).filter((r: any) => r.customerId === custId);

    if (custContracts.length > 0 || lockedSites.length > 0 || custAssets.length > 0 || custBillings.length > 0 || custReceivables.length > 0) {
      // deleteCustomer 내부의 표준 안내 모달 즉시 호출
      await deleteCustomer(custId);
      return;
    }

    // 2. 연결된 계약/청구/장비가 전혀 없는 경우에만 삭제 확인 프롬프트 진행
    const input = window.prompt(`고객사를 삭제하시려면 아래에 정확히 입력해주세요:\n"${custName} 삭제"`);
    if (input !== `${custName} 삭제`) {
      if (input !== null) {
        showToast('입력한 텍스트가 일치하지 않아 삭제가 취소되었습니다.', 'error');
      }
      return;
    }

    try {
      const deleted = await deleteCustomer(custId);
      if (!deleted) return;

      showToast(`고객사 [${custName}] 데이터가 삭제되었습니다.`);
      setShowCustModal(false);

      if (selectedCustomerId === custId) {
        setSelectedCustomerId(null);
      }
      await refreshAllData();
    } catch (err: any) {
      if (err?.code === '23503') {
        showErrorModal('이 고객사와 연결된 하위 데이터(현장, 계약, 청구 등)가 존재하여 삭제할 수 없습니다.', '고객사 삭제 불가');
      } else {
        showErrorModal(`고객사 삭제 실패: ${err?.message || err}`, '고객사 삭제 오류');
      }
    }
  };

  const handleDeleteContact = async (contactId: string, contactName: string) => {
    if (!window.confirm(`정말로 담당자 [${contactName}] 정보를 삭제하시겠습니까?`)) return;
    try {
      await deleteContact(contactId);
      showToast(`담당자 [${contactName}] 정보가 삭제되었습니다.`);
      setShowContactModal(false);
      setEditingContact(null);
      await refreshAllData();
    } catch (err: any) {
      showErrorModal(`담당자 삭제 실패: ${err?.message || err}`, '담당자 삭제 오류');
    }
  };

  // 👥 현장 등록/수정 및 다중 담당자(동시 2인 이상) 핸들러
  const handleOpenAddSite = () => {
    if (!selectedCustomerId) return;
    const parentCust = customers.find(c => c.id === selectedCustomerId);
    
    // 👥 3대 담당자 기본 슬롯 (장비담당자 / 마감담당자 / 안전담당자)
    const initialContacts: SiteContactPerson[] = [
      {
        id: 'SC-EQ-' + Date.now(),
        contactType: 'EQUIPMENT',
        name: '',
        position: '현장소장',
        contact: '',
        email: '',
        isPrimary: true,
        isActive: true,
        memo: ''
      },
      {
        id: 'SC-CL-' + (Date.now() + 1),
        contactType: 'CLOSING',
        name: '',
        position: '공무과장',
        contact: '',
        email: '',
        isPrimary: false,
        isActive: true,
        memo: ''
      },
      {
        id: 'SC-SF-' + (Date.now() + 2),
        contactType: 'SAFETY',
        name: '',
        position: '안전관리자',
        contact: '',
        email: '',
        isPrimary: false,
        isActive: true,
        memo: ''
      }
    ];

    setEditingSite({
      customerId: selectedCustomerId,
      name: '',
      address: '',
      isActive: true,
      siteMasterId: null,
      contactName: '',
      contact: '',
      email: '',
      contacts: initialContacts,
      statementClosingDay: parentCust?.defaultStatementClosingDay || 25,
      billingDay: parentCust?.defaultBillingDay !== undefined && parentCust?.defaultBillingDay !== null ? parentCust.defaultBillingDay : (parentCust?.defaultTaxInvoiceIssueType === 'REVERSE' ? 0 : 30),
      paymentDueMonthOffset: parentCust?.paymentDueMonthOffset ?? 1,
      paymentDueDay: parentCust?.paymentDueDay || 25,
      paymentMethod: parentCust?.defaultPaymentMethod || (parentCust?.defaultCheckedSpecs as any)?.__paymentMethod || 'CASH',
      paymentTermsNote: parentCust?.defaultPaymentTermsNote ?? ((parentCust?.defaultCheckedSpecs as any)?.__paymentTermsNote || ''),
      freightBillingStandard: parentCust?.defaultFreightBillingStandard || '3/5',
      taxInvoiceIssueType: parentCust?.defaultTaxInvoiceIssueType || 'FORWARD',
      paidOptions: parentCust?.defaultPaidOptions || '',
      protection: parentCust?.defaultProtection || '',
      attachments: parentCust?.defaultAttachments || '',
      checkedSpecs: parentCust?.defaultCheckedSpecs ? { ...parentCust.defaultCheckedSpecs } : {}
    });
    setShowSiteSpecs(false);
    setSiteOptionRefSearch('');
    setSelectedRefSiteId('');
    setShowSiteModal(true);
  };

  const handleOpenEditSite = (cs: CustomerSite) => {

    let contactsList: SiteContactPerson[] = [];

    if (cs.contacts && Array.isArray(cs.contacts) && cs.contacts.length > 0) {
      contactsList = cs.contacts.map((c, idx) => {
        let deducedType: SiteContactType = c.contactType || 'EQUIPMENT';
        if (!c.contactType) {
          const pos = (c.position || '').toLowerCase();
          const name = (c.name || '').toLowerCase();
          if (pos.includes('안전') || name.includes('안전')) deducedType = 'SAFETY';
          else if (pos.includes('공무') || pos.includes('마감') || pos.includes('정산') || pos.includes('회계') || pos.includes('경리')) deducedType = 'CLOSING';
          else if (idx === 0) deducedType = 'EQUIPMENT';
          else if (idx === 1) deducedType = 'CLOSING';
          else if (idx === 2) deducedType = 'SAFETY';
        }
        return {
          ...c,
          id: c.id || `SC-${idx}-${Date.now()}`,
          contactType: deducedType,
          isPrimary: c.isPrimary !== undefined ? c.isPrimary : (idx === 0 || deducedType === 'EQUIPMENT'),
          isActive: c.isActive !== false
        };
      });

      // 3대 담당자 중 누락된 유형이 있다면 보완하여 상시 관리 가능하도록 준비
      const typesPresent = new Set(contactsList.map(c => c.contactType));
      if (!typesPresent.has('EQUIPMENT')) {
        contactsList.unshift({
          id: 'SC-EQ-' + Date.now(),
          contactType: 'EQUIPMENT',
          name: cs.contactName || '',
          position: '현장소장',
          contact: cs.contact || '',
          email: cs.email || '',
          isPrimary: true,
          isActive: true
        });
      }
      if (!typesPresent.has('CLOSING')) {
        contactsList.push({
          id: 'SC-CL-' + (Date.now() + 1),
          contactType: 'CLOSING',
          name: cs.billingContactName || '',
          position: '공무과장',
          contact: cs.billingContactPhone || '',
          email: cs.billingContactEmail || '',
          isPrimary: false,
          isActive: Boolean(cs.billingContactName || cs.billingContactPhone)
        });
      }
      if (!typesPresent.has('SAFETY')) {
        contactsList.push({
          id: 'SC-SF-' + (Date.now() + 2),
          contactType: 'SAFETY',
          name: cs.safetyContactName || '',
          position: '안전관리자',
          contact: cs.safetyContactPhone || '',
          email: cs.safetyContactEmail || '',
          isPrimary: false,
          isActive: Boolean(cs.safetyContactName || cs.safetyContactPhone)
        });
      }
    } else {
      // 기존 플랫 필드(contactName, billingContactName, safetyContactName)로부터 3대 담당자 슬롯 복원
      contactsList = [
        {
          id: 'SC-EQ-' + Date.now(),
          contactType: 'EQUIPMENT',
          name: cs.contactName || '',
          position: '현장소장',
          contact: cs.contact || '',
          email: cs.email || '',
          isPrimary: true,
          isActive: true
        },
        {
          id: 'SC-CL-' + (Date.now() + 1),
          contactType: 'CLOSING',
          name: cs.billingContactName || '',
          position: '공무과장',
          contact: cs.billingContactPhone || '',
          email: cs.billingContactEmail || '',
          isPrimary: false,
          isActive: Boolean(cs.billingContactName || cs.billingContactPhone)
        },
        {
          id: 'SC-SF-' + (Date.now() + 2),
          contactType: 'SAFETY',
          name: cs.safetyContactName || '',
          position: '안전관리자',
          contact: cs.safetyContactPhone || '',
          email: cs.safetyContactEmail || '',
          isPrimary: false,
          isActive: Boolean(cs.safetyContactName || cs.safetyContactPhone)
        }
      ];
    }

    const parentCust = customers.find(c => c.id === (cs.customerId || ''));
    const resolvedTaxIssue = cs.taxInvoiceIssueType || (cs.checkedSpecs as any)?.__taxInvoiceIssueType || parentCust?.defaultTaxInvoiceIssueType || 'FORWARD';
    setEditingSite({
      ...cs,
      isActive: cs.isActive !== false,
      paidOptions: normalizeOptionString(cs.paidOptions),
      protection: normalizeOptionString(cs.protection),
      attachments: normalizeOptionString(cs.attachments || (cs.checkedSpecs as any)?.__attachments),
      checkedSpecs: cs.checkedSpecs ? { ...cs.checkedSpecs } : {},
      statementClosingDay: cs.statementClosingDay || parentCust?.defaultStatementClosingDay || 25,
      billingDay: cs.billingDay !== undefined && cs.billingDay !== null ? cs.billingDay : (parentCust?.defaultBillingDay !== undefined && parentCust?.defaultBillingDay !== null ? parentCust.defaultBillingDay : (resolvedTaxIssue === 'REVERSE' ? 0 : 30)),
      paymentDueMonthOffset: cs.paymentDueMonthOffset !== undefined ? cs.paymentDueMonthOffset : (parentCust?.paymentDueMonthOffset ?? 1),
      paymentDueDay: cs.paymentDueDay || parentCust?.paymentDueDay || 25,
      paymentMethod: cs.paymentMethod || (cs.checkedSpecs as any)?.__paymentMethod || parentCust?.defaultPaymentMethod || (parentCust?.defaultCheckedSpecs as any)?.__paymentMethod || 'CASH',
      paymentTermsNote: cs.paymentTermsNote !== undefined ? cs.paymentTermsNote : ((cs.checkedSpecs as any)?.__paymentTermsNote ?? parentCust?.defaultPaymentTermsNote ?? ((parentCust?.defaultCheckedSpecs as any)?.__paymentTermsNote || '')),
      freightBillingStandard: cs.freightBillingStandard || (cs.checkedSpecs as any)?.__freightBillingStandard || parentCust?.defaultFreightBillingStandard || '3/5',
      taxInvoiceIssueType: resolvedTaxIssue,
      contacts: contactsList
    });
    setShowSiteSpecs(false);
    setSiteOptionRefSearch('');
    setSelectedRefSiteId(cs.siteMasterId || '');
    setShowSiteModal(true);
  };

  const handleAddSiteContact = (type: SiteContactType = 'EQUIPMENT') => {
    if (!editingSite) return;
    const currentList = editingSite.contacts || [];
    const cfg = SITE_CONTACT_TYPE_CONFIG[type] || SITE_CONTACT_TYPE_CONFIG.EQUIPMENT;
    const newContact: SiteContactPerson = {
      id: 'SC-' + type.slice(0, 2) + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      contactType: type,
      name: '',
      position: cfg.defaultPosition,
      contact: '',
      email: '',
      isPrimary: currentList.length === 0,
      isActive: true,
      memo: ''
    };
    setEditingSite({
      ...editingSite,
      contacts: [...currentList, newContact]
    });
  };

  const handleUpdateSiteContact = (index: number, field: keyof SiteContactPerson, value: any) => {
    if (!editingSite || !editingSite.contacts) return;
    const updated = [...editingSite.contacts];
    updated[index] = { ...updated[index], [field]: value };
    setEditingSite({ ...editingSite, contacts: updated });
  };

  const handleSetPrimarySiteContact = (index: number) => {
    if (!editingSite || !editingSite.contacts) return;
    const updated = editingSite.contacts.map((c, i) => ({
      ...c,
      isPrimary: i === index
    }));
    setEditingSite({ ...editingSite, contacts: updated });
  };

  const handleToggleSiteContactActive = (index: number) => {
    if (!editingSite || !editingSite.contacts) return;
    const updated = [...editingSite.contacts];
    updated[index] = {
      ...updated[index],
      isActive: updated[index].isActive === false ? true : false
    };
    setEditingSite({ ...editingSite, contacts: updated });
  };

  const handleRemoveSiteContact = (index: number) => {
    if (!editingSite || !editingSite.contacts) return;
    const updated = editingSite.contacts.filter((_, i) => i !== index);
    if (updated.length > 0 && !updated.some(c => c.isPrimary)) {
      updated[0].isPrimary = true;
    }
    setEditingSite({ ...editingSite, contacts: updated });
  };

  const handleSaveSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSite || !editingSite.name?.trim() || !editingSite.customerId) return;

    const rawName = editingSite.name.trim();
    const normalizedName = rawName.replace(/\s+/g, '');
    const duplicateInSameCustomer = (sites || []).find(s => 
      s.id !== editingSite.id && 
      s.customerId === editingSite.customerId &&
      (s.name || '').replace(/\s+/g, '') === normalizedName
    );
    if (duplicateInSameCustomer) {
      showErrorModal(`현재 고객사에 동일한 현장명이 이미 등록되어 있습니다.\n\n입력: [${rawName}]\n기존: [${duplicateInSameCustomer.name}]`);
      return;
    }

    try {
      // 👥 3대 담당자 (장비 / 마감 / 안전) 정규화 및 플랫 필드 동기화
      const rawContacts = editingSite.contacts || [];
      // 입력된 데이터가 있거나 활성화된 항목 필터
      const validContacts = rawContacts.filter(c => 
        (c.name && c.name.trim() !== '') || 
        (c.contact && c.contact.trim() !== '') || 
        (c.email && c.email.trim() !== '')
      );

      // 유형별 대표/활성 담당자 추출
      const eqContact = validContacts.find(c => c.contactType === 'EQUIPMENT' && c.isActive !== false)
        || validContacts.find(c => c.contactType === 'EQUIPMENT')
        || validContacts.find(c => c.isPrimary)
        || validContacts[0];

      const closingContact = validContacts.find(c => c.contactType === 'CLOSING' && c.isActive !== false)
        || validContacts.find(c => c.contactType === 'CLOSING');

      const safetyContact = validContacts.find(c => c.contactType === 'SAFETY' && c.isActive !== false)
        || validContacts.find(c => c.contactType === 'SAFETY');

      const cleanAddr = sanitizeSiteAddressInput(editingSite.address);
      const resolvedPayMethod: PaymentMethodType = (editingSite.paymentMethod === 'BILL' || editingSite.paymentMethod === 'BOND') ? editingSite.paymentMethod : 'CASH';
      const resolvedPayNote = (editingSite.paymentTermsNote || '').trim();

      const siteToSave: CustomerSite = {
        ...editingSite,
        name: rawName,
        address: cleanAddr,
        isActive: editingSite.isActive !== false,
        siteMasterId: editingSite.siteMasterId || null,
        paidOptions: normalizeOptionString(editingSite.paidOptions),
        protection: normalizeOptionString(editingSite.protection),
        attachments: normalizeOptionString(editingSite.attachments),
        paymentMethod: resolvedPayMethod,
        paymentTermsNote: resolvedPayNote,
        freightBillingStandard: editingSite.freightBillingStandard === '2/4' ? '2/4' : '3/5',
        taxInvoiceIssueType: editingSite.taxInvoiceIssueType === 'REVERSE' ? 'REVERSE' : 'FORWARD',
        checkedSpecs: {
          ...(editingSite.checkedSpecs || {}),
          __freightBillingStandard: editingSite.freightBillingStandard === '2/4' ? '2/4' : '3/5',
          __taxInvoiceIssueType: editingSite.taxInvoiceIssueType === 'REVERSE' ? 'REVERSE' : 'FORWARD',
          __paymentMethod: resolvedPayMethod,
          __paymentTermsNote: resolvedPayNote
        },
        // 1. 장비담당자 (하위호환 플랫 필드)
        contactName: eqContact?.name || editingSite.contactName || '',
        contact: eqContact?.contact || editingSite.contact || '',
        email: eqContact?.email || editingSite.email || '',
        // 2. 마감담당자 (거래명세서 / 계산서 수신인)
        billingContactName: closingContact?.name || '',
        billingContactPhone: closingContact?.contact || '',
        billingContactEmail: closingContact?.email || '',
        // 3. 안전담당자 (안전관리 / 점검결과 수신인)
        safetyContactName: safetyContact?.name || '',
        safetyContactPhone: safetyContact?.contact || '',
        safetyContactEmail: safetyContact?.email || '',
        // 4. 전체 담당자 목록 저장
        contacts: validContacts.length > 0 ? validContacts : undefined
      } as CustomerSite;

      await saveSite(siteToSave as Omit<CustomerSite, 'id' | 'createdAt'>);
      showToast(`현장 [${rawName}] 정보가 저장되었습니다.`);
      setShowSiteModal(false);
      setEditingSite(null);
      await refreshAllData();
    } catch (err: any) {
      showErrorModal(`현장 저장 실패: ${err?.message || err}`, '현장 저장 오류');
    }
  };

  const handleToggleCustomerSiteStatus = async (cs: CustomerSite) => {
    const nextActive = cs.isActive === false ? true : false;
    try {
      await saveSite({
        ...cs,
        isActive: nextActive
      });
      await refreshAllData();
      showToast(`현장 [${cs.name}] 상태가 '${nextActive ? '가동중' : '완공/종료'}'(으)로 변경되었습니다.`);
    } catch (err: any) {
      showErrorModal(`현장 상태 변경 실패: ${err?.message || String(err)}`, '상태 변경 오류');
    }
  };

  const handleDeleteSite = async (siteId: string, siteName: string) => {
    const linkedContracts = (contracts || []).filter(c => c.siteId === siteId);
    const linkedAssets = (assets || []).filter((a: any) => a.currentSiteId === siteId);

    // 연결된 계약이나 장비가 있으면 확인창 없이 즉시 차단 안내 모달 표시
    if (linkedContracts.length > 0 || linkedAssets.length > 0) {
      await deleteSite(siteId);
      return;
    }

    const targetSiteObj = (sites || []).find(s => s.id === siteId);
    const createdStr = formatDateTimeKst(targetSiteObj?.createdAt);
    const updatedStr = formatDateTimeKst((targetSiteObj as any)?.updatedAt || targetSiteObj?.createdAt);
    if (!window.confirm(`정말로 현장 [${siteName}] 정보를 삭제하시겠습니까?\n\n• 현장코드: ${siteId}\n• 입력일시: ${createdStr}\n• 최종수정: ${updatedStr}`)) return;

    try {
      const deleted = await deleteSite(siteId);
      if (!deleted) return;
      showToast(`현장 [${siteName}] 정보가 삭제되었습니다.`);
      setShowSiteModal(false);
      setEditingSite(null);
      await refreshAllData();
    } catch (err: any) {
      showErrorModal(`현장 삭제 실패: ${err?.message || err}`, '현장 삭제 오류');
    }
  };

  // 🏷️ 옵션 정규화 유틸리티 함수 (배열/객체/비문자열 런타임 크래시 원천 방어)
  const normalizeOptionString = (val: any): string => {
    if (!val) return '';
    if (Array.isArray(val)) return val.flat().map((s: any) => String(s).trim()).filter(Boolean).join(', ');
    if (typeof val === 'string') return val.trim();
    return String(val).trim();
  };

  // 🏷️ 옵션 유틸리티 함수 (옵션마스터 쉼표 포함 품목명 보존 및 비마스터/시드 항목 차단)
  const splitOptions = (str?: any): string[] => {
    return splitMasterAwareOptions(str, standardOptions, { onlyMasterOptions: true, stripPrice: true });
  };

  const toggleOptionInString = (currentStr: any, optName: string): string => {
    let arr = splitOptions(currentStr);
    if (arr.includes(optName)) {
      arr = arr.filter(s => s !== optName);
    } else {
      arr.push(optName);
    }
    return arr.join(', ');
  };

  // 🛡️ 고객사 기본 옵션 모달 핸들러
  const handleOpenCustOptionModal = (cust: Customer) => {
    setCustOptionForm({
      defaultPaidOptions: normalizeOptionString(cust.defaultPaidOptions),
      defaultProtection: normalizeOptionString(cust.defaultProtection),
      defaultAttachments: normalizeOptionString(cust.defaultAttachments || (cust.defaultCheckedSpecs as any)?.__attachments),
      specialNotes: cust.specialNotes || ''
    });
    setShowCustOptionModal(true);
  };

  const handleSaveCustOptions = async (propagateToSites: boolean = false) => {
    if (!activeCustomer?.id) return;
    try {
      db.updateRow<Customer>('customers', activeCustomer.id, {
        defaultPaidOptions: custOptionForm.defaultPaidOptions,
        defaultProtection: custOptionForm.defaultProtection,
        defaultAttachments: custOptionForm.defaultAttachments,
        specialNotes: custOptionForm.specialNotes,
        updatedAt: new Date().toISOString()
      });

      if (propagateToSites) {
        const targetSites = sites.filter(s => s.customerId === activeCustomer.id);
        for (const s of targetSites) {
          db.updateRow<CustomerSite>('sites', s.id, {
            paidOptions: custOptionForm.defaultPaidOptions,
            protection: custOptionForm.defaultProtection,
            attachments: custOptionForm.defaultAttachments,
            updatedAt: new Date().toISOString()
          });
        }
      }

      await db.awaitPendingWrites();
      await refreshAllData();
      showToast(propagateToSites 
        ? `'${activeCustomer.name}' 기본 옵션 저장 및 ${sites.filter(s => s.customerId === activeCustomer.id).length}개 고객 현장에 일괄 적용되었습니다.` 
        : `'${activeCustomer.name}' 기본 옵션이 저장되었습니다.`);
      setShowCustOptionModal(false);
    } catch (err: any) {
      showErrorModal(`옵션 저장 실패: ${err?.message || String(err)}`, '옵션 저장 오류');
    }
  };

  // 🏗️ 현장 전용 옵션 모달 핸들러
  const handleOpenSiteOptionModal = (cs: CustomerSite) => {
    setEditingSiteOption(cs);
    setSiteOptionRefSearch('');
    setSelectedRefSiteId(cs.siteMasterId || '');
    setSiteOptionForm({
      paidOptions: normalizeOptionString(cs.paidOptions),
      protection: normalizeOptionString(cs.protection),
      attachments: normalizeOptionString(cs.attachments || (cs.checkedSpecs as any)?.__attachments),
      checkedSpecs: cs.checkedSpecs ? { ...cs.checkedSpecs } : {}
    });
    setShowSiteOptionModal(true);
  };

  const handleSaveSiteOptions = async () => {
    if (!editingSiteOption?.id) return;
    try {
      db.updateRow<CustomerSite>('sites', editingSiteOption.id, {
        paidOptions: normalizeOptionString(siteOptionForm.paidOptions),
        protection: normalizeOptionString(siteOptionForm.protection),
        attachments: normalizeOptionString(siteOptionForm.attachments),
        checkedSpecs: siteOptionForm.checkedSpecs || {},
        siteMasterId: selectedRefSiteId || editingSiteOption.siteMasterId || null,
        updatedAt: new Date().toISOString()
      });
      await db.awaitPendingWrites();
      await refreshAllData();
      showToast(`현장 [${editingSiteOption.name}] 옵션이 저장되었습니다.`);
      setShowSiteOptionModal(false);
      setEditingSiteOption(null);
    } catch (err: any) {
      showErrorModal(`현장 옵션 저장 실패: ${err?.message || String(err)}`, '현장 옵션 저장 오류');
    }
  };

  // 📋 현장별 옵션관리 등록 옵션 그룹 속성 복사
  const handleApplyRefSiteOptionsToOptionForm = () => {
    if (!selectedRefSite) {
      showToast('상속받을 옵션 그룹을 먼저 선택하세요.', 'error');
      return;
    }
    setSiteOptionForm(prev => ({
      ...prev,
      paidOptions: normalizeOptionString(selectedRefSite.paidOptions),
      protection: normalizeOptionString(selectedRefSite.protection),
      attachments: normalizeOptionString(selectedRefSite.attachments || (selectedRefSite.checkedSpecs as any)?.__attachments),
      checkedSpecs: selectedRefSite.checkedSpecs ? { ...selectedRefSite.checkedSpecs } : {}
    }));
    showToast(`[${selectedRefSite.name}] 옵션 그룹 속성을 적용했습니다.`);
  };

  // 🏷️ 전사 표준 옵션 마스터 핸들러
  const handleOpenAddOption = (category: 'PAID' | 'PROTECTION' | 'ATTACHMENT' | 'SPEC' = 'PAID') => {
    setEditingOption({
      category,
      name: '',
      defaultPrice: category === 'PAID' ? 50000 : 0,
      unit: category === 'PAID' ? '월' : '건',
      description: '',
      isActive: true,
      sortOrder: (standardOptions.filter(o => o.category === category).length + 1)
    });
  };

  const handleOpenEditOption = (opt: StandardOption) => {
    setEditingOption({ ...opt });
  };

  const handleSaveOptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOption || !editingOption.name) return;
    try {
      await saveStandardOption(editingOption as any);
      showToast(`옵션 항목 [${editingOption.name}]이(가) 저장되었습니다.`);
      setEditingOption(null);
    } catch (err: any) {
      showErrorModal(`옵션 저장 실패: ${err?.message || String(err)}`, '옵션 저장 오류');
    }
  };

  const handleDeleteOption = async (opt: StandardOption) => {
    if (!window.confirm(`정말로 표준 옵션 [${opt.name}]을(를) 삭제하시겠습니까?`)) return;
    try {
      await deleteStandardOption(opt.id);
      showToast(`옵션 항목 [${opt.name}]이(가) 삭제되었습니다.`);
      if (editingOption?.id === opt.id) setEditingOption(null);
    } catch (err: any) {
      showErrorModal(`옵션 삭제 실패: ${err?.message || String(err)}`, '옵션 삭제 오류');
    }
  };

  // 🧭 현장별 옵션 관리 전용 메뉴 바로가기
  const handleNavigateToSiteOptionManage = (siteId?: string) => {
    setNavigationPayload({
      siteId: siteId || editingSite?.id,
      customerId: selectedCustomerId
    });
    setActiveTab('site_options');
  };

  // 계좌 관리
  const handleOpenAddAccount = () => {
    if (!selectedCustomerId) return;
    setEditingAccount({ bankName: '', accountNumber: '', accountHolder: '', memo: '' });
    setShowAccountModal(true);
  };

  const handleOpenEditAccount = (acc: CustomerBankAccount) => {
    setEditingAccount(acc);
    setShowAccountModal(true);
  };

  

const handleDeleteAccount = async (accId: string) => {
    if (!activeCustomer) return;
    const nextAccounts = (activeCustomer.bankAccounts || []).filter(a => a.id !== accId);
    try {
      await saveCustomer({ ...activeCustomer, bankAccounts: nextAccounts });
      await refreshAllData();
      showToast('입금 계좌가 삭제되었습니다.');
    } catch (err: any) {
      showErrorModal(`계좌 삭제 실패: ${err?.message || String(err)}`, '계좌 삭제 오류');
    }
  };

  const handleSaveAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || !editingAccount.bankName || !editingAccount.accountNumber || !activeCustomer) return;

    const accounts = activeCustomer.bankAccounts || [];
    let nextAccounts: CustomerBankAccount[];
    if (editingAccount.id) {
      nextAccounts = accounts.map(a => a.id === editingAccount.id ? (editingAccount as CustomerBankAccount) : a);
    } else {
      const newAcc: CustomerBankAccount = {
        id: `ACC-${Date.now()}`,
        bankName: editingAccount.bankName.trim(),
        accountNumber: editingAccount.accountNumber.trim(),
        accountHolder: editingAccount.accountHolder?.trim() || activeCustomer.name,
        memo: editingAccount.memo?.trim() || '',
      };
      nextAccounts = [...accounts, newAcc];
    }

    try {
      await saveCustomer({ ...activeCustomer, bankAccounts: nextAccounts });
      await refreshAllData();
      showToast('입금 계좌가 저장되었습니다.');
      setShowAccountModal(false);
      setEditingAccount(null);
    } catch (err: any) {
      showErrorModal(`입금 계좌 저장 실패: ${err?.message || String(err)}`, '입금 계좌 저장 오류');
    }
  };

    // --- Keyboard Shortcuts (Harden) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close modals
      if (e.key === 'Escape') {
        if (editingCust) setEditingCust(null);
        if (editingContact) setEditingContact(null);
        if (editingSite) { setEditingSite(null); setShowSiteModal(false); }
        if (editingAccount) setEditingAccount(null);
        if (showSiteOptionModal) setShowSiteOptionModal(false);
      }
      // Ctrl+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        const mockEvent = { preventDefault: () => {} } as React.FormEvent;
        if (editingCust) { e.preventDefault(); handleSaveCustSubmit(mockEvent); }
        else if (editingContact) { e.preventDefault(); handleSaveContactSubmit(mockEvent); }
        else if (editingSite) { e.preventDefault(); handleSaveSiteSubmit(mockEvent); }
        else if (editingAccount) { e.preventDefault(); handleSaveAccountSubmit(mockEvent); }
        else if (showSiteOptionModal) { e.preventDefault(); handleSaveSiteOptions(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingCust, editingContact, editingSite, editingAccount, showSiteOptionModal, handleSaveCustSubmit, handleSaveContactSubmit, handleSaveSiteSubmit, handleSaveAccountSubmit, handleSaveSiteOptions]);
  // -----------------------------------

  return (
    <div data-uia="customer-container" data-hs-observe="customers" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: '8px', position: 'relative' }}>
      
      {/* 알림 토스트 배너 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          padding: '10px 18px',
          borderRadius: '6px',
          backgroundColor: toastMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
          color: '#ffffff',
          fontWeight: 600,
          fontSize: '13px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-in-out'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ① 상단 헤더 & 파이프라인 (좌상단 Scope + 우상단 Pipeline: 헌장 3.5) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        paddingBottom: '4px',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, fontWeight: '700', fontSize: '17px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            고객 관리
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            총 <strong>{customers.length}</strong>개사 (조회 <strong>{filteredCustomers.length}</strong>개사)
          </span>
        </div>

        {/* 우상단 파이프라인 액션 - 표준 횡배치: 조회 -> 저장/등록 -> 엑셀업로드 -> 엑셀다운로드 */}
        <div className="toolbar-actions">
          <button
            className="btn-query"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> 조회
          </button>
          {canSave && (
            <button
              data-uia="btn-add-customer"
              data-hs-trigger="Register"
              className="btn-save"
              data-mid="btn-new-customer"
              onClick={handleOpenAddCust}
            >
              <Plus size={13} /> 신규 고객 등록
            </button>
          )}
          {canSave && isDeveloper && (
            <button
              data-hs-trigger="Register"
              className="btn-reset"
              onClick={() => setShowBatchLicenseModal(true)}
              title="사업자등록증 폴더를 지정하여 내부 모든 파일 일괄 등록 및 보완"
            >
              <FolderOpen size={13} /> 폴더 일괄 등록
            </button>
          )}
          {canSave && (
            <button
              className="btn-reset"
              onClick={() => setShowNtsAuditModal(true)}
              data-mid="btn-nts-audit"
              title="국세청 홈택스 사업자 휴폐업 상태 전수 점검 및 임대자산 회수 점검"
            >
              <ShieldAlert size={13} /> 국세청 휴폐업 점검
            </button>
          )}
          {canSave && (
            <button
              data-uia="btn-excel-upload-customer"
              data-hs-trigger="Register"
              className="btn-excel-upload"
              onClick={() => setCustExcelModalOpen(true)}
            >
              <FileSpreadsheet size={13} /> 엑셀 일괄 등록
            </button>
          )}
          <button
            className="btn-excel-download"
            onClick={handleExportAllCustomerContacts}
            title="등록된 모든 고객 및 고객현장 담당자(장비/마감/안전/본사) 전체 엑셀 다운로드"
          >
            <Download size={13} /> 전체 담당자 엑셀
          </button>
          <button
            className="btn-excel-download"
            onClick={handleExportAllSitesClosingSchedule}
            title="등록된 모든 고객의 고객현장별 명세서 마감일과 계산서 마감일 엑셀 다운로드"
          >
            <Download size={13} /> 현장별 마감일 엑셀
          </button>
          <button
            className="btn-excel-download"
            onClick={handleExportAllCustomers}
          >
            <Download size={13} /> 엑셀 다운로드
          </button>
        </div>
      </div>

      {/* ② 고객 및 현장/담당자 KPI 바 */}
      <div data-mid="customer-kpi-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '6px', flexShrink: 0 }}>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>총 고객사</span>
          <strong style={{ fontSize: '14px', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{kpiStats.totalCust}개사</strong>
        </div>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>정상 거래사</span>
          <strong style={{ fontSize: '14px', color: 'var(--success)', whiteSpace: 'nowrap' }}>{kpiStats.activeCust}개사</strong>
        </div>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>거래제한 / 폐업</span>
          <strong style={{ fontSize: '14px', color: (kpiStats.blockedCust + kpiStats.closedCust) > 0 ? 'var(--danger)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {kpiStats.blockedCust + kpiStats.closedCust}개사
          </strong>
        </div>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>등록 현장수</span>
          <strong style={{ fontSize: '14px', color: 'var(--primary)', whiteSpace: 'nowrap' }}>{kpiStats.totalSites}개소</strong>
        </div>
        <div style={{ padding: '7px 12px', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>등록 담당자</span>
          <strong style={{ fontSize: '14px', color: '#0070C0', whiteSpace: 'nowrap' }}>{kpiStats.totalContacts}명</strong>
        </div>
      </div>

      {/* ③ 필터 컨트롤 바 (Vertical Header-Label Layout: 헌장 3.4) */}
      <div data-mid="customer-search-filter" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        flexWrap: 'wrap',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: '1', minWidth: '180px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>통합 검색</label>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '8px', top: '7px', color: 'var(--text-muted)' }} />
            <input
              data-uia="input-customer-search"
              type="text"
              placeholder="고객명/초성 (예: ㅅㅅ, ㅎㄷ), 사업자번호, 대표자명, 연락처 검색..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '4px 8px 4px 26px',
                borderRadius: '4px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-main)',
                fontSize: '12px'
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>거래 상태</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '12px', minWidth: '110px' }}
          >
            <option value="ALL">전체 상태</option>
            <option value="ACTIVE">정상 거래</option>
            <option value="RESTRICT_NEW">추가계약 금지</option>
            <option value="BLOCKED_ALL">전면 차단</option>
            <option value="BLOCKED">전체 제재 (차단/금지)</option>
            <option value="CLOSED">폐업</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '2px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11.5px',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid var(--border-color)',
            backgroundColor: showOnlyIncomplete ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
            color: showOnlyIncomplete ? 'var(--danger)' : 'var(--text-secondary)',
            fontWeight: showOnlyIncomplete ? 700 : 500,
            whiteSpace: 'nowrap'
          }}>
            <input
              type="checkbox"
              checked={showOnlyIncomplete}
              onChange={e => setShowOnlyIncomplete(e.target.checked)}
              style={{ margin: 0, cursor: 'pointer' }}
            />
            ⚠️ 등록증 미첨부 고객사만 필터
          </label>
        </div>

        {(searchTerm || chosungFilter !== '전체' || statusFilter !== 'ALL' || showOnlyIncomplete) && (
          <button
            onClick={() => { setSearchTerm(''); setChosungFilter('전체'); setStatusFilter('ALL'); setShowOnlyIncomplete(false); }}
            style={{
              marginTop: '16px',
              padding: '4px 8px',
              fontSize: '11.5px',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            <RefreshCw size={11} /> 초기화
          </button>
        )}
      </div>

      {/* ④ 초성 자음 검색 필터 바 (SSOT 표준) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '3px 12px',
        backgroundColor: 'var(--bg-card)',
        borderRadius: '6px',
        border: '1px solid var(--border-color)',
        flexShrink: 0
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          초성 필터
        </span>
        <ChosungFilterBar
          selected={chosungFilter}
          onChange={setChosungFilter}
          compact
        />
      </div>

      {/* ④ 중앙 본문: 마스터-디테일 2분할 스튜디오 (헌장 3.6 유형 A) */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '360px 1fr',
        gap: '8px',
        overflow: 'hidden',
        minHeight: 0
      }}>

        {/* 좌측: 고객사 고밀도 목록 패널 */}
        <div data-mid="customer-list-panel" style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0
        }}>
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-app)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-secondary)'
          }}>
            <span>고객사 목록 ({filteredCustomers.length}건)</span>
          </div>

          <div data-uia="table-customer-list" style={{ flex: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filteredCustomers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                조회된 고객사가 없습니다.
              </div>
            ) : (
              filteredCustomers.map(cust => (
                <CustomerListItem
                  key={cust.id}
                  cust={cust}
                  isSelected={selectedCustomerId === cust.id}
                  custSitesCount={customerSiteCountMap.get(cust.id) || 0}
                  custContactsCount={customerContactCountMap.get(cust.id) || 0}
                  noticeCount={customerLegalNoticeCountMap.get(cust.id) || 0}
                  canSave={canSave}
                  onSelect={setSelectedCustomerId}
                  onUploadBizCert={(id) => {
                    setTargetBizLicenseCustId(id);
                    setShowBizLicenseModal(true);
                  }}
                  onViewBizCert={handleViewBizCert}
                  onEditCust={handleOpenEditCust}
                />
              ))
            )}
          </div>
        </div>

        {/* 우측: 선택 고객사 360도 마스터-디테일 스튜디오 */}
        <div data-mid="customer-detail-dossier" style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0
        }}>
          {activeCustomer ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* 1. 고객사 기본 마스터 정보 헤더 카드 */}
              <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={16} className="text-primary" />
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {activeCustomer.name}
                    </h3>
                    {activeCustomer.transactionStatus === 'RESTRICT_NEW' ? (
                      <span className="badge" style={{ fontSize: '11px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #f59e0b' }}>
                        추가계약금지
                      </span>
                    ) : isCustomerTotalBlocked(activeCustomer.transactionStatus) ? (
                      <span className="badge badge-danger" style={{ fontSize: '11px' }}>
                        전면차단(장비회수)
                      </span>
                    ) : (
                      <span className="badge badge-success" style={{ fontSize: '11px' }}>
                        거래가능
                      </span>
                    )}
                    {activeCustomer.isClosed && <span className="badge badge-danger" style={{ fontSize: '11px' }}>폐업</span>}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => handleViewBizCert(activeCustomer)}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        borderRadius: '4px',
                        border: activeCustomer.businessCertFileUrl ? '1px solid #0284c7' : '1px solid var(--border-color)',
                        backgroundColor: activeCustomer.businessCertFileUrl ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-app)',
                        color: activeCustomer.businessCertFileUrl ? '#0284c7' : 'var(--text-muted)',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                      title={activeCustomer.businessCertFileUrl ? "등록된 사업자등록증 사본 열람" : "등록된 사업자등록증 파일 없음 (클릭 시 안내)"}
                    >
                      <FileText size={12} /> 사업자등록증 보기
                    </button>
                    {canSave && (
                      <button data-hs-trigger="Register"
                        type="button"
                        onClick={() => {
                          setTargetBizLicenseCustId(activeCustomer.id);
                          setShowBizLicenseModal(true);
                        }}
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          borderRadius: '4px',
                          border: '1px solid #059669',
                          backgroundColor: 'rgba(5, 150, 105, 0.15)',
                          color: 'var(--success)',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                        title="사업자등록증 이미지/PDF 업로드로 본 고객 정보 자동 보완"
                      >
                        <FileText size={12} /> 사업자등록증 보완
                      </button>
                    )}
                    {canSave && (
                      <button
                        className="btn-primary"
                        onClick={() => handleOpenEditCust(activeCustomer)}
                        style={{ padding: '3px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Edit2 size={12} /> 고객사 수정
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '11.5px' }}>
                  <div><span style={{ color: 'var(--text-secondary)' }}>대표자:</span> <strong>{activeCustomer.representative || '-'}</strong></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>대표 연락처:</span> <strong>{activeCustomer.repContact || '-'}</strong></div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>사업자등록번호:</span> {activeCustomer.bizRegNo || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>대표 이메일:</span> {activeCustomer.repEmail || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>업태:</span> {activeCustomer.bizType || '-'}</div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>종목:</span> {activeCustomer.bizItem || '-'}</div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>계산서 마감일:</span>{' '}
                    {activeCustomer.defaultBillingDay === 0 || (activeCustomer.defaultTaxInvoiceIssueType === 'REVERSE' && !activeCustomer.defaultBillingDay) ? (
                      <strong>미지정</strong>
                    ) : (
                      <>매월 <strong>{(activeCustomer.defaultBillingDay || 30) === 31 ? '말일' : `${activeCustomer.defaultBillingDay || 30}일`}</strong></>
                    )}
                    <span style={{
                      marginLeft: '5px',
                      padding: '1px 5px',
                      fontSize: '10px',
                      fontWeight: 700,
                      borderRadius: '4px',
                      backgroundColor: activeCustomer.defaultTaxInvoiceIssueType === 'REVERSE' ? 'rgba(217, 119, 6, 0.14)' : 'rgba(37, 99, 235, 0.08)',
                      color: activeCustomer.defaultTaxInvoiceIssueType === 'REVERSE' ? '#b45309' : '#2563eb',
                      border: activeCustomer.defaultTaxInvoiceIssueType === 'REVERSE' ? '1px solid rgba(217, 119, 6, 0.35)' : '1px solid rgba(37, 99, 235, 0.25)'
                    }}>
                      {activeCustomer.defaultTaxInvoiceIssueType === 'REVERSE' ? '역발행' : '정발행'}
                    </span>
                  </div>
                  <div><span style={{ color: 'var(--text-secondary)' }}>명세서 마감일:</span> 매월 <strong>{(activeCustomer.defaultStatementClosingDay || 25) === 31 ? '말일' : `${activeCustomer.defaultStatementClosingDay || 25}일`}</strong></div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)' }}>약정 결제일:</span>{' '}
                    <strong>{formatPaymentDueCondition(activeCustomer.paymentDueMonthOffset, activeCustomer.paymentDueDay, activeCustomer.defaultPaymentMethod, activeCustomer.defaultPaymentTermsNote)}</strong>
                  </div>
                  <div style={{ gridColumn: 'span 4' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>사업장 주소:</span> {activeCustomer.address || '-'}
                  </div>
                  {/* 📄 사업자등록증 증빙 영역 */}
                  {activeCustomer.businessCertFileUrl && (
                    <div style={{ gridColumn: 'span 4', display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '4px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>사업자등록증 원본:</span>
                      <button
                        type="button"
                        onClick={() => handleViewBizCert(activeCustomer)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#0284c7', textDecoration: 'underline', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer', fontSize: '11.5px' }}
                      >
                        <FileText size={12} /> 등록증 사본 열람 ↗
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. 등록 현장 고밀도 그리드 */}
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} className="text-success" /> 고객 현장 목록 ({customerSites.length}개소)
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {canSave && (
                      <button
                        type="button"
                        className="btn-save btn-sm"
                        onClick={handleOpenAddSite}
                      >
                        <PlusCircle size={11} /> 현장 추가
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-excel-download btn-sm"
                      onClick={handleExportSites}
                    >
                      <Download size={11} /> 현장 엑셀
                    </button>
                  </div>
                </div>

                <div className="table-container" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '360px', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--bg-card)' }}>
                      <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <SortableTh label="현장명" sortKey="name" currentSort={sortConfigSites} onSort={requestSortSites} style={{ padding: '5px 6px', whiteSpace: 'nowrap' }} />
                        <th style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>관리</th>
                        <SortableTh label="현장 주소" sortKey="address" currentSort={sortConfigSites} onSort={requestSortSites} style={{ padding: '5px 6px', whiteSpace: 'nowrap' }} />
                        <SortableTh label="현장 소장/담당" sortKey="contactName" currentSort={sortConfigSites} onSort={requestSortSites} style={{ padding: '5px 6px', whiteSpace: 'nowrap' }} />
                        <SortableTh label="연락처" sortKey="contact" currentSort={sortConfigSites} onSort={requestSortSites} style={{ padding: '5px 6px', whiteSpace: 'nowrap' }} />
                        <SortableTh label="명세서 마감일" sortKey="closingDay" currentSort={sortConfigSites} onSort={requestSortSites} style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }} align="center" />
                        <SortableTh label="계산서 마감일" sortKey="billingDay" currentSort={sortConfigSites} onSort={requestSortSites} style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }} align="center" />
                        <SortableTh label="약정 결제일" sortKey="paymentDueDay" currentSort={sortConfigSites} onSort={requestSortSites} style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }} align="center" />
                        <th style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>상태</th>
                        <th style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>유상옵션 / 보양</th>
                        <SortableTh label="입력일시" sortKey="createdAt" currentSort={sortConfigSites} onSort={requestSortSites} style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }} align="center" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCustomerSites.length === 0 ? (
                        <tr>
                          <td colSpan={11} style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)' }}>
                            등록된 현장이 없습니다. 현장을 추가해 주세요.
                          </td>
                        </tr>
                      ) : (
                        sortedCustomerSites.map(cs => {
                          const siteStats = siteContractAssetStatsMap.get(cs.id) || { contractCount: 0, assetCount: 0 };
                          const activeContractsCount = siteStats.contractCount;
                          const activeAssetCount = siteStats.assetCount;
                          const hasActiveContracts = activeContractsCount > 0;
                          const isSiteActive = cs.isActive !== false;
                          const linkedOptionGroup = cs.siteMasterId ? (siteMasters || []).find(m => m.id === cs.siteMasterId) : undefined;

                          return (
                            <tr key={cs.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: isSiteActive ? 1 : 0.65 }}>
                              <td style={{ padding: '5px 6px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Circle size={10} fill={!isSiteActive ? '#94a3b8' : (hasActiveContracts ? '#22c55e' : '#eab308')} strokeWidth={0} />
                                <span>{cs.name}</span>
                                {linkedOptionGroup && (
                                  <span
                                    style={{
                                      padding: '1px 5px',
                                      fontSize: '9.5px',
                                      borderRadius: '3px',
                                      backgroundColor: 'rgba(99, 102, 241, 0.12)',
                                      color: '#4f46e5',
                                      border: '1px solid rgba(99, 102, 241, 0.3)',
                                      fontWeight: 600,
                                      whiteSpace: 'nowrap'
                                    }}
                                    title={`옵션 그룹 상속: ${linkedOptionGroup.name}`}
                                  >
                                    그룹: {linkedOptionGroup.name}
                                  </span>
                                )}
                                <span style={{fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400}}>
                                  (계약 {activeContractsCount}건 / {activeAssetCount}대)
                                </span>
                              </td>
                              <td style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                {canSave && (
                                  <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                    <button
                                      type="button"
                                      className="btn-secondary"
                                      onClick={() => handleOpenEditSite(cs)}
                                      style={{ padding: '1px 5px', fontSize: '11.5px' }}
                                    >
                                      수정
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: '5px 6px', whiteSpace: 'nowrap', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {isMissingSiteAddress(cs.address) ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '1px 6px',
                                      fontSize: '10.5px',
                                      fontWeight: 800,
                                      borderRadius: '4px',
                                      backgroundColor: 'rgba(245, 158, 11, 0.16)',
                                      color: '#b45309',
                                      border: '1px solid rgba(245, 158, 11, 0.5)',
                                      whiteSpace: 'nowrap'
                                    }}
                                    title="현장 주소가 등록되지 않았습니다. [수정] 버튼에서 주소를 입력할 수 있습니다."
                                  >
                                    ⚠️ 주소 미등록
                                  </span>
                                ) : (
                                  cs.address
                                )}
                              </td>
                            <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>
                              {cs.contacts && cs.contacts.filter(c => c.isActive !== false).length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  {cs.contacts.filter(c => c.isActive !== false).map((c, cIdx) => {
                                    const typeCfg = c.contactType ? SITE_CONTACT_TYPE_CONFIG[c.contactType] : (cIdx === 0 ? SITE_CONTACT_TYPE_CONFIG.EQUIPMENT : undefined);
                                    return (
                                      <div key={c.id || cIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                                        {typeCfg && (
                                          <span style={{ padding: '0 4px', fontSize: '9px', borderRadius: '3px', color: typeCfg.color, backgroundColor: typeCfg.bg, fontWeight: 700, border: `1px solid ${typeCfg.color}35`, whiteSpace: 'nowrap' }}>
                                            {typeCfg.label.slice(0, 2)}
                                          </span>
                                        )}
                                        <span style={{ fontWeight: 600 }}>{c.name || '-'}</span>
                                        {c.position && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>({c.position})</span>}
                                        {c.isPrimary && <span className="badge badge-primary" style={{ fontSize: '9px', padding: '0 3px' }}>대표</span>}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span>{cs.contactName || '-'}</span>
                              )}
                            </td>
                            <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>
                              {cs.contacts && cs.contacts.filter(c => c.isActive !== false).length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  {cs.contacts.filter(c => c.isActive !== false).map((c, cIdx) => (
                                    <div key={c.id || cIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                                      <span>{c.contact || '-'}</span>
                                      {c.email && <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>&lt;{c.email}&gt;</span>}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span>{cs.contact || '-'}{cs.email ? ` (${cs.email})` : ''}</span>
                              )}
                            </td>
                            <td style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: '11.5px', fontWeight: 600, color: cs.statementClosingDay ? 'var(--primary)' : 'var(--text-muted)' }}>
                                매월 {(cs.statementClosingDay || activeCustomer?.defaultStatementClosingDay || 25) === 31 ? '말일' : `${cs.statementClosingDay || activeCustomer?.defaultStatementClosingDay || 25}일`}
                              </span>
                            </td>
                            <td style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {(() => {
                                const isReverse = ((cs.taxInvoiceIssueType || (cs.checkedSpecs as any)?.__taxInvoiceIssueType || activeCustomer?.defaultTaxInvoiceIssueType) === 'REVERSE');
                                const rawBillDay = cs.billingDay !== undefined && cs.billingDay !== null ? cs.billingDay : (activeCustomer?.defaultBillingDay !== undefined ? activeCustomer.defaultBillingDay : (isReverse ? 0 : 30));
                                return (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: rawBillDay ? 'var(--primary)' : 'var(--text-muted)' }}>
                                      {rawBillDay === 0 ? '미지정' : `매월 ${rawBillDay === 31 ? '말일' : `${rawBillDay}일`}`}
                                    </span>
                                    {isReverse ? (
                                      <span style={{ padding: '1px 5px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', backgroundColor: 'rgba(217, 119, 6, 0.14)', color: '#b45309', border: '1px solid rgba(217, 119, 6, 0.35)', whiteSpace: 'nowrap' }}>
                                        역발행
                                      </span>
                                    ) : (
                                      <span style={{ padding: '1px 5px', fontSize: '10px', fontWeight: 600, borderRadius: '4px', backgroundColor: 'rgba(37, 99, 235, 0.08)', color: '#2563eb', border: '1px solid rgba(37, 99, 235, 0.25)', whiteSpace: 'nowrap' }}>
                                        정발행
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {(() => {
                                const payMethod = cs.paymentMethod || (cs.checkedSpecs as any)?.__paymentMethod || activeCustomer?.defaultPaymentMethod || 'CASH';
                                const payNote = (cs.paymentTermsNote !== undefined ? cs.paymentTermsNote : ((cs.checkedSpecs as any)?.__paymentTermsNote ?? activeCustomer?.defaultPaymentTermsNote ?? '')).trim();
                                const dueOffset = cs.paymentDueMonthOffset !== undefined ? cs.paymentDueMonthOffset : (activeCustomer?.paymentDueMonthOffset ?? 1);
                                const dueDay = cs.paymentDueDay || activeCustomer?.paymentDueDay || 25;
                                const dateOnlyText = payNote === '익익월 초' && dueOffset === 2 && dueDay === 1
                                  ? '익익월 초'
                                  : formatPaymentDueCondition(dueOffset, dueDay);
                                const methodBg = payMethod === 'BILL' ? 'rgba(124, 58, 237, 0.14)' : payMethod === 'BOND' ? 'rgba(217, 119, 6, 0.14)' : 'rgba(16, 185, 129, 0.10)';
                                const methodColor = payMethod === 'BILL' ? '#6d28d9' : payMethod === 'BOND' ? '#b45309' : '#059669';
                                const methodBorder = payMethod === 'BILL' ? '1px solid rgba(124, 58, 237, 0.35)' : payMethod === 'BOND' ? '1px solid rgba(217, 119, 6, 0.35)' : '1px solid rgba(16, 185, 129, 0.28)';
                                return (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ padding: '1px 5px', fontSize: '10px', fontWeight: 700, borderRadius: '4px', backgroundColor: methodBg, color: methodColor, border: methodBorder, whiteSpace: 'nowrap' }}>
                                      {getPaymentMethodLabel(payMethod)}
                                    </span>
                                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                                      {dateOnlyText}
                                    </span>
                                    {payNote && payNote !== '익익월 초' && (
                                      <span style={{ padding: '1px 5px', fontSize: '10px', fontWeight: 600, borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.10)', color: '#dc2626', border: '1px solid rgba(239, 68, 68, 0.28)', whiteSpace: 'nowrap' }}>
                                        {payNote}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={() => canSave && handleToggleCustomerSiteStatus(cs)}
                                style={{
                                  padding: '1px 6px',
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  borderRadius: '4px',
                                  cursor: canSave ? 'pointer' : 'default',
                                  border: isSiteActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(148, 163, 184, 0.4)',
                                  backgroundColor: isSiteActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.14)',
                                  color: isSiteActive ? '#059669' : '#64748b',
                                  whiteSpace: 'nowrap'
                                }}
                                title={canSave ? '클릭하여 가동중 / 완공·종료 상태 전환' : undefined}
                              >
                                {isSiteActive ? '가동중' : '완공/종료'}
                              </button>
                            </td>
                            <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>
                              <div 
                                onClick={() => canSave && handleOpenSiteOptionModal(cs)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: canSave ? 'pointer' : 'default', flexWrap: 'nowrap' }}
                                title={canSave ? "클릭하여 현장 옵션 관리" : undefined}
                              >
                                {(() => {
                                  const paidStr = normalizeOptionString(cs.paidOptions);
                                  const protStr = normalizeOptionString(cs.protection);
                                  const attStr = normalizeOptionString(cs.attachments || (cs.checkedSpecs as any)?.__attachments);
                                  const hasPaid = Boolean(paidStr && paidStr !== '-' && paidStr !== 'NONE' && paidStr !== '없음');
                                  const hasProt = Boolean(protStr && protStr !== 'NONE' && protStr !== '-' && protStr !== '없음');
                                  const hasAtt = Boolean(attStr && attStr !== 'NONE' && attStr !== '-' && attStr !== '없음');
                                  if (!hasPaid && !hasProt && !hasAtt) {
                                    return (
                                      <span style={{ padding: '1px 6px', fontSize: '11px', borderRadius: '3px', backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)', border: '1px dashed var(--border-color)' }}>
                                        (기본상속)
                                      </span>
                                    );
                                  }
                                  return (
                                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                                      {hasPaid && (
                                        <span style={{ padding: '1px 5px', fontSize: '9.5px', borderRadius: '3px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: 'var(--primary)', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600 }}>
                                          {paidStr}
                                        </span>
                                      )}
                                      {hasProt && (
                                        <span style={{ padding: '1px 5px', fontSize: '9.5px', borderRadius: '3px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 600 }}>
                                          {protStr}
                                        </span>
                                      )}
                                      {hasAtt && (
                                        <span style={{ padding: '1px 5px', fontSize: '9.5px', borderRadius: '3px', backgroundColor: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', border: '1px solid rgba(124, 58, 237, 0.3)', fontWeight: 600 }}>
                                          {attStr}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                            <td
                              style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}
                              title={`입력일시: ${formatDateTimeKst(cs.createdAt)}${(cs as any).updatedAt ? ` / 최종수정: ${formatDateTimeKst((cs as any).updatedAt)}` : ''}`}
                            >
                              {formatDateTimeKst(cs.createdAt)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 3. 등록 담당자 고밀도 그리드 */}
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={14} className="text-primary" /> 고객 담당자 목록 ({customerContacts.length}명)
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {canSave && (
                      <button
                        type="button"
                        className="btn-save btn-sm"
                        onClick={handleOpenAddContact}
                      >
                        <PlusCircle size={11} /> 담당자 추가
                      </button>
                    )}
                    {canSave && (
                      <button
                        type="button"
                        className="btn-reset btn-sm"
                        onClick={() => {
                          setTargetContactCardCustId(activeCustomer.id);
                          setShowContactCardModal(true);
                        }}
                      >
                        <User size={11} /> 명함/이메일로 추가
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-excel-download btn-sm"
                      onClick={handleExportContacts}
                    >
                      <Download size={11} /> 담당자 엑셀
                    </button>
                  </div>
                </div>

                <div className="table-container" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '360px', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--bg-card)' }}>
                      <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <SortableTh label="담당자명" sortKey="name" currentSort={sortConfigContacts} onSort={requestSortContacts} style={{ padding: '5px 6px', whiteSpace: 'nowrap' }} />
                        <SortableTh label="직책 / 부서" sortKey="position" currentSort={sortConfigContacts} onSort={requestSortContacts} style={{ padding: '5px 6px', whiteSpace: 'nowrap' }} />
                        <SortableTh label="연락처" sortKey="contact" currentSort={sortConfigContacts} onSort={requestSortContacts} style={{ padding: '5px 6px', whiteSpace: 'nowrap' }} />
                        <SortableTh label="이메일" sortKey="email" currentSort={sortConfigContacts} onSort={requestSortContacts} style={{ padding: '5px 6px', whiteSpace: 'nowrap' }} />
                        <SortableTh label="사용 여부" sortKey="isActive" currentSort={sortConfigContacts} onSort={requestSortContacts} style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }} align="center" />
                        <th style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCustomerContacts.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)' }}>
                            등록된 담당자가 없습니다. 담당자를 추가해 주세요.
                          </td>
                        </tr>
                      ) : (
                        sortedCustomerContacts.map(cc => (
                          <tr key={cc.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: cc.isActive !== false ? 1 : 0.6 }}>
                            <td style={{ padding: '5px 6px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>{cc.name}</td>
                            <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>{cc.position || '-'}</td>
                            <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>{cc.contact}</td>
                            <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>{cc.email || '-'}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <span className={`badge ${cc.isActive !== false ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '9.5px' }}>
                                {cc.isActive !== false ? '사용' : '미사용'}
                              </span>
                            </td>
                            <td style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {canSave && (
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => handleOpenEditContact(cc)}
                                  style={{ padding: '1px 5px', fontSize: '11.5px' }}
                                >
                                  수정
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4. 입금 계좌 관리 그리드 (수납 자동매핑용 - 통장 입금자 계좌 식별 불가로 안보이게 처리) */}
              {/*
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CreditCard size={14} style={{ color: 'var(--primary)' }} /> 입금 계좌 목록 ({activeCustomer.bankAccounts?.length || 0}건)
                  </div>
                  {canSave && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleOpenAddAccount}
                      style={{ padding: '2px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <PlusCircle size={11} /> 계좌 추가
                    </button>
                  )}
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>은행명</th>
                        <th style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>계좌번호</th>
                        <th style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>예금주</th>
                        <th style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>메모</th>
                        <th style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(!activeCustomer.bankAccounts || activeCustomer.bankAccounts.length === 0) ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '14px 0', color: 'var(--text-muted)' }}>
                            등록된 입금 계좌가 없습니다.
                          </td>
                        </tr>
                      ) : (
                        activeCustomer.bankAccounts.map(acc => (
                          <tr key={acc.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '5px 6px', fontWeight: 600, color: 'var(--primary)', whiteSpace: 'nowrap' }}>{acc.bankName}</td>
                            <td style={{ padding: '5px 6px', fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{acc.accountNumber}</td>
                            <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>{acc.accountHolder || '-'}</td>
                            <td style={{ padding: '5px 6px', whiteSpace: 'nowrap' }}>{acc.memo || '-'}</td>
                            <td style={{ padding: '5px 6px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {canSave && (
                                <div style={{ display: 'inline-flex', gap: '3px' }}>
                                  <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => handleOpenEditAccount(acc)}
                                    style={{ padding: '1px 5px', fontSize: '11.5px' }}
                                  >
                                    수정
                                  </button>
                                  <button data-hs-trigger="Delete"
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => handleDeleteAccount(acc.id)}
                                    style={{ padding: '1px 5px', fontSize: '11.5px', color: 'var(--danger)' }}
                                  >
                                    삭제
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              */}

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
              좌측 목록에서 고객사를 선택해 주세요.
            </div>
          )}
        </div>

      </div>

      {/* ⑤ 우하단 Terminal Action: 고객-현장-담당자 대차대조식 검증 바 (헌장 3.5) */}
      <div style={{
        padding: '8px 14px',
        backgroundColor: 'var(--bg-app)',
        border: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '11.5px',
        borderRadius: '6px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span>전사 고객사: <strong style={{ color: 'var(--primary)' }}>{kpiStats.totalCust}개사</strong> (정상 {kpiStats.activeCust} / 제한·폐업 {kpiStats.blockedCust + kpiStats.closedCust})</span>
          <span>|</span>
          <span>등록 현장: <strong style={{ color: 'var(--primary)' }}>{kpiStats.totalSites}개소</strong> (가동 {kpiStats.activeSites}개소)</span>
          <span>|</span>
          <span>등록 담당자: <strong style={{ color: '#0070C0' }}>{kpiStats.totalContacts}명</strong></span>
        </div>
      </div>

      {/* ⑥ 고객 등록/수정 모달 */}
      {showCustModal && editingCust && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          padding: '20px'
        }}>
          <form onSubmit={handleSaveCustSubmit} className="card" style={{ width: '100%', maxWidth: '660px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                  {editingCust.id ? '고객사 정보 수정' : '신규 고객사 등록'}
                </h3>
                {editingCust.id && (
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0369a1', backgroundColor: 'rgba(14, 165, 233, 0.12)', border: '1px solid rgba(14, 165, 233, 0.35)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                    입력일시: {formatDateTimeKst(editingCust.createdAt)}
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setShowCustModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            {!editingCust.id && (
              <div style={{
                marginBottom: '10px',
                padding: '7px 10px',
                backgroundColor: 'rgba(5, 150, 105, 0.12)',
                border: '1px solid #059669',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '11px', color: '#34d399', fontWeight: 600 }}>
                  📄 사업자등록증 파일(이미지/PDF)로 자동 입력하시겠습니까?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustModal(false);
                    setTargetBizLicenseCustId(undefined);
                    setShowBizLicenseModal(true);
                  }}
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    backgroundColor: 'var(--success)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  AI 자동 판독 ➔
                </button>
              </div>
            )}

            {editingCust.id && editingCust.businessCertFileUrl && (
              <div style={{
                marginBottom: '10px',
                padding: '6px 10px',
                backgroundColor: 'rgba(2, 132, 199, 0.08)',
                border: '1px solid rgba(2, 132, 199, 0.25)',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <FileText size={12} /> 등록된 사업자등록증 사본이 존재합니다.
                </span>
                <button
                  type="button"
                  onClick={() => handleViewBizCert(editingCust as Customer)}
                  style={{
                    padding: '2px 8px',
                    fontSize: '11px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  <FileText size={10} /> 사업자등록증 보기
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div>
                <label style={labelStyle}>고객사명 *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={editingCust.name || ''}
                  onChange={e => setEditingCust({ ...editingCust, name: e.target.value })}
                  data-mid="input-customer-name" placeholder="예: (주)한라건설"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>사업자등록번호</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={editingCust.bizRegNo || ''}
                    onChange={e => setEditingCust({ ...editingCust, bizRegNo: e.target.value })}
                    data-mid="input-biz-no" placeholder="000-00-00000"
                  />
                </div>
                <div>
                  <label style={labelStyle}>폐업 여부</label>
                  <select
                    style={inputStyle}
                    value={editingCust.isClosed ? 'true' : 'false'}
                    onChange={e => setEditingCust({ ...editingCust, isClosed: e.target.value === 'true' })}
                  >
                    <option value="false">운영중</option>
                    <option value="true">폐업</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>거래 상태 (출고)</label>
                  <select
                    style={{ ...inputStyle, fontWeight: isCustomerRestricted(editingCust.transactionStatus) ? 700 : 400, color: isCustomerRestricted(editingCust.transactionStatus) ? '#dc2626' : 'inherit' }}
                    value={editingCust.transactionStatus || 'ALLOWED'}
                    onChange={e => setEditingCust({ ...editingCust, transactionStatus: e.target.value as CustomerTransactionStatus })}
                  >
                    <option value="ALLOWED">정상 거래</option>
                    <option value="RESTRICT_NEW">추가계약 금지 (기존계약 유지)</option>
                    <option value="BLOCKED_ALL">전면 차단 (기존장비 회수)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>대표자명</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={editingCust.representative || ''}
                    onChange={e => setEditingCust({ ...editingCust, representative: e.target.value })}
                    placeholder="홍길동"
                  />
                </div>
                <div>
                  <label style={labelStyle}>대표 연락처</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={editingCust.repContact || ''}
                    onChange={e => setEditingCust({ ...editingCust, repContact: e.target.value })}
                    placeholder="02-000-0000"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>업태</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={editingCust.bizType || ''}
                    onChange={e => setEditingCust({ ...editingCust, bizType: e.target.value })}
                    placeholder="건설 및 임대업"
                  />
                </div>
                <div>
                  <label style={labelStyle}>종목</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={editingCust.bizItem || ''}
                    onChange={e => setEditingCust({ ...editingCust, bizItem: e.target.value })}
                    placeholder="고소작업대 외"
                  />
                </div>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: '6px',
                border: '1px dashed var(--border-color)'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 0.9fr',
                  gap: '10px',
                  alignItems: 'start'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>명세서 마감일</label>
                    <select
                      style={inputStyle}
                      value={editingCust.defaultStatementClosingDay || 25}
                      onChange={e => setEditingCust({ ...editingCust, defaultStatementClosingDay: Number(e.target.value) })}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>{day === 31 ? '31일 (월말)' : `매월 ${day}일`}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>계산서 마감일</label>
                    <select
                      style={inputStyle}
                      value={editingCust.defaultBillingDay !== undefined && editingCust.defaultBillingDay !== null ? editingCust.defaultBillingDay : 30}
                      onChange={e => setEditingCust({ ...editingCust, defaultBillingDay: Number(e.target.value) })}
                    >
                      <option value={0}>미지정 (역발행 등)</option>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>{day === 31 ? '31일 (월말)' : `매월 ${day}일`}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>계산서 발행조건</label>
                    <select
                      style={inputStyle}
                      value={editingCust.defaultTaxInvoiceIssueType || 'FORWARD'}
                      onChange={e => setEditingCust({ ...editingCust, defaultTaxInvoiceIssueType: e.target.value as 'FORWARD' | 'REVERSE' })}
                    >
                      <option value="FORWARD">정발행 (기본)</option>
                      <option value="REVERSE">역발행</option>
                    </select>
                  </div>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '0.9fr 1.4fr 1.3fr',
                  gap: '10px',
                  alignItems: 'start'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>약정 결제조건</label>
                    <select
                      style={inputStyle}
                      value={editingCust.defaultPaymentMethod || 'CASH'}
                      onChange={e => setEditingCust({ ...editingCust, defaultPaymentMethod: e.target.value as PaymentMethodType })}
                    >
                      {PAYMENT_METHOD_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.value === 'CASH' ? '현금 (기본)' : opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>약정 결제일</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '6px' }}>
                      <select
                        style={{ ...inputStyle, padding: '5px 6px' }}
                        value={editingCust.paymentDueMonthOffset !== undefined ? editingCust.paymentDueMonthOffset : 1}
                        onChange={e => setEditingCust({ ...editingCust, paymentDueMonthOffset: Number(e.target.value) })}
                      >
                        {PAYMENT_DUE_MONTH_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <select
                        style={{ ...inputStyle, padding: '5px 6px' }}
                        value={editingCust.paymentDueDay || 25}
                        onChange={e => setEditingCust({ ...editingCust, paymentDueDay: Number(e.target.value) })}
                      >
                        {Array.from({ length: 30 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>{day}일</option>
                        ))}
                        <option value={31}>말일</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>약정 결제비고 (특약조건)</label>
                    <input
                      type="text"
                      style={inputStyle}
                      value={editingCust.defaultPaymentTermsNote || ''}
                      onChange={e => setEditingCust({ ...editingCust, defaultPaymentTermsNote: e.target.value })}
                      placeholder="예: 300만원이상 채권, 또는 채권"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>대표 이메일</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={editingCust.repEmail || ''}
                  onChange={e => setEditingCust({ ...editingCust, repEmail: e.target.value })}
                  placeholder="contact@company.com (복수 입력 시 , 또는 / 로 구분)"
                />
              </div>

              <div>
                <label style={labelStyle}>사업장 주소</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '44px' }}
                  value={editingCust.address || ''}
                  onChange={e => setEditingCust({ ...editingCust, address: e.target.value })}
                  placeholder="도로명 주소"
                />
              </div>


            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              <div>
                {editingCust.id && (
                  <button data-hs-trigger="Delete" 
                    type="button" 
                    onClick={() => handleDeleteCustomer(editingCust.id!, editingCust.name || '')} 
                    style={{ padding: '5px 14px', fontSize: '12px', backgroundColor: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    고객사 삭제
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowCustModal(false)} style={{ padding: '5px 14px', fontSize: '12px' }}>취소</button>
                <button data-hs-trigger="Save" type="submit" className="btn-primary" disabled={isSubmittingCust} style={{ padding: '5px 16px', fontSize: '12px' }}>
                  {isSubmittingCust ? '저장중...' : '저장'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 📄 사업자등록증 사본 열람 모달 */}
      {viewingBizCertCust && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
          padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-card)', borderRadius: '8px', overflow: 'hidden', padding: 0, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} style={{ color: '#0284c7' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  사업자등록증 사본 열람
                </h3>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  | {viewingBizCertCust.name} ({viewingBizCertCust.bizRegNo || '번호미상'})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingBizCertCust(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 본문 요약 바 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '10px 18px', backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', fontSize: '11.5px' }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>대표자:</span> <strong>{viewingBizCertCust.representative || '-'}</strong></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>업태 / 종목:</span> {viewingBizCertCust.bizType || '-'} / {viewingBizCertCust.bizItem || '-'}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>과세유형:</span> {viewingBizCertCust.taxType || '일반과세자'}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>사업장주소:</span> <span title={viewingBizCertCust.address} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block', maxWidth: '140px', verticalAlign: 'bottom' }}>{viewingBizCertCust.address || '-'}</span></div>
            </div>

            {/* 문서 미리보기 영역 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', minHeight: '480px' }}>
              {(() => {
                const url = viewingBizCertCust.businessCertFileUrl || '';
                const isPdf = url.toLowerCase().includes('.pdf') || url.startsWith('data:application/pdf');
                
                if (isPdf) {
                  return (
                    <object
                      data={url}
                      type="application/pdf"
                      style={{ width: '100%', height: '580px', borderRadius: '4px', border: 'none' }}
                    >
                      <iframe
                        src={url}
                        title="사업자등록증 PDF 열람"
                        style={{ width: '100%', height: '580px', border: 'none' }}
                      />
                    </object>
                  );
                }

                return (
                  <img
                    src={url}
                    alt="사업자등록증"
                    style={{ maxWidth: '100%', maxHeight: '580px', objectFit: 'contain', borderRadius: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}
                  />
                );
              })()}
            </div>

            {/* 하단 버튼 영역 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
              <div>
                {viewingBizCertCust.businessCertFileUrl && (
                  <a
                    href={viewingBizCertCust.businessCertFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '5px 12px',
                      fontSize: '12px',
                      borderRadius: '4px',
                      border: '1px solid #0284c7',
                      backgroundColor: 'rgba(2, 132, 199, 0.1)',
                      color: '#0284c7',
                      textDecoration: 'none',
                      fontWeight: 600
                    }}
                  >
                    <ExternalLink size={13} /> 새 탭에서 열기
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    const targetId = viewingBizCertCust.id;
                    setViewingBizCertCust(null);
                    setTargetBizLicenseCustId(targetId);
                    setShowBizLicenseModal(true);
                  }}
                  style={{ padding: '5px 12px', fontSize: '12px' }}
                >
                  <FileText size={12} /> 재등록 및 보완
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setViewingBizCertCust(null)}
                  style={{ padding: '5px 16px', fontSize: '12px' }}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📄 사업자등록증 AI 신규 등록 및 정보 보완 모달 */}
      {showBizLicenseModal && (
        <BusinessLicenseModal
          isOpen={showBizLicenseModal}
          onClose={() => setShowBizLicenseModal(false)}
          targetCustomerId={targetBizLicenseCustId}
          onSuccess={handleBizLicenseSuccess}
        />
      )}

      {/* 📂 사업자등록증 폴더 일괄 등록 모달 */}
      {showBatchLicenseModal && (
        <BatchBusinessLicenseModal
          isOpen={showBatchLicenseModal}
          onClose={() => setShowBatchLicenseModal(false)}
          initialTargetType="CUSTOMER"
        />
      )}

      {/* 🏛️ 국세청 홈택스 사업자 휴폐업 전수 점검 스튜디오 */}
      {showNtsAuditModal && (
        <NtsStatusAuditModal
          isOpen={showNtsAuditModal}
          onClose={() => setShowNtsAuditModal(false)}
          initialTarget="CUSTOMER"
        />
      )}

      {/* ⑦ 담당자 등록/수정 모달 */}
      {showContactModal && editingContact && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          padding: '20px'
        }}>
          <form onSubmit={handleSaveContactSubmit} className="card" style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                  {editingContact.id ? '담당자 수정' : '신규 담당자 등록'}
                </h3>
                {editingContact.id && (
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0369a1', backgroundColor: 'rgba(14, 165, 233, 0.12)', border: '1px solid rgba(14, 165, 233, 0.35)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                    입력일시: {formatDateTimeKst(editingContact.createdAt)}
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setShowContactModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div>
                <label style={labelStyle}>담당자명 *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={editingContact.name || ''}
                  onChange={e => setEditingContact({ ...editingContact, name: e.target.value })}
                  placeholder="이름"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>직급 / 부서</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={editingContact.position || ''}
                  onChange={e => setEditingContact({ ...editingContact, position: e.target.value })}
                  placeholder="예: 구매팀 대리"
                />
              </div>

              <div>
                <label style={labelStyle}>연락처 *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={editingContact.contact || ''}
                  onChange={e => setEditingContact({ ...editingContact, contact: e.target.value })}
                  placeholder="010-0000-0000"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>이메일</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={editingContact.email || ''}
                  onChange={e => setEditingContact({ ...editingContact, email: e.target.value })}
                  placeholder="email@company.com (복수 입력 가능)"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px' }}>
                <input
                  type="checkbox"
                  id="contactActiveCheck"
                  checked={editingContact.isActive !== false}
                  onChange={e => setEditingContact({ ...editingContact, isActive: e.target.checked })}
                />
                <label htmlFor="contactActiveCheck" style={{ fontSize: '12px', cursor: 'pointer', margin: 0 }}>
                  사용 여부 (퇴사 시 체크 해제)
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: editingContact.id ? 'space-between' : 'flex-end', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              {editingContact.id && (
                <button data-hs-trigger="Delete"
                  type="button"
                  onClick={() => handleDeleteContact(editingContact.id!, editingContact.name || '')}
                  style={{ padding: '5px 14px', fontSize: '12px', backgroundColor: 'var(--danger-color, #ef4444)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  삭제
                </button>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowContactModal(false)} style={{ padding: '5px 14px', fontSize: '12px' }}>취소</button>
                <button data-hs-trigger="Save" type="submit" className="btn-primary" style={{ padding: '5px 16px', fontSize: '12px' }}>저장</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ⑧ 현장 등록/수정 모달 */}
      {showSiteModal && editingSite && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          padding: '20px'
        }}>
          <form onSubmit={handleSaveSiteSubmit} className="card" style={{ width: '100%', maxWidth: '660px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingSite.id ? '8px' : '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                  {editingSite.id ? '현장 수정' : '신규 현장 등록'}
                </h3>
                {editingSite.id && (
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0369a1', backgroundColor: 'rgba(14, 165, 233, 0.12)', border: '1px solid rgba(14, 165, 233, 0.35)', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                    입력일시: {formatDateTimeKst(editingSite.createdAt)}
                  </span>
                )}
              </div>
              <button type="button" onClick={() => setShowSiteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>
            {editingSite.id && (() => {
              const modalSiteStats = siteContractAssetStatsMap.get(editingSite.id) || { contractCount: 0, assetCount: 0 };
              const updatedAtStr = (editingSite as any).updatedAt ? formatDateTimeKst((editingSite as any).updatedAt) : null;
              return (
                <div style={{
                  marginBottom: '12px',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  fontSize: '11.5px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      현장코드: <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{editingSite.id}</strong>
                    </span>
                    <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      입력일시: <strong style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{formatDateTimeKst(editingSite.createdAt)}</strong>
                    </span>
                    {updatedAtStr && updatedAtStr !== '-' && (
                      <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        최종수정: <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>{updatedAtStr}</strong>
                      </span>
                    )}
                  </div>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700,
                    backgroundColor: (modalSiteStats.contractCount > 0 || modalSiteStats.assetCount > 0) ? 'rgba(22, 163, 74, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                    color: (modalSiteStats.contractCount > 0 || modalSiteStats.assetCount > 0) ? '#15803d' : 'var(--text-secondary)',
                    border: (modalSiteStats.contractCount > 0 || modalSiteStats.assetCount > 0) ? '1px solid rgba(22, 163, 74, 0.35)' : '1px solid var(--border-color)',
                    whiteSpace: 'nowrap'
                  }}>
                    연결 내역: 계약 {modalSiteStats.contractCount}건 / 장비 {modalSiteStats.assetCount}대
                  </span>
                </div>
              );
            })()}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>현장명 *</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={editingSite.name || ''}
                    onChange={e => setEditingSite({ ...editingSite, name: e.target.value })}
                    placeholder="고객 현장명을 입력하세요 (예: 평택 P4 복합동 현장)"
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>현장 가동 상태</label>
                  <select
                    style={inputStyle}
                    value={editingSite.isActive !== false ? 'ACTIVE' : 'COMPLETED'}
                    onChange={e => setEditingSite({ ...editingSite, isActive: e.target.value === 'ACTIVE' })}
                  >
                    <option value="ACTIVE">가동중</option>
                    <option value="COMPLETED">완공/종료</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>현장 주소 *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={editingSite.address || ''}
                  onChange={e => setEditingSite({ ...editingSite, address: e.target.value })}
                  placeholder="현장 도로명 또는 지번 주소를 입력하세요"
                />
              </div>

              {/* 👥 현장 담당자 섹션 (3대 유형: 장비담당자, 마감담당자, 안전담당자) */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px', backgroundColor: 'var(--bg-app)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <User size={15} className="text-primary" /> 현장 담당자 관리
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      장비담당자(배차/운용), 마감담당자(명세서 수신), 안전담당자(점검결과)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => handleAddSiteContact('EQUIPMENT')}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        border: '1px solid rgba(37, 99, 235, 0.3)',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        color: '#2563eb',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontWeight: 600
                      }}
                      title="장비담당자 추가"
                    >
                      <Plus size={11} /> + 장비
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSiteContact('CLOSING')}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        border: '1px solid rgba(5, 150, 105, 0.3)',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(5, 150, 105, 0.08)',
                        color: '#059669',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontWeight: 600
                      }}
                      title="마감담당자 추가"
                    >
                      <Plus size={11} /> + 마감
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSiteContact('SAFETY')}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        border: '1px solid rgba(217, 119, 6, 0.3)',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(217, 119, 6, 0.08)',
                        color: '#d97706',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontWeight: 600
                      }}
                      title="안전담당자 추가"
                    >
                      <Plus size={11} /> + 안전
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(editingSite.contacts || []).map((sc, scIdx) => {
                    const cType: SiteContactType = sc.contactType || (scIdx === 0 ? 'EQUIPMENT' : (scIdx === 1 ? 'CLOSING' : 'SAFETY'));
                    const cfg = SITE_CONTACT_TYPE_CONFIG[cType] || SITE_CONTACT_TYPE_CONFIG.EQUIPMENT;
                    const isInactive = sc.isActive === false;

                    return (
                      <div
                        key={sc.id || scIdx}
                        style={{
                          border: `1px solid ${isInactive ? 'var(--border-color)' : cfg.color + '40'}`,
                          borderRadius: '6px',
                          padding: '10px 12px',
                          backgroundColor: isInactive ? 'rgba(0,0,0,0.03)' : 'var(--bg-card)',
                          opacity: isInactive ? 0.65 : 1,
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {/* 카드 상단 바: 유형 뱃지, 설명, 사용여부 토글, 대표 지정, 삭제 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                padding: '2px 7px',
                                fontSize: '11px',
                                fontWeight: 700,
                                borderRadius: '4px',
                                color: cfg.color,
                                backgroundColor: cfg.bg,
                                border: `1px solid ${cfg.color}40`,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {cfg.label}
                            </span>
                            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              ({cfg.subLabel})
                            </span>

                            {/* 유형 변경 선택기 */}
                            <select
                              value={cType}
                              onChange={e => handleUpdateSiteContact(scIdx, 'contactType', e.target.value as SiteContactType)}
                              style={{
                                fontSize: '11.5px',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-app)',
                                color: 'var(--text-main)',
                                cursor: 'pointer'
                              }}
                              title="담당자 유형 변경"
                            >
                              <option value="EQUIPMENT">장비담당자</option>
                              <option value="CLOSING">마감담당자</option>
                              <option value="SAFETY">안전담당자</option>
                            </select>

                            {sc.isPrimary ? (
                              <span className="badge badge-primary" style={{ fontSize: '9.5px', padding: '1px 5px', whiteSpace: 'nowrap' }}>
                                ★ 대표
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetPrimarySiteContact(scIdx)}
                                style={{
                                  padding: '1px 5px',
                                  fontSize: '11px',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '3px',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  color: 'var(--text-secondary)',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                대표 지정
                              </button>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {/* 사용 / 미사용 관리 토글 */}
                            <button
                              type="button"
                              onClick={() => handleToggleSiteContactActive(scIdx)}
                              style={{
                                padding: '2px 8px',
                                fontSize: '11.5px',
                                fontWeight: 600,
                                border: `1px solid ${!isInactive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(156, 163, 175, 0.4)'}`,
                                borderRadius: '4px',
                                backgroundColor: !isInactive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(156, 163, 175, 0.12)',
                                color: !isInactive ? 'var(--success, #059669)' : 'var(--text-muted, #6b7280)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                whiteSpace: 'nowrap'
                              }}
                              title={!isInactive ? '클릭 시 미사용 전환' : '클릭 시 사용 전환'}
                            >
                              {!isInactive ? (
                                <>
                                  <CheckCircle2 size={11} /> 사용중
                                </>
                              ) : (
                                <>
                                  <X size={11} /> 미사용
                                </>
                              )}
                            </button>

                            {(editingSite.contacts || []).length > 1 && (
                              <button data-hs-trigger="Delete"
                                type="button"
                                onClick={() => handleRemoveSiteContact(scIdx)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--danger-color, #ef4444)',
                                  cursor: 'pointer',
                                  padding: '2px',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                title="담당자 삭제"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 입력 필드 (상하 스택) */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>
                              {cfg.label} 성명 {cType === 'EQUIPMENT' && '*'}
                            </label>
                            <input
                              type="text"
                              style={inputStyle}
                              value={sc.name || ''}
                              onChange={e => handleUpdateSiteContact(scIdx, 'name', e.target.value)}
                              placeholder={`예: ${cType === 'EQUIPMENT' ? '김소장' : cType === 'CLOSING' ? '박과장' : '이대리'}`}
                              required={cType === 'EQUIPMENT' && !isInactive}
                            />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>직책 / 역할</label>
                            <input
                              type="text"
                              style={inputStyle}
                              value={sc.position || ''}
                              onChange={e => handleUpdateSiteContact(scIdx, 'position', e.target.value)}
                              placeholder={cfg.defaultPosition}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.3fr', gap: '8px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>
                              전화번호 (휴대폰) {cType === 'EQUIPMENT' && '*'}
                            </label>
                            <input
                              type="text"
                              style={inputStyle}
                              value={sc.contact || ''}
                              onChange={e => handleUpdateSiteContact(scIdx, 'contact', e.target.value)}
                              placeholder="010-0000-0000"
                              required={cType === 'EQUIPMENT' && !isInactive}
                            />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>
                              이메일주소 {cType === 'CLOSING' && <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>[명세서/계산서]</span>}
                            </label>
                            <input
                              type="text"
                              style={inputStyle}
                              value={sc.email || ''}
                              onChange={e => handleUpdateSiteContact(scIdx, 'email', e.target.value)}
                              placeholder="site@company.com (복수 입력 가능)"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 📅 현장 마감 조건 (명세서 마감일 / 계산서 마감일 / 계산서 발행조건 / 약정 결제조건 / 약정 결제일 / 약정 결제비고) */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px 14px', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  {/* 명세서 마감일 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ ...labelStyle, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>명세서 마감일</span>
                      <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>*청구생성 연동</span>
                    </label>
                    <select
                      style={inputStyle}
                      value={editingSite.statementClosingDay || activeCustomer?.defaultStatementClosingDay || 25}
                      onChange={e => setEditingSite({ ...editingSite, statementClosingDay: Number(e.target.value) })}
                    >
                      {Array.from({ length: 30 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>매월 {day}일</option>
                      ))}
                      <option value={31}>31일 (말일)</option>
                    </select>
                  </div>

                  {/* 계산서 마감일 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>
                      계산서 마감일
                    </label>
                    <select
                      style={inputStyle}
                      value={editingSite.billingDay !== undefined && editingSite.billingDay !== null ? editingSite.billingDay : (activeCustomer?.defaultBillingDay !== undefined ? activeCustomer.defaultBillingDay : 30)}
                      onChange={e => setEditingSite({ ...editingSite, billingDay: Number(e.target.value) })}
                    >
                      <option value={0}>미지정 (역발행 등)</option>
                      {Array.from({ length: 30 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>매월 {day}일</option>
                      ))}
                      <option value={31}>31일 (말일)</option>
                    </select>
                  </div>

                  {/* 계산서 발행 조건 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>
                      계산서 발행조건
                    </label>
                    <select
                      style={inputStyle}
                      value={editingSite.taxInvoiceIssueType || activeCustomer?.defaultTaxInvoiceIssueType || 'FORWARD'}
                      onChange={e => setEditingSite({ ...editingSite, taxInvoiceIssueType: e.target.value as 'FORWARD' | 'REVERSE' })}
                    >
                      <option value="FORWARD">정발행 (기본)</option>
                      <option value="REVERSE">역발행</option>
                    </select>
                  </div>
                </div>

                {/* 약정 결제조건 / 약정 결제일 / 운송료 청구기준 */}
                <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.3fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>약정 결제조건</label>
                    <select
                      style={inputStyle}
                      value={editingSite.paymentMethod || activeCustomer?.defaultPaymentMethod || 'CASH'}
                      onChange={e => setEditingSite({ ...editingSite, paymentMethod: e.target.value as PaymentMethodType })}
                    >
                      {PAYMENT_METHOD_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.value === 'CASH' ? '현금 (기본)' : opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>현장 약정 결제일 (미지정 시 고객사 조건 상속)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '6px' }}>
                      <select
                        style={inputStyle}
                        value={editingSite.paymentDueMonthOffset !== undefined ? editingSite.paymentDueMonthOffset : (activeCustomer?.paymentDueMonthOffset ?? 1)}
                        onChange={e => setEditingSite({ ...editingSite, paymentDueMonthOffset: Number(e.target.value) })}
                      >
                        {PAYMENT_DUE_MONTH_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <select
                        style={inputStyle}
                        value={editingSite.paymentDueDay || activeCustomer?.paymentDueDay || 25}
                        onChange={e => setEditingSite({ ...editingSite, paymentDueDay: Number(e.target.value) })}
                      >
                        {Array.from({ length: 30 }, (_, i) => i + 1).map(day => (
                          <option key={day} value={day}>{day}일</option>
                        ))}
                        <option value={31}>말일</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>운송료 청구기준</label>
                    <select
                      style={inputStyle}
                      value={editingSite.freightBillingStandard || activeCustomer?.defaultFreightBillingStandard || '3/5'}
                      onChange={e => setEditingSite({ ...editingSite, freightBillingStandard: e.target.value as '3/5' | '2/4' })}
                    >
                      <option value="3/5">3/5 기준 (기본 · 3개월 이하 왕복 / 5개월 이하 편도)</option>
                      <option value="2/4">2/4 기준 (2개월 이하 왕복 / 4개월 이하 편도)</option>
                    </select>
                  </div>
                </div>

                {/* 약정 결제비고 (특약조건) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ ...labelStyle, whiteSpace: 'nowrap' }}>약정 결제비고 (특약조건)</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={editingSite.paymentTermsNote !== undefined ? editingSite.paymentTermsNote : (activeCustomer?.defaultPaymentTermsNote || '')}
                    onChange={e => setEditingSite({ ...editingSite, paymentTermsNote: e.target.value })}
                    placeholder="예: 300만원이상 채권, 또는 채권, 익익월 초 등 결제 특약사항 입력"
                  />
                </div>
              </div>

              {/* 🛠️ 현장 옵션 설정 (현장 조회 옵션 상속 + 미상속 4가지 유형별 옵션 추가 버튼) */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '12px 14px', backgroundColor: 'var(--bg-app)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <SlidersHorizontal size={14} className="text-primary" /> 현장 옵션 설정 (유상옵션 / 무상옵션 / 부착물 / 요구사양)
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      출고·입고 검수에 자동 연동
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSiteModal(false);
                        setActiveTab('site_options');
                      }}
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        border: '1px solid var(--primary)',
                        backgroundColor: 'transparent',
                        color: 'var(--primary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Plus size={11} /> 현장별 옵션관리 이동 ➔
                    </button>
                  </div>
                </div>

                {/* 🔍 옵션 그룹(현장) 조회 및 상속 선택 */}
                <div 
                  data-mid="site-option-ref-search-box"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ ...labelStyle, fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Search size={12} color="var(--primary)" />
                      현장(옵션 그룹) 조회 및 옵션 상속 선택
                    </label>
                    {editingSite.siteMasterId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSite(prev => ({
                            ...prev,
                            siteMasterId: null,
                            paidOptions: '',
                            protection: 'NONE',
                            attachments: '',
                            checkedSpecs: {}
                          }));
                          setSelectedRefSiteId('');
                          showToast('상속된 옵션이 초기화되었습니다.');
                        }}
                        style={{
                          padding: '1px 6px',
                          fontSize: '10.5px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-app)',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        상속 초기화
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '6px', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        style={{ ...inputStyle, paddingLeft: '22px', fontSize: '11px', height: '30px' }}
                        placeholder="현장명(옵션 그룹명)/옵션 검색 (초성 지원)"
                        value={siteOptionRefSearch}
                        onChange={e => setSiteOptionRefSearch(e.target.value)}
                      />
                      <Search size={11} style={{ position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    </div>

                    <select
                      style={{ ...inputStyle, fontSize: '11px', height: '30px', fontWeight: editingSite.siteMasterId ? 700 : 400 }}
                      value={editingSite.siteMasterId || ''}
                      onChange={e => {
                        const val = e.target.value;
                        if (val) {
                          const master = (siteMasters || []).find(s => s.id === val);
                          if (master) {
                            setEditingSite(prev => ({
                              ...prev,
                              siteMasterId: master.id,
                              paidOptions: normalizeOptionString(master.paidOptions),
                              protection: normalizeOptionString(master.protection) || 'NONE',
                              attachments: normalizeOptionString(master.attachments || (master.checkedSpecs as any)?.__attachments),
                              checkedSpecs: master.checkedSpecs ? { ...master.checkedSpecs } : {}
                            }));
                            setSelectedRefSiteId(val);
                            showToast(`[${master.name}] 옵션 속성이 상속 적용되었습니다.`);
                          }
                        } else {
                          setEditingSite(prev => ({
                            ...prev,
                            siteMasterId: null
                          }));
                          setSelectedRefSiteId('');
                        }
                      }}
                    >
                      <option value="">-- [선택] 옵션 상속 안함 / 개별 설정 ({optionReferenceSites.length}개 현장그룹) --</option>
                      {optionReferenceSites.map(s => {
                        const paid = s.paidOptions ? s.paidOptions : '';
                        const prot = (s.protection && s.protection !== 'NONE') ? s.protection : '';
                        const att = s.attachments || (s.checkedSpecs as any)?.__attachments || '';
                        const optSummary = [paid, prot, att].filter(Boolean).join(' | ');
                        return (
                          <option key={s.id} value={s.id}>
                            {s.name} {optSummary ? `(${optSummary})` : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {selectedRefSite && (
                    <div 
                      style={{
                        marginTop: '2px',
                        padding: '6px 8px',
                        backgroundColor: 'rgba(37, 99, 235, 0.05)',
                        border: '1px dashed rgba(37, 99, 235, 0.3)',
                        borderRadius: '4px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px',
                        fontSize: '11px'
                      }}
                    >
                      <span style={{ fontWeight: 700, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                        상속 기준 그룹: {selectedRefSite.name}
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', color: 'var(--text-main)' }}>
                        <span><strong>유상옵션:</strong> {selectedRefSite.paidOptions || '없음'}</span>
                        <span>•</span>
                        <span><strong>무상옵션:</strong> {selectedRefSite.protection || 'NONE'}</span>
                        <span>•</span>
                        <span><strong>부착물:</strong> {selectedRefSite.attachments || (selectedRefSite.checkedSpecs as any)?.__attachments || '없음'}</span>
                        <span>•</span>
                        <span><strong>요구사양:</strong> {refCheckedSpecsSummary || '없음'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4가지 유형별 옵션 (상속/적용된 옵션 + 미상속 추가 가능 옵션 버튼) */}
                {(() => {
                  const selectedPaidList = splitOptions(editingSite.paidOptions);
                  const allPaidOpts = standardOptions.filter(o => o.category === 'PAID' && o.isActive);
                  const uninheritedPaidOpts = allPaidOpts.filter(o => !selectedPaidList.includes(o.name));

                  const rawProtList = splitOptions(editingSite.protection).filter(p => p.toUpperCase() !== 'NONE' && p !== '보양 없음' && p !== '보양없음');
                  const allProtOpts = standardOptions.filter(o => o.category === 'PROTECTION' && o.isActive && !o.name.toUpperCase().includes('NONE') && !o.name.includes('보양 없음') && !o.name.includes('보양없음'));
                  const uninheritedProtOpts = allProtOpts.filter(o => !rawProtList.includes(o.name));

                  const selectedAttList = splitOptions(editingSite.attachments);
                  const allAttOpts = standardOptions.filter(o => o.category === 'ATTACHMENT' && o.isActive);
                  const uninheritedAttOpts = allAttOpts.filter(o => !selectedAttList.includes(o.name));

                  const allSpecOpts = standardOptions.filter(o => o.category === 'SPEC' && o.isActive);
                  const selectedSpecOpts = allSpecOpts.filter(o => Boolean(editingSite.checkedSpecs && editingSite.checkedSpecs[o.id]));
                  const uninheritedSpecOpts = allSpecOpts.filter(o => !Boolean(editingSite.checkedSpecs && editingSite.checkedSpecs[o.id]));

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* 1. 유상옵션 */}
                      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ ...labelStyle, margin: 0, color: '#1d4ed8', fontWeight: 700 }}>1. 유상옵션 ({selectedPaidList.length}개 적용)</label>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>미적용 버튼 클릭 시 추가 / 적용 버튼 클릭 시 제외</span>
                        </div>

                        {/* 상속/적용된 유상옵션 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '52px' }}>적용됨:</span>
                          {selectedPaidList.length === 0 ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>없음</span>
                          ) : (
                            selectedPaidList.map(optName => (
                              <button
                                key={optName}
                                type="button"
                                onClick={() => {
                                  const updated = toggleOptionInString(editingSite.paidOptions, optName);
                                  setEditingSite({ ...editingSite, paidOptions: updated });
                                }}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px solid #2563eb',
                                  backgroundColor: 'rgba(37, 99, 235, 0.14)',
                                  color: '#1d4ed8',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap'
                                }}
                                title="클릭하여 제외"
                              >
                                ✓ {optName} <X size={10} />
                              </button>
                            ))
                          )}
                        </div>

                        {/* 미상속(추가 가능) 유상옵션 버튼 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '52px' }}>추가가능:</span>
                          {uninheritedPaidOpts.length === 0 ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>모두 적용됨</span>
                          ) : (
                            uninheritedPaidOpts.map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  const updated = toggleOptionInString(editingSite.paidOptions, opt.name);
                                  setEditingSite({ ...editingSite, paidOptions: updated });
                                }}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px dashed var(--border-color)',
                                  backgroundColor: 'var(--bg-app)',
                                  color: 'var(--text-main)',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                + {opt.name}
                              </button>
                            ))
                          )}
                        </div>
                      </div>

                      {/* 2. 무상옵션 (보양) */}
                      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ ...labelStyle, margin: 0, color: '#047857', fontWeight: 700 }}>2. 무상옵션 (보양) ({rawProtList.length}개 적용)</label>
                          {rawProtList.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setEditingSite({ ...editingSite, protection: 'NONE' })}
                              style={{ fontSize: '10.5px', padding: '1px 6px', borderRadius: '3px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                              무상옵션 없음 전환
                            </button>
                          )}
                        </div>

                        {/* 상속/적용된 무상옵션 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '52px' }}>적용됨:</span>
                          {rawProtList.length === 0 ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>무상옵션 없음</span>
                          ) : (
                            rawProtList.map(optName => (
                              <button
                                key={optName}
                                type="button"
                                onClick={() => {
                                  const nextArr = rawProtList.filter(item => item !== optName);
                                  setEditingSite({ ...editingSite, protection: nextArr.length > 0 ? nextArr.join(', ') : 'NONE' });
                                }}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px solid #059669',
                                  backgroundColor: 'rgba(5, 150, 105, 0.14)',
                                  color: '#047857',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap'
                                }}
                                title="클릭하여 제외"
                              >
                                ✓ {optName} <X size={10} />
                              </button>
                            ))
                          )}
                        </div>

                        {/* 미상속(추가 가능) 무상옵션 버튼 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '52px' }}>추가가능:</span>
                          {uninheritedProtOpts.length === 0 ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>모두 적용됨</span>
                          ) : (
                            uninheritedProtOpts.map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  const nextArr = [...rawProtList, opt.name];
                                  setEditingSite({ ...editingSite, protection: nextArr.join(', ') });
                                }}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px dashed var(--border-color)',
                                  backgroundColor: 'var(--bg-app)',
                                  color: 'var(--text-main)',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                + {opt.name}
                              </button>
                            ))
                          )}
                        </div>
                      </div>

                      {/* 3. 부착물 */}
                      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ ...labelStyle, margin: 0, color: '#6d28d9', fontWeight: 700 }}>3. 부착물 ({selectedAttList.length}개 적용)</label>
                        </div>

                        {/* 상속/적용된 부착물 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '52px' }}>적용됨:</span>
                          {selectedAttList.length === 0 ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>없음</span>
                          ) : (
                            selectedAttList.map(optName => (
                              <button
                                key={optName}
                                type="button"
                                onClick={() => {
                                  const updated = toggleOptionInString(editingSite.attachments, optName);
                                  setEditingSite({ ...editingSite, attachments: updated });
                                }}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px solid #7c3aed',
                                  backgroundColor: 'rgba(124, 58, 237, 0.14)',
                                  color: '#6d28d9',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap'
                                }}
                                title="클릭하여 제외"
                              >
                                ✓ {optName} <X size={10} />
                              </button>
                            ))
                          )}
                        </div>

                        {/* 미상속(추가 가능) 부착물 버튼 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '52px' }}>추가가능:</span>
                          {uninheritedAttOpts.length === 0 ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>모두 적용됨</span>
                          ) : (
                            uninheritedAttOpts.map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  const updated = toggleOptionInString(editingSite.attachments, opt.name);
                                  setEditingSite({ ...editingSite, attachments: updated });
                                }}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px dashed var(--border-color)',
                                  backgroundColor: 'var(--bg-app)',
                                  color: 'var(--text-main)',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                + {opt.name}
                              </button>
                            ))
                          )}
                        </div>
                      </div>

                      {/* 4. 현장 요구사양 */}
                      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label style={{ ...labelStyle, margin: 0, color: '#b45309', fontWeight: 700 }}>4. 현장 요구사양 ({selectedSpecOpts.length}개 적용)</label>
                        </div>

                        {/* 상속/적용된 요구사양 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-secondary)', minWidth: '52px' }}>적용됨:</span>
                          {selectedSpecOpts.length === 0 ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>없음</span>
                          ) : (
                            selectedSpecOpts.map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  const updated = {
                                    ...(editingSite.checkedSpecs || {}),
                                    [opt.id]: false
                                  };
                                  setEditingSite({ ...editingSite, checkedSpecs: updated });
                                }}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px solid #d97706',
                                  backgroundColor: 'rgba(217, 119, 6, 0.14)',
                                  color: '#b45309',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  whiteSpace: 'nowrap'
                                }}
                                title="클릭하여 제외"
                              >
                                ✓ {opt.name} <X size={10} />
                              </button>
                            ))
                          )}
                        </div>

                        {/* 미상속(추가 가능) 요구사양 버튼 */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', minWidth: '52px' }}>추가가능:</span>
                          {uninheritedSpecOpts.length === 0 ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>모두 적용됨</span>
                          ) : (
                            uninheritedSpecOpts.map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  const updated = {
                                    ...(editingSite.checkedSpecs || {}),
                                    [opt.id]: true
                                  };
                                  setEditingSite({ ...editingSite, checkedSpecs: updated });
                                }}
                                style={{
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  border: '1px dashed var(--border-color)',
                                  backgroundColor: 'var(--bg-app)',
                                  color: 'var(--text-main)',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                + {opt.name}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              </div>

            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: (editingSite.id && canSave) ? 'space-between' : 'flex-end', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              {editingSite.id && canSave && (
                <button data-hs-trigger="Delete"
                  type="button"
                  onClick={() => handleDeleteSite(editingSite.id!, editingSite.name || '')}
                  style={{
                    padding: '5px 14px',
                    fontSize: '12px',
                    backgroundColor: 'var(--danger-color, #ef4444)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Trash2 size={13} />
                  현장 삭제
                </button>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowSiteModal(false)} style={{ padding: '5px 14px', fontSize: '12px' }}>취소</button>
                <button data-hs-trigger="Save" type="submit" className="btn-primary" style={{ padding: '5px 16px', fontSize: '12px' }}>저장</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ⑨ 입금 계좌 등록/수정 모달 */}
      {showAccountModal && editingAccount && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          padding: '20px'
        }}>
          <form onSubmit={handleSaveAccountSubmit} className="card" style={{ width: '100%', maxWidth: '420px', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                {editingAccount.id ? '고객 입금 계좌 수정' : '고객 입금 계좌 신규 등록'}
              </h3>
              <button type="button" onClick={() => setShowAccountModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>은행명 *</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={editingAccount.bankName || ''}
                    onChange={e => setEditingAccount({ ...editingAccount, bankName: e.target.value })}
                    placeholder="국민, 신한, 농협"
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>예금주명</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={editingAccount.accountHolder || ''}
                    onChange={e => setEditingAccount({ ...editingAccount, accountHolder: e.target.value })}
                    placeholder={activeCustomer?.name || '예금주'}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>계좌번호 *</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={editingAccount.accountNumber || ''}
                  onChange={e => setEditingAccount({ ...editingAccount, accountNumber: e.target.value })}
                  placeholder="123-456-789012"
                  required
                />
              </div>

              <div>
                <label style={labelStyle}>메모 (용도 구분)</label>
                <input
                  type="text"
                  style={inputStyle}
                  value={editingAccount.memo || ''}
                  onChange={e => setEditingAccount({ ...editingAccount, memo: e.target.value })}
                  placeholder="주거래 계좌, 현장 전용 입금 계좌"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowAccountModal(false)} style={{ padding: '5px 14px', fontSize: '12px' }}>취소</button>
              <button data-hs-trigger="Save" type="submit" className="btn-primary" style={{ padding: '5px 16px', fontSize: '12px' }}>저장</button>
            </div>
          </form>
        </div>
      )}

      {/* ⑩ 고객사 기본 옵션 관리 모달 */}
      {showCustOptionModal && activeCustomer && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} color="#0070C0" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                  고객사 기본 옵션 관리 - [{activeCustomer.name}]
                </h3>
              </div>
              <button type="button" onClick={() => setShowCustOptionModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px' }}>
              {/* 1. 기본 유상옵션 */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px', backgroundColor: 'var(--bg-app)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...labelStyle, fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    기본 유상옵션 (표준 항목 토글 및 직접 입력)
                  </label>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    선택: {splitOptions(custOptionForm.defaultPaidOptions).length}개
                  </span>
                </div>
                
                {/* 표준 유상옵션 칩 목록 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                  {standardOptions.filter(o => o.category === 'PAID' && o.isActive).map(opt => {
                    const isSelected = splitOptions(custOptionForm.defaultPaidOptions).includes(opt.name);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const updated = toggleOptionInString(custOptionForm.defaultPaidOptions, opt.name);
                          setCustOptionForm({ ...custOptionForm, defaultPaidOptions: updated });
                        }}
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          border: isSelected ? '1px solid #2563eb' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.15)' : 'var(--bg-card)',
                          color: isSelected ? '#1d4ed8' : 'var(--text-main)',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>{opt.name}</span>
                        {opt.defaultPrice ? (
                          <span style={{ fontSize: '11px', color: isSelected ? '#2563eb' : 'var(--text-muted)' }}>
                            ({opt.defaultPrice.toLocaleString()}원)
                          </span>
                        ) : null}
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={labelStyle}>유상옵션 설정값 (쉼표 구분 직접 편집 가능)</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={custOptionForm.defaultPaidOptions}
                    onChange={e => setCustOptionForm({ ...custOptionForm, defaultPaidOptions: e.target.value })}
                    placeholder="예: 협착방지봉 / 상부센서, 4면 철망 설치"
                  />
                </div>
              </div>

              {/* 2. 기본 무상옵션 */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px', backgroundColor: 'var(--bg-app)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...labelStyle, fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    기본 무상옵션
                  </label>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    현재: {custOptionForm.defaultProtection || '미지정'}
                  </span>
                </div>

                {/* 표준 무상옵션 칩 목록 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                  {standardOptions.filter(o => o.category === 'PROTECTION' && o.isActive).map(opt => {
                    const isSelected = splitOptions(custOptionForm.defaultProtection).includes(opt.name);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const updated = toggleOptionInString(custOptionForm.defaultProtection, opt.name);
                          setCustOptionForm({ ...custOptionForm, defaultProtection: updated });
                        }}
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          border: isSelected ? '1px solid #059669' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'rgba(5, 150, 105, 0.15)' : 'var(--bg-card)',
                          color: isSelected ? '#047857' : 'var(--text-main)',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>{opt.name}</span>
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={labelStyle}>무상옵션 설정값</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={custOptionForm.defaultProtection}
                    onChange={e => setCustOptionForm({ ...custOptionForm, defaultProtection: e.target.value })}
                    placeholder="예: 4면 철망 보양, NONE"
                  />
                </div>
              </div>

              {/* 3. 기본 부착물 */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px', backgroundColor: 'var(--bg-app)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...labelStyle, fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                    기본 부착물
                  </label>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    선택: {splitOptions(custOptionForm.defaultAttachments).length}개
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
                  {standardOptions.filter(o => o.category === 'ATTACHMENT' && o.isActive).map(opt => {
                    const isSelected = splitOptions(custOptionForm.defaultAttachments).includes(opt.name);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const updated = toggleOptionInString(custOptionForm.defaultAttachments, opt.name);
                          setCustOptionForm({ ...custOptionForm, defaultAttachments: updated });
                        }}
                        style={{
                          padding: '3px 8px',
                          fontSize: '11px',
                          borderRadius: '4px',
                          border: isSelected ? '1px solid #7c3aed' : '1px solid var(--border-color)',
                          backgroundColor: isSelected ? 'rgba(124, 58, 237, 0.15)' : 'var(--bg-card)',
                          color: isSelected ? '#6d28d9' : 'var(--text-main)',
                          fontWeight: isSelected ? 700 : 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span>{opt.name}</span>
                        {isSelected && <Check size={12} />}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <label style={labelStyle}>부착물 설정값</label>
                  <input
                    type="text"
                    style={inputStyle}
                    value={custOptionForm.defaultAttachments}
                    onChange={e => setCustOptionForm({ ...custOptionForm, defaultAttachments: e.target.value })}
                    placeholder="예: 인증서, 제원표, 보험증권, 반입전 체크리스트"
                  />
                </div>
              </div>

              {/* 4. 고객사 특이사항 메모 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <label style={labelStyle}>고객사 옵션/출고 특약 메모</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '44px' }}
                  value={custOptionForm.specialNotes}
                  onChange={e => setCustOptionForm({ ...custOptionForm, specialNotes: e.target.value })}
                  placeholder="예: 유상옵션 비용 월말 청구서 통합 합산, 한솔렌탈 배차건 등"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowCustOptionModal(false)} style={{ padding: '6px 14px', fontSize: '12px' }}>취소</button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button data-hs-trigger="Save"
                  type="button"
                  onClick={() => handleSaveCustOptions(false)}
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '12px', border: '1px solid var(--primary)', color: 'var(--primary)' }}
                >
                  고객사 기본값만 저장
                </button>
                <button data-hs-trigger="Save"
                  type="button"
                  onClick={() => handleSaveCustOptions(true)}
                  className="btn-primary"
                  style={{ padding: '6px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <Zap size={13} /> 저장 및 전체 현장 일괄 전파 ({customerSites.length}개소)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ⑪ 현장 전용 옵션 관리 모달 */}
      {showSiteOptionModal && editingSiteOption && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={18} color="#10b981" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>
                    현장 전용 옵션 설정 - [{editingSiteOption.name}]
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{editingSiteOption.address}</span>
                </div>
              </div>
              <button type="button" onClick={() => setShowSiteOptionModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginBottom: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setShowSiteOptionModal(false);
                  handleNavigateToSiteOptionManage(editingSiteOption.id);
                }}
                style={{
                  padding: '3px 9px',
                  fontSize: '11px',
                  borderRadius: '4px',
                  border: '1px solid #2563eb',
                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                  color: '#1d4ed8',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <SlidersHorizontal size={12} /> 현장별 옵션 관리 ➔
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
              {/* 🔍 현장별 옵션관리 등록 옵션 그룹 검색 및 상속 적용 */}
              <div 
                data-mid="site-option-ref-search-box-modal"
                style={{
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ ...labelStyle, fontSize: '11px', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Search size={12} color="var(--primary)" />
                    옵션 그룹 상속 선택 (현장별 옵션관리)
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    옵션 그룹의 유상/무상/부착물/요구사양 속성 복사
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr auto', gap: '6px', alignItems: 'center' }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      style={{ ...inputStyle, paddingLeft: '22px', fontSize: '11px', height: '28px' }}
                      placeholder="옵션 그룹명/옵션 검색 (초성 지원)"
                      value={siteOptionRefSearch}
                      onChange={e => setSiteOptionRefSearch(e.target.value)}
                    />
                    <Search size={11} style={{ position: 'absolute', left: '7px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  </div>

                  <select
                    style={{ ...inputStyle, fontSize: '11px', height: '28px' }}
                    value={selectedRefSiteId}
                    onChange={e => setSelectedRefSiteId(e.target.value)}
                  >
                    <option value="">-- [선택] 상속할 옵션 그룹 선택 ({optionReferenceSites.length}개) --</option>
                    {optionReferenceSites.map(s => {
                      const paid = s.paidOptions ? s.paidOptions : '';
                      const prot = (s.protection && s.protection !== 'NONE') ? s.protection : '';
                      const att = s.attachments || (s.checkedSpecs as any)?.__attachments || '';
                      const optSummary = [paid, prot, att].filter(Boolean).join(' | ');
                      return (
                        <option key={s.id} value={s.id}>
                          {s.name} {optSummary ? `(${optSummary})` : ''}
                        </option>
                      );
                    })}
                  </select>

                  <button
                    type="button"
                    onClick={handleApplyRefSiteOptionsToOptionForm}
                    disabled={!selectedRefSiteId}
                    style={{
                      padding: '0 10px',
                      height: '28px',
                      fontSize: '11px',
                      fontWeight: 600,
                      backgroundColor: selectedRefSiteId ? '#2563eb' : 'var(--bg-card)',
                      color: selectedRefSiteId ? '#ffffff' : 'var(--text-muted)',
                      border: selectedRefSiteId ? '1px solid #1d4ed8' : '1px solid var(--border-color)',
                      borderRadius: '4px',
                      cursor: selectedRefSiteId ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                    title="선택한 옵션 그룹의 속성을 현재 현장에 상속 적용"
                  >
                    <Copy size={12} />
                    옵션 상속 적용
                  </button>
                </div>

                {selectedRefSite && (
                  <div 
                    style={{
                      marginTop: '2px',
                      padding: '6px 8px',
                      backgroundColor: 'rgba(37, 99, 235, 0.05)',
                      border: '1px dashed rgba(37, 99, 235, 0.3)',
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      fontSize: '11.5px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                        선택된 옵션 그룹: {selectedRefSite.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', color: 'var(--text-main)', marginTop: '2px' }}>
                      <span>
                        <strong>유상옵션:</strong> {selectedRefSite.paidOptions || '없음'}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>무상옵션:</strong> {selectedRefSite.protection || '없음'}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>부착물:</strong> {selectedRefSite.attachments || (selectedRefSite.checkedSpecs as any)?.__attachments || '없음'}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>요구사양:</strong> {refCheckedSpecsSummary || '없음'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 1. 현장 전용 유상옵션 */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px', backgroundColor: 'var(--bg-app)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, fontSize: '12px', fontWeight: 700, color: '#1d4ed8', margin: 0 }}>
                    1. 유상옵션
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    적용: {splitOptions(siteOptionForm.paidOptions).length}건
                  </span>
                </div>
                {(() => {
                  const appliedList = splitOptions(siteOptionForm.paidOptions);
                  const activeMasterOpts = standardOptions.filter(o => o.category === 'PAID' && o.isActive);
                  const uninheritedOpts = activeMasterOpts.filter(o => !appliedList.includes(o.name));
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', minHeight: '24px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#1d4ed8', marginRight: '2px' }}>적용됨:</span>
                        {appliedList.length === 0 ? (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>없음 (비어있으면 고객사 기본값 적용)</span>
                        ) : (
                          appliedList.map(optName => (
                            <button
                              key={`modal-paid-app-${optName}`}
                              type="button"
                              onClick={() => {
                                const updated = toggleOptionInString(siteOptionForm.paidOptions, optName);
                                setSiteOptionForm({ ...siteOptionForm, paidOptions: updated });
                              }}
                              style={{
                                padding: '2px 8px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px solid #2563eb',
                                backgroundColor: 'rgba(37, 99, 235, 0.15)',
                                color: '#1d4ed8',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              ✓ {optName} <X size={11} />
                            </button>
                          ))
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '5px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '2px' }}>추가가능:</span>
                        {uninheritedOpts.length === 0 ? (
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>모든 표준 유상옵션이 적용되었습니다.</span>
                        ) : (
                          uninheritedOpts.map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                const updated = toggleOptionInString(siteOptionForm.paidOptions, opt.name);
                                setSiteOptionForm({ ...siteOptionForm, paidOptions: updated });
                              }}
                              style={{
                                padding: '2px 8px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px dashed var(--border-color)',
                                backgroundColor: 'var(--bg-card)',
                                color: 'var(--text-main)',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Plus size={10} color="#2563eb" /> {opt.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 2. 현장 전용 무상옵션 */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px', backgroundColor: 'var(--bg-app)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, fontSize: '12px', fontWeight: 700, color: '#047857', margin: 0 }}>
                    2. 무상옵션
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    적용: {splitOptions(siteOptionForm.protection).filter(v => v !== 'NONE').length}건
                  </span>
                </div>
                {(() => {
                  const appliedList = splitOptions(siteOptionForm.protection).filter(v => v !== 'NONE');
                  const activeMasterOpts = standardOptions.filter(o => o.category === 'PROTECTION' && o.isActive);
                  const uninheritedOpts = activeMasterOpts.filter(o => !appliedList.includes(o.name));
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', minHeight: '24px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#047857', marginRight: '2px' }}>적용됨:</span>
                        {appliedList.length === 0 ? (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>없음 (비어있으면 고객사 기본값 적용)</span>
                        ) : (
                          appliedList.map(optName => (
                            <button
                              key={`modal-prot-app-${optName}`}
                              type="button"
                              onClick={() => {
                                const updated = toggleOptionInString(siteOptionForm.protection, optName);
                                setSiteOptionForm({ ...siteOptionForm, protection: updated });
                              }}
                              style={{
                                padding: '2px 8px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px solid #059669',
                                backgroundColor: 'rgba(5, 150, 105, 0.15)',
                                color: '#047857',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              ✓ {optName} <X size={11} />
                            </button>
                          ))
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '5px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '2px' }}>추가가능:</span>
                        {uninheritedOpts.length === 0 ? (
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>모든 표준 무상옵션이 적용되었습니다.</span>
                        ) : (
                          uninheritedOpts.map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                const baseStr = siteOptionForm.protection === 'NONE' ? '' : siteOptionForm.protection;
                                const updated = toggleOptionInString(baseStr, opt.name);
                                setSiteOptionForm({ ...siteOptionForm, protection: updated });
                              }}
                              style={{
                                padding: '2px 8px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px dashed var(--border-color)',
                                backgroundColor: 'var(--bg-card)',
                                color: 'var(--text-main)',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Plus size={10} color="#059669" /> {opt.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 3. 현장 전용 부착물 */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px', backgroundColor: 'var(--bg-app)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, fontSize: '12px', fontWeight: 700, color: '#6d28d9', margin: 0 }}>
                    3. 부착물
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    적용: {splitOptions(siteOptionForm.attachments).length}건
                  </span>
                </div>
                {(() => {
                  const appliedList = splitOptions(siteOptionForm.attachments);
                  const activeMasterOpts = standardOptions.filter(o => o.category === 'ATTACHMENT' && o.isActive);
                  const uninheritedOpts = activeMasterOpts.filter(o => !appliedList.includes(o.name));
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', minHeight: '24px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#6d28d9', marginRight: '2px' }}>적용됨:</span>
                        {appliedList.length === 0 ? (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>없음</span>
                        ) : (
                          appliedList.map(optName => (
                            <button
                              key={`modal-att-app-${optName}`}
                              type="button"
                              onClick={() => {
                                const updated = toggleOptionInString(siteOptionForm.attachments, optName);
                                setSiteOptionForm({ ...siteOptionForm, attachments: updated });
                              }}
                              style={{
                                padding: '2px 8px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px solid #7c3aed',
                                backgroundColor: 'rgba(124, 58, 237, 0.15)',
                                color: '#6d28d9',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              ✓ {optName} <X size={11} />
                            </button>
                          ))
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '5px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '2px' }}>추가가능:</span>
                        {uninheritedOpts.length === 0 ? (
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>모든 표준 부착물이 적용되었습니다.</span>
                        ) : (
                          uninheritedOpts.map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                const updated = toggleOptionInString(siteOptionForm.attachments, opt.name);
                                setSiteOptionForm({ ...siteOptionForm, attachments: updated });
                              }}
                              style={{
                                padding: '2px 8px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px dashed var(--border-color)',
                                backgroundColor: 'var(--bg-card)',
                                color: 'var(--text-main)',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Plus size={10} color="#7c3aed" /> {opt.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 4. 현장 전용 요구사양 */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '10px 12px', backgroundColor: 'var(--bg-app)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ ...labelStyle, fontSize: '12px', fontWeight: 700, color: '#b45309', margin: 0 }}>
                    4. 현장 요구사양
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    적용: {standardOptions.filter(o => o.category === 'SPEC' && o.isActive && siteOptionForm.checkedSpecs?.[o.id]).length}건
                  </span>
                </div>
                {(() => {
                  const activeSpecOpts = standardOptions.filter(o => o.category === 'SPEC' && o.isActive);
                  const appliedSpecs = activeSpecOpts.filter(o => Boolean(siteOptionForm.checkedSpecs && siteOptionForm.checkedSpecs[o.id]));
                  const uninheritedSpecs = activeSpecOpts.filter(o => !Boolean(siteOptionForm.checkedSpecs && siteOptionForm.checkedSpecs[o.id]));
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', minHeight: '24px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#b45309', marginRight: '2px' }}>적용됨:</span>
                        {appliedSpecs.length === 0 ? (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>없음</span>
                        ) : (
                          appliedSpecs.map(opt => (
                            <button
                              key={`modal-spec-app-${opt.id}`}
                              type="button"
                              onClick={() => {
                                const updated = {
                                  ...(siteOptionForm.checkedSpecs || {}),
                                  [opt.id]: false
                                };
                                setSiteOptionForm({ ...siteOptionForm, checkedSpecs: updated });
                              }}
                              style={{
                                padding: '2px 8px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px solid #d97706',
                                backgroundColor: 'rgba(217, 119, 6, 0.15)',
                                color: '#b45309',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              ✓ {opt.name} <X size={11} />
                            </button>
                          ))
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '5px' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '2px' }}>추가가능:</span>
                        {uninheritedSpecs.length === 0 ? (
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>모든 표준 요구사양이 적용되었습니다.</span>
                        ) : (
                          uninheritedSpecs.map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                const updated = {
                                  ...(siteOptionForm.checkedSpecs || {}),
                                  [opt.id]: true
                                };
                                setSiteOptionForm({ ...siteOptionForm, checkedSpecs: updated });
                              }}
                              style={{
                                padding: '2px 8px',
                                fontSize: '11px',
                                borderRadius: '4px',
                                border: '1px dashed var(--border-color)',
                                backgroundColor: 'var(--bg-card)',
                                color: 'var(--text-main)',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Plus size={10} color="#d97706" /> {opt.name}
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowSiteOptionModal(false)} style={{ padding: '5px 14px', fontSize: '12px' }}>취소</button>
              <button data-hs-trigger="Save" type="button" onClick={handleSaveSiteOptions} className="btn-primary" style={{ padding: '5px 18px', fontSize: '12px' }}>현장 옵션 저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ⑫ 전사 표준 옵션 마스터 CRUD 모달 */}
      {showOptionMasterModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
          padding: '20px'
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '780px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={18} color="#0284c7" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                  전사 표준 옵션 마스터 관리
                </h3>
              </div>
              <button type="button" onClick={() => { setShowOptionMasterModal(false); setEditingOption(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={18} /></button>
            </div>

            {/* 필터 탭 & 신규 등록 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['ALL', 'PAID', 'PROTECTION', 'ATTACHMENT', 'SPEC'] as const).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setOptionCategoryFilter(cat)}
                    style={{
                      padding: '4px 10px',
                      fontSize: '11.5px',
                      borderRadius: '4px',
                      border: optionCategoryFilter === cat ? '1px solid #0284c7' : '1px solid var(--border-color)',
                      backgroundColor: optionCategoryFilter === cat ? 'var(--primary-light)' : 'var(--bg-app)',
                      color: optionCategoryFilter === cat ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: optionCategoryFilter === cat ? 700 : 400,
                      cursor: 'pointer'
                    }}
                  >
                    {cat === 'ALL' ? '전체' : cat === 'PAID' ? '유상옵션' : cat === 'PROTECTION' ? '무상옵션' : cat === 'ATTACHMENT' ? '부착물' : '요구사양'}
                  </button>
                ))}
              </div>

              {editingOption === null && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button data-hs-trigger="Register"
                    type="button"
                    onClick={() => handleOpenAddOption('PAID')}
                    className="btn-primary"
                    style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Plus size={12} /> 유상옵션 등록
                  </button>
                  <button data-hs-trigger="Register"
                    type="button"
                    onClick={() => handleOpenAddOption('PROTECTION')}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #059669', color: 'var(--success)' }}
                  >
                    <Plus size={12} /> 무상옵션 등록
                  </button>
                  <button data-hs-trigger="Register"
                    type="button"
                    onClick={() => handleOpenAddOption('ATTACHMENT')}
                    className="btn-secondary"
                    style={{ padding: '4px 10px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '4px', border: '1px solid #7c3aed', color: '#7c3aed' }}
                  >
                    <Plus size={12} /> 부착물 등록
                  </button>
                </div>
              )}
            </div>

            {/* 등록/수정 서브 폼 */}
            {editingOption !== null && (
              <form onSubmit={handleSaveOptionSubmit} style={{ marginBottom: '14px', padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', border: '1px solid var(--primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--primary)' }}>
                    {editingOption.id ? '옵션 항목 수정' : '신규 옵션 항목 등록'}
                  </span>
                  <button type="button" onClick={() => setEditingOption(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '120px 1.5fr 120px 80px', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={labelStyle}>분류 *</label>
                    <select
                      style={inputStyle}
                      value={editingOption.category || 'PAID'}
                      onChange={e => setEditingOption({ ...editingOption, category: e.target.value as any })}
                    >
                      <option value="PAID">유상옵션</option>
                      <option value="PROTECTION">무상옵션</option>
                      <option value="ATTACHMENT">부착물</option>
                      <option value="SPEC">요구사양</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>옵션 품목명 *</label>
                    <input
                      type="text"
                      style={inputStyle}
                      value={editingOption.name || ''}
                      onChange={e => setEditingOption({ ...editingOption, name: e.target.value })}
                      placeholder="예: 협착방지봉 / 상부센서"
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>기본 단가 (원)</label>
                    <input
                      type="number"
                      style={inputStyle}
                      value={editingOption.defaultPrice ?? 0}
                      onChange={e => setEditingOption({ ...editingOption, defaultPrice: Number(e.target.value) })}
                      placeholder="50000"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>단위</label>
                    <select
                      style={inputStyle}
                      value={editingOption.unit || '월'}
                      onChange={e => setEditingOption({ ...editingOption, unit: e.target.value })}
                    >
                      <option value="월">월</option>
                      <option value="건">건</option>
                      <option value="대">대</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '8px', marginBottom: '8px' }}>
                  <div>
                    <label style={labelStyle}>규격 및 설명</label>
                    <input
                      type="text"
                      style={inputStyle}
                      value={editingOption.description || ''}
                      onChange={e => setEditingOption({ ...editingOption, description: e.target.value })}
                      placeholder="예: 상단 4개소 감지센서 및 비상정지 연동"
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>사용 여부</label>
                    <select
                      style={inputStyle}
                      value={editingOption.isActive !== false ? 'true' : 'false'}
                      onChange={e => setEditingOption({ ...editingOption, isActive: e.target.value === 'true' })}
                    >
                      <option value="true">사용중</option>
                      <option value="false">미사용</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setEditingOption(null)} style={{ padding: '4px 12px', fontSize: '11.5px' }}>취소</button>
                  <button data-hs-trigger="Save" type="submit" className="btn-primary" style={{ padding: '4px 16px', fontSize: '11.5px' }}>저장</button>
                </div>
              </form>
            )}

            {/* 표준 옵션 테이블 */}
            <div className="table-container" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '420px', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--bg-app)' }}>
                  <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>분류</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap' }}>옵션 품목명</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>기본 단가</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>단위</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left' }}>규격 / 설명</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>상태</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {standardOptions
                    .filter(o => optionCategoryFilter === 'ALL' || o.category === optionCategoryFilter)
                    .map(opt => (
                      <tr key={opt.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: opt.isActive ? 1 : 0.5 }}>
                        <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: opt.category === 'PAID' ? 'rgba(59, 130, 246, 0.12)' : opt.category === 'PROTECTION' ? 'rgba(16, 185, 129, 0.12)' : opt.category === 'ATTACHMENT' ? 'rgba(124, 58, 237, 0.12)' : 'rgba(217, 119, 6, 0.12)',
                            color: opt.category === 'PAID' ? '#2563eb' : opt.category === 'PROTECTION' ? '#059669' : opt.category === 'ATTACHMENT' ? '#7c3aed' : '#d97706',
                            border: opt.category === 'PAID' ? '1px solid rgba(59, 130, 246, 0.3)' : opt.category === 'PROTECTION' ? '1px solid rgba(16, 185, 129, 0.3)' : opt.category === 'ATTACHMENT' ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid rgba(217, 119, 6, 0.3)'
                          }}>
                            {opt.category === 'PAID' ? '유상옵션' : opt.category === 'PROTECTION' ? '무상옵션' : opt.category === 'ATTACHMENT' ? '부착물' : '요구사양'}
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                          {opt.name}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: opt.defaultPrice ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {opt.defaultPrice ? `${opt.defaultPrice.toLocaleString()}원` : '-'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {opt.unit || '월'}
                        </td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', fontSize: '11px' }}>
                          {opt.description || '-'}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span className={`badge ${opt.isActive ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '9.5px' }}>
                            {opt.isActive ? '사용중' : '미사용'}
                          </span>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => handleOpenEditOption(opt)}
                              style={{ padding: '1px 5px', fontSize: '11.5px' }}
                            >
                              수정
                            </button>
                            <button data-hs-trigger="Delete"
                              type="button"
                              onClick={() => handleDeleteOption(opt)}
                              style={{ padding: '1px 5px', fontSize: '11.5px', border: '1px solid var(--border-color)', borderRadius: '3px', backgroundColor: 'transparent', color: 'var(--danger)', cursor: 'pointer' }}
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
              <button type="button" className="btn-secondary" onClick={() => { setShowOptionMasterModal(false); setEditingOption(null); }} style={{ padding: '5px 16px', fontSize: '12px' }}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🏢 고객/현장/담당자 엑셀 일괄 등록 모달 */}
      <ExcelUploadModal
        isOpen={custExcelModalOpen}
        onClose={() => setCustExcelModalOpen(false)}
        title="고객사 및 현장/담당자 엑셀 일괄 등록"
        templateFileName="고객사_현장_일괄등록"
        columns={custExcelColumns}
        onUpload={handleBatchUploadCustomers}
      />

      {/* 📇 명함/이메일 AI 고객/담당자 자동 등록 모달 */}
      <ContactCardOcrModal
        isOpen={showContactCardModal}
        onClose={() => {
          setShowContactCardModal(false);
          setTargetContactCardCustId(undefined);
        }}
        onSuccess={handleContactCardSuccess}
        targetCustomerId={targetContactCardCustId}
      />
    </div>
  );
};

// 헬퍼 스타일
const labelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-muted)',
  fontWeight: '600',
  display: 'block',
  marginBottom: '3px',
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: '12px',
  borderRadius: '4px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-app)',
  color: 'var(--text-main)',
  boxSizing: 'border-box',
};



