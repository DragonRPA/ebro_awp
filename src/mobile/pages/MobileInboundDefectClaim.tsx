// @ts-nocheck
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  ClaimNegotiationStatus,
  InboundClaimDefectItem,
  InboundDefectClaimMeta,
  InspectionChecklistItem,
} from '../../services/db';
import {
  getNegotiationStatusBadgeInfo,
  lookupRecentInboundInfoByAsset,
  resolveReceivableClaimMeta,
} from '../../utils/inboundDefectClaimHelper';
import {
  downloadRepairClaimPdf,
  sendRepairClaimPdfEmail,
  shareRepairClaimPdfMobile,
} from '../../utils/repairClaimPdfBuilder';
import { getSiteContactList, SiteContactDisplayItem } from '../../modules/dispatchRequest/dispatchOrderParser';
import { matchHangul } from '../../utils/hangulSearch';
import { CameraUploader } from '../components/CameraUploader';
import {
  Search,
  Plus,
  Trash2,
  FileText,
  Share2,
  Mail,
  Download,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  Calendar,
  Building2,
  MapPin,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Save,
  Check,
  Edit3,
  Phone,
  X,
} from 'lucide-react';

interface MobileInboundDefectClaimProps {
  onNavigate?: (tab: any) => void;
  initialViewMode?: 'REGISTER' | 'NEGOTIATE';
  initialReceivableId?: string;
}

const DEFAULT_CATEGORIES = [
  '외관/파손',
  '전장/배터리',
  '유압/실린더',
  '주행/조향',
  '안전장치',
  '타이어/바퀴',
  '기타',
];

const QUICK_MEMO_CHIPS = [
  '현장담당 통화 합의',
  '일부 감액 합의',
  '장기거래 감액',
  '당사 귀책 면제',
];

