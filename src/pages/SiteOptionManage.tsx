// src/pages/SiteOptionManage.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { SiteMaster, StandardOption, CustomerSite, Customer } from '../services/db';
import { SortableTh } from '../components/SortableTh';
import { 
  Shield, Check, Plus, Trash2, Edit3, Search, 
  CheckSquare, Download, Building2, 
  CheckCircle2, ChevronRight, Sliders, X, Layers, Copy
} from 'lucide-react';
import { SiteOptionItem, inheritOptionsFromMaster } from '../types/siteOption';
import { exportToExcel } from '../services/excel';
import { createHangulMatcher } from '../utils/hangulSearch';

export const SiteOptionManage: React.FC = () => {
  const { 
    customers, siteMasters, standardOptions, saveStandardOption, deleteStandardOption, 
    saveSiteMaster, deleteSiteMaster, showErrorModal, fullRefreshFromServer,
    navigationPayload, setNavigationPayload,
    sites
  } = useApp();

  // 1. 활성 탭: 'SITE_OPTIONS' (현장별 옵션 관리 - 옵션 그룹) vs 'MASTER_OPTIONS' (옵션 품목 마스터)
  const [activeTab, setActiveTab] = useState<'SITE_OPTIONS' | 'MASTER_OPTIONS'>('SITE_OPTIONS');

  // 2. 검색 상태
  const [searchSiteKeyword, setSearchSiteKeyword] = useState<string>('');

  // 3. 옵션 그룹 등록/수정/복사 모달 상태 (현장명만 사용, 주소 필드 완전 배제)
  const [showQuickSiteModal, setShowQuickSiteModal] = useState(false);
  const [quickSiteForm, setQuickSiteForm] = useState({ name: '', copyFromMasterId: '' });

  const [showEditSiteMasterModal, setShowEditSiteMasterModal] = useState(false);
  const [editSiteMasterForm, setEditSiteMasterForm] = useState({ id: '', name: '' });

  const [showCopySiteMasterModal, setShowCopySiteMasterModal] = useState(false);
  const [copySiteMasterForm, setCopySiteMasterForm] = useState({
    sourceId: '',
    sourceName: '',
    newName: '',
    useWorkingOptions: true
  });

  // 연결된 고객현장에 옵션 변경사항 일괄 전파 여부 (기본 true)
  const [propagateToLinkedSites, setPropagateToLinkedSites] = useState(true);
  const [hoveredPaidOptionId, setHoveredPaidOptionId] = useState<string | null>(null);

  // --- Master Option Sort ---
  type SortKey = keyof StandardOption;
  const [masterSortConfig, setMasterSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' | null }>({ key: 'sortOrder', direction: null });

  const sortedStandardOptions = useMemo(() => {
    const sorted = [...(standardOptions || [])];
    if (masterSortConfig.direction !== null) {
      sorted.sort((a: any, b: any) => {
        let valA: any = a[masterSortConfig.key];
        let valB: any = b[masterSortConfig.key];
        
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return masterSortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return masterSortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      const catRank: Record<string, number> = { PROTECTION: 0, PAID: 1, ATTACHMENT: 2, SPEC: 3 };
      sorted.sort((a, b) => {
        const ra = catRank[a.category] ?? 9;
        const rb = catRank[b.category] ?? 9;
        if (ra !== rb) return ra - rb;
        return (a.name || '').localeCompare(b.name || '', 'ko', { numeric: true, sensitivity: 'base' });
      });
    }
    return sorted;
  }, [standardOptions, masterSortConfig]);

  const handleMasterSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' | null = 'asc';
    if (masterSortConfig.key === key && masterSortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (masterSortConfig.key === key && masterSortConfig.direction === 'desc') {
      direction = null;
    }
    setMasterSortConfig({ key, direction });
  };

  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  // ── 🧭 외부 네비게이션 페이로드 수신 처리 ──
  useEffect(() => {
    if (navigationPayload) {
      if (navigationPayload.siteId) {
        setSelectedSiteId(navigationPayload.siteId);
      }
      if (navigationPayload.tab === 'MASTER_OPTIONS') {
        setActiveTab('MASTER_OPTIONS');
      }
      setNavigationPayload(null);
    }
  }, [navigationPayload, setNavigationPayload]);

  // 토스트 알림
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 선택된 옵션 그룹의 작업대 편집 상태 (SiteOptionItem[])
  const [workingOptionItems, setWorkingOptionItems] = useState<SiteOptionItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // 옵션 품목 마스터 신규/수정 모달 상태
  const [showMasterModal, setShowMasterModal] = useState(false);
  const [editingMasterOption, setEditingMasterOption] = useState<Partial<StandardOption> | null>(null);

  // 확인 대화상자 모달 상태
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    hideCancel?: boolean;
    isDanger?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '확인',
    hideCancel: false,
    isDanger: false,
    onConfirm: () => {}
  });

  // ── 🗺️ O(1) 고속 조회용 인덱스 맵 ──
  const customerMap = useMemo(() => {
    const map = new Map<string, Customer>();
    (customers || []).forEach((c: Customer) => map.set(c.id, c));
    return map;
  }, [customers]);

  const siteMasterMap = useMemo(() => {
    const map = new Map<string, SiteMaster>();
    (siteMasters || []).forEach((sm: SiteMaster) => map.set(sm.id, sm));
    return map;
  }, [siteMasters]);

  const sitesByMasterMap = useMemo(() => {
    const map = new Map<string, CustomerSite[]>();
    (sites || []).forEach((s: CustomerSite) => {
      if (!s.siteMasterId) return;
      const list = map.get(s.siteMasterId);
      if (list) list.push(s);
      else map.set(s.siteMasterId, [s]);
    });
    return map;
  }, [sites]);

  // ── 🏢 각 옵션 그룹별 상속받은 고객현장 집계 ──
  const siteCustomerStatsMap = useMemo(() => {
    const stats: Record<string, {
      linkedSiteCount: number;
      linkedSiteLabels: string[];
      linkedCustomerNames: string[];
    }> = {};

    (siteMasters || []).forEach((sm: SiteMaster) => {
      const linkedSites = sitesByMasterMap.get(sm.id) || [];
      const linkedCustIds = Array.from(new Set(linkedSites.map(s => s.customerId).filter((cid): cid is string => Boolean(cid))));
      const linkedCustNames = linkedCustIds.map(cid => customerMap.get(cid)?.name || cid);
      const linkedSiteLabels = linkedSites.map(s => {
        const custName = s.customerId ? customerMap.get(s.customerId)?.name : undefined;
        return custName ? `${custName}(${s.name || ''})` : (s.name || '');
      });

      stats[sm.id] = {
        linkedSiteCount: linkedSites.length,
        linkedSiteLabels,
        linkedCustomerNames: linkedCustNames,
      };
    });

    return stats;
  }, [siteMasters, sitesByMasterMap, customerMap]);

  // ── 🎯 필터링된 옵션 그룹 목록 ──
  const filteredSites = useMemo(() => {
    const kw = searchSiteKeyword.trim();
    const matcher = kw ? createHangulMatcher(kw) : null;

    return (siteMasters || []).filter((s: SiteMaster) => {
      if (matcher) {
        const stats = siteCustomerStatsMap[s.id];
        const matchName = matcher(s.name || '');
        const matchOpt = matcher(s.paidOptions || '') || matcher(s.protection || '') || matcher(s.attachments || '');
        const matchCust = (stats?.linkedCustomerNames || []).some(cn => matcher(cn)) ||
          (stats?.linkedSiteLabels || []).some(sl => matcher(sl));
        if (!matchName && !matchOpt && !matchCust) return false;
      }
      return true;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
  }, [siteMasters, searchSiteKeyword, siteCustomerStatsMap]);

  // 첫 번째 옵션 그룹 자동 선택
  useEffect(() => {
    if (!selectedSiteId && filteredSites.length > 0) {
      setSelectedSiteId(filteredSites[0].id);
    } else if (selectedSiteId && filteredSites.length > 0 && !filteredSites.some(s => s.id === selectedSiteId)) {
      setSelectedSiteId(filteredSites[0].id);
    }
  }, [filteredSites, selectedSiteId]);

  // 선택된 옵션 그룹 객체
  const activeSite = useMemo(() => {
    return siteMasterMap.get(selectedSiteId) || null;
  }, [siteMasterMap, selectedSiteId]);

  // ── 🔄 옵션 그룹 선택 시 옵션품목마스터에서 옵션값 로드 ──
  useEffect(() => {
    if (!activeSite) {
      setWorkingOptionItems([]);
      return;
    }

    const inherited = inheritOptionsFromMaster(
      activeSite.id,
      standardOptions || [],
      activeSite.paidOptions,
      activeSite.protection,
      activeSite.checkedSpecs,
      activeSite.attachments
    );

    setWorkingOptionItems(inherited);
  }, [activeSite, standardOptions]);

  // ── 🔧 작업대 옵션 배열(SiteOptionItem[])을 SiteMaster 저장 포맷으로 직렬화 ──
  const serializeOptionItems = (items: SiteOptionItem[], baseSpecs?: Record<string, any>) => {
    const paidNames = items
      .filter(item => item.category === 'PAID' && item.isEnabled)
      .map(item => item.name)
      .join(', ');

    const protItems = items.filter(item =>
      item.category === 'PROTECTION' &&
      item.isEnabled &&
      !(item.name.toUpperCase().includes('NONE') || item.name.includes('보양 없음') || item.name.includes('보양없음'))
    );
    const protName = protItems.length > 0 ? protItems.map(item => item.name).join(', ') : 'NONE';

    const attachmentNames = items
      .filter(item => item.category === 'ATTACHMENT' && item.isEnabled)
      .map(item => item.name)
      .join(', ');

    const specsMap: Record<string, any> = {};
    if (baseSpecs && typeof baseSpecs === 'object') {
      Object.entries(baseSpecs).forEach(([k, v]) => {
        if (k.startsWith('__') && k !== '__attachments' && k !== '__optionMeta') {
          specsMap[k] = v;
        }
      });
    }

    items
      .filter(item => item.category === 'SPEC' && item.isEnabled)
      .forEach(item => {
        specsMap[item.optionId] = true;
      });

    const optionMeta: Record<string, { appliedPrice?: number; isRequired?: boolean; note?: string }> = {};
    items.forEach(item => {
      if (item.isEnabled || item.appliedPrice !== item.defaultPrice || item.isRequired || (item.note && item.note.trim())) {
        const metaEntry = {
          appliedPrice: Number(item.appliedPrice || 0),
          isRequired: Boolean(item.isRequired),
          note: (item.note || '').trim()
        };
        optionMeta[item.optionId] = metaEntry;
        if (item.name && item.name !== item.optionId) {
          optionMeta[item.name] = metaEntry;
        }
      }
    });
    if (Object.keys(optionMeta).length > 0) {
      specsMap.__optionMeta = optionMeta;
    }

    return {
      paidOptions: paidNames,
      protection: protName,
      attachments: attachmentNames,
      checkedSpecs: specsMap
    };
  };

  // ── 옵션 그룹 등록/수정/복사/삭제 핸들러 ──
  const handleSaveQuickSite = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawName = (quickSiteForm.name || '').trim();
    if (!rawName) {
      showErrorModal('현장명(옵션 그룹명)을 입력해주세요.');
      return;
    }

    const normalizedInput = rawName.replace(/\s+/g, '').toLowerCase();
    const duplicate = (siteMasters || []).find(
      m => (m.name || '').replace(/\s+/g, '').toLowerCase() === normalizedInput
    );
    if (duplicate) {
      showErrorModal(`동일한 이름의 옵션 그룹이 이미 등록되어 있습니다.\n\n• 기존 그룹명: [${duplicate.name}]`);
      return;
    }

    const copySource = quickSiteForm.copyFromMasterId
      ? siteMasterMap.get(quickSiteForm.copyFromMasterId) || null
      : null;

    try {
      const created = await saveSiteMaster({
        name: rawName,
        isActive: true,
        paidOptions: copySource ? (copySource.paidOptions || '') : '',
        protection: copySource ? (copySource.protection || 'NONE') : 'NONE',
        attachments: copySource ? (copySource.attachments || '') : '',
        checkedSpecs: copySource && copySource.checkedSpecs
          ? JSON.parse(JSON.stringify(copySource.checkedSpecs))
          : {}
      });
      if (created?.id) {
        setSelectedSiteId(created.id);
      }
      showToast(
        copySource
          ? `[${copySource.name}] 옵션을 통째 복사하여 [${rawName}] 그룹이 등록되었습니다.`
          : `[${rawName}] 옵션 그룹이 등록되었습니다.`
      );
      setShowQuickSiteModal(false);
      setQuickSiteForm({ name: '', copyFromMasterId: '' });
    } catch (err: any) {
      showErrorModal(`옵션 그룹 등록 오류: ${err?.message || err}`);
    }
  };

  const handleOpenCopyMaster = (site: SiteMaster, useWorking = true) => {
    setCopySiteMasterForm({
      sourceId: site.id,
      sourceName: site.name || '',
      newName: `${site.name || ''} `,
      useWorkingOptions: useWorking && site.id === selectedSiteId
    });
    setShowCopySiteMasterModal(true);
  };

  const handleSaveCopyMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawName = (copySiteMasterForm.newName || '').trim();
    if (!rawName) {
      showErrorModal('새로운 옵션 그룹명을 입력해주세요.');
      return;
    }

    const normalizedInput = rawName.replace(/\s+/g, '').toLowerCase();
    const duplicate = (siteMasters || []).find(
      m => (m.name || '').replace(/\s+/g, '').toLowerCase() === normalizedInput
    );
    if (duplicate) {
      showErrorModal(`동일한 이름의 옵션 그룹이 이미 등록되어 있습니다.\n\n• 기존 그룹명: [${duplicate.name}]`);
      return;
    }

    const sourceMaster = siteMasterMap.get(copySiteMasterForm.sourceId);
    if (!sourceMaster) {
      showErrorModal('복사할 기준 옵션 그룹을 찾을 수 없습니다.');
      return;
    }

    try {
      let payloadOptions: {
        paidOptions: string;
        protection: string;
        attachments: string;
        checkedSpecs: Record<string, any>;
      };

      if (copySiteMasterForm.useWorkingOptions && sourceMaster.id === selectedSiteId && workingOptionItems.length > 0) {
        payloadOptions = serializeOptionItems(workingOptionItems, sourceMaster.checkedSpecs);
      } else {
        payloadOptions = {
          paidOptions: sourceMaster.paidOptions || '',
          protection: sourceMaster.protection || 'NONE',
          attachments: sourceMaster.attachments || '',
          checkedSpecs: sourceMaster.checkedSpecs
            ? JSON.parse(JSON.stringify(sourceMaster.checkedSpecs))
            : {}
        };
      }

      const created = await saveSiteMaster({
        name: rawName,
        isActive: true,
        paidOptions: payloadOptions.paidOptions,
        protection: payloadOptions.protection,
        attachments: payloadOptions.attachments,
        checkedSpecs: payloadOptions.checkedSpecs,
        updatedAt: new Date().toISOString()
      });

      if (created?.id) {
        setSelectedSiteId(created.id);
      }
      setShowCopySiteMasterModal(false);
      showToast(`[${sourceMaster.name}] 옵션을 통째 복사하여 [${rawName}] 그룹으로 등록했습니다.`);
    } catch (err: any) {
      showErrorModal(`옵션 그룹 복사 오류: ${err?.message || err}`);
    }
  };

  const handleOpenEditMaster = (site: SiteMaster) => {
    setEditSiteMasterForm({ id: site.id, name: site.name || '' });
    setShowEditSiteMasterModal(true);
  };

  const handleSaveEditMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = (editSiteMasterForm.name || '').trim();
    if (!cleanName) {
      showErrorModal('현장명(옵션 그룹명)을 입력해주세요.');
      return;
    }
    const normalizedInput = cleanName.replace(/\s+/g, '').toLowerCase();
    const duplicate = (siteMasters || []).find(
      m => m.id !== editSiteMasterForm.id && (m.name || '').replace(/\s+/g, '').toLowerCase() === normalizedInput
    );
    if (duplicate) {
      showErrorModal(`동일한 이름의 옵션 그룹이 이미 존재합니다: [${duplicate.name}]`);
      return;
    }

    try {
      await saveSiteMaster({ id: editSiteMasterForm.id, name: cleanName });
      setShowEditSiteMasterModal(false);
      showToast('옵션 그룹명이 수정되었습니다.');
    } catch (err: any) {
      showErrorModal('저장 실패: ' + err.message);
    }
  };

  const handleDeleteSite = (site: SiteMaster) => {
    const linkedCustomerSites = sitesByMasterMap.get(site.id) || [];
    setConfirmModal({
      isOpen: true,
      title: '옵션 그룹 삭제 확인',
      message:
        `[${site.name}] 옵션 그룹을 삭제하시겠습니까?\n\n` +
        (linkedCustomerSites.length > 0
          ? `• 현재 이 그룹을 상속 연결 중인 고객현장(${linkedCustomerSites.length}곳)의 그룹 연결이 해제되며, 고객현장에 이미 복사된 옵션과 현장 정보는 안전하게 그대로 유지됩니다.`
          : `• 현재 연결된 고객현장: 0곳`),
      confirmText: '옵션 그룹 삭제',
      hideCancel: false,
      isDanger: true,
      onConfirm: async () => {
        try {
          const remaining = filteredSites.filter(s => s.id !== site.id);
          await deleteSiteMaster(site.id);
          setSelectedSiteId(remaining.length > 0 ? remaining[0].id : '');
          showToast(`[${site.name}] 옵션 그룹이 삭제되었습니다.`);
        } catch (err: any) {
          showErrorModal('옵션 그룹 삭제 실패: ' + err.message);
        }
      }
    });
  };

  // ── 💡 옵션 적용 여부 토글 핸들러 ──
  const handleToggleOption = (optionId: string) => {
    setWorkingOptionItems(prev => prev.map(item => {
      if (item.optionId === optionId) {
        return { ...item, isEnabled: !item.isEnabled };
      }
      return item;
    }));
  };

  // ── 💡 보양작업 복수 선택 토글 핸들러 ──
  const handleToggleProtection = (optionId: string) => {
    setWorkingOptionItems(prev => {
      const targetItem = prev.find(item => item.optionId === optionId);
      if (!targetItem) return prev;

      const isNoneBtn = targetItem.name.toUpperCase().includes('NONE') || targetItem.name.includes('보양 없음') || targetItem.name.includes('보양없음');

      if (isNoneBtn) {
        return prev.map(item => {
          if (item.category === 'PROTECTION') {
            const isThisNone = item.name.toUpperCase().includes('NONE') || item.name.includes('보양 없음') || item.name.includes('보양없음');
            return { ...item, isEnabled: isThisNone };
          }
          return item;
        });
      }

      const updated = prev.map(item => {
        if (item.category === 'PROTECTION') {
          const isThisNone = item.name.toUpperCase().includes('NONE') || item.name.includes('보양 없음') || item.name.includes('보양없음');
          if (isThisNone) {
            return { ...item, isEnabled: false };
          }
          if (item.optionId === optionId) {
            return { ...item, isEnabled: !item.isEnabled };
          }
        }
        return item;
      });

      const anyActive = updated.some(item => 
        item.category === 'PROTECTION' && 
        !(item.name.toUpperCase().includes('NONE') || item.name.includes('보양 없음') || item.name.includes('보양없음')) && 
        item.isEnabled
      );

      if (!anyActive) {
        return updated.map(item => {
          if (item.category === 'PROTECTION') {
            const isThisNone = item.name.toUpperCase().includes('NONE') || item.name.includes('보양 없음') || item.name.includes('보양없음');
            return { ...item, isEnabled: isThisNone };
          }
          return item;
        });
      }

      return updated;
    });
  };

  // ── 💰 특약 단가 변경 핸들러 ──
  const handlePriceChange = (optionId: string, newPrice: number) => {
    setWorkingOptionItems(prev => prev.map(item => {
      if (item.optionId === optionId) {
        return { ...item, appliedPrice: Math.max(0, newPrice) };
      }
      return item;
    }));
  };

  // ── ⭐ 필수 장착 여부 토글 핸들러 ──
  const handleToggleRequired = (optionId: string) => {
    setWorkingOptionItems(prev => prev.map(item => {
      if (item.optionId === optionId) {
        return { ...item, isRequired: !item.isRequired };
      }
      return item;
    }));
  };

  // ── 📝 메모 변경 핸들러 ──
  const handleNoteChange = (optionId: string, note: string) => {
    setWorkingOptionItems(prev => prev.map(item => {
      if (item.optionId === optionId) {
        return { ...item, note };
      }
      return item;
    }));
  };

  // ── 📊 작업대 옵션 카테고리별 분류 및 월 유상옵션 총액 1-Pass 집계 ──
  const {
    paidDisabledOptions,
    paidEnabledOptions,
    protectionOptions,
    protectionEnabledDisplay,
    attachmentDisabledOptions,
    attachmentEnabledOptions,
    specDisabledOptions,
    specEnabledOptions,
    monthlyPaidFeeTotal
  } = useMemo(() => {
    const paidDisabled: SiteOptionItem[] = [];
    const paidEnabled: SiteOptionItem[] = [];
    const protection: SiteOptionItem[] = [];
    const protectionEnabledNames: string[] = [];
    const attachmentDisabled: SiteOptionItem[] = [];
    const attachmentEnabled: SiteOptionItem[] = [];
    const specDisabled: SiteOptionItem[] = [];
    const specEnabled: SiteOptionItem[] = [];
    let paidSum = 0;

    for (const item of workingOptionItems) {
      if (item.category === 'PAID') {
        if (item.isEnabled) {
          paidEnabled.push(item);
          paidSum += item.appliedPrice || 0;
        } else {
          paidDisabled.push(item);
        }
      } else if (item.category === 'PROTECTION') {
        protection.push(item);
        if (item.isEnabled) {
          protectionEnabledNames.push(item.name);
        }
      } else if (item.category === 'ATTACHMENT') {
        if (item.isEnabled) {
          attachmentEnabled.push(item);
        } else {
          attachmentDisabled.push(item);
        }
      } else if (item.category === 'SPEC') {
        if (item.isEnabled) {
          specEnabled.push(item);
        } else {
          specDisabled.push(item);
        }
      }
    }

    const sortByNameAsc = (a: SiteOptionItem, b: SiteOptionItem) =>
      (a.name || '').localeCompare(b.name || '', 'ko', { numeric: true, sensitivity: 'base' });
    paidDisabled.sort(sortByNameAsc);
    paidEnabled.sort(sortByNameAsc);
    protection.sort(sortByNameAsc);
    attachmentDisabled.sort(sortByNameAsc);
    attachmentEnabled.sort(sortByNameAsc);
    specDisabled.sort(sortByNameAsc);
    specEnabled.sort(sortByNameAsc);

    return {
      paidDisabledOptions: paidDisabled,
      paidEnabledOptions: paidEnabled,
      protectionOptions: protection,
      protectionEnabledDisplay: protectionEnabledNames.join(', ') || 'NONE',
      attachmentDisabledOptions: attachmentDisabled,
      attachmentEnabledOptions: attachmentEnabled,
      specDisabledOptions: specDisabled,
      specEnabledOptions: specEnabled,
      monthlyPaidFeeTotal: paidSum
    };
  }, [workingOptionItems]);

  // ── 💾 옵션 그룹 설정 저장 ──
  const handleSaveSiteOptions = async () => {
    if (!activeSite) return;
    setIsSaving(true);
    try {
      const serialized = serializeOptionItems(workingOptionItems, activeSite.checkedSpecs);
      const linkedCount = (sitesByMasterMap.get(activeSite.id) || []).length;

      await saveSiteMaster(
        {
          id: activeSite.id,
          name: activeSite.name,
          paidOptions: serialized.paidOptions,
          protection: serialized.protection,
          attachments: serialized.attachments,
          checkedSpecs: serialized.checkedSpecs,
          updatedAt: new Date().toISOString()
        },
        { propagateToLinkedSites }
      );

      showToast(
        propagateToLinkedSites && linkedCount > 0
          ? `[${activeSite.name}] 옵션 그룹 저장 및 연결된 고객현장 ${linkedCount}곳에 옵션이 일괄 반영되었습니다.`
          : `[${activeSite.name}] 옵션 그룹 설정이 저장되었습니다.`
      );
    } catch (err: any) {
      showErrorModal(`옵션 그룹 저장 실패: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── 📥 엑셀 내보내기 ──
  const handleExportExcel = () => {
    const rows = filteredSites.map(s => {
      const stats = siteCustomerStatsMap[s.id];
      return {
        '현장명(옵션그룹명)': s.name,
        '유상옵션': s.paidOptions || '미지정',
        '무상옵션': s.protection || 'NONE',
        '부착물': s.attachments || '미지정',
        '상속현장수': `${stats?.linkedSiteCount || 0}곳`,
        '상속고객현장목록': stats?.linkedSiteLabels?.join(', ') || '-',
      };
    });
    exportToExcel(rows, `현장별옵션그룹_${new Date().toISOString().split('T')[0]}`);
  };

  // ── 🏷️ 옵션 품목 마스터 저장 (신규/수정) ──
  const handleSaveMasterOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMasterOption || !editingMasterOption.name?.trim()) {
      showErrorModal('옵션 품목명을 입력해주세요.');
      return;
    }
    const rawName = editingMasterOption.name.trim();
    if (rawName.includes(',')) {
      const suggestedName = rawName.replace(/\s*,\s*/g, '·');
      setEditingMasterOption(prev => prev ? { ...prev, name: suggestedName } : prev);
      showErrorModal(
        `옵션 품목명에는 쉼표(,)를 사용할 수 없습니다.\n(다중 옵션 저장 시 구분자와 충돌하여 항목이 분리될 수 있습니다.)\n\n• 입력하신 쉼표(,)를 가운뎃점(·)으로 자동 변환했습니다:\n  [${suggestedName}]\n\n확인 후 다시 [저장] 버튼을 눌러주세요.`
      );
      return;
    }
    try {
      const optionToSave: any = {
        ...(editingMasterOption.id ? { id: editingMasterOption.id } : {}),
        category: editingMasterOption.category || 'PAID',
        name: rawName,
        defaultPrice: Number(editingMasterOption.defaultPrice || 0),
        unit: editingMasterOption.unit || '월',
        description: editingMasterOption.description || '',
        isActive: editingMasterOption.isActive !== false,
        sortOrder: Number(editingMasterOption.sortOrder || (standardOptions.length + 1)),
        createdAt: editingMasterOption.createdAt || new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString()
      };

      await saveStandardOption(optionToSave);
      setShowMasterModal(false);
      setEditingMasterOption(null);
      showToast('옵션 품목 마스터가 저장되었습니다.');
    } catch (err: any) {
      showErrorModal(`옵션 마스터 저장 오류: ${err?.message || err}`);
    }
  };

  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showMasterModal) setShowMasterModal(false);
        if (showQuickSiteModal) setShowQuickSiteModal(false);
        if (showEditSiteMasterModal) setShowEditSiteMasterModal(false);
        if (showCopySiteMasterModal) setShowCopySiteMasterModal(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (showMasterModal) {
          const mockEvent = { preventDefault: () => {} } as React.FormEvent;
          handleSaveMasterOption(mockEvent);
        } else {
          handleSaveSiteOptions();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMasterModal, showQuickSiteModal, showEditSiteMasterModal, showCopySiteMasterModal, handleSaveMasterOption, handleSaveSiteOptions]);

  return (
    <div data-hs-observe="siteoptionmanage" 
      data-subview="site_options" 
      data-subview-title="현장별 옵션 관리"
      style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', minHeight: 0, overflow: 'hidden' }}
    >
      {/* 옵션 그룹명 수정 모달 (주소 필드 없음) */}
      {showEditSiteMasterModal && (
        <div className="modal-overlay" onClick={() => setShowEditSiteMasterModal(false)} style={{ zIndex: 10000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', padding: 0, overflow: 'hidden' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Edit3 size={16} color="var(--primary)" />
                현장명(옵션 그룹명) 수정
              </h3>
              <button type="button" onClick={() => setShowEditSiteMasterModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveEditMaster} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>현장명 (옵션 그룹명) *</label>
                <input
                  required
                  type="text"
                  value={editSiteMasterForm.name}
                  onChange={e => setEditSiteMasterForm({ ...editSiteMasterForm, name: e.target.value })}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                />
              </div>
              <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowEditSiteMasterModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--primary)', border: '1px solid var(--primary)', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 기존 옵션 그룹 통째 복사 모달 */}
      {showCopySiteMasterModal && (
        <div className="modal-overlay" onClick={() => setShowCopySiteMasterModal(false)} style={{ zIndex: 10000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px', padding: 0, overflow: 'hidden' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Copy size={16} color="var(--primary)" />
                옵션 그룹 복사 등록
              </h3>
              <button type="button" onClick={() => setShowCopySiteMasterModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCopyMaster} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>복사 기준 옵션 그룹</label>
                <select
                  value={copySiteMasterForm.sourceId}
                  onChange={e => {
                    const nextId = e.target.value;
                    const found = siteMasterMap.get(nextId);
                    setCopySiteMasterForm(prev => ({
                      ...prev,
                      sourceId: nextId,
                      sourceName: found?.name || '',
                      newName: found ? `${found.name} ` : prev.newName,
                      useWorkingOptions: nextId === selectedSiteId
                    }));
                  }}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 700 }}
                >
                  {(siteMasters || []).map(sm => (
                    <option key={sm.id} value={sm.id}>{sm.name}</option>
                  ))}
                </select>
              </div>

              {copySiteMasterForm.sourceId === selectedSiteId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', padding: '8px 10px', borderRadius: '6px', backgroundColor: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.25)' }}>
                  <input
                    type="checkbox"
                    checked={copySiteMasterForm.useWorkingOptions}
                    onChange={e => setCopySiteMasterForm(prev => ({ ...prev, useWorkingOptions: e.target.checked }))}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                  />
                  <span>현재 화면에서 체크·수정한 옵션 구성을 그대로 포함하여 복사</span>
                </label>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>새로운 옵션 그룹명 *</label>
                <input
                  required
                  autoFocus
                  type="text"
                  placeholder="예: 삼성반도체 표준옵션 - 협력업체명"
                  value={copySiteMasterForm.newName}
                  onChange={e => setCopySiteMasterForm(prev => ({ ...prev, newName: e.target.value }))}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1.5px solid var(--primary)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 700 }}
                />
              </div>

              <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowCopySiteMasterModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--primary)', border: '1px solid var(--primary)', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>복사 및 신규 등록</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 신규 옵션 그룹 등록 모달 (주소 필드 없음) */}
      {showQuickSiteModal && (
        <div className="modal-overlay" onClick={() => setShowQuickSiteModal(false)} style={{ zIndex: 10000 }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', padding: 0, overflow: 'hidden' }}>
            <div style={{ backgroundColor: 'var(--bg-card)', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers size={16} color="var(--primary)" />
                신규 현장 등록
              </h3>
              <button type="button" onClick={() => setShowQuickSiteModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveQuickSite} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>기존 옵션 그룹 복사</label>
                <select
                  value={quickSiteForm.copyFromMasterId || ''}
                  onChange={e => {
                    const srcId = e.target.value;
                    const src = siteMasterMap.get(srcId);
                    setQuickSiteForm(prev => ({
                      ...prev,
                      copyFromMasterId: srcId,
                      name: (!prev.name.trim() && src) ? `${src.name} ` : prev.name
                    }));
                  }}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                >
                  <option value="">복사 안 함 — 빈 옵션 그룹으로 시작</option>
                  {(siteMasters || []).map(sm => (
                    <option key={sm.id} value={sm.id}>{sm.name} 옵션 통째 복사</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>현장명 (옵션 그룹명) *</label>
                <input
                  required
                  type="text"
                  placeholder="예: 삼성반도체 표준옵션 / 현대건설 기본그룹"
                  value={quickSiteForm.name}
                  onChange={e => setQuickSiteForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{ width: '100%', height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-main)', fontSize: '13px' }}
                />
              </div>

              <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setShowQuickSiteModal(false)} style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>취소</button>
                <button type="submit" style={{ padding: '8px 16px', borderRadius: '6px', backgroundColor: 'var(--primary)', border: '1px solid var(--primary)', color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>등록 및 저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 토스트 알림 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: 'var(--primary)',
          color: '#fff',
          padding: '10px 18px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 700,
          zIndex: 9999,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 상단 타이틀 바 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontWeight: '700', fontSize: '17px', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            현장별 옵션 관리
          </h2>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            옵션 그룹 <strong>{siteMasters?.length || 0}</strong>개 (조회 <strong>{filteredSites.length}</strong>개)
          </span>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 헌장 3.5 Gutenberg Z-패턴: ①좌상단 스코프 & ②우상단 파이프라인 */}
      {/* ──────────────────────────────────────────────────────── */}
      <div 
        data-mid="filter-panel"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          flexShrink: 0
        }}
      >
        {/* ① 좌상단: 옵션 그룹 검색 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              옵션 그룹 검색
            </span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="현장명(그룹명), 옵션명, 상속고객"
                value={searchSiteKeyword}
                onChange={e => setSearchSiteKeyword(e.target.value)}
                style={{
                  height: '34px',
                  paddingLeft: '30px',
                  paddingRight: '10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  outline: 'none',
                  width: '240px'
                }}
              />
            </div>
          </div>
        </div>

        {/* ② 우상단: 탭 전환 & 액션 버튼군 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          <div 
            data-mid="tab-toggle"
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid var(--border-color)'
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('SITE_OPTIONS')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: activeTab === 'SITE_OPTIONS' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'SITE_OPTIONS' ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Building2 size={13} />
              현장별 옵션 관리
            </button>
          </div>

          <button
            type="button"
            data-mid="btn-option-master-manage"
            onClick={() => setActiveTab('MASTER_OPTIONS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '34px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid #0369a1',
              backgroundColor: activeTab === 'MASTER_OPTIONS' ? 'var(--primary)' : '#0284c7',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)'
            }}
          >
            <Sliders size={13} color="#ffffff" />
            옵션 품목 마스터
          </button>

          <button
            type="button"
            onClick={() => setShowQuickSiteModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '34px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid var(--primary)',
              backgroundColor: 'var(--primary)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={14} />
            신규 현장 등록
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '34px',
              padding: '0 12px',
              borderRadius: '6px',
              border: '1px solid #10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#059669',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={13} />
            엑셀 내보내기
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* 헌장 3.5 Gutenberg Z-패턴: ③중앙 본문 Body / Inspection */}
      {/* ──────────────────────────────────────────────────────── */}

      {/* ── [탭 1: 현장별 옵션 그룹 관리 마스터-디테일 스튜디오] ── */}
      {activeTab === 'SITE_OPTIONS' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '14px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
          {/* 좌측: 옵션 그룹 목록 패널 */}
          <div 
            data-mid="panel-site-scope"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                옵션 그룹 목록 ({filteredSites.length}개)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                클릭 시 옵션 설정
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredSites.length === 0 ? (
                <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
                  <span>등록된 옵션 그룹이 없습니다.</span>
                </div>
              ) : (
                filteredSites.map(site => {
                  const isSelected = site.id === selectedSiteId;
                  const paidCount = (site.paidOptions || '').split(',').map(s => s.trim()).filter(Boolean).length;
                  const hasProt = Boolean(site.protection && site.protection !== 'NONE');
                  const attachmentCount = (site.attachments || '').split(',').map(s => s.trim()).filter(Boolean).length;
                  const specCount = site.checkedSpecs
                    ? Object.entries(site.checkedSpecs).filter(([k, v]) => !k.startsWith('__') && Boolean(v)).length
                    : 0;
                  const linkedCount = siteCustomerStatsMap[site.id]?.linkedSiteCount || 0;

                  return (
                    <div
                      key={site.id}
                      onClick={() => setSelectedSiteId(site.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-app)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          fontSize: '13px',
                          fontWeight: 800,
                          color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          flex: 1
                        }}>
                          {site.name}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              handleOpenCopyMaster(site, site.id === selectedSiteId);
                            }}
                            style={{
                              padding: '2px 6px',
                              fontSize: '10.5px',
                              fontWeight: 700,
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Copy size={11} /> 복사
                          </button>
                          <ChevronRight size={14} color={isSelected ? 'var(--primary)' : 'var(--text-muted)'} />
                        </div>
                      </div>

                      {/* 옵션 요약 뱃지 행 */}
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span className={`badge ${paidCount > 0 ? 'badge-primary' : 'badge-secondary'}`} style={{ fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                          유상옵션 {paidCount}개
                        </span>

                        {hasProt && (
                          <span className="badge badge-success" style={{ fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                            {site.protection}
                          </span>
                        )}

                        {attachmentCount > 0 && (
                          <span className="badge" style={{ fontSize: '10.5px', whiteSpace: 'nowrap', backgroundColor: 'rgba(124, 58, 237, 0.12)', color: '#7c3aed', fontWeight: 700 }}>
                            부착물 {attachmentCount}개
                          </span>
                        )}

                        {specCount > 0 && (
                          <span className="badge badge-warning" style={{ fontSize: '10.5px', whiteSpace: 'nowrap' }}>
                            요구사양 {specCount}개
                          </span>
                        )}

                        {linkedCount > 0 && (
                          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            상속 {linkedCount}곳
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 우측: 선택된 옵션 그룹의 옵션 작업대 */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden'
          }}>
            {!activeSite ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                <span>좌측에서 옵션 그룹을 선택하거나 [신규 현장 등록]으로 자주 사용하는 옵션 구성을 만들어주세요.</span>
              </div>
            ) : (
              <>
                {/* 상단 옵션 그룹 정보 바 */}
                <div 
                  data-mid="panel-site-header"
                  style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  {(() => {
                    const activeStats = siteCustomerStatsMap[activeSite.id] || {
                      linkedSiteCount: 0,
                      linkedSiteLabels: [],
                      linkedCustomerNames: []
                    };

                    return (
                      <>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <Layers size={17} color="var(--primary)" />
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {activeSite.name}
                            </h3>
                            <span style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              color: activeStats.linkedSiteCount > 0 ? '#047857' : 'var(--text-muted)',
                              backgroundColor: activeStats.linkedSiteCount > 0 ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-app)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-color)',
                              whiteSpace: 'nowrap'
                            }}>
                              상속 고객현장 {activeStats.linkedSiteCount}곳
                            </span>
                          </div>

                          {activeStats.linkedSiteCount > 0 && (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              연결된 고객현장: {activeStats.linkedSiteLabels.slice(0, 5).join(', ')}{activeStats.linkedSiteLabels.length > 5 ? ` 외 ${activeStats.linkedSiteLabels.length - 5}곳` : ''}
                            </div>
                          )}
                        </div>
                        
                        {/* 복사, 명칭 수정 및 삭제 버튼 영역 */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            data-mid="btn-copy-site-master"
                            onClick={() => handleOpenCopyMaster(activeSite, true)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 700,
                              backgroundColor: 'rgba(37, 99, 235, 0.1)',
                              color: 'var(--primary)',
                              border: '1px solid rgba(37, 99, 235, 0.35)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Copy size={13} /> 옵션 그룹 복사
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditMaster(activeSite)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 700,
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Edit3 size={13} /> 그룹명 수정
                          </button>
                          <button
                            type="button"
                            data-mid="btn-delete-site"
                            onClick={() => handleDeleteSite(activeSite)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 700,
                              backgroundColor: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              border: '1px solid rgba(239, 68, 68, 0.35)',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <Trash2 size={13} /> 그룹 삭제
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* 중앙 옵션 카테고리별 리스트 */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  
                  {/* 1. 유상 옵션 섹션 */}
                  <div data-mid="table-paid-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={15} color="#2563eb" /> 1. 유상 옵션
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {paidDisabledOptions.map(item => {
                        const unitPrice = item.defaultPrice ?? item.appliedPrice ?? 0;
                        const isHovered = hoveredPaidOptionId === item.optionId;
                        return (
                          <div
                            key={item.optionId}
                            style={{ position: 'relative', display: 'inline-flex' }}
                            onMouseEnter={() => setHoveredPaidOptionId(item.optionId)}
                            onMouseLeave={() => setHoveredPaidOptionId(prev => (prev === item.optionId ? null : prev))}
                          >
                            {isHovered && (
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 'calc(100% + 6px)',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  backgroundColor: '#1e293b',
                                  color: '#ffffff',
                                  padding: '4px 9px',
                                  borderRadius: '5px',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  boxShadow: '0 4px 10px rgba(0,0,0,0.22)',
                                  zIndex: 50,
                                  pointerEvents: 'none',
                                }}
                              >
                                단가: ₩{unitPrice.toLocaleString()}
                              </div>
                            )}
                            <button
                              type="button"
                              title={`단가: ₩${unitPrice.toLocaleString()}`}
                              onClick={() => {
                                setHoveredPaidOptionId(null);
                                handleToggleOption(item.optionId);
                              }}
                              style={{
                                padding: '6px 12px',
                                fontSize: '12px',
                                borderRadius: '6px',
                                border: isHovered ? '1px solid #2563eb' : '1px solid var(--border-color)',
                                backgroundColor: isHovered ? '#eff6ff' : 'var(--bg-app)',
                                color: isHovered ? '#1d4ed8' : 'var(--text-primary)',
                                cursor: 'pointer',
                                fontWeight: isHovered ? 700 : 500,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s ease-out',
                              }}
                            >
                              + {item.name}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', minWidth: '650px', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                            <th style={{ padding: '8px 10px', width: '60px', textAlign: 'center', whiteSpace: 'nowrap' }}>적용 해제</th>
                            <th style={{ padding: '8px 10px', width: '200px', whiteSpace: 'nowrap' }}>옵션 품목명</th>
                            <th style={{ padding: '8px 10px', width: '90px', whiteSpace: 'nowrap' }}>기준단가</th>
                            <th style={{ padding: '8px 10px', width: '130px', whiteSpace: 'nowrap' }}>특약단가 (₩)</th>
                            <th style={{ padding: '8px 10px', width: '70px', textAlign: 'center', whiteSpace: 'nowrap' }}>필수</th>
                            <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>규격 메모</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paidEnabledOptions.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                추가된 유상 옵션이 없습니다. 상단 항목을 클릭하여 추가해주세요.
                              </td>
                            </tr>
                          ) : (
                            paidEnabledOptions.map(item => (
                              <tr 
                                key={item.id}
                                style={{
                                  borderBottom: '1px solid var(--border-color)',
                                  backgroundColor: 'rgba(37, 99, 235, 0.03)'
                                }}
                              >
                                <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleOption(item.optionId)}
                                    style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '4px', border: '1px solid #fca5a5', backgroundColor: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontWeight: 600 }}
                                  >
                                    제외
                                  </button>
                                </td>
                                <td style={{ padding: '8px 10px', fontWeight: 700, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                                  {item.name}
                                </td>
                                <td style={{ padding: '8px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                  ₩{(item.defaultPrice || 0).toLocaleString()}
                                </td>
                                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                  <input
                                    type="number"
                                    value={item.appliedPrice}
                                    onChange={e => handlePriceChange(item.optionId, Number(e.target.value))}
                                    style={{
                                      width: '100px',
                                      height: '28px',
                                      padding: '0 8px',
                                      borderRadius: '4px',
                                      border: '1px solid var(--border-color)',
                                      backgroundColor: 'var(--bg-app)',
                                      color: 'var(--text-primary)',
                                      fontSize: '11.5px'
                                    }}
                                  />
                                </td>
                                <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  <input
                                    type="checkbox"
                                    checked={item.isRequired}
                                    onChange={() => handleToggleRequired(item.optionId)}
                                    style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                                  />
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                  <input
                                    type="text"
                                    placeholder="규격 메모"
                                    value={item.note || ''}
                                    onChange={e => handleNoteChange(item.optionId, e.target.value)}
                                    style={{
                                      width: '100%',
                                      height: '28px',
                                      padding: '0 8px',
                                      borderRadius: '4px',
                                      border: '1px solid var(--border-color)',
                                      backgroundColor: 'var(--bg-app)',
                                      color: 'var(--text-primary)',
                                      fontSize: '11.5px'
                                    }}
                                  />
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 2. 무상 옵션 섹션 */}
                  <div data-mid="card-protection-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Shield size={15} color="#059669" /> 2. 무상 옵션
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {protectionOptions.map(item => (
                        <button
                          key={item.optionId}
                          type="button"
                          onClick={() => handleToggleProtection(item.optionId)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            border: item.isEnabled ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: item.isEnabled ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-app)',
                            color: item.isEnabled ? 'var(--primary)' : 'var(--text-primary)',
                            cursor: 'pointer',
                            fontWeight: item.isEnabled ? 700 : 500,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {item.isEnabled && <Check size={13} strokeWidth={3} />}
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 3. 부착물 섹션 */}
                  <div data-mid="card-attachment-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={15} color="#7c3aed" /> 3. 부착물
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {attachmentDisabledOptions.map(item => (
                        <button
                          key={item.optionId}
                          type="button"
                          onClick={() => handleToggleOption(item.optionId)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-app)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontWeight: 500,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          + {item.name}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {attachmentEnabledOptions.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
                          적용된 부착물이 없습니다. 상단 항목을 클릭하여 추가해주세요.
                        </div>
                      ) : (
                        attachmentEnabledOptions.map(item => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              padding: '6px 10px 6px 6px', borderRadius: '8px',
                              border: '1.5px solid #7c3aed',
                              backgroundColor: 'rgba(124, 58, 237, 0.08)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleOption(item.optionId)}
                              style={{ cursor: 'pointer', border: 'none', background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}
                            >
                              <X size={14} strokeWidth={3} />
                            </button>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#6d28d9' }}>
                              {item.name}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 4. 현장 요구 사양 섹션 */}
                  <div data-mid="card-spec-options" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckSquare size={15} color="#d97706" /> 4. 현장 요구 사양
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {specDisabledOptions.map(item => (
                        <button
                          key={item.optionId}
                          type="button"
                          onClick={() => handleToggleOption(item.optionId)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-app)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            fontWeight: 500,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          + {item.name}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {specEnabledOptions.length === 0 ? (
                        <div style={{ padding: '16px', textAlign: 'center', width: '100%', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: '6px', fontSize: '12px' }}>
                          적용된 요구 사양이 없습니다. 상단 항목을 클릭하여 추가해주세요.
                        </div>
                      ) : (
                        specEnabledOptions.map(item => (
                          <div
                            key={item.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '6px',
                              padding: '6px 10px 6px 6px', borderRadius: '8px',
                              border: '1.5px solid #d97706',
                              backgroundColor: 'rgba(217, 119, 6, 0.08)',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleOption(item.optionId)}
                              style={{ cursor: 'pointer', border: 'none', background: 'transparent', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px' }}
                            >
                              <X size={14} strokeWidth={3} />
                            </button>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#b45309' }}>
                              {item.name}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                </div>

                {/* ──────────────────────────────────────────────────────── */}
                {/* 헌장 3.5 Gutenberg Z-패턴: ④우하단 대차대조 합계 검증 바 */}
                {/* ──────────────────────────────────────────────────────── */}
                <div 
                  data-mid="summary-monthly-fee"
                  style={{
                    padding: '14px 20px',
                    borderTop: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-secondary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      유상옵션: <strong>{paidEnabledOptions.length}건</strong>
                    </span>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      무상옵션: <strong>{protectionEnabledDisplay}</strong>
                    </span>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      부착물: <strong>{attachmentEnabledOptions.length}건</strong>
                    </span>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      현장요구사양: <strong>{specEnabledOptions.length}건</strong>
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                      월 유상옵션 총액: ₩{monthlyPaidFeeTotal.toLocaleString()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    {(siteCustomerStatsMap[activeSite.id]?.linkedSiteCount || 0) > 0 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <input
                          type="checkbox"
                          checked={propagateToLinkedSites}
                          onChange={e => setPropagateToLinkedSites(e.target.checked)}
                          style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                        />
                        연결된 고객현장({siteCustomerStatsMap[activeSite.id]?.linkedSiteCount || 0}곳)에 옵션 일괄 반영
                      </label>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenCopyMaster(activeSite, true)}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: '1px solid var(--primary)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--primary)',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Copy size={14} />
                      다른 이름으로 복사 등록
                    </button>

                    <button data-hs-trigger="Save"
                      type="button"
                      data-mid="btn-save-site-options"
                      disabled={isSaving}
                      onClick={handleSaveSiteOptions}
                      style={{
                        padding: '8px 24px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'var(--primary)',
                        color: '#ffffff',
                        fontSize: '13px',
                        fontWeight: 800,
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        whiteSpace: 'nowrap',
                        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                      }}
                    >
                      <CheckCircle2 size={15} />
                      {isSaving ? '저장 중...' : '옵션 그룹 저장'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── [탭 2: 옵션 품목 마스터 관리] ── */}
      {activeTab === 'MASTER_OPTIONS' && (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', flexShrink: 0 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                옵션 품목 마스터
              </h3>
            </div>

            <button data-hs-trigger="Register"
              type="button"
              onClick={() => {
                setEditingMasterOption({
                  category: 'PAID',
                  name: '',
                  defaultPrice: 50000,
                  unit: '월',
                  description: '',
                  isActive: true,
                  sortOrder: (standardOptions?.length || 0) + 1
                });
                setShowMasterModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={14} />
              신규 옵션 품목 등록
            </button>
          </div>

          {/* 마스터 그리드 */}
          <div className="table-container" style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0, border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table style={{ width: '100%', minWidth: '750px', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--bg-secondary)' }}>
                <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <SortableTh label="분류" sortKey="category" currentSort={masterSortConfig} onSort={handleMasterSort} style={{ padding: '9px 12px', width: '80px' }} />
                  <SortableTh label="옵션 품목명" sortKey="name" currentSort={masterSortConfig} onSort={handleMasterSort} style={{ padding: '9px 12px', width: '220px' }} />
                  <SortableTh label="기준단가" sortKey="defaultPrice" currentSort={masterSortConfig} onSort={handleMasterSort} style={{ padding: '9px 12px', width: '110px' }} align="right" />
                  <SortableTh label="단위" sortKey="unit" currentSort={masterSortConfig} onSort={handleMasterSort} style={{ padding: '9px 12px', width: '70px' }} align="center" />
                  <SortableTh label="설명" sortKey="description" currentSort={masterSortConfig} onSort={handleMasterSort} style={{ padding: '9px 12px' }} />
                  <SortableTh label="상태" sortKey="isActive" currentSort={masterSortConfig} onSort={handleMasterSort} style={{ padding: '9px 12px', width: '80px', textAlign: 'center' }} align="center" />
                  <th style={{ padding: '9px 12px', width: '80px', textAlign: 'center', whiteSpace: 'nowrap' }}>수정</th>
                </tr>
              </thead>
              <tbody>
                {sortedStandardOptions.map(opt => {
                  const isPaid = opt.category === 'PAID';
                  const isAttachment = opt.category === 'ATTACHMENT';
                  const isProtection = opt.category === 'PROTECTION';
                  return (
                    <tr key={opt.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: isPaid
                            ? 'rgba(37, 99, 235, 0.12)'
                            : isProtection
                            ? 'rgba(5, 150, 105, 0.12)'
                            : isAttachment
                            ? 'rgba(124, 58, 237, 0.12)'
                            : 'rgba(217, 119, 6, 0.12)',
                          color: isPaid
                            ? '#1d4ed8'
                            : isProtection
                            ? '#059669'
                            : isAttachment
                            ? '#7c3aed'
                            : '#b45309'
                        }}>
                          {isPaid ? '유상옵션' : isProtection ? '무상옵션' : isAttachment ? '부착물' : '요구사양'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {opt.name}
                      </td>
                      <td style={{ padding: '9px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        ₩{(opt.defaultPrice || 0).toLocaleString()}
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {opt.unit || '월'}
                      </td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-secondary)' }}>
                        {opt.description || '-'}
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: opt.isActive ? '#10b981' : 'var(--text-muted)'
                        }}>
                          {opt.isActive ? '사용중' : '중단'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMasterOption({ ...opt });
                            setShowMasterModal(true);
                          }}
                          style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          수정
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 🏷️ 옵션 품목 마스터 등록/수정 모달 ── */}
      {showMasterModal && editingMasterOption && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '16px'
        }}>
          <form 
            onSubmit={handleSaveMasterOption}
            style={{
              backgroundColor: 'var(--bg-card)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              width: '100%',
              maxWidth: '480px',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
            }}
          >
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {editingMasterOption.id ? '옵션 품목 마스터 수정' : '신규 옵션 품목 등록'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
                옵션 분류 *
              </label>
              <select
                value={editingMasterOption.category || 'PAID'}
                onChange={e => setEditingMasterOption({ ...editingMasterOption, category: e.target.value as any })}
                style={{
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px'
                }}
              >
                <option value="PAID">유상 옵션</option>
                <option value="PROTECTION">무상 옵션</option>
                <option value="ATTACHMENT">부착물</option>
                <option value="SPEC">요구 사양</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
                옵션 품목명 *
              </label>
              <input
                type="text"
                required
                placeholder="예: 상·하부 모서리 8개소 보양 (쉼표 대신 · 사용)"
                value={editingMasterOption.name || ''}
                onChange={e => setEditingMasterOption({ ...editingMasterOption, name: e.target.value })}
                style={{
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: (editingMasterOption.name || '').includes(',') ? '1.5px solid #ef4444' : '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px'
                }}
              />
              {(editingMasterOption.name || '').includes(',') && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '2px', padding: '5px 8px', borderRadius: '6px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444' }}>
                    품목명에 쉼표(,)는 사용할 수 없습니다. 가운뎃점(·)을 사용해 주세요.
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingMasterOption({ ...editingMasterOption, name: (editingMasterOption.name || '').replace(/\s*,\s*/g, '·') })}
                    style={{ padding: '2px 8px', borderRadius: '4px', border: '1px solid #ef4444', backgroundColor: '#ef4444', color: '#ffffff', fontSize: '10.5px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    · 로 변환
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  기준 단가 (₩)
                </label>
                <input
                  type="number"
                  value={editingMasterOption.defaultPrice || 0}
                  onChange={e => setEditingMasterOption({ ...editingMasterOption, defaultPrice: Number(e.target.value) })}
                  style={{
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                    textAlign: 'right'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
                  단위
                </label>
                <select
                  value={editingMasterOption.unit || '월'}
                  onChange={e => setEditingMasterOption({ ...editingMasterOption, unit: e.target.value })}
                  style={{
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px'
                  }}
                >
                  <option value="월">월</option>
                  <option value="건">건</option>
                  <option value="대">대</option>
                  <option value="수량">수량</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)' }}>
                품목 설명
              </label>
              <input
                type="text"
                placeholder="규격 및 안전 점검 내용"
                value={editingMasterOption.description || ''}
                onChange={e => setEditingMasterOption({ ...editingMasterOption, description: e.target.value })}
                style={{
                  height: '34px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="optActive"
                checked={editingMasterOption.isActive !== false}
                onChange={e => setEditingMasterOption({ ...editingMasterOption, isActive: e.target.checked })}
                style={{ width: '16px', height: '16px' }}
              />
              <label htmlFor="optActive" style={{ fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
                전사 옵션 상속 풀에 사용 활성화
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <div>
                {editingMasterOption.id && (
                  <button
                    type="button"
                    data-hs-trigger="Delete"
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: '옵션 품목 마스터 삭제 확인',
                        message: '이 옵션 품목 마스터를 삭제하시겠습니까?',
                        onConfirm: async () => {
                          try {
                            await deleteStandardOption(editingMasterOption.id!);
                            setShowMasterModal(false);
                            setEditingMasterOption(null);
                          } catch (err: any) {
                            showErrorModal(`삭제 실패: ${err.message}`);
                          }
                        }
                      });
                    }}
                    style={{
                      padding: '7px 14px', borderRadius: '6px', border: '1px solid #ef4444', 
                      color: '#ef4444', backgroundColor: 'transparent', fontSize: '12.5px', cursor: 'pointer'
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowMasterModal(false);
                    setEditingMasterOption(null);
                  }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-secondary)',
                    fontSize: '12.5px',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                <button data-hs-trigger="Save"
                  type="submit"
                  style={{
                    padding: '7px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ── 전사 표준 확인 모달 ── */}
      {confirmModal.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)', borderRadius: '10px',
            padding: '20px', maxWidth: '460px', width: '90%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)',
            display: 'flex', flexDirection: 'column', gap: '14px'
          }}>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
              {confirmModal.title}
            </h4>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
              {confirmModal.message}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
              {!confirmModal.hideCancel && (
                <button
                  type="button"
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    padding: '7px 14px', borderRadius: '6px',
                    border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  취소
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const action = confirmModal.onConfirm;
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  action();
                }}
                style={{
                  padding: '7px 16px', borderRadius: '6px',
                  border: 'none',
                  backgroundColor: confirmModal.isDanger ? '#dc2626' : 'var(--primary)',
                  color: '#ffffff', fontSize: '13px', fontWeight: 700, cursor: 'pointer'
                }}
              >
                {confirmModal.confirmText || '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
