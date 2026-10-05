-- scripts/patch_rls_policies.sql
-- 전사 표준 헌장 5.3 및 보안 강화 목적: 클라이언트의 rolePermissions 매트릭스를 Postgres RLS(Row Level Security)로 강제 연동
-- 주의: 이 스크립트를 Supabase SQL Editor에서 실행하면 데이터베이스 레벨에서 접근 통제가 활성화됩니다.

DO $$
DECLARE
    t text;
    -- 테이블명(Supabase 기준)에 매핑되는 Menu ID (CANONICAL_MENU_ALIASES 기준)
    menu_map jsonb := '{
        "contracts": "contract",
        "contractAssets": "contract",
        "contractHistory": "contract",
        "assets": "asset",
        "assetInOutLogs": "asset_inout_history",
        "customers": "customer",
        "deliveries": "delivery",
        "transportMaster": "transport_master",
        "billings": "billing",
        "billingDetails": "billing",
        "receivables": "delinquency",
        "repairs": "repair",
        "consumables": "consumable_stock",
        "consumablePurchases": "consumable_purchase",
        "outboundInspections": "outbound_inspections",
        "leaveApplications": "leave_application",
        "vehicleLogs": "vehicle_log",
        "users": "organization",
        "departments": "organization",
        "customRoles": "permission",
        "rolePermissions": "permission"
    }';
    t_menu text;
BEGIN
    FOR t IN SELECT key FROM jsonb_each_text(menu_map) LOOP
        t_menu := menu_map->>t;
        
        -- 1. RLS 활성화
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
        
        -- 2. 기존 정책 안전하게 초기화 (멱등성 보장)
        EXECUTE format('DROP POLICY IF EXISTS "rls_%I_select" ON %I;', t, t);
        EXECUTE format('DROP POLICY IF EXISTS "rls_%I_cud" ON %I;', t, t);
        
        -- 3. SELECT (canView) 정책 생성
        -- 조건: 요청자의 uid(users.id)에 연결된 customRoleId가 rolePermissions 테이블에 존재하고, canView = true 인 경우
        EXECUTE format('
            CREATE POLICY "rls_%I_select" ON %I
            FOR SELECT TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM "rolePermissions" rp
                    JOIN "users" u ON u."customRoleId" = rp."roleId"
                    WHERE u.id = auth.uid()::text AND rp."menuId" = %L AND rp."canView" = true
                )
                OR auth.uid()::text = ''u-1'' -- 최고관리자 예외 통과
                OR auth.uid()::text = ''sys-admin''
            );
        ', t, t, t_menu);
        
        -- 4. INSERT/UPDATE/DELETE (canSave) 정책 생성
        EXECUTE format('
            CREATE POLICY "rls_%I_cud" ON %I
            FOR ALL TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM "rolePermissions" rp
                    JOIN "users" u ON u."customRoleId" = rp."roleId"
                    WHERE u.id = auth.uid()::text AND rp."menuId" = %L AND rp."canSave" = true
                )
                OR auth.uid()::text = ''u-1''
                OR auth.uid()::text = ''sys-admin''
            );
        ', t, t, t_menu);
    END LOOP;
END $$;
