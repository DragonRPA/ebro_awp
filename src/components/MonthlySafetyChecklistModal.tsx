// src/components/MonthlySafetyChecklistModal.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  X, FileText, FolderOpen, CheckCircle2, AlertCircle,
  RefreshCw, FileCheck, Mail, Send, Plus, Users, Check, Calendar, ShieldCheck
} from 'lucide-react';
import { emailService, extractValidEmails } from '../services/email';
import { db } from '../services/db';
import {
  fetchWithAgentFallback,
  launchLocalAgentFromBrowser,
  isAgentOnlineGlobal,
  subscribeAgentStatus,
  setGlobalAgentStatus
} from '../services/agentService';
import { getCanonicalModelKey } from '../utils/modelUtils';
import { PRESET_PRODUCT_SPECS } from '../data/presetProductSpecs';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
}

interface RecipientItem {
  id: string;
  email: string;
  name?: string;
  roleLabel?: string;
  source: 'SAFETY' | 'SITE' | 'MANUAL';
}

export const MonthlySafetyChecklistModal: React.FC<Props> = ({
  isOpen,
  onClose,
  contractId
}) => {
  const {
    contracts,
    customers,
    contacts,
    sites,
    assets,
    contractAssets,
    products,
    users,
    currentUser,
    currentTenant,
    showErrorModal,
    hasPermission,
    contractHistory,
    refreshAllData
  } = useApp();

  const canSendChecklist =
    hasPermission('contract', 'view') ||
    hasPermission('contract', 'save') ||
    hasPermission('agent_badge', 'view');

  const [isAgentOnline, setIsAgentOnline] = useState<boolean | null>(() => isAgentOnlineGlobal());
  const [agentChecking, setAgentChecking] = useState<boolean>(() => !isAgentOnlineGlobal());

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = subscribeAgentStatus(online => {
      if (isMounted && online) {
        setIsAgentOnline(true);
        setAgentChecking(false);
      }
    });

    const checkAgent = async () => {
      try {
        const res = await fetchWithAgentFallback('/health', {
          method: 'GET',
          signal: AbortSignal.timeout(2500),
          cache: 'no-store'
        });
        if (isMounted) {
          setIsAgentOnline(res.ok);
          setAgentChecking(false);
          setGlobalAgentStatus(res.ok);
        }
      } catch {
        if (isMounted) {
          if (!isAgentOnlineGlobal()) {
            setIsAgentOnline(false);
          }
          setAgentChecking(false);
        }
      }
    };

    if (isOpen) {
      if (!isAgentOnlineGlobal()) {
        setAgentChecking(true);
      }
      checkAgent();
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [isOpen]);

  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentMonthLocal = todayLocal.slice(0, 7);

  const [targetMonth, setTargetMonth] = useState<string>(currentMonthLocal);
  const [inspectionDate, setInspectionDate] = useState<string>(todayLocal);
  const [inspectorName, setInspectorName] = useState<string>('김관주');

  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [manualInputName, setManualInputName] = useState<string>('');
  const [manualInputEmail, setManualInputEmail] = useState<string>('');
  const [emailSubject, setEmailSubject] = useState<string>('');
  const [emailBody, setEmailBody] = useState<string>('');
  const [isEmailContentOpen, setIsEmailContentOpen] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressText, setProgressText] = useState<string>('');
  const [generatedResult, setGeneratedResult] = useState<{
    filePath: string;
    xlsxFilePath?: string;
    fileName: string;
    xlsxFileName?: string;
    pageCount: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState<boolean>(false);

  const activeContract = useMemo(() => {
    return contracts.find(c => c.id === contractId) || null;
  }, [contracts, contractId]);

  const customer = useMemo(() => {
    if (!activeContract) return null;
    return customers.find(c => c.id === activeContract.customerId) || null;
  }, [customers, activeContract]);

  const site = useMemo(() => {
    if (!activeContract) return null;
    return (
      sites.find(s => s.id === activeContract.siteId) ||
      sites.find(
        s =>
          s.customerId === activeContract.customerId &&
          s.name &&
          s.name.trim() === ((activeContract as any).siteName || '').trim()
      ) ||
      null
    );
  }, [sites, activeContract]);

  // 고객현장(siteId) 기준 현재 사용 중인 자산 전체 목록 수집
  // (동일 고객현장의 진행중 계약에 속한 모든 미반납·미매각 자산 통합 수집)
  const siteActiveAssets = useMemo(() => {
    if (!activeContract) return [];
    const targetSiteId = site?.id || activeContract.siteId;
    const siteContractIds = new Set<string>(
      contracts
        .filter(
          c =>
            c.status !== 'COMPLETED' &&
            (c.contractType || 'RENTAL') === 'RENTAL' &&
            (targetSiteId ? c.siteId === targetSiteId : c.id === activeContract.id)
        )
        .map(c => c.id)
    );
    siteContractIds.add(activeContract.id);

    const activeCas = contractAssets.filter(
      ca =>
        siteContractIds.has(ca.contractId) &&
        ca.status !== 'RETURNED' &&
        ca.status !== 'SOLD'
    );

    const allProducts = products.length > 0 ? products : db.products;

    const list = activeCas.map(ca => {
      const a = assets.find(ast => ast.id === ca.assetId) || db.assets.find(ast => ast.id === ca.assetId);
      const rawModel = a?.modelName || ca.expectedModel || '-';
      const upperModel = rawModel.trim().toUpperCase();
      const canonicalModel = getCanonicalModelKey(rawModel);

      const prod =
        allProducts.find(p => p.modelName === rawModel) ||
        allProducts.find(p => (p.modelName || '').trim().toUpperCase() === upperModel) ||
        allProducts.find(p => p.shortName && p.shortName.trim().toUpperCase() === upperModel) ||
        allProducts.find(p => getCanonicalModelKey(p.modelName) === canonicalModel);

      const preset =
        PRESET_PRODUCT_SPECS[prod?.modelName || ''] ||
        PRESET_PRODUCT_SPECS[upperModel] ||
        Object.values(PRESET_PRODUCT_SPECS).find(ps => getCanonicalModelKey(ps.modelName) === canonicalModel);

      const modelName = prod?.modelName || preset?.modelName || rawModel;

      return {
        caId: ca.id,
        contractId: ca.contractId,
        assetId: ca.assetId || '',
        assetNo: a?.assetNo || '미할당',
        modelName,
        serialNo: a?.serialNo || '',
        startDate: ca.firstStartDate || ca.startDate || '-'
      };
    });

    return list.sort((a, b) => {
      const mCmp = String(a.modelName || '').localeCompare(String(b.modelName || ''), 'ko');
      if (mCmp !== 0) return mCmp;
      return String(a.assetNo || '').localeCompare(String(b.assetNo || ''), 'ko');
    });
  }, [activeContract, site?.id, contracts, contractAssets, assets, products]);

  // 해당 고객현장의 당월(targetMonth) 발송 이력 조회 (매월 1회 발송 관리)
  const monthlySentHistory = useMemo(() => {
    if (!activeContract) return [];
    const targetSiteId = site?.id || activeContract.siteId;
    const siteContractIds = new Set<string>(
      contracts
        .filter(c => (targetSiteId ? c.siteId === targetSiteId : c.id === activeContract.id))
        .map(c => c.id)
    );
    siteContractIds.add(activeContract.id);

    return (contractHistory || [])
      .filter(
        h =>
          siteContractIds.has(h.contractId) &&
          (h.changeType === 'MONTHLY_CHECKLIST_SENT' ||
            (h.changeType === 'DOCUMENT_SENT' && (h.description || '').includes('월간 안전점검 체크리스트')))
      )
      .sort((a, b) => String(b.createdAt || b.changeDate).localeCompare(String(a.createdAt || a.changeDate)));
  }, [activeContract, site?.id, contracts, contractHistory]);

  const sentRecordForTargetMonth = useMemo(() => {
    return monthlySentHistory.find(
      h =>
        (h.description || '').includes(`[${targetMonth}]`) ||
        (h.changeDate && h.changeDate.startsWith(targetMonth))
    );
  }, [monthlySentHistory, targetMonth]);

  // 고객현장 담당자 풀 수집 (안전담당자 최우선 -> 현장담당자/마감담당자 보조)
  const siteContactDirectory = useMemo(() => {
    const emailContacts: {
      id: string;
      name: string;
      position: string;
      email: string;
      phone?: string;
      contactType: 'SAFETY' | 'EQUIPMENT' | 'CLOSING' | 'OTHER';
      roleLabel: string;
    }[] = [];
    const noEmailContacts: {
      id: string;
      name: string;
      position: string;
      phone: string;
      contactType: 'SAFETY' | 'EQUIPMENT' | 'CLOSING' | 'OTHER';
      roleLabel: string;
    }[] = [];

    if (!site) return { emailContacts, noEmailContacts };

    const normPersonName = (raw?: string | null) =>
      String(raw || '')
        .replace(/\s+/g, '')
        .replace(/(과장님|차장님|부장님|대리님|소장님|팀장님|대표님|기사님|선임님|책임님|주임님|사원님|님|과장|차장|부장|대리|소장|팀장|대표|이사|선임|책임|주임|사원|공무과장|공무차장|공무대리|공무|안전관리자|안전담당자|안전담당|현장소장|현장담당자|현장담당|마감담당|장비담당|담당자|담당)$/g, '')
        .trim();

    const normPhoneDigits = (raw?: string | null) => String(raw || '').replace(/[^0-9]/g, '');

    const custContacts = (contacts || []).filter(
      c => c.customerId === site.customerId && c.isActive !== false
    );

    const resolveEmailFromCustomerContacts = (name?: string, phone?: string, explicitEmail?: string): string => {
      if (explicitEmail && explicitEmail.includes('@')) return explicitEmail;
      const pName = normPersonName(name);
      const pPhone = normPhoneDigits(phone);
      if (!pName && !pPhone) return '';

      const matched = custContacts.filter(cc => {
        const ccEmail = String(cc.email || '').trim();
        if (!ccEmail.includes('@')) return false;
        const ccPhone = normPhoneDigits(cc.contact);
        const ccName = normPersonName(cc.name);
        if (pPhone && pPhone.length >= 8 && ccPhone === pPhone) return true;
        if (pName && pName.length >= 2 && ccName === pName) return true;
        return false;
      });

      if (matched.length > 0) {
        return matched.map(m => m.email).filter(Boolean).join(', ');
      }
      return '';
    };

    const pushCandidate = (
      baseId: string,
      name: string,
      position: string,
      phone: string | undefined,
      rawEmail: string | undefined,
      contactType: 'SAFETY' | 'EQUIPMENT' | 'CLOSING' | 'OTHER',
      typeLabel: string
    ) => {
      const cleanName = (name || '').trim();
      const cleanPhone = (phone || '').trim();
      const resolvedRawEmail = resolveEmailFromCustomerContacts(cleanName, cleanPhone, rawEmail);
      const cleanPos = (position || '').trim();
      const roleLabel = !cleanPos || cleanPos === typeLabel || cleanPos === '담당자' ? typeLabel : `${typeLabel} · ${cleanPos}`;

      if (resolvedRawEmail) {
        const parts = extractValidEmails(resolvedRawEmail);
        let pushedAny = false;
        parts.forEach((em, idx) => {
          pushedAny = true;
          emailContacts.push({
            id: parts.length > 1 ? `${baseId}-${idx}` : baseId,
            name: cleanName || typeLabel,
            position: cleanPos || typeLabel,
            email: em,
            phone: cleanPhone,
            contactType,
            roleLabel
          });
        });
        if (pushedAny) return;
      }

      if (cleanName && cleanName !== '-' && cleanName !== site.name) {
        noEmailContacts.push({
          id: `${baseId}-noemail`,
          name: cleanName,
          position: cleanPos || typeLabel,
          phone: cleanPhone,
          contactType,
          roleLabel
        });
      }
    };

    // 1순위: 안전담당자 먼저 수집
    if (site.contacts && site.contacts.length > 0) {
      site.contacts
        .filter(sc => sc.isActive !== false && sc.contactType === 'SAFETY')
        .forEach((sc, idx) => {
          pushCandidate(
            `site-${site.id}-sf-${sc.id || idx}`,
            sc.name || site.safetyContactName || '안전담당',
            sc.position || '안전담당',
            sc.contact || site.safetyContactPhone,
            sc.email || site.safetyContactEmail,
            'SAFETY',
            '안전담당'
          );
        });
    }
    if ((site.safetyContactName && site.safetyContactName.trim()) || (site.safetyContactEmail && site.safetyContactEmail.trim())) {
      pushCandidate(
        `site-${site.id}-sf-flat`,
        site.safetyContactName || '안전담당',
        '안전담당',
        site.safetyContactPhone,
        site.safetyContactEmail,
        'SAFETY',
        '안전담당'
      );
    }

    // 2순위: 장비담당자 / 마감담당자 보조 수집
    if (site.contacts && site.contacts.length > 0) {
      site.contacts
        .filter(sc => sc.isActive !== false && sc.contactType !== 'SAFETY')
        .forEach((sc, idx) => {
          const cType = sc.contactType === 'EQUIPMENT' ? 'EQUIPMENT' : sc.contactType === 'CLOSING' ? 'CLOSING' : 'OTHER';
          const typeLabel = cType === 'EQUIPMENT' ? '장비담당' : cType === 'CLOSING' ? '마감담당' : '현장담당';
          pushCandidate(
            `site-${site.id}-other-${sc.id || idx}`,
            sc.name || site.contactName || '',
            sc.position || typeLabel,
            sc.contact,
            sc.email,
            cType,
            typeLabel
          );
        });
    }
    if ((site.contactName && site.contactName.trim()) || (site.email && site.email.trim())) {
      pushCandidate(
        `site-${site.id}-eq-flat`,
        site.contactName || '장비담당',
        '장비담당',
        site.contact,
        site.email,
        'EQUIPMENT',
        '장비담당'
      );
    }
    if ((site.billingContactName && site.billingContactName.trim()) || (site.billingContactEmail && site.billingContactEmail.trim())) {
      pushCandidate(
        `site-${site.id}-cl-flat`,
        site.billingContactName || '마감담당',
        '마감담당',
        site.billingContactPhone,
        site.billingContactEmail,
        'CLOSING',
        '마감담당'
      );
    }

    const uniqueEmailMap = new Map<string, typeof emailContacts[0]>();
    emailContacts.forEach(item => {
      if (item.email && !uniqueEmailMap.has(item.email.toLowerCase())) {
        uniqueEmailMap.set(item.email.toLowerCase(), item);
      }
    });
    const dedupedEmailContacts = Array.from(uniqueEmailMap.values());

    const namesWithEmail = new Set(dedupedEmailContacts.map(c => normPersonName(c.name)).filter(Boolean));
    const uniqueNoEmailMap = new Map<string, typeof noEmailContacts[0]>();
    noEmailContacts.forEach(item => {
      const key = normPersonName(item.name) || item.name;
      if (key && !namesWithEmail.has(key) && !uniqueNoEmailMap.has(key)) {
        uniqueNoEmailMap.set(key, item);
      }
    });

    return {
      emailContacts: dedupedEmailContacts,
      noEmailContacts: Array.from(uniqueNoEmailMap.values())
    };
  }, [site, contacts]);

  const availableContacts = siteContactDirectory.emailContacts;
  const missingEmailContacts = siteContactDirectory.noEmailContacts;

  // 모달 오픈 시 최초 1회만 수신인 초기 세팅 (사용자가 전체 해제했을 때 다시 자동 선택되는 현상 방지)
  const initializedRecipientKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      initializedRecipientKeyRef.current = null;
      return;
    }
    if (!activeContract) return;

    const currentKey = `${contractId || activeContract.id}::${site?.id || 'default'}`;
    if (initializedRecipientKeyRef.current === currentKey) {
      return;
    }
    initializedRecipientKeyRef.current = currentKey;

    const safetyList = availableContacts.filter(c => c.contactType === 'SAFETY');
    const defaultTargetList = safetyList.length > 0 ? safetyList : availableContacts;

    setRecipients(
      defaultTargetList.map((c, idx) => ({
        id: `recip-safety-${site?.id || 'default'}-${idx}`,
        email: c.email,
        name: c.name,
        roleLabel: c.roleLabel,
        source: c.contactType === 'SAFETY' ? 'SAFETY' : 'SITE'
      }))
    );

    setGeneratedResult(null);
    setErrorMessage(null);
    setEmailSentSuccess(false);
  }, [isOpen, contractId, activeContract, site?.id, availableContacts]);

  // 점검 조건 변경 시 조립 결과 초기화
  useEffect(() => {
    setGeneratedResult(null);
    setEmailSentSuccess(false);
    setErrorMessage(null);
  }, [targetMonth, inspectionDate, inspectorName]);

  // 이메일 제목 및 본문 자동 구성
  useEffect(() => {
    if (!isOpen || !activeContract) return;
    const custName = customer?.name || '고객사';
    const siteName = site?.name || '현장';
    const tenantCorp = currentTenant?.corporateName || currentTenant?.tradeName || currentTenant?.displayName || '(주)기연리프트';
    const tenantTel = currentTenant?.tel || '031-334-5295';
    const salesUser = (activeContract?.salespersonId ? users?.find(u => u.id === activeContract.salespersonId) : null) || currentUser;
    const salesDuty = salesUser?.duty || salesUser?.position || '';
    const salesRepName = salesUser?.name ? (salesDuty && salesDuty !== '개발자' ? `${salesUser.name} ${salesDuty}` : salesUser.name) : ((activeContract as any)?.salespersonName || currentTenant?.representativeName || '');
    const salesRepPhone = salesUser?.phone || (salesUser as any)?.mobile || currentTenant?.salesPhone || tenantTel;
    const contactFooterLine = salesRepName && salesRepPhone ? `연락처: ${salesRepName} ${salesRepPhone}` : `전화: ${salesRepPhone || tenantTel}`;

    const [yr, mo] = targetMonth.split('-');
    const monthLabel = yr && mo ? `${yr}년 ${Number(mo)}월` : targetMonth;

    const assetSummaryLines = siteActiveAssets
      .map((a, idx) => `  ${idx + 1}. 모델명: ${a.modelName} / 장비번호: ${a.assetNo}`)
      .join('\n');

    setEmailSubject(`[${tenantCorp}] ${custName} (${siteName}) ${monthLabel} 고소작업대 월간 안전점검 체크리스트 송부의 건 (총 ${siteActiveAssets.length}대)`);
    setEmailBody(
`안녕하십니까, ${custName} ${siteName} 안전담당자님.
${tenantCorp} 입니다.

귀 현장에서 현재 운용 중인 고소작업대(총 ${siteActiveAssets.length}대)에 대한 ${monthLabel} 정기 월간 안전점검 체크리스트를 첨부하여 송부드립니다.

■ 점검 개요
• 사용업체: ${custName}
• 현장명: ${siteName}
• 안전점검일시: ${inspectionDate}
• 점검부서 / 점검자: ${tenantCorp} / ${inspectorName}
• 점검 대상 장비 (총 ${siteActiveAssets.length}대):
${assetSummaryLines || '  - 대상 장비 없음'}

첨부된 월간 안전점검 체크리스트를 확인하신 후 현장 안전관리에 활용하여 주시기 바랍니다.
추가 문의사항이나 정비 요청 사항이 있으시면 언제든 연락 주십시오.

감사합니다.
${tenantCorp} 배상
${contactFooterLine}`
    );
  }, [isOpen, activeContract, customer?.name, site?.name, currentTenant, targetMonth, inspectionDate, inspectorName, siteActiveAssets]);

  // 수신인을 고객현장(CustomerSite)의 안전담당자(SAFETY)로 자동 저장하는 헬퍼
  const syncSafetyContactsToSite = (targetRecipients: RecipientItem[]) => {
    if (!site || targetRecipients.length === 0) return;
    const normName = (raw?: string | null) =>
      String(raw || '')
        .replace(/\s+/g, '')
        .replace(/(과장님|차장님|부장님|대리님|소장님|팀장님|대표님|기사님|선임님|책임님|주임님|사원님|님|과장|차장|부장|대리|소장|팀장|대표|이사|선임|책임|주임|사원|공무과장|공무차장|공무대리|공무|안전관리자|안전담당자|안전담당|현장소장|현장담당자|현장담당|마감담당|장비담당|담당자|담당)$/g, '')
        .trim();

    const updatedContacts = Array.isArray(site.contacts) ? site.contacts.map(c => ({ ...c })) : [];
    let siteChanged = false;
    let nextSafetyEmail = (site.safetyContactEmail || '').trim();
    let nextSafetyName = (site.safetyContactName || '').trim();

    for (const r of targetRecipients) {
      const rEmail = (r.email || '').trim();
      if (!rEmail || !rEmail.includes('@')) continue;
      const rCleanName = normName(r.name);
      const emailPrefix = rEmail.split('@')[0];
      const isMeaningfulName = Boolean(r.name && r.name.trim() && r.name.trim() !== emailPrefix);

      // 1) 이름 일치 담당자 탐색
      let matchedIdx = -1;
      if (rCleanName) {
        matchedIdx = updatedContacts.findIndex(c => c.isActive !== false && normName(c.name) === rCleanName);
      }
      // 2) 안전담당자 중 이메일 미등록 슬롯 탐색
      if (matchedIdx === -1) {
        matchedIdx = updatedContacts.findIndex(c => c.isActive !== false && c.contactType === 'SAFETY' && !(c.email || '').trim());
      }

      if (matchedIdx >= 0) {
        const targetContact = updatedContacts[matchedIdx];
        if (!(targetContact.email || '').trim()) {
          updatedContacts[matchedIdx] = {
            ...targetContact,
            email: rEmail,
            name: targetContact.name || (isMeaningfulName ? r.name!.trim() : targetContact.name)
          };
          siteChanged = true;
        }
      } else {
        const alreadyHasEmail = updatedContacts.some(c => (c.email || '').toLowerCase().includes(rEmail.toLowerCase()));
        if (!alreadyHasEmail) {
          updatedContacts.push({
            id: `SC-SF-${site.id}-${Date.now()}`,
            contactType: 'SAFETY',
            name: isMeaningfulName ? r.name!.trim() : (nextSafetyName || '안전담당자'),
            position: '안전관리자',
            contact: (site.safetyContactPhone || '').trim(),
            email: rEmail,
            isPrimary: updatedContacts.length === 0,
            isActive: true,
            memo: ''
          });
          siteChanged = true;
        }
      }

      if (!nextSafetyEmail) {
        nextSafetyEmail = rEmail;
        siteChanged = true;
      }
      if (!nextSafetyName && isMeaningfulName) {
        nextSafetyName = r.name!.trim();
        siteChanged = true;
      }
    }

    if (siteChanged) {
      const sfPrimary = updatedContacts.find(c => c.contactType === 'SAFETY' && c.isActive !== false);
      const siteUpdatePayload: Record<string, any> = {
        safetyContactEmail: sfPrimary?.email || nextSafetyEmail || site.safetyContactEmail || null,
        safetyContactName: sfPrimary?.name || nextSafetyName || site.safetyContactName || null,
        contacts: updatedContacts,
        updatedAt: new Date().toISOString()
      };
      if (!site.email && siteUpdatePayload.safetyContactEmail) {
        siteUpdatePayload.email = siteUpdatePayload.safetyContactEmail;
      }
      db.updateRow<any>('sites', site.id, siteUpdatePayload);
      db.awaitPendingWrites().then(() => refreshAllData()).catch(console.error);
    }
  };

  const handleRemoveRecipient = (id: string) => {
    setRecipients(prev => prev.filter(r => r.id !== id));
  };

  const handleAddManualRecipient = () => {
    const cleanEmail = manualInputEmail.trim();
    if (!cleanEmail) return;
    const parsedEmails = extractValidEmails(cleanEmail);
    if (parsedEmails.length === 0) {
      alert('올바른 이메일 주소 형식을 입력해 주세요.');
      return;
    }
    const existingLower = new Set(recipients.map(r => r.email.toLowerCase()));
    const newEmails = parsedEmails.filter(e => !existingLower.has(e.toLowerCase()));
    if (newEmails.length === 0) {
      alert('이미 추가된 이메일 주소입니다.');
      return;
    }

    const newItems: RecipientItem[] = newEmails.map((em, idx) => ({
      id: `recip-manual-${Date.now()}-${idx}`,
      email: em,
      name: manualInputName.trim() || (site?.safetyContactName || '').trim() || em.split('@')[0],
      roleLabel: '안전담당',
      source: 'MANUAL'
    }));

    setRecipients(prev => [...prev, ...newItems]);
    setManualInputEmail('');
    setManualInputName('');

    syncSafetyContactsToSite(newItems);
  };

  const handleToggleContactRecipient = (contactItem: typeof availableContacts[0]) => {
    const exists = recipients.some(r => r.email.toLowerCase() === contactItem.email.toLowerCase());
    if (exists) {
      setRecipients(prev => prev.filter(r => r.email.toLowerCase() !== contactItem.email.toLowerCase()));
    } else {
      setRecipients(prev => [
        ...prev,
        {
          id: `recip-quick-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          email: contactItem.email,
          name: contactItem.name,
          roleLabel: contactItem.roleLabel,
          source: contactItem.contactType === 'SAFETY' ? 'SAFETY' : 'SITE'
        }
      ]);
    }
  };

  const buildChecklistDocument = async (): Promise<{
    filePath: string;
    xlsxFilePath?: string;
    fileName: string;
    xlsxFileName?: string;
    pageCount: number;
  }> => {
    if (generatedResult?.filePath) {
      return generatedResult;
    }
    if (siteActiveAssets.length === 0) {
      throw new Error('현재 현장에서 사용 중인 장비가 없습니다.');
    }

    setIsGenerating(true);
    setProgressPercent(15);
    setProgressText('월간 안전점검 체크리스트 엑셀 양식 조립 시작...');
    setErrorMessage(null);

    const custName = customer?.name || '고객사';
    const siteName = site?.name || '현장';
    const tenantCorp = currentTenant?.corporateName || currentTenant?.tradeName || currentTenant?.displayName || '(주)기연리프트';

    try {
      const payload = {
        customerName: custName,
        siteName,
        tenantName: tenantCorp,
        corporateName: tenantCorp,
        targetMonth,
        inspectionDate: inspectionDate || todayLocal,
        inspectorName: inspectorName.trim() || '김관주',
        assets: siteActiveAssets.map(a => ({
          assetNo: a.assetNo,
          modelName: a.modelName,
          inspectionDate: inspectionDate || todayLocal,
          inspectorName: inspectorName.trim() || '김관주'
        })),
        asyncQueue: true
      };

      setProgressText('로컬 에이전트 엑셀 엔진에서 자산별 시트 생성 및 PDF 변환 중...');
      setProgressPercent(40);

      const agentResp = await fetchWithAgentFallback('/api/generate-monthly-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        requireAgent: true,
        actionName: '월간 안전점검 체크리스트 생성'
      });

      if (!agentResp.ok) {
        const errJson = await agentResp.json().catch(() => null);
        throw new Error(errJson?.error ? `에이전트 오류: ${errJson.error}` : `에이전트 응답 오류: HTTP ${agentResp.status}`);
      }

      let agentRes = await agentResp.json();

      if (agentRes.queued && agentRes.jobId) {
        const jobId = agentRes.jobId;
        setProgressText(`에이전트 큐(${jobId})에서 자산 ${siteActiveAssets.length}대 체크리스트 생성 중...`);
        setProgressPercent(55);

        let nullJobCount = 0;
        while (true) {
          await new Promise(r => setTimeout(r, 1000));
          const pollResp = await fetchWithAgentFallback(`/api/job-queue?jobId=${encodeURIComponent(jobId)}`, {
            method: 'GET',
            skipPrecheck: true
          });
          if (pollResp.ok) {
            const pollData = await pollResp.json();
            const job = pollData.job;
            if (job) {
              nullJobCount = 0;
              if (job.status === 'COMPLETED' && job.result) {
                agentRes = job.result;
                break;
              } else if (job.status === 'FAILED') {
                throw new Error(job.error || '월간 안전점검 체크리스트 생성 중 오류가 발생했습니다.');
              } else {
                setProgressPercent(prev => Math.min(90, prev + 8));
              }
            } else {
              nullJobCount++;
              if (nullJobCount >= 10) {
                throw new Error(`에이전트 작업 큐에서 작업(${jobId})을 찾을 수 없습니다.`);
              }
            }
          }
        }
      }

      const returnedPath = agentRes.localPath || agentRes.filePath;
      if (!agentRes.success || !returnedPath) {
        throw new Error(agentRes.error || '월간 안전점검 체크리스트 생성에 실패했습니다.');
      }

      const finalRes = {
        filePath: returnedPath,
        xlsxFilePath: agentRes.xlsxLocalPath,
        fileName: agentRes.fileName || `월간안전점검체크리스트_${custName}_${siteName}_${targetMonth}.pdf`,
        xlsxFileName: agentRes.xlsxFileName,
        pageCount: agentRes.pageCount || siteActiveAssets.length
      };

      setProgressPercent(100);
      setProgressText(`총 ${finalRes.pageCount}대 자산 월간 안전점검 체크리스트 조립 완료`);
      setGeneratedResult(finalRes);
      return finalRes;
    } catch (err: any) {
      const msg = err.message || '월간 안전점검 체크리스트 생성 중 오류가 발생했습니다.';
      setErrorMessage(msg);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenLocalFile = async (preferXlsx = false) => {
    try {
      let doc = generatedResult;
      if (!doc || !doc.filePath) {
        doc = await buildChecklistDocument();
      }
      const targetPath = preferXlsx && doc.xlsxFilePath ? doc.xlsxFilePath : doc.filePath;
      const openResp = await fetchWithAgentFallback('/api/open-local-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: targetPath }),
        requireAgent: true,
        actionName: '로컬 체크리스트 파일 열기'
      });
      if (!openResp.ok) {
        const errJson = await openResp.json().catch(() => null);
        throw new Error(errJson?.error || `로컬 파일 열기 실패 (HTTP ${openResp.status})`);
      }
    } catch (err: any) {
      showErrorModal?.(`파일 열기 실패:\n${err.message || err}`);
    }
  };

  const handleSendChecklistEmail = async () => {
    if (!activeContract) return;
    if (recipients.length === 0) {
      alert('이메일을 수신할 현장 안전담당자를 1명 이상 지정해 주세요.');
      return;
    }
    if (siteActiveAssets.length === 0) {
      alert('현재 현장에서 사용 중인 장비가 없어 체크리스트를 발송할 수 없습니다.');
      return;
    }

    if (sentRecordForTargetMonth) {
      const proceed = window.confirm(
        `이미 [${targetMonth}] 귀속월의 월간 안전점검 체크리스트 발송 이력이 존재합니다.\n(${sentRecordForTargetMonth.description})\n\n다시 발송하시겠습니까?`
      );
      if (!proceed) return;
    }

    setIsSendingEmail(true);
    try {
      let doc = generatedResult;
      if (!doc || !doc.filePath) {
        doc = await buildChecklistDocument();
      }

      const allRecipientEmails = extractValidEmails(recipients.map(r => r.email));
      if (allRecipientEmails.length === 0) {
        throw new Error('유효한 수신자 이메일 주소가 없습니다.');
      }
      const primaryRecipient = allRecipientEmails[0];
      const ccRecipients = allRecipientEmails.slice(1).join(', ');

      if (!doc || !doc.filePath || doc.filePath.toLowerCase().endsWith('.xlsx')) {
        throw new Error('체크리스트 PDF 파일이 준비되지 않았습니다. PDF 생성 완료 후 발송해 주세요.');
      }

      // 고객 발송 이메일에는 엑셀(.xlsx) 원본을 제외하고 오직 PDF 파일만 첨부
      const attachments: { filename: string; localPath: string }[] = [
        { filename: doc.fileName.replace(/\.xlsx$/i, '.pdf'), localPath: doc.filePath }
      ];

      const tenantBrand = currentTenant?.displayName || currentTenant?.tradeName || '(주)기연리프트';
      const tenantCorp = currentTenant?.tradeName || currentTenant?.corporateName || tenantBrand;

      await emailService.sendEmail(
        primaryRecipient,
        emailSubject,
        emailBody,
        attachments,
        ccRecipients || undefined,
        tenantCorp
      );

      // 고객현장 안전담당자 이메일 역동기화
      syncSafetyContactsToSite(recipients);

      // 계약 변경 이력에 월간 안전점검 체크리스트 발송 로그 저장
      const historyId = db.generateNextId('contractHistory', db.contractHistory);
      const recipientSummary = recipients.map(r => `${r.name ? `${r.name}(${r.email})` : r.email}`).join(', ');
      const senderName = currentUser?.name || '안전담당';

      db.insertRow<any>('contractHistory', {
        id: historyId,
        contractId: activeContract.id,
        changeType: 'DOCUMENT_SENT',
        description: `[${targetMonth}] 월간 안전점검 체크리스트 이메일 발송 완료 (사용장비 ${siteActiveAssets.length}대 / 점검일: ${inspectionDate} / 점검자: ${inspectorName} / 수신: ${recipientSummary} / 발송자: ${senderName})`,
        changeDate: todayLocal,
        createdAt: new Date().toISOString()
      });

      await db.awaitPendingWrites();
      refreshAllData();

      setEmailSentSuccess(true);
      alert(
        `월간 안전점검 체크리스트 이메일이 발송되었습니다.\n\n• 대상 현장: ${customer?.name || ''} / ${site?.name || ''}\n• 대상 장비: 총 ${siteActiveAssets.length}대\n• 안전점검일 / 점검자: ${inspectionDate} / ${inspectorName}\n• 수신인: ${primaryRecipient}${ccRecipients ? `\n• 참조: ${ccRecipients}` : ''}`
      );
    } catch (err: any) {
      const errMsg = String(err?.message || err || '');
      if (!errMsg.includes('eBroAgent)가 실행되고 있지 않습니다') && !errMsg.includes('eBroAgent)와 통신할 수 없습니다')) {
        showErrorModal?.(`월간 안전점검 체크리스트 발송 실패:\n${errMsg}`);
      }
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (!isOpen || !activeContract) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1150,
        padding: '20px'
      }}
    >
      <div
        className="card"
        style={{
          backgroundColor: 'var(--bg-card)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '840px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--bg-app)',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} color="#d97706" />
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 'bold', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
              월간 안전점검 체크리스트 생성 및 이메일 발송
            </h3>
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: sentRecordForTargetMonth ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: sentRecordForTargetMonth ? 'var(--success)' : '#d97706',
                border: `1px solid ${sentRecordForTargetMonth ? 'rgba(34, 197, 94, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                whiteSpace: 'nowrap'
              }}
            >
              {sentRecordForTargetMonth ? `✓ ${targetMonth}월 발송완료 (${sentRecordForTargetMonth.changeDate})` : `${targetMonth}월 미발송 (매월 1회 정기 발송)`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: '18px 22px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 에이전트 오프라인 경고 */}
          {!agentChecking && isAgentOnline === false && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--danger)', fontWeight: 600 }}>
                <AlertCircle size={16} />
                <span>로컬 에이전트가 꺼져 있습니다. 엑셀 양식 생성 및 이메일 발송을 위해 에이전트를 실행해 주세요.</span>
              </div>
              <button
                type="button"
                onClick={() => launchLocalAgentFromBrowser()}
                className="btn-primary"
                style={{ padding: '5px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
              >
                에이전트 실행
              </button>
            </div>
          )}

          {/* 1. 현장 및 점검일 / 점검자 설정 */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', fontSize: '12.5px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>사용업체 (고객사)</span>
                <strong style={{ fontSize: '13.5px' }}>{customer?.name || '-'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>현장명</span>
                <strong style={{ fontSize: '13.5px' }}>{site?.name || '-'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block' }}>점검부서</span>
                <strong style={{ fontSize: '13.5px' }}>{currentTenant?.corporateName || currentTenant?.tradeName || '(주)기연리프트'}</strong>
              </div>
            </div>

            <div
              style={{
                paddingTop: '10px',
                borderTop: '1px dashed var(--border-color)',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  점검 귀속월 (매월 1회)
                </label>
                <input
                  type="month"
                  value={targetMonth}
                  onChange={e => {
                    const nextYm = e.target.value;
                    setTargetMonth(nextYm);
                    if (nextYm && !inspectionDate.startsWith(nextYm)) {
                      setInspectionDate(`${nextYm}-01`);
                    }
                  }}
                  disabled={isGenerating || isSendingEmail}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  안전점검일시 (수정 가능)
                </label>
                <input
                  type="date"
                  value={inspectionDate}
                  onChange={e => setInspectionDate(e.target.value)}
                  disabled={isGenerating || isSendingEmail}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  점검자 성명 (수정 가능)
                </label>
                <input
                  type="text"
                  value={inspectorName}
                  onChange={e => setInspectorName(e.target.value)}
                  placeholder="점검자 성명 입력"
                  disabled={isGenerating || isSendingEmail}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                />
              </div>
            </div>
          </div>

          {/* 2. 현장 사용 중인 자산 전체 목록 */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <CheckCircle2 size={15} color="var(--success)" />
                현장 사용 중인 자산 전체 목록 (총 {siteActiveAssets.length}대 — 각 자산별 체크리스트 1장씩 생성)
              </label>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                서식: 고소작업대 월간 안전점검 체크리스트
              </span>
            </div>

            {siteActiveAssets.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', color: 'var(--danger)', fontSize: '12.5px', fontWeight: 600 }}>
                현재 현장에서 사용 중인 장비가 없습니다.
              </div>
            ) : (
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: 'var(--bg-card)' }}>
                <table className="table" style={{ margin: 0, fontSize: '12px' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-app)' }}>
                      <th style={{ padding: '6px 10px', width: '50px', textAlign: 'center' }}>순번</th>
                      <th style={{ padding: '6px 10px' }}>모델명</th>
                      <th style={{ padding: '6px 10px' }}>장비번호 (자산번호)</th>
                      <th style={{ padding: '6px 10px' }}>제조번호</th>
                      <th style={{ padding: '6px 10px' }}>최초개시일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siteActiveAssets.map((ast, idx) => (
                      <tr key={ast.caId || idx}>
                        <td style={{ padding: '5px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '5px 10px', fontWeight: 700 }}>{ast.modelName}</td>
                        <td style={{ padding: '5px 10px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>{ast.assetNo}</td>
                        <td style={{ padding: '5px 10px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{ast.serialNo || '-'}</td>
                        <td style={{ padding: '5px 10px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{ast.startDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. 안전담당자 이메일 수신인 관리 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '14px 16px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <Mail size={15} color="#d97706" />
                  현장 안전담당자 이메일 수신인 ({recipients.length}명 지정됨)
                </label>
                {recipients.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setRecipients([])}
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#dc2626',
                      backgroundColor: 'rgba(220, 38, 38, 0.08)',
                      border: '1px solid rgba(220, 38, 38, 0.3)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    전체 해제
                  </button>
                ) : availableContacts.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const safetyList = availableContacts.filter(c => c.contactType === 'SAFETY');
                      const defaultTargetList = safetyList.length > 0 ? safetyList : availableContacts;
                      setRecipients(
                        defaultTargetList.map((c, idx) => ({
                          id: `recip-safety-${site?.id || 'default'}-${idx}`,
                          email: c.email,
                          name: c.name,
                          roleLabel: c.roleLabel,
                          source: c.contactType === 'SAFETY' ? 'SAFETY' : 'SITE'
                        }))
                      );
                    }}
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#b45309',
                      backgroundColor: 'rgba(217, 119, 6, 0.12)',
                      border: '1px solid #d97706',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    현장 담당자 전체 선택
                  </button>
                ) : null}
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                * 현장 안전담당자 최우선 자동 지정 (직접 입력 시 현장 안전담당자로 자동 등록)
              </span>
            </div>

            {/* 선택된 수신인 칩 */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                minHeight: '38px',
                padding: '8px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                alignItems: 'center'
              }}
            >
              {recipients.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', paddingLeft: '4px' }}>
                  지정된 안전담당자 이메일이 없습니다. 아래에서 선택하거나 직접 입력해 주세요.
                </span>
              ) : (
                recipients.map(r => (
                  <div
                    key={r.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 8px 4px 10px',
                      borderRadius: '16px',
                      backgroundColor: r.source === 'SAFETY' ? 'rgba(217, 119, 6, 0.14)' : 'var(--primary-light)',
                      border: `1px solid ${r.source === 'SAFETY' ? 'rgba(217, 119, 6, 0.45)' : 'var(--primary)'}`,
                      color: r.source === 'SAFETY' ? '#b45309' : 'var(--primary)',
                      fontSize: '12px',
                      fontWeight: 600
                    }}
                  >
                    <span>
                      {r.name ? `${r.name} ` : ''}
                      <span style={{ fontWeight: 400, opacity: 0.9 }}>&lt;{r.email}&gt;</span>
                      <span style={{ fontSize: '10.5px', marginLeft: '4px', opacity: 0.8 }}>({r.roleLabel})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(r.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '1px',
                        display: 'flex',
                        alignItems: 'center',
                        color: 'inherit'
                      }}
                      title="수신인 제거"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* 직접 입력 */}
            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: '6px', alignItems: 'center' }}>
              <input
                type="text"
                value={manualInputName}
                onChange={e => setManualInputName(e.target.value)}
                placeholder="안전담당자명 (선택)"
                style={{
                  padding: '7px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '12.5px'
                }}
              />
              <input
                type="text"
                value={manualInputEmail}
                onChange={e => setManualInputEmail(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddManualRecipient();
                  }
                }}
                placeholder="안전담당자 이메일 입력 (입력 시 현장 안전담당자로 자동 저장)"
                style={{
                  padding: '7px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-main)',
                  fontSize: '12.5px'
                }}
              />
              <button
                type="button"
                onClick={handleAddManualRecipient}
                style={{
                  padding: '7px 14px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                <Plus size={14} /> 추가
              </button>
            </div>

            {/* 등록된 현장 담당자 선택 도우미 */}
            {(availableContacts.length > 0 || missingEmailContacts.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Users size={12} color="#d97706" />
                  등록된 현장 담당자 선택 (클릭하여 수신인 추가/제외):
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {availableContacts.map(c => {
                    const isAdded = recipients.some(r => r.email.toLowerCase() === c.email.toLowerCase());
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleToggleContactRecipient(c)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: isAdded ? '1px solid #d97706' : '1px dashed var(--border-color)',
                          backgroundColor: isAdded ? 'rgba(217, 119, 6, 0.12)' : 'var(--bg-card)',
                          color: isAdded ? '#b45309' : 'var(--text-muted)',
                          fontSize: '11.5px',
                          fontWeight: isAdded ? 700 : 500,
                          cursor: 'pointer'
                        }}
                      >
                        {isAdded ? <Check size={11} /> : <Plus size={11} />}
                        <span>{c.name} ({c.roleLabel})</span>
                        <span style={{ opacity: 0.75, fontSize: '10.5px' }}>&lt;{c.email}&gt;</span>
                      </button>
                    );
                  })}
                  {missingEmailContacts.map(mc => (
                    <button
                      key={mc.id}
                      type="button"
                      onClick={() => setManualInputName(mc.name)}
                      title="이메일이 미등록된 현장 담당자입니다. 클릭 시 이름란에 입력됩니다."
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px dashed rgba(245, 158, 11, 0.5)',
                        backgroundColor: 'rgba(245, 158, 11, 0.08)',
                        color: '#b45309',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <span>{mc.name} ({mc.roleLabel}{mc.phone ? ` · ${mc.phone}` : ''})</span>
                      <span style={{ fontSize: '10.5px', opacity: 0.85 }}>[이메일 미등록]</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. 이메일 제목 및 본문 확인 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px 16px',
              backgroundColor: 'var(--bg-app)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                <FileText size={15} color="var(--primary)" />
                이메일 제목 및 본문
              </label>
              <button
                type="button"
                onClick={() => setIsEmailContentOpen(prev => !prev)}
                style={{
                  fontSize: '11.5px',
                  color: 'var(--primary)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                }}
              >
                {isEmailContentOpen ? '내용 접기 ▲' : '내용 확인 및 수정 ▼'}
              </button>
            </div>

            {isEmailContentOpen ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>메일 제목</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={e => setEmailSubject(e.target.value)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '12.5px',
                      fontWeight: 600
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>메일 본문</label>
                  <textarea
                    rows={8}
                    value={emailBody}
                    onChange={e => setEmailBody(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                      color: 'var(--text-main)',
                      fontSize: '12px',
                      lineHeight: '1.5',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <strong style={{ color: 'var(--text-main)' }}>제목:</strong> {emailSubject}
              </div>
            )}
          </div>

          {/* 진행 상태 */}
          {isGenerating && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', backgroundColor: 'var(--primary-light)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 700, color: 'var(--primary)' }}>
                <span>{progressText}</span>
                <span>{progressPercent}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: '100%',
                    backgroundColor: 'var(--primary)',
                    transition: 'width 0.2s ease-in-out'
                  }}
                />
              </div>
            </div>
          )}

          {/* 오류 메시지 */}
          {errorMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', borderRadius: '6px', color: 'var(--danger)', fontSize: '13px' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 생성 결과 */}
          {generatedResult && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', backgroundColor: 'var(--success-light)', border: '1px solid var(--success)', borderRadius: '8px', color: 'var(--success)', fontSize: '12.5px', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileCheck size={16} color="var(--success)" />
                <span>{generatedResult.fileName} (총 {generatedResult.pageCount}대 체크리스트 생성 완료)</span>
              </div>
              {emailSentSuccess && (
                <span style={{ fontSize: '11.5px', backgroundColor: 'var(--success)', color: '#fff', padding: '2px 8px', borderRadius: '10px' }}>
                  ✓ 이메일 발송 완료
                </span>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-app)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating || isSendingEmail}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            닫기
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleOpenLocalFile(true)}
              disabled={isGenerating || isSendingEmail || !canSendChecklist || isAgentOnline === false || siteActiveAssets.length === 0}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: (isGenerating || !canSendChecklist || isAgentOnline === false || siteActiveAssets.length === 0) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                opacity: (!canSendChecklist || isAgentOnline === false || siteActiveAssets.length === 0) ? 0.5 : 1,
                whiteSpace: 'nowrap'
              }}
            >
              <FolderOpen size={14} />
              엑셀 파일 열기
            </button>

            <button
              type="button"
              onClick={() => handleOpenLocalFile(false)}
              disabled={isGenerating || isSendingEmail || !canSendChecklist || isAgentOnline === false || siteActiveAssets.length === 0}
              style={{
                padding: '8px 14px',
                borderRadius: '6px',
                border: '1px solid var(--primary)',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: (isGenerating || !canSendChecklist || isAgentOnline === false || siteActiveAssets.length === 0) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                opacity: (!canSendChecklist || isAgentOnline === false || siteActiveAssets.length === 0) ? 0.5 : 1,
                whiteSpace: 'nowrap'
              }}
            >
              {isGenerating ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
              체크리스트 미리보기
            </button>

            <button
              type="button"
              onClick={handleSendChecklistEmail}
              disabled={isGenerating || isSendingEmail || recipients.length === 0 || !canSendChecklist || isAgentOnline === false || siteActiveAssets.length === 0}
              style={{
                padding: '8px 18px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: (!canSendChecklist || recipients.length === 0 || isAgentOnline === false || siteActiveAssets.length === 0) ? 'var(--text-muted)' : '#d97706',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: (isGenerating || isSendingEmail || recipients.length === 0 || !canSendChecklist || isAgentOnline === false || siteActiveAssets.length === 0) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              {isSendingEmail ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              {isSendingEmail ? '발송 중...' : `월간 안전점검 체크리스트 이메일 발송 (${recipients.length}명)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
