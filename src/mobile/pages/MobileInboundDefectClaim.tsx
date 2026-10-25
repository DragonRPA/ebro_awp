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
  ArrowLeft,
  Save,
  Check,
  Edit3,
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
    users,
    receivables,
    inspectionChecklistItems,
    saveInspectionChecklistItem,
    registerInboundDefectClaimReceivable,
    updateReceivableClaimNegotiation,
    showErrorModal,
    showNoticeModal,
  } = useApp();

  // 영업부는 기본 탭이 '고객 전달·협상·합의', 출고팀/정비팀은 '불량 상태·청구 등록'
  const defaultMode: 'REGISTER' | 'NEGOTIATE' =
    initialViewMode ||
    (initialReceivableId
      ? 'NEGOTIATE'
      : currentUser?.department === 'SALES'
        ? 'NEGOTIATE'
        : 'REGISTER');

  const [viewMode, setViewMode] = useState<'REGISTER' | 'NEGOTIATE'>(defaultMode);

  // ─── [탭 1: 불량 상태·청구 등록 상태] ───────────────────────────────────────
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

  // 증상 선택 / 신규 입력 상태
  const [symptomAddMode, setSymptomAddMode] = useState<'SELECT_MASTER' | 'NEW_INPUT'>(
    'SELECT_MASTER'
  );
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('전체');
  const [checklistSearchQuery, setChecklistSearchQuery] = useState('');

  // 신규 증상 입력 폼
  const [newSymptomCategory, setNewSymptomCategory] = useState('외관/파손');
  const [newSymptomName, setNewSymptomName] = useState('');
  const [newSymptomCost, setNewSymptomCost] = useState<string>('');
  const [saveNewToMaster, setSaveNewToMaster] = useState(true);

  // 등록된 불량 증상 리스트 (증상당 사진 최대 2장, 증상당 예상 수리비용)
  const [defectItems, setDefectItems] = useState<InboundClaimDefectItem[]>([]);
  const [claimMemo, setClaimMemo] = useState('');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);

  // ─── [탭 2: 고객 전달·협상·합의 상태] ───────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState<'ALL' | ClaimNegotiationStatus>('ALL');
  const [claimSearchQuery, setClaimSearchQuery] = useState('');
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(
    initialReceivableId || null
  );

  // 선택된 청구건의 협상/조정 작업 상태
  const [negotiationItems, setNegotiationItems] = useState<InboundClaimDefectItem[]>([]);
  const [negotiatedTotalAmount, setNegotiatedTotalAmount] = useState<number>(0);
  const [negotiationMemoInput, setNegotiationMemoInput] = useState('');
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailCc, setEmailCc] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [isSavingNegotiation, setIsSavingNegotiation] = useState(false);

  // 최근 입고 자산 빠른 선택 후보 (최근 INBOUND 로그 및 입고/반납 배차 상위 8건)
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

  // 자산번호 자동완성 후보
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

  // 자산번호 선택 또는 입력 확정 시 최근 입고 정보 자동 완성
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
      setAutoFillSource('직접 입력 (일치 자산 미발견)');
    }
  };

  // 정비항목관리 카테고리 목록
  const checklistCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    (inspectionChecklistItems || []).forEach((item) => {
      if (item.isActive !== false && item.category) {
        set.add(item.category);
      }
    });
    return ['전체', ...Array.from(set)];
  }, [inspectionChecklistItems]);

  // 정비항목관리 필터링된 아이템 목록
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

  // 정비항목관리 아이템 클릭하여 증상 추가
  const handleAddFromChecklist = (item: InspectionChecklistItem) => {
    const alreadyExists = defectItems.some(
      (d) => d.checkitemId === item.id || d.symptomName === item.itemName
    );
    if (alreadyExists) {
      showNoticeModal({
        title: '중복 증상 안내',
        message: `'${item.itemName}' 항목은 이미 아래 불량 증상 목록에 추가되어 있습니다.`,
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

  // 신규 증상 직접 입력 및 저장 (정비항목관리 마스터 동시 저장 지원)
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

  const handleUpdateDefectItem = (
    id: string,
    patch: Partial<InboundClaimDefectItem>
  ) => {
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

  // 외상미수금 대장에 1건의 청구건으로 저장
  const handleSubmitInboundDefectClaim = async () => {
    const finalAssetNo = (selectedAssetNo || assetNoQuery).trim();
    if (!finalAssetNo) {
      showErrorModal('제일 먼저 관리번호(자산번호)를 입력하거나 선택해 주십시오.');
      return;
    }
    if (!customerName.trim()) {
      showErrorModal('고객명을 확인해 주십시오.');
      return;
    }
    if (defectItems.length === 0) {
      showErrorModal('불량 증상을 최소 1개 이상 선택하거나 신규 입력해 주십시오.');
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
        title: '외상미수금 대장 청구 등록 완료',
        message: `자산번호 [${finalAssetNo}]의 불량 증상 ${defectItems.length}건(사진 ${totalPhotoCount}장, 예상 수리비 ₩${totalEstimatedCost.toLocaleString()})이 외상미수금 대장에 1개의 청구건(${rcvId})으로 기록되었습니다.`,
      });

      // 초기화 및 상세/PDF 전달 화면으로 이동
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

  // ─── [탭 2: 등록된 입고 불량 수리비 청구건 목록] ───────────────────────────
  const repairClaimList = useMemo(() => {
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
      if (statusFilter !== 'ALL' && meta.negotiationStatus !== statusFilter) continue;

      const q = claimSearchQuery.trim().toLowerCase();
      if (q) {
        const match =
          (meta.assetNo || '').toLowerCase().includes(q) ||
          (meta.customerName || '').toLowerCase().includes(q) ||
          (meta.siteName || '').toLowerCase().includes(q) ||
          (rcv.internalDescription || '').toLowerCase().includes(q);
        if (!match) continue;
      }
      list.push({ receivable: rcv, meta });
    }
    return list.sort((a, b) =>
      (b.receivable.createdAt || b.receivable.occurredDate || '').localeCompare(
        a.receivable.createdAt || a.receivable.occurredDate || ''
      )
    );
  }, [receivables, repairs, assets, customers, sites, contracts, statusFilter, claimSearchQuery]);

  const activeClaimEntry = useMemo(
    () =>
      selectedClaimId
        ? repairClaimList.find((c) => c.receivable.id === selectedClaimId) || null
        : null,
    [repairClaimList, selectedClaimId]
  );

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

    // 고객 이메일 자동 채움
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
    setEmailTo(meta.sentToEmail || lookup?.customerEmail || '');
  }, [activeClaimEntry?.receivable.id, activeClaimEntry?.receivable.updatedAt]);

  // 기존 청구건을 수정 모드로 열기 (출고팀 추가 증상/사진 보완용)
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
    setAutoFillSource('기존 등록 청구건 불러옴');
    setDefectItems(meta.defectItems || []);
    setClaimMemo(meta.negotiationMemo || '');
    setViewMode('REGISTER');
  };

  // 증상별 합의 수리비 변경 시 총액 자동 합산
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

  // 현재 협상 반영된 메타 생성
  const buildCurrentDraftMeta = (): InboundDefectClaimMeta | null => {
    if (!activeClaimEntry) return null;
    return {
      ...activeClaimEntry.meta,
      agreedAmount: negotiatedTotalAmount,
      negotiationMemo: negotiationMemoInput.trim(),
      defectItems: negotiationItems,
    };
  };

  // PDF 다운로드 실행
  const handleDownloadPdf = async () => {
    const draftMeta = buildCurrentDraftMeta();
    if (!draftMeta) return;
    setIsProcessingPdf(true);
    try {
      const fileName = await downloadRepairClaimPdf(draftMeta);
      showNoticeModal({
        title: 'PDF 문서 생성 완료',
        message: `'${fileName}' 파일이 다운로드되었습니다.`,
      });
    } catch (err: any) {
      showErrorModal(err?.message || 'PDF 문서 생성에 실패했습니다.');
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // 카카오톡 / 모바일 공유 실행
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
            title: 'PDF 다운로드 완료',
            message: `현재 브라우저 환경에서는 파일 직접 공유 대신 '${res.fileName}' 파일이 다운로드되었습니다. 카카오톡 대화방에 첨부하여 전달해 주십시오.`,
          });
        }
      }
    } catch (err: any) {
      showErrorModal(err?.message || 'PDF 공유 중 오류가 발생했습니다.');
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
        ccEmail: emailCc.trim() || undefined,
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
        title: '이메일 발송 완료',
        message: `${emailTo.trim()} 앞으로 수리비 내역서 PDF 문서가 첨부 발송되었습니다.`,
      });
    } catch (err: any) {
      showErrorModal(err?.message || '이메일 발송 중 오류가 발생했습니다.');
    } finally {
      setIsProcessingPdf(false);
    }
  };

  // 수리비 협상 조정 저장 또는 최종 합의 완료
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

      showNoticeModal({
        title: finalAgree ? '최종 합의 완료 및 청구 인계' : '수리비 조정 내역 저장 완료',
        message: finalAgree
          ? `최종 합의 수리비 ₩${negotiatedTotalAmount.toLocaleString()}으로 외상미수금 대장이 확정되었으며, 청구담당자의 당월 청구 대상에 반영되었습니다.`
          : `조정 수리비 ₩${negotiatedTotalAmount.toLocaleString()} 및 협상 메모가 저장되었습니다.`,
      });
    } catch (err: any) {
      showErrorModal(err?.message || '협상 내역 저장에 실패했습니다.');
    } finally {
      setIsSavingNegotiation(false);
    }
  };

  return (
    <div className="flex flex-col pb-24 text-slate-900 dark:text-slate-100">
      {/* 상단 타이틀 및 탭 전환 */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-base font-bold text-slate-900 dark:text-white whitespace-nowrap">
              입고 불량 상태 등록 및 수리비 청구
            </h2>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 whitespace-nowrap">
            외상미수금 연동
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('REGISTER')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 ${
              viewMode === 'REGISTER'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 shrink-0" />
            <span>1. 불량 상태·청구 등록</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('NEGOTIATE')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-colors whitespace-nowrap flex items-center justify-center gap-1.5 ${
              viewMode === 'NEGOTIATE'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>2. PDF 전달·수리비 합의 ({repairClaimList.length})</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          탭 1: 출고팀 입고 불량 상태·사진(최대 2장)·예상 수리비 등록
         ===================================================================== */}
      {viewMode === 'REGISTER' && (
        <div className="p-4 space-y-4">
          {editingReceivableId && (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-amber-700 dark:text-amber-300">
                기존 청구건({editingReceivableId}) 수정 모드입니다.
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingReceivableId(undefined);
                  setDefectItems([]);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-white text-xs font-bold whitespace-nowrap"
              >
                신규 등록으로 전환
              </button>
            </div>
          )}

          {/* STEP 1: 관리번호(자산번호) 입력 및 최근 입고 정보 자동 완성 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                  관리번호(자산번호) 입력 및 입고 정보 자동 완성
                </h3>
              </div>
              {autoFillSource && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                  {autoFillSource}
                </span>
              )}
            </div>

            {/* 관리번호 검색 입력창 */}
            <div className="flex flex-col gap-1 relative">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                관리번호 (자산번호)
              </label>
              <div className="flex gap-2">
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
                    placeholder="자산번호 입력 (예: 6506, EWL-001)"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectAssetAndAutoFill(assetNoQuery)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold whitespace-nowrap shrink-0"
                >
                  자동 완성 조회
                </button>
              </div>

              {/* 자산번호 자동완성 드롭다운 */}
              {showAssetDropdown && matchingAssets.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 shadow-xl z-30 divide-y divide-slate-100 dark:divide-slate-700/60">
                  {matchingAssets.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => handleSelectAssetAndAutoFill(a.assetNo)}
                      className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-slate-700/70 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {a.assetNo}
                        </span>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                          {a.modelName}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {a.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 최근 입고 자산 빠른 선택 칩 */}
            {recentInboundAssetChips.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  최근 입고 자산 빠른 선택
                </span>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {recentInboundAssetChips.map((chip) => (
                    <button
                      key={chip.assetNo}
                      type="button"
                      onClick={() => handleSelectAssetAndAutoFill(chip.assetNo)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                        selectedAssetNo === chip.assetNo
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {chip.assetNo}
                      {chip.customerName ? ` · ${chip.customerName}` : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 자동 완성된 고객명 / 현장명 / 입고일자 확인 및 보정 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  고객명 (자동 완성)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="고객명 자동 입력"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                  현장명 (자동 완성)
                </label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="현장명 자동 입력"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-amber-500" />
                  입고일자 (자동 완성)
                </label>
                <input
                  type="date"
                  value={inboundDate}
                  onChange={(e) => setInboundDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {(selectedModelName || salespersonName) && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-3 py-2 rounded-xl">
                {selectedModelName && (
                  <span className="font-semibold">
                    모델명: <strong className="text-slate-900 dark:text-white">{selectedModelName}</strong>
                  </span>
                )}
                {salespersonName && (
                  <span className="font-semibold">
                    영업담당자: <strong className="text-blue-600 dark:text-blue-400">{salespersonName}</strong>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* STEP 2: 불량 증상 선택(정비항목관리) 또는 신규 입력 저장 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                  불량 증상 선택 또는 신규 입력
                </h3>
              </div>
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                선택된 증상 {defectItems.length}건
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSymptomAddMode('SELECT_MASTER')}
                className={`py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  symptomAddMode === 'SELECT_MASTER'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                정비항목관리에서 선택
              </button>
              <button
                type="button"
                onClick={() => setSymptomAddMode('NEW_INPUT')}
                className={`py-2 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  symptomAddMode === 'NEW_INPUT'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                + 신규 증상 입력·저장
              </button>
            </div>

            {symptomAddMode === 'SELECT_MASTER' ? (
              <div className="space-y-2.5">
                {/* 구분 필터 칩 */}
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {checklistCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategoryFilter(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 ${
                        selectedCategoryFilter === cat
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* 검색창 */}
                <input
                  type="text"
                  value={checklistSearchQuery}
                  onChange={(e) => setChecklistSearchQuery(e.target.value)}
                  placeholder="정비항목명 검색..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                />

                {/* 정비항목 그리드 */}
                <div className="max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1">
                  {filteredChecklistItems.length === 0 ? (
                    <div className="col-span-full py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                      일치하는 정비항목이 없습니다. 우측 상단 [+ 신규 증상 입력·저장]을 이용해 주십시오.
                    </div>
                  ) : (
                    filteredChecklistItems.map((item) => {
                      const isAdded = defectItems.some(
                        (d) => d.checkitemId === item.id || d.symptomName === item.itemName
                      );
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleAddFromChecklist(item)}
                          className={`px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                            isAdded
                              ? 'bg-blue-500/15 border-blue-500/50 text-blue-600 dark:text-blue-300'
                              : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80 text-slate-800 dark:text-slate-200 hover:border-blue-400'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 mr-1.5 whitespace-nowrap">
                              {item.category}
                            </span>
                            <span className="text-xs font-bold">{item.itemName}</span>
                          </div>
                          {isAdded ? (
                            <Check className="w-4 h-4 text-blue-500 shrink-0" />
                          ) : (
                            <Plus className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* 신규 증상 직접 입력 및 정비항목관리 저장 */
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      정비 구분
                    </label>
                    <select
                      value={newSymptomCategory}
                      onChange={(e) => setNewSymptomCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                    >
                      {DEFAULT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      예상 수리비용 (원)
                    </label>
                    <input
                      type="number"
                      value={newSymptomCost}
                      onChange={(e) => setNewSymptomCost(e.target.value)}
                      placeholder="예: 50000"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    신규 불량 증상명
                  </label>
                  <input
                    type="text"
                    value={newSymptomName}
                    onChange={(e) => setNewSymptomName(e.target.value)}
                    placeholder="예: 조이스틱 컨트롤러 파손, 상부 난간대 휨"
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveNewToMaster}
                      onChange={(e) => setSaveNewToMaster(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>정비항목관리에 정식 아이템으로 함께 저장</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleAddNewSymptom}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold whitespace-nowrap flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>증상 추가 및 저장</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: 증상별 사진 촬영(최대 2장) 및 예상 수리비용 입력 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  3
                </span>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">
                  증상별 사진 촬영(최대 2장) 및 예상 수리비 입력
                </h3>
              </div>
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                합계 ₩{totalEstimatedCost.toLocaleString()}
              </span>
            </div>

            {defectItems.length === 0 ? (
              <div className="py-8 text-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                위 2단계에서 불량 증상을 선택하거나 신규 입력하면 증상별 사진(최대 2장) 및 예상 수리비 입력란이 표시됩니다.
              </div>
            ) : (
              <div className="space-y-3">
                {defectItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-xs font-bold whitespace-nowrap">
                          증상 {idx + 1}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold whitespace-nowrap">
                          {item.category}
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {item.symptomName}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDefectItem(item.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 shrink-0"
                        title="증상 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* 증상당 예상 수리비용 입력 + 금액 칩 */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        증상 예상 수리비용 (원)
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
                          placeholder="예상 수리비 입력 (원)"
                          className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm font-bold text-rose-600 dark:text-rose-400"
                        />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          ₩{(item.estimatedCost || 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {[10000, 30000, 50000, 100000, 200000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() =>
                              handleUpdateDefectItem(item.id, {
                                estimatedCost: (item.estimatedCost || 0) + amt,
                              })
                            }
                            className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                          >
                            +{(amt / 10000).toFixed(0)}만
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleUpdateDefectItem(item.id, { estimatedCost: 0 })}
                          className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap"
                        >
                          0원 초기화
                        </button>
                      </div>
                    </div>

                    {/* 증상당 사진 최대 2장 촬영/첨부 */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        증상 사진 촬영·첨부 (최대 2장) — 현재 {(item.photos || []).length}/2장
                      </label>
                      <CameraUploader
                        images={(item.photos || []).slice(0, 2)}
                        maxImages={2}
                        label="증상 사진 촬영 (최대 2장)"
                        onImagesChange={(newPhotos) =>
                          handleUpdateDefectItem(item.id, { photos: newPhotos.slice(0, 2) })
                        }
                      />
                    </div>

                    {/* 증상 상세 메모 */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        증상 상세 메모 (선택)
                      </label>
                      <input
                        type="text"
                        value={item.memo || ''}
                        onChange={(e) => handleUpdateDefectItem(item.id, { memo: e.target.value })}
                        placeholder="파손 부위 및 수리 필요 상세 내용 입력"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 전체 청구 비고 */}
            <div className="flex flex-col gap-1 pt-2">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                영업사원 전달 참고 메모 (선택)
              </label>
              <input
                type="text"
                value={claimMemo}
                onChange={(e) => setClaimMemo(e.target.value)}
                placeholder="영업담당자가 고객과 수리비 협의 시 참고할 특이사항 입력"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* STEP 4: 외상미수금 대장 1개의 청구건으로 통합 저장 */}
          <div className="bg-slate-900 dark:bg-slate-800 text-white rounded-2xl p-4 space-y-3 shadow-lg border border-slate-700">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
              <span>
                대상 자산: <strong className="text-white">{selectedAssetNo || assetNoQuery || '-'}</strong> ({customerName || '고객 미지정'})
              </span>
              <span>
                불량 증상 <strong className="text-blue-400">{defectItems.length}건</strong> / 사진{' '}
                <strong className="text-emerald-400">{totalPhotoCount}장</strong>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                외상미수금 대장 통합 청구 금액 (1건)
              </span>
              <span className="text-lg font-extrabold text-rose-400">
                ₩{totalEstimatedCost.toLocaleString()}
              </span>
            </div>
            <button
              type="button"
              disabled={isSubmittingClaim}
              onClick={handleSubmitInboundDefectClaim}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-extrabold flex items-center justify-center gap-2 shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>
                {isSubmittingClaim
                  ? '외상미수금 대장 기록 중...'
                  : editingReceivableId
                    ? '외상미수금 청구건 수정 저장'
                    : '외상미수금 대장에 1건으로 청구 등록'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          탭 2: 영업사원 1개의 PDF 문서 조립·고객 전달(카톡/이메일)·수리비 협상 조정·최종 합의 완료
         ===================================================================== */}
      {viewMode === 'NEGOTIATE' && (
        <div className="p-4 space-y-4">
          {!activeClaimEntry ? (
            <>
              {/* 상태 필터 및 검색 */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2.5 shadow-sm">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {(
                    [
                      { id: 'ALL', label: '전체 청구건' },
                      { id: 'PENDING_NEGOTIATION', label: '협상대기' },
                      { id: 'SENT_TO_CUSTOMER', label: '고객전달' },
                      { id: 'AGREED', label: '합의완료 (당월청구대상)' },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setStatusFilter(st.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 ${
                        statusFilter === st.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
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
                    placeholder="자산번호, 고객명, 현장명 검색..."
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* 청구건 카드 목록 */}
              {repairClaimList.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    등록된 입고 불량 수리비 청구건이 없습니다.
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewMode('REGISTER')}
                    className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
                  >
                    + 불량 상태·청구 등록하러 가기
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {repairClaimList.map(({ receivable, meta }) => {
                    const badge = getNegotiationStatusBadgeInfo(meta.negotiationStatus);
                    const photoCount = (meta.defectItems || []).reduce(
                      (s, it) => s + (it.photos?.length || 0),
                      0
                    );
                    return (
                      <div
                        key={receivable.id}
                        onClick={() => setSelectedClaimId(receivable.id)}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-2.5 shadow-sm cursor-pointer hover:border-blue-500 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="px-2.5 py-0.5 rounded-lg bg-blue-600 text-white text-xs font-extrabold whitespace-nowrap">
                              {meta.assetNo || '자산미지정'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border whitespace-nowrap ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                            >
                              {badge.label}
                            </span>
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              입고일: {meta.inboundDate}
                            </span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {meta.customerName} · {meta.siteName}
                            </div>
                            <div className="text-xs text-slate-600 dark:text-slate-300 truncate mt-0.5">
                              불량 증상 {(meta.defectItems || []).length}건 (사진 {photoCount}장) —{' '}
                              {(meta.defectItems || []).map((d) => d.symptomName).join(', ')}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {meta.initialEstimatedAmount !== receivable.totalAmount && (
                              <div className="text-[11px] text-slate-400 line-through whitespace-nowrap">
                                ₩{(meta.initialEstimatedAmount || 0).toLocaleString()}
                              </div>
                            )}
                            <div className="text-sm font-extrabold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                              ₩{(receivable.totalAmount || 0).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* 선택된 청구건 상세: PDF 조립·전달(카톡/이메일) 및 수리비 조정·최종 합의 */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClaimId(null);
                    setShowEmailForm(false);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>목록으로 돌아가기</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleEditExistingClaimInRegister(activeClaimEntry.meta)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>증상·사진 추가/수정</span>
                </button>
              </div>

              {/* 기본 정보 요약 카드 */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-extrabold">
                      {activeClaimEntry.meta.assetNo}
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {activeClaimEntry.meta.customerName}
                    </span>
                  </div>
                  {(() => {
                    const badge = getNegotiationStatusBadgeInfo(
                      activeClaimEntry.meta.negotiationStatus
                    );
                    return (
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${badge.bgClass} ${badge.textClass} ${badge.borderClass}`}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">현장명: </span>
                    <strong className="text-slate-900 dark:text-white">
                      {activeClaimEntry.meta.siteName}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">입고일자: </span>
                    <strong className="text-slate-900 dark:text-white">
                      {activeClaimEntry.meta.inboundDate}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">청구번호: </span>
                    <strong className="text-slate-900 dark:text-white">
                      {activeClaimEntry.receivable.id}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">최초 예상 수리비: </span>
                    <strong className="text-slate-900 dark:text-white">
                      ₩{(activeClaimEntry.meta.initialEstimatedAmount || 0).toLocaleString()}
                    </strong>
                  </div>
                </div>

                {/* 1개의 PDF 문서 조립 및 고객 전달 버튼군 (카톡 / 이메일 / 다운로드) */}
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    1개의 PDF 문서로 조립하여 고객에게 전달
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={isProcessingPdf}
                      onClick={handleShareKakaoOrMobile}
                      className="py-2.5 px-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      <Share2 className="w-4 h-4 shrink-0" />
                      <span>카톡·모바일 전달</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessingPdf}
                      onClick={() => setShowEmailForm((prev) => !prev)}
                      className="py-2.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      <Mail className="w-4 h-4 shrink-0" />
                      <span>이메일 전달</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessingPdf}
                      onClick={handleDownloadPdf}
                      className="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      <Download className="w-4 h-4 shrink-0" />
                      <span>PDF 다운로드</span>
                    </button>
                  </div>
                </div>

                {/* 이메일 발송 인라인 폼 */}
                {showEmailForm && (
                  <div className="p-3.5 rounded-xl bg-blue-50/70 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 space-y-2.5">
                    <div className="text-xs font-bold text-blue-900 dark:text-blue-300">
                      수리비 내역서 PDF 첨부 이메일 발송
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        수신자 이메일
                      </label>
                      <input
                        type="email"
                        value={emailTo}
                        onChange={(e) => setEmailTo(e.target.value)}
                        placeholder="customer@example.com"
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        참조 이메일 (선택)
                      </label>
                      <input
                        type="email"
                        value={emailCc}
                        onChange={(e) => setEmailCc(e.target.value)}
                        placeholder="cc@example.com"
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                        전달 메시지 (선택)
                      </label>
                      <textarea
                        rows={2}
                        value={emailMessage}
                        onChange={(e) => setEmailMessage(e.target.value)}
                        placeholder="고객님께 전달할 안내 말씀을 입력해 주십시오."
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowEmailForm(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200"
                      >
                        닫기
                      </button>
                      <button
                        type="button"
                        disabled={isProcessingPdf}
                        onClick={handleSendEmailWithPdf}
                        className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold"
                      >
                        {isProcessingPdf ? 'PDF 조립 및 발송 중...' : 'PDF 첨부 이메일 발송'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 증상별 사진 확인 및 수리비 개별 조정 */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  증상별 상세 내역·증빙 사진 및 수리비 조정
                </h3>

                <div className="space-y-3">
                  {negotiationItems.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="px-2 py-0.5 rounded bg-blue-600 text-white text-[11px] font-bold whitespace-nowrap">
                            증상 {idx + 1}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold whitespace-nowrap">
                            {item.category}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {item.symptomName}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          당초 예상: ₩{(item.estimatedCost || 0).toLocaleString()}
                        </span>
                      </div>

                      {item.memo && (
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          메모: {item.memo}
                        </div>
                      )}

                      {/* 촬영된 사진 최대 2장 미리보기 */}
                      {item.photos && item.photos.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {item.photos.slice(0, 2).map((photoUrl, pIdx) => (
                            <div
                              key={pIdx}
                              className="relative rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 bg-black h-32"
                            >
                              <img
                                src={photoUrl}
                                alt={`증상 ${idx + 1} 사진 ${pIdx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold">
                                사진 {pIdx + 1}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 증상별 조정/합의 수리비 입력 */}
                      <div className="flex flex-col gap-1 pt-1">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          증상별 조정·합의 수리비용 (원)
                        </label>
                        <input
                          type="number"
                          value={
                            item.agreedCost !== undefined ? item.agreedCost : item.estimatedCost
                          }
                          onChange={(e) =>
                            handleChangeNegotiationItemCost(item.id, Number(e.target.value) || 0)
                          }
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-rose-600 dark:text-rose-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 고객 협상 수리비 최종 조정 및 합의 완료 패널 */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-blue-500/40 p-4 space-y-3 shadow-md">
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  고객 수리비 협상 조정 및 최종 합의 확정
                </h3>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      최초 예상 수리비 합계
                    </div>
                    <div className="text-base font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">
                      ₩{(activeClaimEntry.meta.initialEstimatedAmount || 0).toLocaleString()}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
                    <div className="text-[11px] font-bold text-rose-700 dark:text-rose-300">
                      최종 합의(조정) 수리비 총액
                    </div>
                    <div className="text-base font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">
                      ₩{(negotiatedTotalAmount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    최종 합의 수리비 직접 조정 (원)
                  </label>
                  <input
                    type="number"
                    value={negotiatedTotalAmount}
                    onChange={(e) =>
                      setNegotiatedTotalAmount(Math.max(0, Math.round(Number(e.target.value) || 0)))
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm font-extrabold text-rose-600 dark:text-rose-400"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    고객 협상 및 수리비 조정 사유 메모
                  </label>
                  <input
                    type="text"
                    value={negotiationMemoInput}
                    onChange={(e) => setNegotiationMemoInput(e.target.value)}
                    placeholder="예: 고객사 현장소장님과 협의하여 3만원 감액 후 당월 청구 합의 완료"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isSavingNegotiation}
                    onClick={() => handleSaveNegotiation(false)}
                    className="py-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 text-xs font-extrabold flex items-center justify-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>조정 금액 임시 저장 (협상중)</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSavingNegotiation}
                    onClick={() => handleSaveNegotiation(true)}
                    className="py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>최종 합의 완료 (당월 청구 연동)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
