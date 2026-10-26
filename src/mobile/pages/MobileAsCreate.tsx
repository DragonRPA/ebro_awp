// src/mobile/pages/MobileAsCreate.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { CameraUploader } from '../components/CameraUploader';
import { 
  ArrowLeft, Check, Plus, AlertTriangle, Mic, MicOff, 
  FileText, RotateCcw, Sparkles, X, CheckCircle2, MapPin, Volume2, VolumeX
} from 'lucide-react';
import { parseAsCallTranscript } from '../../services/voiceOrderDraftService';
import { resolveSiteDetailedAddress } from '../../utils/nativeLauncher';
import { ttsService } from '../../services/ttsService';
import { getUserDepartmentName, isDeveloperUser } from '../../utils/userDepartmentHelper';
import { decryptSecret } from '../../utils/cryptoVault';
import { Asset } from '../../services/db';

interface MobileAsCreateProps {
  onBack: () => void;
  onCreated: (ticketId: string) => void;
  initialAssetNo?: string;
  initialSiteId?: string;
}

const CATEGORIES = [
  '방지봉/협착',
  '상하강불량',
  '충전/전원',
  '오일누유',
  '키박스/스위치',
  '에러코드',
  '파이프걸림',
  '점검요청',
  '기타',
];

const UNKNOWN_ASSET_NO = '관리번호 모름';
const isUnknownAssetLabel = (val?: string | null): boolean => {
  const clean = String(val || '').trim();
  return (
    clean === UNKNOWN_ASSET_NO ||
    clean === '관리번호모름' ||
    clean === '모름' ||
    clean === '미상' ||
    clean === '현장확인'
  );
};

