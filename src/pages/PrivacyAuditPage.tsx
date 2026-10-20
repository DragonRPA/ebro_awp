// src/pages/PrivacyAuditPage.tsx
// 개인정보 접속 감사 스튜디오 (개인정보 보호법 제29조 및 안전성 확보조치 기준 제8조 준수)
import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { 
  FileCheck, Shield, Download, Search, RefreshCw, Calendar, 
  Filter, CheckCircle, AlertTriangle, UserCheck, Eye, EyeOff, Lock,
  Laptop, Cpu, Network, Trash2, Plus, AlertOctagon, RotateCcw, X, Key, Info, Copy
} from 'lucide-react';
import { db, supabase, PrivacyAccessLog } from '../services/db';
import { exportToExcel } from '../services/excel';
import { SortableTh } from '../components/SortableTh';
import { useSortableData } from '../hooks/useSortableData';
import { PrivacyPolicyModal } from '../components/PrivacyPolicyModal';
import { 
  getAuthorizedDeveloperDevices, 
  revokeDeveloperDevice, 
  reactivateDeveloperDevice,
  registerAndAuthorizeDeveloperDevice,
  MASTER_HARDWARE_SECURITY_KEY,
  EMERGENCY_BREAK_GLASS_KEY,
  getPhysicalHardwareFingerprint,
  fetchPhysicalMacAddress,
  DeveloperDeviceProfile 
} from '../utils/hardwareVault';

