import React, { useState, useMemo, useEffect } from 'react';
import { Mail, Send, Paperclip, CheckCircle2, AlertCircle, FileText, Building2, User, Phone, Check, RefreshCw, X, Eye } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { db, Customer, CustomerContact, CustomerSite } from '../services/db';
import { emailService, SentEmail, normalizeEmailRecipientString } from '../services/email';

type TemplateType = 'COMPANY_PROFILE' | 'CATALOG_SPEC' | 'CONTRACT_BUNDLE' | 'CUSTOM';

interface MailAttachment {
  filename: string;
  content: string; // base64
  size?: number;
}

export const OfficialMailPage: React.FC = () => {
  const { customers, products, officialMailConfigs, currentUser, currentTenant } = useApp();
  const customerContacts: CustomerContact[] = db.contacts;
  const customerSites: CustomerSite[] = db.sites;

  // 1. 발송 대상 (좌상단 Scope)
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedContactId, setSelectedContactId] = useState<string>('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>('');
  const [recipientPhone, setRecipientPhone] = useState<string>('');
  const [ccEmail, setCcEmail] = useState<string>('');

  // 2. 템플릿 및 첨부 (우상단 Pipeline)
  const [templateType, setTemplateType] = useState<TemplateType>('COMPANY_PROFILE');
  const [specModel, setSpecModel] = useState<string>('GS-1930');

  // 3. 본문 및 제목 (중앙 본문)
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [attachments, setAttachments] = useState<MailAttachment[]>([]);
  const [isAttaching, setIsAttaching] = useState<boolean>(false);

  // 4. 발송 상태 및 이력
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendResultMsg, setSendResultMsg] = useState<{ success: boolean; text: string } | null>(null);
  const [sentHistory, setSentHistory] = useState<SentEmail[]>([]);

  // 공식 발신 계정 (SSOT: 현재 테넌트 변수 기반 설정 및 실제 유효 이메일 우선 매핑)
  const activeTenantId = (currentTenant?.id || '').toLowerCase();
  const activeTenantCode = (currentTenant?.tenantCode || '').toLowerCase();
  const activeSubdomain = (currentTenant?.subdomain || '').toLowerCase();

  const isTenantMatch = (tId?: string) => {
    if (!tId) return false;
    const normalized = tId.toLowerCase();
    return (
      normalized === activeTenantId ||
      normalized === activeTenantCode ||
      normalized === activeSubdomain ||
      (activeTenantCode && normalized.includes(activeTenantCode)) ||
      (activeSubdomain && normalized.includes(activeSubdomain))
    );
  };

  const officialConfig = useMemo(() => {
    // 1. Context에 로드된 officialMailConfigs 탐색 (현재 테넌트 1:1 매핑, 최신 갱신순)
    if (officialMailConfigs && officialMailConfigs.length > 0) {
      const sorted = [...officialMailConfigs].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      const tenantMatched = sorted.filter(c => isTenantMatch(c.tenantId));
      const validTenantCfg = tenantMatched.find(c => c.googleEmail && c.googleEmail.trim());
      if (validTenantCfg) return validTenantCfg;
      if (tenantMatched.length > 0) return tenantMatched[0];
      if (!activeTenantId) return sorted[0];
    }

    // 2. DB(db.officialMailConfigs) 탐색
    const allDbConfigs = [...(db.officialMailConfigs || [])].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    const dbTenantMatched = allDbConfigs.filter(c => isTenantMatch(c.tenantId));
    const dbValid = dbTenantMatched.find(c => c.googleEmail && c.googleEmail.trim());
    if (dbValid) return dbValid;
    if (dbTenantMatched.length > 0) return dbTenantMatched[0];

    // 3. localStorage('erp_officialMailConfigs') 탐색
    try {
      const lsVal = localStorage.getItem('erp_officialMailConfigs');
      if (lsVal) {
        const rawLsConfigs: any[] = JSON.parse(lsVal);
        if (Array.isArray(rawLsConfigs) && rawLsConfigs.length > 0) {
          const lsConfigs = [...rawLsConfigs].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
          const lsTenantMatched = lsConfigs.filter((c: any) => isTenantMatch(c.tenantId));
          const lsValid = lsTenantMatched.find((c: any) => c.googleEmail && c.googleEmail.trim());
          if (lsValid) return lsValid;
          if (lsTenantMatched.length > 0) return lsTenantMatched[0];
        }
      }
    } catch {}

    // 4. 중앙 테넌트 마스터(currentTenant.features.officialMailConfig) 폴백
    const tenantSmtpFallback = (currentTenant?.features as any)?.officialMailConfig || (currentTenant as any)?.officialMailConfig || (currentTenant?.features as any)?.smtpConfig || (currentTenant as any)?.smtpConfig;
    if (tenantSmtpFallback?.googleEmail) {
      return tenantSmtpFallback;
    }

    return undefined;
  }, [officialMailConfigs, activeTenantId, activeTenantCode, activeSubdomain, currentTenant]);

  const senderEmail = officialConfig?.googleEmail || currentTenant?.email || currentTenant?.taxEmail || '미설정 (테넌트 관리 센터 > 공식메일설정 필요)';
  const senderBrand = currentTenant?.tradeName || currentTenant?.corporateName || currentTenant?.displayName || 'e-Bro ERP';

  // 최근 발송 이력 로드
  const loadHistory = () => {
    try {
      setSentHistory(emailService.listSentEmails());
    } catch {
      setSentHistory([]);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // 거래처 변경 시 담당자 및 현장 자동 연동
  const currentCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const relatedContacts = useMemo(() => {
    if (!selectedCustomerId) return [];
    return customerContacts.filter(c => c.customerId === selectedCustomerId);
  }, [customerContacts, selectedCustomerId]);

  const relatedSites = useMemo(() => {
    if (!selectedCustomerId) return [];
    return customerSites.filter(s => s.customerId === selectedCustomerId);
  }, [customerSites, selectedCustomerId]);

  // 고객사 선택 처리
  const handleCustomerChange = (custId: string) => {
    setSelectedCustomerId(custId);
    setSelectedContactId('');
    setSelectedSiteId('');
    const cust = customers.find(c => c.id === custId);
    if (cust) {
      setRecipientEmail(normalizeEmailRecipientString(cust.repEmail) || cust.repEmail || '');
      setRecipientName(cust.name || '');
      setRecipientPhone(cust.repContact || '');
    } else {
      setRecipientEmail('');
      setRecipientName('');
      setRecipientPhone('');
    }
  };

  // 담당자 선택 처리
  const handleContactChange = (contactId: string) => {
    setSelectedContactId(contactId);
    const cnt = relatedContacts.find(c => c.id === contactId);
    if (cnt) {
      if (cnt.email) setRecipientEmail(normalizeEmailRecipientString(cnt.email) || cnt.email);
      setRecipientName(cnt.name ? `${currentCustomer?.name || ''} ${cnt.name} ${cnt.position || '담당자'}` : recipientName);
      if (cnt.contact) setRecipientPhone(cnt.contact);
    }
  };

  // 서식 파일 비동기 로드 함수
  const fetchTemplateBase64 = async (url: string, filename: string): Promise<MailAttachment | null> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = (reader.result as string).split(',')[1];
          resolve({ filename, content: base64data, size: blob.size });
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // 첨부된 파일 명칭 기준으로 제목 및 안내 문구 자동 생성
  const syncComposeWithAttachments = React.useCallback((atts: MailAttachment[], mode: TemplateType) => {
    const custTitle = recipientName || (currentCustomer ? currentCustomer.name : '고객사');
    const siteTitle = selectedSiteId ? (relatedSites.find(s => s.id === selectedSiteId)?.name || '') : '';
    const siteLine = siteTitle ? `• 관련 현장: ${siteTitle}\n` : '';

    if (atts.length === 0) {
      if (mode === 'CUSTOM') {
        setSubject(prev => prev || `[${senderBrand}] ${custTitle} 업무 협조의 건`);
        setBody(prev => prev || `안녕하십니까, ${custTitle} 담당자님.\n${senderBrand} 입니다.\n\n내용을 입력하세요.\n\n감사합니다.`);
      } else {
        setSubject(`[${senderBrand}] ${custTitle} 안내 메일`);
        setBody(
          `안녕하십니까, ${custTitle} 담당자님.\n` +
          `${senderBrand} 입니다.\n\n` +
          (siteLine ? `${siteLine}\n` : '') +
          `문의 사항이 있으시면 언제든지 연락 주시기 바랍니다.\n\n` +
          `감사합니다.\n` +
          `${senderBrand} 배상`
        );
      }
      return;
    }

    const docLabels = atts.map(a => a.filename.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
    const hasCompanyProfile = atts.some(a => a.filename.includes('회사소개서'));
    const hasSpec = atts.some(a => a.filename.includes('제원표'));
    const hasContract = atts.some(a => a.filename.includes('계약서') || a.filename.includes('체크리스트') || a.filename.includes('안전점검'));

    let summaryTitle = '';
    if (hasContract && atts.length >= 2) {
      summaryTitle = '표준 계약 서식 세트';
    } else if (hasCompanyProfile && hasSpec && atts.length === 2) {
      summaryTitle = `회사소개서 및 ${specModel} 표준제원표`;
    } else if (hasCompanyProfile && atts.length === 1) {
      summaryTitle = '회사소개서';
    } else if (hasSpec && atts.length === 1) {
      summaryTitle = `${specModel} 표준제원표`;
    } else if (atts.length === 1) {
      summaryTitle = docLabels[0];
    } else {
      summaryTitle = `${docLabels[0]} 외 ${atts.length - 1}건`;
    }

    setSubject(`[${senderBrand}] ${custTitle} ${summaryTitle} 송부`);

    const attachmentListText = atts
      .map((a, idx) => `${idx + 1}. ${a.filename}`)
      .join('\n');

    setBody(
      `안녕하십니까, ${custTitle} 담당자님.\n` +
      `${senderBrand} 입니다.\n\n` +
      `요청하신 ${summaryTitle} 파일을 아래와 같이 첨부하여 송부드립니다.\n\n` +
      `■ 첨부 파일 내역 (${atts.length}건)\n` +
      (siteLine ? `${siteLine}` : '') +
      `${attachmentListText}\n\n` +
      `첨부된 파일을 확인해 주시기 바라며, 추가 문의 사항이 있으시면 언제든지 연락 주시기 바랍니다.\n\n` +
      `감사합니다.\n` +
      `${senderBrand} 배상`
    );
  }, [recipientName, currentCustomer, selectedSiteId, relatedSites, senderBrand, specModel]);

  // 템플릿 변경 시 해당 서식 파일 로드 및 본문/제목 동기화
  useEffect(() => {
    const applyTemplate = async () => {
      setIsAttaching(true);
      const newAtts: MailAttachment[] = [];

      if (templateType === 'COMPANY_PROFILE') {
        const prof = await fetchTemplateBase64('/tenants/giyuen/templates/회사소개서_공식.pdf', `${senderBrand}_회사소개서.pdf`);
        if (prof) newAtts.push(prof);
      } else if (templateType === 'CATALOG_SPEC') {
        const spec = await fetchTemplateBase64('/tenants/giyuen/templates/표준제원표양식.pdf', `고소작업대_${specModel}_표준제원표.pdf`);
        if (spec) newAtts.push(spec);
      } else if (templateType === 'CONTRACT_BUNDLE') {
        const c1 = await fetchTemplateBase64('/tenants/giyuen/templates/임대차계약서_양식_원본.pdf', `임대차계약서_양식.pdf`);
        if (c1) newAtts.push(c1);
        const c2 = await fetchTemplateBase64('/tenants/giyuen/templates/반입전체크리스트_양식_원본.pdf', `반입전체크리스트_양식.pdf`);
        if (c2) newAtts.push(c2);
        const c3 = await fetchTemplateBase64('/tenants/giyuen/templates/안전점검결과서_양식_원본.pdf', `안전점검결과서_양식.pdf`);
        if (c3) newAtts.push(c3);
      }

      setAttachments(newAtts);
      syncComposeWithAttachments(newAtts, templateType);
      setIsAttaching(false);
    };

    applyTemplate();
  }, [templateType, specModel, senderBrand]);

  // 수신처/현장 변경 시 현재 첨부파일 기준으로 제목과 안내 문구 갱신
  useEffect(() => {
    syncComposeWithAttachments(attachments, templateType);
  }, [selectedCustomerId, recipientName, selectedSiteId]);

  // 로컬 파일 사용자 직접 추가
  const handleUserFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = (reader.result as string).split(',')[1];
        setAttachments(prev => {
          const next = [...prev, { filename: file.name, content: base64data, size: file.size }];
          syncComposeWithAttachments(next, templateType);
          return next;
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // 첨부 파일 삭제
  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const next = prev.filter((_, i) => i !== index);
      syncComposeWithAttachments(next, templateType);
      return next;
    });
  };

  // 이메일 최종 발송
  const handleSendEmail = async () => {
    if (isSending) return;
    if (!recipientEmail || !recipientEmail.trim()) {
      alert('수신자 이메일 주소를 입력해 주세요.');
      return;
    }
    if (!subject || !subject.trim()) {
      alert('이메일 제목을 입력해 주세요.');
      return;
    }
    if (!body || !body.trim()) {
      alert('이메일 본문을 입력해 주세요.');
      return;
    }

    setIsSending(true);
    setSendResultMsg(null);

    try {
      const res = await emailService.sendEmail(
        recipientEmail.trim(),
        subject.trim(),
        body,
        attachments.map(a => ({ filename: a.filename, content: a.content })),
        ccEmail.trim() || undefined,
        senderBrand
      );

      setSendResultMsg({
        success: true,
        text: `메일 발송 성공: ${res.to} (${attachments.length}개 파일 첨부)`
      });
      loadHistory();
    } catch (err: any) {
      setSendResultMsg({
        success: false,
        text: `메일 발송 실패: ${err?.message || err}`
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div data-hs-observe="officialmailpage" style={{ display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', minHeight: 0, overflow: 'hidden', color: 'var(--text-main)' }}>
      {/* 화면 헤더 (무수식어 건조 표준) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Mail size={18} color="var(--primary)" />
          <div>
            <h2 data-mid="official_mail-header" style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>공식 메일 발송</h2>
          </div>
        </div>

        {/* 발신 계정 상태 배지 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
          <span style={{ color: 'var(--text-muted)' }}>발신 계정:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{senderEmail}</span>
        </div>
      </div>

      {/* 발송 결과 피드백 배너 */}
      {sendResultMsg && (
        <div style={{
          padding: '14px 16px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          backgroundColor: sendResultMsg.success ? 'var(--success-light)' : 'var(--danger-light)',
          color: sendResultMsg.success ? 'var(--success)' : 'var(--danger)',
          border: `1px solid ${sendResultMsg.success ? 'var(--success)' : 'var(--danger)'}`,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {sendResultMsg.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span style={{ fontWeight: 600 }}>{sendResultMsg.text}</span>
          </div>
          <button onClick={() => setSendResultMsg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.7 }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* 내부 스크롤 작업 본문 래퍼 */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '4px' }}>
        {/* 메인 작업 영역: 좌측 Scope (거래처 및 수신자) + 우측 Pipeline/Inspection (서식 및 본문) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: '20px' }}>

        {/* 좌측 패널: ① 좌상단 Scope (거래처 및 수신자 설정) */}
        <div
          data-mid="mail-recipient-panel"
          style={{
            gridColumn: 'span 4',
            backgroundColor: 'var(--bg-card)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', color: 'var(--text-main)' }}>
            <Building2 size={16} color="var(--primary)" />
            <span>수신 대상 지정</span>
          </div>

          {/* 거래처 선택 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              거래처 선택
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px',
                fontSize: '12px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-main)',
                outline: 'none'
              }}
            >
              <option value="">-- 거래처 선택 (직접 입력 가능) --</option>
              {customers.map((c: Customer) => (
                <option key={c.id} value={c.id}>{c.name} {c.bizRegNo ? `(${c.bizRegNo})` : ''}</option>
              ))}
            </select>
          </div>

          {/* 담당자 선택 (거래처 등록 담당자) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              담당자 선택
            </label>
            <select
              value={selectedContactId}
              onChange={(e) => handleContactChange(e.target.value)}
              disabled={relatedContacts.length === 0}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px',
                fontSize: '12px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-main)',
                outline: 'none',
                opacity: relatedContacts.length === 0 ? 0.6 : 1
              }}
            >
              <option value="">-- 담당자 선택 {relatedContacts.length === 0 ? '(등록된 담당자 없음)' : ''} --</option>
              {relatedContacts.map(cnt => (
                <option key={cnt.id} value={cnt.id}>
                  {cnt.name} {cnt.position || '담당'} {cnt.email ? `(${cnt.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 현장 선택 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              관련 현장 선택
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              disabled={relatedSites.length === 0}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px',
                fontSize: '12px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-main)',
                outline: 'none',
                opacity: relatedSites.length === 0 ? 0.6 : 1
              }}
            >
              <option value="">-- 현장 선택 {relatedSites.length === 0 ? '(등록된 현장 없음)' : ''} --</option>
              {relatedSites.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.address || '주소 미등록'})</option>
              ))}
            </select>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* 수신자명 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                수신자 호칭 / 성명
              </label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="예: 에이치엔아이씨 김소장"
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  fontSize: '12px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
              />
            </div>

            {/* 수신 이메일 (필수) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>수신 이메일 주소 <span style={{ color: 'var(--danger)' }}>*</span></span>
              </label>
              <input
                type="text"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="recipient@company.com (콤마 또는 슬래시로 복수 입력 가능)"
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  fontSize: '12px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
              />
            </div>

            {/* 참조 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                참조 이메일
              </label>
              <input
                type="text"
                value={ccEmail}
                onChange={(e) => setCcEmail(e.target.value)}
                placeholder="cc@company.com (선택 사항 / 복수 입력 가능)"
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  fontSize: '12px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        </div>

        {/* 우측 상단 & 중앙 패널: ② Pipeline (템플릿) & ③ Inspection (본문/첨부) */}
        <div
          data-mid="mail-composer-panel"
          style={{
            gridColumn: 'span 8',
            backgroundColor: 'var(--bg-card)',
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '20px'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 템플릿 선택 탭 바 (무수식어 건조 표준) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                발송 서식 템플릿 선택
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px' }}>
                {[
                  { key: 'COMPANY_PROFILE', label: '회사소개서' },
                  { key: 'CATALOG_SPEC', label: '제원표/카탈로그' },
                  { key: 'CONTRACT_BUNDLE', label: '계약서식 세트' },
                  { key: 'CUSTOM', label: '직접 작성' },
                ].map(item => {
                  const isActive = templateType === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setTemplateType(item.key as TemplateType)}
                      style={{
                        height: '36px',
                        padding: '0 10px',
                        fontSize: '12px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                        backgroundColor: isActive ? 'var(--primary)' : 'var(--bg-app)',
                        color: isActive ? '#ffffff' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 제원표 선택 시 기종 선택 */}
            {templateType === 'CATALOG_SPEC' && (
              <div style={{
                padding: '12px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>대상 모델 선택:</span>
                <select
                  value={specModel}
                  onChange={(e) => setSpecModel(e.target.value)}
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    fontSize: '12px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    color: 'var(--text-main)',
                    maxWidth: '300px'
                  }}
                >
                  <option value="GS-1930">Genie GS-1930 (6m 작업높이 7.8m)</option>
                  <option value="GS-3246">Genie GS-3246 (10m 작업높이 11.7m)</option>
                  <option value="GS-4047">Genie GS-4047 (12m 작업높이 13.9m)</option>
                  <option value="Z-34/22">Genie Z-34/22 (굴절 붐 12m)</option>
                </select>
              </div>
            )}

            {/* 이메일 제목 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                메일 제목
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="메일 제목을 입력하세요"
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  outline: 'none'
                }}
              />
            </div>

            {/* 이메일 본문 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>메일 본문</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>정중한 비즈니스 서식 자동 생성</span>
              </label>
              <textarea
                rows={9}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  lineHeight: '1.6',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: 'var(--text-main)',
                  outline: 'none',
                  resize: 'none'
                }}
              />
            </div>

            {/* 첨부 파일 패널 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Paperclip size={14} />
                  <span>첨부 파일 ({attachments.length}개)</span>
                  {isAttaching && <span style={{ fontSize: '11px', color: 'var(--primary)' }}>서식 로딩 중...</span>}
                </label>
                <label style={{
                  cursor: 'pointer',
                  padding: '4px 10px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  + PC 파일 추가
                  <input type="file" multiple onChange={handleUserFileUpload} style={{ display: 'none' }} />
                </label>
              </div>

              <div style={{
                minHeight: '50px',
                padding: '8px',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                alignItems: 'center'
              }}>
                {attachments.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '0 8px' }}>첨부된 파일이 없습니다.</span>
                ) : (
                  attachments.map((att, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        fontSize: '12px',
                        boxShadow: 'var(--shadow-sm)',
                        color: 'var(--text-main)'
                      }}
                    >
                      <FileText size={13} color="var(--primary)" />
                      <span style={{ fontWeight: 600, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={att.filename}>{att.filename}</span>
                      {att.size && <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>({Math.round(att.size / 1024)}KB)</span>}
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ④ 우하단 Terminal Action (최종 발송 완결 바) */}
          <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              수신: <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{recipientEmail || '(미지정)'}</span> | 
              발신: <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{senderBrand}</span>
            </div>

            <button
              data-mid="mail-terminal-send"
              type="button"
              onClick={handleSendEmail}
              disabled={isSending || !recipientEmail}
              style={{
                height: '40px',
                padding: '0 24px',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                fontSize: '12.5px',
                fontWeight: 700,
                borderRadius: '8px',
                border: 'none',
                cursor: (isSending || !recipientEmail) ? 'not-allowed' : 'pointer',
                opacity: (isSending || !recipientEmail) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {isSending ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>이메일 발송 중...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>이메일 발송</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* 하단 패널: 최근 발송 내역 (헌장 1.2 무누락 DB 보존) */}
      <div style={{
        backgroundColor: 'var(--bg-card)',
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', color: 'var(--text-main)' }}>
            <CheckCircle2 size={16} color="var(--success)" />
            <span>최근 공식 메일 발송 이력</span>
          </div>
          <button
            onClick={loadHistory}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '12px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RefreshCw size={12} />
            <span>새로고침</span>
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '12px', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>발송 일시</th>
                <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>수신자</th>
                <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>메일 제목</th>
                <th style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>상태</th>
              </tr>
            </thead>
            <tbody>
              {sentHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)' }}>발송 이력이 없습니다.</td>
                </tr>
              ) : (
                sentHistory.slice(0, 5).map((mail) => (
                  <tr key={mail.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {new Date(mail.sentAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-main)' }}>
                      {mail.to}
                    </td>
                    <td style={{ padding: '10px 12px', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {mail.subject}
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      {mail.success ? (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: 'var(--success-light)',
                          color: 'var(--success)',
                          border: '1px solid var(--success)'
                        }}>
                          발송 완료
                        </span>
                      ) : (
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          backgroundColor: 'var(--danger-light)',
                          color: 'var(--danger)',
                          border: '1px solid var(--danger)'
                        }}>
                          실패
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </div>
    </div>
  );
};