export const MobileAsCreate: React.FC<MobileAsCreateProps> = ({ 
  onBack, 
  onCreated,
  initialAssetNo,
  initialSiteId
}) => {
  const {
    createFieldAsTicket,
    showErrorModal,
    customers,
    sites,
    assets,
    products,
    contracts,
    contractAssets,
    vendors,
    users,
    departments,
    currentUser,
    inspectionChecklistItems,
    saveInspectionChecklistItem,
    loadTablesForMenu,
  } = useApp();

  useEffect(() => {
    loadTablesForMenu?.('smart_as_request');
  }, [loadTablesForMenu]);

  const [customerName, setCustomerName] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [assetNo, setAssetNo] = useState(typeof initialAssetNo === 'string' ? initialAssetNo : '');
  const [modelName, setModelName] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterContact, setReporterContact] = useState('');
  const [issueCategory, setIssueCategory] = useState('상하강불량');
  const [issueDescription, setIssueDescription] = useState('');
  const [customSymptoms, setCustomSymptoms] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('erp_mobile_as_custom_symptoms');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
        }
      }
    } catch {}
    return [];
  });
  const [priority, setPriority] = useState<'NORMAL' | 'URGENT'>('NORMAL');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignedMechanicId, setAssignedMechanicId] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🌟 기본 고장 분류 + 사용자 저장 증상(로컬 & DB 동기화) 통합 퀵버튼 목록
  const allQuickSymptoms = useMemo(() => {
    const dbCustom = (inspectionChecklistItems || [])
      .filter(item => item && item.isDefectSymptom && item.description === '모바일 웹앱 증상저장 퀵버튼' && item.name?.trim())
      .map(item => item.name.trim());
    const merged = new Set<string>([...CATEGORIES, ...dbCustom, ...customSymptoms.map(s => s.trim()).filter(Boolean)]);
    return Array.from(merged);
  }, [customSymptoms, inspectionChecklistItems]);

  const trimmedIssueDescription = issueDescription.trim();
  const isNewSymptom = Boolean(
    trimmedIssueDescription.length > 0 &&
    !allQuickSymptoms.some(sym => sym.trim() === trimmedIssueDescription)
  );

  const handleSaveCustomSymptom = async () => {
    const newSym = issueDescription.trim();
    if (!newSym) return;
    const nextList = Array.from(new Set([...customSymptoms, newSym]));
    setCustomSymptoms(nextList);
    setIssueCategory(newSym);
    try {
      localStorage.setItem('erp_mobile_as_custom_symptoms', JSON.stringify(nextList));
    } catch {}
    try {
      await saveInspectionChecklistItem?.({
        category: '기타/접수',
        code: `SYM-${Date.now().toString().slice(-6)}`,
        name: newSym,
        score: 0,
        isDefectSymptom: true,
        description: '모바일 웹앱 증상저장 퀵버튼',
      });
    } catch {}
  };

  const [selectedCandidateAssetId, setSelectedCandidateAssetId] = useState<string>('');
  const isUnknownAsset = isUnknownAssetLabel(assetNo);

  const modelQuickPresets = useMemo(() => {
    const defaults = ['GS-1930', 'GS-2032', 'GS-2632', 'GS-2646', 'GS-3246', 'GS-4046', 'GS-4555', 'SJY-7.5'];
    const fromProducts = (products || [])
      .map(p => (p?.modelName || '').trim())
      .filter(Boolean);
    return Array.from(new Set([...defaults, ...fromProducts])).slice(0, 12);
  }, [products]);

  // 🌟 입력된 장비번호(자산번호/끝자리 숫자 포함)와 매칭되는 실물 자산 후보군 및 최우선 매칭 자산 판별
  const matchingAssetCandidates = useMemo(() => {
    const clean = (assetNo || '').trim().toUpperCase();
    if (!clean || isUnknownAssetLabel(clean)) return [] as Asset[];
    const cleanNoHyphen = clean.replace(/[-_\s]/g, '');
    const cleanDigits = clean.replace(/[^0-9]/g, '');

    const activeAssetIdSet = new Set<string>();
    (contractAssets || []).forEach(ca => {
      if (ca && ca.assetId && ca.status !== 'RETURNED' && ca.status !== 'SOLD' && !ca.actualReturnDate) {
        activeAssetIdSet.add(ca.assetId);
      }
    });

    const scored: { asset: Asset; score: number }[] = [];

    for (const a of assets || []) {
      if (!a) continue;
      const aNo = (a.assetNo || '').trim().toUpperCase();
      const aNoNoHyphen = aNo.replace(/[-_\s]/g, '');
      const aDigits = aNo.replace(/[^0-9]/g, '');
      const vNo = (a.vendorAssetNo || '').trim().toUpperCase();
      const vNoNoHyphen = vNo.replace(/[-_\s]/g, '');
      const vDigits = vNo.replace(/[^0-9]/g, '');

      let baseScore = 0;

      // 1순위: 전체 번호 완전 일치 (100점)
      if (
        (aNo && (aNo === clean || aNoNoHyphen === cleanNoHyphen)) ||
        (vNo && (vNo === clean || vNoNoHyphen === cleanNoHyphen))
      ) {
        baseScore = 100;
      }
      // 2순위: 접미사 일치 (예: '102' 입력 시 'G19102', 'G06102', 'R-102' 매칭) (90점)
      else if (
        cleanNoHyphen.length >= 2 &&
        ((aNoNoHyphen && aNoNoHyphen.endsWith(cleanNoHyphen)) ||
          (vNoNoHyphen && vNoNoHyphen.endsWith(cleanNoHyphen)))
      ) {
        baseScore = 90;
      }
      // 3순위: 숫자열 완전 일치 또는 숫자열 끝자리 일치 (85점)
      else if (
        cleanDigits.length >= 2 &&
        ((aDigits && (aDigits === cleanDigits || aDigits.endsWith(cleanDigits))) ||
          (vDigits && (vDigits === cleanDigits || vDigits.endsWith(cleanDigits))))
      ) {
        baseScore = 85;
      }
      // 4순위: 부분 포함 (70점)
      else if (
        cleanNoHyphen.length >= 2 &&
        ((aNoNoHyphen && aNoNoHyphen.includes(cleanNoHyphen)) ||
          (vNoNoHyphen && vNoNoHyphen.includes(cleanNoHyphen)))
      ) {
        baseScore = 70;
      }

      if (baseScore > 0) {
        let deployBonus = 0;
        if (a.status === 'RENTED' || activeAssetIdSet.has(a.id) || a.currentCustomerId || a.currentSiteId) {
          deployBonus = 6;
        } else if (a.status === 'ASSIGNED' || a.status === 'OUTBOUND_INSPECTION' || a.status === 'AWAITING_TRANSPORT') {
          deployBonus = 3;
        }
        scored.push({ asset: a, score: baseScore + deployBonus });
      }
    }

    scored.sort((x, y) => {
      if (y.score !== x.score) return y.score - x.score;
      return (x.asset.assetNo || '').localeCompare(y.asset.assetNo || '');
    });

    return scored.slice(0, 6).map(s => s.asset);
  }, [assetNo, assets, contractAssets]);

  const matchedAsset = useMemo(() => {
    if (matchingAssetCandidates.length === 0) return undefined;
    if (selectedCandidateAssetId) {
      const explicit = matchingAssetCandidates.find(a => a.id === selectedCandidateAssetId);
      if (explicit) return explicit;
    }
    return matchingAssetCandidates[0];
  }, [matchingAssetCandidates, selectedCandidateAssetId]);

  const getAssetVendorName = (asset?: Asset): string => {
    if (!asset) return '';
    const isSublease =
      asset.ownerType === 'RENTED' ||
      (asset as any).ownership === 'SUBLEASE' ||
      (asset as any).ownership === 'RENTED' ||
      Boolean(asset.renter?.trim());
    if (!isSublease) return '';
    if (asset.renter?.trim()) return asset.renter.trim();
    if (asset.vendorId) {
      const v = (vendors || []).find(vnd => vnd && vnd.id === asset.vendorId);
      if (v?.name?.trim()) return v.name.trim();
    }
    if (asset.supplier?.trim()) return asset.supplier.trim();
    return '외부임차';
  };

  const isRentedAsset = Boolean(
    matchedAsset &&
    (matchedAsset.ownerType === 'RENTED' ||
      (matchedAsset as any).ownership === 'SUBLEASE' ||
      (matchedAsset as any).ownership === 'RENTED' ||
      Boolean(matchedAsset.renter?.trim()))
  );

  const rentedVendorName = useMemo(() => {
    return getAssetVendorName(matchedAsset);
  }, [matchedAsset, vendors]);

  // 🌟 AS팀 소속 인원 목록 (퀵버튼 할당용)
  const asTeamMembers = useMemo(() => {
    const isActualAsTeamUser = (u: any): boolean => {
      if (!u || u.status === 'RETIRED' || isDeveloperUser(u)) return false;
      const deptName = getUserDepartmentName(u, departments || []).trim();
      const dId = String(u.departmentId || '').toUpperCase();

      if (
        deptName.includes('외국인') ||
        deptName.includes('출고') ||
        deptName.includes('영업') ||
        deptName.includes('관리') ||
        deptName.includes('기연리프트') ||
        dId.includes('0000006') ||
        dId === 'DEPT-6' ||
        dId.includes('0000004') ||
        dId === 'DEPT-4' ||
        dId.includes('0000003') ||
        dId === 'DEPT-3' ||
        dId.includes('0000002') ||
        dId === 'DEPT-2' ||
        dId.includes('0000001') ||
        dId === 'DEPT-1'
      ) {
        return false;
      }

      return (
        dId.includes('0000005') ||
        dId === 'DEPT-5' ||
        deptName.toUpperCase().includes('AS') ||
        deptName.includes('정비')
      );
    };

    return (users || [])
      .filter(isActualAsTeamUser)
      .map(u => ({
        id: u.id,
        name: u.name,
        position: u.position || '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [users, departments]);

  const selectedMechanic = useMemo(
    () => asTeamMembers.find(m => m.id === assignedMechanicId),
    [asTeamMembers, assignedMechanicId]
  );

  useEffect(() => {
    if (!assignedMechanicId && currentUser?.id && asTeamMembers.some(m => m.id === currentUser.id)) {
      setAssignedMechanicId(currentUser.id);
    }
  }, [currentUser?.id, asTeamMembers]);

  // 음성 및 통화 텍스트 파싱 상태
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() => ttsService.getIsEnabled());
  const [interimText, setInterimText] = useState('');
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedTranscript, setPastedTranscript] = useState('');
  const [recentModifiedFields, setRecentModifiedFields] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const safeDecrypt = (val?: string | null): string => {
    const raw = String(val || '').trim();
    if (!raw) return '';
    if (raw.startsWith('__EBRO_ENC__')) {
      try {
        return decryptSecret(raw).trim();
      } catch {
        return '';
      }
    }
    return raw;
  };

  // 🌟 매칭된 자산으로부터 고객사·현장명·도로명주소·담당자 연락처를 일괄 추출하여 폼에 자동 반영
  const applyAssetInfoToForm = (targetAsset: Asset) => {
    if (!targetAsset) return;
    if (targetAsset.modelName?.trim()) {
      setModelName(targetAsset.modelName.trim());
    }

    // 1순위: 활성 체결자산(RENTED -> ASSIGNED -> 미반납) 기반 계약 역추적
    const activeCa =
      (contractAssets || []).find(c => c.assetId === targetAsset.id && c.status === 'RENTED' && !c.actualReturnDate) ||
      (contractAssets || []).find(c => c.assetId === targetAsset.id && c.status === 'ASSIGNED' && !c.actualReturnDate) ||
      (contractAssets || []).find(c => c.assetId === targetAsset.id && c.status !== 'RETURNED' && c.status !== 'SOLD' && !c.actualReturnDate);

    const contract = activeCa
      ? (contracts || []).find(c => c.id === activeCa.contractId)
      : (targetAsset.currentCustomerId || targetAsset.currentSiteId)
        ? (contracts || []).find(
            c =>
              c.status === 'ACTIVE' &&
              ((targetAsset.currentSiteId && c.siteId === targetAsset.currentSiteId) ||
                (targetAsset.currentCustomerId && c.customerId === targetAsset.currentCustomerId))
          )
        : undefined;

    // 2순위: 자산 자체에 기록된 currentSiteId / currentCustomerId 직접 역추적
    const resolvedSiteId = contract?.siteId || targetAsset.currentSiteId || '';
    const site = resolvedSiteId ? (sites || []).find(s => s.id === resolvedSiteId) : undefined;

    const resolvedCustomerId = contract?.customerId || targetAsset.currentCustomerId || site?.customerId || '';
    const cust = resolvedCustomerId ? (customers || []).find(c => c.id === resolvedCustomerId) : undefined;

    const nextCustomerName = cust?.name?.trim() || contract?.customerName?.trim() || '';
    const nextSiteName = site?.name?.trim() || (contract as any)?.siteName?.trim() || '';

    if (nextCustomerName) {
      setCustomerName(nextCustomerName);
    }
    if (nextSiteName) {
      setSiteName(nextSiteName);
    }

    const nextAddress =
      site?.address?.trim() ||
      cust?.address?.trim() ||
      resolveSiteDetailedAddress({
        siteName: nextSiteName,
        customerName: nextCustomerName,
        assetNo: targetAsset.assetNo,
        customerSites: sites,
        contracts,
        contractAssets,
        customers,
      }) ||
      '';
    if (nextAddress && nextAddress !== (nextSiteName || nextCustomerName || '현장')) {
      setSiteAddress(nextAddress);
    }

    // 현장 담당자 성함 및 연락처 기본 정보 자동 채움
    const siteContacts = Array.isArray(site?.contacts) ? site!.contacts : [];
    const primaryContactObj = siteContacts.find(
      (c: any) => c && (c.name?.trim() || c.contact?.trim() || c.phone?.trim())
    ) as any;
    const nextReporterName =
      safeDecrypt(site?.contactName) ||
      safeDecrypt(primaryContactObj?.name) ||
      safeDecrypt(site?.safetyContactName) ||
      safeDecrypt(site?.billingContactName) ||
      '';
    const nextReporterContact =
      safeDecrypt(site?.contact) ||
      safeDecrypt(primaryContactObj?.contact || primaryContactObj?.phone) ||
      safeDecrypt(site?.safetyContactPhone) ||
      safeDecrypt(site?.billingContactPhone) ||
      safeDecrypt((cust as any)?.repContact) ||
      '';

    if (nextReporterName) {
      setReporterName(nextReporterName);
    }
    if (nextReporterContact) {
      setReporterContact(nextReporterContact);
    }
  };

  // 🌟 1. 장비번호 입력 시 계약 현장 및 고객사·도로명 주소·담당자 실시간 자동 역추적
  const handleAssetNoChange = (val: string) => {
    if (typeof val !== 'string') return;
    let nextVal = val;
    if (nextVal.startsWith(UNKNOWN_ASSET_NO) && nextVal.length > UNKNOWN_ASSET_NO.length) {
      nextVal = nextVal.slice(UNKNOWN_ASSET_NO.length).trimStart();
    }
    setAssetNo(nextVal);
    setSelectedCandidateAssetId('');
  };

  const handleToggleUnknownAsset = () => {
    if (isUnknownAsset) {
      setAssetNo('');
      setSelectedCandidateAssetId('');
    } else {
      setAssetNo(UNKNOWN_ASSET_NO);
      setSelectedCandidateAssetId('');
    }
  };

  // 매칭된 자산이 결정되거나 마스터 테이블 로드가 완료되면 즉시 고객·현장 기본 정보 자동 채움
  useEffect(() => {
    if (matchedAsset) {
      applyAssetInfoToForm(matchedAsset);
    }
  }, [matchedAsset?.id, customers.length, sites.length, contracts.length, contractAssets.length]);

  // 🌟 초기 인계 파라미터(내현장/자산조회 등에서 유입) 자동 바인딩 (헌장 1.1 & 과제 6)
  useEffect(() => {
    if (typeof initialAssetNo === 'string' && initialAssetNo.trim()) {
      handleAssetNoChange(initialAssetNo);
    }
    if (typeof initialSiteId === 'string' && initialSiteId.trim()) {
      const site = (sites || []).find(s => s.id === initialSiteId);
      if (site) {
        setSiteName(site.name || '');
        if (site.address?.trim()) setSiteAddress(site.address.trim());
        const cust = (customers || []).find(c => c.id === site.customerId);
        if (cust && !customerName) setCustomerName(cust.name || '');
      }
    }
  }, [initialAssetNo, initialSiteId]);

  // 🌟 고객사/현장 객체로부터 담당자 연락처 기본값 보조 채움
  const applySiteAndCustomerContactFallback = (site?: any, cust?: any) => {
    const siteContacts = Array.isArray(site?.contacts) ? site.contacts : [];
    const primaryContactObj = siteContacts.find(
      (c: any) => c && (c.name?.trim() || c.contact?.trim() || c.phone?.trim())
    );
    const nextReporterName =
      safeDecrypt(site?.contactName) ||
      safeDecrypt(primaryContactObj?.name) ||
      safeDecrypt(site?.safetyContactName) ||
      safeDecrypt(site?.billingContactName) ||
      '';
    const nextReporterContact =
      safeDecrypt(site?.contact) ||
      safeDecrypt(primaryContactObj?.contact || primaryContactObj?.phone) ||
      safeDecrypt(site?.safetyContactPhone) ||
      safeDecrypt(site?.billingContactPhone) ||
      safeDecrypt(cust?.repContact) ||
      '';
    if (nextReporterName && !reporterName.trim()) {
      setReporterName(nextReporterName);
    }
    if (nextReporterContact && !reporterContact.trim()) {
      setReporterContact(nextReporterContact);
    }
  };

  // 🌟 2. 고객사명 입력 시 마스터 일치 및 현장·도로명 주소 상속
  const handleCustomerNameChange = (val: string) => {
    if (typeof val !== 'string') return;
    setCustomerName(val);
    const clean = val.trim();
    if (!clean) return;

    const cust = (customers || []).find(c => (c?.name && typeof c.name === 'string') && (c.name.trim() === clean || c.name.includes(clean)));
    if (cust) {
      const cSites = (sites || []).filter(s => s.customerId === cust.id);
      if (cSites.length === 1) {
        setSiteName(cSites[0].name || '');
        if (cSites[0].address?.trim()) {
          setSiteAddress(cSites[0].address.trim());
        } else if (cust.address?.trim()) {
          setSiteAddress(cust.address.trim());
        }
        applySiteAndCustomerContactFallback(cSites[0], cust);
      } else {
        if (cust.address?.trim() && !siteAddress) {
          setSiteAddress(cust.address.trim());
        }
        applySiteAndCustomerContactFallback(undefined, cust);
      }
    }
  };

  // 🌟 3. 현장명 입력 시 현장 상세 주소 상속
  const handleSiteNameChange = (val: string) => {
    if (typeof val !== 'string') return;
    setSiteName(val);
    const clean = val.trim();
    if (!clean) return;

    const cNameClean = (customerName || '').trim();
    const matchedCust = (customers || []).find(c => (c?.name && typeof c.name === 'string') && (c.name.trim() === cNameClean || c.name.includes(cNameClean)));
    const cSites = matchedCust ? (sites || []).filter(s => s.customerId === matchedCust.id) : (sites || []);
    const site = cSites.find(s => (s?.name && typeof s.name === 'string') && (s.name.trim() === clean || s.name.includes(clean) || clean.includes(s.name.trim())));
    if (site) {
      if (site.address?.trim()) {
        setSiteAddress(site.address.trim());
      }
      applySiteAndCustomerContactFallback(site, matchedCust);
    }
  };

  // 통화 텍스트 파싱 및 폼 자동 반영 공통 함수
  const applyTranscript = (text: string) => {
    if (!text.trim()) return;
    const result = parseAsCallTranscript(text, customers || [], sites || [], assets || []);

    if (result.customerName) setCustomerName(result.customerName);
    if (result.siteName) setSiteName(result.siteName);
    if (result.siteAddress) {
      setSiteAddress(result.siteAddress);
    } else {
      const resolved = resolveSiteDetailedAddress({
        siteName: result.siteName || siteName,
        customerName: result.customerName || customerName,
        assetNo: result.assetNo || assetNo,
        locationDetail: result.locationDetail || locationDetail,
        customerSites: sites,
        contracts,
        contractAssets,
        customers,
      });
      if (resolved && resolved !== (result.siteName || result.customerName || '현장')) {
        setSiteAddress(resolved);
      }
    }
    if (result.assetNo) setAssetNo(result.assetNo);
    if (result.locationDetail) setLocationDetail(result.locationDetail);
    if (result.reporterName) setReporterName(result.reporterName);
    if (result.reporterContact) setReporterContact(result.reporterContact);
    if (result.issueCategory && CATEGORIES.includes(result.issueCategory)) {
      setIssueCategory(result.issueCategory);
    }
    if (result.issueDescription) setIssueDescription(result.issueDescription);
    if (result.priority) setPriority(result.priority);

    setRecentModifiedFields(result.modifiedFields);
  };

  // 고정밀 Groq Whisper STT 및 Web Speech 폴백 음성 제어
  const toggleListening = async () => {
    if (isListening) {
      // 녹음 종료 및 STT 분석
      setIsListening(false);

      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
        recognitionRef.current = null;
        return;
      }

      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        return;
      }

      setIsProcessing(true);
      setInterimText('음성을 분석하고 있습니다...');

      mediaRecorderRef.current.onstop = async () => {
        try {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
          }

          const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: mime });

          if (blob.size < 200) {
            setIsProcessing(false);
            setInterimText('');
            return;
          }

          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            try {
              const res = await fetch('/api/groq-stt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  audioBase64: base64Audio,
                  mimeType: mime,
                  language: 'ko',
                  prompt: '고소작업대 현장 긴급 AS 접수 고장수리. 증상: 상하강불량, 충전 전원 방전, 오일누유, 키박스 스위치 레버 조이스틱, 에러코드, 방지봉 협착, 파이프걸림. 긴급, 당장. 관리번호 장비번호 호기.'
                })
              });

              if (res.ok) {
                const data = await res.json();
                const text = (data?.textTranscript || '').trim();
                if (text) {
                  applyTranscript(text);
                  setInterimText(`인식완료: "${text}"`);
                  if (ttsService.getIsEnabled()) {
                    ttsService.speak('AS 정보가 폼에 반영되었습니다.');
                  }
                  setTimeout(() => setInterimText(''), 3000);
                } else {
                  setInterimText('음성이 명확하지 않습니다.');
                }
              } else {
                throw new Error('STT API 오류');
              }
            } catch (err) {
              console.warn('Groq STT failed:', err);
              setInterimText('음성 분석 실패. 다시 시도해주세요.');
            } finally {
              setIsProcessing(false);
            }
          };
        } catch (e) {
          setIsProcessing(false);
          setInterimText('');
        }
      };

      mediaRecorderRef.current.stop();
      return;
    }

    // 녹음 시작
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      streamRef.current = stream;

      if (typeof MediaRecorder !== 'undefined') {
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const candidates = isSafari
          ? ['audio/mp4', 'audio/aac']
          : ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
        const mimeType = candidates.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || '';

        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setIsListening(true);
        setInterimText('음성 듣는 중... (말씀 후 터치하여 완료)');
      } else {
        startBrowserAsStt();
      }
    } catch (err: any) {
      console.warn('Microphone error, fallback to browser STT:', err);
      startBrowserAsStt();
    }
  };

  const startBrowserAsStt = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showErrorModal('이 브라우저는 음성 인식을 지원하지 않습니다.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimText('음성 듣는 중... (말씀해 주세요)');
      };

      recognition.onresult = (event: any) => {
        let finalChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalChunk += event.results[i][0].transcript;
        }
        if (finalChunk.trim()) {
          applyTranscript(finalChunk.trim());
          setInterimText('');
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimText('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setIsListening(false);
    }
  };

  const handlePasteSubmit = () => {
    if (!pastedTranscript.trim()) return;
    applyTranscript(pastedTranscript);
    setShowPasteModal(false);
    setPastedTranscript('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      showErrorModal('고객사명은 필수 입력 항목입니다.');
      return;
    }

    const rawAssetNo = assetNo.trim();
    const isUnknown = !rawAssetNo || isUnknownAssetLabel(rawAssetNo);
    const finalAssetNo = isUnknown
      ? UNKNOWN_ASSET_NO
      : matchedAsset?.assetNo || rawAssetNo.toUpperCase();

    setIsSubmitting(true);
    try {
      // 🌟 고객사 및 현장 마스터 ID 자동 매핑 (도로명 주소 상속 보장)
      const cleanCustomerName = customerName.trim();
      const cleanSiteName = siteName.trim();
      const matchedCust = (customers || []).find(c => 
        (c?.name && typeof c.name === 'string') && 
        (c.name.trim() === cleanCustomerName || c.name.includes(cleanCustomerName))
      );
      const matchedSite = (sites || []).find(s => 
        (matchedCust ? s.customerId === matchedCust.id : true) && 
        (s?.name && typeof s.name === 'string') && 
        (s.name.trim() === cleanSiteName || s.name.includes(cleanSiteName) || cleanSiteName.includes(s.name))
      );

      const ticket = await createFieldAsTicket({
        customerId: matchedCust?.id,
        customerName: cleanCustomerName,
        siteId: matchedSite?.id,
        siteName: cleanSiteName,
        siteAddress: siteAddress.trim(),
        assetId: isUnknown ? '' : matchedAsset?.id,
        assetNo: finalAssetNo,
        modelName: modelName.trim() || (!isUnknown ? matchedAsset?.modelName : '') || '',
        vendorId: isUnknown ? undefined : matchedAsset?.vendorId,
        locationDetail,
        reporterName,
        reporterContact,
        issueCategory,
        issueDescription,
        priority,
        visitDate,
        scheduleDate: visitDate,
        mechanicId: selectedMechanic?.id || '',
        assignedMechanicId: selectedMechanic?.id || '',
        mechanicName: selectedMechanic?.name || '',
        status: selectedMechanic ? 'SCHEDULED' : 'REQUESTED',
        faultImageUrl: images[0] || '',
        evidenceImages: images,
      });

      onCreated(ticket.id);
    } catch (err: any) {
      showErrorModal('접수 등록 실패: ' + (err.message || ''));
    } finally {
      setIsSubmitting(false);
    }
  };

  const cleanCustName = (customerName || '').trim();
  const matchedCustomer = cleanCustName ? (customers || []).find(c => 
    (c?.name && typeof c.name === 'string') && 
    (c.name.trim() === cleanCustName || (cleanCustName.length >= 2 && c.name.includes(cleanCustName)))
  ) : undefined;
  const matchedCustomerSites = matchedCustomer 
    ? (sites || []).filter(s => s.customerId === matchedCustomer.id) 
    : [];

  return (
    <div className="flex flex-col gap-4 pb-28 p-4 bg-slate-950 min-h-screen">
      {/* 상단 헤더 */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 py-2 px-3 rounded-xl bg-slate-900 border border-slate-800 active:scale-95 transition-transform"
        >
          <ArrowLeft className="w-4 h-4" />
          뒤로가기
        </button>
        <span className="text-sm font-black text-white">현장 AS 접수</span>
        <div className="w-12" />
      </div>

      {/* AS 접수 폼 */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* 장비번호 (관리번호) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                장비번호
              </label>
              {isUnknownAsset && (
                <span
                  data-testid="mobile-as-unknown-asset-badge"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap flex-shrink-0"
                >
                  관리번호 모름 · 현장확인
                </span>
              )}
              {!isUnknownAsset && matchedAsset && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap flex-shrink-0 font-mono">
                  #{matchedAsset.assetNo} · {matchedAsset.modelName}
                </span>
              )}
              {!isUnknownAsset && isRentedAsset && (
                <span
                  data-testid="mobile-as-rented-vendor-badge"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 whitespace-nowrap flex-shrink-0"
                >
                  임차처: {rentedVendorName}
                </span>
              )}
            </div>
            <button
              type="button"
              data-testid="mobile-as-unknown-asset-btn"
              onClick={handleToggleUnknownAsset}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border whitespace-nowrap flex items-center gap-1 flex-shrink-0 active:scale-95 transition-all ${
                isUnknownAsset
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                  : 'bg-slate-900 text-amber-300 border-amber-500/40 hover:bg-slate-800'
              }`}
            >
              {isUnknownAsset && <Check className="w-3 h-3 stroke-[3]" />}
              <span>관리번호 모름</span>
            </button>
          </div>
          <input
            type="text"
            value={assetNo}
            onChange={(e) => handleAssetNoChange(e.target.value)}
            placeholder="예: 102, G19102, K7088 (모르면 [관리번호 모름] 선택)"
            className={`w-full rounded-xl p-3 text-sm font-mono uppercase placeholder-slate-500 focus:outline-none ${
              isUnknownAsset ? 'font-bold text-amber-300' : ''
            }`}
            style={{
              backgroundColor: '#090d16',
              color: isUnknownAsset ? '#fcd34d' : '#f8fafc',
              border: isUnknownAsset ? '1px solid rgba(245, 158, 11, 0.55)' : '1px solid #334155',
              colorScheme: 'dark'
            }}
          />
          {!isUnknownAsset && matchingAssetCandidates.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {matchingAssetCandidates.map(cand => {
                const isSelected = matchedAsset?.id === cand.id;
                const candVendor = getAssetVendorName(cand);
                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => {
                      setSelectedCandidateAssetId(cand.id);
                      setAssetNo(cand.assetNo);
                      applyAssetInfoToForm(cand);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-blue-600/30 border-blue-400 text-white'
                        : 'bg-slate-900 border-slate-700 text-slate-300'
                    }`}
                  >
                    <span className="font-mono font-black text-emerald-300">#{cand.assetNo}</span>
                    <span>{cand.modelName}</span>
                    {candVendor && (
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[10px] font-black">
                        임차처: {candVendor}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* 모델명 기록 (관리번호 모름 선택 시 또는 직접 모델 지정 시) */}
          {(isUnknownAsset || !matchedAsset || modelName) && (
            <div
              data-testid="mobile-as-model-name-section"
              className={`flex flex-col gap-1.5 mt-1 p-2.5 rounded-xl border ${
                isUnknownAsset
                  ? 'bg-amber-950/20 border-amber-500/40'
                  : 'bg-slate-900/60 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
                  모델명 {isUnknownAsset && <span className="text-amber-300 font-extrabold">(관리번호 모름 · 모델 기록)</span>}
                </label>
                {modelName && (
                  <span className="text-[11px] font-mono font-extrabold text-amber-300 whitespace-nowrap">
                    선택됨: {modelName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                {modelQuickPresets.map(presetModel => {
                  const active = modelName.trim().toUpperCase() === presetModel.toUpperCase();
                  return (
                    <button
                      key={presetModel}
                      type="button"
                      onClick={() => setModelName(active ? '' : presetModel)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono border whitespace-nowrap flex-shrink-0 transition-colors ${
                        active
                          ? 'bg-amber-500 text-slate-950 border-amber-400 font-black'
                          : 'bg-slate-950 text-slate-300 border-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {presetModel}
                    </button>
                  );
                })}
              </div>
              <input
                type="text"
                data-testid="mobile-as-model-name-input"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="모델명 직접 입력 또는 위 버튼 선택 (예: GS-1930, 2646, 3246)"
                className="w-full rounded-lg p-2.5 text-xs font-mono placeholder-slate-500 focus:outline-none"
                style={{
                  backgroundColor: '#090d16',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  colorScheme: 'dark',
                }}
              />
            </div>
          )}
        </div>

        {/* 고객사명 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
            고객사명 <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            required
            value={customerName}
            onChange={(e) => handleCustomerNameChange(e.target.value)}
            placeholder="고객사 상호명 입력"
            className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none"
            style={{
              backgroundColor: '#090d16',
              color: '#f8fafc',
              border: '1px solid #334155',
              colorScheme: 'dark'
            }}
          />
        </div>

        {/* 고객사 소속 현장 퀵 셀렉트 칩 */}
        {matchedCustomerSites.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap flex-shrink-0">
              등록 현장 선택
            </span>
            <div className="w-full min-w-0 max-w-full overflow-x-auto flex items-center gap-1.5 pb-1 scrollbar-none">
              {matchedCustomerSites.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSiteName(s.name);
                    if (s.address?.trim()) setSiteAddress(s.address.trim());
                    else if (matchedCustomer?.address?.trim()) setSiteAddress(matchedCustomer.address.trim());
                    applySiteAndCustomerContactFallback(s, matchedCustomer);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-lg border whitespace-nowrap flex-shrink-0 transition-colors ${
                    siteName === s.name
                      ? 'bg-blue-600 text-white border-blue-500 font-bold'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 현장명 / 상세 위치 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">현장명</label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => handleSiteNameChange(e.target.value)}
              placeholder="현장 이름"
              className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                colorScheme: 'dark'
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">상세 위치</label>
            <input
              type="text"
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
              placeholder="예: 지하 1층, 하역장"
              className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                colorScheme: 'dark'
              }}
            />
          </div>
        </div>

        {/* 현장 도로명 주소 (T맵/카카오내비/네이버지도 연동) */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
              현장 도로명 주소
            </label>
            {matchedCustomer?.address && typeof matchedCustomer.address === 'string' && siteAddress !== matchedCustomer.address.trim() && (
              <button
                type="button"
                onClick={() => setSiteAddress(matchedCustomer.address.trim())}
                className="text-[10px] font-bold text-sky-400 bg-sky-950/40 hover:bg-sky-900/60 px-2 py-0.5 rounded border border-sky-800/40 whitespace-nowrap flex-shrink-0"
              >
                고객사 주소 적용
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
              placeholder="도로명 주소 입력 (고객 정보 자동 연동)"
              className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none pr-9"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                colorScheme: 'dark'
              }}
            />
            {siteAddress && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sky-400 pointer-events-none">
                <MapPin className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>

        {/* 고장 분류 */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300">고장 분류</label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">우선순위:</span>
              <button
                type="button"
                onClick={() => setPriority(priority === 'NORMAL' ? 'URGENT' : 'NORMAL')}
                className={`px-2 py-0.5 rounded text-[11px] font-black border transition-colors ${
                  priority === 'URGENT'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {priority === 'URGENT' ? '🚨 긴급' : '일반'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5" data-testid="mobile-as-symptom-quick-buttons">
            {allQuickSymptoms.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setIssueCategory(cat);
                  if (!CATEGORIES.includes(cat) || !issueDescription.trim() || allQuickSymptoms.includes(issueDescription.trim())) {
                    setIssueDescription(cat);
                  }
                }}
                className={`py-2 px-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap truncate ${
                  issueCategory === cat
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-900 text-slate-400 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 고장 상세 증상 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">고장 상세 내용</label>
          <div className="relative">
            <textarea
              rows={3}
              value={issueDescription}
              onChange={(e) => setIssueDescription(e.target.value)}
              placeholder="고장 호소 내용 입력"
              className={`w-full rounded-xl p-3 ${isNewSymptom ? 'pb-10' : ''} text-sm placeholder-slate-500 focus:outline-none`}
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                colorScheme: 'dark'
              }}
            />
            {isNewSymptom && (
              <button
                type="button"
                data-testid="mobile-as-save-symptom-btn"
                onClick={handleSaveCustomSymptom}
                className="absolute right-2.5 bottom-2.5 px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white border border-emerald-400/40 shadow-md flex items-center gap-1 transition-all whitespace-nowrap z-10"
              >
                <Plus className="w-3 h-3" />
                증상저장
              </button>
            )}
          </div>
        </div>

        {/* 접수자 성함 및 연락처 */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">접수자 성함</label>
            <input
              type="text"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
              placeholder="예: 김반장, 이소장"
              className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                colorScheme: 'dark'
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">연락처</label>
            <input
              type="tel"
              value={reporterContact}
              onChange={(e) => setReporterContact(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                colorScheme: 'dark'
              }}
            />
          </div>
        </div>

        {/* 방문 예정일 */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">방문 예정일</label>
          <input
            type="date"
            value={visitDate}
            onChange={(e) => setVisitDate(e.target.value)}
            className="w-full rounded-xl p-3 text-sm placeholder-slate-500 focus:outline-none"
            style={{
              backgroundColor: '#090d16',
              color: '#f8fafc',
              border: '1px solid #334155',
              colorScheme: 'dark'
            }}
          />
        </div>

        {/* AS팀원 지정 (퀵버튼) */}
        <div className="flex flex-col gap-1.5" data-testid="mobile-as-mechanic-quick-assign">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 whitespace-nowrap flex-shrink-0">
              AS팀원 지정
            </label>
            <span className="text-[11px] font-bold text-sky-400 whitespace-nowrap flex-shrink-0">
              {selectedMechanic
                ? `${selectedMechanic.name}${selectedMechanic.position ? ` (${selectedMechanic.position})` : ''} 지정됨`
                : '미지정'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {asTeamMembers.map((mech) => {
              const isSelected = assignedMechanicId === mech.id;
              return (
                <button
                  key={mech.id}
                  type="button"
                  data-testid={`mobile-as-mechanic-btn-${mech.id}`}
                  onClick={() => setAssignedMechanicId(mech.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap flex-shrink-0 ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                  }`}
                >
                  {mech.name}{mech.position ? ` ${mech.position}` : ''}
                </button>
              );
            })}
            {assignedMechanicId && (
              <button
                type="button"
                data-testid="mobile-as-mechanic-clear-btn"
                onClick={() => setAssignedMechanicId('')}
                className="px-2.5 py-2 rounded-xl text-xs font-bold bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200 whitespace-nowrap flex-shrink-0"
              >
                미지정
              </button>
            )}
          </div>
        </div>

        {/* 고장 현장 사진 첨부 */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <CameraUploader
            label="고장 현장 사진 첨부 / 촬영"
            images={images}
            onChange={setImages}
            maxImages={4}
          />
        </div>

        {/* 접수 등록 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-base shadow-xl active:scale-98 transition-all"
        >
          {isSubmitting ? '접수 등록 중...' : '현장 AS 접수 등록'}
        </button>
      </form>

      {/* 📋 통화 텍스트 붙여넣기 모달 */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                고객 통화 녹음 텍스트 입력
              </h3>
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={5}
              value={pastedTranscript}
              onChange={(e) => setPastedTranscript(e.target.value)}
              placeholder="통화 내용을 붙여넣으세요...\n예: 102호기 상승이 안되고 삐소리 남, 내일 오전 김반장 010-1234-5678 판교 현장 급해요"
              className="w-full rounded-xl p-3 text-xs placeholder-slate-500 focus:outline-none font-sans leading-relaxed"
              style={{
                backgroundColor: '#090d16',
                color: '#f8fafc',
                border: '1px solid #334155',
                colorScheme: 'dark'
              }}
            />

            {/* 테스트용 예시 버튼 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">테스트 예시:</span>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setPastedTranscript('102호기 상승이 안되고 삐소리 남, 김반장 010-1234-5678 지하 1층 급해요')}
                  className="text-left py-1.5 px-2.5 rounded-lg bg-slate-800 text-[11px] text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  "102호기 상승이 안되고 삐소리 남, 김반장 010-1234-5678 지하 1층 급해요"
                </button>
                <button
                  type="button"
                  onClick={() => setPastedTranscript('205호 배터리 방전 시동 안걸림 하역장 이소장 010-9876-5432 점검요청')}
                  className="text-left py-1.5 px-2.5 rounded-lg bg-slate-800 text-[11px] text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  "205호 배터리 방전 시동 안걸림 하역장 이소장 010-9876-5432 점검요청"
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handlePasteSubmit}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-lg"
              >
                파싱 및 자동 반영
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
