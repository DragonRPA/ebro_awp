-- ==============================================================================
-- eBro Platform Central Database Schema (ebro-platform-core)
-- Tier 1: Control Plane & Global Knowledge Base
-- ==============================================================================

-- 1. UUID 및 필수 확장 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. 테넌트 마스터 원장 (tenants)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    "tenantCode" TEXT NOT NULL UNIQUE,
    "subdomain" TEXT UNIQUE,
    "displayName" TEXT NOT NULL,
    "corporateName" TEXT NOT NULL,
    "tradeName" TEXT,
    "businessNumber" TEXT NOT NULL,
    "corporateRegistrationNumber" TEXT,
    "representativeName" TEXT NOT NULL,
    "openingDate" TEXT NOT NULL,
    "businessAddress" TEXT NOT NULL,
    "headOfficeAddress" TEXT,
    "businessCategory" TEXT DEFAULT '사업지원및임대서비스업',
    "businessItem" TEXT DEFAULT '고소작업대임대',
    "tel" TEXT NOT NULL,
    "fax" TEXT,
    "salesPhone" TEXT,
    "taxEmail" TEXT NOT NULL,
    "taxOffice" TEXT,
    "websiteUrl" TEXT,
    "ciUrl" TEXT,
    "logoUrl" TEXT,
    "stampImageUrl" TEXT,
    "stampBase64" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK ("status" IN ('ACTIVE', 'SUSPENDED', 'TERMINATED', 'EXPIRED')),
    "isDefault" BOOLEAN DEFAULT FALSE,
    "allowCustomBillingStatement" BOOLEAN DEFAULT FALSE,
    "solutionType" TEXT NOT NULL DEFAULT 'AWP' CHECK ("solutionType" IN ('AWP', 'IT', 'MULTI')),
    "targetRepo" TEXT DEFAULT 'DragonRPA/ebro_awp',
    "subscription" JSONB DEFAULT '{}'::jsonb,
    "features" JSONB DEFAULT '{}'::jsonb,
    "bankAccounts" JSONB DEFAULT '[]'::jsonb,
    "yards" JSONB DEFAULT '[]'::jsonb,
    "workplaces" JSONB DEFAULT '[]'::jsonb,
    "allowedPages" JSONB DEFAULT '[]'::jsonb,
    "hiddenPages" JSONB DEFAULT '[]'::jsonb,
    "tenantSupabaseUrl" TEXT,
    "tenantSupabaseAnonKey" TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants("subdomain");
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants("status");
CREATE INDEX IF NOT EXISTS idx_tenants_solution_type ON tenants("solutionType");

-- ==============================================================================
-- 3. 장비 기술 매뉴얼 라이브러리 (equipment_manuals)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS equipment_manuals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "modelName" TEXT NOT NULL,
    category TEXT NOT NULL,
    solution_type TEXT NOT NULL DEFAULT 'AWP' CHECK (solution_type IN ('AWP', 'IT', 'ALL')),
    manufacturer TEXT,
    specifications JSONB DEFAULT '{}'::jsonb,
    "manualUrl" TEXT,
    "circuitDiagramUrl" TEXT,
    "partsCatalogUrl" TEXT,
    keywords TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manuals_model ON equipment_manuals("modelName");
CREATE INDEX IF NOT EXISTS idx_manuals_category ON equipment_manuals(category);
CREATE INDEX IF NOT EXISTS idx_manuals_solution_type ON equipment_manuals(solution_type);
CREATE INDEX IF NOT EXISTS idx_manuals_keywords ON equipment_manuals USING gin (keywords);

-- ==============================================================================
-- 4. 시스템 화면 메뉴별 공통 매뉴얼 (system_manuals)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS system_manuals (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    menu_id TEXT NOT NULL,
    solution_type TEXT NOT NULL DEFAULT 'ALL' CHECK (solution_type IN ('AWP', 'IT', 'ALL')),
    manual_url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_system_manuals_menu UNIQUE(menu_id, solution_type)
);

CREATE INDEX IF NOT EXISTS idx_system_manuals_menu ON system_manuals(menu_id);
CREATE INDEX IF NOT EXISTS idx_system_manuals_solution ON system_manuals(solution_type);

