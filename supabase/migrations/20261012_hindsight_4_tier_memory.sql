-- ==============================================================================
-- 🧠 eBro ERP: Hindsight 4-Tier Memory System DDL Specification
-- 🏛️ 대한민국 개인정보보호법(PIPA) 및 전사 시스템 개발 표준 헌장 준수
-- 🚀 Supabase Pro (pgvector HNSW, JSONB, RLS, 4대 메모리 아키텍처)
-- ==============================================================================

-- 1. pgvector 고성능 벡터 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. World facts (사실 지식): 전사 표준 헌장, 기준 정보, 장비 제원, 불변 공리
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hindsight_world_facts (
    id                  TEXT PRIMARY KEY DEFAULT ('wf_' || gen_random_uuid()),
    tenant_id          TEXT NOT NULL DEFAULT 'giyeonlift',
    domain              TEXT NOT NULL CHECK (domain IN ('SALES', 'LOGISTICS', 'ASSET', 'FINANCE', 'SYSTEM', 'CHARTER')),
    fact_key            TEXT NOT NULL UNIQUE,
    fact_title          TEXT NOT NULL,
    fact_content        TEXT NOT NULL,
    source_reference    TEXT,
    is_immutable        BOOLEAN NOT NULL DEFAULT TRUE,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding           vector(1536),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_wf_domain ON hindsight_world_facts(domain);
CREATE INDEX IF NOT EXISTS idx_hs_wf_tenant ON hindsight_world_facts(tenant_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Experiences (경험 데이터): 사용자 인터랙션, 메뉴 조작, 변동 SQL 무음 캡처
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hindsight_experiences (
    id                  TEXT PRIMARY KEY DEFAULT ('exp_' || gen_random_uuid()),
    tenant_id          TEXT NOT NULL DEFAULT 'giyeonlift',
    domain              TEXT NOT NULL DEFAULT 'GENERAL',
    action_name         TEXT NOT NULL,
    menu_path           TEXT NOT NULL,
    user_id             TEXT,
    user_name           TEXT,
    trigger_element     JSONB,
    interaction_history JSONB NOT NULL DEFAULT '[]'::jsonb,
    final_query         JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_sql             TEXT,
    pii_masked          BOOLEAN NOT NULL DEFAULT TRUE,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding           vector(1536),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_exp_domain ON hindsight_experiences(domain);
CREATE INDEX IF NOT EXISTS idx_hs_exp_action ON hindsight_experiences(action_name);
CREATE INDEX IF NOT EXISTS idx_hs_exp_menu ON hindsight_experiences(menu_path);
CREATE INDEX IF NOT EXISTS idx_hs_exp_created_at ON hindsight_experiences(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hs_exp_tenant ON hindsight_experiences(tenant_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Observations (관찰·패턴): 누적된 경험으로부터 귀납적으로 추출된 신념과 통계
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hindsight_observations (
    id                  TEXT PRIMARY KEY DEFAULT ('obs_' || gen_random_uuid()),
    tenant_id          TEXT NOT NULL DEFAULT 'giyeonlift',
    domain              TEXT NOT NULL CHECK (domain IN ('SALES', 'LOGISTICS', 'ASSET', 'FINANCE', 'SYSTEM')),
    cluster_key         TEXT NOT NULL,
    belief_title        TEXT NOT NULL,
    belief_statement    TEXT NOT NULL,
    proof_count         INTEGER NOT NULL DEFAULT 1,
    confidence          DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    supporting_quotes   JSONB NOT NULL DEFAULT '[]'::jsonb,
    contradictions      JSONB NOT NULL DEFAULT '[]'::jsonb,
    first_observed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_refined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    embedding           vector(1536)
);

CREATE INDEX IF NOT EXISTS idx_hs_obs_domain ON hindsight_observations(domain);
CREATE INDEX IF NOT EXISTS idx_hs_obs_cluster ON hindsight_observations(cluster_key);
CREATE INDEX IF NOT EXISTS idx_hs_obs_confidence ON hindsight_observations(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_hs_obs_tenant ON hindsight_observations(tenant_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. Mental models (멘탈 모델): 상비 지식 위키, standing Q&A, 1초 추천 프로젝션
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hindsight_mental_models (
    id                  TEXT PRIMARY KEY DEFAULT ('mm_' || gen_random_uuid()),
    tenant_id          TEXT NOT NULL DEFAULT 'giyeonlift',
    domain              TEXT NOT NULL CHECK (domain IN ('SALES', 'LOGISTICS', 'ASSET', 'FINANCE', 'SYSTEM')),
    model_key           TEXT NOT NULL UNIQUE,
    title               TEXT NOT NULL,
    standing_query      TEXT NOT NULL,
    content_markdown    TEXT NOT NULL,
    structured_data     JSONB NOT NULL DEFAULT '{}'::jsonb,
    revision            INTEGER NOT NULL DEFAULT 1,
    last_synthesized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    embedding           vector(1536)
);

CREATE INDEX IF NOT EXISTS idx_hs_mm_domain ON hindsight_mental_models(domain);
CREATE INDEX IF NOT EXISTS idx_hs_mm_key ON hindsight_mental_models(model_key);
CREATE INDEX IF NOT EXISTS idx_hs_mm_tenant ON hindsight_mental_models(tenant_id);

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. pgvector HNSW 인덱스 (고속 시맨틱 검색)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_hs_wf_embedding ON hindsight_world_facts USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_hs_exp_embedding ON hindsight_experiences USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_hs_obs_embedding ON hindsight_observations USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_hs_mm_embedding ON hindsight_mental_models USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. Row Level Security (RLS) 정책
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE hindsight_world_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hindsight_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE hindsight_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE hindsight_mental_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read World Facts" ON hindsight_world_facts;
CREATE POLICY "Public Read World Facts" ON hindsight_world_facts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Modify World Facts" ON hindsight_world_facts;
CREATE POLICY "Public Modify World Facts" ON hindsight_world_facts FOR ALL USING (true);

DROP POLICY IF EXISTS "Public Read Experiences" ON hindsight_experiences;
CREATE POLICY "Public Read Experiences" ON hindsight_experiences FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Insert Experiences" ON hindsight_experiences;
CREATE POLICY "Public Insert Experiences" ON hindsight_experiences FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Observations" ON hindsight_observations;
CREATE POLICY "Public Read Observations" ON hindsight_observations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Modify Observations" ON hindsight_observations;
CREATE POLICY "Public Modify Observations" ON hindsight_observations FOR ALL USING (true);

DROP POLICY IF EXISTS "Public Read Mental Models" ON hindsight_mental_models;
CREATE POLICY "Public Read Mental Models" ON hindsight_mental_models FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public Modify Mental Models" ON hindsight_mental_models;
CREATE POLICY "Public Modify Mental Models" ON hindsight_mental_models FOR ALL USING (true);

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. 하위 호환성 뷰: 기존 awp_shared_memories와 hindsight_experiences 연동
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_awp_shared_memories_compat AS
SELECT 
    id,
    tenant_id,
    action_name,
    menu_path,
    raw_sql,
    final_query,
    json_build_object(
        'trigger_element', trigger_element,
        'interaction_history', interaction_history
    ) AS ui_context_bundle,
    created_at
FROM hindsight_experiences;
