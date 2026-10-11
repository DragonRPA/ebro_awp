-- ==============================================================================
-- 🌐 eBro Platform Central Database (nyfashwbdcepncpdwpdb.supabase.co)
-- 8. 개발자 권한 물리 단말기 인가 대장 (developer_authorized_devices) DDL & RLS
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

-- RLS 정책 설정
ALTER TABLE developer_authorized_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_anon_all_dev_devices" ON developer_authorized_devices;
CREATE POLICY "allow_anon_all_dev_devices" ON developer_authorized_devices FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "allow_auth_all_dev_devices" ON developer_authorized_devices;
CREATE POLICY "allow_auth_all_dev_devices" ON developer_authorized_devices FOR ALL TO authenticated USING (true) WITH CHECK (true);