-- ==============================================================================
-- 5. 화면 UI 요소별 도움말/툴팁 지식 (manual_annotations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS manual_annotations (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    menu_id TEXT NOT NULL,
    element_selector TEXT NOT NULL,
    solution_type TEXT NOT NULL DEFAULT 'ALL' CHECK (solution_type IN ('AWP', 'IT', 'ALL')),
    title TEXT,
    annotation_markdown TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_manual_annotations_elem UNIQUE(menu_id, element_selector, solution_type)
);

CREATE INDEX IF NOT EXISTS idx_annotations_menu ON manual_annotations(menu_id);
CREATE INDEX IF NOT EXISTS idx_annotations_solution ON manual_annotations(solution_type);

-- ==============================================================================
-- 6. 법적 통고문 / 내용증명 표준 서식 (legal_notice_templates)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS legal_notice_templates (
    id TEXT PRIMARY KEY,
    template_code TEXT NOT NULL UNIQUE,
    template_name TEXT NOT NULL,
    solution_type TEXT NOT NULL DEFAULT 'AWP' CHECK (solution_type IN ('AWP', 'IT', 'ALL')),
    content_template TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_legal_templates_code ON legal_notice_templates(template_code);
CREATE INDEX IF NOT EXISTS idx_legal_templates_solution ON legal_notice_templates(solution_type);

-- ==============================================================================
-- 7. 모바일 앱(APK) 공식 배포 버전 원장 (apk_releases)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS apk_releases (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    version_name TEXT NOT NULL,
    version_code INTEGER NOT NULL,
    app_target TEXT NOT NULL DEFAULT 'ALL' CHECK (app_target IN ('AWP_DRIVER', 'IT_FIELD_ENGINEER', 'ALL')),
    download_url TEXT NOT NULL,
    release_notes TEXT,
    is_mandatory BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apk_releases_target ON apk_releases(app_target);

-- ==============================================================================
-- 8. 개발자 권한 물리 단말기 인가 대장 (developer_authorized_devices)
-- eBro 전사 멀티 테넌트 통합 개발자 단말기 공인 SSOT 대장 (테넌트 독립 중앙 플랫폼)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS developer_authorized_devices (
    id                      TEXT PRIMARY KEY,
    "developerId"           TEXT NOT NULL,
    "developerName"         TEXT NOT NULL,
    "machineName"           TEXT NOT NULL,
    "macAddress"            TEXT NOT NULL,
    "hardwareFingerprint"   TEXT NOT NULL,
    platform                TEXT,
    status                  TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REVOKED, EMERGENCY_TEMP
    "isPrimary"             BOOLEAN DEFAULT FALSE,
    "emergencyBreakGlassUsed" BOOLEAN DEFAULT FALSE,
    note                    TEXT,
    "registeredAt"          TIMESTAMPTZ DEFAULT NOW(),
    "lastVerifiedAt"        TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt"             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dev_auth_devices_mac ON developer_authorized_devices("macAddress");
CREATE INDEX IF NOT EXISTS idx_dev_auth_devices_dev ON developer_authorized_devices("developerId");
CREATE INDEX IF NOT EXISTS idx_dev_auth_devices_status ON developer_authorized_devices(status);

-- ==============================================================================
-- 9. RLS (Row Level Security) 정책 - 공통 지식 DB 읽기 허용 & 제어
-- ==============================================================================
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_notice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE apk_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_authorized_devices ENABLE ROW LEVEL SECURITY;

-- 9-1. tenants: 익명/인증 유저는 활성 테넌트의 도메인 매핑 및 기본 정보 SELECT 허용
DROP POLICY IF EXISTS "allow_anon_read_tenants" ON tenants;
CREATE POLICY "allow_anon_read_tenants" ON tenants FOR SELECT TO anon USING (status = 'ACTIVE' OR status = 'SUSPENDED');

DROP POLICY IF EXISTS "allow_auth_all_tenants" ON tenants;
CREATE POLICY "allow_auth_all_tenants" ON tenants FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 9-2. 공통 지식/서식/APK 테이블: 전 테넌트 읽기(SELECT) 전면 허용
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['equipment_manuals', 'system_manuals', 'manual_annotations', 'legal_notice_templates', 'apk_releases'])
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "allow_anon_read_%s" ON %I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "allow_anon_read_%s" ON %I FOR SELECT TO anon USING (true);', tbl, tbl);
        
        EXECUTE format('DROP POLICY IF EXISTS "allow_auth_read_%s" ON %I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "allow_auth_read_%s" ON %I FOR SELECT TO authenticated USING (true);', tbl, tbl);
    END LOOP;
END $$;

-- 9-3. developer_authorized_devices: 단일실행 등록기 및 ERP 로그인 하드웨어 검증을 위해 ALL 허용
DROP POLICY IF EXISTS "allow_anon_all_dev_devices" ON developer_authorized_devices;
CREATE POLICY "allow_anon_all_dev_devices" ON developer_authorized_devices FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_auth_all_dev_devices" ON developer_authorized_devices;
CREATE POLICY "allow_auth_all_dev_devices" ON developer_authorized_devices FOR ALL TO authenticated USING (true) WITH CHECK (true);

