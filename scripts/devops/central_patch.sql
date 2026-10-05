-- ebro-platform-core 보강 패치 (소스 데이터 완벽 호환)
-- tenants 컬럼 보강
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "systemName" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "businessTypes" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "isUnitTaxation" BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "certificateIssueDate" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "mainYardAddress" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- equipment_manuals 컬럼 보강
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "targetSpecFt" TEXT;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "fileUrl" TEXT;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "fileName" TEXT;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "fileSize" BIGINT;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "fileSizeLabel" TEXT;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "version" TEXT;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "uploadDate" TEXT;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "uploadedBy" TEXT;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "memo" TEXT;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "inspectionItemCodes" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "media_type" TEXT DEFAULT 'PDF';
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "externalUrl" TEXT;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "youtubeVideoId" TEXT;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "durationMinutes" INTEGER;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "aiProcessed" BOOLEAN DEFAULT FALSE;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "aiProcessedAt" TIMESTAMPTZ;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "errorCodes" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "majorParts" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "symptoms" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "aiSummary" TEXT;
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE equipment_manuals ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

-- manual_annotations 컬럼 보강 (기존 화면 어노테이션 62건 완벽 수용)
ALTER TABLE manual_annotations ADD COLUMN IF NOT EXISTS "page_id" TEXT;
ALTER TABLE manual_annotations ADD COLUMN IF NOT EXISTS "page_title" TEXT;
ALTER TABLE manual_annotations ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 1;
ALTER TABLE manual_annotations ADD COLUMN IF NOT EXISTS "annotations" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE manual_annotations ADD COLUMN IF NOT EXISTS "updated_by" TEXT;
ALTER TABLE manual_annotations ALTER COLUMN menu_id DROP NOT NULL;
ALTER TABLE manual_annotations ALTER COLUMN element_selector DROP NOT NULL;
ALTER TABLE manual_annotations ALTER COLUMN annotation_markdown DROP NOT NULL;

NOTIFY pgrst, 'reload schema';