export const MobileInboundDefectClaim: React.FC<MobileInboundDefectClaimProps> = ({
  onNavigate,
  initialViewMode,
  initialReceivableId,
}) => {
  const {
    currentUser,
    assets,
    assetInOutLogs,
    contractAssets,
    contracts,
    deliveries,
    repairs,
    customers,
    sites,
    contacts,
    users,
    receivables,
    inspectionChecklistItems,
    saveInspectionChecklistItem,
    registerInboundDefectClaimReceivable,
    updateReceivableClaimNegotiation,
    navigationPayload,
    setNavigationPayload,
    showErrorModal,
    showNoticeModal,
  } = useApp();

  // 영업부 모드는 수리비용 확인·견적전달·통화협상·최종결정 전용 화면으로 동작
  const isSalesOnlyMode = initialViewMode === 'NEGOTIATE';

  const defaultMode: 'REGISTER' | 'NEGOTIATE' =
    initialViewMode ||
    (initialReceivableId
      ? 'NEGOTIATE'
      : currentUser?.department === 'SALES'
        ? 'NEGOTIATE'
        : 'REGISTER');

  const [viewMode, setViewMode] = useState<'REGISTER' | 'NEGOTIATE'>(defaultMode);

  useEffect(() => {
    if (initialViewMode) {
      setViewMode(initialViewMode);
    }
  }, [initialViewMode]);

  // ─── [탭 1: 출고팀 불량 상태·청구 등록 상태] ─────────────────────────────────
  const [editingReceivableId, setEditingReceivableId] = useState<string | undefined>(undefined);
  const [assetNoQuery, setAssetNoQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [selectedAssetNo, setSelectedAssetNo] = useState('');
  const [selectedModelName, setSelectedModelName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [siteId, setSiteId] = useState('');
  const [siteName, setSiteName] = useState('');
  const [inboundDate, setInboundDate] = useState(new Date().toISOString().slice(0, 10));
  const [contractId, setContractId] = useState('');
  const [contractNo, setContractNo] = useState('');
  const [salespersonId, setSalespersonId] = useState('');
  const [salespersonName, setSalespersonName] = useState('');
  const [autoFillSource, setAutoFillSource] = useState('');
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);

  const [symptomAddMode, setSymptomAddMode] = useState<'SELECT_MASTER' | 'NEW_INPUT'>(
    'SELECT_MASTER'
  );
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('전체');
  const [checklistSearchQuery, setChecklistSearchQuery] = useState('');

  const [newSymptomCategory, setNewSymptomCategory] = useState('외관/파손');
  const [newSymptomName, setNewSymptomName] = useState('');
  const [newSymptomCost, setNewSymptomCost] = useState<string>('');
  const [saveNewToMaster, setSaveNewToMaster] = useState(true);

  const [defectItems, setDefectItems] = useState<InboundClaimDefectItem[]>([]);
  const [claimMemo, setClaimMemo] = useState('');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  // ─── [탭 2: 영업부 수리비용 건별 조회 · 견적전달 · 통화협상 · 최종결정 상태] ───
  const [statusFilter, setStatusFilter] = useState<
    'UNRESOLVED' | 'ALL' | ClaimNegotiationStatus
  >('UNRESOLVED');
  const [claimSearchQuery, setClaimSearchQuery] = useState('');
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(
    initialReceivableId || null
  );

  // 선택된 청구건의 협상/조정 작업 상태
  const [negotiationItems, setNegotiationItems] = useState<InboundClaimDefectItem[]>([]);
  const [negotiatedTotalAmount, setNegotiatedTotalAmount] = useState<number>(0);
  const [negotiationMemoInput, setNegotiationMemoInput] = useState('');
  const [showItemCostDetail, setShowItemCostDetail] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [isSavingNegotiation, setIsSavingNegotiation] = useState(false);
  const [lightboxPhotoUrl, setLightboxPhotoUrl] = useState<string | null>(null);

  // 최근 입고 자산 빠른 선택 후보
  const recentInboundAssetChips = useMemo(() => {
    const seen = new Set<string>();
    const list: { assetNo: string; modelName: string; inboundDate: string; customerName: string }[] =
      [];

    const sortedLogs = [...(assetInOutLogs || [])]
      .filter((l) => l.eventType === 'INBOUND' && l.assetNo)
      .sort((a, b) =>
        (b.eventDate || b.createdAt || '').localeCompare(a.eventDate || a.createdAt || '')
      );

    for (const log of sortedLogs) {
      const no = (log.assetNo || '').trim();
      if (!no || seen.has(no)) continue;
      seen.add(no);
      list.push({
        assetNo: no,
        modelName: log.modelName || '',
        inboundDate: (log.eventDate || log.createdAt || '').slice(0, 10),
        customerName: log.customerName || '',
      });
      if (list.length >= 8) break;
    }

    if (list.length < 8) {
      const sortedRepairs = [...(repairs || [])]
        .filter((r) => r.source === 'INBOUND_INSPECTION' && r.assetNo)
        .sort((a, b) =>
          (b.requestDate || b.createdAt || '').localeCompare(a.requestDate || a.createdAt || '')
        );
      for (const rep of sortedRepairs) {
        const no = (rep.assetNo || '').trim();
        if (!no || seen.has(no)) continue;
        seen.add(no);
        list.push({
          assetNo: no,
          modelName: rep.modelName || '',
          inboundDate: (rep.requestDate || rep.createdAt || '').slice(0, 10),
          customerName: rep.customerName || '',
        });
        if (list.length >= 8) break;
      }
    }

    return list;
  }, [assetInOutLogs, repairs]);

  const matchingAssets = useMemo(() => {
    const q = assetNoQuery.trim().toUpperCase();
    if (!q) return (assets || []).slice(0, 15);
    return (assets || [])
      .filter(
        (a) =>
          (a.assetNo || '').toUpperCase().includes(q) ||
          (a.modelName || '').toUpperCase().includes(q)
      )
      .slice(0, 15);
  }, [assets, assetNoQuery]);

  const handleSelectAssetAndAutoFill = (targetAssetNo: string) => {
    const trimmed = targetAssetNo.trim();
    setAssetNoQuery(trimmed);
    setShowAssetDropdown(false);
    if (!trimmed) return;

    const lookup = lookupRecentInboundInfoByAsset(trimmed, {
      assets,
      assetInOutLogs,
      contractAssets,
      contracts,
      deliveries,
      repairs,
      customers,
      sites,
      users,
    });

    if (lookup) {
      setSelectedAssetId(lookup.assetId);
      setSelectedAssetNo(lookup.assetNo);
      setSelectedModelName(lookup.modelName);
      setCustomerId(lookup.customerId);
      setCustomerName(lookup.customerName);
      setSiteId(lookup.siteId);
      setSiteName(lookup.siteName);
      setInboundDate(lookup.inboundDate);
      setContractId(lookup.contractId);
      setContractNo(lookup.contractNo);
      setSalespersonId(lookup.salespersonId);
      setSalespersonName(lookup.salespersonName);
      setAutoFillSource(lookup.sourceLabel);
    } else {
      setSelectedAssetId('');
      setSelectedAssetNo(trimmed);
      setSelectedModelName('');
      setAutoFillSource('직접 입력');
    }
  };

  const checklistCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    (inspectionChecklistItems || []).forEach((item) => {
      if (item.isActive !== false && item.category) {
        set.add(item.category);
      }
    });
    return ['전체', ...Array.from(set)];
  }, [inspectionChecklistItems]);

  const filteredChecklistItems = useMemo(() => {
    const q = checklistSearchQuery.trim().toLowerCase();
    return (inspectionChecklistItems || []).filter((item) => {
      if (item.isActive === false) return false;
      if (selectedCategoryFilter !== '전체' && item.category !== selectedCategoryFilter) {
        return false;
      }
      if (
        q &&
        !(item.itemName || '').toLowerCase().includes(q) &&
        !(item.category || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [inspectionChecklistItems, selectedCategoryFilter, checklistSearchQuery]);

  const handleAddFromChecklist = (item: InspectionChecklistItem) => {
    const alreadyExists = defectItems.some(
      (d) => d.checkitemId === item.id || d.symptomName === item.itemName
    );
    if (alreadyExists) {
      showNoticeModal({
        title: '중복 증상 안내',
        message: `'${item.itemName}' 항목은 이미 추가되어 있습니다.`,
      });
      return;
    }

    const newItem: InboundClaimDefectItem = {
      id: `DEF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      checkitemId: item.id,
      category: item.category || '입고불량',
      symptomName: item.itemName,
      estimatedCost: 0,
      agreedCost: 0,
      photos: [],
      memo: '',
    };
    setDefectItems((prev) => [...prev, newItem]);
  };

  const handleAddNewSymptom = async () => {
    const trimmedName = newSymptomName.trim();
    if (!trimmedName) {
      showErrorModal('불량 증상명을 입력해 주십시오.');
      return;
    }

    const parsedCost = Math.max(0, Math.round(Number(newSymptomCost.replace(/,/g, '')) || 0));
    const category = (newSymptomCategory || '기타').trim();
    let createdCheckitemId: string | undefined;

    try {
      if (saveNewToMaster) {
        const existingMaster = (inspectionChecklistItems || []).find(
          (it) => it.category === category && it.itemName === trimmedName
        );
        if (existingMaster) {
          createdCheckitemId = existingMaster.id;
        } else {
          const newMasterId = `CHK-${Date.now()}`;
          await saveInspectionChecklistItem({
            id: newMasterId,
            modelName: selectedModelName || '공통',
            category,
            itemName: trimmedName,
            score: 10,
            standardManHours: 1,
            recommendedConsumableIds: [],
            isActive: true,
          });
          createdCheckitemId = newMasterId;
        }
      }

      const newItem: InboundClaimDefectItem = {
        id: `DEF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        checkitemId: createdCheckitemId,
        category,
        symptomName: trimmedName,
        estimatedCost: parsedCost,
        agreedCost: parsedCost,
        photos: [],
        memo: '',
      };

      setDefectItems((prev) => [...prev, newItem]);
      setNewSymptomName('');
      setNewSymptomCost('');
    } catch (err: any) {
      showErrorModal(err?.message || '신규 정비항목 저장 중 오류가 발생했습니다.');
    }
  };

  const handleUpdateDefectItem = (id: string, patch: Partial<InboundClaimDefectItem>) => {
    setDefectItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, ...patch };
        if (patch.photos) {
          updated.photos = patch.photos.slice(0, 2);
        }
        if (patch.estimatedCost !== undefined) {
          updated.estimatedCost = Math.max(0, Math.round(Number(patch.estimatedCost) || 0));
          updated.agreedCost = updated.estimatedCost;
        }
        return updated;
      })
    );
  };

  const handleRemoveDefectItem = (id: string) => {
    setDefectItems((prev) => prev.filter((item) => item.id !== id));
  };

  const totalEstimatedCost = useMemo(
    () => defectItems.reduce((sum, item) => sum + (Number(item.estimatedCost) || 0), 0),
    [defectItems]
  );

  const totalPhotoCount = useMemo(
    () => defectItems.reduce((sum, item) => sum + (item.photos?.length || 0), 0),
    [defectItems]
  );

  const handleSubmitInboundDefectClaim = async () => {
    const finalAssetNo = (selectedAssetNo || assetNoQuery).trim();
    if (!finalAssetNo) {
      showErrorModal('자산번호를 입력하거나 선택해 주십시오.');
      return;
    }
    if (!customerName.trim()) {
      showErrorModal('고객명을 확인해 주십시오.');
      return;
    }
    if (defectItems.length === 0) {
      showErrorModal('불량 증상을 최소 1개 이상 선택하거나 입력해 주십시오.');
      return;
    }

    setIsSubmittingClaim(true);
    try {
      const rcvId = await registerInboundDefectClaimReceivable({
        existingReceivableId: editingReceivableId,
        assetId: selectedAssetId || undefined,
        assetNo: finalAssetNo,
        modelName: selectedModelName || undefined,
        customerId: customerId || undefined,
        customerName: customerName.trim(),
        siteId: siteId || undefined,
        siteName: siteName.trim() || '미지정 현장',
        contractId: contractId || undefined,
        contractNo: contractNo || undefined,
        inboundDate: inboundDate || new Date().toISOString().slice(0, 10),
        salespersonId: salespersonId || undefined,
        salespersonName: salespersonName || undefined,
        defectItems,
        negotiationMemo: claimMemo.trim(),
      });

      showNoticeModal({
        title: '외상미수금 수리비용 등록 완료',
        message: `자산번호 [${finalAssetNo}]의 수리비용 ₩${totalEstimatedCost.toLocaleString()}(증상 ${defectItems.length}건)이 외상미수금(${rcvId})으로 등록되었습니다.`,
      });

      setEditingReceivableId(undefined);
      setDefectItems([]);
      setClaimMemo('');
      setSelectedClaimId(rcvId);
      setViewMode('NEGOTIATE');
    } catch (err: any) {
      showErrorModal(err?.message || '외상미수금 청구건 등록에 실패했습니다.');
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  // ─── [전체 수리비용 청구건 원본 목록 (출고팀이 외상미수금에 올린 REPAIR 건)] ───
  const allRepairClaims = useMemo(() => {
    const list: { receivable: (typeof receivables)[0]; meta: InboundDefectClaimMeta }[] = [];
    for (const rcv of receivables || []) {
      if (rcv.type !== 'REPAIR') continue;
      const meta = resolveReceivableClaimMeta(rcv, {
        repairs,
        assets,
        customers,
        sites,
        contracts,
      });
      if (!meta) continue;
      list.push({ receivable: rcv, meta });
    }
    return list.sort((a, b) =>
      (b.receivable.createdAt || b.receivable.occurredDate || '').localeCompare(
        a.receivable.createdAt || a.receivable.occurredDate || ''
      )
    );
  }, [receivables, repairs, assets, customers, sites, contracts]);

  // 상태별 카운트 집계
  const statusCounts = useMemo(() => {
    let pending = 0;
    let sent = 0;
    let agreed = 0;
    allRepairClaims.forEach(({ meta }) => {
      if (meta.negotiationStatus === 'AGREED') agreed += 1;
      else if (meta.negotiationStatus === 'SENT_TO_CUSTOMER') sent += 1;
      else pending += 1;
    });
    return {
      all: allRepairClaims.length,
      unresolved: pending + sent,
      pending,
      sent,
      agreed,
    };
  }, [allRepairClaims]);

  // 필터 및 검색 적용된 청구건 목록
  const repairClaimList = useMemo(() => {
    const q = claimSearchQuery.trim();
    return allRepairClaims.filter(({ receivable, meta }) => {
      if (statusFilter === 'UNRESOLVED') {
        if (meta.negotiationStatus === 'AGREED') return false;
      } else if (statusFilter !== 'ALL' && meta.negotiationStatus !== statusFilter) {
        return false;
      }

      if (q) {
        const symptomText = (meta.defectItems || []).map((d) => d.symptomName).join(' ');
        const matched =
          matchHangul(meta.customerName || '', q) ||
          matchHangul(meta.siteName || '', q) ||
          matchHangul(meta.assetNo || '', q) ||
          matchHangul(meta.modelName || '', q) ||
          matchHangul(symptomText, q) ||
          matchHangul(receivable.internalDescription || '', q);
        if (!matched) return false;
      }
      return true;
    });
  }, [allRepairClaims, statusFilter, claimSearchQuery]);

  // 대시보드 ToDo 딥링크 자동 선택 연동
  useEffect(() => {
    if (!navigationPayload || allRepairClaims.length === 0) return;
    const targetId = navigationPayload.entityId || navigationPayload.repairId || '';
    if (!targetId) return;

    const matched = allRepairClaims.find(
      (c) =>
        c.receivable.id === targetId ||
        c.receivable.repairId === targetId ||
        c.meta.repairId === targetId
    );
    if (matched) {
      setViewMode('NEGOTIATE');
      setSelectedClaimId(matched.receivable.id);
      if (setNavigationPayload) setNavigationPayload(null);
    }
  }, [navigationPayload, allRepairClaims, setNavigationPayload]);

  const activeClaimEntry = useMemo(
    () =>
      selectedClaimId
        ? allRepairClaims.find((c) => c.receivable.id === selectedClaimId) || null
        : null,
    [allRepairClaims, selectedClaimId]
  );

  // 선택된 건의 고객현장 담당자 목록 추출 (원터치 통화 지원)
  const activeClaimContacts = useMemo((): SiteContactDisplayItem[] => {
    if (!activeClaimEntry) return [];
    const { meta } = activeClaimEntry;
    const siteObj =
      (meta.siteId ? (sites || []).find((s) => s.id === meta.siteId) : undefined) ||
      (meta.siteName && meta.customerId
        ? (sites || []).find((s) => s.customerId === meta.customerId && s.name === meta.siteName)
        : undefined) ||
      (meta.siteName ? (sites || []).find((s) => s.name === meta.siteName) : undefined);

    const custContacts = (contacts || []).filter(
      (cnt) => cnt.customerId === meta.customerId && cnt.isActive !== false
    );
    const list = getSiteContactList(siteObj, custContacts);

    // 현장 담당자가 없을 경우 고객사 대표 연락처 보조 추가
    if (list.length === 0 && meta.customerId) {
      const custObj = (customers || []).find((c) => c.id === meta.customerId);
      const fallbackPhone = custObj?.repContact || custObj?.phone || custObj?.contactPhone || '';
      if (fallbackPhone && fallbackPhone !== '미상') {
        list.push({
          id: 'cust-fallback',
          roleLabel: '고객사연락처',
          roleType: 'OTHER',
          name: custObj?.representative || custObj?.name || '담당자',
          position: '',
          phone: fallbackPhone,
          email: custObj?.taxEmail || custObj?.repEmail || '',
          isPrimary: true,
        });
      }
    }
    return list;
  }, [activeClaimEntry, sites, contacts, customers]);

  // 선택된 청구건 변경 시 협상 입력 폼 동기화
  useEffect(() => {
    if (!activeClaimEntry) return;
    const { meta } = activeClaimEntry;
    setNegotiationItems(
      (meta.defectItems || []).map((item) => ({
        ...item,
        agreedCost: item.agreedCost !== undefined ? item.agreedCost : item.estimatedCost,
      }))
    );
    setNegotiatedTotalAmount(
      meta.agreedAmount !== undefined ? meta.agreedAmount : meta.initialEstimatedAmount
    );
    setNegotiationMemoInput(meta.negotiationMemo || '');
    setShowItemCostDetail(false);
    setShowEmailForm(false);

    const lookup = lookupRecentInboundInfoByAsset(meta.assetNo, {
      assets,
      assetInOutLogs,
      contractAssets,
      contracts,
      deliveries,
      repairs,
      customers,
      sites,
      users,
    });
    const contactEmail = activeClaimContacts.find((c) => c.email)?.email || '';
    setEmailTo(meta.sentToEmail || contactEmail || lookup?.customerEmail || '');
  }, [activeClaimEntry?.receivable.id, activeClaimEntry?.receivable.updatedAt]);

  const handleEditExistingClaimInRegister = (meta: InboundDefectClaimMeta) => {
    setEditingReceivableId(meta.receivableId);
    setAssetNoQuery(meta.assetNo);
    setSelectedAssetId(meta.assetId || '');
    setSelectedAssetNo(meta.assetNo);
    setSelectedModelName(meta.modelName || '');
    setCustomerId(meta.customerId || '');
    setCustomerName(meta.customerName || '');
    setSiteId(meta.siteId || '');
    setSiteName(meta.siteName || '');
    setInboundDate(meta.inboundDate || new Date().toISOString().slice(0, 10));
    setContractId(meta.contractId || '');
    setContractNo(meta.contractNo || '');
    setSalespersonId(meta.salespersonId || '');
    setSalespersonName(meta.salespersonName || '');
    setAutoFillSource('기존 청구건 불러옴');
    setDefectItems(meta.defectItems || []);
    setClaimMemo(meta.negotiationMemo || '');
    setViewMode('REGISTER');
  };

  // 증상별 금액 변경 시 총액 자동 합산
  const handleChangeNegotiationItemCost = (itemId: string, newAgreedCost: number) => {
    const cleanCost = Math.max(0, Math.round(Number(newAgreedCost) || 0));
    const nextItems = negotiationItems.map((it) =>
      it.id === itemId ? { ...it, agreedCost: cleanCost } : it
    );
    setNegotiationItems(nextItems);
    const sum = nextItems.reduce(
      (acc, it) => acc + (it.agreedCost !== undefined ? it.agreedCost : it.estimatedCost),
      0
    );
    setNegotiatedTotalAmount(sum);
  };

  // 전체 협상 금액 직접 변경 또는 퀵 버튼 클릭 시
  const handleApplyTotalNegotiatedAmount = (targetAmount: number) => {
    const cleanTotal = Math.max(0, Math.round(Number(targetAmount) || 0));
    setNegotiatedTotalAmount(cleanTotal);
    if (negotiationItems.length === 1) {
      setNegotiationItems([{ ...negotiationItems[0], agreedCost: cleanTotal }]);
    } else if (cleanTotal === 0) {
      setNegotiationItems(negotiationItems.map((it) => ({ ...it, agreedCost: 0 })));
    } else if (
      activeClaimEntry &&
      cleanTotal === (activeClaimEntry.meta.initialEstimatedAmount || 0)
    ) {
      setNegotiationItems(
        negotiationItems.map((it) => ({ ...it, agreedCost: it.estimatedCost || 0 }))
      );
    }
  };

  const buildCurrentDraftMeta = (): InboundDefectClaimMeta | null => {
    if (!activeClaimEntry) return null;
    return {
      ...activeClaimEntry.meta,
      agreedAmount: negotiatedTotalAmount,
      negotiationMemo: negotiationMemoInput.trim(),
      defectItems: negotiationItems,
    };
  };

  // 견적서 PDF 다운로드
  const handleDownloadPdf = async () => {
    const draftMeta = buildCurrentDraftMeta();
    if (!draftMeta) return;
    setIsProcessingPdf(true);
    try {
      const fileName = await downloadRepairClaimPdf(draftMeta);
      showNoticeModal({
        title: '견적서 PDF 저장 완료',
        message: `'${fileName}' 파일이 저장되었습니다.`,
      });
    } catch (err: any) {
      showErrorModal(err?.message || 'PDF 문서 생성에 실패했습니다.');
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // 카톡·문자 모바일 공유 및 전달 상태 자동 반영
  const handleShareKakaoOrMobile = async () => {
    const draftMeta = buildCurrentDraftMeta();
    if (!draftMeta) return;
    setIsProcessingPdf(true);
    try {
      const res = await shareRepairClaimPdfMobile(draftMeta);
      if (res.shared) {
        const nextStatus: ClaimNegotiationStatus =
          draftMeta.negotiationStatus === 'AGREED' ? 'AGREED' : 'SENT_TO_CUSTOMER';
        await updateReceivableClaimNegotiation({
          receivableId: draftMeta.receivableId,
          agreedAmount: negotiatedTotalAmount,
          negotiationStatus: nextStatus,
          defectItems: negotiationItems,
          negotiationMemo: negotiationMemoInput.trim(),
          sentChannel: res.method === 'WEB_SHARE' ? 'KAKAO_SHARE' : 'PDF_DOWNLOAD',
        });
        if (res.method === 'DOWNLOAD') {
          showNoticeModal({
            title: '견적서 PDF 저장 완료',
            message: `'${res.fileName}' 파일이 다운로드되었습니다. 카카오톡 또는 문자에 첨부하여 고객에게 전달해 주십시오.`,
          });
        }
      }
    } catch (err: any) {
      showErrorModal(err?.message || '견적서 공유 중 오류가 발생했습니다.');
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // 이메일 발송 실행
  const handleSendEmailWithPdf = async () => {
    const draftMeta = buildCurrentDraftMeta();
    if (!draftMeta) return;
    if (!emailTo.trim()) {
      showErrorModal('수신자 이메일 주소를 입력해 주십시오.');
      return;
    }
    setIsProcessingPdf(true);
    try {
      const result = await sendRepairClaimPdfEmail(draftMeta, {
        toEmail: emailTo.trim(),
        customMessage: emailMessage.trim() || undefined,
      });
      if (!result.success) {
        showErrorModal(result.error || '이메일 발송에 실패했습니다.');
        return;
      }

      const nextStatus: ClaimNegotiationStatus =
        draftMeta.negotiationStatus === 'AGREED' ? 'AGREED' : 'SENT_TO_CUSTOMER';
      await updateReceivableClaimNegotiation({
        receivableId: draftMeta.receivableId,
        agreedAmount: negotiatedTotalAmount,
        negotiationStatus: nextStatus,
        defectItems: negotiationItems,
        negotiationMemo: negotiationMemoInput.trim(),
        sentChannel: 'EMAIL',
        sentToEmail: emailTo.trim(),
      });

      setShowEmailForm(false);
      showNoticeModal({
        title: '견적서 이메일 발송 완료',
        message: `${emailTo.trim()} 주소로 수리비 견적서 PDF가 발송되었습니다.`,
      });
    } catch (err: any) {
      showErrorModal(err?.message || '이메일 발송 중 오류가 발생했습니다.');
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // 협상중 임시저장 또는 최종 청구 결정 확정
  const handleSaveNegotiation = async (finalAgree: boolean) => {
    if (!activeClaimEntry) return;
    setIsSavingNegotiation(true);
    try {
      const nextStatus: ClaimNegotiationStatus = finalAgree
        ? 'AGREED'
        : activeClaimEntry.meta.negotiationStatus === 'SENT_TO_CUSTOMER'
          ? 'SENT_TO_CUSTOMER'
          : 'PENDING_NEGOTIATION';

      await updateReceivableClaimNegotiation({
        receivableId: activeClaimEntry.receivable.id,
        agreedAmount: negotiatedTotalAmount,
        negotiationStatus: nextStatus,
        defectItems: negotiationItems,
        negotiationMemo: negotiationMemoInput.trim(),
      });

      if (finalAgree) {
        showNoticeModal({
          title: negotiatedTotalAmount === 0 ? '무상 면제 결정 완료' : '최종 청구 결정 완료',
          message:
            negotiatedTotalAmount === 0
              ? `자산번호 [${activeClaimEntry.meta.assetNo}] 수리비가 무상 면제(₩0)로 최종 확정되었습니다.`
              : `자산번호 [${activeClaimEntry.meta.assetNo}] 수리비가 ₩${negotiatedTotalAmount.toLocaleString()}으로 최종 확정되어 청구부서 당월 청구 대상에 반영되었습니다.`,
        });
        setSelectedClaimId(null);
      } else {
        showNoticeModal({
          title: '협상 내역 저장 완료',
          message: `현재 협상 금액(₩${negotiatedTotalAmount.toLocaleString()})과 메모가 저장되었습니다.`,
        });
      }
    } catch (err: any) {
      showErrorModal(err?.message || '협상 내역 저장에 실패했습니다.');
    } finally {
      setIsSavingNegotiation(false);
    }
  };

  return (
    <div className="flex flex-col pb-24 text-slate-100 font-sans">
      {/* 상단 헤더 */}
      <div className="bg-slate-900 border-b border-slate-800 px-3.5 py-2.5 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onNavigate && !activeClaimEntry && (
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-200 shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-sm font-black text-white truncate">
              {viewMode === 'NEGOTIATE'
                ? '수리비용 조회 · 견적전달 · 청구결정'
                : '입고 불량 수리비용 등록'}
            </h2>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30 whitespace-nowrap shrink-0">
            외상미수금 연동
          </span>
        </div>

        {/* 출고팀에서 진입했을 때만 등록/협상 탭 전환 노출 (영업부는 전용 협상 화면만 노출) */}
        {!isSalesOnlyMode && (
          <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl mt-2 border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('REGISTER')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center justify-center gap-1 ${
                viewMode === 'REGISTER' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              <span>불량·수리비 등록</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('NEGOTIATE')}
              className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center justify-center gap-1 ${
                viewMode === 'NEGOTIATE' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span>수리비 내역 ({allRepairClaims.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* =====================================================================
          탭 1: 출고팀 입고 불량 상태·사진(최대 2장)·예상 수리비 등록
         ===================================================================== */}
      {viewMode === 'REGISTER' && (
        <div className="p-3.5 space-y-3.5">
          {editingReceivableId && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-amber-300">
                기존 청구건({editingReceivableId}) 수정 모드
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingReceivableId(undefined);
                  setDefectItems([]);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-white text-xs font-bold whitespace-nowrap"
              >
                신규 등록 전환
              </button>
            </div>
          )}

          {/* STEP 1: 자산번호 입력 및 입고 정보 자동 완성 */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <h3 className="text-xs font-black text-white whitespace-nowrap">
                  자산번호 입력 및 입고 정보 확인
                </h3>
              </div>
              {autoFillSource && (
                <span className="text-[10.5px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                  {autoFillSource}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-1 relative">
              <label className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
                자산번호
              </label>
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={assetNoQuery}
                    onFocus={() => setShowAssetDropdown(true)}
                    onChange={(e) => {
                      setAssetNoQuery(e.target.value);
                      setShowAssetDropdown(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSelectAssetAndAutoFill(assetNoQuery);
                      }
                    }}
                    placeholder="자산번호 입력"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectAssetAndAutoFill(assetNoQuery)}
                  className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold whitespace-nowrap shrink-0"
                >
                  조회
                </button>
              </div>

              {showAssetDropdown && matchingAssets.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-xl z-30 divide-y divide-slate-800">
                  {matchingAssets.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleSelectAssetAndAutoFill(a.assetNo)}
                      className="w-full px-3 py-2 text-left hover:bg-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-bold text-blue-400 whitespace-nowrap">
                          {a.assetNo}
                        </span>
                        <span className="text-xs text-slate-300 truncate">{a.modelName}</span>
                      </div>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 whitespace-nowrap">
                        {a.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {recentInboundAssetChips.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[10.5px] font-bold text-slate-400 whitespace-nowrap">
                  최근 입고 자산 선택
                </span>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {recentInboundAssetChips.map((chip) => (
                    <button
                      key={chip.assetNo}
                      type="button"
                      onClick={() => handleSelectAssetAndAutoFill(chip.assetNo)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap shrink-0 ${
                        selectedAssetNo === chip.assetNo
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      {chip.assetNo}
                      {chip.customerName ? ` · ${chip.customerName}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] font-bold text-slate-400 whitespace-nowrap">
                  고객사명
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="고객사명"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] font-bold text-slate-400 whitespace-nowrap">
                  현장명
                </label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="현장명"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10.5px] font-bold text-slate-400 whitespace-nowrap">
                  입고일자
                </label>
                <input
                  type="date"
                  value={inboundDate}
                  onChange={(e) => setInboundDate(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                />
              </div>
            </div>
          </div>

          {/* STEP 2: 불량 증상 선택 또는 신규 입력 */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <h3 className="text-xs font-black text-white whitespace-nowrap">
                  불량 증상 선택 또는 신규 입력
                </h3>
              </div>
              <span className="text-xs font-bold text-blue-400 whitespace-nowrap">
                선택 {defectItems.length}건
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSymptomAddMode('SELECT_MASTER')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold whitespace-nowrap ${
                  symptomAddMode === 'SELECT_MASTER'
                    ? 'bg-slate-800 text-blue-300'
                    : 'text-slate-400'
                }`}
              >
                정비항목에서 선택
              </button>
              <button
                type="button"
                onClick={() => setSymptomAddMode('NEW_INPUT')}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold whitespace-nowrap ${
                  symptomAddMode === 'NEW_INPUT' ? 'bg-slate-800 text-blue-300' : 'text-slate-400'
                }`}
              >
                + 신규 증상 입력
              </button>
            </div>

            {symptomAddMode === 'SELECT_MASTER' ? (
              <div className="space-y-2">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {checklistCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 ${
                        selectedCategoryFilter === cat
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-950 text-slate-300 border border-slate-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={checklistSearchQuery}
                  onChange={(e) => setChecklistSearchQuery(e.target.value)}
                  placeholder="정비항목명 검색..."
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                />

                <div className="max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {filteredChecklistItems.map((item) => {
                    const isAdded = defectItems.some(
                      (d) => d.checkitemId === item.id || d.symptomName === item.itemName
                    );
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleAddFromChecklist(item)}
                        className={`px-2.5 py-2 rounded-xl border text-left flex items-center justify-between gap-2 ${
                          isAdded
                            ? 'bg-blue-500/15 border-blue-500/50 text-blue-300'
                            : 'bg-slate-950 border-slate-800 text-slate-200'
                        }`}
                      >
                        <div className="min-w-0 truncate">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 mr-1.5">
                            {item.category}
                          </span>
                          <span className="text-xs font-bold">{item.itemName}</span>
                        </div>
                        {isAdded ? (
                          <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-400">정비 구분</label>
                    <select
                      value={newSymptomCategory}
                      onChange={(e) => setNewSymptomCategory(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                    >
                      {DEFAULT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-slate-400">예상 수리비 (원)</label>
                    <input
                      type="number"
                      value={newSymptomCost}
                      onChange={(e) => setNewSymptomCost(e.target.value)}
                      placeholder="50000"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-slate-400">불량 증상명</label>
                  <input
                    type="text"
                    value={newSymptomName}
                    onChange={(e) => setNewSymptomName(e.target.value)}
                    placeholder="예: 조이스틱 파손, 난간대 휨"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300">
                    <input
                      type="checkbox"
                      checked={saveNewToMaster}
                      onChange={(e) => setSaveNewToMaster(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-blue-600"
                    />
                    <span>정비항목 마스터에 함께 저장</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddNewSymptom}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>증상 추가</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: 증상별 사진 및 예상 수리비 입력 */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <h3 className="text-xs font-black text-white whitespace-nowrap">
                  증상별 사진 및 예상 수리비 입력
                </h3>
              </div>
              <span className="text-xs font-black text-rose-400 whitespace-nowrap">
                합계 ₩{totalEstimatedCost.toLocaleString()}
              </span>
            </div>

            {defectItems.length === 0 ? (
              <div className="py-6 text-center rounded-xl border border-dashed border-slate-800 text-xs text-slate-500">
                위 2단계에서 불량 증상을 선택하거나 추가해 주십시오.
              </div>
            ) : (
              <div className="space-y-2.5">
                {defectItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10.5px] font-bold whitespace-nowrap">
                          증상 {idx + 1}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10.5px] font-bold whitespace-nowrap">
                          {item.category}
                        </span>
                        <span className="text-xs font-bold text-white truncate">
                          {item.symptomName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDefectItem(item.id)}
                        className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-400">
                        예상 수리비용 (원)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={item.estimatedCost || ''}
                          onChange={(e) =>
                            handleUpdateDefectItem(item.id, {
                              estimatedCost: Number(e.target.value) || 0,
                            })
                          }
                          placeholder="예상 수리비 입력"
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-rose-400"
                        />
                        <div className="flex gap-1">
                          {[30000, 50000, 100000].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() =>
                                handleUpdateDefectItem(item.id, {
                                  estimatedCost: (item.estimatedCost || 0) + amt,
                                })
                              }
                              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[10.5px] font-bold text-slate-300 whitespace-nowrap"
                            >
                              +{amt / 10000}만
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <CameraUploader
                      images={(item.photos || []).slice(0, 2)}
                      maxImages={2}
                      label="증상 사진 촬영 (최대 2장)"
                      onImagesChange={(newPhotos) =>
                        handleUpdateDefectItem(item.id, { photos: newPhotos.slice(0, 2) })
                      }
                    />

                    <input
                      type="text"
                      value={item.memo || ''}
                      onChange={(e) => handleUpdateDefectItem(item.id, { memo: e.target.value })}
                      placeholder="파손 부위 및 수리 상세 내용 입력 (선택)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-1 pt-1">
              <label className="text-[11px] font-bold text-slate-400">
                영업부 전달 메모 (선택)
              </label>
              <input
                type="text"
                value={claimMemo}
                onChange={(e) => setClaimMemo(e.target.value)}
                placeholder="영업담당자 참고 사항 입력"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white"
              />
            </div>

            <button
              type="button"
              disabled={isSubmittingClaim}
              onClick={handleSubmitInboundDefectClaim}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSubmittingClaim
                  ? '저장 중...'
                  : `외상미수금 수리비용 등록 (₩${totalEstimatedCost.toLocaleString()})`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          탭 2: 영업부 수리비용 건별 조회 ➔ 최초견적서 전달 ➔ 통화 협상 ➔ 최종 청구 결정
         ===================================================================== */}
      {viewMode === 'NEGOTIATE' && (
        <div className="p-3 space-y-3">
          {!activeClaimEntry ? (
            /* ─── 1. 수리비용 건별 목록 화면 ─── */
            <>
              {/* 진행 상태 필터 칩 + 검색창 */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3 space-y-2.5">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                  {(
                    [
                      { id: 'UNRESOLVED', label: `미결 (${statusCounts.unresolved})` },
                      { id: 'PENDING_NEGOTIATION', label: `견적전달전 (${statusCounts.pending})` },
                      { id: 'SENT_TO_CUSTOMER', label: `협상중 (${statusCounts.sent})` },
                      { id: 'AGREED', label: `결정완료 (${statusCounts.agreed})` },
                      { id: 'ALL', label: `전체 (${statusCounts.all})` },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStatusFilter(st.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 border transition-all ${
                        statusFilter === st.id
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={claimSearchQuery}
                    onChange={(e) => setClaimSearchQuery(e.target.value)}
                    placeholder="고객사, 현장명, 자산번호, 불량증상 검색..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white placeholder-slate-500"
                  />
                  {claimSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setClaimSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* 건별 리스트 */}
              {repairClaimList.length === 0 ? (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 text-center space-y-2">
                  <AlertTriangle className="w-7 h-7 text-slate-500 mx-auto" />
                  <div className="text-xs font-bold text-slate-300">
                    해당 조건의 수리비용 내역이 없습니다.
                  </div>
                  {statusFilter === 'UNRESOLVED' && statusCounts.agreed > 0 && (
                    <button
                      type="button"
                      onClick={() => setStatusFilter('ALL')}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-bold text-blue-400"
                    >
                      결정완료 포함 전체 보기 ({statusCounts.all}건)
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {repairClaimList.map(({ receivable, meta }) => {
                    const currentAmount =
                      receivable.totalAmount !== undefined
                        ? receivable.totalAmount
                        : meta.initialEstimatedAmount || 0;
                    const initialAmount = meta.initialEstimatedAmount || currentAmount;
                    const badge = getNegotiationStatusBadgeInfo(
                      meta.negotiationStatus,
                      currentAmount
                    );
                    const items = meta.defectItems || [];
                    const photoCount = items.reduce((s, it) => s + (it.photos?.length || 0), 0);
                    const firstSymptom = items[0]?.symptomName || '입고 파손 수리비';
                    const symptomSummary =
                      items.length > 1 ? `${firstSymptom} 외 ${items.length - 1}건` : firstSymptom;

                    return (
                      <div
                        key={receivable.id}
                        onClick={() => setSelectedClaimId(receivable.id)}
                        className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-blue-500/60 active:scale-[0.99] p-3.5 flex flex-col gap-2 cursor-pointer transition-all"
                      >
                        {/* 1행: 상태 배지 · 고객사 · 현장명 · 입고일 */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10.5px] font-black border whitespace-nowrap shrink-0 ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                            >
                              {badge.label}
                            </span>
                            <span className="text-xs font-black text-white truncate">
                              {meta.customerName}
                            </span>
                            <span className="text-[11px] font-bold text-slate-400 truncate">
                              · {meta.siteName}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10.5px] font-mono text-slate-400 whitespace-nowrap">
                              {meta.inboundDate}
                            </span>
                            <ChevronRight className="w-4 h-4 text-slate-500" />
                          </div>
                        </div>

                        {/* 2행: 자산번호(모델명) · 증상 요약 · 금액 */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="px-2 py-0.5 rounded bg-blue-600/20 border border-blue-500/40 text-blue-300 font-mono text-xs font-black whitespace-nowrap shrink-0">
                              {meta.assetNo || '자산미지정'}
                            </span>
                            {meta.modelName && (
                              <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap shrink-0">
                                {meta.modelName}
                              </span>
                            )}
                            <span className="text-xs font-bold text-slate-200 truncate">
                              {symptomSummary}
                            </span>
                            {photoCount > 0 && (
                              <span className="text-[10.5px] font-bold text-emerald-400 whitespace-nowrap shrink-0">
                                사진 {photoCount}
                              </span>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            {initialAmount !== currentAmount && (
                              <span className="text-[10.5px] font-mono text-slate-500 line-through mr-1.5 whitespace-nowrap">
                                ₩{initialAmount.toLocaleString()}
                              </span>
                            )}
                            <span
                              className={`text-sm font-mono font-black whitespace-nowrap ${
                                meta.negotiationStatus === 'AGREED'
                                  ? currentAmount === 0
                                    ? 'text-slate-400'
                                    : 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              ₩{currentAmount.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* ─── 2. 선택된 수리비용 건의 4단계 초간결 처리 화면 ─── */
            <div className="space-y-3">
              {/* 상단 대상 요약 바 */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClaimId(null);
                      setShowEmailForm(false);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-bold text-slate-200 flex items-center gap-1 whitespace-nowrap"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>목록</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {!isSalesOnlyMode && (
                      <button
                        type="button"
                        onClick={() => handleEditExistingClaimInRegister(activeClaimEntry.meta)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-bold text-blue-400 flex items-center gap-1 whitespace-nowrap"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>내역수정</span>
                      </button>
                    )}
                    {(() => {
                      const badge = getNegotiationStatusBadgeInfo(
                        activeClaimEntry.meta.negotiationStatus,
                        activeClaimEntry.receivable.totalAmount
                      );
                      return (
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-black border whitespace-nowrap ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                        >
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-blue-600 text-white font-mono text-xs font-black whitespace-nowrap">
                        {activeClaimEntry.meta.assetNo}
                      </span>
                      {activeClaimEntry.meta.modelName && (
                        <span className="text-xs font-bold text-slate-300 truncate">
                          {activeClaimEntry.meta.modelName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-white mt-1 truncate">
                      {activeClaimEntry.meta.customerName} · {activeClaimEntry.meta.siteName}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10.5px] text-slate-400">
                      입고 {activeClaimEntry.meta.inboundDate}
                    </div>
                    <div className="text-[10.5px] font-mono text-slate-500">
                      {activeClaimEntry.receivable.id}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── STEP 1: 출고팀 작성 수리비용 내역 및 사진 확인 ── */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                      1
                    </span>
                    <h3 className="text-xs font-black text-white">
                      출고팀 작성 수리비용 내역 확인
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-black text-slate-200 whitespace-nowrap">
                    최초견적 ₩{(activeClaimEntry.meta.initialEstimatedAmount || 0).toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2">
                  {negotiationItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold whitespace-nowrap">
                            {item.category || `증상 ${idx + 1}`}
                          </span>
                          <span className="text-xs font-bold text-white truncate">
                            {item.symptomName}
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-rose-400 whitespace-nowrap shrink-0">
                          ₩{(item.estimatedCost || 0).toLocaleString()}
                        </span>
                      </div>

                      {item.memo && (
                        <div className="text-[11px] text-slate-300 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800">
                          {item.memo}
                        </div>
                      )}

                      {item.photos && item.photos.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {item.photos.slice(0, 2).map((photoUrl, pIdx) => (
                            <button
                              key={pIdx}
                              type="button"
                              onClick={() => setLightboxPhotoUrl(photoUrl)}
                              className="relative rounded-lg overflow-hidden border border-slate-700 bg-black h-28 text-left"
                            >
                              <img
                                src={photoUrl}
                                alt={`증상 ${idx + 1} 사진 ${pIdx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[10px] font-bold">
                                사진 {pIdx + 1} 확대
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* ── STEP 2: 최초견적서 고객 전달 (카톡·문자 / PDF / 이메일) ── */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                      2
                    </span>
                    <h3 className="text-xs font-black text-white">최초견적서 고객 전달</h3>
                  </div>
                  {activeClaimEntry.meta.sentAt ? (
                    <span className="text-[10.5px] font-bold text-sky-400 whitespace-nowrap">
                      전달완료 ({activeClaimEntry.meta.sentAt.slice(5, 10)})
                    </span>
                  ) : (
                    <span className="text-[10.5px] font-bold text-amber-400 whitespace-nowrap">
                      전달 대기
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    disabled={isProcessingPdf}
                    onClick={handleShareKakaoOrMobile}
                    className="py-2.5 px-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1 shadow-sm whitespace-nowrap active:scale-95"
                  >
                    <Share2 className="w-3.5 h-3.5 shrink-0" />
                    <span>카톡·문자 전달</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessingPdf}
                    onClick={handleDownloadPdf}
                    className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5 shrink-0" />
                    <span>견적서 PDF</span>
                  </button>

                  <button
                    type="button"
                    disabled={isProcessingPdf}
                    onClick={() => setShowEmailForm((prev) => !prev)}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 whitespace-nowrap active:scale-95 border ${
                      showEmailForm
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-800 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>이메일 전달</span>
                  </button>
                </div>

                {showEmailForm && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                    <div className="flex gap-1.5">
                      <input
                        type="email"
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        placeholder="수신자 이메일 주소 입력"
                        className="flex-1 px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-white"
                      />
                      <button
                        type="button"
                        disabled={isProcessingPdf}
                        onClick={handleSendEmailWithPdf}
                        className="px-3.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-black whitespace-nowrap shrink-0"
                      >
                        {isProcessingPdf ? '발송중...' : '발송'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="전달 메시지 입력 (선택)"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                    />
                  </div>
                )}
              </div>

              {/* ── STEP 3: 담당자 통화 및 협상 금액 조정 ── */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                      3
                    </span>
                    <h3 className="text-xs font-black text-white">담당자 통화 및 협상 조정</h3>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-400">
                    현장담당 원터치 통화
                  </span>
                </div>

                {/* 고객현장 담당자 원터치 통화 버튼 목록 */}
                {activeClaimContacts.length > 0 ? (
                  <div className="space-y-1.5">
                    {activeClaimContacts.map((sc) => (
                      <div
                        key={sc.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap shrink-0 ${
                              sc.roleType === 'EQUIPMENT'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                : sc.roleType === 'CLOSING'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                  : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                            }`}
                          >
                            {sc.roleLabel}
                          </span>
                          <span className="text-xs font-bold text-white truncate">{sc.name}</span>
                          {sc.phone && (
                            <span className="text-xs font-mono font-bold text-emerald-400 whitespace-nowrap">
                              {sc.phone}
                            </span>
                          )}
                        </div>
                        {sc.phone && (
                          <a
                            href={`tel:${sc.phone.replace(/[^0-9+]/g, '')}`}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1 whitespace-nowrap shrink-0 active:scale-95"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>통화</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                    등록된 현장 담당자 연락처가 없습니다.
                  </div>
                )}

                {/* 협상 금액 간편 조정 */}
                <div className="pt-1 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-300">
                      협상 후 최종 청구할 금액 (원)
                    </label>
                    {negotiationItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setShowItemCostDetail((prev) => !prev)}
                        className="text-[11px] font-bold text-blue-400 flex items-center gap-0.5"
                      >
                        <span>증상별 금액 조정</span>
                        {showItemCostDetail ? (
                          <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  <input
                    type="number"
                    value={negotiatedTotalAmount}
                    onChange={(e) => handleApplyTotalNegotiatedAmount(Number(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-base font-mono font-black text-rose-400"
                  />

                  {/* 원터치 금액 조정 칩 */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        handleApplyTotalNegotiatedAmount(
                          activeClaimEntry.meta.initialEstimatedAmount || 0
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-bold text-slate-200 whitespace-nowrap active:scale-95"
                    >
                      전액 청구
                    </button>
                    {[10000, 30000, 50000].map((cut) => (
                      <button
                        key={cut}
                        type="button"
                        onClick={() =>
                          handleApplyTotalNegotiatedAmount(
                            Math.max(0, (negotiatedTotalAmount || 0) - cut)
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-bold text-amber-300 whitespace-nowrap active:scale-95"
                      >
                        -{cut / 10000}만
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        handleApplyTotalNegotiatedAmount(
                          Math.round((activeClaimEntry.meta.initialEstimatedAmount || 0) * 0.5)
                        )
                      }
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-bold text-sky-300 whitespace-nowrap active:scale-95"
                    >
                      50% 감액
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyTotalNegotiatedAmount(0)}
                      className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-bold text-rose-300 whitespace-nowrap active:scale-95"
                    >
                      무상면제 (0원)
                    </button>
                  </div>

                  {/* 다중 증상일 때만 선택적으로 펼치는 증상별 금액 조정 */}
                  {showItemCostDetail && negotiationItems.length > 1 && (
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                      {negotiationItems.map((it, i) => (
                        <div key={it.id} className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-300 truncate flex-1">
                            {i + 1}. {it.symptomName} (견적 ₩
                            {(it.estimatedCost || 0).toLocaleString()})
                          </span>
                          <input
                            type="number"
                            value={it.agreedCost !== undefined ? it.agreedCost : it.estimatedCost}
                            onChange={(e) =>
                              handleChangeNegotiationItemCost(it.id, Number(e.target.value) || 0)
                            }
                            className="w-28 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-rose-400 text-right"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 통화 협상 메모 및 빠른 입력 칩 */}
                <div className="pt-1 border-t border-slate-800 space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-300">
                    통화 협상 및 결정 사유 메모
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {QUICK_MEMO_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() =>
                          setNegotiationMemoInput((prev) =>
                            prev ? `${prev} / ${chip}` : chip
                          )
                        }
                        className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10.5px] font-bold text-slate-300 whitespace-nowrap"
                      >
                        +{chip}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={negotiationMemoInput}
                    onChange={(e) => setNegotiationMemoInput(e.target.value)}
                    placeholder="통화 협상 내용 또는 감액 사유 입력"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                  />
                </div>
              </div>

              {/* ── STEP 4: 최종 청구 결정 확정 ── */}
              <div className="bg-slate-900 rounded-2xl border-2 border-blue-500/40 p-3.5 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                      4
                    </span>
                    <h3 className="text-xs font-black text-white">최종 청구 결정</h3>
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-300">
                    최초 ₩{(activeClaimEntry.meta.initialEstimatedAmount || 0).toLocaleString()} ➔{' '}
                    <strong className="text-emerald-400 font-black">
                      결정 ₩{(negotiatedTotalAmount || 0).toLocaleString()}
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isSavingNegotiation}
                    onClick={() => handleSaveNegotiation(false)}
                    className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-black flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>협상중 저장</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSavingNegotiation}
                    onClick={() => handleSaveNegotiation(true)}
                    className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {negotiatedTotalAmount === 0
                        ? '무상 면제 확정'
                        : `청구 확정 (₩${negotiatedTotalAmount.toLocaleString()})`}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 증빙 사진 전체화면 확대 모달 */}
      {lightboxPhotoUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-3"
          onClick={() => setLightboxPhotoUrl(null)}
        >
          <div className="w-full max-w-lg flex justify-end mb-2">
            <button
              type="button"
              onClick={() => setLightboxPhotoUrl(null)}
              className="px-3 py-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              <span>닫기</span>
            </button>
          </div>
          <img
            src={lightboxPhotoUrl}
            alt="불량 증상 사진 확대"
            className="max-w-full max-h-[82dvh] rounded-xl object-contain border border-slate-700"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
