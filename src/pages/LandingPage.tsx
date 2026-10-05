// src/pages/LandingPage.tsx
// 🌐 eBro 솔루션 공식 홍보 포털 및 마케팅 랜딩 페이지 (Procore 글로벌 B2B 스타일 전면 개편)

import React, { useState, useEffect } from 'react';
import { getAdminConsoleUrl } from '../utils/domainRouter';
import {
  Truck,
  Printer,
  Bot,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  Zap,
  Smartphone,
  BarChart3,
  Mail,
  X,
  Lock,
  Layers,
  FileText,
  Check,
  RotateCcw,
  Sparkles,
  PhoneCall,
  ChevronRight,
  TrendingUp,
  Cpu
} from 'lucide-react';

interface ShowcaseTab {
  id: string;
  badge: string;
  title: string;
  subtitle: string;
  desc: string;
  bullets: string[];
}

const SHOWCASE_TABS: ShowcaseTab[] = [
  {
    id: 'dispatch',
    badge: '스마트 배차 & 원격 인쇄',
    title: '전화 배차의 종말, 0초 무인 인쇄',
    subtitle: '배차 의뢰 접수 즉시 현장 컨테이너 프린터로 0초 만에 출고요청서가 자동 무인 출력됩니다.',
    desc: '영업팀이 출고 또는 EXCHANGE(교환) 의뢰를 전송하면, 담당자가 일일이 수기 작성할 필요 없이 현장 주기장 프린터로 실시간 전송되어 지연 0초를 실현합니다.',
    bullets: [
      '단일 1건 왕복 할인 배차(EXCHANGE) 정규 체인 관리',
      '현장 컨테이너 네트워크 프린터 0초 자동 백그라운드 스풀링',
      '화물 지입 기사 및 운송사 실시간 배정 & 단가 대사'
    ]
  },
  {
    id: 'inspection',
    badge: '모바일 현장 검수',
    title: '스마트폰 4면 촬영과 RENTED 즉시 전환',
    subtitle: '종이 인수증 분실 걱정 없이 기사 서명 즉시 자산 상태가 대여중(RENTED)으로 전환됩니다.',
    desc: '출고 검수 승인이 완료되는 즉시 전사 자산 상태가 RENTED로 완결되며, 21대 안전 옵션 볼팅 체크리스트와 외관 사진이 암호화되어 전자 계약서에 1:1 영구 첨부됩니다.',
    bullets: [
      '스마트폰 하나로 외관 4면 고화질 촬영 & 하자 즉시 보존',
      '21대 법정 안전장치(과상승방지봉, 풋스위치 등) 전수 검수',
      '검수 승인 마감 시 자산 상태 RENTED 자동 관통 전환'
    ]
  },
  {
    id: 'agent',
    badge: '24시간 eBro AI Agent',
    title: '메신저 자연어 지시의 자동 ERP 수확',
    subtitle: '퇴근 후나 이동 중 텔레그램 지시문이 Zero-Loss 큐에 무누락 보존되어 즉시 실행됩니다.',
    desc: '복잡한 ERP 화면을 직접 열지 않아도 "평택 삼성 35호기 유압 새서 교환해줘"라는 자연어 한마디로 계약 조건을 100% 자동 상속받는 EXCHANGE 배차가 즉시 생성됩니다.',
    bullets: [
      '소형 경량 AI가 지시문 핵심 슬롯(현장, 장비, 사유) 정밀 추출',
      '부서 R&R 엄격 분리(영업부의 특정 자산번호 지정 원천 방지)',
      '단일 1개 단어 1개 의미 전사 표준화(Zero-Synonym) 준수'
    ]
  },
  {
    id: 'accounting',
    badge: '은행 통장 1:1 자동 대사',
    title: '1금융권 전 은행 엑셀 1초 상계 마감',
    subtitle: '국민, 신한, 기업, 우리, 하나 등 모든 은행 통장 내역과 미수금을 원클릭으로 100% 대사합니다.',
    desc: '월말마다 며칠씩 통장 사본을 대조하던 야근이 사라집니다. 스마트 파서가 입금자명과 고객사 상호를 퍼지 매칭하여 대차 차액 ₩0의 완벽한 무결성을 확정합니다.',
    bullets: [
      '주요 1금융권 통장 엑셀 원클릭 자동 파싱 & 스마트 매칭',
      '외상매출금 및 운송료 대차대조 합계 1원 단위 검증',
      '자산별 누적 매출 기여액 정밀 일할 집계(전자산 ➔ 후장비 승계)'
    ]
  }
];

