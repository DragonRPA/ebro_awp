import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Building2, Database, Plus, Edit2, Trash2, Globe, Shield, Check, ExternalLink, 
  Download, Search, RefreshCw, Eye, EyeOff, Star, Upload, FileText, Smartphone,
  Mic, FileSignature, Receipt, ArrowRight, ToggleLeft, ToggleRight, X,
  MapPin, CreditCard, Layers, Calendar, Clock, Key, AlertTriangle, 
  CheckCircle2, XCircle, Zap, Bot
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { 
  Tenant, TenantFeatures, TenantBankAccount, TenantYard, OFFICIAL_STAMP_BASE64,
  TenantSubscription, SubscriptionPlan, SubscriptionStatus, getTenantSubscriptionInfo,
  SolutionType, db, GoogleConfig 
} from '../services/db';
import { exportToExcel } from '../services/excel';
import { SYSTEM_MENU_CONFIG, getAllSystemMenuIds, MenuGroupConfig } from '../config/menu_config';
import { syncTenantPolicyToAgent } from '../services/agentService';
import { 
  STANDARD_DOCUMENTS, 
  TemplateDocType, 
  TemplateDataPayload, 
  SAMPLE_TEMPLATE_PAYLOAD, 
  renderTemplateToHtml, 
  getTenantTemplate, 
  saveTenantTemplate, 
  resetTenantTemplate,
  getDefaultTemplate
} from '../services/universalTemplateEngine';
import * as XLSX from 'xlsx';
import {
  parseWorkbookToEntities,
  ingestExcelInitialData,
  resetAllDatabaseTables,
  exportInitialDataExcelTemplate,
  ParsedInitialData
} from '../services/migrationEngine';
import { analyzeBusinessLicense, formatBizRegNo, BusinessLicenseAnalysisResult } from '../services/visionOcrService';

