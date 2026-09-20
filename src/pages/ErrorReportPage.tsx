// src/pages/ErrorReportPage.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { 
  AlertTriangle, CheckCircle2, Clock, FileText, Image as ImageIcon, 
  Paperclip, Plus, Search, Download, Trash2, X, Eye, RefreshCw, 
  ArrowRight, UserCheck, ShieldAlert, FileSpreadsheet, RotateCcw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  ErrorReport, 
  ErrorReportStatus, 
  ErrorReportSeverity, 
  ErrorReportCategory, 
  ErrorReportAttachment 
} from '../services/db';
import { SYSTEM_MENU_CONFIG } from '../config/menu_config';

export const ErrorReportPage: React.FC = () => {
  const { 
    errorReports, 
    addErrorReport, 
    receiveErrorReport, 
    completeErrorReport, 
    cancelErrorReport, 
    reopenErrorReport, 
    deleteErrorReport,
    currentUser,
    users,
    showErrorModal
  } = useApp();

  // ─── 필터 및 검색 상태 (Gutenberg Z-패턴: 좌상단 Scope) ───
  const [stageFilter, setStageFilter] = useState<'ALL' | ErrorReportStatus>('ALL');
  const [menuFilter, setMenuFilter] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // ─── 모달 상태 ───
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ErrorReport | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // ─── 신규 등록 폼 상태 (1단계: 신고 등록) ───
  const [formTitle, setFormTitle] = useState('');
  const [formMenuId, setFormMenuId] = useState('dashboard');
  const [formCategory, setFormCategory] = useState<ErrorReportCategory>('UI_DISPLAY');
  const [formSeverity, setFormSeverity] = useState<ErrorReportSeverity>('MEDIUM');
  const [formDescription, setFormDescription] = useState('');
  const [formAttachments, setFormAttachments] = useState<ErrorReportAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── 접수 처리 폼 상태 (2단계: 접수 처리) ───
  const [receptionAssigneeId, setReceptionAssigneeId] = useState('');
  const [receptionNote, setReceptionNote] = useState('');
  const [targetCompletionDate, setTargetCompletionDate] = useState('');

  // ─── 완료 처리 폼 상태 (3단계: 완료 처리) ───
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolvedVersion, setResolvedVersion] = useState('v1.14.0.Build.85');
  const [rootCause, setRootCause] = useState('');

  // ─── 취소 사유 상태 ───
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelPromptOpen, setIsCancelPromptOpen] = useState(false);

  // ─── 토스트 알림 상태 (헌장 5.2) ───
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 관리자/개발자 권한 여부
  const isSystemAdmin = currentUser?.role === 'ADMIN' || currentUser?.loginId === 'admin' || currentUser?.id === 'sys-admin';

  // 메뉴 옵션 플랫 목록 추출
  const menuOptions = useMemo(() => {
    const list: { id: string; name: string; groupName: string }[] = [];
    SYSTEM_MENU_CONFIG.forEach(grp => {
      grp.items.forEach(item => {
        list.push({ id: item.id, name: item.name, groupName: grp.name });
      });
    });
    return list;
  }, []);

  // ─── 클립보드 붙여넣기(Ctrl+V) 이미지 자동 첨부 리스너 (헌장 1.1 극대화) ───
  useEffect(() => {
    if (!isRegisterModalOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
            showToast('클립보드 캡처 이미지가 첨부되었습니다.', 'success');
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isRegisterModalOpen]);

  // 파일 처리 및 Base64 변환 (이미지, 엑셀, 문서 지원)
  const processFile = (file: File) => {
    if (file.size > 15 * 1024 * 1024) {
      showErrorModal('파일 크기가 15MB를 초과하여 첨부할 수 없습니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const newAtt: ErrorReportAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name || `capture_${new Date().toISOString().slice(0, 10)}.png`,
        size: file.size,
        type: file.type || 'application/octet-stream',
        url,
        uploadedAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
      };
      setFormAttachments(prev => [...prev, newAtt]);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      Array.from(e.target.files).forEach(f => processFile(f));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      Array.from(e.dataTransfer.files).forEach(f => processFile(f));
    }
  };

  const removeAttachment = (id: string) => {
    setFormAttachments(prev => prev.filter(a => a.id !== id));
  };

  // ─── 3단계 통계 카운터 ───
  const stats = useMemo(() => {
    const registered = errorReports.filter(r => r.status === 'REGISTERED').length;
    const inProgress = errorReports.filter(r => r.status === 'IN_PROGRESS').length;
    const completed = errorReports.filter(r => r.status === 'COMPLETED').length;
    const cancelled = errorReports.filter(r => r.status === 'CANCELLED').length;
    return { registered, inProgress, completed, cancelled, total: errorReports.length };
  }, [errorReports]);

  // ─── 목록 필터링 ───
  const filteredReports = useMemo(() => {
    return errorReports.filter(r => {
      if (stageFilter !== 'ALL' && r.status !== stageFilter) return false;
      if (menuFilter !== 'ALL' && r.menuId !== menuFilter) return false;
      if (severityFilter !== 'ALL' && r.severity !== severityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = r.title.toLowerCase().includes(q);
        const matchReportNo = r.reportNo.toLowerCase().includes(q);
        const matchReporter = r.reporterName.toLowerCase().includes(q);
        const matchMenu = (r.menuName || '').toLowerCase().includes(q);
        const matchDesc = r.description.toLowerCase().includes(q);
        if (!matchTitle && !matchReportNo && !matchReporter && !matchMenu && !matchDesc) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [errorReports, stageFilter, menuFilter, severityFilter, searchQuery]);

  // ─── 1단계: 신고 등록 실행 ───
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showErrorModal('신고 제목을 입력해 주세요.');
      return;
    }
    if (!formDescription.trim()) {
      showErrorModal('오류 상세 내용을 입력해 주세요.');
      return;
    }

    try {
      const selectedMenuObj = menuOptions.find(m => m.id === formMenuId);
      const menuName = selectedMenuObj ? `${selectedMenuObj.groupName} > ${selectedMenuObj.name}` : formMenuId;

      await addErrorReport({
        title: formTitle.trim(),
        description: formDescription.trim(),
        menuId: formMenuId,
        menuName,
        category: formCategory,
        severity: formSeverity,
        status: 'REGISTERED',
        reporterId: currentUser?.id || 'usr-anon',
        reporterName: currentUser?.name || '시스템사용자',
        reporterDept: (currentUser as any)?.department || (currentUser as any)?.departmentId || '소속부서',
        reporterPhone: (currentUser as any)?.phone || '',
        reportedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        attachments: formAttachments,
        environmentInfo: {
          userAgent: navigator.userAgent,
          screenResolution: `${window.innerWidth}x${window.innerHeight}`,
          activeUrl: window.location.pathname,
          appVersion: 'v1.14.0.Build.85'
        }
      });

      // 폼 초기화 및 모달 닫기
      setFormTitle('');
      setFormDescription('');
      setFormAttachments([]);
      setIsRegisterModalOpen(false);
      showToast('오류 신고가 등록되었습니다. 담당자가 확인 후 접수 처리합니다.', 'success');
    } catch (err: any) {
      showErrorModal(`오류 등록 실패: ${err.message || String(err)}`);
    }
  };

  // 상세 모달 열기
  const openDetailModal = (report: ErrorReport) => {
    setSelectedReport(report);
    // 기본 접수 담당자 세팅
    setReceptionAssigneeId(report.assigneeId || currentUser?.id || '');
    setReceptionNote(report.receptionNote || '');
    setTargetCompletionDate(report.targetCompletionDate || '');
    // 기본 완료 정보 세팅
    setResolutionNote(report.resolutionNote || '');
    setResolvedVersion(report.resolvedVersion || 'v1.14.0.Build.85');
    setRootCause(report.rootCause || '');
    setIsCancelPromptOpen(false);
    setCancelReason('');
    setIsDetailModalOpen(true);
  };

  // ─── 2단계: 접수 처리 실행 ───
  const handleReceiveSubmit = async () => {
    if (!selectedReport) return;
    try {
      const assigneeObj = users.find(u => u.id === receptionAssigneeId);
      const assigneeName = assigneeObj ? assigneeObj.name : (currentUser?.name || '담당자');

      await receiveErrorReport(selectedReport.id, {
        assigneeId: receptionAssigneeId || (currentUser?.id || 'usr-admin'),
        assigneeName,
        receptionNote: receptionNote.trim(),
        targetCompletionDate: targetCompletionDate || undefined
      });

      showToast(`[${selectedReport.reportNo}] 접수 처리가 완료되었습니다.`, 'success');
      setIsDetailModalOpen(false);
    } catch (err: any) {
      showErrorModal(`접수 처리 실패: ${err.message || String(err)}`);
    }
  };

  // ─── 3단계: 완료 처리 실행 ───
  const handleCompleteSubmit = async () => {
    if (!selectedReport) return;
    if (!resolutionNote.trim()) {
      showErrorModal('조치 내용 및 해결 내역을 입력해 주세요.');
      return;
    }

    try {
      await completeErrorReport(selectedReport.id, {
        resolutionNote: resolutionNote.trim(),
        resolvedVersion: resolvedVersion.trim() || 'v1.14.0.Build.85',
        rootCause: rootCause.trim()
      });

      showToast(`[${selectedReport.reportNo}] 오류 조치가 완료 처리되었습니다.`, 'success');
      setIsDetailModalOpen(false);
    } catch (err: any) {
      showErrorModal(`완료 처리 실패: ${err.message || String(err)}`);
    }
  };

  // 취소 처리
  const handleCancelSubmit = async () => {
    if (!selectedReport) return;
    try {
      await cancelErrorReport(selectedReport.id, cancelReason.trim());
      showToast(`[${selectedReport.reportNo}] 신고가 취소 처리되었습니다.`, 'warning');
      setIsDetailModalOpen(false);
    } catch (err: any) {
      showErrorModal(`취소 처리 실패: ${err.message || String(err)}`);
    }
  };

  // 재오픈
  const handleReopenSubmit = async () => {
    if (!selectedReport) return;
    try {
      await reopenErrorReport(selectedReport.id);
      showToast(`[${selectedReport.reportNo}] 신고가 다시 등록 상태로 재오픈되었습니다.`, 'success');
      setIsDetailModalOpen(false);
    } catch (err: any) {
      showErrorModal(`재오픈 실패: ${err.message || String(err)}`);
    }
  };

  // 삭제 처리
  const handleDeleteSubmit = async (id: string) => {
    if (!confirm('해당 오류 신고 레코드를 완전히 삭제하시겠습니까?')) return;
    try {
      await deleteErrorReport(id);
      showToast('오류 신고가 삭제되었습니다.', 'success');
      if (selectedReport?.id === id) setIsDetailModalOpen(false);
    } catch (err: any) {
      showErrorModal(`삭제 실패: ${err.message || String(err)}`);
    }
  };

  // ─── 엑셀 내보내기 (Gutenberg Z-패턴: 우상단 Pipeline) ───
  const handleExportExcel = () => {
    if (filteredReports.length === 0) {
      showToast('내보낼 오류 신고 데이터가 없습니다.', 'warning');
      return;
    }

    const rows = filteredReports.map(r => ({
      '신고번호': r.reportNo,
      '상태': r.status === 'REGISTERED' ? '신고등록' : r.status === 'IN_PROGRESS' ? '접수처리' : r.status === 'COMPLETED' ? '완료' : '취소',
      '중요도': r.severity === 'CRITICAL' ? '치명' : r.severity === 'HIGH' ? '긴급' : r.severity === 'MEDIUM' ? '보통' : '낮음',
      '오류유형': getCategoryLabel(r.category),
      '발생메뉴': r.menuName || r.menuId,
      '신고제목': r.title,
      '상세내용': r.description,
      '신고자': r.reporterName,
      '신고부서': r.reporterDept || '',
      '신고일시': r.reportedAt,
      '첨부개수': r.attachments?.length || 0,
      '접수자': r.receiverName || '',
      '담당자': r.assigneeName || '',
      '접수일시': r.receivedAt || '',
      '접수메모': r.receptionNote || '',
      '완료일시': r.completedAt || '',
      '완료처리자': r.resolverName || '',
      '조치내용': r.resolutionNote || '',
      '반영버전': r.resolvedVersion || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '오류신고대장');
    XLSX.writeFile(wb, `오류신고대장_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('오류 신고 대장 엑셀 파일이 다운로드되었습니다.', 'success');
  };

  // 레이블 헬퍼
  const getCategoryLabel = (cat: ErrorReportCategory) => {
    switch (cat) {
      case 'UI_DISPLAY': return '화면 / UI 오류';
      case 'DATA_CALC': return '데이터 / 계산 오류';
      case 'COMM_STORAGE': return '저장 / 통신 오류';
      case 'PERMISSION': return '권한 인가 오류';
      case 'FEATURE_REQUEST': return '기능 개선 요청';
      default: return '기타 오류';
    }
  };

  const getSeverityBadge = (sev: ErrorReportSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>치명</span>;
      case 'HIGH':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: '#FFEDD5', color: '#EA580C', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>긴급</span>;
      case 'MEDIUM':
        return <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--warning-light)', color: 'var(--warning)', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>보통</span>;
      default:
        return <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'var(--bg-app)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '11px', whiteSpace: 'nowrap' }}>낮음</span>;
    }
  };

  const getStatusBadge = (status: ErrorReportStatus) => {
    switch (status) {
      case 'REGISTERED':
        return <span style={{ padding: '3px 10px', borderRadius: '4px', backgroundColor: 'var(--warning-light)', color: 'var(--warning)', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> 신고등록</span>;
      case 'IN_PROGRESS':
        return <span style={{ padding: '3px 10px', borderRadius: '4px', backgroundColor: 'var(--info-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><RefreshCw size={12} /> 접수처리</span>;
      case 'COMPLETED':
        return <span style={{ padding: '3px 10px', borderRadius: '4px', backgroundColor: 'var(--success-light)', color: 'var(--success)', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle2 size={12} /> 완료</span>;
      case 'CANCELLED':
        return <span style={{ padding: '3px 10px', borderRadius: '4px', backgroundColor: 'var(--bg-app)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '12px', whiteSpace: 'nowrap' }}>취소</span>;
    }
  };

  return (
    <div style={{ padding: '20px', width: '100%', boxSizing: 'border-box' }}>
      {/* ─── 토스트 알림 ─── */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '12px 20px',
          borderRadius: '8px',
          backgroundColor: toastMessage.type === 'error' ? '#EF4444' : toastMessage.type === 'warning' ? '#F59E0B' : '#10B981',
          color: '#FFFFFF',
          fontWeight: 600,
          fontSize: '14px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {toastMessage.text}
        </div>
      )}

      {/* ─── 화면 헤더 및 3대 단계 요약 HUD (Gutenberg Z-패턴: 상단) ─── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'var(--info-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>오류 신고 관리</h2>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              등록 ➔ 접수 ➔ 완료 3단계 처리 파이프라인 및 증빙 파일 첨부
            </div>
          </div>
        </div>

        {/* 3대 단계 HUD 카드 */}
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
          <div 
            onClick={() => setStageFilter('REGISTERED')}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '8px', 
              border: stageFilter === 'REGISTERED' ? '2px solid #D97706' : '1px solid var(--border-color)', 
              backgroundColor: stageFilter === 'REGISTERED' ? '#FEF3C7' : 'var(--bg-app)', 
              cursor: 'pointer',
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px' 
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--warning)', fontWeight: 600 }}>1단계: 신고등록</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--warning)' }}>{stats.registered}</div>
          </div>

          <div 
            onClick={() => setStageFilter('IN_PROGRESS')}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '8px', 
              border: stageFilter === 'IN_PROGRESS' ? '2px solid #2563EB' : '1px solid var(--border-color)', 
              backgroundColor: stageFilter === 'IN_PROGRESS' ? '#DBEAFE' : 'var(--bg-app)', 
              cursor: 'pointer',
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px' 
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>2단계: 접수처리</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>{stats.inProgress}</div>
          </div>

          <div 
            onClick={() => setStageFilter('COMPLETED')}
            style={{ 
              padding: '8px 16px', 
              borderRadius: '8px', 
              border: stageFilter === 'COMPLETED' ? '2px solid #16A34A' : '1px solid var(--border-color)', 
              backgroundColor: stageFilter === 'COMPLETED' ? '#DCFCE7' : 'var(--bg-app)', 
              cursor: 'pointer',
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px' 
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600 }}>3단계: 완료</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--success)' }}>{stats.completed}</div>
          </div>
        </div>
      </div>

      {/* ─── 컨트롤 패널 (Gutenberg Z-패턴: ① 좌상단 Scope & ② 우상단 Pipeline) ─── */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-end', 
        padding: '14px 18px', 
        backgroundColor: 'var(--bg-surface)', 
        borderRadius: '8px', 
        border: '1px solid var(--border-color)', 
        marginBottom: '16px',
        gap: '16px',
        flexWrap: 'nowrap'
      }}>
        {/* ① 좌상단: 조회 필터 (헌장 3.4 상하 세로 스택) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'nowrap', flexShrink: 0 }}>
          {/* 상태별 탭 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>단계 구분</label>
            <div style={{ display: 'flex', borderRadius: '6px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              {(['ALL', 'REGISTERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).map(st => (
                <button
                  key={st}
                  onClick={() => setStageFilter(st)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: stageFilter === st ? 700 : 500,
                    backgroundColor: stageFilter === st ? '#2563EB' : 'var(--bg-app)',
                    color: stageFilter === st ? '#FFFFFF' : 'var(--text-primary)',
                    border: 'none',
                    borderRight: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {st === 'ALL' ? `전체 (${stats.total})` : st === 'REGISTERED' ? `신고등록 (${stats.registered})` : st === 'IN_PROGRESS' ? `접수 (${stats.inProgress})` : st === 'COMPLETED' ? `완료 (${stats.completed})` : `취소 (${stats.cancelled})`}
                </button>
              ))}
            </div>
          </div>

          {/* 메뉴 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>발생 메뉴</label>
            <select
              value={menuFilter}
              onChange={e => setMenuFilter(e.target.value)}
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                minWidth: '150px'
              }}
            >
              <option value="ALL">전체 메뉴</option>
              {menuOptions.map(m => (
                <option key={m.id} value={m.id}>[{m.groupName}] {m.name}</option>
              ))}
            </select>
          </div>

          {/* 심각도 필터 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>중요도</label>
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              style={{
                height: '34px',
                padding: '0 10px',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                fontSize: '13px',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                minWidth: '90px'
              }}
            >
              <option value="ALL">전체</option>
              <option value="CRITICAL">치명</option>
              <option value="HIGH">긴급</option>
              <option value="MEDIUM">보통</option>
              <option value="LOW">낮음</option>
            </select>
          </div>

          {/* 검색창 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>검색</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="제목, 신고자, 내용 검색"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  height: '34px',
                  paddingLeft: '32px',
                  paddingRight: '10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  fontSize: '13px',
                  backgroundColor: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  width: '180px'
                }}
              />
            </div>
          </div>
        </div>

        {/* ② 우상단: 데이터 유입 및 완결 액션 (Pipeline) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={handleExportExcel}
            style={{
              height: '36px',
              padding: '0 14px',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-app)',
              color: 'var(--text-primary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <Download size={14} />
            엑셀 내보내기
          </button>

          <button
            onClick={() => setIsRegisterModalOpen(true)}
            style={{
              height: '36px',
              padding: '0 16px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: 'var(--primary)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <Plus size={15} />
            신고 등록
          </button>
        </div>
      </div>

      {/* ─── ③ 중앙 본문: 고밀도 오류 신고 대장 그리드 (화면 80% 작업대) ─── */}
      <div style={{ 
        backgroundColor: 'var(--bg-surface)', 
        borderRadius: '8px', 
        border: '1px solid var(--border-color)', 
        overflowX: 'auto',
        minHeight: '480px'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '1.5px solid var(--border-color)', height: '40px' }}>
              <th style={{ padding: '0 12px', whiteSpace: 'nowrap', width: '80px', flexShrink: 0 }}>처리</th>
              <th style={{ padding: '0 12px', whiteSpace: 'nowrap', width: '90px' }}>단계</th>
              <th style={{ padding: '0 12px', whiteSpace: 'nowrap', width: '120px' }}>신고번호</th>
              <th style={{ padding: '0 12px', whiteSpace: 'nowrap', width: '60px' }}>중요도</th>
              <th style={{ padding: '0 12px', whiteSpace: 'nowrap', width: '110px' }}>오류유형</th>
              <th style={{ padding: '0 12px', whiteSpace: 'nowrap', width: '140px' }}>발생메뉴</th>
              <th style={{ padding: '0 12px', whiteSpace: 'nowrap', minWidth: '220px' }}>신고제목</th>
              <th style={{ padding: '0 12px', whiteSpace: 'nowrap', width: '60px' }}>첨부</th>
              <th style={{ padding: '0 12px', whiteSpace: 'nowrap', width: '90px' }}>신고자</th>
              <th style={{ padding: '0 12px', whiteSpace: 'nowrap', width: '130px' }}>신고일시</th>
              <th style={{ padding: '0 12px', whiteSpace: 'nowrap', width: '90px' }}>담당자</th>
              <th style={{ padding: '0 12px', whiteSpace: 'nowrap', width: '70px', textAlign: 'center' }}>삭제</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
                  등록된 오류 신고 내역이 없습니다.
                </td>
              </tr>
            ) : (
              filteredReports.map(r => (
                <tr 
                  key={r.id} 
                  style={{ 
                    borderBottom: '1px solid var(--border-color)', 
                    height: '40px',
                    backgroundColor: selectedReport?.id === r.id ? '#EFF6FF' : 'transparent',
                    transition: 'background-color 0.15s'
                  }}
                >
                  {/* 핵심 액션 컬럼 좌측 배치 (헌장 3.2) */}
                  <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => openDetailModal(r)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        border: '1px solid #2563EB',
                        backgroundColor: 'var(--info-light)',
                        color: 'var(--primary)',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      상세 ➔
                    </button>
                  </td>
                  <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>{getStatusBadge(r.status)}</td>
                  <td style={{ padding: '0 12px', whiteSpace: 'nowrap', fontFamily: 'monospace', fontWeight: 600 }}>{r.reportNo}</td>
                  <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>{getSeverityBadge(r.severity)}</td>
                  <td style={{ padding: '0 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{getCategoryLabel(r.category)}</td>
                  <td style={{ padding: '0 12px', whiteSpace: 'nowrap', color: '#1E40AF', fontWeight: 600 }}>{r.menuName || r.menuId}</td>
                  <td style={{ padding: '0 12px', whiteSpace: 'nowrap', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span 
                      onClick={() => openDetailModal(r)} 
                      style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}
                      title={r.title}
                    >
                      {r.title}
                    </span>
                  </td>
                  <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>
                    {r.attachments && r.attachments.length > 0 ? (
                      <span style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '2px', 
                        fontSize: '11px', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        backgroundColor: '#E0E7FF', 
                        color: '#3730A3', 
                        fontWeight: 600 
                      }}>
                        <Paperclip size={10} /> {r.attachments.length}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '0 12px', whiteSpace: 'nowrap' }}>{r.reporterName}</td>
                  <td style={{ padding: '0 12px', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-secondary)' }}>{r.reportedAt}</td>
                  <td style={{ padding: '0 12px', whiteSpace: 'nowrap', fontWeight: 600, color: r.assigneeName ? '#1D4ED8' : '#9CA3AF' }}>
                    {r.assigneeName || '미배정'}
                  </td>
                  <td style={{ padding: '0 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => handleDeleteSubmit(r.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      title="삭제"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ─── 모달 1: 신규 신고 등록 (1단계) ─── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {isRegisterModalOpen && (
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
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '10px',
            width: '740px',
            maxWidth: '100%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden'
          }}>
            {/* 모달 헤더 */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#2563EB" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>신규 오류 신고 등록</h3>
              </div>
              <button
                onClick={() => setIsRegisterModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 모달 본문 (스크롤) */}
            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 헌장 3.4 레이블-입력 상하 세로 스택 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    신고 제목 <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="오류 현상을 간략하고 명확히 기재해 주세요 (예: 출고 검수 저장 시 404 오류)"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    style={{
                      height: '38px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '13px',
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  {/* 발생 메뉴 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>발생 메뉴</label>
                    <select
                      value={formMenuId}
                      onChange={e => setFormMenuId(e.target.value)}
                      style={{
                        height: '38px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '13px',
                        backgroundColor: 'var(--bg-app)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      {menuOptions.map(m => (
                        <option key={m.id} value={m.id}>[{m.groupName}] {m.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 오류 유형 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>오류 유형</label>
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value as ErrorReportCategory)}
                      style={{
                        height: '38px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '13px',
                        backgroundColor: 'var(--bg-app)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="UI_DISPLAY">화면 / UI 오류</option>
                      <option value="DATA_CALC">데이터 / 계산 오류</option>
                      <option value="COMM_STORAGE">저장 / 통신 오류</option>
                      <option value="PERMISSION">권한 인가 오류</option>
                      <option value="FEATURE_REQUEST">기능 개선 요청</option>
                      <option value="OTHER">기타</option>
                    </select>
                  </div>

                  {/* 중요도 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>중요도</label>
                    <select
                      value={formSeverity}
                      onChange={e => setFormSeverity(e.target.value as ErrorReportSeverity)}
                      style={{
                        height: '38px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '13px',
                        backgroundColor: 'var(--bg-app)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <option value="LOW">보통 (낮음)</option>
                      <option value="MEDIUM">중요 (일반)</option>
                      <option value="HIGH">긴급 (업무차질)</option>
                      <option value="CRITICAL">치명 (시스템중단)</option>
                    </select>
                  </div>
                </div>

                {/* 오류 상세 내용 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    상세 내용 및 재현 경로 <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="어떤 화면에서 어떤 버튼을 눌렀을 때 어떤 오류 메시지나 이상 현상이 발생하였는지 기재해 주세요."
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '13px',
                      backgroundColor: 'var(--bg-app)',
                      color: 'var(--text-primary)',
                      resize: 'vertical',
                      lineHeight: '1.5'
                    }}
                  />
                </div>

                {/* ─── 파일 첨부 영역 (드래그앤드롭 + 클립보드 Ctrl+V) ─── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      첨부 파일 (스크린샷 캡처 이미지, 엑셀, 문서 등)
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600 }}>
                      💡 화면 캡처 후 이 창에서 바로 Ctrl+V 로 붙여넣기 가능
                    </span>
                  </div>

                  {/* 드래그앤드롭 영역 */}
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: isDragging ? '2px dashed #2563EB' : '1.5px dashed var(--border-color)',
                      borderRadius: '8px',
                      padding: '18px',
                      textAlign: 'center',
                      backgroundColor: isDragging ? '#EFF6FF' : 'var(--bg-app)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".png,.jpg,.jpeg,.gif,.webp,.xlsx,.xls,.csv,.pdf,.txt,.zip"
                      onChange={handleFileInputChange}
                      style={{ display: 'none' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)' }}>
                        <ImageIcon size={20} />
                        <FileSpreadsheet size={20} />
                        <Paperclip size={20} />
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        파일을 드래그하여 놓거나 클릭하여 선택
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        지원 형식: PNG, JPG, WebP 캡처 이미지 / XLSX, XLS, CSV 엑셀 / PDF, TXT (최대 15MB)
                      </div>
                    </div>
                  </div>

                  {/* 첨부 파일 목록 렌더링 */}
                  {formAttachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                      {formAttachments.map(att => (
                        <div
                          key={att.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 10px',
                            backgroundColor: 'var(--bg-app)',
                            borderRadius: '6px',
                            border: '1px solid #E5E7EB',
                            fontSize: '12px'
                          }}
                        >
                          {att.type.startsWith('image/') ? (
                            <img 
                              src={att.url} 
                              alt={att.name} 
                              onClick={(e) => { e.stopPropagation(); setImagePreviewUrl(att.url); }}
                              style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in' }} 
                            />
                          ) : (
                            <FileSpreadsheet size={16} color="#059669" />
                          )}
                          <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            {att.name}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({(att.size / 1024).toFixed(1)} KB)</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '2px' }}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 시스템 자동 감지 정보 (접속 환경) */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    신고자: <strong>{currentUser?.name || '시스템사용자'}</strong> | 브라우저: <strong>{navigator.userAgent.includes('Chrome') ? 'Chrome' : '브라우저'}</strong> | 해상도: <strong>{window.innerWidth}x{window.innerHeight}</strong>
                  </div>
                  <div style={{ color: 'var(--success)', fontWeight: 600 }}>환경 정보 자동 첨부됨</div>
                </div>
              </div>

              {/* 모달 푸터 (Gutenberg Z-패턴: ④ 우하단 Terminal Action) */}
              <div style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-app)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px'
              }}>
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  style={{
                    height: '36px',
                    padding: '0 16px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  style={{
                    height: '36px',
                    padding: '0 20px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--primary)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  신고 등록 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ─── 모달 2: 상세 조회 및 2/3단계 처리 (접수 및 완료) ─── */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {isDetailModalOpen && selectedReport && (
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
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            borderRadius: '10px',
            width: '840px',
            maxWidth: '100%',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
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
                <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '14px', color: 'var(--primary)' }}>
                  {selectedReport.reportNo}
                </span>
                {getStatusBadge(selectedReport.status)}
                {getSeverityBadge(selectedReport.severity)}
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  [{getCategoryLabel(selectedReport.category)}]
                </span>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* 모달 본문 (스크롤) */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto', flex: 1 }}>
              {/* 오류 기본 정보 */}
              <div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedReport.title}
                </h3>
                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                  <div>발생메뉴: <strong>{selectedReport.menuName || selectedReport.menuId}</strong></div>
                  <div>신고자: <strong>{selectedReport.reporterName} ({selectedReport.reporterDept || '미지정'})</strong></div>
                  <div>신고일시: <strong>{selectedReport.reportedAt}</strong></div>
                  {selectedReport.reporterPhone && <div>연락처: <strong>{selectedReport.reporterPhone}</strong></div>}
                </div>
              </div>

              {/* 상세 내용 박스 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>오류 상세 내용</label>
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-primary)'
                }}>
                  {selectedReport.description}
                </div>
              </div>

              {/* 첨부 파일 갤러리 */}
              {selectedReport.attachments && selectedReport.attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    첨부 파일 목록 ({selectedReport.attachments.length}건)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                    {selectedReport.attachments.map(att => (
                      <div
                        key={att.id}
                        style={{
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '8px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          backgroundColor: 'var(--bg-surface)'
                        }}
                      >
                        {att.type.startsWith('image/') ? (
                          <img
                            src={att.url}
                            alt={att.name}
                            onClick={() => setImagePreviewUrl(att.url)}
                            style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', cursor: 'zoom-in' }}
                          />
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '4px', backgroundColor: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileSpreadsheet size={22} color="#059669" />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={att.name}>
                            {att.name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {(att.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                        <a
                          href={att.url}
                          download={att.name}
                          style={{
                            padding: '6px',
                            borderRadius: '4px',
                            color: 'var(--primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'var(--info-light)'
                          }}
                          title="다운로드"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 시스템 접속 환경 정보 */}
              {selectedReport.environmentInfo && (
                <div style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-app)',
                  border: '1px solid var(--border-color)',
                  fontSize: '11px',
                  color: 'var(--text-secondary)'
                }}>
                  접속 환경: {selectedReport.environmentInfo.userAgent} | 해상도: {selectedReport.environmentInfo.screenResolution} | 버전: {selectedReport.environmentInfo.appVersion}
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />

              {/* ─── 2단계: 접수 처리 섹션 ─── */}
              <div style={{
                padding: '14px',
                borderRadius: '8px',
                border: '1.5px solid #BFDBFE',
                backgroundColor: 'var(--bg-app)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'var(--primary)' }}>
                    <UserCheck size={16} />
                    2단계: 접수 처리 (담당자 배정 및 1차 진단)
                  </div>
                  {selectedReport.receivedAt && (
                    <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>
                      ✓ {selectedReport.receivedAt} 접수완료 (접수자: {selectedReport.receiverName})
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>처리 담당자 지정</label>
                    <select
                      value={receptionAssigneeId}
                      onChange={e => setReceptionAssigneeId(e.target.value)}
                      disabled={selectedReport.status === 'COMPLETED'}
                      style={{
                        height: '34px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '12px',
                        backgroundColor: 'var(--bg-surface)'
                      }}
                    >
                      <option value="">담당자 선택</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>[{u.department || '팀'}] {u.name} ({u.position || '담당'})</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>조치 예정일</label>
                    <input
                      type="date"
                      value={targetCompletionDate}
                      onChange={e => setTargetCompletionDate(e.target.value)}
                      disabled={selectedReport.status === 'COMPLETED'}
                      style={{
                        height: '34px',
                        padding: '0 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '12px',
                        backgroundColor: 'var(--bg-surface)'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>접수 메모 및 1차 진단 코멘트</label>
                  <input
                    type="text"
                    placeholder="오류 원인 가설 또는 1차 분석 의견 (예: Supabase RLS 정책 검토 필요)"
                    value={receptionNote}
                    onChange={e => setReceptionNote(e.target.value)}
                    disabled={selectedReport.status === 'COMPLETED'}
                    style={{
                      height: '34px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '12px',
                      backgroundColor: 'var(--bg-surface)'
                    }}
                  />
                </div>

                {selectedReport.status === 'REGISTERED' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={handleReceiveSubmit}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'var(--primary)',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      [접수 처리 확정]
                    </button>
                  </div>
                )}
              </div>

              {/* ─── 3단계: 완료 처리 섹션 ─── */}
              <div style={{
                padding: '14px',
                borderRadius: '8px',
                border: '1.5px solid #BBF7D0',
                backgroundColor: 'var(--bg-app)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px', color: 'var(--success)' }}>
                    <CheckCircle2 size={16} />
                    3단계: 완료 처리 (수정 조치 및 배포 버전 확정)
                  </div>
                  {selectedReport.completedAt && (
                    <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>
                      ✓ {selectedReport.completedAt} 완료 확정 (처리자: {selectedReport.resolverName})
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      조치 내용 및 해결 방법 <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="적용된 코드 수정 또는 설정 조치 내용 기록"
                      value={resolutionNote}
                      onChange={e => setResolutionNote(e.target.value)}
                      disabled={selectedReport.status === 'COMPLETED' && !isSystemAdmin}
                      style={{
                        height: '34px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '12px',
                        backgroundColor: 'var(--bg-surface)'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>반영 버전</label>
                    <input
                      type="text"
                      placeholder="예: v1.14.0.Build.85"
                      value={resolvedVersion}
                      onChange={e => setResolvedVersion(e.target.value)}
                      disabled={selectedReport.status === 'COMPLETED' && !isSystemAdmin}
                      style={{
                        height: '34px',
                        padding: '0 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '12px',
                        backgroundColor: 'var(--bg-surface)'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>근본 원인 (재발 방지)</label>
                  <input
                    type="text"
                    placeholder="오류가 발생한 근본 원인 요약 (예: 원격 DB 컬럼 미반영)"
                    value={rootCause}
                    onChange={e => setRootCause(e.target.value)}
                    disabled={selectedReport.status === 'COMPLETED' && !isSystemAdmin}
                    style={{
                      height: '34px',
                      padding: '0 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      fontSize: '12px',
                      backgroundColor: 'var(--bg-surface)'
                    }}
                  />
                </div>

                {selectedReport.status !== 'COMPLETED' && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={handleCompleteSubmit}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'var(--success)',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      [완료 처리 확정]
                    </button>
                  </div>
                )}
              </div>

              {/* 취소 처리 프롬프트 */}
              {isCancelPromptOpen && (
                <div style={{
                  padding: '12px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--danger-light)',
                  border: '1px solid #FECACA',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--danger)' }}>신고 취소 사유 입력</div>
                  <input
                    type="text"
                    placeholder="중복 신고 또는 사용자 오작동 등 취소 사유 기재"
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    style={{
                      height: '32px',
                      padding: '0 8px',
                      borderRadius: '4px',
                      border: '1px solid #F87171',
                      fontSize: '12px'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setIsCancelPromptOpen(false)}
                      style={{ padding: '4px 10px', borderRadius: '4px', border: '1px solid #D1D5DB', fontSize: '11px', cursor: 'pointer' }}
                    >
                      닫기
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelSubmit}
                      style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--danger)', color: '#FFFFFF', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      취소 확정
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 모달 푸터 (Gutenberg Z-패턴: ④ 우하단 Terminal Actions) */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-app)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                {selectedReport.status !== 'CANCELLED' && selectedReport.status !== 'COMPLETED' && !isCancelPromptOpen && (
                  <button
                    type="button"
                    onClick={() => setIsCancelPromptOpen(true)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #FCA5A5',
                      backgroundColor: 'var(--danger-light)',
                      color: 'var(--danger)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    신고 취소
                  </button>
                )}
                {(selectedReport.status === 'COMPLETED' || selectedReport.status === 'CANCELLED') && (
                  <button
                    type="button"
                    onClick={handleReopenSubmit}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #D1D5DB',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RotateCcw size={12} />
                    재오픈
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                style={{
                  height: '36px',
                  padding: '0 20px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 모달 3: 첨부 이미지 고해상도 확대 미리보기 ─── */}
      {imagePreviewUrl && (
        <div 
          onClick={() => setImagePreviewUrl(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            cursor: 'zoom-out'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
            <img
              src={imagePreviewUrl}
              alt="오류 캡처 이미지 확대"
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
            />
            <button
              onClick={() => setImagePreviewUrl(null)}
              style={{
                position: 'absolute',
                top: '-14px',
                right: '-14px',
                backgroundColor: 'var(--bg-card)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
              }}
            >
              <X size={18} color="#111827" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