export const LandingPage: React.FC = () => {
  // 모달 상태
  const [contactModalOpen, setContactModalOpen] = useState(false);

  // 쇼케이스 탭 상태 및 자동 재생 타이머
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [tabProgress, setTabProgress] = useState(0);

  // 6초마다 다음 탭으로 부드럽게 자동 전환
  useEffect(() => {
    if (!isAutoPlaying) return;

    const intervalMs = 60;
    const totalDurationMs = 6000;
    const step = (intervalMs / totalDurationMs) * 100;

    const timer = setInterval(() => {
      setTabProgress(prev => {
        if (prev >= 100) {
          setActiveTabIdx(current => (current + 1) % SHOWCASE_TABS.length);
          return 0;
        }
        return prev + step;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  const handleSelectTab = (idx: number) => {
    setActiveTabIdx(idx);
    setTabProgress(0);
    setIsAutoPlaying(false); // 수동 조작 시 자동 재생 일시 정지
  };

  const activeTab = SHOWCASE_TABS[activeTabIdx];

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-[#FF5200] selection:text-white">
      {/* ── 0. Procore 스타일 최상단 얇은 알림 배너 ── */}
      <div className="bg-slate-900 text-slate-200 text-xs py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-[#FF5200] text-white font-extrabold text-[10px] px-1.5 py-0.5 rounded tracking-wider">
              NEW
            </span>
            <span className="font-medium text-slate-300">
              고소작업대(AWP) 전용 eBro Agent & 모바일 현장 검수 v2.4 릴리즈
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-slate-400">
            <a
              href="https://awp-demo.ebro.run"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition flex items-center gap-1 font-semibold text-slate-200"
            >
              <span>라이브 데모 바로가기</span>
              <ArrowRight className="w-3 h-3 text-[#FF5200]" />
            </a>
          </div>
        </div>
      </div>

      {/* ── 1. Procore 스타일 메인 내비게이션 바 (White & Clean) ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* 좌측 로고 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FF5200] flex items-center justify-center shadow-md shadow-orange-500/20">
              <span className="text-white font-black text-xl tracking-tighter">eB</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-2xl font-black tracking-tight text-slate-900 font-sans">eBro</span>
                <span className="text-[10px] font-extrabold tracking-widest text-slate-700 bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded uppercase">
                  AWP PLATFORM
                </span>
              </div>
            </div>
          </div>

          {/* 중앙 내비게이션 링크 */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-bold text-slate-700">
            <a href="#showcase" className="hover:text-[#FF5200] transition">핵심 기능 시연</a>
            <a href="#stats" className="hover:text-[#FF5200] transition">도입 효과 지표</a>
            <a href="#capabilities" className="hover:text-[#FF5200] transition">5대 특화 엔진</a>
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="hover:text-[#FF5200] transition cursor-pointer"
            >
              도입 컨설팅
            </button>
          </nav>

          {/* 우측 2대 CTA 액션 버튼 */}
          <div className="flex items-center gap-3">
            <a
              href="https://awp-demo.ebro.run"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex px-4 py-2.5 rounded-md border border-slate-300 hover:border-slate-400 bg-white text-slate-800 text-xs font-bold transition shadow-2xs hover:bg-slate-50 items-center gap-1.5"
            >
              <span>데모 둘러보기</span>
            </a>
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="px-5 py-2.5 rounded-md bg-[#FF5200] hover:bg-[#E14504] text-white text-xs font-extrabold transition shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>도입 상담 신청</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. Procore 스타일 대형 히어로 섹션 (Impactful Light Theme) ── */}
      <section className="relative pt-18 pb-20 bg-[#FBFBFA] border-b border-slate-200 overflow-hidden">
        {/* 은은한 제도용 그리드 배경 (Construction Grid Lines) */}
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          {/* Procore 스타일 상단 카테고리 태그 */}
          <div className="inline-flex items-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-[#FF5200]" />
            <span className="text-xs font-black tracking-widest text-slate-600 uppercase">
              고소작업대(AWP) 임대차·물류·회계 전사 통합 자원관리
            </span>
          </div>

          {/* 단단하고 굵은 메인 헤드라인 */}
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.15] mb-6">
            현장의 모든 장비와 사무실의 모든 회계를<br />
            <span className="text-[#FF5200]">단 하나의 지능형 플랫폼</span>으로 연결합니다.
          </h1>

          {/* 설득력 있는 바디 카피 */}
          <p className="text-base sm:text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-10 font-normal">
            전화 배차의 혼선, 잃어버리는 종이 인수증, 며칠씩 걸리는 월말 통장 대사를 멈추십시오.<br className="hidden sm:inline" />
            eBro는 임직원의 최소 노력으로 최대 업무 효익을 창출하는 전사 표준 렌탈 운영 솔루션입니다.
          </p>

          {/* 2대 메인 CTA 버튼군 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a
              href="https://awp-demo.ebro.run"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 rounded-md bg-[#FF5200] hover:bg-[#E14504] text-white font-extrabold text-sm shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>무료 시연 데모 체험하기</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-md bg-white hover:bg-slate-50 border-2 border-slate-900 text-slate-900 font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
            >
              <Mail className="w-4 h-4 text-[#FF5200]" />
              <span>맞춤형 도입 상담 신청</span>
            </button>
          </div>

          {/* ── 3. Procore 시그니처: 인터랙티브 실시간 기능 데모 쇼케이스 ── */}
          <div id="showcase" className="w-full text-left bg-white rounded-2xl border border-slate-300/80 shadow-2xl overflow-hidden">
            {/* 상단 탭 바 (Interactive Tab Bar) */}
            <div className="grid grid-cols-2 md:grid-cols-4 bg-slate-100/80 border-b border-slate-200">
              {SHOWCASE_TABS.map((tab, idx) => {
                const isSelected = idx === activeTabIdx;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleSelectTab(idx)}
                    className={`relative p-4 sm:p-5 text-left transition flex flex-col justify-between cursor-pointer border-r border-slate-200 last:border-r-0 ${
                      isSelected
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'bg-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50/60'
                    }`}
                  >
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#FF5200]' : 'bg-slate-400'}`} />
                        <span className={isSelected ? 'text-[#FF5200]' : 'text-slate-500'}>
                          0{idx + 1}. {tab.badge}
                        </span>
                      </div>
                      <div className="font-extrabold text-xs sm:text-sm line-clamp-1">
                        {tab.title}
                      </div>
                    </div>

                    {/* 선택된 탭 하단 활성 인디케이터 & 자동재생 프로그레스 바 */}
                    {isSelected && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-[#FF5200] transition-all duration-75 ease-linear"
                          style={{ width: `${isAutoPlaying ? tabProgress : 100}%` }}
                        />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 쇼케이스 본문 (Split View: 좌측 설명 + 우측 실제 작동 UI 시뮬레이터) */}
            <div className="p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white">
              {/* 좌측: 비즈니스 가치 & 체크리스트 */}
              <div className="lg:col-span-5 flex flex-col justify-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-[#FF5200] text-xs font-black mb-4 w-fit">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>실시간 현장 검증 시스템</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-slate-900 leading-snug mb-3">
                  {activeTab.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed mb-6 font-medium">
                  {activeTab.desc}
                </p>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  {activeTab.bullets.map((b, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 font-semibold">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span>{b}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-4">
                  <button
                    type="button"
                    onClick={() => setContactModalOpen(true)}
                    className="inline-flex items-center gap-2 text-xs font-black text-[#FF5200] hover:text-[#E14504] transition group cursor-pointer"
                  >
                    <span>이 기능 도입 컨설팅 받아보기</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                  </button>
                </div>
              </div>

              {/* 우측: 실제 작동 인터랙티브 UI 애니메이션 캔버스 */}
              <div className="lg:col-span-7 bg-slate-900 rounded-xl p-5 sm:p-6 text-white shadow-inner border border-slate-800 min-h-[380px] flex flex-col justify-between font-mono">
                {/* 윈도우 타이틀 바 */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                    <span className="text-xs text-slate-400 font-sans font-bold ml-2">
                      eBro ERP — {activeTab.badge} Live Simulator
                    </span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800/60 animate-pulse">
                    ● 실시간 작동 중
                  </span>
                </div>

                {/* 탭별 고유 애니메이션 뷰 */}
                <div className="flex-1 flex flex-col justify-center">
                  {activeTabIdx === 0 && (
                    <div className="space-y-4 font-sans">
                      <div className="bg-slate-800/90 rounded-lg p-4 border border-slate-700 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-orange-400 font-bold mb-1">🚚 EXCHANGE (단일 왕복 배차 1건)</div>
                          <div className="text-sm font-bold text-white">평택 삼성전자 P4 신축현장</div>
                          <div className="text-xs text-slate-400">GS-1930 (109호기 회수 ➔ 152호기 대차 출고)</div>
                        </div>
                        <div className="text-right">
                          <span className="px-2.5 py-1 rounded bg-indigo-900/80 text-indigo-300 text-xs font-bold border border-indigo-700">
                            기사 자동 배정됨
                          </span>
                          <div className="text-[11px] text-slate-400 mt-1 font-mono">운송비 왕복 할인 적용</div>
                        </div>
                      </div>

                      {/* 인쇄 스풀러 시뮬레이션 */}
                      <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-orange-600/20 text-[#FF5200] flex items-center justify-center flex-shrink-0 animate-bounce">
                          <Printer className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-slate-300 font-bold">주기장 2번 컨테이너 프린터</span>
                            <span className="text-emerald-400 font-mono font-bold">0초 즉시 출력 완료!</span>
                          </div>
                          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-orange-500 to-emerald-500 h-full w-full animate-pulse" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTabIdx === 1 && (
                    <div className="space-y-3 font-sans">
                      <div className="bg-slate-800/90 rounded-lg p-4 border border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-8 h-8 text-sky-400" />
                          <div>
                            <div className="text-xs text-sky-300 font-bold">현장 모바일 출고 검수원 앱</div>
                            <div className="text-sm font-bold text-white">21대 안전 옵션 볼팅 체크 100% PASS</div>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 text-xs font-extrabold border border-emerald-800">
                          외관 4면 사진 보존
                        </span>
                      </div>

                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                        <div className="text-xs text-slate-300">
                          운송 기사 전자 서명: <span className="font-bold text-white">김철수 (서명 완료)</span>
                        </div>
                        <div className="px-3 py-1 rounded bg-orange-600 text-white font-black text-xs shadow-md animate-pulse">
                          자산 상태: RENTED (대여중) 전환됨
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTabIdx === 2 && (
                    <div className="space-y-3 font-sans">
                      <div className="bg-slate-800/90 rounded-lg p-3.5 border border-slate-700">
                        <div className="text-xs text-purple-400 font-bold mb-1">텔레그램 메신저 원문 인입</div>
                        <div className="text-xs text-slate-200 bg-slate-950 p-2.5 rounded border border-slate-800 font-mono">
                          "화성 1공구 23호기 충전 안돼서 교환 의뢰합니다"
                        </div>
                      </div>

                      <div className="p-3 bg-purple-950/40 rounded-lg border border-purple-800/60 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-purple-300 font-bold">eBro AI 파싱 결과 (0.2초)</div>
                          <div className="text-xs text-slate-300">
                            유형: <span className="text-white font-bold">EXCHANGE_REQUEST</span> | 기존 계약 100% 상속
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded bg-purple-600 text-white font-extrabold text-xs">
                          DB 무누락 보존
                        </span>
                      </div>
                    </div>
                  )}

                  {activeTabIdx === 3 && (
                    <div className="space-y-3 font-sans">
                      <div className="bg-slate-800/90 rounded-lg p-3.5 border border-slate-700 flex items-center justify-between">
                        <div>
                          <div className="text-xs text-emerald-400 font-bold">1금융권 통장 입출금 1:1 대사 그리드</div>
                          <div className="text-sm font-bold text-white">국민은행 4,500,000원 입금 확인</div>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">스마트 퍼지 매칭 완료</span>
                      </div>

                      <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                        <div className="text-xs text-slate-300">
                          대차대조 검증: <span className="font-bold text-emerald-400">청구 ₩4,500,000 = 수납 ₩4,500,000</span>
                        </div>
                        <span className="px-3 py-1 rounded bg-emerald-600 text-white font-black text-xs">
                          차액 ₩0 (종결)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 하단 제어 바 */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 font-sans">
                  <span>Procore-Standard High-Performance Engine</span>
                  <button
                    type="button"
                    onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                    className="text-slate-400 hover:text-white transition cursor-pointer flex items-center gap-1 font-bold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{isAutoPlaying ? '자동 재생 중' : '수동 모드'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Procore 시그니처 4열 통계 지표 (Proof in Numbers) ── */}
      <section id="stats" className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
            <div className="pt-6 sm:pt-0 sm:px-6 text-center sm:text-left">
              <div className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-2">
                0<span className="text-[#FF5200]">초</span>
              </div>
              <div className="text-sm font-extrabold text-slate-900 mb-1">현장 무인 자동 인쇄</div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                배차 접수 즉시 주기장 컨테이너로 출고요청서가 분산 큐를 통해 자동 출력됩니다.
              </p>
            </div>

            <div className="pt-6 sm:pt-0 sm:px-6 text-center sm:text-left">
              <div className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-2">
                100<span className="text-[#FF5200]">%</span>
              </div>
              <div className="text-sm font-extrabold text-slate-900 mb-1">전자산 ➔ 후장비 승계</div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                대차 교체 시 교체 전일까지 전자산 마감, 당일부터 후장비 일할 매출 기여액을 1원도 틀림없이 보존합니다.
              </p>
            </div>

            <div className="pt-6 sm:pt-0 sm:px-6 text-center sm:text-left">
              <div className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-2">
                21<span className="text-[#FF5200]">대</span>
              </div>
              <div className="text-sm font-extrabold text-slate-900 mb-1">법정 안전스펙 전수 검수</div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                과상승방지봉, 풋스위치, 경광등 등 법정 안전 필수 옵션을 스마트폰으로 전수 승인 후 출고합니다.
              </p>
            </div>

            <div className="pt-6 sm:pt-0 sm:px-6 text-center sm:text-left">
              <div className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-2">
                ₩0<span className="text-[#FF5200]">원</span>
              </div>
              <div className="text-sm font-extrabold text-slate-900 mb-1">월말 통장 대사 대차 차액</div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                청구총액과 입금확정액의 1:1 대사 검증식을 통해 무누락·무오차 회계 무결성을 완성합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Procore 스타일 2열 교차 심층 기능 섹션 (Alternating Feature Grids) ── */}
      <section id="capabilities" className="py-24 bg-[#F8FAFC] border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
          {/* 기능 1: 스마트 배차 & EXCHANGE 단일 배차 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-xs font-black text-[#FF5200] uppercase tracking-wider mb-2">
                DISPATCH & LOGISTICS
              </div>
              <h2 className="text-3xl font-black text-slate-900 leading-tight mb-4">
                대차 교체 시 2건 발행 금지,<br />
                단일 'EXCHANGE' 왕복 배차로 운송비 절감
              </h2>
              <p className="text-slate-600 leading-relaxed text-sm mb-6 font-medium">
                기존 시스템처럼 출고 1건, 입고 1건으로 쪼개어 배차를 중복 발행하지 않습니다.
                단일 대차 요구에 대해 1건의 EXCHANGE 왕복 배차만 발행하여 왕복 운송비 할인을 정산에 100% 연동하고,
                출고와 회수의 1:1 업무 체인을 완벽하게 통합 통제합니다.
              </p>
              <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-800">
                <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[#FF5200] block mb-1">✓ 단일 배차 의뢰</span>
                  왕복 배차 운송비 자동 정산
                </div>
                <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[#FF5200] block mb-1">✓ 계약 속성 상속</span>
                  단가 및 현장 조건 100% 승계
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xl">
              <div className="bg-slate-950 p-4 rounded-xl text-white font-mono text-xs space-y-2">
                <div className="text-slate-500">// 전사 표준 헌장 2.3 준수 배차 발행</div>
                <div className="text-orange-400 font-bold">POST /api/deliveries/exchange</div>
                <div className="text-slate-300">
                  {`{\n  "dispatchType": "EXCHANGE",\n  "returnAsset": "GS-1930 #109",\n  "deliveryAsset": "GS-1930 #152",\n  "roundTripDiscount": true,\n  "status": "DISPATCH_CONFIRMED"\n}`}
                </div>
                <div className="pt-2 text-emerald-400 font-bold border-t border-slate-800">
                  ➔ 왕복 1건 통합 체인으로 운송비 정산 완료
                </div>
              </div>
            </div>
          </div>

          {/* 기능 2: 렌탈 자산 라이프사이클 & 매출 기여액 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center lg:flex-row-reverse">
            <div className="lg:order-2">
              <div className="text-xs font-black text-[#FF5200] uppercase tracking-wider mb-2">
                ASSET GOVERNANCE
              </div>
              <h2 className="text-3xl font-black text-slate-900 leading-tight mb-4">
                출고 검수 승인 시 RENTED 전환,<br />
                자산별 정밀 일할 매출 기여액 1원도 무누락
              </h2>
              <p className="text-slate-600 leading-relaxed text-sm mb-6 font-medium">
                배차 단계에서는 자산 상태를 조작하지 않습니다. 현장 출고 검수가 완료되는 시점에만 자산이 '대여중(RENTED)'으로 전환되어 실제 물리적 라이프사이클과 완벽히 일치합니다.
                대차 발생 시 회수 자산은 전일 마감, 대차 자산은 당일 바통을 승계받아 자산별 누적 매출 기여액을 1원도 오차 없이 일할 집계합니다.
              </p>
              <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-800">
                <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[#FF5200] block mb-1">✓ 무오차 일할 정산</span>
                  가동일수 × 일할단가 정밀 집계
                </div>
                <div className="p-3.5 bg-white rounded-lg border border-slate-200 shadow-2xs">
                  <span className="text-[#FF5200] block mb-1">✓ 1:1 완벽 이력 추적</span>
                  전자산 ➔ 후장비 연결 Audit Trail
                </div>
              </div>
            </div>

            <div className="lg:order-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-xl">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-500">회수 대상 전자산 (109호기)</div>
                  <span className="text-xs font-extrabold text-slate-800">1일 ~ 14일 가동 (14일간 매출 확정)</span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="text-xs font-bold text-[#FF5200]">대차 투입 후장비 (152호기)</div>
                  <span className="text-xs font-extrabold text-[#FF5200]">15일 ~ 말일 가동 (바통 승계 완료)</span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg text-emerald-800 text-xs font-bold flex items-center justify-between">
                  <span>계약 총액 = 전자산 기여액 + 후장비 기여액</span>
                  <span className="font-extrabold">100% 일치</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. 하단 강력한 엔터프라이즈 CTA 배너 ── */}
      <section className="py-20 bg-slate-900 text-white text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-6">
            렌탈 비즈니스의 운영 마찰을 끝내고<br />
            <span className="text-[#FF5200]">최대 편익의 시스템</span>을 경험하십시오.
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-10 max-w-2xl mx-auto">
            귀사의 고소작업대 보유 대수와 현재 업무 프로세스를 알려주시면, 
            맞춤형 도입 로드맵과 1:1 라이브 시연을 즉시 지원해 드립니다.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://awp-demo.ebro.run"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 rounded-md bg-[#FF5200] hover:bg-[#E14504] text-white font-extrabold text-sm shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <span>시연 데모 체험하기</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="w-full sm:w-auto px-8 py-4 rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Mail className="w-4 h-4 text-[#FF5200]" />
              <span>공식 도입 상담 문의</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── 7. 도입 상담 모달 (Contact Modal — Clean Procore White Box) ── */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-6 sm:p-7 shadow-2xl flex flex-col gap-5 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5200]" />
                <h3 className="text-base font-extrabold text-slate-900">eBro 솔루션 도입 문의</h3>
              </div>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
              귀사의 고소작업대 렌탈 규모 및 현장 프로세스에 맞춘 맞춤형 도입 컨설팅과 라이브 데모를 제공해 드립니다.
            </p>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
              <div className="flex items-center gap-3 text-slate-800">
                <div className="w-9 h-9 rounded-lg bg-orange-100 text-[#FF5200] flex items-center justify-center flex-shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">공식 문의 이메일</div>
                  <a
                    href="mailto:contact@ebro.run"
                    className="font-extrabold text-slate-900 font-mono hover:text-[#FF5200] transition text-sm"
                  >
                    contact@ebro.run
                  </a>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="px-5 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. 하단 푸터 (Footer — Procore Minimalist Enterprise) ── */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-slate-900 font-black text-sm mb-2">
              <div className="w-5 h-5 rounded bg-[#FF5200] text-white flex items-center justify-center text-[11px] font-black">
                eB
              </div>
              <span>(주)드래곤RPA eBro 솔루션 사업본부</span>
            </div>
            <p className="text-slate-500 leading-relaxed font-medium">
              고소작업대 임대차·물류·회계 자동화 전사 통합 플랫폼 | 서울특별시 송파구 | 사업자등록번호: 215-87-98771 | 대표 이메일: <a href="mailto:contact@ebro.run" className="text-slate-700 hover:text-[#FF5200] transition font-mono font-bold">contact@ebro.run</a>
            </p>
            <p className="text-slate-400 mt-1">
              Copyright © 2026 DragonRPA Inc. All rights reserved.
            </p>
          </div>

          <div className="flex items-center gap-6 font-bold text-slate-600">
            <a
              href={getAdminConsoleUrl()}
              className="hover:text-[#FF5200] transition flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>플랫폼 관제탑</span>
            </a>
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="hover:text-[#FF5200] transition cursor-pointer"
            >
              도입 문의
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
