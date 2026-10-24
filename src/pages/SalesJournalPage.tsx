// src/pages/SalesJournalPage.tsx
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { SalesJournal, SalesJournalStage, SalesJournalExtractedData } from '../services/db';
import {
  extractSalesJournalWithGroq,
  matchRegisteredCustomer,
  SALES_JOURNAL_STAGES,
} from '../services/salesJournalAiService';
import { getUserDepartmentName, getUserHierarchyLevel, isDeveloperUser } from '../utils/userDepartmentHelper';
import { exportToExcel } from '../services/excel';
import {
  BookOpen,
  Sparkles,
  Save,
  RotateCcw,
  Search,
  Download,
  Trash2,
  Edit3,
  CheckCircle2,
  Calendar,
  UserCheck,
  Building2,
  Mic,
  MicOff,
  FileText,
  X,
  ArrowRight,
  Clock,
} from 'lucide-react';

const STAGE_STYLE_MAP: Record<SalesJournalStage, { bg: string; text: string; border: string; desc: string }> = {
  '영업개시': {
    bg: '#eff6ff',
    text: '#1d4ed8',
    border: '#bfdbfe',
    desc: '초도 방문·신규 접촉·수요 파악',
  },
  '제안': {
    bg: '#f5f3ff',
    text: '#6d28d9',
    border: '#ddd6fe',
    desc: '장비 제원·안전옵션·투입 방안 제시',
  },
  '견적': {
    bg: '#fffbeb',
    text: '#b45309',
    border: '#fde68a',
    desc: '렌탈 단가·운송비·견적서 제출 협의',
  },
  '거래개시': {
    bg: '#ecfdf5',
    text: '#047857',
    border: '#a7f3d0',
    desc: '발주 확정·계약 체결·장비 투입 확정',
  },
};

const SAMPLE_PROMPTS: string[] = [
  '오늘 (주)삼진일렉스 박성민 부장님 만나서 평택 현장 26피트 4대, 45피트 2대 월 렌탈료 견적서 전달하고 단가 조건 협의함. 다음주 화요일 오전 10시에 최종 발주 여부 재통화하기로 함.',
  '주식회사 세보엠이씨 이정훈 소장님 초도 방문 인사드림. 용인 반도체 클린룸 공사 현장에 다음 달 중순부터 고소작업대 약 10대 규모 수요 있는 것 확인함. 금요일 오전에 현장 답사 재방문 예정.',
  '(주)유창이앤씨 김태호 공무과장님께 고덕 현장용 30피트 시저리프트 무상옵션 및 추락방지 안전옵션 장착 사양 카탈로그 제안 설명 완료. 내일 오후 2시 단가 견적서 메일 발송 예정.',
  '주식회사 라이즈리프트 최현우 대표님과 통화하여 아산 탕정 현장 19피트 6대 월 렌탈 계약 및 거래개시 확정. 내일 오전 8시 주기장 출고 진행하기로 합의함.',
];

