// src/pages/LandingPage.tsx
// 🌐 eBro 솔루션 공식 홍보 포털 (Enterprise Clean B2B 스타일)

import React, { useState } from 'react';
import { getAdminConsoleUrl } from '../utils/domainRouter';
import {
  Truck,
  Smartphone,
  MessageSquare,
  Building2,
  ArrowRight,
  CheckCircle2,
  Mail,
  X,
  Lock,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const [contactModalOpen, setContactModalOpen] = useState(false);

  return (
    <div data-hs-observe="landingpage" className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-[#FF5200] selection:text-white">
      {/* ── 1. 메인 내비게이션 바 ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-[#FF5200] flex items-center justify-center">
              <span className="text-white font-bold text-xl tracking-tighter">eB</span>
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">eBro</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition">주요 기능</a>
            <a href="#stats" className="hover:text-slate-900 transition">도입 효과</a>
            <button
              onClick={() => setContactModalOpen(true)}
              className="hover:text-slate-900 transition cursor-pointer"
            >
              도입 컨설팅
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <a
              href="https://awp-demo.ebro.run"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex text-sm font-medium text-slate-600 hover:text-slate-900 transition"
            >
              라이브 데모
            </a>
            <button
              onClick={() => setContactModalOpen(true)}
              className="px-5 py-2.5 rounded bg-[#FF5200] hover:bg-[#E14504] text-white text-sm font-bold transition cursor-pointer"
            >
              상담 신청
            </button>
          </div>
        </div>
      </header>

      {/* ── 2. 히어로 섹션 ── */}
      <section className="relative pt-32 pb-40 overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight text-slate-900 leading-[1.1] mb-8">
            고소작업대 렌탈의 모든 것,<br />
            <span className="text-[#FF5200]">하나의 지능형 플랫폼</span>으로.
          </h1>
          <p className="text-lg sm:text-2xl text-slate-500 max-w-3xl mx-auto leading-relaxed mb-12 font-light">
            전화 배차의 혼선, 잃어버리는 종이 인수증, 며칠씩 걸리는 월말 통장 대사를 멈추십시오. eBro는 임직원의 최소 노력으로 최대 업무 효익을 창출하는 전사 표준 통합 솔루션입니다.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://awp-demo.ebro.run"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 rounded bg-[#FF5200] hover:bg-[#E14504] text-white font-bold text-base transition flex items-center gap-2 cursor-pointer"
            >
              무료 데모 체험하기 <ArrowRight className="w-5 h-5" />
            </a>
            <button
              onClick={() => setContactModalOpen(true)}
              className="px-8 py-4 rounded bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 font-bold text-base transition cursor-pointer"
            >
              맞춤형 도입 상담
            </button>
          </div>
        </div>
      </section>

      {/* ── 3. 주요 통계 ── */}
      <section id="stats" className="py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 text-center lg:text-left">
            <div>
              <div className="text-5xl font-bold text-slate-900 tracking-tight mb-4">0<span className="text-[#FF5200] text-3xl">초</span></div>
              <div className="text-lg font-bold text-slate-900 mb-2">현장 무인 자동 인쇄</div>
              <p className="text-slate-500">배차 접수 즉시 주기장 컨테이너로 출고요청서 자동 스풀링 출력.</p>
            </div>
            <div>
              <div className="text-5xl font-bold text-slate-900 tracking-tight mb-4">100<span className="text-[#FF5200] text-3xl">%</span></div>
              <div className="text-lg font-bold text-slate-900 mb-2">매출 기여액 보존</div>
              <p className="text-slate-500">대차 교체 시 전자산 마감 및 후장비 일할 매출을 완벽히 승계.</p>
            </div>
            <div>
              <div className="text-5xl font-bold text-slate-900 tracking-tight mb-4">21<span className="text-[#FF5200] text-3xl">대</span></div>
              <div className="text-lg font-bold text-slate-900 mb-2">안전스펙 전수 검수</div>
              <p className="text-slate-500">과상승방지봉 등 법정 안전 필수 옵션을 모바일 기기로 전수 승인.</p>
            </div>
            <div>
              <div className="text-5xl font-bold text-slate-900 tracking-tight mb-4">₩0<span className="text-[#FF5200] text-3xl">원</span></div>
              <div className="text-lg font-bold text-slate-900 mb-2">통장 대사 차액</div>
              <p className="text-slate-500">청구총액과 입금액의 1:1 대사 검증식으로 회계 무결성 완성.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. 핵심 기능 상세 (Alternating blocks) ── */}
      <section id="features" className="py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-40">
          
          {/* Feature 1 */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-6">
                <Truck className="w-6 h-6 text-[#FF5200]" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">배차 및 원격 인쇄</h2>
              <p className="text-lg text-slate-500 leading-relaxed mb-8">
                영업팀이 배차를 의뢰하는 즉시, 현장 컨테이너의 네트워크 프린터로 출고요청서가 자동 출력됩니다. 담당자가 수기로 작성할 필요 없이 지연 없는 0초 배차를 실현합니다.
              </p>
              <ul className="space-y-4">
                {['단일 1건 왕복 교환 배차 정규 체인 관리', '현장 컨테이너 네트워크 프린터 0초 자동 백그라운드 스풀링', '화물 지입 기사 및 운송사 실시간 배정 & 단가 대사'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700 font-medium">
                    <CheckCircle2 className="w-6 h-6 text-[#FF5200] shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-50 rounded-3xl p-12 flex items-center justify-center border border-slate-100 aspect-square">
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white shadow-xl shadow-slate-200/50">
                  <Truck className="w-10 h-10 text-slate-900" />
                </div>
                <div className="text-xl font-bold text-slate-900">물류 자동화 엔진</div>
              </div>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="grid lg:grid-cols-2 gap-16 items-center lg:flex-row-reverse">
            <div className="lg:order-2">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-6">
                <Smartphone className="w-6 h-6 text-[#FF5200]" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">모바일 현장 검수 & RENTED 전환</h2>
              <p className="text-lg text-slate-500 leading-relaxed mb-8">
                스마트폰 하나로 외관 4면을 촬영하고, 기사 서명을 받는 즉시 자산 상태가 '대여중'으로 자동 전환됩니다. 분실하기 쉬운 종이 인수증 대신 전자 계약서로 영구 보존하세요.
              </p>
              <ul className="space-y-4">
                {['모바일 고화질 촬영 및 하자 보존', '21대 법정 안전장치 전수 검수', '검수 승인 마감 시 자산 상태 RENTED 자동 전환'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700 font-medium">
                    <CheckCircle2 className="w-6 h-6 text-[#FF5200] shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:order-1 bg-slate-50 rounded-3xl p-12 flex items-center justify-center border border-slate-100 aspect-square">
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white shadow-xl shadow-slate-200/50">
                  <Smartphone className="w-10 h-10 text-slate-900" />
                </div>
                <div className="text-xl font-bold text-slate-900">모바일 검수 시스템</div>
              </div>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-6">
                <MessageSquare className="w-6 h-6 text-[#FF5200]" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">eBro AI Agent 메신저 통합</h2>
              <p className="text-lg text-slate-500 leading-relaxed mb-8">
                퇴근 후나 이동 중 텔레그램으로 지시문만 남기세요. "평택 삼성 35호기 교환해줘"라는 자연어 한마디로 계약 조건을 100% 자동 상속받는 배차가 즉시 생성됩니다.
              </p>
              <ul className="space-y-4">
                {['소형 경량 AI가 지시문 핵심 요소 정밀 추출', '영업부의 불필요한 자산번호 직접 지정 원천 방지', '단일 의미 전사 표준화 준수'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700 font-medium">
                    <CheckCircle2 className="w-6 h-6 text-[#FF5200] shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-50 rounded-3xl p-12 flex items-center justify-center border border-slate-100 aspect-square">
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white shadow-xl shadow-slate-200/50">
                  <MessageSquare className="w-10 h-10 text-slate-900" />
                </div>
                <div className="text-xl font-bold text-slate-900">24시간 AI 비서</div>
              </div>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="grid lg:grid-cols-2 gap-16 items-center lg:flex-row-reverse">
            <div className="lg:order-2">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-6">
                <Building2 className="w-6 h-6 text-[#FF5200]" />
              </div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">은행 통장 1:1 자동 대사</h2>
              <p className="text-lg text-slate-500 leading-relaxed mb-8">
                주요 1금융권 통장 엑셀을 업로드하면 자동 매칭 엔진이 입금자명과 고객사 상호를 매칭하여 대차 차액 0원의 완벽한 회계 무결성을 제공합니다.
              </p>
              <ul className="space-y-4">
                {['주요 은행 통장 엑셀 파싱 및 자동 매칭', '외상매출금 및 운송료 1원 단위 검증', '자산별 누적 매출 기여액 정밀 집계'].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-700 font-medium">
                    <CheckCircle2 className="w-6 h-6 text-[#FF5200] shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:order-1 bg-slate-50 rounded-3xl p-12 flex items-center justify-center border border-slate-100 aspect-square">
              <div className="text-center space-y-6">
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-white shadow-xl shadow-slate-200/50">
                  <Building2 className="w-10 h-10 text-slate-900" />
                </div>
                <div className="text-xl font-bold text-slate-900">회계 무결성 엔진</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. 하단 CTA ── */}
      <section className="py-32 bg-slate-900 text-white text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-8 leading-tight">
            렌탈 비즈니스의 운영 마찰을 끝내고<br />
            최대 편익의 시스템을 경험하십시오.
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="https://awp-demo.ebro.run"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 rounded bg-[#FF5200] hover:bg-[#E14504] text-white font-bold text-base transition flex items-center justify-center gap-2"
            >
              시연 데모 체험하기 <ArrowRight className="w-5 h-5" />
            </a>
            <button
              onClick={() => setContactModalOpen(true)}
              className="px-8 py-4 rounded bg-white/10 hover:bg-white/20 text-white font-bold text-base transition flex items-center justify-center gap-2 cursor-pointer"
            >
              도입 상담 문의
            </button>
          </div>
        </div>
      </section>

      {/* ── 6. Footer ── */}
      <footer className="bg-white py-12 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-slate-500 text-sm text-center md:text-left">
            <div className="flex items-center gap-2 text-slate-900 font-bold mb-2 justify-center md:justify-start">
              <div className="w-6 h-6 rounded bg-[#FF5200] text-white flex items-center justify-center text-xs">eB</div>
              <span>(주)드래곤RPA eBro 솔루션 사업본부</span>
            </div>
            <p className="mb-1">렌탈비즈니스 ERP 통합 플랫폼 | 서울특별시 금천구 | 사업자등록번호: 806-88-03266 | 대표 이메일: contact@ebro.run</p>
            <p>Copyright © 2026 DragonRPA Inc. All rights reserved.</p>
          </div>
          <div className="flex gap-6">
            <a href={getAdminConsoleUrl()} className="text-slate-500 hover:text-slate-900 flex items-center gap-2 font-medium transition">
              <Lock className="w-4 h-4" /> 플랫폼 관제탑
            </a>
          </div>
        </div>
      </footer>

      {/* ── 모달 ── */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-8 shadow-2xl relative">
            <button
              onClick={() => setContactModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 cursor-pointer transition"
            >
              <X className="w-6 h-6" />
            </button>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">도입 문의</h3>
            <p className="text-slate-500 mb-8 leading-relaxed">
              귀사의 고소작업대 렌탈 규모 및 현장 프로세스에 맞춘 컨설팅을 제공해 드립니다.
            </p>
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-100 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6 text-[#FF5200]" />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500 mb-1">공식 문의 이메일</div>
                <a href="mailto:contact@ebro.run" className="text-lg font-bold text-slate-900 hover:text-[#FF5200] transition">
                  contact@ebro.run
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
