# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, TypeScript, Vite, Supabase, Vercel

## Users

고소작업대(AWP) 및 IT 장비 렌탈 비즈니스의 실무 전문가 (영업사원, 출고/자산 담당자, 배차 관리자, 정산 관리자)

## Product Purpose

렌탈 자산의 운영(가동/유휴) 상태를 현장 라이프사이클과 완벽히 일치시키고, 모든 비즈니스 이벤트(출고, 정비, 반납)를 무누락 추적하며, 임직원 업무의 최소 조작으로 최대 편익을 창출하는 전사 자원 관리(ERP) 시스템.

## Positioning

단순 데이터 기록 도구가 아닌, 렌탈 도메인에 최적화된 "1단어 1뜻 (SSOT)", 무수식어 건조 UI, 부서 간 권한 분리(R&R)를 강제하여 사용자 실수를 원천 차단하고 정산 무결성을 강제하는 전문가용 엔터프라이즈 시스템. 여러 렌탈사(테넌트)를 동시에 수용할 수 있는 SaaS 멀티테넌트 아키텍처와 통합 AI 연합학습(Hindsight Federated Learning)을 지원.

## Operating Context

PC 데스크탑 환경 위주의 고밀도 데이터 대사 작업(월말 정산, 배차 관리 등) 및 현장 작업 확인 등 전문가의 빠른 판단과 조작이 필요한 실무 환경.

## Capabilities and Constraints

- 모든 이벤트는 데이터베이스(`supabase`)에 실시간 영구 기록.
- "Gutenberg Z-패턴" 4단계 동선 준수 (스코프 설정 -> 데이터 유입 -> 인라인 대사 -> 우하단 완결).
- 업무 속성에 따라 요청 처리형(Card/Dossier)과 기간 조회/정산형(고밀도 Grid) UI의 엄격한 분리 적용.
- Hindsight Stealth Architecture를 통해 중앙 DB에 노하우를 집계.

## Brand Commitments

- 무수식어 건조한 명사·동사 UI 단일 표준화 정책 (Zero-Adjective Dry Noun-Verb Syntax Standard). "강력한", "스마트", "실시간" 등의 미사여구 전면 배제.
- 셀 및 레이블 줄바꿈 방지 원칙 (`white-space: nowrap`).
- 레이블과 입력 필드는 좌우 배치가 아닌 상하 스택 배치(Vertical Header-Label Layout) 원칙 준수.

## Evidence on Hand

- 전사 시스템 개발 표준 헌장 (System Development Standards) 문서화 완료.
- 실제 Supabase DB 스키마 로직 적용 완료.

## Product Principles

1. **최대 편익 달성:** 임직원의 최소 노력으로 최대 업무 효익 창출.
2. **보존 법칙의 무결성:** 날짜 보존, 수지 보존(차액 ₩0), 상태 보존 법칙의 엄격한 증명.
3. **단일 진실의 원천 (SSOT):** 전 계층 1단어 1뜻 관통, 매핑 레이어 및 다의어 파편화 방지.
4. **결정론적 품질 방어:** AI Slop 배제, 오버플로우 방어, 예측 가능한 레이아웃 강제.
5. **독립 감사 (Auditor Agent):** DB 물리적 실사 및 시계열 타임라인 무결성 검수.

