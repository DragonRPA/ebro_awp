// src/pages/LandingPage.tsx
// 🌐 eBro 솔루션 공식 홍보 포털 및 마케팅 랜딩 페이지 (전사 표준 헌장 1.1, 3.1)

import React, { useState } from 'react';
import { db, Tenant } from '../services/db';
import { getTenantUrl, getAdminConsoleUrl } from '../utils/domainRouter';
import {
  Truck,
  Printer,
  Bot,
  ShieldCheck,
  Building2,
  ExternalLink,
  ArrowRight,
  CheckCircle2,
  Zap,
  Smartphone,
  BarChart3,
  Phone,
  Mail,
  Search,
  X,
  Lock,
  Layers,
  Sparkles,
  ChevronRight
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  // 모달 상태
  const [tenantModalOpen, setTenantModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [customSubdomain, setCustomSubdomain] = useState('');

  const tenants: Tenant[] = db.tenants && db.tenants.length > 0 ? db.tenants : [];

  const filteredTenants = tenants.filter(t => {
    const kw = searchKeyword.trim().toLowerCase();
    if (!kw) return true;
    return (
      (t.displayName || '').toLowerCase().includes(kw) ||
      (t.tradeName || '').toLowerCase().includes(kw) ||
      (t.tenantCode || '').toLowerCase().includes(kw) ||
      (t.subdomain || '').toLowerCase().includes(kw)
    );
  });

  const handleCustomJump = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customSubdomain.trim().toLowerCase();
    if (!clean) return;
    window.location.href = getTenantUrl(clean);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* ── 1. 상단 내비게이션 바 ── */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <span className="text-white font-extrabold text-xl tracking-tighter">eB</span>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white">eBro</span>
              <span className="ml-1.5 text-xs font-semibold text-indigo-400 bg-indigo-950/80 border border-indigo-800/60 px-2 py-0.5 rounded-full">
                AWP ERP
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
            <a href="#features" className="hover:text-indigo-400 transition">주요 기능</a>
            <a href="#architecture" className="hover:text-indigo-400 transition">시스템 구조</a>
            <a href="#agent" className="hover:text-indigo-400 transition">eBro Agent</a>
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="hover:text-indigo-400 transition cursor-pointer"
            >
              도입 문의
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTenantModalOpen(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>우리 회사 ERP 로그인</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. 히어로 섹션 ── */}
      <section className="relative pt-20 pb-24 overflow-hidden border-b border-slate-850">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),rgba(255,255,255,0))]" />
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-xs font-bold mb-8 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>고소작업대(AWP) 렌탈 산업 전문 올인원 ERP 플랫폼</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight sm:leading-tight mb-6">
            렌탈 비즈니스의 모든 마찰을 없애는<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-sky-300 to-indigo-200">
              단 하나의 지능형 전사 자원관리
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed mb-10">
            복잡한 출고 배차부터 모바일 현장 검수, 24시간 백그라운드 AI 에이전트, 
            1금융권 은행 통장 1:1 자동 대사까지 담당자의 최소 노력으로 최대 업무 효익을 창출합니다.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://awp-demo.ebro.run"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              <span>무료 시연 데모 체험하기</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <button
              type="button"
              onClick={() => setTenantModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>고객사 전용 ERP 바로가기</span>
            </button>

            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-400 hover:text-slate-200 font-semibold text-sm transition cursor-pointer"
            >
              도입 상담 신청
            </button>
          </div>
        </div>
      </section>

      {/* ── 3. 5대 핵심 솔루션 기능 (Features Grid) ── */}
      <section id="features" className="py-24 bg-slate-900/40 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest block mb-2 font-mono">
              CORE CAPABILITIES
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              렌탈 도메인 3대 핵심 가치를 관통하는 5대 엔진
            </h2>
            <p className="mt-3 text-slate-400 text-sm">
              전사 표준 헌장 준수: 자산의 효과적 운용, 전 사건의 무누락 기록, 임직원의 최소 조작 실현
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 카드 1 */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-600/50 transition flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400 mb-5">
                  <Truck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">스마트 배차 & 무인 원격 인쇄</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  출고, 입고, 교환(단일 1건 왕복 할인 배차) 의뢰 접수 즉시 현장 컨테이너 프린터로 0초 만에 출고요청서가 자동 무인 출력됩니다.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-850 flex items-center gap-2 text-xs font-semibold text-indigo-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>분산 인쇄 큐 & 다중 스테이션 완결</span>
              </div>
            </div>

            {/* 카드 2 */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-600/50 transition flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-12 h-12 rounded-xl bg-sky-950 border border-sky-800/60 flex items-center justify-center text-sky-400 mb-5">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">현장 모바일 출고 검수 & 서명</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  스마트폰 하나로 장비 외관 사진 4면 촬영, 안전 옵션 볼팅 체크리스트 확인, 기사 서명 날인 후 즉시 자산 상태를 대여중(RENTED)으로 전환합니다.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-850 flex items-center gap-2 text-xs font-semibold text-sky-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>검수 승인 시 자산 상태 대여중 1:1 관통</span>
              </div>
            </div>

            {/* 카드 3 */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-600/50 transition flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-12 h-12 rounded-xl bg-purple-950 border border-purple-800/60 flex items-center justify-center text-purple-400 mb-5">
                  <Bot className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">24시간 eBro AI Agent</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  퇴근 후나 담당자 PC가 꺼져 있어도 모바일 텔레그램 지시가 클라우드 큐에 100% 무누락 보존되며, 익일 PC 부팅 즉시 0초 자동 수확 실행됩니다.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-850 flex items-center gap-2 text-xs font-semibold text-purple-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero-Loss 클라우드 지시 큐 보존</span>
              </div>
            </div>

            {/* 카드 4 */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-600/50 transition flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-800/60 flex items-center justify-center text-emerald-400 mb-5">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">1금융권 은행 통장 1:1 자동 대사</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  국민, 신한, 기업, 우리, 하나, 농협 등 모든 은행 엑셀을 스마트 파서가 자동 분석하여 미수금/외상매출금과 인라인 원클릭으로 100% 대사 마감합니다.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-850 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>스마트 퍼지 매칭 & 원클릭 상계</span>
              </div>
            </div>

            {/* 카드 5 */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-600/50 transition flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-12 h-12 rounded-xl bg-amber-950 border border-amber-800/60 flex items-center justify-center text-amber-400 mb-5">
                  <Layers className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">렌탈 자산 라이프사이클 관리</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  장비 취득부터 감가상각, 정비 점수, 부품 수급, 그리고 교환 시 전자산 전일 마감 ➔ 후장비 당일 승계의 정밀 일할 매출 기여액을 1원도 틀림없이 집계합니다.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-850 flex items-center gap-2 text-xs font-semibold text-amber-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>자산별 정밀 일할 매출 기여액 1:1 보존</span>
              </div>
            </div>

            {/* 카드 6 */}
            <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-600/50 transition flex flex-col justify-between shadow-lg">
              <div>
                <div className="w-12 h-12 rounded-xl bg-rose-950 border border-rose-800/60 flex items-center justify-center text-rose-400 mb-5">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">멀티테넌트 메타데이터 거버넌스</h3>
                <p className="text-sm text-slate-400 leading-relaxed">
                  신규 렌탈사가 유입되어도 소스코드 수정 0건으로 메뉴 On/Off, 9대 조직 기능 할당, 고유 업무 서식을 독립 운영하는 완벽한 클라우드 거버넌스를 제공합니다.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-850 flex items-center gap-2 text-xs font-semibold text-rose-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero Deployment 무중단 테넌트 독립화</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. 테넌트 빠른 로그인 모달 (Tenant Quick Switcher Modal) ── */}
      {tenantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-850 pb-4">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">고객사 전용 ERP 접속</h3>
                  <p className="text-xs text-slate-400">소속 렌탈사를 선택하거나 회사 코드를 입력해 주세요.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTenantModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 회사 검색창 */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="회사명 또는 테넌트 코드 검색..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* 테넌트 목록 그리드 */}
            <div className="max-h-60 overflow-y-auto flex flex-col gap-2 pr-1">
              {filteredTenants.length > 0 ? (
                filteredTenants.map(t => {
                  const sub = t.subdomain || t.tenantCode.toLowerCase();
                  const targetUrl = getTenantUrl(sub);
                  return (
                    <a
                      key={t.id}
                      href={targetUrl}
                      className="p-3 rounded-xl bg-slate-950/80 hover:bg-indigo-950/40 border border-slate-800/80 hover:border-indigo-700/60 transition flex items-center justify-between group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-bold text-xs text-indigo-300">
                          {t.displayName?.slice(0, 2) || t.tenantCode.slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-100 group-hover:text-indigo-300 transition">
                            {t.displayName || t.tradeName}
                          </div>
                          <div className="text-xs font-mono text-slate-500">
                            {sub}.ebro.run
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" />
                    </a>
                  );
                })
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>

            {/* 직접 서브도메인 입력 */}
            <form onSubmit={handleCustomJump} className="pt-3 border-t border-slate-850 flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={customSubdomain}
                  onChange={e => setCustomSubdomain(e.target.value)}
                  placeholder="회사 서브도메인 직접 입력 (예: giyeon)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-mono">.ebro.run</span>
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-indigo-600 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer flex-shrink-0"
              >
                <span>이동</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </form>

            {/* 관리자 관제탑 링크 */}
            <div className="pt-2 text-center border-t border-slate-850/60">
              <a
                href={getAdminConsoleUrl()}
                className="text-xs text-slate-500 hover:text-indigo-400 transition inline-flex items-center gap-1.5"
              >
                <Lock className="w-3 h-3" />
                <span>eBro 플랫폼 최고관리자 관제탑으로 이동</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. 도입 상담 모달 (Contact Modal) ── */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="text-base font-bold text-white">eBro 솔루션 도입 문의</h3>
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-400 leading-relaxed">
              귀사의 고소작업대 렌탈 규모 및 현장 프로세스에 맞춘 맞춤형 도입 컨설팅과 라이브 데모를 제공해 드립니다.
            </p>

            <div className="flex flex-col gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm">
              <div className="flex items-center gap-3 text-slate-300">
                <Phone className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <div>
                  <div className="text-xs text-slate-500 font-semibold">도입 상담 직통전화</div>
                  <div className="font-bold text-white font-mono">010-8798-7771</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-slate-300 pt-2 border-t border-slate-850">
                <Mail className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                <div>
                  <div className="text-xs text-slate-500 font-semibold">공식 문의 이메일</div>
                  <div className="font-bold text-white font-mono">dragonrpa@gmail.com</div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setContactModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. 하단 푸터 (Footer) ── */}
      <footer className="mt-auto border-t border-slate-850 bg-slate-950 py-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-slate-300 font-bold mb-2">
              <span>(주)드래곤RPA eBro 솔루션 사업본부</span>
            </div>
            <p className="text-slate-500 leading-relaxed">
              고소작업대 임대차·물류·회계 자동화 전사 통합 플랫폼 | 서울특별시 송파구 | 사업자등록번호: 215-87-98771
            </p>
            <p className="text-slate-600 mt-1">
              Copyright © 2026 DragonRPA Inc. All rights reserved.
            </p>
          </div>

          <div className="flex items-center gap-6">
            <a
              href={getAdminConsoleUrl()}
              className="text-slate-500 hover:text-slate-300 transition flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>플랫폼 관제탑</span>
            </a>
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="text-slate-500 hover:text-slate-300 transition cursor-pointer"
            >
              도입 문의
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