export const SalesJournalPage: React.FC = () => {
  const {
    currentUser,
    users,
    departments,
    customers,
    salesJournals,
    saveSalesJournal,
    deleteSalesJournal,
    showErrorModal,
    showNoticeModal,
  } = useApp();

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // 권한 판정: 영업부, 경영진(Level 1 / 대표·부사장·임원), 관리부, 시스템관리자
  const accessInfo = useMemo(() => {
    if (!currentUser) return { canView: false, canWrite: false, isExecutive: false, deptName: '미배정' };
    const dev = isDeveloperUser(currentUser);
    const deptName = getUserDepartmentName(currentUser, departments);
    const level = getUserHierarchyLevel(currentUser, departments);
    const isExecutive =
      dev ||
      level === 1 ||
      currentUser.role === 'ADMIN' ||
      ['대표', '대표이사', '사장', '부사장', '상무', '전무', '이사'].some(p =>
        (currentUser.position || '').includes(p)
      );
    const isSales =
      deptName.includes('영업') ||
      (currentUser.position || '').includes('영업') ||
      (currentUser.role || '').toUpperCase().includes('SALES') ||
      currentUser.customRoleId === 'role_sales';
    const isMgmt =
      deptName.includes('관리') ||
      deptName.includes('경영') ||
      deptName.includes('기연리프트') ||
      currentUser.customRoleId === 'role_mgmt';

    return {
      canView: dev || isExecutive || isSales || isMgmt,
      canWrite: dev || isExecutive || isSales || isMgmt,
      isExecutive: dev || isExecutive || isMgmt,
      deptName,
    };
  }, [currentUser, departments]);

  // 영업사원 목록 (영업부 소속 임직원 + 일지 작성 이력이 있는 직원)
  const salespersonOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; position: string; department: string }>();
    (users || []).forEach(u => {
      if (u.status === 'RETIRED') return;
      const dName = getUserDepartmentName(u, departments);
      const isSalesOrExec =
        dName.includes('영업') ||
        (u.position || '').includes('영업') ||
        u.customRoleId === 'role_sales' ||
        ['대표이사', '부사장', '상무'].some(p => (u.position || '').includes(p));
      if (isSalesOrExec) {
        map.set(u.id, {
          id: u.id,
          name: u.name,
          position: u.position || '',
          department: dName,
        });
      }
    });
    if (currentUser && !map.has(currentUser.id)) {
      map.set(currentUser.id, {
        id: currentUser.id,
        name: currentUser.name,
        position: currentUser.position || '',
        department: accessInfo.deptName,
      });
    }
    (salesJournals || []).forEach(j => {
      if (j.salespersonId && !map.has(j.salespersonId)) {
        map.set(j.salespersonId, {
          id: j.salespersonId,
          name: j.salespersonName || j.salespersonId,
          position: '',
          department: j.department || '영업부',
        });
      }
    });
    return Array.from(map.values());
  }, [users, departments, currentUser, salesJournals, accessInfo.deptName]);

  // ─── 작성/편집 폼 상태 ───
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rawContent, setRawContent] = useState<string>('');
  const [journalDate, setJournalDate] = useState<string>(todayStr);
  const [salespersonId, setSalespersonId] = useState<string>(() => currentUser?.id || '');
  const [customerName, setCustomerName] = useState<string>('');
  const [contactName, setContactName] = useState<string>('');
  const [contactTitle, setContactTitle] = useState<string>('');
  const [stage, setStage] = useState<SalesJournalStage>('영업개시');
  const [summary, setSummary] = useState<string>('');
  const [nextSchedule, setNextSchedule] = useState<string>('');
  const [nextScheduleDate, setNextScheduleDate] = useState<string>('');
  const [extractedJsonPreview, setExtractedJsonPreview] = useState<SalesJournalExtractedData | null>(null);
  const [usedAiModel, setUsedAiModel] = useState<string>('');
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showJsonFormatBox, setShowJsonFormatBox] = useState<boolean>(false);

  // 음성 인식 상태
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // ─── 목록 조회/필터 상태 ───
  const [selectedSalespersonFilter, setSelectedSalespersonFilter] = useState<string>('ALL');
  const [selectedStageFilter, setSelectedStageFilter] = useState<string>('ALL');
  const [startDateFilter, setStartDateFilter] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [endDateFilter, setEndDateFilter] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [detailJournal, setDetailJournal] = useState<SalesJournal | null>(null);
  const [sampleIdx, setSampleIdx] = useState<number>(0);

  // 입력된 고객명으로 등록 고객 자동 매칭 확인
  const matchedCustomer = useMemo(() => {
    return matchRegisteredCustomer(customerName, customers || []);
  }, [customerName, customers]);

  // 폼 초기화
  const handleResetForm = () => {
    setEditingId(null);
    setRawContent('');
    setJournalDate(todayStr);
    setSalespersonId(currentUser?.id || salespersonOptions[0]?.id || '');
    setCustomerName('');
    setContactName('');
    setContactTitle('');
    setStage('영업개시');
    setSummary('');
    setNextSchedule('');
    setNextScheduleDate('');
    setExtractedJsonPreview(null);
    setUsedAiModel('');
  };

  // 음성 받아쓰기 토글
  const handleToggleSpeech = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showErrorModal('현재 브라우저에서 음성 인식을 지원하지 않습니다. 크롬 또는 엣지 브라우저를 사용해주세요.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'ko-KR';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            transcript += event.results[i][0].transcript + ' ';
          }
        }
        if (transcript.trim()) {
          setRawContent(prev => (prev ? `${prev.trim()} ${transcript.trim()}` : transcript.trim()));
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch (e: any) {
      showErrorModal('음성 인식 시작 중 오류가 발생했습니다: ' + (e?.message || e));
    }
  };

  // Groq LLM 호출하여 원문에서 구조화 데이터 추출
  const handleExtractFromRaw = async (autoSaveAfterExtract = false) => {
    if (!rawContent.trim()) {
      showErrorModal('자연어 상담 원문을 먼저 입력해주세요.');
      return;
    }

    try {
      setIsExtracting(true);
      const res = await extractSalesJournalWithGroq(rawContent, journalDate || todayStr, customers || []);
      const ext = res.extracted;

      setJournalDate(ext.journalDate || todayStr);
      setCustomerName(ext.customerName || '');
      setContactName(ext.contactName || '');
      setContactTitle(ext.contactTitle || '');
      setStage(ext.stage || '영업개시');
      setSummary(ext.summary || '');
      setNextSchedule(ext.nextSchedule || '');
      setNextScheduleDate(ext.nextScheduleDate || '');
      setExtractedJsonPreview(ext);
      setUsedAiModel(res.aiModel);

      if (autoSaveAfterExtract) {
        await executeSaveJournal({
          targetDate: ext.journalDate || todayStr,
          targetCustomerName: ext.customerName || '미지정 고객',
          targetContactName: ext.contactName || '',
          targetContactTitle: ext.contactTitle || '',
          targetStage: ext.stage || '영업개시',
          targetSummary: ext.summary || rawContent.trim(),
          targetNextSchedule: ext.nextSchedule || '',
          targetNextScheduleDate: ext.nextScheduleDate || '',
          targetExtractedJson: ext,
          targetAiModel: res.aiModel,
        });
      }
    } catch (err: any) {
      showErrorModal(err?.message || '자연어 항목 추출 중 오류가 발생했습니다.');
    } finally {
      setIsExtracting(false);
    }
  };

  // 실제 DB 저장 실행
  const executeSaveJournal = async (override?: {
    targetDate: string;
    targetCustomerName: string;
    targetContactName: string;
    targetContactTitle: string;
    targetStage: SalesJournalStage;
    targetSummary: string;
    targetNextSchedule: string;
    targetNextScheduleDate: string;
    targetExtractedJson: SalesJournalExtractedData;
    targetAiModel: string;
  }) => {
    const finalRaw = rawContent.trim();
    if (!finalRaw) {
      showErrorModal('자연어 상담 원문을 입력해주세요.');
      return;
    }

    const finalDate = (override?.targetDate ?? journalDate) || todayStr;
    const finalCustName = (override?.targetCustomerName ?? customerName).trim();
    const finalContactName = (override?.targetContactName ?? contactName).trim();
    const finalContactTitle = (override?.targetContactTitle ?? contactTitle).trim();
    const finalStage = override?.targetStage ?? stage;
    const finalSummary = (override?.targetSummary ?? summary).trim();
    const finalNextSchedule = (override?.targetNextSchedule ?? nextSchedule).trim();
    const finalNextScheduleDate = (override?.targetNextScheduleDate ?? nextScheduleDate).trim();

    if (!finalCustName) {
      showErrorModal('고객명을 입력하거나 자동 항목 추출을 먼저 실행해주세요.');
      return;
    }
    if (!finalSummary) {
      showErrorModal('상담내용 요약을 입력하거나 자동 항목 추출을 먼저 실행해주세요.');
      return;
    }

    const spOption = salespersonOptions.find(s => s.id === salespersonId);
    const finalSpId = spOption?.id || currentUser?.id || 'unknown';
    const finalSpName = spOption?.name || currentUser?.name || '미지정';
    const finalDept = spOption?.department || accessInfo.deptName || '영업부';

    const matchedCust = matchRegisteredCustomer(finalCustName, customers || []);

    const structuredPayload: SalesJournalExtractedData = override?.targetExtractedJson || {
      journalDate: finalDate,
      customerName: matchedCust ? matchedCust.name : finalCustName,
      contactName: finalContactName,
      contactTitle: finalContactTitle,
      stage: finalStage,
      summary: finalSummary,
      nextSchedule: finalNextSchedule,
      nextScheduleDate: finalNextScheduleDate,
    };

    try {
      setIsSaving(true);
      const saved = await saveSalesJournal({
        id: editingId || undefined,
        journalDate: finalDate,
        salespersonId: finalSpId,
        salespersonName: finalSpName,
        department: finalDept,
        customerId: matchedCust?.id || '',
        customerName: matchedCust ? matchedCust.name : finalCustName,
        contactName: finalContactName,
        contactTitle: finalContactTitle,
        stage: finalStage,
        summary: finalSummary,
        nextSchedule: finalNextSchedule,
        nextScheduleDate: finalNextScheduleDate,
        rawContent: finalRaw,
        extractedJson: structuredPayload,
        aiModel: override?.targetAiModel || usedAiModel || 'openai/gpt-oss-120b',
      });

      setDetailJournal(saved);
      handleResetForm();
      showNoticeModal(
        editingId
          ? '영업일지 수정 내역이 저장되었습니다.'
          : `[${saved.stage}] ${saved.customerName} 영업일지가 원문 및 추출 데이터 포맷으로 저장되었습니다.`,
        '영업일지 저장 완료'
      );
    } catch (err: any) {
      showErrorModal(err?.message || '영업일지 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 저장 버튼 클릭 시: 아직 추출이 안 되어 고객명/요약이 비어있다면 자동으로 Groq LLM 추출 후 저장!
  const handleSaveButtonClick = async () => {
    if (!rawContent.trim()) {
      showErrorModal('자연어 상담 원문을 입력해주세요.');
      return;
    }
    if (!customerName.trim() || !summary.trim()) {
      await handleExtractFromRaw(true);
      return;
    }
    await executeSaveJournal();
  };

  // 기존 일지 수정 모드로 불러오기
  const handleLoadForEdit = (item: SalesJournal) => {
    setEditingId(item.id);
    setRawContent(item.rawContent || '');
    setJournalDate(item.journalDate || todayStr);
    setSalespersonId(item.salespersonId || currentUser?.id || '');
    setCustomerName(item.customerName || '');
    setContactName(item.contactName || '');
    setContactTitle(item.contactTitle || '');
    setStage(item.stage || '영업개시');
    setSummary(item.summary || '');
    setNextSchedule(item.nextSchedule || '');
    setNextScheduleDate(item.nextScheduleDate || '');
    setExtractedJsonPreview(
      (item.extractedJson as SalesJournalExtractedData) || {
        journalDate: item.journalDate,
        customerName: item.customerName,
        contactName: item.contactName || '',
        contactTitle: item.contactTitle || '',
        stage: item.stage,
        summary: item.summary,
        nextSchedule: item.nextSchedule || '',
        nextScheduleDate: item.nextScheduleDate || '',
      }
    );
    setUsedAiModel(item.aiModel || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 일지 삭제
  const handleDelete = async (item: SalesJournal) => {
    if (!window.confirm(`[${item.journalDate}] ${item.customerName} 영업일지를 삭제하시겠습니까?`)) {
      return;
    }
    try {
      await deleteSalesJournal(item.id);
      if (detailJournal?.id === item.id) setDetailJournal(null);
      if (editingId === item.id) handleResetForm();
    } catch (err: any) {
      showErrorModal(err?.message || '영업일지 삭제 중 오류가 발생했습니다.');
    }
  };

  // 기간 및 영업사원 필터링된 목록
  const filteredJournals = useMemo(() => {
    const kw = searchKeyword.trim().toLowerCase();
    return (salesJournals || [])
      .filter(j => {
        if (selectedSalespersonFilter !== 'ALL' && j.salespersonId !== selectedSalespersonFilter) {
          return false;
        }
        if (selectedStageFilter !== 'ALL' && j.stage !== selectedStageFilter) {
          return false;
        }
        if (startDateFilter && j.journalDate < startDateFilter) {
          return false;
        }
        if (endDateFilter && j.journalDate > endDateFilter) {
          return false;
        }
        if (kw) {
          const hay = [
            j.customerName,
            j.contactName,
            j.contactTitle,
            j.salespersonName,
            j.stage,
            j.summary,
            j.nextSchedule,
            j.rawContent,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dCmp = (b.journalDate || '').localeCompare(a.journalDate || '');
        if (dCmp !== 0) return dCmp;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
  }, [
    salesJournals,
    selectedSalespersonFilter,
    selectedStageFilter,
    startDateFilter,
    endDateFilter,
    searchKeyword,
  ]);

  // 영업전개 단계별 건수 집계 (영업사원·기간 필터 반영)
  const stageStats = useMemo(() => {
    const base = (salesJournals || []).filter(j => {
      if (selectedSalespersonFilter !== 'ALL' && j.salespersonId !== selectedSalespersonFilter) return false;
      if (startDateFilter && j.journalDate < startDateFilter) return false;
      if (endDateFilter && j.journalDate > endDateFilter) return false;
      return true;
    });
    const counts: Record<SalesJournalStage, number> = {
      '영업개시': 0,
      '제안': 0,
      '견적': 0,
      '거래개시': 0,
    };
    let scheduledCount = 0;
    base.forEach(j => {
      if (counts[j.stage] !== undefined) counts[j.stage]++;
      if (j.nextSchedule && j.nextSchedule.trim()) scheduledCount++;
    });
    return {
      total: base.length,
      counts,
      scheduledCount,
    };
  }, [salesJournals, selectedSalespersonFilter, startDateFilter, endDateFilter]);

  // 영업사원별 작성 건수 집계
  const salespersonCounts = useMemo(() => {
    const map: Record<string, number> = {};
    (salesJournals || []).forEach(j => {
      if (startDateFilter && j.journalDate < startDateFilter) return;
      if (endDateFilter && j.journalDate > endDateFilter) return;
      map[j.salespersonId] = (map[j.salespersonId] || 0) + 1;
    });
    return map;
  }, [salesJournals, startDateFilter, endDateFilter]);

  // 엑셀 다운로드
  const handleExportExcel = () => {
    if (filteredJournals.length === 0) {
      showErrorModal('내보낼 영업일지 데이터가 없습니다.');
      return;
    }
    const rows = filteredJournals.map(j => ({
      '작성일': j.journalDate,
      '영업사원': j.salespersonName,
      '부서': j.department || '영업부',
      '상담구분': j.stage,
      '고객명': j.customerName,
      '상대방성명': j.contactName || '',
      '상대방직책': j.contactTitle || '',
      '상담내용요약': j.summary,
      '다음일정': j.nextSchedule || '',
      '다음일정일': j.nextScheduleDate || '',
      '자연어원문': j.rawContent,
      '등록일시': (j.createdAt || '').replace('T', ' ').slice(0, 19),
    }));
    exportToExcel(rows, `영업일지_${todayStr}`);
  };

  if (!accessInfo.canView) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        영업일지는 영업부 및 경영진만 열람할 수 있습니다.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '32px' }}>
      {/* 상단 헤더 & 영업전개 4단계 파이프라인 요약 카드 */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              영업일지
            </h2>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '6px',
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                whiteSpace: 'nowrap',
              }}
            >
              영업부·경영진 공유
            </span>
          </div>

          {/* 영업사원별 빠른 필터 탭 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSelectedSalespersonFilter('ALL')}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 700,
                border: selectedSalespersonFilter === 'ALL' ? '1.5px solid #1d4ed8' : '1px solid var(--border-color)',
                background: selectedSalespersonFilter === 'ALL' ? '#dbeafe' : 'var(--bg-app)',
                color: selectedSalespersonFilter === 'ALL' ? '#1e40af' : 'var(--text-primary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              전체 영업사원 ({stageStats.total})
            </button>
            {salespersonOptions.map(sp => {
              const cnt = salespersonCounts[sp.id] || 0;
              const isSelected = selectedSalespersonFilter === sp.id;
              return (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => setSelectedSalespersonFilter(isSelected ? 'ALL' : sp.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    border: isSelected ? '1.5px solid #1d4ed8' : '1px solid var(--border-color)',
                    background: isSelected ? '#dbeafe' : 'var(--bg-app)',
                    color: isSelected ? '#1e40af' : 'var(--text-primary)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {sp.name} {sp.position ? `${sp.position}` : ''} ({cnt})
                </button>
              );
            })}
          </div>
        </div>

        {/* 영업전개 흐름 4단계 클릭형 파이프라인 바 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '10px',
          }}
        >
          {SALES_JOURNAL_STAGES.map((stg, idx) => {
            const stStyle = STAGE_STYLE_MAP[stg];
            const count = stageStats.counts[stg] || 0;
            const isSelected = selectedStageFilter === stg;
            return (
              <div
                key={stg}
                onClick={() => setSelectedStageFilter(isSelected ? 'ALL' : stg)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: isSelected ? `2px solid ${stStyle.text}` : `1px solid ${stStyle.border}`,
                  background: isSelected ? stStyle.bg : 'var(--bg-app)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: stStyle.bg,
                      color: stStyle.text,
                      border: `1px solid ${stStyle.border}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {idx + 1}단계 · {stg}
                  </span>
                  <span style={{ fontSize: '18px', fontWeight: 800, color: stStyle.text, whiteSpace: 'nowrap' }}>
                    {count}건
                  </span>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {stStyle.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 본문 2단 스튜디오: 좌측 [자연어 일지 작성 및 추출] / 우측 [영업일지 목록 및 상세] */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {/* ─── 좌측: 영업일지 자연어 작성 및 구조화 추출 스튜디오 ─── */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={17} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {editingId ? '영업일지 수정' : '영업일지 작성'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  const sample = SAMPLE_PROMPTS[sampleIdx % SAMPLE_PROMPTS.length];
                  setRawContent(sample);
                  setSampleIdx(prev => prev + 1);
                }}
                style={{
                  padding: '4px 9px',
                  borderRadius: '5px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                예시 문구 입력
              </button>
              <button
                type="button"
                onClick={handleToggleSpeech}
                style={{
                  padding: '4px 9px',
                  borderRadius: '5px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  border: isListening ? '1px solid #dc2626' : '1px solid var(--border-color)',
                  background: isListening ? '#fef2f2' : 'var(--bg-app)',
                  color: isListening ? '#dc2626' : 'var(--text-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                {isListening ? <MicOff size={13} /> : <Mic size={13} />}
                {isListening ? '음성 중지' : '음성 입력'}
              </button>
            </div>
          </div>

          {/* 1. 자유 자연어 원문 입력 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              자연어 상담 원문
            </label>
            <textarea
              value={rawContent}
              onChange={e => setRawContent(e.target.value)}
              rows={5}
              placeholder="상담한 고객명, 상대방 이름과 직책, 상담 내용(영업개시/제안/견적/거래개시), 다음 일정을 자유롭게 작성하세요."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-app)',
                color: 'var(--text-primary)',
                fontSize: '13.5px',
                lineHeight: 1.55,
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Groq LLM 추출 실행 버튼 바 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <button
              type="button"
              disabled={isExtracting || isSaving}
              onClick={() => handleExtractFromRaw(false)}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #1d4ed8',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontSize: '13px',
                fontWeight: 800,
                cursor: isExtracting || isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <Sparkles size={15} />
              {isExtracting ? '항목 추출 중...' : '자동 항목 추출'}
            </button>

            <button
              type="button"
              disabled={isExtracting || isSaving}
              onClick={() => handleExtractFromRaw(true)}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: '#1d4ed8',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 800,
                cursor: isExtracting || isSaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              <CheckCircle2 size={15} />
              {isExtracting || isSaving ? '처리 중...' : '추출 후 즉시 저장'}
            </button>
          </div>

          {/* 2. 추출된 정형 데이터 확인 및 보정 영역 */}
          <div
            style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                추출 항목 확인 및 편집
              </span>
              {extractedJsonPreview && (
                <button
                  type="button"
                  onClick={() => setShowJsonFormatBox(prev => !prev)}
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#1d4ed8',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {showJsonFormatBox ? '데이터 포맷 접기' : '추출 데이터 포맷 보기'}
                </button>
              )}
            </div>

            {showJsonFormatBox && extractedJsonPreview && (
              <pre
                style={{
                  margin: 0,
                  padding: '10px',
                  borderRadius: '6px',
                  background: '#0f172a',
                  color: '#e2e8f0',
                  fontSize: '11.5px',
                  overflowX: 'auto',
                  lineHeight: 1.45,
                }}
              >
                {JSON.stringify(extractedJsonPreview, null, 2)}
              </pre>
            )}

            {/* 작성일 & 담당 영업사원 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  작성일
                </label>
                <input
                  type="date"
                  value={journalDate}
                  onChange={e => setJournalDate(e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  담당 영업사원
                </label>
                <select
                  value={salespersonId}
                  onChange={e => setSalespersonId(e.target.value)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                >
                  {salespersonOptions.map(sp => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} {sp.position ? `(${sp.position})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 고객명 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  고객명
                </label>
                {customerName.trim() && (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: matchedCustomer ? '#ecfdf5' : '#fef3c7',
                      color: matchedCustomer ? '#047857' : '#b45309',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {matchedCustomer ? `등록 고객 연동됨 (${matchedCustomer.bizRegNo || '사업자번호 확인'})` : '신규 가망고객'}
                  </span>
                )}
              </div>
              <input
                type="text"
                list="sales-journal-customer-list"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="고객사 상호"
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              />
              <datalist id="sales-journal-customer-list">
                {(customers || []).map(c => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>

            {/* 상대방 성명 & 상대방 직책 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  상대방 이름
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={e => setContactName(e.target.value)}
                  placeholder="예: 박성민"
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  상대방 직책
                </label>
                <input
                  type="text"
                  value={contactTitle}
                  onChange={e => setContactTitle(e.target.value)}
                  placeholder="예: 부장, 소장, 대표"
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>

            {/* 상담내용의 구분 (영업개시 / 제안 / 견적 / 거래개시) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                상담내용 구분
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                {SALES_JOURNAL_STAGES.map(stg => {
                  const stStyle = STAGE_STYLE_MAP[stg];
                  const active = stage === stg;
                  return (
                    <button
                      key={stg}
                      type="button"
                      onClick={() => setStage(stg)}
                      style={{
                        padding: '8px 6px',
                        borderRadius: '6px',
                        fontSize: '12.5px',
                        fontWeight: 800,
                        border: active ? `2px solid ${stStyle.text}` : '1px solid var(--border-color)',
                        background: active ? stStyle.bg : 'var(--bg-app)',
                        color: active ? stStyle.text : 'var(--text-secondary)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {stg}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 상담내용 요약 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                상담내용 요약
              </label>
              <textarea
                value={summary}
                onChange={e => setSummary(e.target.value)}
                rows={3}
                placeholder="핵심 상담내용 요약"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* 다음 일정 & 다음 일정일 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 135px', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  다음 일정
                </label>
                <input
                  type="text"
                  value={nextSchedule}
                  onChange={e => setNextSchedule(e.target.value)}
                  placeholder="후속 일정 및 조치 사항 (없으면 비움)"
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  다음 일정일
                </label>
                <input
                  type="date"
                  value={nextScheduleDate}
                  onChange={e => setNextScheduleDate(e.target.value)}
                  style={{
                    padding: '8px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                  }}
                />
              </div>
            </div>

            {/* 하단 저장 및 초기화 버튼 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleResetForm}
                style={{
                  padding: '9px 14px',
                  borderRadius: '7px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                }}
              >
                <RotateCcw size={14} />
                초기화
              </button>

              <button
                type="button"
                disabled={isSaving || isExtracting}
                onClick={handleSaveButtonClick}
                style={{
                  padding: '9px 18px',
                  borderRadius: '7px',
                  border: 'none',
                  background: '#059669',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: isSaving || isExtracting ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}
              >
                <Save size={15} />
                {editingId ? '수정 저장' : '영업일지 저장'}
              </button>
            </div>
          </div>
        </div>

        {/* ─── 우측: 영업일지 조회 그리드 및 상세 열람 패널 ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
          {/* 필터 바 (헌장 3.4 상하 스택 레이블 구조) */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  조회 시작일
                </label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={e => setStartDateFilter(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  조회 종료일
                </label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={e => setEndDateFilter(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  영업사원
                </label>
                <select
                  value={selectedSalespersonFilter}
                  onChange={e => setSelectedSalespersonFilter(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                  }}
                >
                  <option value="ALL">전체 영업사원</option>
                  {salespersonOptions.map(sp => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name} {sp.position ? `(${sp.position})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  상담 구분
                </label>
                <select
                  value={selectedStageFilter}
                  onChange={e => setSelectedStageFilter(e.target.value)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-app)',
                    color: 'var(--text-primary)',
                    fontSize: '12.5px',
                  }}
                >
                  <option value="ALL">전체 구분</option>
                  {SALES_JOURNAL_STAGES.map(stg => (
                    <option key={stg} value={stg}>
                      {stg}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '200px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  검색어
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search size={14} style={{ position: 'absolute', left: '9px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={e => setSearchKeyword(e.target.value)}
                    placeholder="고객명, 상대방, 요약, 원문 검색"
                    style={{
                      width: '100%',
                      padding: '7px 10px 7px 28px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-app)',
                      color: 'var(--text-primary)',
                      fontSize: '12.5px',
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleExportExcel}
                style={{
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-app)',
                  color: 'var(--text-primary)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <Download size={14} />
                엑셀 내보내기
              </button>
            </div>
          </div>

          {/* 선택된 영업일지 원문 + 추출 데이터 비교 상세 카드 */}
          {detailJournal && (
            <div
              style={{
                background: 'var(--bg-card)',
                border: '2px solid #2563eb',
                borderRadius: '10px',
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 800,
                      padding: '3px 9px',
                      borderRadius: '5px',
                      background: STAGE_STYLE_MAP[detailJournal.stage]?.bg || '#eff6ff',
                      color: STAGE_STYLE_MAP[detailJournal.stage]?.text || '#1d4ed8',
                      border: `1px solid ${STAGE_STYLE_MAP[detailJournal.stage]?.border || '#bfdbfe'}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {detailJournal.stage}
                  </span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {detailJournal.customerName}
                  </span>
                  {(detailJournal.contactName || detailJournal.contactTitle) && (
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      · 상대방: {[detailJournal.contactName, detailJournal.contactTitle].filter(Boolean).join(' ')}
                    </span>
                  )}
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    | 작성일: {detailJournal.journalDate} | 담당: {detailJournal.salespersonName}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleLoadForEdit(detailJournal)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-app)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Edit3 size={13} />
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(detailJournal)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#dc2626',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <Trash2 size={13} />
                    삭제
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailJournal(null)}
                    style={{
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      background: 'var(--bg-app)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* 추출된 구조화 데이터 */}
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#1d4ed8', whiteSpace: 'nowrap' }}>
                    추출된 정형 데이터
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.55 }}>
                    <strong>상담 요약:</strong> {detailJournal.summary}
                  </div>
                  <div style={{ fontSize: '13px', color: detailJournal.nextSchedule ? '#047857' : 'var(--text-muted)', lineHeight: 1.5 }}>
                    <strong>다음 일정:</strong>{' '}
                    {detailJournal.nextSchedule
                      ? `${detailJournal.nextScheduleDate ? `[${detailJournal.nextScheduleDate}] ` : ''}${detailJournal.nextSchedule}`
                      : '없음'}
                  </div>
                </div>

                {/* 자연어 원문 */}
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'var(--bg-app)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    자연어 작성 원문
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                    {detailJournal.rawContent}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 고밀도 영업일지 목록 테이블 (헌장 3.2: 줄바꿈 방지 & 좌측 첫 컬럼 액션 배치) */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                영업일지 목록 ({filteredJournals.length}건)
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                행을 클릭하면 원문과 추출 데이터를 상세 비교합니다
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-app)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800, whiteSpace: 'nowrap', width: '76px' }}>
                      상세
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      작성일
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      영업사원
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      상담 구분
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      고객명
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      상대방
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      상담내용 요약
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      다음 일정
                    </th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 800, whiteSpace: 'nowrap' }}>
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredJournals.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          padding: '42px 16px',
                          textAlign: 'center',
                          color: 'var(--text-muted)',
                          fontSize: '13.5px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        등록된 영업일지가 없습니다. 좌측에서 자연어로 상담 내용을 작성해보세요.
                      </td>
                    </tr>
                  ) : (
                    filteredJournals.map(item => {
                      const stStyle = STAGE_STYLE_MAP[item.stage] || STAGE_STYLE_MAP['영업개시'];
                      const isSelected = detailJournal?.id === item.id;
                      const contactDisplay = [item.contactName, item.contactTitle].filter(Boolean).join(' ') || '-';
                      return (
                        <tr
                          key={item.id}
                          onClick={() => setDetailJournal(item)}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            background: isSelected ? '#eff6ff' : 'transparent',
                            cursor: 'pointer',
                          }}
                        >
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                setDetailJournal(item);
                              }}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '5px',
                                border: '1px solid #bfdbfe',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              상세 ➔
                            </button>
                          </td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.journalDate}
                          </td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {item.salespersonName}
                          </td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '5px',
                                fontSize: '11.5px',
                                fontWeight: 800,
                                background: stStyle.bg,
                                color: stStyle.text,
                                border: `1px solid ${stStyle.border}`,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.stage}
                            </span>
                          </td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {item.customerName}
                          </td>
                          <td style={{ padding: '9px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                            {contactDisplay}
                          </td>
                          <td
                            style={{
                              padding: '9px 12px',
                              whiteSpace: 'nowrap',
                              maxWidth: '340px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: 'var(--text-primary)',
                            }}
                            title={item.summary}
                          >
                            {item.summary}
                          </td>
                          <td
                            style={{
                              padding: '9px 12px',
                              whiteSpace: 'nowrap',
                              maxWidth: '240px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: item.nextSchedule ? '#047857' : 'var(--text-muted)',
                              fontWeight: item.nextSchedule ? 700 : 400,
                            }}
                            title={item.nextSchedule || ''}
                          >
                            {item.nextSchedule
                              ? `${item.nextScheduleDate ? `[${item.nextScheduleDate}] ` : ''}${item.nextSchedule}`
                              : '-'}
                          </td>
                          <td
                            style={{ padding: '9px 12px', whiteSpace: 'nowrap', textAlign: 'center' }}
                            onClick={e => e.stopPropagation()}
                          >
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleLoadForEdit(item)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border-color)',
                                  background: 'var(--bg-app)',
                                  color: 'var(--text-secondary)',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #fecaca',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  fontSize: '11.5px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SalesJournalPage;