export const PrivacyAuditPage: React.FC = () => {
  const { currentUser, users, hasPermission, showErrorModal, currentTenant } = useApp();
  const isSuperAdmin = currentUser?.id === 'u-1' || currentUser?.id === 'sys-admin' || currentUser?.loginId === 'admin';
  const isExecutive = currentUser?.role === 'ADMIN' || ['대표', '대표이사', '사장', '부사장'].includes(currentUser?.position || '') || currentUser?.department === '기연리프트';
  const canAudit = isSuperAdmin || isExecutive || hasPermission('permission', 'view');

  // 필터 상태
  const todayStr = new Date().toISOString().substring(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(todayStr);
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [selectedMenu, setSelectedMenu] = useState('ALL');
  const [maskFilter, setMaskFilter] = useState<'ALL' | 'MASKED' | 'UNMASKED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeAuditTab, setActiveAuditTab] = useState<'LOGS' | 'DEVICES'>('LOGS');

  // 개인정보 처리방침 모달
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // 반기 점검 완료 기록 상태
  const [auditCheckSign, setAuditCheckSign] = useState<{ checkedAt: string; checkedBy: string } | null>(() => {
    const saved = localStorage.getItem('erp_privacy_audit_check');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return null;
  });

  // 토스트 알림
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 🛡️ 인가된 개발자 물리 단말기 상태 관리
  const [authorizedDevices, setAuthorizedDevices] = useState<DeveloperDeviceProfile[]>(() => getAuthorizedDeveloperDevices());
  const refreshDevices = () => {
    setAuthorizedDevices(getAuthorizedDeveloperDevices());
  };

  // 신규 개발자 / 단말기 등록 모달 상태
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regDevId, setRegDevId] = useState('sys-admin');
  const [regDevName, setRegDevName] = useState('대표 개발자');
  const [regMachineName, setRegMachineName] = useState('');
  const [regMacAddress, setRegMacAddress] = useState('');
  const [regMasterKey, setRegMasterKey] = useState(MASTER_HARDWARE_SECURITY_KEY);
  const [regNote, setRegNote] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // 비상 마스터 복구 지침 모달 상태
  const [showBreakGlassModal, setShowBreakGlassModal] = useState(false);

  // 단말기 차단 (도난/분실 즉시 킬스위치)
  const handleRevokeDevice = (deviceId: string, deviceName: string) => {
    if (window.confirm(`'${deviceName}' 단말기의 개발자 물리적 인가를 차단(도난/분실 킬스위치 가동)하시겠습니까?\n차단 즉시 해당 단말기에서는 개발자 권한 로그인이 거부됩니다.`)) {
      revokeDeveloperDevice(deviceId, '관리자에 의한 도난/분실/보안 차단');
      refreshDevices();
      showToast(`'${deviceName}' 단말기 인가가 차단되었습니다.`, 'error');
    }
  };

  // 단말기 재승인
  const handleReactivateDevice = (deviceId: string, deviceName: string) => {
    if (window.confirm(`'${deviceName}' 단말기의 개발자 물리적 인가를 다시 활성화(재승인)하시겠습니까?`)) {
      reactivateDeveloperDevice(deviceId);
      refreshDevices();
      showToast(`'${deviceName}' 단말기 인가가 재승인되었습니다.`, 'success');
    }
  };

  // 현재 접속 PC 정보 자동 감지
  const handleDetectCurrentPc = async () => {
    setIsDetecting(true);
    try {
      const macs = await fetchPhysicalMacAddress();
      if (macs.length > 0) {
        setRegMacAddress(macs[0]);
      }
      const fp = await getPhysicalHardwareFingerprint();
      if (!regMachineName) {
        setRegMachineName(`개발자 워크스테이션 (${fp.details.platform || 'PC'})`);
      }
      showToast('현재 기기의 물리 정보가 자동 감지되었습니다.');
    } catch {
      showToast('물리 정보 감지에 실패했습니다. 수동으로 입력해 주십시오.', 'error');
    } finally {
      setIsDetecting(false);
    }
  };

  // 신규 등록 제출
  const handleRegisterDeviceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regMacAddress.trim()) {
      showToast('물리 MAC 주소를 입력해 주십시오.', 'error');
      return;
    }
    if (!regMachineName.trim()) {
      showToast('단말기명을 입력해 주십시오.', 'error');
      return;
    }

    setIsRegistering(true);
    try {
      const res = await registerAndAuthorizeDeveloperDevice({
        developerId: regDevId,
        developerName: regDevName.trim() || '개발자',
        machineName: regMachineName.trim(),
        macAddress: regMacAddress.trim(),
        masterSecurityKey: regMasterKey.trim(),
        note: regNote.trim() || '신규 개발자/단말기 인가'
      });

      if (res.success && res.device) {
        refreshDevices();
        setShowRegisterModal(false);
        setRegMachineName('');
        setRegMacAddress('');
        setRegNote('');
        showToast(`[${res.device.machineName}] 단말기가 공인 등록되었습니다.`);
      } else {
        showToast(res.error || '단말기 등록에 실패했습니다.', 'error');
      }
    } catch (err: any) {
      showToast(`등록 처리 중 오류: ${err?.message || err}`, 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  // DB 접속로그 로딩
  const [logs, setLogs] = useState<PrivacyAccessLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      if (db.isSupabaseConnected() && supabase) {
        const { data, error } = await supabase
          .from('privacy_access_logs')
          .select('*')
          .order('createdAt', { ascending: false })
          .limit(2000);
        if (!error && Array.isArray(data)) {
          const mapped: PrivacyAccessLog[] = data.map((d: any) => ({
            id: d.id,
            userId: d.userId,
            userName: d.userName,
            ipAddress: d.ipAddress,
            actionType: d.actionType,
            targetMenu: d.targetMenu,
            targetSubjectId: d.targetSubjectId,
            targetSubjectName: d.targetSubjectName,
            actionDetail: d.actionDetail,
            isMasked: d.isMasked !== false,
            createdAt: d.createdAt
          }));
          setLogs(mapped);
          db.privacyAccessLogs = mapped;
          return;
        }
      }
      setLogs(db.privacyAccessLogs || []);
    } catch (err: any) {
      console.warn('Audit logs load failed, fallback to local:', err);
      setLogs(db.privacyAccessLogs || []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, []);

  // 필터링된 로그 목록
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const logDate = (log.createdAt || '').substring(0, 10);
      if (startDate && logDate < startDate) return false;
      if (endDate && logDate > endDate) return false;

      if (selectedUser !== 'ALL' && log.userId !== selectedUser) return false;
      if (selectedAction !== 'ALL' && log.actionType !== selectedAction) return false;
      if (selectedMenu !== 'ALL' && log.targetMenu !== selectedMenu) return false;

      if (maskFilter === 'MASKED' && log.isMasked === false) return false;
      if (maskFilter === 'UNMASKED' && log.isMasked !== false) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const match = 
          log.userName?.toLowerCase().includes(q) ||
          log.userId?.toLowerCase().includes(q) ||
          log.actionDetail?.toLowerCase().includes(q) ||
          log.targetSubjectName?.toLowerCase().includes(q) ||
          log.targetMenu?.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [logs, startDate, endDate, selectedUser, selectedAction, selectedMenu, maskFilter, searchTerm]);
  const { sortedData: sortedLogs, sortKey: auditSortKey, sortDirection: auditSortDir, handleSort: handleAuditSort } = useSortableData(filteredLogs);

  // 통계 집계
  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const downloadCount = filteredLogs.filter(l => l.actionType === 'EXCEL_DOWNLOAD').length;
    const unmaskedDownloads = filteredLogs.filter(l => l.actionType === 'EXCEL_DOWNLOAD' && l.isMasked === false).length;
    const uniqueUsers = new Set(filteredLogs.map(l => l.userId)).size;
    return { total, downloadCount, unmaskedDownloads, uniqueUsers };
  }, [filteredLogs]);

  // 감사 로그 엑셀 출력
  const handleExportAuditExcel = () => {
    if (filteredLogs.length === 0) {
      showToast('출력할 감사 로그가 없습니다.', 'error');
      return;
    }
    const rows = sortedLogs.map((log, idx) => ({
      'NO': idx + 1,
      '감사로그ID': log.id,
      '일시': log.createdAt ? log.createdAt.replace('T', ' ').substring(0, 19) : '-',
      '접속자ID': log.userId,
      '접속자명': log.userName,
      '수행업무': log.actionType,
      '대상메뉴': log.targetMenu,
      '정보주체명': log.targetSubjectName || '-',
      '정보주체ID': log.targetSubjectId || '-',
      '마스킹여부': log.isMasked === false ? '비마스킹 (전체정보)' : '마스킹 적용',
      '상세내용': log.actionDetail
    }));

    exportToExcel(rows, `개인정보접속감사대장_${startDate}_${endDate}`, '개인정보감사대장');
    showToast(`개인정보 감사기록 (${rows.length}건) 엑셀이 출력되었습니다.`);
  };

  // 반기 감사 점검 승인
  const handleConfirmAuditCheck = () => {
    if (!canAudit) return;
    const nowIso = new Date().toISOString();
    const sign = {
      checkedAt: nowIso,
      checkedBy: `${currentUser?.name || '관리자'} (${currentUser?.position || '경영진'})`
    };
    setAuditCheckSign(sign);
    localStorage.setItem('erp_privacy_audit_check', JSON.stringify(sign));
    showToast('안전성 확보조치 기준 제8조에 따른 개인정보 접속기록 반기 점검이 승인·완결되었습니다.');
  };

  return (
    <div data-hs-observe="privacyauditpage" data-mid="privacy-header" data-subview="privacy_audit" data-subview-title="Generated" style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%', minHeight: 0, overflow: 'hidden', position: 'relative' }}>
      {/* 🔔 인앱 토스트 */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '10px 18px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 600,
          color: '#ffffff',
          backgroundColor: toastMessage.type === 'success' ? '#059669' : '#dc2626',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toastMessage.text}
        </div>
      )}

      {/* 개인정보 처리방침 모달 */}
      <PrivacyPolicyModal isOpen={showPolicyModal} onClose={() => setShowPolicyModal(false)} />

      {/* 헤더 및 정책 바로가기 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', flexShrink: 0, paddingBottom: '4px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: 'var(--primary, #4f46e5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff'
          }}>
            <FileCheck size={20} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
              개인정보 접속 감사
            </h2>
            </div></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {/* 감사 모드 탭 */}
          <div style={{ display: 'flex', gap: '4px', marginRight: '6px' }}>
            <button
              type="button"
              onClick={() => setActiveAuditTab('LOGS')}
              style={{
                padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 700,
                background: activeAuditTab === 'LOGS' ? 'var(--primary)' : 'var(--bg-card)',
                color: activeAuditTab === 'LOGS' ? '#fff' : 'var(--text-secondary)',
                border: activeAuditTab === 'LOGS' ? 'none' : '1px solid var(--border-color)',
                cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px'
              }}
            >
              <FileCheck size={13} /> 접속 감사 대장
            </button>
            {(isSuperAdmin || isExecutive) && (
              <button
                type="button"
                onClick={() => setActiveAuditTab('DEVICES')}
                style={{
                  padding: '4px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: 700,
                  background: activeAuditTab === 'DEVICES' ? 'var(--primary)' : 'var(--bg-card)',
                  color: activeAuditTab === 'DEVICES' ? '#fff' : 'var(--text-secondary)',
                  border: activeAuditTab === 'DEVICES' ? 'none' : '1px solid var(--border-color)',
                  cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px'
                }}
              >
                <Laptop size={13} /> 개발자 단말기 인가
              </button>
            )}
          </div>
          <button data-hs-trigger="Process"
            type="button"
            onClick={() => setShowPolicyModal(true)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid var(--border-color, var(--border-color))',
              backgroundColor: 'var(--bg-card, #ffffff)',
              color: 'var(--text-main, #0f172a)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <Shield size={14} color="var(--primary, #4f46e5)" />
            개인정보 처리방침 전문
          </button>
          <button
            type="button"
            onClick={loadAuditLogs}
            disabled={isLoading}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid var(--border-color, var(--border-color))',
              backgroundColor: 'var(--bg-card, #ffffff)',
              color: 'var(--text-main, #0f172a)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      {/* 🛡️ 테넌트별 개인정보 보호책임자 지정 현황 바 */}
      {activeAuditTab === 'LOGS' && (
        <>
          {(() => {
        const companyName = currentTenant?.tradeName || currentTenant?.corporateName || currentTenant?.displayName || '(주)기연리프트';
        const officer = currentTenant?.privacyOfficer || {
          name: currentTenant?.privacyOfficerName || currentTenant?.representativeName || '대표이사 / 관리부 총괄',
          position: currentTenant?.privacyOfficerPosition || '대표이사 / 관리부 총괄',
          department: currentTenant?.privacyOfficerDepartment || `${companyName} 경영진`,
          phone: currentTenant?.privacyOfficerPhone || currentTenant?.tel || '031-334-5295',
          email: currentTenant?.privacyOfficerEmail || currentTenant?.email || currentTenant?.taxEmail || '사내 관리부'
        };

        return (
          <div data-mid="privacy-scope-header" style={{
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div data-mid="privacy-cpo-badge" style={{
                padding: '4px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(79, 70, 229, 0.12)',
                color: 'var(--primary)',
                fontWeight: 700,
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}>
                <UserCheck size={14} />
                [{companyName}] 법정 개인정보 보호책임자
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span>성명: <strong>{officer.name}</strong></span>
                <span style={{ color: 'var(--border-color)' }}>|</span>
                <span>직책: <strong>{officer.position}</strong></span>
                <span style={{ color: 'var(--border-color)' }}>|</span>
                <span>소속: {officer.department}</span>
                <span style={{ color: 'var(--border-color)' }}>|</span>
                <span style={{ color: 'var(--text-secondary)' }}>문의: {officer.phone || officer.email}</span>
              </div>
            </div>

            <button data-hs-trigger="Confirm"
              type="button"
              onClick={() => setShowPolicyModal(true)}
              className="btn btn-secondary"
              style={{ fontSize: '11.5px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              <Shield size={13} color="var(--primary)" />
              책임자 정보 변경 및 방침 확인
            </button>
          </div>
        );
      })()}

      {/* 🛡️ 법정 개인정보 암호화 저장 안전성 확보조치(제29조) 가동 현황 */}
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
        padding: '6px 14px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={15} color="var(--primary)" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
              개인정보 보호법 제29조 안전성 확보조치 (저장 암호화) 가동 현황
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#059669', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={13} color="#059669" />
            전사 DB 및 브라우저 스토리지 100% 양방향 암호화 적용 완료
          </span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '6px' }}>
          <div style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={16} color="#059669" />
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>고유식별정보 (주민번호/신분증)</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>운송기사 고유번호 (100% 암호화)</div>
            </div>
          </div>

          <div style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={16} color="#059669" />
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>금융정보 (계좌번호/법인카드)</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>매입처·고객사·테넌트 계좌 (100% 암호화)</div>
            </div>
          </div>

          <div style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={16} color="#059669" />
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>민감 개인정보 (생년월일/연락처)</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>임직원·기사·담당자 연락망 (100% 암호화)</div>
            </div>
          </div>

          <div style={{ padding: '4px 8px', borderRadius: '6px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle size={16} color="#059669" />
            <div>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-main)' }}>평문 노출 제로</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>볼트 체크섬 무결성 검증 (정상 가동)</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          조회 범위 및 필터 패널
          ───────────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: 'var(--bg-card, #ffffff)',
        borderRadius: '8px',
        border: '1px solid var(--border-color, var(--border-color))',
        padding: '6px 14px', display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* 좌측: 상하 세로 스택 필터군 (헌장 3.4 준수) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* 조회 기간 */}
            <div data-mid="privacy-scope-date" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>             <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                조회 시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, var(--border-color))',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                조회 종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, var(--border-color))',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  outline: 'none'
                }}
              />
            </div>

            {/* 수행 업무 유형 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                수행 업무 유형
              </label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, var(--border-color))',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  outline: 'none'
                }}
              >
                <option value="ALL">전체 업무</option>
                <option value="EXCEL_DOWNLOAD">엑셀 다운로드 (핵심 감사)</option>
                <option value="LOGIN">로그인</option>
                <option value="LOGOUT">로그아웃</option>
                <option value="VIEW">화면 조회</option>
                <option value="CREATE">등록</option>
                <option value="UPDATE">수정</option>
                <option value="DELETE">삭제</option>
              </select>
            </div>

            {/* 접속자 선택 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                접속자
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, var(--border-color))',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  outline: 'none'
                }}
              >
                <option value="ALL">전체 접속자</option>
                {users.map(u => (
                  <option key={u.id} value={u.loginId || u.id}>
                    {u.name} ({u.position || u.role})
                  </option>
                ))}
              </select>
            </div>

            {/* 마스킹 여부 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                마스킹 여부
              </label>
              <select
                value={maskFilter}
                onChange={(e) => setMaskFilter(e.target.value as any)}
                style={{
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, var(--border-color))',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  outline: 'none'
                }}
              >
                <option value="ALL">전체</option>
                <option value="UNMASKED">비마스킹 (전체정보 다운로드)</option>
                <option value="MASKED">마스킹 적용</option>
              </select>
            </div>

            {/* 키워드 검색 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #475569)', whiteSpace: 'nowrap' }}>
                검색어
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="성명, 사번, 대상정보, 상세내용"
                style={{
                  width: '180px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, var(--border-color))',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  color: 'var(--text-main, #0f172a)',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* 우측 액션: 엑셀 출력 버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              data-mid="privacy-terminal-audit-excel" onClick={handleExportAuditExcel}
              style={{
                padding: '7px 14px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--success)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Download size={14} />
              감사기록 엑셀 출력
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          개인정보 접속 이력 대장
          ───────────────────────────────────────────────────────────── */}
      <div className="table-container" style={{ backgroundColor: 'var(--bg-card, #ffffff)', borderRadius: '6px', border: '1px solid var(--border-color)', flex: 1, minHeight: 0, overflow: 'auto' }}>
        <table data-mid="privacy-inspection-grid" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--bg-secondary)' }}>
            <tr style={{
              backgroundColor: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
              color: 'var(--text-secondary, #475569)',
              fontWeight: 700,
              whiteSpace: 'nowrap'
            }}>
              <th style={{ padding: '4px 8px', textAlign: 'center', width: '50px' }}>순번</th>
              <SortableTh label="일시" sortKey="createdAt" currentSortKey={auditSortKey} currentDirection={auditSortDir} onSort={handleAuditSort} />
              <SortableTh label="접속자" sortKey="userName" currentSortKey={auditSortKey} currentDirection={auditSortDir} onSort={handleAuditSort} />
              <SortableTh label="수행 업무" sortKey="actionType" currentSortKey={auditSortKey} currentDirection={auditSortDir} onSort={handleAuditSort} align="center" />
              <SortableTh label="대상 메뉴" sortKey="targetMenu" currentSortKey={auditSortKey} currentDirection={auditSortDir} onSort={handleAuditSort} />
              <SortableTh label="대상 정보주체" sortKey="targetSubjectName" currentSortKey={auditSortKey} currentDirection={auditSortDir} onSort={handleAuditSort} />
              <SortableTh label="마스킹 여부" sortKey="isMasked" currentSortKey={auditSortKey} currentDirection={auditSortDir} onSort={handleAuditSort} align="center" />
              <SortableTh label="상세 수행 내역" sortKey="actionDetail" currentSortKey={auditSortKey} currentDirection={auditSortDir} onSort={handleAuditSort} />
            </tr>
          </thead>
          <tbody>
            {sortedLogs.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                  조회 조건에 해당하는 개인정보 접속기록이 없습니다.
                </td>
              </tr>
            ) : (
              sortedLogs.map((log, idx) => {
                const isDownload = log.actionType === 'EXCEL_DOWNLOAD';
                const isUnmasked = log.isMasked === false;
                return (
                  <tr
                    key={log.id || idx}
                    style={{
                      borderBottom: '1px solid var(--border-color, #f1f5f9)',
                      backgroundColor: isUnmasked && isDownload ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                      whiteSpace: 'nowrap',
                      height: '38px'
                    }}
                  >
                    <td style={{ padding: '4px 8px', textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '4px 8px', fontFamily: 'monospace', color: 'var(--text-main, #0f172a)' }}>
                      {log.createdAt ? log.createdAt.replace('T', ' ').substring(0, 19) : '-'}
                    </td>
                    <td style={{ padding: '4px 8px', fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
                      {log.userName}
                      <span style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', marginLeft: '4px', fontWeight: 400 }}>
                        ({log.userId})
                      </span>
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 
                          log.actionType === 'EXCEL_DOWNLOAD' ? (isUnmasked ? '#fee2e2' : '#fef3c7') :
                          log.actionType === 'LOGIN' ? '#dcfce7' :
                          log.actionType === 'LOGOUT' ? '#f1f5f9' :
                          log.actionType === 'DELETE' ? '#fee2e2' :
                          '#eff6ff',
                        color:
                          log.actionType === 'EXCEL_DOWNLOAD' ? (isUnmasked ? '#b91c1c' : '#b45309') :
                          log.actionType === 'LOGIN' ? '#15803d' :
                          log.actionType === 'LOGOUT' ? '#475569' :
                          log.actionType === 'DELETE' ? '#dc2626' :
                          '#1d4ed8'
                      }}>
                        {log.actionType}
                      </span>
                    </td>
                    <td style={{ padding: '4px 8px', color: 'var(--text-secondary, #475569)' }}>
                      {log.targetMenu}
                    </td>
                    <td style={{ padding: '4px 8px', fontWeight: log.targetSubjectName ? 600 : 400, color: 'var(--text-main, #0f172a)' }}>
                      {log.targetSubjectName || '-'}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'center' }}>
                      {isUnmasked ? (
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', fontWeight: 700 }}>
                          비마스킹 (전체)
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--success-light)', color: '#047857', fontWeight: 600 }}>
                          마스킹 완료
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '4px 8px', color: 'var(--text-main, #0f172a)' }}>
                      {log.actionDetail}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          통계 검증 및 반기 감사 승인
          ───────────────────────────────────────────────────────────── */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        border: '1px solid var(--border-color, var(--border-color))',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* 대차대조 감사 통계 HUD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12.5px', color: 'var(--text-secondary, #475569)', flexWrap: 'wrap' }}>
          <span>총 접속 건수: <strong style={{ color: 'var(--text-main, #0f172a)' }}>{stats.total.toLocaleString()}</strong>건</span>
          <span>📥 엑셀 다운로드: <strong style={{ color: 'var(--warning)' }}>{stats.downloadCount.toLocaleString()}</strong>건</span>
          <span>🔓 비마스킹(전체정보) 다운로드: <strong style={{ color: stats.unmaskedDownloads > 0 ? '#dc2626' : 'var(--text-main, #0f172a)' }}>{stats.unmaskedDownloads.toLocaleString()}</strong>건</span>
          <span>👥 접속 임직원 수: <strong style={{ color: 'var(--primary, #4f46e5)' }}>{stats.uniqueUsers}</strong>명</span>
        </div>

        {/* 법정 반기 점검 승인 액션 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {auditCheckSign && (
            <div style={{ fontSize: '11.5px', color: '#047857', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={14} color="#059669" />
              반기 점검 승인됨: {auditCheckSign.checkedBy} ({auditCheckSign.checkedAt.substring(0, 10)})
            </div>
          )}
          {canAudit && (
            <button data-hs-trigger="Approve"
              type="button"
              onClick={handleConfirmAuditCheck}
              style={{
                padding: '7px 16px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--primary, #4f46e5)',
                color: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(79, 70, 229, 0.2)'
              }}
            >
              <UserCheck size={14} />
              반기 점검 완료 승인
            </button>
          )}
        </div>
      </div>
      </>
      )}

      {/* ─────────────────────────────────────────────────────────────
          🛡️ 인가된 개발자 물리 단말기
          ───────────────────────────────────────────────────────────── */}
      {activeAuditTab === 'DEVICES' && (isSuperAdmin || isExecutive) && (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', backgroundColor: 'var(--bg-card)', borderRadius: '6px', border: '1px solid var(--border-color)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* 패널 헤더 및 버튼군 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '12px',
            borderBottom: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #4f46e5)'
              }}>
                <Laptop size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main, #0f172a)' }}>
                  개발자 물리 단말기 인가 목록 및 통제 대장
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)' }}>
                  중앙 DB(Supabase developer_authorized_devices) 기반 하드웨어 접근 통제 및 비상 복구 체계
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowRegisterModal(true)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'var(--primary, #4f46e5)',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <Plus size={14} />
                신규 개발자 / 단말기 인가 등록
              </button>

              <button
                type="button"
                onClick={() => setShowBreakGlassModal(true)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: '1px solid rgba(220, 38, 38, 0.3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  color: '#dc2626',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap'
                }}
              >
                <AlertOctagon size={14} />
                비상 마스터 복구 지침 및 보안키
              </button>

              <button
                type="button"
                onClick={refreshDevices}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-secondary, #475569)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                <RefreshCw size={13} />
                새로고침
              </button>
            </div>
          </div>

          {/* 단말기 목록 고밀도 테이블 */}
          <div className="table-container" style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              textAlign: 'left'
            }}>
              <thead>
                <tr style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-color, #e2e8f0)',
                  color: 'var(--text-secondary, #475569)',
                  fontWeight: 700
                }}>
                  <th style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>단말기 식별</th>
                  <th style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>담당 개발자</th>
                  <th style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>물리 보안 식별자</th>
                  <th style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>인가 및 인증 일시</th>
                  <th style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>상태</th>
                  <th style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {authorizedDevices.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)' }}>
                      등록된 개발자 물리 단말기가 없습니다.
                    </td>
                  </tr>
                ) : (
                  authorizedDevices.map((dev) => (
                    <tr
                      key={dev.id || dev.deviceId}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: dev.status === 'ACTIVE' ? 'var(--bg-card)' : 'var(--bg-secondary)',
                        opacity: dev.status === 'REVOKED' ? 0.75 : 1
                      }}
                    >
                      <td style={{ padding: '4px 8px', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Cpu size={15} color="var(--primary, #4f46e5)" />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{dev.machineName}</span>
                              {dev.isPrimary && (
                                <span style={{
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: 'rgba(79, 70, 229, 0.12)',
                                  color: 'var(--primary, #4f46e5)'
                                }}>
                                  대표 기기
                                </span>
                              )}
                              {dev.emergencyBreakGlassUsed && (
                                <span style={{
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: '#fee2e2',
                                  color: '#dc2626'
                                }}>
                                  비상 복구
                                </span>
                              )}
                            </div>
                            {dev.note && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: 400 }}>
                                {dev.note}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '4px 8px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-main, #0f172a)' }}>
                          {dev.developerName || '대표 개발자'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary, #64748b)' }}>
                          ID: {dev.developerId || 'sys-admin'}
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'monospace', fontWeight: 700, color: '#0f766e', fontSize: '12px' }}>
                          <Network size={13} color="#0d9488" />
                          <span>{dev.macAddress}</span>
                        </div>
                        <div style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--text-muted, #64748b)', marginTop: '2px' }}>
                          지문: {dev.hardwareFingerprint}
                        </div>
                      </td>
                      <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', fontSize: '11.5px', color: 'var(--text-secondary, #64748b)' }}>
                        <div>등록: {dev.registeredAt ? dev.registeredAt.replace('T', ' ').substring(0, 16) : '-'}</div>
                        <div style={{ color: 'var(--text-muted, #64748b)', fontSize: '11px', marginTop: '2px' }}>
                          인증: {dev.lastVerifiedAt ? dev.lastVerifiedAt.replace('T', ' ').substring(0, 16) : '-'}
                        </div>
                      </td>
                      <td style={{ padding: '4px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {dev.status === 'ACTIVE' ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            backgroundColor: '#dcfce7',
                            color: '#166534',
                            border: '1px solid #86efac'
                          }}>
                            인가 활성
                          </span>
                        ) : dev.status === 'EMERGENCY_TEMP' ? (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid #fde68a'
                          }}>
                            임시 복구
                          </span>
                        ) : (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '9999px',
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            border: '1px solid #fca5a5'
                          }}>
                            차단됨
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '4px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                        {dev.status === 'ACTIVE' || dev.status === 'EMERGENCY_TEMP' ? (
                          <button
                            type="button"
                            onClick={() => handleRevokeDevice(dev.id || dev.deviceId || '', dev.machineName)}
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '4px',
                              border: '1px solid #f87171',
                              backgroundColor: 'rgba(239, 68, 68, 0.05)',
                              color: '#dc2626',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Trash2 size={12} />
                            도난/분실 차단
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReactivateDevice(dev.id || dev.deviceId || '', dev.machineName)}
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              borderRadius: '4px',
                              border: '1px solid #86efac',
                              backgroundColor: 'rgba(34, 197, 94, 0.05)',
                              color: '#15803d',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <RotateCcw size={12} />
                            인가 재승인
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
      )}

      {/* ─────────────────────────────────────────────────────────────
          모달 A: 신규 개발자 및 물리 단말기 인가 등록 모달
          ───────────────────────────────────────────────────────────── */}
      {showRegisterModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '520px',
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Laptop size={18} color="var(--primary, #4f46e5)" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: 'var(--text-main)' }}>
                  신규 개발자 및 물리 단말기 인가 등록
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRegisterModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleRegisterDeviceSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* 담당 개발자 선택 (상하 스택) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                  담당 개발자 계정 선택 / 입력
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <select
                    value={regDevId}
                    onChange={(e) => {
                      const selId = e.target.value;
                      setRegDevId(selId);
                      const matched = users.find(u => u.id === selId || u.loginId === selId);
                      if (matched) {
                        setRegDevName(matched.name);
                      }
                    }}
                    style={{
                      padding: '8px 10px',
                      fontSize: '12.5px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-main)',
                      outline: 'none'
                    }}
                  >
                    <option value="sys-admin">대표 개발자</option>
                    {users
                      .filter(u => u.id !== 'sys-admin')
                      .map(u => (
                        <option key={u.id} value={u.loginId || u.id}>
                          {u.name} ({u.position || u.role} / {u.department || '개발'})
                        </option>
                      ))}
                    <option value="custom">직접 입력 (신규 채용 개발자)</option>
                  </select>

                  <input
                    type="text"
                    value={regDevName}
                    onChange={(e) => setRegDevName(e.target.value)}
                    placeholder="개발자 성명 (예: 김개발)"
                    required
                    style={{
                      padding: '8px 10px',
                      fontSize: '12.5px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-main)',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* 단말기명 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                  단말기 식별 명칭
                </label>
                <input
                  type="text"
                  value={regMachineName}
                  onChange={(e) => setRegMachineName(e.target.value)}
                  placeholder="예: 2차 개발자 업무용 랩탑, 연구실 메인 PC, 자택 서브 워크스테이션"
                  required
                  style={{
                    padding: '8px 10px',
                    fontSize: '12.5px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    outline: 'none'
                  }}
                />
              </div>

              {/* 물리 MAC 주소 및 자동 감지 버튼 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                    물리 네트워크 MAC 주소
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectCurrentPc}
                    disabled={isDetecting}
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: '1px solid var(--primary, #4f46e5)',
                      backgroundColor: 'rgba(79, 70, 229, 0.08)',
                      color: 'var(--primary, #4f46e5)',
                      cursor: isDetecting ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshCw size={11} className={isDetecting ? 'animate-spin' : ''} />
                    현재 접속 PC 정보 감지
                  </button>
                </div>
                <input
                  type="text"
                  value={regMacAddress}
                  onChange={(e) => setRegMacAddress(e.target.value.toUpperCase())}
                  placeholder="물리 네트워크 주소 입력"
                  required
                  style={{
                    padding: '8px 10px',
                    fontSize: '12.5px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: '#0f766e',
                    outline: 'none'
                  }}
                />
              </div>

              {/* 마스터 보안키 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                  개발자 마스터 보안 패스프레이즈
                </label>
                <input
                  type="password"
                  value={regMasterKey}
                  onChange={(e) => setRegMasterKey(e.target.value)}
                  placeholder="사전 인가된 마스터 보안키 입력"
                  required
                  style={{
                    padding: '8px 10px',
                    fontSize: '12.5px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    outline: 'none'
                  }}
                />
              </div>

              {/* 비고 및 등록 사유 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)' }}>
                  등록 사유 / 기기 비고
                </label>
                <input
                  type="text"
                  value={regNote}
                  onChange={(e) => setRegNote(e.target.value)}
                  placeholder="예: 추가 채용 개발 직원 업무 기기, 외근 점검용 랩탑"
                  style={{
                    padding: '8px 10px',
                    fontSize: '12.5px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-main)',
                    outline: 'none'
                  }}
                />
              </div>

              {/* 버튼군 */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '8px',
                marginTop: '10px'
              }}>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  style={{
                    padding: '8px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-app)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isRegistering}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--primary, #4f46e5)',
                    color: '#ffffff',
                    cursor: isRegistering ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <CheckCircle size={14} />
                  {isRegistering ? '등록 중...' : '공인 단말기 등록 및 DB 영구 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          모달 B: 비상 마스터 복구 지침 및 보안키 안내 모달
          ───────────────────────────────────────────────────────────── */}
      {showBreakGlassModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '580px',
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(239, 68, 68, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertOctagon size={20} color="#dc2626" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#b91c1c' }}>
                    비상 마스터 복구 및 재해 대비 표준 지침
                  </h3>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    개발자 PC 고장, 도난, 분실 시 긴급 접근권 복구 및 원격 보안 조치
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBreakGlassModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '12.5px', lineHeight: 1.6 }}>
              {/* 1. 비상 복구 보안키 */}
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 800, color: '#dc2626' }}>비상 마스터 복구 보안키</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(EMERGENCY_BREAK_GLASS_KEY);
                      showToast('비상 마스터 복구키가 클립보드에 복사되었습니다.');
                    }}
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '4px',
                      border: '1px solid #f87171',
                      backgroundColor: '#f5f2eb',
                      color: '#dc2626',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Copy size={11} />
                    복사
                  </button>
                </div>
                <code style={{
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#991b1b',
                  backgroundColor: '#fee2e2',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}>
                  {EMERGENCY_BREAK_GLASS_KEY}
                </code>
              </div>

              {/* 2. 비상 복구 절차 단계 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  1. 개발자 PC 고장/파손 시 긴급 복구 절차
                </div>
                <div style={{ color: 'var(--text-secondary)', paddingLeft: '8px', borderLeft: '2px solid var(--border-color)' }}>
                  새로운 PC 또는 임시 기기에서 관리자 로그인 시도시 <strong>[물리 단말기 인가 필요]</strong> 팝업이 표출됩니다.
                  상단의 <strong>[🚨 비상 마스터 복구 (고장/도난/분실)]</strong> 탭을 클릭하고 위 복구키와 사유를 입력하면 즉시 접속되며 새 기기로 등록됩니다.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  2. 도난 / 분실 시 원격 킬스위치 즉시 가동
                </div>
                <div style={{ color: 'var(--text-secondary)', paddingLeft: '8px', borderLeft: '2px solid #ef4444' }}>
                  기기를 분실하였거나 도난당한 경우, 비상 복구 팝업에서 분실 기기를 선택하여 차단하거나,
                  본 관리 대장의 <strong>[도난/분실 차단]</strong> 버튼을 1클릭하여 즉시 단말기 상태를 <strong>차단됨</strong>으로 무효화하십시오.
                  차단 즉시 해당 단말기에서는 로컬 토큰이 파기되어 더 이상 로그인이 불가능합니다.
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                  3. 무누락 감사 기록 및 중앙 DB 영구 보존
                </div>
                <div style={{ color: 'var(--text-secondary)', paddingLeft: '8px', borderLeft: '2px solid var(--primary, #4f46e5)' }}>
                  모든 단말기 등록, 인증 내역, 비상 복구 시도는 <strong>Supabase 중앙 DB의 developer_authorized_devices 및 privacy_access_logs 테이블에 1원/1로그 오차 없이 영구 저장</strong>됩니다.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowBreakGlassModal(false)}
                  style={{
                    padding: '8px 16px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--text-main)',
                    color: 'var(--bg-card)',
                    cursor: 'pointer'
                  }}
                >
                  확인 완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