export const TenantManagementPage: React.FC = () => {
  const { 
    tenants, 
    currentTenant, 
    setCurrentTenantId, 
    saveTenant, 
    deleteTenant, 
    currentUser, 
    showErrorModal,
    loadTablesForMenu
  } = useApp();

  useEffect(() => {
    // 🌐 중앙 플랫폼 DB(ebro-platform-core)의 최신 테넌트 원장 실시간 동기화
    if (loadTablesForMenu) {
      loadTablesForMenu('tenant_management');
    }
  }, []);

  // 1. 검색 및 필터 상태 (좌상단 스코프)
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED'>('ALL');

  // 2. 모달 상태
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [modalTab, setModalTab] = useState<'BASIC' | 'SUBSCRIPTION' | 'BRAND' | 'BANKS_YARDS' | 'PLUGINS' | 'PAGES' | 'AGENTS' | 'TEMPLATES' | 'INITIAL_DB' | 'STORAGE'>('BASIC');
  const [tenantHeartbeats, setTenantHeartbeats] = useState<any[]>([]);
  const [isLoadingHeartbeats, setIsLoadingHeartbeats] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [pageSearchKeyword, setPageSearchKeyword] = useState<string>('');

  // 9. 초기 DB 업로드 (INITIAL_DB) 상태
  const [initialDbFile, setInitialDbFile] = useState<File | null>(null);
  const [initialDbParsed, setInitialDbParsed] = useState<ParsedInitialData | null>(null);
  const [isInitialDbParsing, setIsInitialDbParsing] = useState<boolean>(false);
  const [isInitialDbIngesting, setIsInitialDbIngesting] = useState<boolean>(false);
  const [initialDbProgress, setInitialDbProgress] = useState<{ step: number; total: number; message: string }>({ step: 0, total: 13, message: '' });
  const [initialDbResultMsg, setInitialDbResultMsg] = useState<string>('');
  const [initialDbErrorMsg, setInitialDbErrorMsg] = useState<string>('');
  const initialDbFileInputRef = useRef<HTMLInputElement>(null);

  // 서식 관리 (TEMPLATES) 상태
  const [selectedDocType, setSelectedDocType] = useState<TemplateDocType>('CONTRACT');
  const [templateVersion, setTemplateVersion] = useState<number>(0);
  const [templateSuccessMsg, setTemplateSuccessMsg] = useState<string>('');
  const templateFileInputRef = useRef<HTMLInputElement>(null);

  // 사업자등록증 온보딩 상태
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);
  const [isAnalyzingLicense, setIsAnalyzingLicense] = useState<boolean>(false);
  const [onboardingError, setOnboardingError] = useState<string>('');
  const licenseFileInputRef = useRef<HTMLInputElement>(null);

  // 3. 폼 상태
  const [formData, setFormData] = useState<Partial<Tenant>>({
    tenantCode: '',
    subdomain: '',
    solutionType: 'AWP',
    targetRepo: 'DragonRPA/ebro_awp',
    displayName: '',
    corporateName: '',
    tradeName: '',
    businessNumber: '',
    corporateRegistrationNumber: '',
    representativeName: '',
    openingDate: '',
    businessAddress: '',
    headOfficeAddress: '',
    businessCategory: '사업지원및임대서비스업',
    businessItem: '고소작업대임대',
    tel: '',
    fax: '',
    salesPhone: '',
    taxEmail: '',
    taxOffice: '',
    websiteUrl: '',
    ciUrl: '',
    logoUrl: '',
    stampImageUrl: OFFICIAL_STAMP_BASE64,
    status: 'ACTIVE',
    isDefault: false,
    allowCustomBillingStatement: false,
    allowedPages: [],
    hiddenPages: [],
    subscription: {
      plan: 'STANDARD',
      status: 'ACTIVE',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      gracePeriodDays: 7,
      billingCycle: 'MONTHLY',
      monthlyFee: 500000,
      autoRenew: true,
      maxAssets: 0,
      maxUsers: 0,
      licenseKey: '',
      memo: '',
    },
    features: {
      telegramBot: true,
      callRecordingStt: true,
      kakaoContract: true,
      autoTaxInvoice: true,
      voiceAssistance: true,
      customDomain: '',
    },
    bankAccounts: [],
    yards: [],
    workplaces: [],
  });

  const [r2Config, setR2Config] = useState<Partial<GoogleConfig>>({
    r2AccountId: '',
    r2BucketName: '',
    r2AccessKeyId: '',
    r2SecretAccessKey: '',
    r2PublicDomain: '',
  });

  // 파일 업로드 참조
  const ciFileInputRef = useRef<HTMLInputElement>(null);
  const stampFileInputRef = useRef<HTMLInputElement>(null);

  // ── 테넌트 통계 집계 ──
  const counts = useMemo(() => {
    const list = tenants || [];
    let active = 0;
    let expiring = 0;
    let expired = 0;
    let suspended = 0;

    list.forEach(t => {
      const info = getTenantSubscriptionInfo(t);
      if (t.status === 'SUSPENDED') {
        suspended++;
      } else if (info.status === 'EXPIRED' || t.status === 'EXPIRED') {
        expired++;
      } else if (info.status === 'EXPIRING_SOON') {
        expiring++;
      } else {
        active++;
      }
    });

    return { total: list.length, active, expiring, expired, suspended };
  }, [tenants]);

  // ── 필터링된 테넌트 목록 ──
  const filteredTenants = useMemo(() => {
    return (tenants || []).filter(t => {
      const subInfo = getTenantSubscriptionInfo(t);
      if (statusFilter === 'ACTIVE') {
        if (t.status !== 'ACTIVE' || subInfo.status === 'EXPIRED') return false;
      } else if (statusFilter === 'EXPIRING_SOON') {
        if (subInfo.status !== 'EXPIRING_SOON') return false;
      } else if (statusFilter === 'EXPIRED') {
        if (t.status !== 'EXPIRED' && subInfo.status !== 'EXPIRED') return false;
      } else if (statusFilter === 'SUSPENDED') {
        if (t.status !== 'SUSPENDED') return false;
      }
      if (searchKeyword.trim()) {
        const kw = searchKeyword.trim().toLowerCase();
        const code = (t.tenantCode || '').toLowerCase();
        const dName = (t.displayName || '').toLowerCase();
        const cName = (t.corporateName || '').toLowerCase();
        const sub = (t.subdomain || '').toLowerCase();
        const bNum = (t.businessNumber || '').toLowerCase();
        const rep = (t.representativeName || '').toLowerCase();
        const plan = (t.subscription?.plan || '').toLowerCase();
        return code.includes(kw) || dName.includes(kw) || cName.includes(kw) || sub.includes(kw) || bNum.includes(kw) || rep.includes(kw) || plan.includes(kw);
      }
      return true;
    });
  }, [tenants, statusFilter, searchKeyword]);

  // ── 테넌트 등록/수정 모달 오픈 ──
  // ── 테넌트 등록/수정 모달 오픈 ──
  const handleOpenModal = (tenant?: Tenant, initialTab: 'BASIC' | 'SUBSCRIPTION' | 'BRAND' | 'BANKS_YARDS' | 'PLUGINS' | 'PAGES' | 'AGENTS' | 'TEMPLATES' | 'INITIAL_DB' | 'STORAGE' = 'BASIC') => {
    setModalTab(initialTab);
    setPageSearchKeyword('');
    if (tenant) {
      const gConfig = db.googleConfigs.find(c => c.tenantId === tenant.id);
      setR2Config({
        r2AccountId: gConfig?.r2AccountId || '',
        r2BucketName: gConfig?.r2BucketName || '',
        r2AccessKeyId: gConfig?.r2AccessKeyId || '',
        r2SecretAccessKey: gConfig?.r2SecretAccessKey || '',
        r2PublicDomain: gConfig?.r2PublicDomain || '',
      });
      setEditingTenant(tenant);
      setFormData({
        ...tenant,
        solutionType: tenant.solutionType || 'AWP',
        targetRepo: tenant.targetRepo || '',
        features: {
          telegramBot: tenant.features?.telegramBot ?? true,
          callRecordingStt: tenant.features?.callRecordingStt ?? true,
          kakaoContract: tenant.features?.kakaoContract ?? true,
          autoTaxInvoice: tenant.features?.autoTaxInvoice ?? true,
          voiceAssistance: tenant.features?.voiceAssistance ?? true,
          agentAiEnabled: tenant.features?.agentAiEnabled ?? false,
          customDomain: tenant.features?.customDomain ?? '',
        },
        allowedPages: Array.isArray(tenant.allowedPages) ? [...tenant.allowedPages] : [],
        hiddenPages: Array.isArray(tenant.hiddenPages) ? [...tenant.hiddenPages] : [],
        subscription: tenant.subscription ? { ...tenant.subscription } : {
          plan: 'STANDARD',
          status: 'ACTIVE',
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          gracePeriodDays: 7,
          billingCycle: 'MONTHLY',
          monthlyFee: 500000,
          autoRenew: true,
          maxAssets: 0,
          maxUsers: 0,
          licenseKey: `EBR-${tenant.tenantCode || 'TENANT'}-${Date.now().toString(36).toUpperCase()}`,
          memo: '',
        },
        bankAccounts: tenant.bankAccounts ? [...tenant.bankAccounts] : [],
        yards: tenant.yards ? [...tenant.yards] : [],
        workplaces: tenant.workplaces ? [...tenant.workplaces] : [],
      });
    } else {
      setR2Config({
        r2AccountId: '',
        r2BucketName: '',
        r2AccessKeyId: '',
        r2SecretAccessKey: '',
        r2PublicDomain: '',
      });
      setEditingTenant(null);
      const today = new Date().toISOString().slice(0, 10);
      const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const allMenuIds = getAllSystemMenuIds();
      setFormData({
        tenantCode: '',
        subdomain: '',
        solutionType: 'AWP',
        targetRepo: 'DragonRPA/ebro_awp',
        displayName: '',
        corporateName: '',
        tradeName: '',
        businessNumber: '',
        corporateRegistrationNumber: '',
        representativeName: '',
        openingDate: today,
        businessAddress: '',
        headOfficeAddress: '',
        businessCategory: '사업지원및임대서비스업',
        businessItem: '고소작업대임대',
        tel: '',
        fax: '',
        salesPhone: '',
        taxEmail: '',
        taxOffice: '',
        websiteUrl: '',
        ciUrl: '',
        logoUrl: '',
        stampImageUrl: OFFICIAL_STAMP_BASE64,
        status: 'ACTIVE',
        isDefault: false,
        allowCustomBillingStatement: false,
        allowedPages: allMenuIds,
        hiddenPages: [],
        subscription: {
          plan: 'STANDARD',
          status: 'ACTIVE',
          startDate: today,
          endDate: nextYear,
          gracePeriodDays: 7,
          billingCycle: 'MONTHLY',
          monthlyFee: 500000,
          autoRenew: true,
          maxAssets: 0,
          maxUsers: 0,
          licenseKey: `EBR-NEW-${Date.now().toString(36).toUpperCase()}`,
          memo: '신규 테넌트 표준 라이선스 발급',
        },
        features: {
          telegramBot: true,
          callRecordingStt: true,
          kakaoContract: true,
          autoTaxInvoice: true,
          voiceAssistance: true,
          agentAiEnabled: false,
          customDomain: '',
        },
        bankAccounts: [
          {
            bankName: '국민은행',
            accountNumber: '',
            accountHolder: '',
            isDefault: true,
          }
        ],
        yards: [
          {
            id: `yard-${Date.now()}`,
            yardCode: 'YARD-01',
            name: '제1 주기장',
            isDefault: true,
            address: '',
            operatingCapacity: 100,
            createdAt: new Date().toISOString(),
          }
        ],
        workplaces: [],
      });
    }
    setIsModalOpen(true);
  };

  // ── 서식 관리 (TEMPLATES) 핸들러 ──
  const handleDownloadTemplate = () => {
    const code = formData.tenantCode || 'GIYEUN';
    const custom = getTenantTemplate(code, selectedDocType);
    const content = custom || getDefaultTemplate(selectedDocType);
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${code}_${selectedDocType}_TEMPLATE.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUploadTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const code = formData.tenantCode || 'GIYEUN';
        saveTenantTemplate(code, selectedDocType, content);
        setTemplateVersion(v => v + 1);
        setTemplateSuccessMsg('맞춤 서식이 성공적으로 적용되었습니다.');
        setTimeout(() => setTemplateSuccessMsg(''), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetTemplate = () => {
    const code = formData.tenantCode || 'GIYEUN';
    resetTenantTemplate(code, selectedDocType);
    setTemplateVersion(v => v + 1);
    setTemplateSuccessMsg('기본 서식으로 복원되었습니다.');
    setTimeout(() => setTemplateSuccessMsg(''), 3000);
  };

  // ── 서식 실시간 미리보기 HTML 계산 ──
  const previewHtml = useMemo(() => {
    const currentCode = formData.tenantCode || 'GIYEUN';
    const previewPayload: TemplateDataPayload = {
      ...SAMPLE_TEMPLATE_PAYLOAD,
      tenant: {
        ...SAMPLE_TEMPLATE_PAYLOAD.tenant,
        tenantCode: currentCode,
        corporateName: formData.corporateName || formData.displayName || '(주)기연리프트',
        tradeName: formData.tradeName || formData.displayName || '(주)기연리프트',
        businessNumber: formData.businessNumber || '138-81-83251',
        representativeName: formData.representativeName || '이정용',
        businessAddress: formData.businessAddress || '경기도 화성시 남양읍 시청로 123',
        tel: formData.tel || '031-334-5295',
        fax: formData.fax || '031-335-5297',
        taxEmail: formData.taxEmail || 'admin@giyeun.co.kr',
        stampImageUrl: formData.stampImageUrl || OFFICIAL_STAMP_BASE64,
        displayName: formData.displayName || '기연리프트',
        bankAccounts: formData.bankAccounts && formData.bankAccounts.length > 0 ? formData.bankAccounts : undefined
      }
    };
    return renderTemplateToHtml(selectedDocType, previewPayload, currentCode);
  }, [selectedDocType, templateVersion, formData.tenantCode, formData.corporateName, formData.displayName, formData.tradeName, formData.businessNumber, formData.representativeName, formData.businessAddress, formData.tel, formData.fax, formData.taxEmail, formData.stampImageUrl, formData.bankAccounts]);

  // ── 사업자등록증 온보딩 핸들러 ──
  const applyLicenseResultToForm = (result: BusinessLicenseAnalysisResult) => {
    const rawName = result.companyName || '신규테넌트';
    const cleanName = rawName.replace(/주식회사|\(주\)|\(유\)/g, '').trim() || rawName;
    const genCode = (cleanName.replace(/[^a-zA-Z0-9]/g, '') || 'TENANT').toUpperCase().slice(0, 10);
    const sub = genCode.toLowerCase();

    handleOpenModal();
    setFormData(prev => ({
      ...prev,
      corporateName: rawName,
      tradeName: rawName,
      displayName: cleanName,
      tenantCode: genCode,
      subdomain: sub,
      businessNumber: formatBizRegNo(result.bizRegNo || ''),
      representativeName: result.representative || '',
      openingDate: result.openingDate || new Date().toISOString().slice(0, 10),
      businessAddress: result.address || '',
      headOfficeAddress: result.headOfficeAddress || result.address || '',
      businessCategory: result.bizType || '사업지원및임대서비스업',
      businessItem: result.bizItem || '고소작업대임대',
      taxEmail: result.taxEmail || '',
      tel: result.repContact || '',
      taxOffice: result.taxOffice || '',
      solutionType: 'AWP',
      targetRepo: 'DragonRPA/ebro_awp'
    }));
    setIsOnboardingModalOpen(false);
  };

  const handleLicenseFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsAnalyzingLicense(true);
    setOnboardingError('');
    try {
      const result = await analyzeBusinessLicense(file);
      if (result && result.success) {
        applyLicenseResultToForm(result);
      } else {
        setOnboardingError(result.error || '사업자등록증 정보 추출에 실패했습니다. 데모 샘플 데이터 입력을 사용하거나 직접 입력해 주세요.');
      }
    } catch (err: any) {
      setOnboardingError(err?.message || '사업자등록증 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzingLicense(false);
      e.target.value = '';
    }
  };

  const handleDemoLicenseOnboarding = () => {
    applyLicenseResultToForm({
      success: true,
      companyName: '주식회사 미래렌탈',
      representative: '김미래',
      bizRegNo: '211-88-76543',
      openingDate: '2021-05-10',
      address: '경기도 화성시 향남읍 발안공단로 150',
      headOfficeAddress: '경기도 화성시 향남읍 발안공단로 150',
      bizType: '사업지원및임대서비스업',
      bizItem: '고소작업대임대',
      taxEmail: 'tax@miraerental.com',
      repContact: '031-8059-1234',
      taxOffice: '화성세무서'
    });
  };

  // ── 페이지 노출/숨김 판정 및 제어 헬퍼 ──
  const allSystemMenuIds = useMemo(() => getAllSystemMenuIds(), []);

  const isPageVisible = (pageId: string): boolean => {
    const hidden = formData.hiddenPages || [];
    if (hidden.includes(pageId)) return false;
    const allowed = formData.allowedPages || [];
    if (allowed.length > 0 && !allowed.includes(pageId)) return false;
    return true;
  };

  const handleTogglePageVisibility = (pageId: string) => {
    if (pageId === 'dashboard' || pageId === 'tenant_management') return;
    const currentlyVisible = isPageVisible(pageId);

    const currentVisibleSet = new Set<string>();
    allSystemMenuIds.forEach(id => {
      if (isPageVisible(id)) currentVisibleSet.add(id);
    });

    if (currentlyVisible) {
      currentVisibleSet.delete(pageId);
    } else {
      currentVisibleSet.add(pageId);
    }

    const newAllowed = Array.from(currentVisibleSet);
    const newHidden = allSystemMenuIds.filter(id => !currentVisibleSet.has(id));

    setFormData(prev => ({
      ...prev,
      allowedPages: newAllowed,
      hiddenPages: newHidden
    }));
  };

  const handleShowAllPages = () => {
    setFormData(prev => ({
      ...prev,
      allowedPages: allSystemMenuIds,
      hiddenPages: []
    }));
  };

  const handleHideAllPages = () => {
    setFormData(prev => ({
      ...prev,
      allowedPages: ['dashboard', 'tenant_management'],
      hiddenPages: allSystemMenuIds.filter(id => id !== 'dashboard' && id !== 'tenant_management')
    }));
  };

  const handleSetCorePagesOnly = () => {
    const coreIds = [
      'approvalInbox', 'approvalRules',
      'customer', 'contract', 'billing', 'custom_billing', 'receivable', 'smart_dispatch4', 'smart_return', 'smart_as_request',
      'product', 'asset', 'acquisition_disposal', 'rent_asset',
      'delivery', 'transport_master',
      'daily_inout', 'asset_inout_history', 'dispatch_assign', 'outbound_inspections',
      'repair', 'inspection_checklist_manage',
      'operations_manual', 'error_report', 'organization', 'permission', 'tenant_management'
    ];
    const allowed = allSystemMenuIds.filter(id => coreIds.includes(id));
    const hidden = allSystemMenuIds.filter(id => !coreIds.includes(id));
    setFormData(prev => ({
      ...prev,
      allowedPages: allowed,
      hiddenPages: hidden
    }));
  };

  const handleToggleGroupVisibility = (groupId: string, show: boolean) => {
    const grp = SYSTEM_MENU_CONFIG.find(g => g.id === groupId);
    if (!grp) return;
    const grpItemIds = grp.items.map(i => i.id).filter(id => id !== 'dashboard' && id !== 'tenant_management');

    const currentVisibleSet = new Set<string>();
    allSystemMenuIds.forEach(id => {
      if (isPageVisible(id)) currentVisibleSet.add(id);
    });

    grpItemIds.forEach(id => {
      if (show) {
        currentVisibleSet.add(id);
      } else {
        currentVisibleSet.delete(id);
      }
    });

    const newAllowed = Array.from(currentVisibleSet);
    const newHidden = allSystemMenuIds.filter(id => !currentVisibleSet.has(id));

    setFormData(prev => ({
      ...prev,
      allowedPages: newAllowed,
      hiddenPages: newHidden
    }));
  };

  const formPageStats = useMemo(() => {
    let visible = 0;
    allSystemMenuIds.forEach(id => {
      if (isPageVisible(id)) visible++;
    });
    return {
      total: allSystemMenuIds.length,
      visible,
      hidden: allSystemMenuIds.length - visible
    };
  }, [allSystemMenuIds, formData.allowedPages, formData.hiddenPages]);

  // ── 구독 빠른 기간 연장 헬퍼 ──
  const handleExtendSubscription = (months: number) => {
    setFormData(prev => {
      const sub = prev.subscription || {
        plan: 'STANDARD',
        status: 'ACTIVE',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        gracePeriodDays: 7,
        billingCycle: 'MONTHLY',
        monthlyFee: 500000,
        autoRenew: true,
        maxAssets: 0,
        maxUsers: 0,
        licenseKey: '',
        memo: '',
      };
      const currentEnd = new Date(sub.endDate || new Date().toISOString().slice(0, 10));
      const baseDate = currentEnd.getTime() < Date.now() ? new Date() : currentEnd;
      baseDate.setMonth(baseDate.getMonth() + months);
      const newEndDate = baseDate.toISOString().slice(0, 10);
      return {
        ...prev,
        status: 'ACTIVE',
        subscription: {
          ...sub,
          endDate: newEndDate,
          status: 'ACTIVE',
        }
      };
    });
  };

  // ── 보안 라이선스 키 자동 생성 헬퍼 ──
  const handleGenerateLicenseKey = () => {
    const code = formData.tenantCode?.trim().toUpperCase() || 'TENANT';
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const endYear = (formData.subscription?.endDate || '2026-12-31').replace(/-/g, '').slice(0, 8);
    const newKey = `EBR-${code}-${endYear}-${rand}`;
    setFormData(prev => ({
      ...prev,
      subscription: {
        ...(prev.subscription as any),
        licenseKey: newKey
      }
    }));
  };

  // ── 이미지 파일 Base64 변환 ──
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'ciUrl' | 'stampImageUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFormData(prev => ({
        ...prev,
        [field]: base64,
        ...(field === 'ciUrl' ? { logoUrl: base64 } : {})
      }));
    };
    reader.readAsDataURL(file);
  };

  // ── 저장 실행 ──
  const handleSave = async () => {
    if (!formData.tenantCode?.trim()) {
      showErrorModal('테넌트 영문 코드를 입력하십시오. (예: HANSOL, SAMWOO)');
      return;
    }
    if (!formData.displayName?.trim()) {
      showErrorModal('표시 상호명을 입력하십시오. (예: 기연리프트, 한솔렌탈)');
      return;
    }
    if (!formData.businessNumber?.trim()) {
      showErrorModal('사업자등록번호를 입력하십시오.');
      return;
    }

    const cleanCode = formData.tenantCode.trim().toUpperCase();
    const cleanSubdomain = (formData.subdomain?.trim() || cleanCode).toLowerCase();

    // 중복 코드 검사
    const isCodeDuplicated = (tenants || []).some(t => 
      t.id !== editingTenant?.id && 
      (t.tenantCode.toUpperCase() === cleanCode || (t.subdomain || '').toLowerCase() === cleanSubdomain)
    );
    if (isCodeDuplicated) {
      showErrorModal('이미 등록된 테넌트 코드 또는 서브도메인입니다.');
      return;
    }

    try {
      setIsSaving(true);
      const tenantToSave: Partial<Tenant> = {
        ...formData,
        tenantCode: cleanCode,
        subdomain: cleanSubdomain,
        displayName: formData.displayName?.trim() || cleanCode,
        corporateName: formData.corporateName?.trim() || formData.displayName?.trim() || cleanCode,
        tradeName: formData.tradeName?.trim() || formData.displayName?.trim() || cleanCode,
        systemName: formData.systemName || 'e-Bro System',
        updatedAt: new Date().toISOString(),
      };

      if (editingTenant) {
        tenantToSave.id = editingTenant.id;
      } else {
        tenantToSave.id = `tenant-${cleanCode.toLowerCase()}-${Date.now()}`;
        tenantToSave.createdAt = new Date().toISOString();
      }

      // 기본 테넌트 지정 시 다른 테넌트 해제
      if (tenantToSave.isDefault) {
        (tenants || []).forEach(t => {
          if (t.id !== tenantToSave.id && t.isDefault) {
            saveTenant({ id: t.id, isDefault: false });
          }
        });
      }

      await saveTenant(tenantToSave);

      // GoogleConfig에 R2 설정 저장/업데이트
      const targetTenantId = tenantToSave.id!;
      const existingConfig = db.googleConfigs.find(c => c.tenantId === targetTenantId);
      if (existingConfig) {
        db.updateRow<GoogleConfig>('googleConfigs', existingConfig.id, {
          ...r2Config,
          updatedAt: new Date().toISOString()
        });
      } else {
        db.insertRow<GoogleConfig>('googleConfigs', {
          id: db.generateNextId('googleConfigs', db.googleConfigs),
          tenantId: targetTenantId,
          googleEmail: '',
          contractFolder: '',
          consumableFolder: '',
          deliveryFolder: '',
          maintenanceFolder: '',
          isDevMode: false,
          ...r2Config,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      await db.awaitPendingWrites();

      setIsModalOpen(false);
      setEditingTenant(null);
    } catch (err: any) {
      showErrorModal(`테넌트 저장 실패: ${err?.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // ── 테넌트 삭제 실행 ──
  const handleDelete = async (tenant: Tenant) => {
    if (tenant.isDefault) {
      showErrorModal('기본 테넌트는 삭제할 수 없습니다. 다른 테넌트를 기본으로 지정한 후 삭제하십시오.');
      return;
    }
    if (!window.confirm(`[${tenant.displayName}] 테넌트를 시스템에서 삭제하시겠습니까?`)) {
      return;
    }
    try {
      await deleteTenant(tenant.id);
    } catch (err: any) {
      showErrorModal(`삭제 실패: ${err?.message || err}`);
    }
  };

  // ── 기본 테넌트 지정 ──
  const handleSetDefault = async (tenant: Tenant) => {
    if (tenant.isDefault) return;
    try {
      // 1. 기존 디폴트 해제
      for (const t of tenants) {
        if (t.id !== tenant.id && t.isDefault) {
          await saveTenant({ id: t.id, isDefault: false });
        }
      }
      // 2. 신규 디폴트 설정
      await saveTenant({ id: tenant.id, isDefault: true });
    } catch (err: any) {
      showErrorModal(`기본 테넌트 변경 실패: ${err?.message || err}`);
    }
  };

  // ── 테넌트 즉시 전환 ──
  const handleSwitchTenant = (tenant: Tenant) => {
    setCurrentTenantId(tenant.id);
  };

  // ── 엑셀 내보내기 ──
  const handleExportExcel = () => {
    const exportData = filteredTenants.map(t => {
      const hiddenCount = Array.isArray(t.hiddenPages) ? t.hiddenPages.length : 0;
      const isCustom = (t.allowedPages && t.allowedPages.length > 0) || hiddenCount > 0;
      const visibleCount = isCustom
        ? (t.allowedPages && t.allowedPages.length > 0
            ? t.allowedPages.filter(id => !t.hiddenPages?.includes(id)).length
            : allSystemMenuIds.length - hiddenCount)
        : allSystemMenuIds.length;

      return {
        '테넌트코드': t.tenantCode,
        '표시상호': t.displayName,
        '법인명': t.corporateName,
        '서브도메인': `${t.subdomain || t.tenantCode.toLowerCase()}.ebro.run`,
        '사업자번호': t.businessNumber,
        '대표자': t.representativeName,
        '대표전화': t.tel,
        '세무이메일': t.taxEmail,
        '본사주소': t.businessAddress,
        '기본테넌트': t.isDefault ? '기본' : '일반',
        '노출페이지수': `${visibleCount}/${allSystemMenuIds.length}`,
        '상태': t.status === 'ACTIVE' ? '가동' : t.status === 'SUSPENDED' ? '정지' : '해지',
        '등록일자': (t.createdAt || '').slice(0, 10),
      };
    });
    exportToExcel(exportData, '테넌트목록대장');
  };

  return (
    <div data-hs-observe="tenantmanagementpage" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%', gap: '16px', overflowY: 'auto' }}>
      
      {/* ── 1. 상단 바: 좌상단 스코프 & 우상단 파이프라인 (Gutenberg Z-Pattern) ── */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '12px',
        backgroundColor: 'var(--bg-card)',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        {/* 좌상단: 조회 조건 (검색어 + 상태 필터) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={20} color="var(--primary)" />
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              테넌트 관리
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <input
                data-mid="tenant-scope-search"
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="테넌트명, 코드, 사업자번호, 서브도메인"
                style={{
                  padding: '7px 12px 7px 32px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  width: '280px',
                }}
              />
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
            </div>

            <div data-mid="tenant-scope-status" style={{ display: 'flex', backgroundColor: 'var(--bg-app)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: statusFilter === 'ALL' ? 'var(--primary)' : 'transparent',
                  color: statusFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                전체 ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('ACTIVE')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: statusFilter === 'ACTIVE' ? 'var(--primary)' : 'transparent',
                  color: statusFilter === 'ACTIVE' ? '#ffffff' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                가동 ({counts.active})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('EXPIRING_SOON')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: statusFilter === 'EXPIRING_SOON' ? '#b45309' : 'transparent',
                  color: statusFilter === 'EXPIRING_SOON' ? '#ffffff' : '#b45309',
                  whiteSpace: 'nowrap',
                }}
              >
                만료임박 ({counts.expiring})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('EXPIRED')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: statusFilter === 'EXPIRED' ? '#dc2626' : 'transparent',
                  color: statusFilter === 'EXPIRED' ? '#ffffff' : '#dc2626',
                  whiteSpace: 'nowrap',
                }}
              >
                만료 ({counts.expired})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('SUSPENDED')}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: statusFilter === 'SUSPENDED' ? '#6b7280' : 'transparent',
                  color: statusFilter === 'SUSPENDED' ? '#ffffff' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                정지 ({counts.suspended})
              </button>
            </div>
          </div>
        </div>

        {/* 우상단: 데이터 유입 및 완결 액션 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            data-mid="tenant-pipeline-excel"
            type="button"
            onClick={handleExportExcel}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            <Download size={14} />
            <span>엑셀 내보내기</span>
          </button>

          <button data-hs-trigger="Register"
            data-mid="tenant-pipeline-onboard"
            type="button"
            onClick={() => setIsOnboardingModalOpen(true)}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              backgroundColor: '#ecfdf5',
              borderColor: '#6ee7b7',
              color: '#047857',
            }}
          >
            <FileText size={14} />
            <span>사업자등록증 온보딩</span>
          </button>

          <button data-hs-trigger="Register"
            data-mid="tenant-pipeline-add"
            type="button"
            onClick={() => handleOpenModal()}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 800,
              whiteSpace: 'nowrap',
            }}
          >
            <Plus size={15} />
            <span>테넌트 등록</span>
          </button>
        </div>
      </div>

      {/* ── 2. 중앙 본문: 고밀도 그리드 테이블 (Inspection) ── */}
      <div data-mid="tenant-inspection-grid" style={{
        flex: 1,
        backgroundColor: 'var(--bg-card)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ overflowX: 'auto', flex: 1 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ 
                backgroundColor: 'var(--bg-app)', 
                borderBottom: '2px solid var(--border-color)',
                color: 'var(--text-muted)',
                fontWeight: 700,
                height: '42px'
              }}>
                <th style={{ padding: '8px 14px', whiteSpace: 'nowrap', width: '130px' }}>관리 조치</th>
                <th style={{ padding: '8px 14px', whiteSpace: 'nowrap', width: '80px' }}>상태</th>
                <th style={{ padding: '8px 14px', whiteSpace: 'nowrap', width: '90px' }}>솔루션</th>
                <th style={{ padding: '8px 14px', whiteSpace: 'nowrap', width: '100px' }}>테넌트 코드</th>
                <th style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>표시 상호 / 법인명</th>
                <th style={{ padding: '8px 14px', whiteSpace: 'nowrap', width: '190px' }}>구독 플랜 & 만료일</th>
                <th style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>서브도메인 URL</th>
                <th style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>사업자번호</th>
                <th style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>대표자</th>
                <th style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>브랜드 에셋</th>
                <th style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>라이선스 플러그인</th>
                <th style={{ padding: '8px 14px', whiteSpace: 'nowrap', width: '130px' }}>노출 페이지</th>
                <th style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>대표 연락처</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={13} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    일치하는 테넌트 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filteredTenants.map(tenant => {
                  const isCurrentActive = currentTenant?.id === tenant.id;
                  const subdomain = tenant.subdomain || tenant.tenantCode.toLowerCase();
                  const fullUrl = `https://${subdomain}.ebro.run`;

                  return (
                    <tr 
                      key={tenant.id}
                      style={{ 
                        borderBottom: '1px solid var(--border-color)',
                        height: '46px',
                        backgroundColor: isCurrentActive ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                        transition: 'background-color 0.15s'
                      }}
                    >
                      {/* 관리 조치 (첫 번째 컬럼 좌측 고정 표준) */}
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenModal(tenant)}
                            title="테넌트 정보 수정"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-app)',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Edit2 size={12} />
                            <span>편집</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSwitchTenant(tenant)}
                            disabled={isCurrentActive}
                            title="현재 브라우저 세션을 이 테넌트 브랜드로 전환"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: isCurrentActive ? '1px solid #10b981' : '1px solid var(--border-color)',
                              backgroundColor: isCurrentActive ? '#10b981' : 'var(--bg-app)',
                              color: isCurrentActive ? '#ffffff' : 'var(--text-primary)',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: isCurrentActive ? 'default' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {isCurrentActive ? <Check size={12} /> : <RefreshCw size={12} />}
                            <span>{isCurrentActive ? '접속중' : '전환'}</span>
                          </button>

                          {!tenant.isDefault && (
                            <button data-hs-trigger="Delete"
                              type="button"
                              onClick={() => handleDelete(tenant)}
                              title="테넌트 삭제"
                              style={{
                                padding: '4px 6px',
                                borderRadius: '6px',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                backgroundColor: 'transparent',
                                color: '#ef4444',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 상태 & 기본 여부 */}
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{
                            padding: '2px 7px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 800,
                            backgroundColor: tenant.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
                            color: tenant.status === 'ACTIVE' ? '#166534' : '#991b1b',
                          }}>
                            {tenant.status === 'ACTIVE' ? '가동' : '정지'}
                          </span>
                          {tenant.isDefault && (
                            <span 
                              title="시스템 기본 테넌트"
                              style={{
                                padding: '2px 6px',
                                borderRadius: '12px',
                                fontSize: '10px',
                                fontWeight: 800,
                                backgroundColor: '#fef3c7',
                                color: '#b45309',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}
                            >
                              <Star size={9} fill="#b45309" />
                              기본
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 솔루션 배지 */}
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const sType = tenant.solutionType || 'AWP';
                          const badgeConfig = {
                            AWP: { bg: '#dbeafe', color: '#1d4ed8', label: 'AWP' },
                            IT: { bg: '#f3e8ff', color: '#7e22ce', label: 'IT' },
                            MULTI: { bg: '#d1fae5', color: '#047857', label: 'MULTI' },
                          }[sType] || { bg: '#dbeafe', color: '#1d4ed8', label: 'AWP' };

                          return (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontSize: '11px',
                              fontWeight: 800,
                              backgroundColor: badgeConfig.bg,
                              color: badgeConfig.color,
                              letterSpacing: '0.025em',
                              whiteSpace: 'nowrap'
                            }}>
                              {badgeConfig.label}
                            </span>
                          );
                        })()}
                      </td>

                      {/* 테넌트 코드 */}
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', fontWeight: 800, fontFamily: 'monospace', color: 'var(--primary)' }}>
                        {tenant.tenantCode}
                      </td>

                      {/* 표시 상호 / 법인명 */}
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{tenant.displayName}</span>
                          <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{tenant.corporateName || '-'}</span>
                        </div>
                      </td>

                      {/* 구독 플랜 & 만료일 (D-Day) */}
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const subInfo = getTenantSubscriptionInfo(tenant);
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '10.5px',
                                  fontWeight: 800,
                                  backgroundColor: subInfo.plan === 'ENTERPRISE' ? '#ede9fe' : subInfo.plan === 'PRO' ? '#e0f2fe' : subInfo.plan === 'TRIAL' ? '#fef3c7' : '#f3f4f6',
                                  color: subInfo.plan === 'ENTERPRISE' ? '#6d28d9' : subInfo.plan === 'PRO' ? '#0369a1' : subInfo.plan === 'TRIAL' ? '#b45309' : '#374151',
                                  border: '1px solid rgba(0,0,0,0.06)'
                                }}>
                                  {subInfo.plan}
                                </span>
                                <span style={{
                                  padding: '1px 7px',
                                  borderRadius: '12px',
                                  fontSize: '10.5px',
                                  fontWeight: 800,
                                  backgroundColor: subInfo.badgeBg,
                                  color: subInfo.badgeColor,
                                }}>
                                  {subInfo.label}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span>{tenant.subscription?.endDate || '무제한'}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenModal(tenant, 'SUBSCRIPTION');
                                  }}
                                  style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'var(--primary)',
                                    fontWeight: 700,
                                    fontSize: '11px',
                                    cursor: 'pointer',
                                    padding: 0,
                                    textDecoration: 'underline'
                                  }}
                                >
                                  연장
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </td>

                      {/* 서브도메인 URL */}
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            color: '#2563eb',
                            textDecoration: 'none',
                            fontWeight: 600,
                            fontFamily: 'monospace'
                          }}
                        >
                          <Globe size={13} />
                          <span>{subdomain}.ebro.run</span>
                          <ExternalLink size={11} />
                        </a>
                      </td>

                      {/* 사업자번호 */}
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                        {tenant.businessNumber || '-'}
                      </td>

                      {/* 대표자 */}
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                        {tenant.representativeName || '-'}
                      </td>

                      {/* 브랜드 에셋 (CI 및 직인 등록 상태) */}
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {tenant.ciUrl || tenant.logoUrl ? (
                            <img 
                              src={tenant.ciUrl || tenant.logoUrl} 
                              alt="CI" 
                              style={{ height: '22px', maxWidth: '60px', objectFit: 'contain' }}
                            />
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>CI 미등록</span>
                          )}

                          {tenant.stampImageUrl ? (
                            <img 
                              src={tenant.stampImageUrl} 
                              alt="직인" 
                              title="법인 직인 등록됨"
                              style={{ width: '22px', height: '22px', objectFit: 'contain' }}
                            />
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>직인 미등록</span>
                          )}
                        </div>
                      </td>

                      {/* 라이선스 플러그인 뱃지 */}
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span 
                            title={`eBro AI 에이전트: ${tenant.features?.agentAiEnabled ? 'Full AI 활성 (메신저·확장 제어)' : 'Silent Core (인쇄·엑셀 전용)'}`}
                            style={{ 
                              padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 800,
                              backgroundColor: tenant.features?.agentAiEnabled ? '#dbeafe' : 'var(--bg-app)',
                              color: tenant.features?.agentAiEnabled ? '#1d4ed8' : 'var(--text-muted)',
                              border: `1px solid ${tenant.features?.agentAiEnabled ? '#bfdbfe' : 'var(--border-color)'}`
                            }}
                          >
                            {tenant.features?.agentAiEnabled ? 'AI활성' : 'AI잠금'}
                          </span>
                          <span 
                            title={`텔레그램 제어: ${tenant.features?.telegramBot ? '활성' : '미사용'}`}
                            style={{ 
                              padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700,
                              backgroundColor: tenant.features?.telegramBot ? '#e0f2fe' : 'var(--bg-app)',
                              color: tenant.features?.telegramBot ? '#0369a1' : 'var(--text-muted)',
                              border: '1px solid var(--border-color)'
                            }}
                          >
                            텔레그램
                          </span>
                          <span 
                            title={`음성 STT: ${tenant.features?.callRecordingStt ? '활성' : '미사용'}`}
                            style={{ 
                              padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700,
                              backgroundColor: tenant.features?.callRecordingStt ? '#f3e8ff' : 'var(--bg-app)',
                              color: tenant.features?.callRecordingStt ? '#7e22ce' : 'var(--text-muted)',
                              border: '1px solid var(--border-color)'
                            }}
                          >
                            음성STT
                          </span>
                          <span 
                            title={`카카오 계약: ${tenant.features?.kakaoContract ? '활성' : '미사용'}`}
                            style={{ 
                              padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700,
                              backgroundColor: tenant.features?.kakaoContract ? '#fef9c3' : 'var(--bg-app)',
                              color: tenant.features?.kakaoContract ? '#854d0e' : 'var(--text-muted)',
                              border: '1px solid var(--border-color)'
                            }}
                          >
                            카카오
                          </span>
                          <span 
                            title={`세무 자동연동: ${tenant.features?.autoTaxInvoice ? '활성' : '미사용'}`}
                            style={{ 
                              padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 700,
                              backgroundColor: tenant.features?.autoTaxInvoice ? '#dcfce7' : 'var(--bg-app)',
                              color: tenant.features?.autoTaxInvoice ? '#166534' : 'var(--text-muted)',
                              border: '1px solid var(--border-color)'
                            }}
                          >
                            세무
                          </span>
                        </div>
                      </td>

                      {/* 노출 페이지 */}
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>
                        {(() => {
                          const hiddenCount = Array.isArray(tenant.hiddenPages) ? tenant.hiddenPages.length : 0;
                          const isCustom = (tenant.allowedPages && tenant.allowedPages.length > 0) || hiddenCount > 0;
                          const visibleCount = isCustom
                            ? (tenant.allowedPages && tenant.allowedPages.length > 0
                                ? tenant.allowedPages.filter(id => !tenant.hiddenPages?.includes(id)).length
                                : allSystemMenuIds.length - hiddenCount)
                            : allSystemMenuIds.length;

                          return (
                            <button
                              type="button"
                              onClick={() => handleOpenModal(tenant, 'PAGES')}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 700,
                                border: '1px solid var(--border-color)',
                                backgroundColor: hiddenCount > 0 ? '#fef3c7' : 'var(--bg-app)',
                                color: hiddenCount > 0 ? '#92400e' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="페이지 노출 관리 설정 열기"
                            >
                              <Eye size={12} />
                              <span>{visibleCount}/{allSystemMenuIds.length} ({hiddenCount > 0 ? `${hiddenCount}개 숨김` : '전체 노출'})</span>
                            </button>
                          );
                        })()}
                      </td>

                      {/* 대표 연락처 */}
                      <td style={{ padding: '8px 14px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {tenant.tel || tenant.salesPhone || '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 3. 최하단 바: 검증식 및 터미널 요약 배너 (Gutenberg 우하단 Terminal Action) ── */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-app)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '12.5px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)' }}>
            <span>등록 테넌트: <strong style={{ color: 'var(--text-primary)' }}>{counts.total}</strong>개사</span>
            <span>가동: <strong style={{ color: '#16a34a' }}>{counts.active}</strong>개사</span>
            <span>만료임박: <strong style={{ color: '#d97706' }}>{counts.expiring}</strong>개사</span>
            <span>만료: <strong style={{ color: '#dc2626' }}>{counts.expired}</strong>개사</span>
            <span>정지: <strong style={{ color: '#6b7280' }}>{counts.suspended}</strong>개사</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: 'var(--text-muted)' }}>현재 세션 테넌트:</span>
            <span style={{ 
              backgroundColor: 'var(--primary)', 
              color: '#ffffff', 
              padding: '3px 10px', 
              borderRadius: '6px', 
              fontWeight: 800,
              fontSize: '12px'
            }}>
              {currentTenant?.displayName} ({currentTenant?.tenantCode})
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. 테넌트 등록/수정 모달 다이얼로그 ── */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '14px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* 모달 헤더 */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-app)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={18} color="var(--primary)" />
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {editingTenant ? `테넌트 수정 [${editingTenant.displayName}]` : '신규 테넌트 개설'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 모달 탭 바 (무수식어 건조 표준) */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-app)',
              padding: '0 16px'
            }}>
              {[
                { key: 'BASIC', label: '기본 정보' },
                { key: 'SUBSCRIPTION', label: '구독 및 라이선스' },
                { key: 'BRAND', label: '브랜드 및 직인' },
                { key: 'BANKS_YARDS', label: '계좌 및 주기장' },
                { key: 'PLUGINS', label: '플러그인 설정' },
                { key: 'PAGES', label: '페이지 노출 관리' },
                { key: 'AGENTS', label: '에이전트 관제' },
                { key: 'TEMPLATES', label: '서식 관리' },
                { key: 'INITIAL_DB', label: '초기 DB 업로드' },
                { key: 'STORAGE', label: '스토리지 설정' },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setModalTab(tab.key as any)}
                  style={{
                    padding: '12px 18px',
                    border: 'none',
                    borderBottom: modalTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                    backgroundColor: 'transparent',
                    color: modalTab === tab.key ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: modalTab === tab.key ? 800 : 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 모달 본문 (세로 스택 표준: flex-direction column, gap 4px) */}
            <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* ── 탭 1: 기본 정보 ── */}
              {modalTab === 'BASIC' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {/* 테넌트 영문 코드 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      테넌트 영문 코드 *
                    </label>
                    <input
                      type="text"
                      value={formData.tenantCode || ''}
                      onChange={e => setFormData(prev => ({ ...prev, tenantCode: e.target.value.toUpperCase() }))}
                      placeholder="예: HANSOL, SAMWOO"
                      disabled={Boolean(editingTenant?.isDefault)}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace' }}
                    />
                  </div>

                  {/* 전용 서브도메인 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      전용 서브도메인 (*.ebro.run) *
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <input
                        type="text"
                        value={formData.subdomain || ''}
                        onChange={e => setFormData(prev => ({ ...prev, subdomain: e.target.value.toLowerCase() }))}
                        placeholder={formData.tenantCode?.toLowerCase() || 'hansol'}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace' }}
                      />
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>.ebro.run</span>
                    </div>
                    {/* MULTI 선택 시 듀얼 도메인 배지 */}
                    {formData.solutionType === 'MULTI' && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: '#dbeafe',
                          color: '#1d4ed8',
                          fontFamily: 'monospace'
                        }}>
                          {formData.subdomain || formData.tenantCode?.toLowerCase() || 'subdomain'}.awp.ebro.run
                        </span>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: '#f3e8ff',
                          color: '#7e22ce',
                          fontFamily: 'monospace'
                        }}>
                          {formData.subdomain || formData.tenantCode?.toLowerCase() || 'subdomain'}.it.ebro.run
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 솔루션 업종 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      솔루션 업종
                    </label>
                    <select
                      value={formData.solutionType || 'AWP'}
                      onChange={e => {
                        const sType = e.target.value as SolutionType;
                        const defaultRepo = sType === 'AWP' ? 'DragonRPA/ebro_awp' : sType === 'IT' ? 'DragonRPA/ebro_it' : (formData.targetRepo || 'DragonRPA/ebro_awp');
                        setFormData(prev => ({ 
                          ...prev, 
                          solutionType: sType,
                          targetRepo: prev.targetRepo || defaultRepo
                        }));
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-app)',
                        color: 'var(--text-primary)',
                        fontSize: '13px'
                      }}
                    >
                      <option value="AWP">AWP (고소작업대)</option>
                      <option value="IT">IT (IT 인프라/장비)</option>
                      <option value="MULTI">MULTI (복합 사업군)</option>
                    </select>
                  </div>

                  {/* 연동 깃허브 레포지토리 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      연동 깃허브 레포지토리
                    </label>
                    <input
                      type="text"
                      value={formData.targetRepo || ''}
                      onChange={e => setFormData(prev => ({ ...prev, targetRepo: e.target.value }))}
                      placeholder="예: DragonRPA/ebro_awp 또는 DragonRPA/ebro_it"
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-app)',
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        fontFamily: 'monospace'
                      }}
                    />
                  </div>

                  {/* 시스템 표출 상호 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      표시 상호 (브랜드명) *
                    </label>
                    <input
                      type="text"
                      value={formData.displayName || ''}
                      onChange={e => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                      placeholder="예: 한솔렌탈"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                  </div>

                  {/* 정식 법인명 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      정식 법인명 *
                    </label>
                    <input
                      type="text"
                      value={formData.corporateName || ''}
                      onChange={e => setFormData(prev => ({ ...prev, corporateName: e.target.value }))}
                      placeholder="예: 주식회사 한솔렌탈"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                  </div>

                  {/* 사업자등록번호 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      사업자등록번호 *
                    </label>
                    <input
                      type="text"
                      value={formData.businessNumber || ''}
                      onChange={e => setFormData(prev => ({ ...prev, businessNumber: e.target.value }))}
                      placeholder="000-00-00000"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace' }}
                    />
                  </div>

                  {/* 법인등록번호 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      법인등록번호
                    </label>
                    <input
                      type="text"
                      value={formData.corporateRegistrationNumber || ''}
                      onChange={e => setFormData(prev => ({ ...prev, corporateRegistrationNumber: e.target.value }))}
                      placeholder="000000-0000000"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace' }}
                    />
                  </div>

                  {/* 대표자명 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      대표자 성명 *
                    </label>
                    <input
                      type="text"
                      value={formData.representativeName || ''}
                      onChange={e => setFormData(prev => ({ ...prev, representativeName: e.target.value }))}
                      placeholder="예: 홍길동"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                  </div>

                  {/* 개업연월일 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      개업연월일
                    </label>
                    <input
                      type="date"
                      value={formData.openingDate || ''}
                      onChange={e => setFormData(prev => ({ ...prev, openingDate: e.target.value }))}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                  </div>

                  {/* 대표 전화번호 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      대표 전화번호
                    </label>
                    <input
                      type="text"
                      value={formData.tel || ''}
                      onChange={e => setFormData(prev => ({ ...prev, tel: e.target.value }))}
                      placeholder="02-000-0000"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                  </div>

                  {/* 팩스 번호 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      팩스 번호
                    </label>
                    <input
                      type="text"
                      value={formData.fax || ''}
                      onChange={e => setFormData(prev => ({ ...prev, fax: e.target.value }))}
                      placeholder="02-000-0001"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                  </div>

                  {/* 세금계산서 전용 이메일 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      전자세금계산서 이메일
                    </label>
                    <input
                      type="email"
                      value={formData.taxEmail || ''}
                      onChange={e => setFormData(prev => ({ ...prev, taxEmail: e.target.value }))}
                      placeholder="tax@company.co.kr"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                  </div>

                  {/* 관할 세무서 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      관할 세무서
                    </label>
                    <input
                      type="text"
                      value={formData.taxOffice || ''}
                      onChange={e => setFormData(prev => ({ ...prev, taxOffice: e.target.value }))}
                      placeholder="예: 용인세무서장"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                  </div>

                  {/* 본사 사업장 소재지 */}
                  <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      사업장 소재지 (본점 주소) *
                    </label>
                    <input
                      type="text"
                      value={formData.businessAddress || ''}
                      onChange={e => setFormData(prev => ({ ...prev, businessAddress: e.target.value }))}
                      placeholder="도로명 주소 입력"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                    />
                  </div>

                  {/* 상태 및 기본 테넌트 지정 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      운영 상태
                    </label>
                    <select
                      value={formData.status || 'ACTIVE'}
                      onChange={e => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                    >
                      <option value="ACTIVE">가동 (ACTIVE)</option>
                      <option value="SUSPENDED">정지 (SUSPENDED)</option>
                      <option value="TERMINATED">해지 (TERMINATED)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      기본 테넌트 여부
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(formData.isDefault)}
                        onChange={e => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                      />
                      <span>시스템 기본 테넌트로 지정</span>
                    </label>
                  </div>
                </div>
              )}

              {/* ── 탭: 구독 및 라이선스 (Expire 관리) ── */}
              {modalTab === 'SUBSCRIPTION' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  
                  {/* 1. 구독 상태 요약 카드 (D-Day 배너) */}
                  {(() => {
                    const tempTenant = { ...formData } as Tenant;
                    const subInfo = getTenantSubscriptionInfo(tempTenant);
                    return (
                      <div style={{
                        padding: '16px 20px',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-app)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '16px',
                        flexWrap: 'wrap'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '8px',
                            backgroundColor: subInfo.badgeBg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: subInfo.badgeColor
                          }}>
                            {subInfo.isExpired ? <XCircle size={22} /> : subInfo.isExpiringSoon ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {subInfo.planLabel} 라이선스
                              </span>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '11px',
                                fontWeight: 800,
                                backgroundColor: subInfo.badgeBg,
                                color: subInfo.badgeColor
                              }}>
                                {subInfo.label}
                              </span>
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              구독 만료일자: <strong style={{ color: 'var(--text-primary)' }}>{formData.subscription?.endDate || '-'}</strong> (유예기간 {formData.subscription?.gracePeriodDays ?? 7}일)
                            </span>
                          </div>
                        </div>

                        {/* 라이선스 키 및 복사 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
                            인증 라이선스 키
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <code style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              fontFamily: 'monospace',
                              fontWeight: 700
                            }}>
                              {formData.subscription?.licenseKey || '미발급 (저장 시 자동 생성)'}
                            </code>
                            <button
                              type="button"
                              onClick={handleGenerateLicenseKey}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-card)',
                                color: 'var(--text-primary)',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <RefreshCw size={11} />
                              <span>재발급</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 2. 구독 플랜 선택 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-secondary)' }}>
                      구독 요금제 등급
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                      {[
                        { key: 'TRIAL', name: '체험판', desc: '14일 무료', limit: '30대 / 3계정' },
                        { key: 'STARTER', name: '스타터', desc: '소규모 렌탈', limit: '50대 / 5계정' },
                        { key: 'STANDARD', name: '스탠다드', desc: '표준 사업장', limit: '150대 / 10계정' },
                        { key: 'PRO', name: '프로페셔널', desc: '중대형 렌탈', limit: '500대 / 30계정' },
                        { key: 'ENTERPRISE', name: '엔터프라이즈', desc: '대형 법인', limit: '무제한 통합' },
                      ].map(plan => {
                        const isSelected = formData.subscription?.plan === plan.key;
                        return (
                          <div
                            key={plan.key}
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                subscription: {
                                  ...(prev.subscription as any),
                                  plan: plan.key as SubscriptionPlan,
                                }
                              }));
                            }}
                            style={{
                              padding: '12px',
                              borderRadius: '8px',
                              border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.06)' : 'var(--bg-app)',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>
                                {plan.name}
                              </span>
                              {isSelected && <Check size={14} color="var(--primary)" />}
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{plan.desc}</span>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{plan.limit}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. 구독 기간 설정 & 원클릭 연장 */}
                  <div style={{
                    padding: '16px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        구독 유효 기간 및 원클릭 연장
                      </span>
                      {/* 원클릭 연장 버튼군 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '2px' }}>빠른 연장:</span>
                        {[
                          { label: '+1개월', months: 1 },
                          { label: '+3개월', months: 3 },
                          { label: '+6개월', months: 6 },
                          { label: '+1년', months: 12 },
                          { label: '+2년', months: 24 },
                        ].map(ext => (
                          <button
                            key={ext.months}
                            type="button"
                            onClick={() => handleExtendSubscription(ext.months)}
                            style={{
                              padding: '4px 9px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              fontSize: '11.5px',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {ext.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      {/* 구독 시작일 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          구독 개시일자
                        </label>
                        <input
                          type="date"
                          value={formData.subscription?.startDate || ''}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            subscription: {
                              ...(prev.subscription as any),
                              startDate: e.target.value
                            }
                          }))}
                          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px' }}
                        />
                      </div>

                      {/* 구독 만료일 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          구독 만료일자 (Expire Date) *
                        </label>
                        <input
                          type="date"
                          value={formData.subscription?.endDate || ''}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            subscription: {
                              ...(prev.subscription as any),
                              endDate: e.target.value
                            }
                          }))}
                          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px' }}
                        />
                      </div>

                      {/* 유예 기간 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          만료 후 서비스 유예 기간 (일수)
                        </label>
                        <input
                          type="number"
                          value={formData.subscription?.gracePeriodDays ?? 7}
                          onChange={e => setFormData(prev => ({
                            ...prev,
                            subscription: {
                              ...(prev.subscription as any),
                              gracePeriodDays: Number(e.target.value) || 0
                            }
                          }))}
                          placeholder="7"
                          style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 4. 결제 주기 및 구독료 & 자원 쿼터 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px' }}>
                    {/* 결제 주기 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        청구 및 결제 주기
                      </label>
                      <select
                        value={formData.subscription?.billingCycle || 'MONTHLY'}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          subscription: {
                            ...(prev.subscription as any),
                            billingCycle: e.target.value as any
                          }
                        }))}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                      >
                        <option value="MONTHLY">월납 (Monthly)</option>
                        <option value="YEARLY">연납 (Yearly)</option>
                        <option value="CUSTOM">수시 계약 (Custom)</option>
                      </select>
                    </div>

                    {/* 월 구독료 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        구독료 (원 단위)
                      </label>
                      <input
                        type="number"
                        value={formData.subscription?.monthlyFee ?? 500000}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          subscription: {
                            ...(prev.subscription as any),
                            monthlyFee: Number(e.target.value) || 0
                          }
                        }))}
                        placeholder="500000"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                      />
                    </div>

                    {/* 최대 장비 대수 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        최대 관리 장비 한도 (0=무제한)
                      </label>
                      <input
                        type="number"
                        value={formData.subscription?.maxAssets ?? 0}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          subscription: {
                            ...(prev.subscription as any),
                            maxAssets: Number(e.target.value) || 0
                          }
                        }))}
                        placeholder="0"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                      />
                    </div>

                    {/* 최대 계정 수 */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        최대 사용자 계정 한도 (0=무제한)
                      </label>
                      <input
                        type="number"
                        value={formData.subscription?.maxUsers ?? 0}
                        onChange={e => setFormData(prev => ({
                          ...prev,
                          subscription: {
                            ...(prev.subscription as any),
                            maxUsers: Number(e.target.value) || 0
                          }
                        }))}
                        placeholder="0"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  {/* 5. 관리자 수동 상태 전환 조치 */}
                  <div style={{
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        테넌트 라이선스 즉시 상태 조치
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        미납 또는 계약 해지 시 즉시 만료 처리하거나 정상 가동으로 복구할 수 있습니다.
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button data-hs-trigger="Process"
                        type="button"
                        onClick={() => {
                          const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                          setFormData(prev => ({
                            ...prev,
                            status: 'EXPIRED',
                            subscription: {
                              ...(prev.subscription as any),
                              endDate: yesterday,
                              status: 'EXPIRED'
                            }
                          }));
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(220, 38, 38, 0.3)',
                          backgroundColor: '#fee2e2',
                          color: '#b91c1c',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        즉시 만료 처리
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const nextYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                          setFormData(prev => ({
                            ...prev,
                            status: 'ACTIVE',
                            subscription: {
                              ...(prev.subscription as any),
                              endDate: nextYear,
                              status: 'ACTIVE'
                            }
                          }));
                        }}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(22, 163, 74, 0.3)',
                          backgroundColor: '#dcfce7',
                          color: '#15803d',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        정상 활성화 복구 (+1년)
                      </button>
                    </div>
                  </div>

                  {/* 6. 계약 특이사항 메모 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      구독 및 라이선스 특약 메모
                    </label>
                    <textarea
                      rows={2}
                      value={formData.subscription?.memo || ''}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        subscription: {
                          ...(prev.subscription as any),
                          memo: e.target.value
                        }
                      }))}
                      placeholder="특약 사항, 할인율, 지불 약정 등 기록"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical' }}
                    />
                  </div>

                </div>
              )}

              {/* ── 탭 2: 브랜드 및 직인 ── */}
              {modalTab === 'BRAND' && (
                <div data-hs-scope="tenant_edit_form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* CI 로고 등록 */}
                  <div style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '16px',
                    backgroundColor: 'var(--bg-app)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      CI / 로고 이미지
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{
                        width: '160px',
                        height: '70px',
                        borderRadius: '8px',
                        border: '1px dashed var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                      }}>
                        {formData.ciUrl || formData.logoUrl ? (
                          <img
                            src={formData.ciUrl || formData.logoUrl}
                            alt="CI Preview"
                            style={{ maxHeight: '55px', maxWidth: '140px', objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>이미지 없음</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => ciFileInputRef.current?.click()}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Upload size={13} />
                            <span>파일 선택</span>
                          </button>
                          <input
                            ref={ciFileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={e => handleFileChange(e, 'ciUrl')}
                          />
                          {(formData.ciUrl || formData.logoUrl) && (
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, ciUrl: '', logoUrl: '' }))}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'transparent',
                                color: 'var(--text-muted)',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              초기화
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          value={formData.ciUrl || formData.logoUrl || ''}
                          onChange={e => setFormData(prev => ({ ...prev, ciUrl: e.target.value, logoUrl: e.target.value }))}
                          placeholder="이미지 절대경로 또는 URL (예: /images/ci/hansol_ci.svg)"
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '12px', width: '360px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 법인 직인 인감 등록 */}
                  <div style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '16px',
                    backgroundColor: 'var(--bg-app)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      공식 법인 직인 / 인감 도장
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '8px',
                        border: '1px dashed var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                      }}>
                        {formData.stampImageUrl ? (
                          <img
                            src={formData.stampImageUrl}
                            alt="Stamp Preview"
                            style={{ width: '64px', height: '64px', objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>직인 없음</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => stampFileInputRef.current?.click()}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-card)',
                              color: 'var(--text-primary)',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px'
                            }}
                          >
                            <Upload size={13} />
                            <span>직인 파일 선택</span>
                          </button>
                          <input
                            ref={stampFileInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={e => handleFileChange(e, 'stampImageUrl')}
                          />
                          {formData.stampImageUrl !== OFFICIAL_STAMP_BASE64 && (
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, stampImageUrl: OFFICIAL_STAMP_BASE64 }))}
                              style={{
                                padding: '6px 10px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'transparent',
                                color: 'var(--text-muted)',
                                fontSize: '12px',
                                cursor: 'pointer'
                              }}
                            >
                              표준 직인으로 복원
                            </button>
                          )}
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          투명 배경 PNG 권장 (견적서, 계약서, 거래명세서 출력물에 자동 날인)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 실시간 헤더 화이트라벨 프리뷰 */}
                  <div style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '16px',
                    backgroundColor: 'var(--bg-app)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      상단 네비게이션 헤더 미리보기
                    </span>
                    <div style={{
                      height: '56px',
                      backgroundColor: 'var(--bg-header)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 20px',
                      gap: '12px'
                    }}>
                      {formData.ciUrl || formData.logoUrl ? (
                        <img
                          src={formData.ciUrl || formData.logoUrl}
                          alt="CI Preview"
                          style={{ height: '28px', maxWidth: '80px', objectFit: 'contain' }}
                        />
                      ) : (
                        <Building2 size={24} color="var(--primary)" />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)' }}>
                          {formData.displayName || '표시상호'}
                        </span>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--primary)', marginTop: '1px' }}>
                          e-Bro ERP System
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── 탭 3: 계좌 및 주기장 ── */}
              {modalTab === 'BANKS_YARDS' && (
                <div data-hs-scope="tenant_edit_form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {/* 주거래 입금 계좌 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        주거래 입금 계좌
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...(formData.bankAccounts || [])];
                          updated.push({
                            bankName: '국민은행',
                            accountNumber: '',
                            accountHolder: formData.corporateName || formData.displayName || '',
                            isDefault: updated.length === 0,
                          });
                          setFormData(prev => ({ ...prev, bankAccounts: updated }));
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-app)',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        + 계좌 추가
                      </button>
                    </div>

                    {(formData.bankAccounts || []).map((acc, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 140px 60px', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={acc.bankName}
                          onChange={e => {
                            const updated = [...(formData.bankAccounts || [])];
                            updated[idx].bankName = e.target.value;
                            setFormData(prev => ({ ...prev, bankAccounts: updated }));
                          }}
                          placeholder="은행명"
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12px' }}
                        />
                        <input
                          type="text"
                          value={acc.accountNumber}
                          onChange={e => {
                            const updated = [...(formData.bankAccounts || [])];
                            updated[idx].accountNumber = e.target.value;
                            setFormData(prev => ({ ...prev, bankAccounts: updated }));
                          }}
                          placeholder="계좌번호"
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'monospace' }}
                        />
                        <input
                          type="text"
                          value={acc.accountHolder || ''}
                          onChange={e => {
                            const updated = [...(formData.bankAccounts || [])];
                            updated[idx].accountHolder = e.target.value;
                            setFormData(prev => ({ ...prev, bankAccounts: updated }));
                          }}
                          placeholder="예금주"
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12px' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (formData.bankAccounts || []).filter((_, i) => i !== idx);
                            setFormData(prev => ({ ...prev, bankAccounts: updated }));
                          }}
                          style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* 장비 주기장(야드) 목록 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        장비 주기장 (야드)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...(formData.yards || [])];
                          updated.push({
                            id: `yard-${Date.now()}`,
                            yardCode: `YARD-${updated.length + 1}`,
                            name: `제${updated.length + 1} 주기장`,
                            isDefault: updated.length === 0,
                            address: '',
                            operatingCapacity: 100,
                          });
                          setFormData(prev => ({ ...prev, yards: updated }));
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-app)',
                          color: 'var(--text-primary)',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        + 주기장 추가
                      </button>
                    </div>

                    {(formData.yards || []).map((yard, idx) => (
                      <div key={yard.id || idx} style={{ display: 'grid', gridTemplateColumns: '150px 1fr 90px 60px', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          value={yard.name}
                          onChange={e => {
                            const updated = [...(formData.yards || [])];
                            updated[idx].name = e.target.value;
                            setFormData(prev => ({ ...prev, yards: updated }));
                          }}
                          placeholder="주기장명"
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12px' }}
                        />
                        <input
                          type="text"
                          value={yard.address}
                          onChange={e => {
                            const updated = [...(formData.yards || [])];
                            updated[idx].address = e.target.value;
                            setFormData(prev => ({ ...prev, yards: updated }));
                          }}
                          placeholder="주기장 도로명 주소"
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12px' }}
                        />
                        <input
                          type="number"
                          value={yard.operatingCapacity || 100}
                          onChange={e => {
                            const updated = [...(formData.yards || [])];
                            updated[idx].operatingCapacity = Number(e.target.value);
                            setFormData(prev => ({ ...prev, yards: updated }));
                          }}
                          placeholder="수용대수"
                          style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', color: 'var(--text-primary)', fontSize: '12px' }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (formData.yards || []).filter((_, i) => i !== idx);
                            setFormData(prev => ({ ...prev, yards: updated }));
                          }}
                          style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 탭 4: 플러그인 및 기능 설정 ── */}
              {modalTab === 'PLUGINS' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {[
                    {
                      key: 'agentAiEnabled',
                      title: 'eBro AI Agent 고유 기능 (텔레그램 명령 / 웹 확장 제어)',
                      desc: '켜짐 시 텔레그램 모바일 업무 지시 및 브라우저 확장 조작 개방 / 꺼짐 시 Silent Core 모드 (인쇄 & 엑셀 문서 처리 전용)',
                      icon: <Bot size={18} color="#2563eb" />,
                    },
                    {
                      key: 'telegramBot',
                      title: '텔레그램 모바일 관제 봇',
                      desc: '임직원 및 배차/정비 현장 텔레그램 연동 및 반응형 버튼 제어',
                      icon: <Smartphone size={18} color="#0284c7" />,
                    },
                    {
                      key: 'callRecordingStt',
                      title: 'GPU 통화 녹취 STT',
                      desc: '기사/고객 통화 음성 파일 텍스트 자동 변환 및 요약',
                      icon: <Mic size={18} color="#7e22ce" />,
                    },
                    {
                      key: 'kakaoContract',
                      title: '카카오 전자계약 / 알림톡',
                      desc: '카카오톡 모바일 전자계약서 발송 및 서명 연동',
                      icon: <FileSignature size={18} color="#ca8a04" />,
                    },
                    {
                      key: 'autoTaxInvoice',
                      title: '홈택스 세무/계산서 자동연동',
                      desc: '국세청 홈택스 전자세금계산서 발행 및 매입/매출 스크래핑',
                      icon: <Receipt size={18} color="#16a34a" />,
                    },
                    {
                      key: 'voiceAssistance',
                      title: '음성 비서 어시스턴트',
                      desc: 'PC 마이크 및 모바일 음성 명령 파이프라인 활성화',
                      icon: <Mic size={18} color="#dc2626" />,
                    },
                  ].map(plugin => {
                    const isEnabled = Boolean(formData.features?.[plugin.key as keyof TenantFeatures]);

                    return (
                      <div
                        key={plugin.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 18px',
                          borderRadius: '10px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-app)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          {plugin.icon}
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                              {plugin.title}
                            </span>
                            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                              {plugin.desc}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              features: {
                                ...prev.features,
                                [plugin.key]: !isEnabled,
                              }
                            }));
                          }}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: isEnabled ? 'var(--primary)' : 'var(--text-muted)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 700,
                            fontSize: '13px'
                          }}
                        >
                          {isEnabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                          <span>{isEnabled ? '활성' : '비활성'}</span>
                        </button>
                      </div>
                    );
                  })}

                  {/* 독립 도메인 CNAME 매핑 */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)'
                  }}>
                    <label style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      고객사 독립 도메인 매핑 (CNAME)
                    </label>
                    <input
                      type="text"
                      value={formData.features?.customDomain || ''}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        features: {
                          ...prev.features,
                          customDomain: e.target.value.trim().toLowerCase(),
                        }
                      }))}
                      placeholder="예: erp.hansolrental.co.kr"
                      style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace' }}
                    />
                  </div>

                  {/* 특수 거래명세서 편집 권한 */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        특수 거래명세서 항목 편집 허용
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        명세서 단가 및 수량 임의 수정 및 사유 기록 기능 활성화
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, allowCustomBillingStatement: !prev.allowCustomBillingStatement }))}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: formData.allowCustomBillingStatement ? 'var(--primary)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 700,
                        fontSize: '13px'
                      }}
                    >
                      {formData.allowCustomBillingStatement ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                      <span>{formData.allowCustomBillingStatement ? '활성' : '비활성'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── 탭 6: 페이지 노출 관리 ── */}
              {modalTab === 'PAGES' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* 상단 컨트롤 바 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px',
                    padding: '14px 18px',
                    backgroundColor: 'var(--bg-app)',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)'
                  }}>
                    {/* 좌측: 통계 & 검색 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          메뉴 노출 현황
                        </span>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          border: '1px solid #bbf7d0',
                          whiteSpace: 'nowrap'
                        }}>
                          노출 {formPageStats.visible}개
                        </span>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          backgroundColor: formPageStats.hidden > 0 ? '#fee2e2' : 'var(--bg-card)',
                          color: formPageStats.hidden > 0 ? '#b91c1c' : 'var(--text-muted)',
                          border: '1px solid var(--border-color)',
                          whiteSpace: 'nowrap'
                        }}>
                          숨김 {formPageStats.hidden}개
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          / 전체 {formPageStats.total}개
                        </span>
                      </div>

                      {/* 검색 입력창 */}
                      <div style={{ position: 'relative', width: '220px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                          type="text"
                          value={pageSearchKeyword}
                          onChange={e => setPageSearchKeyword(e.target.value)}
                          placeholder="메뉴명 / ID 검색..."
                          style={{
                            width: '100%',
                            padding: '6px 10px 6px 30px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-primary)'
                          }}
                        />
                      </div>
                    </div>

                    {/* 우측: 일괄 액션 버튼군 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={handleShowAllPages}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        전체 노출
                      </button>
                      <button
                        type="button"
                        onClick={handleSetCorePagesOnly}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#1d4ed8',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        기본 업무 설정
                      </button>
                      <button
                        type="button"
                        onClick={handleHideAllPages}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                          backgroundColor: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          color: '#dc2626',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        전체 숨김
                      </button>
                    </div>
                  </div>

                  {/* 메뉴 그룹 목록 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {SYSTEM_MENU_CONFIG.map(grp => {
                      const kw = pageSearchKeyword.trim().toLowerCase();
                      const filteredItems = kw
                        ? grp.items.filter(item => 
                            item.name.toLowerCase().includes(kw) || 
                            item.id.toLowerCase().includes(kw) ||
                            grp.name.toLowerCase().includes(kw)
                          )
                        : grp.items;

                      if (filteredItems.length === 0) return null;

                      const grpVisibleCount = grp.items.filter(i => isPageVisible(i.id)).length;
                      const allGrpVisible = grpVisibleCount === grp.items.length;
                      const allGrpHidden = grpVisibleCount === 0;

                      return (
                        <div
                          key={grp.id}
                          style={{
                            border: '1px solid var(--border-color)',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg-card)',
                            overflow: 'hidden'
                          }}
                        >
                          {/* 그룹 헤더 */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 16px',
                            backgroundColor: 'var(--bg-app)',
                            borderBottom: '1px solid var(--border-color)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                {grp.name}
                              </span>
                              <span style={{
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700,
                                backgroundColor: allGrpVisible ? '#dcfce7' : allGrpHidden ? '#fee2e2' : '#fef3c7',
                                color: allGrpVisible ? '#166534' : allGrpHidden ? '#991b1b' : '#92400e',
                                border: '1px solid var(--border-color)',
                                whiteSpace: 'nowrap'
                              }}>
                                {grpVisibleCount}/{grp.items.length} 노출
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleGroupVisibility(grp.id, true)}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  backgroundColor: 'var(--bg-card)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                그룹 노출
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleGroupVisibility(grp.id, false)}
                                style={{
                                  padding: '3px 8px',
                                  borderRadius: '4px',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  backgroundColor: 'var(--bg-card)',
                                  border: '1px solid var(--border-color)',
                                  color: 'var(--text-secondary)',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                그룹 숨김
                              </button>
                            </div>
                          </div>

                          {/* 메뉴 항목 그리드 */}
                          <div style={{
                            padding: '14px 16px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                            gap: '10px'
                          }}>
                            {filteredItems.map(item => {
                              const isVisible = isPageVisible(item.id);
                              const isLocked = item.id === 'dashboard' || item.id === 'tenant_management';

                              return (
                                <div
                                  key={item.id}
                                  onClick={() => {
                                    if (!isLocked) handleTogglePageVisibility(item.id);
                                  }}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: isVisible ? '1px solid #93c5fd' : '1px solid var(--border-color)',
                                    backgroundColor: isVisible ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-app)',
                                    cursor: isLocked ? 'not-allowed' : 'pointer',
                                    transition: 'all 0.15s ease',
                                    opacity: isVisible ? 1 : 0.65
                                  }}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, paddingRight: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <span style={{
                                        fontSize: '12.5px',
                                        fontWeight: isVisible ? 700 : 500,
                                        color: isVisible ? 'var(--text-primary)' : 'var(--text-muted)',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                      }}>
                                        {item.name}
                                      </span>
                                      {isLocked && (
                                        <span style={{
                                          fontSize: '10px',
                                          padding: '1px 4px',
                                          borderRadius: '3px',
                                          backgroundColor: '#e2e8f0',
                                          color: '#475569',
                                          fontWeight: 700,
                                          whiteSpace: 'nowrap'
                                        }}>
                                          고정
                                        </span>
                                      )}
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                                      {item.id}
                                    </span>
                                  </div>

                                  <div style={{ flexShrink: 0 }}>
                                    {isLocked ? (
                                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        필수
                                      </span>
                                    ) : (
                                      <span style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        backgroundColor: isVisible ? '#22c55e' : '#94a3b8',
                                        color: '#ffffff',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                                        {isVisible ? '노출' : '숨김'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* ─── 7번째 탭: 에이전트 관제 (AGENTS) ─── */}
              {modalTab === 'AGENTS' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* 🌐 테넌트 AI 에이전트 런타임 동작 모드 제어 배너 */}
                  <div style={{
                    padding: '14px 18px',
                    backgroundColor: formData.features?.agentAiEnabled ? 'rgba(59, 130, 246, 0.08)' : 'rgba(100, 116, 139, 0.08)',
                    borderRadius: '10px',
                    border: `1.5px solid ${formData.features?.agentAiEnabled ? '#3b82f6' : 'var(--border-color)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        backgroundColor: formData.features?.agentAiEnabled ? '#2563eb' : '#64748b',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 900,
                        fontSize: '13px',
                        flexShrink: 0
                      }}>
                        {formData.features?.agentAiEnabled ? 'AI' : 'OFF'}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            eBro AI Agent 고유 기능: {formData.features?.agentAiEnabled ? '🟢 Full AI Studio 모드 (개방)' : '🔵 Silent Core 모드 (인쇄·문서 처리 전용)'}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {formData.features?.agentAiEnabled 
                            ? '텔레그램 모바일 원격 업무 지시 수확, Chrome 브라우저 확장 조작, 데스크톱 AI Studio UI가 전면 개방되어 있습니다.'
                            : 'AI 기능이 잠겨 있습니다. 시스템 트레이에 조용히 상주하며 라벨/복합기 인쇄 큐 관리 및 엑셀 계약서/명세서 번들 생성만 백그라운드로 안전 수행합니다.'}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const nextVal = !Boolean(formData.features?.agentAiEnabled);
                        setFormData(prev => ({
                          ...prev,
                          features: {
                            ...prev.features,
                            agentAiEnabled: nextVal
                          }
                        }));
                        // 로컬 에이전트에 정책 즉시 핫 전송
                        syncTenantPolicyToAgent({
                          tenantCode: formData.tenantCode,
                          features: { ...formData.features, agentAiEnabled: nextVal }
                        });
                      }}
                      style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '12.5px',
                        fontWeight: 700,
                        backgroundColor: formData.features?.agentAiEnabled ? '#ef4444' : '#2563eb',
                        color: '#ffffff',
                        border: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                        flexShrink: 0
                      }}
                    >
                      {formData.features?.agentAiEnabled ? 'Silent Core로 전환 (AI 잠금)' : 'Full AI 에이전트 개방 (활성화)'}
                    </button>
                  </div>

                  {/* 상단 통계 요약 바 */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '12px'
                  }}>
                    <div style={{ padding: '12px', backgroundColor: 'var(--bg-app)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>등록 에이전트</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>2대</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
                      <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600 }}>정상 가동 (Online)</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>2대</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#fff1f2', borderRadius: '8px', border: '1px solid #fecdd3' }}>
                      <div style={{ fontSize: '11px', color: '#be123c', fontWeight: 600 }}>오프라인 (퇴근/절전)</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#e11d48', marginTop: '4px' }}>0대</div>
                    </div>
                    <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                      <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600 }}>클라우드 대기 큐</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb', marginTop: '4px' }}>0건 (대기 없음)</div>
                    </div>
                  </div>

                  {/* 텔레그램 및 클라우드 큐잉 안내 배너 */}
                  <div style={{
                    padding: '12px 16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1',
                    fontSize: '12px',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <span style={{ fontSize: '18px' }}>💡</span>
                    <div>
                      <strong>24시간 텔레그램 지시 무누락 보존:</strong> 출고 PC가 퇴근/절전으로 오프라인이어도, 텔레그램 모바일 지시는 클라우드 서버의 태스크 큐(Task Queue)에 즉시 안전 저장되며 익일 PC 부팅 시 0초 만에 일괄 자동 실행됩니다.
                    </div>
                  </div>

                  {/* 에이전트 플릿 목록 테이블 */}
                  <div style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden'
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'center', width: '50px' }}>NO</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>호스트 (기기명)</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>사용자 / 사번</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left' }}>로컬 IP / 포트</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center' }}>코어 버전</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center' }}>최종 수신</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center' }}>가동 상태</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', width: '140px' }}>원격 제어</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'monospace' }}>1</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)' }}>DESKTOP-DISPATCH-01</td>
                          <td style={{ padding: '10px 14px' }}>출고담당자 (u-outbound)</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>192.168.0.12:5175</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#4338ca', fontWeight: 700, fontSize: '11px' }}>
                              v2.0.0.Build.6
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#059669', fontWeight: 600 }}>방금 전</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: '#ecfdf5', color: '#047857' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                              정상 가동
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => alert('에이전트에 핫패치 검사 명령을 전송했습니다.')}
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', cursor: 'pointer' }}
                            >
                              핫패치 검사
                            </button>
                          </td>
                        </tr>
                        <tr style={{ whiteSpace: 'nowrap' }}>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontFamily: 'monospace' }}>2</td>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-main)' }}>DESKTOP-ADMIN-02</td>
                          <td style={{ padding: '10px 14px' }}>관리담당자 (u-admin)</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'monospace' }}>192.168.0.15:5175</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: '#e0e7ff', color: '#4338ca', fontWeight: 700, fontSize: '11px' }}>
                              v2.0.0.Build.6
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#059669', fontWeight: 600 }}>12초 전</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: '#ecfdf5', color: '#047857' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                              정상 가동
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => alert('에이전트에 핫패치 검사 명령을 전송했습니다.')}
                              style={{ padding: '3px 8px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', cursor: 'pointer' }}
                            >
                              핫패치 검사
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ─── 8번째 탭: 서식 관리 (TEMPLATES) ─── */}
              {modalTab === 'TEMPLATES' && (
                <div style={{ display: 'flex', gap: '16px', minHeight: '620px' }}>
                  {/* 좌측: 표준 서식 문서 목록 */}
                  <div style={{
                    width: '260px',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    borderRight: '1px solid var(--border-color)',
                    paddingRight: '16px'
                  }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      표준 업무 서식
                    </div>
                    {STANDARD_DOCUMENTS.map(doc => {
                      const isSelected = selectedDocType === doc.type;
                      const currentCode = formData.tenantCode || 'GIYEUN';
                      const hasCustom = Boolean(getTenantTemplate(currentCode, doc.type));

                      return (
                        <button
                          key={doc.type}
                          type="button"
                          onClick={() => setSelectedDocType(doc.type)}
                          style={{
                            padding: '12px',
                            borderRadius: '8px',
                            border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border-color)',
                            backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.06)' : 'var(--bg-card)',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? 'var(--primary)' : 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                              {doc.label}
                            </span>
                            <span style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: hasCustom ? '#eff6ff' : '#f1f5f9',
                              color: hasCustom ? '#1d4ed8' : '#64748b',
                              whiteSpace: 'nowrap'
                            }}>
                              {hasCustom ? '맞춤 서식' : '기본 서식'}
                            </span>
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                            {doc.desc}
                          </div>
                          <div style={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            코드: {doc.code}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* 우측: 서식 제어 바 & 실시간 HTML 미리보기 Frame */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* 서식 헤더 & 액션 버튼군 */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-app)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {STANDARD_DOCUMENTS.find(d => d.type === selectedDocType)?.label}
                          </span>
                          <span style={{
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: '#e2e8f0',
                            color: '#334155'
                          }}>
                            {selectedDocType}
                          </span>
                        </div>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {getTenantTemplate(formData.tenantCode || 'GIYEUN', selectedDocType) 
                            ? '테넌트 전용 맞춤 서식이 적용 중입니다.' 
                            : '시스템 기본 표준 서식이 적용 중입니다.'}
                        </span>
                      </div>

                      {/* 액션 버튼 3종 */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="file"
                          ref={templateFileInputRef}
                          accept=".html,.htm"
                          style={{ display: 'none' }}
                          onChange={handleUploadTemplate}
                        />

                        <button
                          type="button"
                          onClick={handleResetTemplate}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <RefreshCw size={12} />
                          <span>기본 서식 복원</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleDownloadTemplate}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Download size={12} />
                          <span>서식 HTML 다운로드</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => templateFileInputRef.current?.click()}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 700,
                            borderRadius: '6px',
                            border: '1px solid #3b82f6',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <Upload size={12} />
                          <span>맞춤 서식 HTML 업로드</span>
                        </button>
                      </div>
                    </div>

                    {templateSuccessMsg && (
                      <div style={{
                        padding: '8px 14px',
                        backgroundColor: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        borderRadius: '6px',
                        color: '#047857',
                        fontSize: '12px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Check size={14} />
                        <span>{templateSuccessMsg}</span>
                      </div>
                    )}

                    {/* 인라인 HTML 렌더링 뷰어 (Sandbox iframe) */}
                    <div style={{
                      flex: 1,
                      minHeight: '520px',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                    }}>
                      <iframe
                        title="템플릿 미리보기"
                        srcDoc={previewHtml}
                        style={{
                          width: '100%',
                          height: '100%',
                          minHeight: '520px',
                          border: 'none',
                          display: 'block'
                        }}
                        sandbox="allow-same-origin"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

              {modalTab === 'STORAGE' && (
                <div data-hs-scope="tenant_edit_form" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Database size={15} color="var(--primary)" />
                      Cloudflare R2 스토리지 설정 (GoogleConfig 연동)
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      테넌트의 사진 및 파일 저장을 위한 Cloudflare R2 스토리지 연결 정보를 입력합니다.
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>R2 Account ID</label>
                      <input
                        type="text"
                        value={r2Config.r2AccountId}
                        onChange={e => setR2Config({ ...r2Config, r2AccountId: e.target.value })}
                        placeholder="예: 32자리 문자열"
                        className="input-field"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px' }}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>R2 Bucket Name</label>
                      <input
                        type="text"
                        value={r2Config.r2BucketName}
                        onChange={e => setR2Config({ ...r2Config, r2BucketName: e.target.value })}
                        placeholder="예: giyeon-storage"
                        className="input-field"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>R2 Access Key ID</label>
                      <input
                        type="text"
                        value={r2Config.r2AccessKeyId}
                        onChange={e => setR2Config({ ...r2Config, r2AccessKeyId: e.target.value })}
                        className="input-field"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>R2 Secret Access Key</label>
                      <input
                        type="password"
                        value={r2Config.r2SecretAccessKey}
                        onChange={e => setR2Config({ ...r2Config, r2SecretAccessKey: e.target.value })}
                        className="input-field"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>R2 Public Domain</label>
                      <input
                        type="text"
                        value={r2Config.r2PublicDomain}
                        onChange={e => setR2Config({ ...r2Config, r2PublicDomain: e.target.value })}
                        placeholder="예: https://pub-xxxx.r2.dev"
                        className="input-field"
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px' }}
                      />
                    </div>
                  </div>
                </div>
              )}

            {/* 모달 푸터 */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              backgroundColor: 'var(--bg-app)'
            }}>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 700 }}
              >
                취소
              </button>

              <button data-hs-trigger="Save"
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="btn btn-primary"
                style={{ padding: '8px 20px', fontSize: '13px', fontWeight: 800 }}
              >
                {isSaving ? '저장 처리 중...' : '테넌트 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 사업자등록증 온보딩 모달 ── */}
      {isOnboardingModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1050,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* 모달 헤더 */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'var(--bg-app)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="var(--primary)" />
                <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  사업자등록증 온보딩
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOnboardingModalOpen(false);
                  setOnboardingError('');
                }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 모달 본문 */}
            <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                사업자등록증 파일(PDF, JPG, PNG)을 업로드하면 Vision AI가 상호, 사업자번호, 대표자, 주소 등을 자동 추출하여 신규 테넌트 폼을 완성합니다.
              </div>

              {/* 숨겨진 파일 인풋 */}
              <input
                type="file"
                ref={licenseFileInputRef}
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={handleLicenseFileSelect}
              />

              {/* 드롭/선택 영역 */}
              <div
                onClick={() => !isAnalyzingLicense && licenseFileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '10px',
                  padding: '36px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  backgroundColor: 'var(--bg-app)',
                  cursor: isAnalyzingLicense ? 'not-allowed' : 'pointer',
                  transition: 'border-color 0.15s ease'
                }}
              >
                {isAnalyzingLicense ? (
                  <>
                    <RefreshCw size={28} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                      사업자등록증 Vision AI 정밀 분석 중...
                    </span>
                  </>
                ) : (
                  <>
                    <Upload size={28} color="var(--text-muted)" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      사업자등록증 파일 선택 (PDF 또는 이미지)
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      PDF, JPG, JPEG, PNG 지원
                    </span>
                  </>
                )}
              </div>

              {onboardingError && (
                <div style={{
                  padding: '10px 12px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '12px'
                }}>
                  {onboardingError}
                </div>
              )}

              {/* 데모 샘플 입력 옵션 */}
              <div style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    샘플 사업자등록증 즉시 적용
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    파일 없이 가상의 고소작업대 렌탈사 데이터로 테스트
                  </span>
                </div>
                <button data-hs-trigger="Apply"
                  type="button"
                  onClick={handleDemoLicenseOnboarding}
                  style={{
                    padding: '6px 12px',
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
                  데모 데이터 적용
                </button>
              </div>
            </div>

            {/* 모달 푸터 */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'flex-end',
              backgroundColor: 'var(--bg-app)'
            }}>
              <button
                type="button"
                onClick={() => {
                  setIsOnboardingModalOpen(false);
                  setOnboardingError('');
                }}
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700 }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
