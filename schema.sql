-- ==============================================================================
-- [Í∏∞Ïó∞Î¶¨ÌîÑÌä∏ ERP] Ï†ÑÏÇ¨ Îã®Ïùº ÌëúÏ§Ä ÌÜµÌï© Îç∞Ïù¥ÌÑ∞Î≤†Ïù¥Ïä§ DDL Ïä§ÌÇ§Îßà (SSOT)
-- ÎåÄÏÉÅ DBMS: Supabase PostgreSQL (PostgreSQL 15+)
-- ÏÑ§Í≥Ñ ÏõêÏπô:
--   1. [Ïπ¥ÌÖåÍ≥†Î¶¨ I] 3ÎåÄ ÌïµÏã¨ Í∞ÄÏπò (ÏûêÏÇ∞ Ïö¥Ïö©, Î¨¥ÎàÑÎùΩ DB Ïù¥Î†•, ÏûÑÏßÅÏõê ÏµúÏÜå Ï°∞Ïûë)
--   2. [ÎÖºÎ¶¨Ï†Å Ïª¨Îüº 6Îã®Í≥Ñ Î∞∞Ïπò ÌëúÏ§Ä]:
--      ‚ë† ÏãùÎ≥ÑÏûê/PK ‚ûî ‚ë° ÌïµÏã¨ Î≥∏Ïßà ÏÜçÏÑ± ‚ûî ‚ë¢ Í¥ÄÍ≥Ñ/Ïô∏ÎûòÌÇ§(FK) ‚ûî ‚ë£ ÏùºÏ†ï/ÏàòÎüâ/Í∏àÏï° ‚ûî ‚ë§ ÏÉÅÌÉú/Î©îÎ™®/ÎπÑÍ≥† ‚ûî ‚ë• Í∞êÏÇ¨ Ï∂îÏ†Å(Audit)
--   3. Ï§ëÎ≥µ Ï†ïÏùò Ï†úÍ±∞ Î∞è RLS Î≥¥Ïïà Ï†ïÏ±Ö Î©±Îì±ÏÑ± 100% Î≥¥Ïû•
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- Í∏∞Ï°¥ ÌÖåÏù¥Î∏î ÏùºÍ¥Ñ Ï†ïÎ¶¨ (FK Ïó≠Ïàú CASCADE)
-- ------------------------------------------------------------------------------
DROP TABLE IF EXISTS settlement_payment_logs CASCADE;
DROP TABLE IF EXISTS purchase_settlement_items CASCADE;
DROP TABLE IF EXISTS purchase_settlements CASCADE;
DROP TABLE IF EXISTS payment_deposit_links CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS receivables CASCADE;
DROP TABLE IF EXISTS billing_details CASCADE;
DROP TABLE IF EXISTS billing_invoices CASCADE;
DROP TABLE IF EXISTS billings CASCADE;
DROP TABLE IF EXISTS bank_matching_rules CASCADE;
DROP TABLE IF EXISTS bank_transactions CASCADE;
DROP TABLE IF EXISTS bank_account_initial_balances CASCADE;
DROP TABLE IF EXISTS cash_flow_snapshots CASCADE;
DROP TABLE IF EXISTS prepaid_transactions CASCADE;
DROP TABLE IF EXISTS legal_notice_templates CASCADE;
DROP TABLE IF EXISTS legal_notice_logs CASCADE;
DROP TABLE IF EXISTS external_leases CASCADE;
DROP TABLE IF EXISTS bank_initial_balances CASCADE;
DROP TABLE IF EXISTS asset_inout_logs CASCADE;
DROP TABLE IF EXISTS delinquency_action_logs CASCADE;
DROP TABLE IF EXISTS depreciation_logs CASCADE;
DROP TABLE IF EXISTS outbound_inspections CASCADE;

DROP TABLE IF EXISTS asset_in_out_logs CASCADE;

DROP TABLE IF EXISTS repair_consumables CASCADE;
DROP TABLE IF EXISTS repairs CASCADE;
DROP TABLE IF EXISTS inspection_checklist_items CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS transport_drivers CASCADE;
DROP TABLE IF EXISTS transport_companies CASCADE;
DROP TABLE IF EXISTS contract_history CASCADE;
DROP TABLE IF EXISTS contract_assets CASCADE;
DROP TABLE IF EXISTS contracts CASCADE;
DROP TABLE IF EXISTS mechanic_consumable_stocks CASCADE;
DROP TABLE IF EXISTS consumable_logs CASCADE;
DROP TABLE IF EXISTS consumable_purchase_items CASCADE;
DROP TABLE IF EXISTS consumable_purchase_requests CASCADE;
DROP TABLE IF EXISTS consumable_purchases CASCADE;
DROP TABLE IF EXISTS consumables CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS products CASCADE;

DROP TABLE IF EXISTS customer_sites CASCADE;
DROP TABLE IF EXISTS customer_contacts CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
DROP TABLE IF EXISTS payroll_closings CASCADE;
DROP TABLE IF EXISTS overtime_records CASCADE;
DROP TABLE IF EXISTS leave_usages CASCADE;
DROP TABLE IF EXISTS annual_leave_quotas CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS custom_roles CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS departments CASCADE;





DROP TABLE IF EXISTS todos CASCADE;


DROP TABLE IF EXISTS google_configs CASCADE;


-- ==============================================================================
-- üèõÔ∏è [ÎèÑÎ©îÏù∏ 1] Ï°∞ÏßÅ, Í≥ÑÏ†ï Î∞è Ïù∏ÏÇ¨ÎÖ∏Î¨¥ (Org, Users & HR)
-- ==============================================================================

-- 1-1. Î∂ÄÏÑú ÎßàÏä§ÌÑ∞ (departments)
CREATE TABLE departments (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL UNIQUE,
    "parentDepartmentId"  TEXT REFERENCES departments(id) ON DELETE SET NULL,
    "managerId"           TEXT, -- Î∂ÄÏÑúÏû• users.id
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift',
    "domainUrls"          TEXT,
    "defaultPaymentMethod" TEXT
);

-- 1-2. ÏÇ¨Ïö©Ïûê Î∞è ÏûÑÏßÅÏõê ÎßàÏä§ÌÑ∞ (users)
CREATE TABLE users (
    id                    TEXT PRIMARY KEY,
    "loginId"             TEXT NOT NULL UNIQUE,
    "passwordHash"        TEXT NOT NULL,
    name                  TEXT NOT NULL,
    "departmentId"        TEXT REFERENCES departments(id) ON DELETE SET NULL,
    position              TEXT, -- ÏßÅÍ∏â (ÏÇ¨Ïõê, ÎåÄÎ¶¨, Í≥ºÏû•, Ï∞®Ïû•, Î∂ÄÏû•, Ïù¥ÏÇ¨, ÎåÄÌëúÏù¥ÏÇ¨)
    duty                  TEXT, -- ÏßÅÏ±Ö (ÌååÌä∏Ïû•, ÌåÄÏû•, ÏÑºÌÑ∞Ïû•, Í≥µÏû•Ïû•, Î≥∏Î∂ÄÏû•, Ï¥ùÍ¥Ñ Îì± Îã®ÏúÑÏ°∞ÏßÅ Ï±ÖÏûÑÏûê)
    "managerId"           TEXT REFERENCES users(id) ON DELETE SET NULL, -- ÏßÅÏÜç ÏÉÅÍ∏âÏûê
    role                  TEXT CHECK (role IN ('ADMIN', 'MANAGER', 'USER', 'MECHANIC')) NOT NULL DEFAULT 'USER',
    status                TEXT CHECK (status IN ('ACTIVE', 'LEAVE_OF_ABSENCE', 'RETIRED')) NOT NULL DEFAULT 'ACTIVE',
    department            TEXT, -- Î∂ÄÏÑúÎ™Ö (Î†àÍ±∞Ïãú/ÌëúÏãúÏö©)
    "baseSalary"          DOUBLE PRECISION NOT NULL DEFAULT 0, -- Í∏∞Î≥∏Í∏â (Í∏âÏó¨ Ï†ïÏÇ∞ Í∂åÌïúÏûê Ï†ÑÏö©)
    phone                 TEXT,
    address               TEXT,
  "paidOptions"         TEXT,
  "protection"          TEXT,
  "checkedSpecs"        JSONB,
    "birthDate"           TEXT,
    "joinDate"            TEXT,
    "retireDate"          TEXT,
    "profileImageUrl"     TEXT,
    "customRoleId"        TEXT, -- ÏÇ¨Ïö©Ïûê Ï†ïÏùò Í∂åÌïú Î™ÖÏπ≠ (custom_roles.id)
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 1-3. Î©îÎâ¥Î≥Ñ Í∂åÌïú ÎßàÏä§ÌÑ∞ (permissions)
CREATE TABLE permissions (
    id                    TEXT PRIMARY KEY,
    "userId"              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "menuId"              TEXT NOT NULL,
    role                  TEXT DEFAULT 'USER',
    "canView"             BOOLEAN NOT NULL DEFAULT FALSE,
    "canSave"             BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt"           TEXT,
    "updatedAt"           TEXT,
    UNIQUE("userId", "menuId"),
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 1-3-1. ÏÇ¨Ïö©Ïûê Ï†ïÏùò Í∂åÌïú Î™ÖÏπ≠ ÎßàÏä§ÌÑ∞ (custom_roles)
CREATE TABLE custom_roles (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    description           TEXT,
    "isSystem"            BOOLEAN DEFAULT FALSE,
    "createdAt"           TIMESTAMPTZ DEFAULT now(),
    "updatedAt"           TIMESTAMPTZ DEFAULT now(),
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 1-3-2. Í∂åÌïú Î™ÖÏπ≠Î≥Ñ Î©îÎâ¥ Ï†ëÍ∑º Í∑úÏπô (role_permissions)
CREATE TABLE role_permissions (
    id                    TEXT PRIMARY KEY,
    "roleId"              TEXT NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
    "menuId"              TEXT NOT NULL,
    "canView"             BOOLEAN NOT NULL DEFAULT FALSE,
    "canSave"             BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt"           TIMESTAMPTZ DEFAULT now(),
    "updatedAt"           TIMESTAMPTZ DEFAULT now(),
    UNIQUE("roleId", "menuId"),
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 1-4. Ïó∞Ï∞® ÏÉùÏÑ± ÏøºÌÑ∞ (annual_leave_quotas)
CREATE TABLE annual_leave_quotas (
    id                    TEXT PRIMARY KEY,
    "userId"              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    year                  INTEGER NOT NULL,
    "baseDays"            DOUBLE PRECISION NOT NULL DEFAULT 15,
    "bonusDays"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDays"           DOUBLE PRECISION NOT NULL DEFAULT 15,
    "usedDays"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingDays"       DOUBLE PRECISION NOT NULL DEFAULT 15,
    "periodStart"         TEXT, -- YYYY-MM-DD (Í∞±Ïã† Ï£ºÍ∏∞ ÏãúÏûë)
    "periodEnd"           TEXT, -- YYYY-MM-DD (Í∞±Ïã† Ï£ºÍ∏∞ Ï¢ÖÎ£å)
    "grantedDays"         DOUBLE PRECISION NOT NULL DEFAULT 15, -- Î∂ÄÏó¨ Ïó∞Ï∞® ÏùºÏàò
    memo                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    UNIQUE("userId", year),
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 1-5. Ìú¥Í∞Ä ÏÇ¨Ïö© ÎÇ¥Ïó≠ (leave_usages)
CREATE TABLE leave_usages (
    id                    TEXT PRIMARY KEY,
    "userId"              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "leaveType"           TEXT CHECK ("leaveType" IN ('ANNUAL', 'HALF_AM', 'HALF_PM', 'SPECIAL', 'SICK', 'OFFICIAL', 'UNPAID')) NOT NULL,
    "startDate"           TEXT NOT NULL,
    "endDate"             TEXT NOT NULL,
    "usedDays"            DOUBLE PRECISION NOT NULL,
    reason                TEXT,
    status                TEXT CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')) NOT NULL DEFAULT 'PENDING',
    "approverId"          TEXT REFERENCES users(id) ON DELETE SET NULL,
    "approvedAt"          TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 1-6. Ïó∞Ïû•/Ìú¥Ïùº Í∑ºÎ°ú Í∏∞Î°ù (overtime_records)
CREATE TABLE overtime_records (
    id                    TEXT PRIMARY KEY,
    "userId"              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "workDate"            TEXT NOT NULL,
    "overtimeType"        TEXT CHECK ("overtimeType" IN ('OVERTIME', 'NIGHT', 'HOLIDAY')) NOT NULL,
    "startTime"           TEXT NOT NULL,
    "endTime"             TEXT NOT NULL,
    "hoursWorked"         DOUBLE PRECISION NOT NULL,
    "startDateTime"       TEXT, -- YYYY-MM-DD HH:mm (ÏãúÏûë ÏùºÏãú)
    hours                 DOUBLE PRECISION NOT NULL DEFAULT 0, -- Ïó∞Ïû•Í∑ºÎ°ú ÏãúÍ∞Ñ
    "workDetail"          TEXT, -- Ïó∞Ïû•Í∑ºÎ¨¥ ÎÇ¥Ïö©
    reason                TEXT NOT NULL,
    status                TEXT CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) NOT NULL DEFAULT 'PENDING',
    "approverId"          TEXT REFERENCES users(id) ON DELETE SET NULL,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 1-7. ÏõîÎ≥Ñ Í∏âÏó¨ ÎåÄÏû• (payroll_closings)
CREATE TABLE payroll_closings (
    id                    TEXT PRIMARY KEY,
    "payrollYm"           TEXT NOT NULL, -- YYYY-MM
    month                 TEXT, -- YYYY-MM Î≥ÑÏπ≠
    "approvedAt"          TEXT,
    "approvedBy"          TEXT,
    "userId"              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "baseSalary"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overtimePay"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusPay"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "otherAllowance"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalGross"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "incomeTax"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "residentTax"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nationalPension"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "healthInsurance"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "careInsurance"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "employmentInsurance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDeductions"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    status                TEXT CHECK (status IN ('DRAFT', 'CONFIRMED', 'PAID')) NOT NULL DEFAULT 'DRAFT',
    "paymentDate"         TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    UNIQUE("payrollYm", "userId"),
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);


-- ==============================================================================
-- üè¢ [ÎèÑÎ©îÏù∏ 2] Í∏∞Ï§Ä Ï†ïÎ≥¥ (Master Data - Í±∞ÎûòÏ≤ò, Ï†úÌíà, ÏûêÏÇ∞, Î∂ÄÌíà)
-- ==============================================================================

-- 2-1. Îß§ÏûÖ Í±∞ÎûòÏ≤ò ÎßàÏä§ÌÑ∞ (vendors)
CREATE TABLE vendors (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    type                  TEXT CHECK (type IN ('TRANSPORT', 'RENTAL', 'REPAIR', 'PURCHASE', 'OTHER')) NOT NULL,
    types                 TEXT, -- Îã§Ï§ë ÏóÖÏ¢Ö ÏΩ§Îßà Íµ¨Î∂Ñ
    "bizRegNo"            TEXT,
    representative        TEXT,
    email                 TEXT,
    address               TEXT,
    "bankAccount"         TEXT,
    "bankName"            TEXT,
    "accountNumber"       TEXT,
    "accountHolder"       TEXT,
    "passbookFileUrl"     TEXT,
    "passbookFileName"    TEXT,
    "businessCertFileUrl" TEXT,
    "isActive"            BOOLEAN NOT NULL DEFAULT TRUE,
    memo                  TEXT,
    "firstTradeDate"       TEXT, -- ÏµúÏ¥à Í±∞ÎûòÍ∞úÏãúÏùº (YYYY-MM-DD)
    "lastTradeDate"        TEXT, -- ÏµúÍ∑º Í±∞ÎûòÏùº (YYYY-MM-DD)
    "totalPurchaseAmount"  BIGINT DEFAULT 0, -- ÎàÑÏ†Å Í±∞ÎûòÏï° (Ïõê, Îß§ÏûÖÍ±∞Îûò ÎàÑÍ≥ÑÏï°)
    "taxType"             TEXT,
    "businessStatus"      TEXT DEFAULT 'ACTIVE',
    "closedDate"          TEXT,
    "lastStatusCheckDate" TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 2-2. Í≥†Í∞ùÏÇ¨ ÎßàÏä§ÌÑ∞ (customers)
CREATE TABLE customers (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    "bizRegNo"            TEXT,
    representative        TEXT,
    "repContact"          TEXT,
    "repEmail"            TEXT,
    address               TEXT,
    "bizType"             TEXT, -- ÏóÖÌÉú (Ïòà: Í±¥ÏÑ§ÏóÖ, ÎèÑÏÜåÎß§ÏóÖ)
    "bizItem"             TEXT, -- Ï¢ÖÎ™© (Ïòà: Í≥†ÏÜåÏûëÏóÖÎåÄÏûÑÎåÄ, Í∞ÄÏÑ§Ïû¨)
    "transactionStatus"   TEXT CHECK ("transactionStatus" IN ('ALLOWED', 'BLOCKED')) NOT NULL DEFAULT 'ALLOWED', -- ALLOWED: Ï†ïÏÉÅÍ±∞Îûò, BLOCKED: Ïã†Í∑úÍ≥ÑÏïΩ/Ï∂úÍ≥†Ï†úÌïú
    "defaultBillingDay"   INTEGER DEFAULT 30,
    "defaultStatementClosingDay" INTEGER DEFAULT 25,
    "paymentDueDay"       INTEGER,
    "paymentDueMonthOffset" INTEGER DEFAULT 1,
    "paymentTermDays"     INTEGER,
    "prepaidBalance"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultPaidOptions"  TEXT, -- Í≥†Í∞ùÏÇ¨ Í∏∞Î≥∏ Ïú†ÏÉÅÏòµÏÖò
    "defaultProtection"   TEXT, -- Í≥†Í∞ùÏÇ¨ Í∏∞Î≥∏ Î≥¥ÏñëÏûëÏóÖ
    "defaultCheckedSpecs" JSONB, -- Í≥†Í∞ùÏÇ¨ Í∏∞Î≥∏ ÏöîÍµ¨ÏÇ¨Ïñë Ï≤¥ÌÅ¨ ÏÉÅÌÉú
    "bankAccounts"        JSONB, -- Í≥†Í∞ùÏÇ¨ ÌôòÎ∂à/Í±∞Îûò Í≥ÑÏ¢å Î™©Î°ù
    "driveFolderId"       TEXT,
    "openingDate"         TEXT, -- Í∞úÏóÖÏó∞ÏõîÏùº
    "taxOffice"           TEXT, -- Í¥ÄÌï† ÏÑ∏Î¨¥ÏÑú
    "headOfficeAddress"   TEXT, -- Î≥∏Ï†ê ÏÜåÏû¨ÏßÄ
    "businessCertFileUrl" TEXT, -- ÏÇ¨ÏóÖÏûêÎì±Î°ùÏ¶ù URL
    "passbookFileUrl"     TEXT, -- ÌÜµÏû•ÏÇ¨Î≥∏ URL
    "passbookFileName"    TEXT, -- ÌÜµÏû•ÏÇ¨Î≥∏ ÌååÏùºÎ™Ö
    "taxType"             TEXT, -- Íµ≠ÏÑ∏Ï≤≠ Í≥ºÏÑ∏Ïú†Ìòï
    "taxTypeCd"           TEXT, -- Íµ≠ÏÑ∏Ï≤≠ Í≥ºÏÑ∏Ïú†Ìòï ÏΩîÎìú
    "businessStatus"      TEXT DEFAULT 'ACTIVE', -- ÏÇ¨ÏóÖÏûê ÏÉÅÌÉú
    "closedDate"          TEXT, -- ÌèêÏóÖÏùºÏûê
    "lastStatusCheckDate" TEXT, -- ÏµúÍ∑º Íµ≠ÏÑ∏Ï≤≠ Ï°∞ÌöåÏùºÏãú
    "isClosed"            BOOLEAN NOT NULL DEFAULT FALSE,
    "specialNotes"        TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 2-3. Í≥†Í∞ùÏÇ¨ Îã¥ÎãπÏûê (customer_contacts)
CREATE TABLE customer_contacts (
    id                    TEXT PRIMARY KEY,
    "siteMasterId"        TEXT REFERENCES site_masters(id) ON DELETE CASCADE,
  "customerId"          TEXT REFERENCES customers(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    position              TEXT,
    contact               TEXT,
    email                 TEXT,
    "isPrimary"           BOOLEAN NOT NULL DEFAULT FALSE,
    "isActive"            BOOLEAN NOT NULL DEFAULT TRUE,
    memo                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 2-4. Í≥†Í∞ùÏÇ¨ ÌòÑÏû• (customer_sites)

CREATE TABLE site_masters (
  id                    TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  address               TEXT,
  "isActive"            BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"           TEXT NOT NULL,
  "updatedAt"           TEXT NOT NULL,
  "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

CREATE TABLE customer_sites (
    id                    TEXT PRIMARY KEY,
    "customerId"          TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL,
    address               TEXT,
    "contactName"         TEXT,
    contact               TEXT,
    email                 TEXT,
    "paidOptions"         TEXT, -- ÌòÑÏû•Î≥Ñ Ïú†ÏÉÅÏòµÏÖò
    "protection"          TEXT, -- ÌòÑÏû•Î≥Ñ Î≥¥ÏñëÏûëÏóÖ
    "checkedSpecs"        JSONB, -- ÌòÑÏû•Î≥Ñ ÏöîÍµ¨ÏÇ¨Ïñë Ï≤¥ÌÅ¨ ÏÉÅÌÉú
    "billingDay"          INTEGER,
    "statementClosingDay" INTEGER,
    "paymentDueDay"       INTEGER,
    "paymentDueMonthOffset" INTEGER DEFAULT 1,
    "isActive"            BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);



-- 2-6. Ï†úÌíà Ïπ¥ÌÉàÎ°úÍ∑∏ Î∞è ÌëúÏ§Ä Ï†úÏõê (products)
CREATE TABLE products (
    id                    TEXT PRIMARY KEY,
    "modelName"           TEXT NOT NULL UNIQUE,
    feet                  DOUBLE PRECISION NOT NULL,
    manufacturer          TEXT,
    spec                  TEXT,
    weight                TEXT,
    speed                 TEXT,
    "maxHeightCapacity"   TEXT,
    "powerSource"         TEXT,
    "workingHeight"       TEXT,
    "platformHeight"      TEXT,
    "machineDimensions"   TEXT,
    "platformDimensions"  TEXT,
    "gradeability"        TEXT,
    "capacityPreExt"      TEXT,
    "capacityPostExtMain" TEXT,
    "capacityPostExtDeck" TEXT,
    "maxWindSpeed"        TEXT DEFAULT '12.5 m/s Ïù¥ÎÇ¥',
    "asContact"           TEXT DEFAULT '031-334-5296',
    "safetyCertDate"      TEXT,
    "safetyCertUrl"       TEXT,
    "specSheetUrl"        TEXT,
    "emergencyGuideUrl"   TEXT,
    "isActive"            BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 2-7. ÏûêÏÇ∞ ÎßàÏä§ÌÑ∞ (assets) - ÎÖºÎ¶¨Ï†Å 6Îã®Í≥Ñ ÏôÑÏ†Ñ Ï†ïÎèà
CREATE TABLE assets (
    -- ‚ë† ÏãùÎ≥ÑÏûê
    id                    TEXT PRIMARY KEY,
    "assetNo"             TEXT NOT NULL UNIQUE,
    "vendorAssetNo"       TEXT, -- ÏõêÏÇ¨(ÌÉÄÏÇ¨) Ïã§Î¨º ÏõêÎûò Í¥ÄÎ¶¨Î≤àÌò∏
    "serialNo"            TEXT,

    -- ‚ë° Ïû•ÎπÑ Ï†úÏõê Î∞è ÏÜåÏú† ÏÜçÏÑ±
    "modelName"           TEXT NOT NULL REFERENCES products("modelName") ON UPDATE CASCADE,
    manufacturer          TEXT,
    "manufactureYear"     TEXT,
    "ownerType"           TEXT CHECK ("ownerType" IN ('OWNED', 'RENTED')) NOT NULL,

    -- ‚ë¢ ÏûÑÏ∞® Î∞è Îß§ÏûÖÏ≤ò Ïó∞Îèô
    "vendorId"            TEXT REFERENCES vendors(id) ON DELETE SET NULL,
    supplier              TEXT,

    -- ‚ë£ ÏûÑÏ∞® Í∏∞Í∞Ñ Î∞è ÏõêÍ∞Ä Îã®Í∞Ä
    "rentStart"           TEXT,
    "rentEnd"             TEXT,
    "actualRentReturnDate" TEXT,
    "monthlyRentFee"      DOUBLE PRECISION DEFAULT 0,
    "dailyRentFee"        DOUBLE PRECISION DEFAULT 0,
    "maintenanceScore"    INTEGER NOT NULL DEFAULT 0, -- Ï†ïÎπÑÏ†êÏàò (0~10)
    "billingDay"          INTEGER, -- Ï≤≠Íµ¨ ÎßàÍ∞êÏùº
    "monthlyRentalFee"    DOUBLE PRECISION, -- ÏïΩÏ†ï Ïõî ÎåÄÏó¨Î£å
    "dailyRentalFee"      DOUBLE PRECISION, -- ÏïΩÏ†ï Ïùº ÎåÄÏó¨Î£å
    renter                TEXT, -- ÏûÑÏ∞®Ï≤ò (ÌÉÄÏÇ¨ Ï†ÑÎåÄ Ïãú)
    "disposalDate"        TEXT, -- Îß§Í∞ÅÏùºÏûê
    "disposalPrice"       DOUBLE PRECISION, -- Îß§Í∞ÅÍ∏àÏï°
    buyer                 TEXT, -- Îß§Í∞ÅÏ≤ò
    memo1                 TEXT, -- ÏÉÅÏÑ∏ ÎπÑÍ≥† 1
    memo2                 TEXT, -- ÏÉÅÏÑ∏ ÎπÑÍ≥† 2
    "safetyInspectionUrl" TEXT, -- ÏïàÏ†ÑÍ≤ÄÏÇ¨Ï¶ù URL
    "preDeliveryChecklistUrl" TEXT, -- Ï∂úÍ≥†Ï†ÑÏ†êÍ≤ÄÌëú URL
    "fullDefectSummary"   TEXT, -- Ï†ÑÏàò Í≤∞Ìï® ÏöîÏïΩ

    -- ‚ë§ ÌòÑÏû¨ Í∞ÄÎèô ÌòÑÏû• Î∞è Í≥ÑÏïΩ ÏÜçÏÑ± (Ïã§ÏãúÍ∞Ñ ÎùºÏù¥ÌîÑÏÇ¨Ïù¥ÌÅ¥)
    "currentCustomerId"   TEXT REFERENCES customers(id) ON DELETE SET NULL,
    "currentSiteId"       TEXT REFERENCES customer_sites(id) ON DELETE SET NULL,
    "contractStart"       TEXT,
    "contractEnd"         TEXT,

    -- ‚ë• ÏûêÏÇ∞ ÌöåÍ≥Ñ Î∞è ÏÜêÏùµ ÏõêÏû•
    "acquisitionDate"     TEXT,
    "acquisitionPrice"    DOUBLE PRECISION DEFAULT 0,
    "depreciationMonths"  INTEGER DEFAULT 60,
    "residualValueRate"   DOUBLE PRECISION DEFAULT 0,
    "accumDepreciation"   DOUBLE PRECISION DEFAULT 0,
    "bookValue"           DOUBLE PRECISION DEFAULT 0,
    "cumRentalFee"        DOUBLE PRECISION DEFAULT 0,
    "cumRepairCost"       DOUBLE PRECISION DEFAULT 0,

    -- ‚ë¶ ÏóÖÎ¨¥ ÏÉÅÌÉú Î∞è Í∞êÏÇ¨
    status                TEXT CHECK (status IN ('AVAILABLE', 'ASSIGNED', 'RENTED', 'REPAIRING', 'RENTED_RETURNED', 'SOLD')) NOT NULL DEFAULT 'AVAILABLE',
    memo                  TEXT,
    note                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 2-8. ÏÜåÎ™®Ìíà/Î∂ÄÌíà Ïπ¥ÌÉàÎ°úÍ∑∏ (consumables)
CREATE TABLE consumables (
    id                    TEXT PRIMARY KEY,
    "modelName"           TEXT NOT NULL UNIQUE,
    unit                  TEXT NOT NULL,
    "unitPrice"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stockQty"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    category              TEXT,
    note                  TEXT,
    "repairingQty"        DOUBLE PRECISION DEFAULT 0,
    supplier              TEXT, -- Íµ¨ÏûÖÏ≤ò/Í≥µÍ∏âÏóÖÏ≤¥
    "vendorId"            TEXT REFERENCES vendors(id) ON DELETE SET NULL,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 2-8-1. ÏÜåÎ™®Ìíà Íµ¨Îß§ ÏöîÏ≤≠ Î∞è ÏûÖÍ≥† Í¥ÄÎ¶¨ (consumable_purchases)
CREATE TABLE consumable_purchases (
    id                    TEXT PRIMARY KEY,
    "consumableId"        TEXT REFERENCES consumables(id) ON DELETE SET NULL,
    "modelName"           TEXT NOT NULL,
    "requestedQty"        INTEGER NOT NULL DEFAULT 1,
    "unitPrice"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellerName"          TEXT NOT NULL,
    status                TEXT CHECK (status IN ('REQUESTED', 'ACCEPTED', 'COMPLETED', 'CANCELLED')) NOT NULL DEFAULT 'REQUESTED',
    "requesterId"         TEXT NOT NULL,
    "requesterName"       TEXT NOT NULL,
    "accepterId"          TEXT,
    "accepterName"        TEXT,
    "inbounderName"       TEXT,
    "receivedQty"         INTEGER NOT NULL DEFAULT 0,
    "statementFileUrl"    TEXT,
    "requestDate"         TEXT NOT NULL,
    "acceptedDate"        TEXT,
    "completedDate"       TEXT,
    "actualReturnDate"    TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 2-9. Ï†ïÎπÑÏÇ¨ Ï∞®ÎüâÎ≥Ñ Ï†ÅÏû¨ Î∂ÄÌíà Ïû¨Í≥† (mechanic_consumable_stocks)
CREATE TABLE mechanic_consumable_stocks (
    id                    TEXT PRIMARY KEY,
    "mechanicId"          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "consumableId"        TEXT NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    "stockQty"            DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt"           TEXT,
    "updatedAt"           TEXT NOT NULL,
    UNIQUE("mechanicId", "consumableId"),
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 2-10. Ïö¥ÏÜ° Í±∞ÎûòÏ≤ò (transport_companies)
CREATE TABLE transport_companies (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    "businessNo"          TEXT,
    contact               TEXT,
    "bankName"            TEXT,
    "bankAccount"         TEXT,
    "bankHolder"          TEXT,
    memo                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 2-11. Ïö¥ÏÜ° Í∏∞ÏÇ¨ (transport_drivers)
CREATE TABLE transport_drivers (
    id                    TEXT PRIMARY KEY,
    "companyId"           TEXT REFERENCES transport_companies(id) ON DELETE SET NULL,
    "driverName"          TEXT NOT NULL,
    "driverContact"       TEXT,
    "vehicleNo"           TEXT,
    "vehicleType"         TEXT,
    "vehicleColor"        TEXT,
    "birthDate"           TEXT,
    "idNo"                TEXT,
    address               TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);


-- ==============================================================================
-- üìú [ÎèÑÎ©îÏù∏ 3] Í≥ÑÏïΩ, Î∞∞Ï∞® Î∞è Ï∂úÍ≥†/ÏûÖÍ≥† (Operations)
-- ==============================================================================

-- 3-1. ÏûÑÎåÄ Í≥ÑÏïΩ ÎßàÏä§ÌÑ∞ (contracts)
CREATE TABLE contracts (
    id                    TEXT PRIMARY KEY,
    "contractNo"          TEXT NOT NULL UNIQUE,
    "contractType"        TEXT CHECK ("contractType" IN ('RENTAL', 'SALE')) NOT NULL DEFAULT 'RENTAL',
    "customerId"          TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    "salespersonId"       TEXT REFERENCES users(id) ON DELETE SET NULL,
    "contactId"           TEXT REFERENCES customer_contacts(id) ON DELETE SET NULL,
    "siteId"              TEXT REFERENCES customer_sites(id) ON DELETE SET NULL,
    "startDate"           TEXT NOT NULL,
    "endDate"             TEXT NOT NULL,
    "billingDay"          INTEGER NOT NULL DEFAULT 30,
    "statementClosingDay" INTEGER, -- Í±∞ÎûòÎ™ÖÏÑ∏ÏÑú ÎßàÍ∞êÏùº
    "customerName"        TEXT,
    "salespersonName"     TEXT,
    "paymentDueDay"       INTEGER,
    "paymentDueMonthOffset" INTEGER DEFAULT 1,
    "lateInterestRate"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    status                TEXT CHECK (status IN ('ACTIVE', 'EXTENDED', 'SHORTENED', 'SUCCEEDED', 'COMPLETED')) NOT NULL DEFAULT 'ACTIVE',
    "predecessorContractId" TEXT REFERENCES contracts(id) ON DELETE SET NULL,
    "predecessorContractNo" TEXT,
    "predecessorCustomerId" TEXT REFERENCES customers(id) ON DELETE SET NULL,
    "predecessorCustomerName" TEXT,
    "successorContractId" TEXT REFERENCES contracts(id) ON DELETE SET NULL,
    "driveFolderId"       TEXT,
    "lastBillingDate"     TEXT,
    "lastBilledPeriodStart" TEXT,
    "lastBilledPeriodEnd" TEXT,
    "lastBilledYm"        TEXT,
    "billingCount"        INTEGER NOT NULL DEFAULT 0,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 3-2. Ï≤¥Í≤∞ ÏûêÏÇ∞ Î™©Î°ù (contract_assets)
CREATE TABLE contract_assets (
    id                    TEXT PRIMARY KEY,
    "contractId"          TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    "assetId"             TEXT REFERENCES assets(id) ON DELETE SET NULL,
    "expectedModel"       TEXT,
    "monthlyRentalFee"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyRentalFee"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salePrice"           DOUBLE PRECISION DEFAULT 0,
    "startDate"           TEXT NOT NULL,
    "endDate"             TEXT NOT NULL,
    status                TEXT DEFAULT 'ASSIGNED',
    "contractStart"       TEXT,
    "contractEnd"         TEXT,
    "currentCustomerId"   TEXT,
    "currentSiteId"       TEXT,
  "predecessorContractId" TEXT REFERENCES contracts(id) ON DELETE SET NULL,
  "predecessorContractAssetId" TEXT,
  "inRegisteredAt"      TEXT,
    "actualReturnDate"    TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 3-2-1. Ï†ÑÎåÄ/Ïô∏Î∂Ä ÏûÑÏ∞® Ïû•ÎπÑ Í≥ÑÏïΩ ÎåÄÏû• (external_leases)
CREATE TABLE external_leases (
    id                    TEXT PRIMARY KEY,
    "vendorId"            TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    "contractId"          TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    "contractAssetId"     TEXT REFERENCES contract_assets(id) ON DELETE SET NULL,
    "assetDescription"    TEXT NOT NULL,
    "monthlyRentFee"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyRentFee"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leaseStartDate"      TEXT NOT NULL,
    "leaseEndDate"        TEXT,
    status                TEXT CHECK (status IN ('ACTIVE', 'RETURNED')) NOT NULL DEFAULT 'ACTIVE',
    "statementFileUrl"    TEXT,
    memo                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    contract_id           TEXT,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 3-3. Í≥ÑÏïΩ Î≥ÄÍ≤Ω Ïù¥Î†• Î∞è ÌÉÄÏûÑÎùºÏù∏ (contract_history)
CREATE TABLE contract_history (
    id                    TEXT PRIMARY KEY,
    "contractId"          TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    "changeType"          TEXT CHECK ("changeType" IN ('REGISTER', 'EXTEND', 'SHORTEN', 'SUCCEED', 'TERMINATE', 'EXCHANGE', 'FEE_CHANGE', 'AS_SERVICE', 'BILLING_CREATED', 'BILLING_SENT', 'BILLING_CANCELLED', 'BILLING_REGENERATED', 'PAYMENT_RECEIVED', 'PAYMENT_CANCELLED', 'DOCUMENT_SENT', 'ASSET_SOLD')) NOT NULL,
    "prevEndDate"         TEXT,
    "newEndDate"          TEXT,
    description           TEXT,
    "changeDate"          TEXT NOT NULL,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 3-4. Î∞∞Ï∞® Î∞è ÌôîÎ¨º Ïö¥ÏÜ° ÎåÄÏû• (deliveries) - ÎÖºÎ¶¨Ï†Å 6Îã®Í≥Ñ ÏôÑÏ†Ñ Ï†ïÎèà
CREATE TABLE deliveries (
    -- ‚ë† ÏãùÎ≥Ñ Î∞è Í≥ÑÏïΩ
    id                    TEXT PRIMARY KEY,
    "contractId"          TEXT REFERENCES contracts(id) ON DELETE SET NULL,
    "assetIds"            TEXT,
    type                  TEXT CHECK (type IN ('OUTBOUND', 'INBOUND', 'EXCHANGE', 'MOVEMENT', 'RETURN')) NOT NULL,
    "dispatchCategory"    TEXT CHECK ("dispatchCategory" IN ('Ï∂úÍ≥†', 'ÏûÖÍ≥†', 'Î∞òÎÇ©', 'Ï†ïÎπÑ', 'Ïù¥Îèô', 'ÍµêÌôò')) DEFAULT 'Ï∂úÍ≥†',

    -- ‚ë° Ïö¥ÏÜ°ÏÇ¨ Î∞è Î∞∞Ï†ï Í∏∞ÏÇ¨
    "transportVendorId"   TEXT REFERENCES vendors(id) ON DELETE SET NULL,
    "transportCompany"    TEXT,
    "driverName"          TEXT,
    "driverContact"       TEXT,
    "vehicleNo"           TEXT,
    "vehicleType"         TEXT,
    "assignedVehicles"    JSONB DEFAULT '[]'::jsonb,

    -- ‚ë¢ ÏÉÅÏ∞®ÏßÄ (Ï∂úÎ∞ú)
    "pickupType"          TEXT CHECK ("pickupType" IN ('HQ_YARD', 'VENDOR_YARD', 'CUSTOMER_SITE', 'YARD', 'VENDOR')) DEFAULT 'HQ_YARD',
    "pickupVendorName"    TEXT,
    "originAddress"       TEXT,
    "loadingDate"         TEXT,
    "loadingTimeSlot"     TEXT DEFAULT 'Ïò§Ï†Ñ',
    "loadingTime"         TEXT,

    -- ‚ë£ ÌïòÏ∞®ÏßÄ (Í≤ΩÏú† Î∞è ÎèÑÏ∞©)
    "dropoffType"         TEXT CHECK ("dropoffType" IN ('SINGLE', 'MULTI_STOP')) DEFAULT 'SINGLE',
    "viaDropoffName"      TEXT,
    "viaDropoffAddress"   TEXT,
    "destinationAddress"  TEXT,
    "unloadingDate"       TEXT,
    "unloadingTimeSlot"   TEXT DEFAULT 'Ïò§Ï†Ñ',
    "unloadingTime"       TEXT,

    -- ‚ë§ Ïö¥ÏÜ°ÎπÑ Î∞è Ï†ïÏÇ∞
    "expectedCost"        DOUBLE PRECISION DEFAULT 0,
    "deliveryCost"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalCost"           DOUBLE PRECISION DEFAULT 0,
    "deliveryCostConfirmed" DOUBLE PRECISION DEFAULT 0,
    "costAdjustmentReason" TEXT,
    "reconciliationStatus" TEXT CHECK ("reconciliationStatus" IN ('PENDING', 'MATCHED', 'MISMATCH', 'RECONCILED', 'PAYMENT_REQUESTED', 'PAID')) NOT NULL DEFAULT 'PENDING',
    "reconciledAt"        TEXT,
    "paymentRequestedAt"  TEXT,
    "paymentCompletedAt"  TEXT,
    "statementFileUrl"    TEXT,
    "billableToCustomer"  BOOLEAN NOT NULL DEFAULT FALSE,
    "billableCustomerId"  TEXT,
    "billableAmount"      DOUBLE PRECISION DEFAULT 0,
    "billingId"           TEXT,
    "isWaived"            BOOLEAN NOT NULL DEFAULT FALSE,
    "waivedAmount"        DOUBLE PRECISION DEFAULT 0,
    "waivedBy"            TEXT,
    "waivedReason"        TEXT,
    "waivedAt"            TEXT,
    "vehicleRequirements" TEXT,
    "cargoItems"          TEXT,
    vehicles              TEXT,
    "scheduledDate"       TEXT,
    "purchaseBillId"      TEXT,
    "isCostSettled"       BOOLEAN DEFAULT FALSE,

    -- ‚ë• ÏÉÅÌÉú Î∞è ÏóÖÎ¨¥ Í∞êÏÇ¨
    status                TEXT CHECK (status IN ('PENDING', 'REQUESTED', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED')) NOT NULL DEFAULT 'PENDING',
    "requestDate"         TEXT NOT NULL,
    "rawText"             TEXT,
    memo                  TEXT,
    "closingMemo"         TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 3-5. Ï∂úÍ≥† Í≤ÄÏàò ÏäπÏù∏ ÎåÄÏû• (outbound_inspections)
CREATE TABLE outbound_inspections (
    id                    TEXT PRIMARY KEY,
    "contractId"          TEXT REFERENCES contracts(id) ON DELETE SET NULL,
    "contractAssetId"     TEXT REFERENCES contract_assets(id) ON DELETE SET NULL,
    "assetId"             TEXT REFERENCES assets(id) ON DELETE SET NULL,
    status                TEXT CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')) NOT NULL DEFAULT 'PENDING',
    "specsJson"           TEXT,
    "deliveryId"          TEXT REFERENCES deliveries(id) ON DELETE SET NULL,
    "inspectorId"         TEXT REFERENCES users(id) ON DELETE SET NULL,
    "inspectedAt"         TEXT,
    "approvedAt"          TEXT,
    "rejectReason"        TEXT,
    "repairId"            TEXT,
    note                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

CREATE INDEX IF NOT EXISTS idx_outbound_inspections_contract_id ON outbound_inspections("contractId");
CREATE INDEX IF NOT EXISTS idx_outbound_inspections_asset_id ON outbound_inspections("assetId");
CREATE INDEX IF NOT EXISTS idx_outbound_inspections_status ON outbound_inspections(status);
CREATE INDEX IF NOT EXISTS idx_outbound_inspections_delivery_id ON outbound_inspections("deliveryId");



-- 3-7. ÏûêÏÇ∞ ÏûÖÏ∂úÍ≥†/Ï†ïÎπÑ Ïù¥Î†• (asset_in_out_logs)
CREATE TABLE asset_inout_logs (
    id                    TEXT PRIMARY KEY,
    "assetId"             TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    "assetNo"             TEXT NOT NULL,
    "modelName"           TEXT NOT NULL,
    type                  TEXT NOT NULL, -- ACQUISITION, OUTBOUND, INBOUND, INBOUND_CANCEL, REPAIR, DISPOSAL, EXCHANGE_OUT, EXCHANGE_IN
    "inboundNo"           TEXT,
    "customerId"          TEXT REFERENCES customers(id) ON DELETE SET NULL,
    "customerName"        TEXT,
    "siteId"              TEXT REFERENCES customer_sites(id) ON DELETE SET NULL,
    "siteName"            TEXT,
    "deliveryId"          TEXT REFERENCES deliveries(id) ON DELETE SET NULL,
    "repairId"            TEXT,
    "maintenanceScore"    INTEGER DEFAULT 0,
    "defectsJson"         TEXT,
    "eventDate"           TEXT NOT NULL,
    memo                  TEXT,
    note                  TEXT,
    date                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- ÌïòÏúÑ Ìò∏ÌôòÏÑ± Î∑∞
CREATE OR REPLACE VIEW asset_in_out_logs AS SELECT * FROM asset_inout_logs;


-- ==============================================================================
-- üîß [ÎèÑÎ©îÏù∏ 4] Ï†ïÎπÑ Î∞è ÌòÑÏû• AS (Repairs & Field Services)
-- ==============================================================================

-- 4-0. Ï†ïÎπÑ Ï†êÍ≤Ä Ìï≠Î™© ÎßàÏä§ÌÑ∞ (inspection_checklist_items)
CREATE TABLE inspection_checklist_items (
    id                    TEXT PRIMARY KEY,
    code                  TEXT NOT NULL UNIQUE,
    name                  TEXT NOT NULL,
    category              TEXT NOT NULL,
    score                 INTEGER NOT NULL DEFAULT 5,
    "standardManHours"    DOUBLE PRECISION DEFAULT 0.5,
    "recommendedConsumableIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actionGuide"         TEXT,
    description           TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT
);

CREATE INDEX IF NOT EXISTS idx_inspection_checklist_items_code ON inspection_checklist_items(code);
CREATE INDEX IF NOT EXISTS idx_inspection_checklist_items_category ON inspection_checklist_items(category);

-- 4-1. Ï†ïÎπÑ Î∞è ÌòÑÏû• AS ÎåÄÏû• (repairs) - Îã®Ïùº Î¨ºÎ¶¨ ÌÜµÌï© ÎßàÏä§ÌÑ∞
CREATE TABLE repairs (
    -- ‚ë† ÏãùÎ≥Ñ Î∞è Î∂ÑÎ•ò
    id                    TEXT PRIMARY KEY,
    "ticketNo"            TEXT,
    "workCategory"        TEXT DEFAULT 'FIELD_AS', -- FIELD_AS, INSHOP_MAINTENANCE, PERIODIC_CHECK
    "workLocation"        TEXT DEFAULT 'SITE',
    "stockSource"         TEXT DEFAULT 'VEHICLE_VAN',
    source                TEXT DEFAULT 'DIRECT_INTAKE',
    "repairType"          TEXT NOT NULL DEFAULT 'INTERNAL',
    "maintenanceType"     TEXT,
    priority              TEXT DEFAULT 'NORMAL',

    -- ‚ë° ÎåÄÏÉÅ ÏûêÏÇ∞ & ÌòÑÏû•
    "assetId"             TEXT REFERENCES assets(id) ON DELETE SET NULL,
    "assetNo"             TEXT,
    "modelName"           TEXT,
    "contractId"          TEXT REFERENCES contracts(id) ON DELETE SET NULL,
    "targetContractStatus" TEXT,
    "targetAssetStatus"   TEXT,
    "customerId"          TEXT REFERENCES customers(id) ON DELETE SET NULL,
    "customerName"        TEXT,
    "siteId"              TEXT REFERENCES customer_sites(id) ON DELETE SET NULL,
    "siteName"            TEXT,
    "siteAddress"         TEXT,
    "locationDetail"      TEXT,

    -- ‚ë¢ Ï†ëÏàòÏûê & Í≥†Ïû• ÎÇ¥Ïö©
    "reporterName"        TEXT,
    "reporterContact"     TEXT,
    "issueCategory"       TEXT,
    "inspectionItemCode"  TEXT,
    "inspectionItemId"    TEXT REFERENCES inspection_checklist_items(id) ON DELETE SET NULL,
    "degradationScore"    INTEGER NOT NULL DEFAULT 0,
    "issueDescription"    TEXT,
    details               TEXT,
    "errorCode"           TEXT,

    -- ‚ë£ Î∞∞Ï†ï Ï†ïÎπÑÏÇ¨ & Ïô∏Ï£º Í±∞ÎûòÏ≤ò
    "mechanicId"          TEXT REFERENCES users(id) ON DELETE SET NULL,
    "assignedMechanicId"  TEXT,
    "mechanicName"        TEXT,
    "vendorId"            TEXT REFERENCES vendors(id) ON DELETE SET NULL,
    "preferredNavApp"     TEXT DEFAULT 'TMAP',

    -- ‚ë§ ÏùºÏ†ï
    "requestDate"         TEXT NOT NULL,
    "scheduleDate"        TEXT,
    "visitDate"           TEXT,
    "repairDate"          TEXT,
    "completedDate"       TEXT,
    "outboundDate"        TEXT,

    -- ‚ë• Ï°∞Ïπò Í≤∞Í≥º & Î∂ÄÌíà
    status                TEXT NOT NULL DEFAULT 'REQUESTED',
    "resolutionType"      TEXT,
    "unresolvedReason"    TEXT,
    "nextAction"          TEXT,
    "actionTaken"         TEXT,
    "partsUsed"           JSONB DEFAULT '[]'::jsonb,
    "collectedParts"      JSONB DEFAULT '[]'::jsonb,
    consumables           JSONB DEFAULT '[]'::jsonb,
    "timelineLogs"        JSONB DEFAULT '[]'::jsonb,
    "timelineEvents"      JSONB DEFAULT '[]'::jsonb,
    "resolvedSiteAddress" TEXT,

    -- ‚ë¶ Ïú†ÏÉÅ Ï≤≠Íµ¨ Î∞è ÏõêÍ∞Ä
    "billableType"        TEXT DEFAULT 'FREE',
    "billableAmount"      DOUBLE PRECISION DEFAULT 0,
    "billableToCustomer"  BOOLEAN NOT NULL DEFAULT FALSE,
    "totalCost"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costTotal"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingAmount"       DOUBLE PRECISION,
    "laborHours"          DOUBLE PRECISION,
    "isCustomerFault"     BOOLEAN NOT NULL DEFAULT FALSE,
    "isWaived"            BOOLEAN NOT NULL DEFAULT FALSE,
    "waivedAmount"        DOUBLE PRECISION DEFAULT 0,
    "waivedBy"            TEXT,
    "waivedReason"        TEXT,
    "waivedAt"            TEXT,

    -- ‚ëß Ï¶ùÎπô ÏÇ¨ÏßÑ Î∞è ÏÑúÎ™Ö
    "faultImageUrl"       TEXT,
    "evidenceImages"      TEXT[],
    "beforeImage"         TEXT,
    "afterImage"          TEXT,
    "estimateFileUrl"     TEXT,
    "customerSignature"   TEXT,
    "customerConfirmName" TEXT,

    -- ‚ë® Ïû¨Î∞©Î¨∏ Î∞è ÎåÄÏ∞® Ïó∞Í≥Ñ
    "parentRepairId"      TEXT,
    "parentTicketId"      TEXT,
    "revisitRepairId"     TEXT,
    "revisitTicketId"     TEXT,
    "revisitDate"         TEXT,
    "revisitReason"       TEXT,
    "exchangeSuggested"   BOOLEAN DEFAULT FALSE,
    "inboundNo"           TEXT,
    "defectsJson"         TEXT,
    "billingId"           TEXT,
    "purchaseBillId"      TEXT,

    -- ‚ë© ÎπÑÍ≥† Î∞è Í∞êÏÇ¨
    memo                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

ALTER TABLE outbound_inspections ADD CONSTRAINT fk_outbound_inspections_repair FOREIGN KEY ("repairId") REFERENCES repairs(id) ON DELETE SET NULL;



-- 4-3. ÏàòÎ¶¨ Ìà¨ÏûÖ ÏûêÏû¨ (repair_consumables)
CREATE TABLE repair_consumables (
    id                    TEXT PRIMARY KEY,
    "repairId"            TEXT NOT NULL REFERENCES repairs(id) ON DELETE CASCADE,
    "consumableId"        TEXT NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    quantity              DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    cost                  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 4-4. ÏÜåÎ™®Ìíà ÏàòÎ∂à Î°úÍ∑∏ (consumable_logs)
CREATE TABLE consumable_logs (
    id                    TEXT PRIMARY KEY,
    "consumableId"        TEXT NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    type                  TEXT CHECK (type IN ('INBOUND', 'OUTBOUND', 'ADJUST', 'TRANSFER_TO_VEHICLE', 'RETURN_TO_HQ')) NOT NULL,
    quantity              DOUBLE PRECISION NOT NULL,
    "unitPrice"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    supplier              TEXT,
    "vendorId"            TEXT REFERENCES vendors(id) ON DELETE SET NULL,
    "userId"              TEXT REFERENCES users(id) ON DELETE SET NULL,
    "mechanicId"          TEXT REFERENCES users(id) ON DELETE SET NULL,
    "fromLocation"        TEXT,
    "toLocation"          TEXT,
    "targetAssetId"       TEXT REFERENCES assets(id) ON DELETE SET NULL,
    "evidenceFileUrl"     TEXT,
    description           TEXT,
    "actionDate"          TEXT NOT NULL,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 4-5. Í≤ÄÏàò Ï≤¥ÌÅ¨Î¶¨Ïä§Ìä∏ Ìï≠Î™© (inspection_checklist_items)


-- 4-8. Ï†ÑÏÇ¨ ÌëúÏ§Ä ÏòµÏÖò ÎßàÏä§ÌÑ∞ (standard_options)
CREATE TABLE IF NOT EXISTS standard_options (
    id                    TEXT PRIMARY KEY,
    category              TEXT NOT NULL CHECK (category IN ('PAID', 'PROTECTION', 'SPEC')),
    name                  TEXT NOT NULL,
    "defaultPrice"        DOUBLE PRECISION DEFAULT 0,
    unit                  TEXT DEFAULT 'Ïõî',
    description           TEXT,
    "isActive"            BOOLEAN NOT NULL DEFAULT TRUE,
    "sortOrder"           INTEGER DEFAULT 0,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);


-- ==============================================================================
-- üí∞ [ÎèÑÎ©îÏù∏ 5] ÌöåÍ≥Ñ, Ï≤≠Íµ¨, Îß§ÏûÖÏ†ïÏÇ∞ Î∞è Í∏àÏúµ (Accounting, Billing & Finance)
-- ==============================================================================

-- 5-1. Îß§Ï∂ú Ï≤≠Íµ¨ ÎßàÏä§ÌÑ∞ (billings) - Í≥†Í∞ù ÎåÄÏÉÅ
CREATE TABLE billings (
    id                    TEXT PRIMARY KEY,
    "billingType"         TEXT CHECK ("billingType" IN ('RENTAL', 'REPAIR', 'TRANSPORT', 'ASSET_SALE')) NOT NULL DEFAULT 'RENTAL',
    "billingYm"           TEXT NOT NULL, -- YYYY-MM
    "customerId"          TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    "contractId"          TEXT REFERENCES contracts(id) ON DELETE SET NULL,
    "invoiceId"           TEXT,
    "billingDate"         TEXT NOT NULL,
    "totalAmount"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    status                TEXT CHECK (status IN ('UNPAID', 'PARTIAL', 'PAID', 'REQUESTED', 'REJECTED')) NOT NULL DEFAULT 'UNPAID',
    "rejectReason"        TEXT,
    details               JSONB,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-2. Îß§Ï∂ú Ï≤≠Íµ¨ ÏÉÅÏÑ∏ (billing_details)
CREATE TABLE billing_details (
    id                    TEXT PRIMARY KEY,
    "billingId"           TEXT NOT NULL REFERENCES billings(id) ON DELETE CASCADE,
    "contractAssetId"     TEXT REFERENCES contract_assets(id) ON DELETE SET NULL,
    "assetId"             TEXT REFERENCES assets(id) ON DELETE SET NULL,
    "receivableId"        TEXT, -- Ïô∏ÏÉÅÎØ∏ÏàòÍ∏à Ïó∞Îèô
    "itemName"            TEXT NOT NULL,
    "displayName"         TEXT,
    "internalDescription" TEXT,
    quantity              DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    amount                DOUBLE PRECISION NOT NULL DEFAULT 0,
    description           TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-3. ÌÜµÌï© Ï≤≠Íµ¨ Ïù∏Î≥¥Ïù¥Ïä§ ÎßàÏä§ÌÑ∞ (billing_invoices)
CREATE TABLE billing_invoices (
    id                    TEXT PRIMARY KEY,
    "customId"            TEXT,
    "customerId"          TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    "billingYm"           TEXT NOT NULL, -- YYYY-MM
    "siteId"              TEXT REFERENCES customer_sites(id) ON DELETE SET NULL,
    "totalAmount"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vatAmount"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    status                TEXT CHECK (status IN ('DRAFT', 'ISSUED', 'PAID', 'PARTIAL', 'CANCELLED')) NOT NULL DEFAULT 'DRAFT',
    "dueDate"             TEXT,
    "issuedAt"            TEXT,
    memo                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

ALTER TABLE billings ADD CONSTRAINT fk_billings_invoice FOREIGN KEY ("invoiceId") REFERENCES billing_invoices(id) ON DELETE SET NULL;

-- 5-4. Ïô∏ÏÉÅÎØ∏ÏàòÍ∏à ÎåÄÏû• (receivables) - ÌÉÄÏÇ¨ Íµ¨ÏÉÅÏ±ÑÍ∂å(VENDOR_CLAIM) ÌÜµÌï©
CREATE TABLE receivables (
    id                    TEXT PRIMARY KEY,
    "contractId"          TEXT REFERENCES contracts(id) ON DELETE SET NULL,
    "customerId"          TEXT REFERENCES customers(id) ON DELETE SET NULL,
    "vendorName"          TEXT, -- ÌÉÄÏÇ¨ Íµ¨ÏÉÅÏ≤ò ÏõêÏÇ¨Î™Ö
    "assetNo"             TEXT, -- Íµ¨ÏÉÅ ÏõêÏù∏ ÎåÄÏÉÅ Ïû•ÎπÑÎ≤àÌò∏
    type                  TEXT CHECK (type IN ('TRANSPORT', 'REPAIR', 'CLEANING', 'OTHER', 'VENDOR_CLAIM')) NOT NULL,
    "occurredDate"        TEXT NOT NULL,
    "internalDescription" TEXT NOT NULL,
    "displayName"         TEXT,
    "totalAmount"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billedAmount"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    status                TEXT CHECK (status IN ('PENDING', 'PARTIAL', 'CLEARED')) NOT NULL DEFAULT 'PENDING',
    "repairId"            TEXT REFERENCES repairs(id) ON DELETE SET NULL,
    CONSTRAINT chk_billed_lte_total CHECK ("billedAmount" <= "totalAmount"),
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-5. Îß§Ï∂ú ÏàòÎÇ© ÌÖåÏù¥Î∏î (payments)
CREATE TABLE payments (
    id                    TEXT PRIMARY KEY,
    "billingId"           TEXT NOT NULL REFERENCES billings(id) ON DELETE CASCADE,
    "paymentDate"         TEXT NOT NULL,
    amount                DOUBLE PRECISION NOT NULL,
    method                TEXT NOT NULL,
    memo                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-6. ÏùÄÌñâ ÏûÖÏ∂úÍ∏à Í±∞Îûò ÎÇ¥Ïó≠ (bank_transactions)
CREATE TABLE bank_transactions (
    id                    TEXT PRIMARY KEY,
    "bankName"            TEXT,
    "accountNumber"       TEXT,
    "transactionDate"     TEXT NOT NULL,
    summary               TEXT,
    counterparty          TEXT,
    "senderName"          TEXT NOT NULL,
    "senderAccount"       TEXT,
    "depositAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "withdrawAmount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    balance               DOUBLE PRECISION,
    "branchName"          TEXT,
    "customerId"          TEXT REFERENCES customers(id) ON DELETE SET NULL,
    "matchedBillingId"    TEXT REFERENCES billings(id) ON DELETE SET NULL,
    "matchingType"        TEXT CHECK ("matchingType" IN ('AUTO', 'MANUAL')),
    "isDeposit"           BOOLEAN NOT NULL DEFAULT TRUE,
    memo                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-7. ÏàòÎÇ©-ÌÜµÏû•ÏûÖÍ∏à N:N Îß§Ìïë ÎßÅÌÅ¨ (payment_deposit_links)
CREATE TABLE payment_deposit_links (
    id                    TEXT PRIMARY KEY,
    "paymentId"           TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    "bankTransactionId"   TEXT NOT NULL REFERENCES bank_transactions(id) ON DELETE CASCADE,
    "usedAmount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-8. ÌÜµÏû• ÎåÄÏÇ¨ Î£∞ Îß§Ìïë (bank_matching_rules)
CREATE TABLE bank_matching_rules (
    id                    TEXT PRIMARY KEY,
    "senderName"          TEXT NOT NULL UNIQUE,
    "customerId"          TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-9. ÌÜµÏû• Í∏∞Ï¥à ÏûîÏï° (bank_account_initial_balances)
CREATE TABLE bank_initial_balances (
    id                    TEXT PRIMARY KEY,
    "bankName"            TEXT NOT NULL,
    "accountNumber"       TEXT,
    "initialBalance"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "asOfDate"            TEXT,
    "createdAt"           TEXT,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- ÌïòÏúÑ Ìò∏ÌôòÏÑ± Î∑∞
CREATE OR REPLACE VIEW bank_account_initial_balances AS SELECT * FROM bank_initial_balances;

-- 5-10. ÏõîÎßê Îß§ÏûÖ Ï†ïÏÇ∞ ÎßàÏä§ÌÑ∞ (purchase_settlements)
CREATE TABLE purchase_settlements (
    id                    TEXT PRIMARY KEY,
    "settlementYm"        TEXT NOT NULL,
    "settlementType"      TEXT NOT NULL, -- TRANSPORT, EQUIPMENT_LEASE, REPAIR, CONSUMABLE
    "vendorId"            TEXT REFERENCES vendors(id) ON DELETE SET NULL,
    "vendorName"          TEXT NOT NULL,
    "totalAmount"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    status                TEXT CHECK (status IN ('PENDING', 'APPROVED', 'CONFIRMED', 'PAID', 'REJECTED')) NOT NULL DEFAULT 'PENDING',
    "paymentDate"         TEXT,
    "paymentMethod"       TEXT,
    "bankAccount"         TEXT,
    "bankTransactionId"   TEXT REFERENCES bank_transactions(id) ON DELETE SET NULL,
    "confirmedAt"         TEXT,
    "confirmedBy"         TEXT,
    "itemCount"           INTEGER NOT NULL DEFAULT 0,
    memo                  TEXT,
    -- Íµ≠ÏÑ∏Ï≤≠ Ï†ÑÏûêÏÑ∏Í∏àÍ≥ÑÏÇ∞ÏÑú Îß§ÏûÖ ÎåÄÏÇ¨ Ïª¨Îüº
    "taxInvoiceNo"            TEXT,
    "taxInvoiceIssueDate"     TEXT,
    "taxInvoiceSupplyAmount"  DOUBLE PRECISION,
    "taxInvoiceVatAmount"     DOUBLE PRECISION,
    "taxInvoiceTotalAmount"   DOUBLE PRECISION,
    "taxInvoiceMatchStatus"   TEXT DEFAULT 'UNMATCHED',
    "taxInvoiceMatchedAt"     TEXT,
    "taxInvoiceRawSupplier"   TEXT,
    "taxInvoiceBizNo"         TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-11. ÏõîÎßê Îß§ÏûÖ Ï†ïÏÇ∞ ÏÉÅÏÑ∏ (purchase_settlement_items)
CREATE TABLE purchase_settlement_items (
    id                    TEXT PRIMARY KEY,
    "settlementId"        TEXT NOT NULL REFERENCES purchase_settlements(id) ON DELETE CASCADE,
    "sourceType"          TEXT NOT NULL, -- DELIVERY, CONSUMABLE_PURCHASE, EQUIPMENT_LEASE, REPAIR
    "sourceId"            TEXT NOT NULL,
    "itemDescription"     TEXT NOT NULL,
    quantity              DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    amount                DOUBLE PRECISION NOT NULL DEFAULT 0,
    "evidenceFileUrl"     TEXT,
    "createdAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-12. Ï†ïÏÇ∞ ÏßÄÍ∏â Î∂ÑÌï† Ïù¥Î†• Î†àÏΩîÎìú (settlement_payment_logs)
CREATE TABLE settlement_payment_logs (
    id                    TEXT PRIMARY KEY,
    "settlementId"        TEXT NOT NULL REFERENCES purchase_settlements(id) ON DELETE CASCADE,
    "bankTransactionId"   TEXT REFERENCES bank_transactions(id) ON DELETE SET NULL,
    "paidAmount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentDate"         TEXT NOT NULL,
    "paymentMethod"       TEXT,
    "bankAccount"         TEXT,
    memo                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-13. ÏûêÍ∏à ÌùêÎ¶Ñ Ïä§ÎÉÖÏÉ∑ (cash_flow_snapshots)
CREATE TABLE cash_flow_snapshots (
    id                    TEXT PRIMARY KEY,
    "snapshotDate"        TEXT NOT NULL,
    "startingBalance"     BIGINT NOT NULL DEFAULT 0,
    "projectedInflow"     BIGINT NOT NULL DEFAULT 0,
    "projectedOpex"       BIGINT NOT NULL DEFAULT 0,
    "projectedCapex"      BIGINT NOT NULL DEFAULT 0,
    "projectedFinalBalance" BIGINT NOT NULL DEFAULT 0,
    notes                 TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-14. ÏÑ†Í∏âÍ∏à ÏõêÏû• (prepaid_transactions)
CREATE TABLE prepaid_transactions (
    id                    TEXT PRIMARY KEY,
    "customerId"          TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    "transactionDate"     TEXT,
    type                  TEXT CHECK (type IN ('DEPOSIT', 'DEDUCTION', 'REFUND', 'CHARGE', 'USE_FOR_BILLING')) NOT NULL,
    amount                DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceAfter"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "billingId"           TEXT REFERENCES billings(id) ON DELETE SET NULL,
    "paymentId"           TEXT REFERENCES payments(id) ON DELETE SET NULL,
    "bankTransactionId"   TEXT REFERENCES bank_transactions(id) ON DELETE SET NULL,
    "relatedBillingId"    TEXT REFERENCES billings(id) ON DELETE SET NULL,
    description           TEXT,
    memo                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-15. Ïó∞Ï≤¥ Ï±ÑÍ∂å ÎèÖÏ¥â Ïù¥Î†• (delinquency_action_logs)
CREATE TABLE delinquency_action_logs (
    id                    TEXT PRIMARY KEY,
    "customerId"          TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    "actionDate"          TEXT,
    "actionType"          TEXT CHECK ("actionType" IN ('CALL', 'SMS', 'VISIT', 'LEGAL_NOTICE', 'DEVICE_LOCK', 'NOTICE_SENT', 'LEGAL', 'DIRECTIVE')) NOT NULL,
    "actionDetails"       TEXT,
    "proofFileName"       TEXT,
    "recordedBy"          TEXT,
    "mandateType"         TEXT NOT NULL DEFAULT 'CEO_AUTO_MANDATE',
    "promiseDate"         TEXT,
    "promiseAmount"       DOUBLE PRECISION,
    "promiseStatus"       TEXT DEFAULT 'PENDING',
    "promiseContactPerson" TEXT,
    "directiveTargetUserId" TEXT,
    "directiveDueDate"    TEXT,
    "actorId"             TEXT REFERENCES users(id) ON DELETE SET NULL,
    "contactPerson"       TEXT,
    "contactPhone"        TEXT,
    content               TEXT,
    "promisedDate"        TEXT,
    "promisedAmount"      DOUBLE PRECISION,
    "createdAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-16. Î≤ïÏ†Å ÏµúÍ≥†/ÎÇ¥Ïö©Ï¶ùÎ™Ö Î∞úÏÜ° Ïù¥Î†• (legal_notice_logs)
CREATE TABLE legal_notice_logs (
    id                    TEXT PRIMARY KEY,
    "customerId"          TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    "customerName"        TEXT NOT NULL,
    representative        TEXT NOT NULL,
    "bizRegNo"            TEXT,
    address               TEXT NOT NULL,
    "overdueAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "overdueDays"         INTEGER NOT NULL DEFAULT 0,
    "noticeTitle"         TEXT NOT NULL,
    "noticeContent"       TEXT NOT NULL,
    "deadlineDays"        INTEGER NOT NULL DEFAULT 14,
    "sentDate"            TEXT NOT NULL,
    "sentByUserId"        TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    "sentByName"          TEXT NOT NULL,
    "postalTrackingNo"    TEXT,
    status                TEXT DEFAULT 'SENT',
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 5-17. ÎÇ¥Ïö©Ï¶ùÎ™Ö Î≤ïÏ†Å ÏÑúÏãù ÌÖúÌîåÎ¶ø (legal_notice_templates)
CREATE TABLE legal_notice_templates (
    id                    TEXT PRIMARY KEY,
    title                 TEXT NOT NULL,
    content               TEXT NOT NULL,
    "deadlineDays"        INTEGER NOT NULL DEFAULT 14,
    "isDefault"           BOOLEAN DEFAULT FALSE,
    "createdAt"           TEXT,
    "updatedAt"           TEXT NOT NULL
);

-- 5-16. ÏõîÎ≥Ñ Í∞êÍ∞ÄÏÉÅÍ∞Å ÎßàÍ∞ê Ïù¥Î†• (depreciation_logs)
CREATE TABLE depreciation_logs (
    id                    TEXT PRIMARY KEY,
    "depreciationYm"      TEXT NOT NULL UNIQUE,
    "executedAt"          TEXT NOT NULL,
    "executedBy"          TEXT,
    "targetAssetCount"    INTEGER NOT NULL DEFAULT 0,
    "totalDepreciationAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    note                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);


-- ==============================================================================
-- ü§ù [ÎèÑÎ©îÏù∏ 6] ÌòëÏóÖ, ToDo, Î¨∏ÏÑúÏûëÏóÖ Î∞è ÏãúÏä§ÌÖú (System & Collaboration)
-- ==============================================================================

-- 6-1. ÏÇ¨Ïö©Ïûê ÎßûÏ∂§Ìòï ToDo ÌîºÎìú (todos)
CREATE TABLE todos (
    id                    TEXT PRIMARY KEY,
    "userId"              TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "assignedUserId"      TEXT REFERENCES users(id) ON DELETE SET NULL,
    "targetDept"          TEXT,
    "targetRole"          TEXT,
    "taskCategory"        TEXT NOT NULL DEFAULT 'GENERAL',
    type                  TEXT NOT NULL DEFAULT 'GENERAL',
    title                 TEXT NOT NULL,
    content               TEXT NOT NULL,
    priority              TEXT NOT NULL DEFAULT 'NORMAL',
    "dueDate"             TEXT,
    "actionUrl"           TEXT NOT NULL DEFAULT '/',
    "entityType"          TEXT,
    "entityId"            TEXT,
    "targetType"          TEXT,
    "isCompleted"         BOOLEAN NOT NULL DEFAULT FALSE,
    "relatedEntityId"     TEXT,
    "senderId"            TEXT REFERENCES users(id) ON DELETE SET NULL,
    "senderName"          TEXT,
    "resolutionNote"      TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "completedAt"         TEXT,
    "completedByUserId"   TEXT REFERENCES users(id) ON DELETE SET NULL,
    "completedByName"     TEXT,
    "completionAction"    TEXT,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);















-- 6-7. ÌÅ¥ÎùºÏö∞Îìú Î∞è Íµ¨Í∏Ä Ïó∞Îèô ÏÑ§Ï†ï (google_configs)
CREATE TABLE google_configs (
    id                    TEXT PRIMARY KEY,
    "googleEmail"         TEXT NOT NULL,
    "googlePassword"      TEXT,
    "gmailAppPassword"    TEXT,
    "contractFolder"      TEXT NOT NULL,
    "consumableFolder"    TEXT NOT NULL,
    "deliveryFolder"      TEXT NOT NULL,
    "maintenanceFolder"   TEXT NOT NULL,
    "isDevMode"           BOOLEAN NOT NULL DEFAULT TRUE,
    "quotationTemplateUrl" TEXT,
    "contractTemplateUrl" TEXT,
    "safetyInspectionTemplateUrl" TEXT,
    "preDeliveryChecklistTemplateUrl" TEXT,
    "bizRegCertUrl"       TEXT,
    "bankbookCopyUrl"     TEXT,
    "transactionStatementTemplateUrl" TEXT,
    "defaultRootFolderId" TEXT,
    "currentInsuranceStartDate" TEXT,
    "currentInsuranceEndDate"   TEXT,
    "nextInsuranceCertUrl"     TEXT,
    "nextInsuranceStartDate"   TEXT,
    "nextInsuranceEndDate"     TEXT,
    "mirrorRecursive"          BOOLEAN NOT NULL DEFAULT TRUE,
    "r2AccountId"              TEXT,
    "r2BucketName"        TEXT,
    "r2AccessKeyId"       TEXT,
    "r2SecretAccessKey"   TEXT,
    "r2PublicDomain"      TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL
);


-- ==============================================================================
-- 7. Î≤ïÏù∏ Ï∞®Îüâ Î∞è Ï∞®ÎüâÏö¥ÌñâÏùºÏßÄ/Ï£ºÏú†Í∏∞Î°ù Í¥ÄÎ¶¨ (corporate_vehicles, vehicle_operation_logs, vehicle_fuel_logs)
-- ==============================================================================

-- 7-1. Î≤ïÏù∏ Ï∞®Îüâ ÎßàÏä§ÌÑ∞ (corporate_vehicles)
CREATE TABLE corporate_vehicles (
    id                    TEXT PRIMARY KEY,
    "vehicleNo"           TEXT NOT NULL UNIQUE,
    "modelName"           TEXT NOT NULL,
    "vehicleType"         TEXT DEFAULT 'ÏäπÌï©Ï∞®', -- ÏäπÏö©Ï∞®, ÌôîÎ¨º/ÌÉëÏ∞®, ÏäπÌï©Ï∞®, Ï†ÑÍ∏∞Ï∞®
    "ownershipType"       TEXT CHECK ("ownershipType" IN ('OWNED', 'LEASE', 'RENTAL')) DEFAULT 'OWNED',
    "fuelType"            TEXT CHECK ("fuelType" IN ('DIESEL', 'GASOLINE', 'LPG', 'HYBRID', 'ELECTRIC')) DEFAULT 'DIESEL',
    "assignedDepartment"  TEXT DEFAULT 'Í¥ÄÎ¶¨Î∂Ä',
    "primaryDriverId"     TEXT REFERENCES users(id) ON DELETE SET NULL,
    "primaryDriverName"   TEXT,
    "initialMileage"      INTEGER NOT NULL DEFAULT 0,
    "currentMileage"      INTEGER NOT NULL DEFAULT 0,
    "insuranceExpiryDate" TEXT,
    "inspectionExpiryDate" TEXT,
    "isActive"            BOOLEAN NOT NULL DEFAULT TRUE,
    memo                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 7-2. Ï∞®ÎüâÏö¥ÌñâÏùºÏßÄ (vehicle_operation_logs - Íµ≠ÏÑ∏Ï≤≠ ÏóÖÎ¨¥Ïö©ÏäπÏö©Ï∞® Ïö¥ÌñâÍ∏∞Î°ùÎ∂Ä Î≤ïÏ†ïÏÑúÏãù Ïó∞Îèô)
CREATE TABLE vehicle_operation_logs (
    id                    TEXT PRIMARY KEY,
    "vehicleId"           TEXT NOT NULL REFERENCES corporate_vehicles(id) ON DELETE CASCADE,
    "vehicleNo"           TEXT NOT NULL,
    "driverId"            TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    "driverName"          TEXT NOT NULL,
    "driverDept"          TEXT,
    "operationDate"       TEXT NOT NULL, -- YYYY-MM-DD
    "purposeType"         TEXT CHECK ("purposeType" IN ('COMMUTE', 'BUSINESS_GENERAL', 'CLIENT_MEETING', 'SITE_AS', 'LOGISTICS_DELIVERY', 'OTHER')) NOT NULL DEFAULT 'BUSINESS_GENERAL',
    "purposeDetail"       TEXT,
    "departureLocation"   TEXT NOT NULL,
    "arrivalLocation"     TEXT NOT NULL,
    "departureMileage"    INTEGER NOT NULL,
    "arrivalMileage"      INTEGER NOT NULL,
    "driveDistance"       INTEGER NOT NULL, -- arrivalMileage - departureMileage
    "businessDistance"    INTEGER NOT NULL, -- ÏóÖÎ¨¥Ïö© ÏÇ¨Ïö©Í±∞Î¶¨
    "commuteDistance"     INTEGER NOT NULL DEFAULT 0, -- Ï∂úÌá¥Í∑ºÍ±∞Î¶¨
    "dashboardPhotoStart" TEXT, -- Ï∂úÎ∞ú Ïãú Í≥ÑÍ∏∞Ìåê ÏÇ¨ÏßÑ URL / Base64
    "dashboardPhotoEnd"   TEXT, -- ÎèÑÏ∞© Ïãú Í≥ÑÍ∏∞Ìåê ÏÇ¨ÏßÑ URL / Base64
    memo                  TEXT,
    status                TEXT CHECK (status IN ('SUBMITTED', 'CONFIRMED', 'REJECTED')) NOT NULL DEFAULT 'SUBMITTED',
    "confirmedBy"         TEXT,
    "confirmedAt"         TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- 7-3. Ï∞®Îüâ Ï£ºÏú† Î∞è Ï∂©Ï†Ñ ÏòÅÏàòÏ¶ù Í∏∞Î°ùÎ∂Ä (vehicle_fuel_logs)
CREATE TABLE vehicle_fuel_logs (
    id                    TEXT PRIMARY KEY,
    "vehicleId"           TEXT NOT NULL REFERENCES corporate_vehicles(id) ON DELETE CASCADE,
    "vehicleNo"           TEXT NOT NULL,
    "driverId"            TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    "driverName"          TEXT NOT NULL,
    "fuelDate"            TEXT NOT NULL, -- YYYY-MM-DD HH:mm
    "fuelType"            TEXT NOT NULL, -- DIESEL, GASOLINE, LPG, ELECTRIC
    "fuelVolume"          DOUBLE PRECISION NOT NULL, -- Ï£ºÏú†Îüâ (Î¶¨ÌÑ∞ L)
    "fuelAmount"          DOUBLE PRECISION NOT NULL, -- Ï£ºÏú†Í∏àÏï° (Ïõê ‚Ç©)
    "fuelUnitPrice"       DOUBLE PRECISION, -- Î¶¨ÌÑ∞Îãπ Îã®Í∞Ä
    "currentMileage"      INTEGER NOT NULL, -- Ï£ºÏú† ÏãúÏ†ê Í≥ÑÍ∏∞Ìåê Ï£ºÌñâÍ±∞Î¶¨ (km)
    "dashboardPhotoUrl"   TEXT, -- Ï£ºÏú† Ïãú Í≥ÑÍ∏∞Ìåê ÏÇ¨ÏßÑ
    "receiptPhotoUrl"     TEXT NOT NULL, -- Ï£ºÏú† ÏòÅÏàòÏ¶ù ÏÇ¨ÏßÑ
    "gasStationName"      TEXT, -- Ï£ºÏú†ÏÜå ÏÉÅÌò∏
    "paymentMethod"       TEXT DEFAULT 'CORPORATE_CARD', -- CORPORATE_CARD, PERSONAL_EXPENSE
    "cardLast4"           TEXT,
    "fuelEfficiency"      DOUBLE PRECISION, -- ÏßÅÏ†Ñ ÎåÄÎπÑ Í≥ÑÏÇ∞Îêú Ïó∞ÎπÑ (km/L)
    memo                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

CREATE INDEX IF NOT EXISTS idx_vlog_vehicle_date ON vehicle_operation_logs("vehicleId", "operationDate");
CREATE INDEX IF NOT EXISTS idx_vlog_driver ON vehicle_operation_logs("driverId");
CREATE INDEX IF NOT EXISTS idx_vfuel_vehicle_date ON vehicle_fuel_logs("vehicleId", "fuelDate");
CREATE INDEX IF NOT EXISTS idx_vfuel_driver ON vehicle_fuel_logs("driverId");

-- 4-8. Ïû•ÎπÑ Í∏∞Ïà† Îß§Îâ¥Ïñº ÎùºÏù¥Î∏åÎü¨Î¶¨ (equipment_manuals)
CREATE TABLE IF NOT EXISTS equipment_manuals (
    id                    TEXT PRIMARY KEY,
    "modelName"           TEXT NOT NULL,
    manufacturer          TEXT NOT NULL,
    "targetSpecFt"        INTEGER,
    category              TEXT NOT NULL CHECK (category IN ('PARTS_BOOK', 'ERROR_CODE', 'WIRING_DIAGRAM', 'OPERATOR_MANUAL')),
    title                 TEXT NOT NULL,
    "fileUrl"             TEXT NOT NULL,
    "fileName"            TEXT NOT NULL,
    "fileSize"            BIGINT NOT NULL DEFAULT 0,
    "fileSizeLabel"       TEXT,
    version               TEXT DEFAULT 'Rev. 1.0',
    "uploadDate"          TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT,
    "uploadedBy"          TEXT NOT NULL,
    memo                  TEXT,
    "inspectionItemCodes" JSONB DEFAULT '[]'::jsonb,
    media_type            TEXT DEFAULT 'PDF' CHECK (media_type IN ('PDF', 'YOUTUBE', 'WEB_LINK')),
    "externalUrl"         TEXT,
    "youtubeVideoId"      TEXT,
    "durationMinutes"     INTEGER,
    "aiProcessed"         BOOLEAN DEFAULT FALSE,
    "aiProcessedAt"       TEXT,
    keywords              JSONB DEFAULT '[]'::jsonb,
    "errorCodes"          JSONB DEFAULT '[]'::jsonb,
    "majorParts"          JSONB DEFAULT '[]'::jsonb,
    symptoms              JSONB DEFAULT '[]'::jsonb,
    "aiSummary"           TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

CREATE INDEX IF NOT EXISTS idx_manuals_model ON equipment_manuals("modelName");
CREATE INDEX IF NOT EXISTS idx_manuals_category ON equipment_manuals(category);
CREATE INDEX IF NOT EXISTS idx_manuals_keywords ON equipment_manuals USING gin (keywords);

-- ==============================================================================
-- 7. Î∂ÑÏÇ∞ Ïù∏ÏáÑ ÌÅê ÏãúÏä§ÌÖú (print_stations & print_queue)
-- ==============================================================================
-- 7-1. Î∂ÑÏÇ∞ Ïù∏ÏáÑ Ïä§ÌÖåÏù¥ÏÖò (print_stations)
CREATE TABLE IF NOT EXISTS print_stations (
    id                    TEXT PRIMARY KEY,
    "stationName"         TEXT NOT NULL,
    "machineName"         TEXT,
    "localPrinterName"    TEXT NOT NULL,
    "docTypeDefault"      TEXT CHECK ("docTypeDefault" IN ('DISPATCH_ORDER', 'RETURN_ORDER', 'ALL')) DEFAULT 'ALL',
    description           TEXT,
    status                TEXT CHECK (status IN ('ONLINE', 'OFFLINE')) NOT NULL DEFAULT 'OFFLINE',
    "lastHeartbeat"       TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

CREATE INDEX IF NOT EXISTS idx_print_stations_status ON print_stations(status);

-- 7-2. Î∂ÑÏÇ∞ Î¨∏ÏÑú Ï∂úÎ†• ÎåÄÍ∏∞Ïó¥ Î∞è Ïã§Ìñâ Í∞êÏÇ¨ Ïù¥Î†• (print_queue)
CREATE TABLE IF NOT EXISTS print_queue (
    id                    TEXT PRIMARY KEY,
    "stationId"           TEXT NOT NULL REFERENCES print_stations(id) ON DELETE CASCADE,
    "stationName"         TEXT NOT NULL,
    "docType"             TEXT CHECK ("docType" IN ('DISPATCH_ORDER', 'RETURN_ORDER')) NOT NULL,
    "docNo"               TEXT,
    title                 TEXT NOT NULL,
    "documentHtml"        TEXT NOT NULL,
    status                TEXT CHECK (status IN ('PENDING', 'PRINTING', 'COMPLETED', 'FAILED', 'CANCELED')) NOT NULL DEFAULT 'PENDING',
    "errorMessage"        TEXT,
    "localPrinterName"    TEXT,
    "lastError"           TEXT,
    "requestedById"       TEXT REFERENCES users(id) ON DELETE SET NULL,
    "requestedByName"     TEXT,
    "requestedAt"         TEXT NOT NULL,
    "printedAt"           TEXT,
    "retryCount"          INTEGER NOT NULL DEFAULT 0,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

CREATE INDEX IF NOT EXISTS idx_print_queue_station_status ON print_queue("stationId", status);
CREATE INDEX IF NOT EXISTS idx_print_queue_requested_at ON print_queue("requestedAt");

-- ==============================================================================
-- üõ°Ô∏è [ÎèÑÎ©îÏù∏ 7] Í∞úÏù∏Ï†ïÎ≥¥ Î≥¥Ìò∏ Î∞è Ï†ëÏÜç Í∞êÏÇ¨ Í∏∞Î°ù (Privacy & Audit Logs)
-- ÎåÄÌïúÎØºÍµ≠ Í∞úÏù∏Ï†ïÎ≥¥ Î≥¥Ìò∏Î≤ï Ï†ú29Ï°∞ Î∞è Í∞úÏù∏Ï†ïÎ≥¥Ïùò ÏïàÏ†ÑÏÑ± ÌôïÎ≥¥Ï°∞Ïπò Í∏∞Ï§Ä Ï†ú8Ï°∞ Ï§ÄÏàò
-- ==============================================================================
CREATE TABLE IF NOT EXISTS privacy_access_logs (
    id                    TEXT PRIMARY KEY,
    "userId"              TEXT,
    "userName"            TEXT,
    "ipAddress"           TEXT,
    "actionType"          TEXT NOT NULL, -- LOGIN, LOGOUT, VIEW, CREATE, UPDATE, DELETE, EXCEL_DOWNLOAD, UNMASK_VIEW
    "targetMenu"          TEXT NOT NULL,
    "targetSubjectId"     TEXT,
    "targetSubjectName"   TEXT,
    "actionDetail"        TEXT,
    "isMasked"            BOOLEAN DEFAULT TRUE,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

CREATE INDEX IF NOT EXISTS idx_privacy_access_logs_created ON privacy_access_logs("createdAt");
CREATE INDEX IF NOT EXISTS idx_privacy_access_logs_user ON privacy_access_logs("userId");
CREATE INDEX IF NOT EXISTS idx_privacy_access_logs_action ON privacy_access_logs("actionType");

-- ==============================================================================
-- üîí Ï†Ñ ÌÖåÏù¥Î∏î Row Level Security (RLS) Î∞è Í∂åÌïú ÏùºÍ¥Ñ ÌôúÏÑ±Ìôî
-- ==============================================================================
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "allow_anon_all" ON %I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "allow_auth_all" ON %I;', tbl);
        EXECUTE format('CREATE POLICY "allow_anon_all" ON %I FOR ALL TO anon USING (true) WITH CHECK (true);', tbl);
        EXECUTE format('CREATE POLICY "allow_auth_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true);', tbl);
    END LOOP;
END $$;

-- üåü Ï†ïÎπÑÏ†êÍ≤ÄÌï≠Î™© ÎßàÏä§ÌÑ∞ ÌÖåÏù¥Î∏îÏùÄ ÏÇ≠Ï†ú/ÏàòÏ†ï Î¨¥Ïùå Ïã§Ìå® Î∞©ÏßÄÎ•º ÏúÑÌï¥ RLS ÏôÑÏ†Ñ ÎπÑÌôúÏÑ±Ìôî Î∞è Ï†Ñ Í∂åÌïú Î∂ÄÏó¨
ALTER TABLE inspection_checklist_items DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE inspection_checklist_items TO anon, authenticated, service_role;



-- ==============================================================================
-- üè¢ [ÎèÑÎ©îÏù∏ 0] Î©ÄÌã∞ÌÖåÎÑåÌä∏ Î∞è Ï†ÑÏÇ¨ Í∏∞Î≥∏ ÏÑ§Ï†ï (Tenants & Core Workplace)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS tenants (
    id                    TEXT PRIMARY KEY,
    "tenantCode"          TEXT NOT NULL UNIQUE,
    "systemName"          TEXT NOT NULL,
    "displayName"         TEXT NOT NULL,
    "corporateName"       TEXT NOT NULL,
    "tradeName"           TEXT,
    "businessNumber"      TEXT NOT NULL,
    "corporateRegistrationNumber" TEXT,
    "representativeName"  TEXT NOT NULL,
    "openingDate"         TEXT NOT NULL,
    "businessAddress"     TEXT NOT NULL,
    "headOfficeAddress"   TEXT,
    "businessCategory"    TEXT NOT NULL,
    "businessItem"        TEXT NOT NULL,
    "businessTypes"       JSONB DEFAULT '[]'::jsonb,
    "isUnitTaxation"      BOOLEAN NOT NULL DEFAULT FALSE,
    "taxEmail"            TEXT NOT NULL,
    "taxOffice"           TEXT,
    "certificateIssueDate" TEXT,
    tel                   TEXT NOT NULL,
    fax                   TEXT,
    "salesPhone"          TEXT,
    email                 TEXT,
    "websiteUrl"          TEXT,
    workplaces            JSONB DEFAULT '[]'::jsonb,
    yards                 JSONB DEFAULT '[]'::jsonb,
    "mainYardAddress"     TEXT,
    "stampBase64"         TEXT,
    "stampImageUrl"       TEXT,
    "targetRepo"          TEXT,
    "solutionType"        TEXT,
    "privacyOfficer"      JSONB DEFAULT '{}'::jsonb,
    "privacyOfficerName"  TEXT,
    "privacyOfficerPosition" TEXT,
    "privacyOfficerDepartment" TEXT,
    "privacyOfficerPhone" TEXT,
    "privacyOfficerEmail" TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL
);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "targetRepo" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "solutionType" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "stampImageUrl" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "stampBase64" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "specialFeatures" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "privacyOfficer" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "privacyOfficerName" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "privacyOfficerPosition" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "privacyOfficerDepartment" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "privacyOfficerPhone" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "privacyOfficerEmail" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "allowedPages" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "hiddenPages" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "features" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "subscription" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "bankAccounts" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "ciUrl" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "subdomain" TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'ACTIVE';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN DEFAULT FALSE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS "allowCustomBillingStatement" BOOLEAN DEFAULT FALSE;

-- ==============================================================================
-- üì¶ [ÎèÑÎ©îÏù∏ 4-9] ÏÜåÎ™®Ìíà Ïã§ÏÇ¨ Î∞è Í≥†Ìíà Í¥ÄÎ¶¨ (Stocktaking & Collected Parts)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS stocktaking_audits (
    id                    TEXT PRIMARY KEY,
    "auditNo"             TEXT NOT NULL,
    "targetType"          TEXT CHECK ("targetType" IN ('HQ', 'VEHICLE')) NOT NULL,
    "mechanicId"          TEXT,
    "mechanicName"        TEXT,
    "vehicleNo"           TEXT,
    "auditDate"           TEXT NOT NULL,
    "auditorId"           TEXT NOT NULL,
    "auditorName"         TEXT NOT NULL,
    status                TEXT CHECK (status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')) NOT NULL DEFAULT 'DRAFT',
    "totalSystemQty"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalActualQty"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDiffQty"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalSystemAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalActualAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDiffAmount"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    memo                  TEXT,
    "confirmedAt"         TEXT,
    "confirmedBy"         TEXT,
    "createdAt"           TEXT NOT NULL,
    "updatedAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

CREATE TABLE IF NOT EXISTS stocktaking_audit_items (
    id                    TEXT PRIMARY KEY,
    "auditId"             TEXT NOT NULL REFERENCES stocktaking_audits(id) ON DELETE CASCADE,
    "consumableId"        TEXT NOT NULL,
    "modelName"           TEXT NOT NULL,
    unit                  TEXT NOT NULL,
    "unitPrice"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "systemQty"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualQty"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diffQty"             DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diffAmount"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diffReason"          TEXT CHECK ("diffReason" IN ('LOST', 'DAMAGED', 'UNRECORDED_USAGE', 'SURPLUS', 'OTHER')),
    note                  TEXT,
    "createdAt"           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP::TEXT,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

CREATE TABLE IF NOT EXISTS collected_parts (
    id                    TEXT PRIMARY KEY,
    "partNo"              TEXT NOT NULL,
    "consumableId"        TEXT NOT NULL,
    "modelName"           TEXT NOT NULL,
    "mechanicId"          TEXT NOT NULL,
    "mechanicName"        TEXT NOT NULL,
    quantity              DOUBLE PRECISION NOT NULL DEFAULT 1,
    disposition           TEXT CHECK (disposition IN ('REBUILD', 'SCRAP', 'VENDOR_WARRANTY')) NOT NULL DEFAULT 'REBUILD',
    status                TEXT CHECK (status IN ('RECEIVED', 'IN_PROCESS', 'COMPLETED')) NOT NULL DEFAULT 'RECEIVED',
    "receivedDate"        TEXT NOT NULL,
    "actionDate"          TEXT,
    "actionMemo"          TEXT,
    memo                  TEXT,
    "createdAt"           TEXT NOT NULL,
    "tenant_id"           TEXT NOT NULL DEFAULT 'giyeonlift'
);

-- ==============================================================================
-- üéôÔ∏è [ÎèÑÎ©îÏù∏ 7-12] AI ÏùåÏÑ±ÌÜµÌôî Î∞è ÏûÑÏãú Ï∂úÍ≥†ÏùòÎ¢∞ (Call STT Pipeline & Draft Orders)

CREATE TABLE IF NOT EXISTS call_uploads (
    id                    TEXT PRIMARY KEY,
    uploader_id           TEXT,
    uploader_phone        TEXT,
    caller_phone          TEXT,
    call_direction        TEXT,
    call_ended_at         TEXT,
    duration_seconds      INTEGER,
    storage_path          TEXT,
    file_name             TEXT,
    call_context          TEXT,
    summary_text          TEXT,
    status                TEXT,
    retry_count           INTEGER DEFAULT 0,
    error_message         TEXT,
    draft_id              TEXT,
    customer_id           TEXT,
    created_at            TEXT,
    processed_at          TEXT,
    auto_delete_at        TEXT
);

CREATE TABLE IF NOT EXISTS call_pipeline_logs (
    id                    TEXT PRIMARY KEY,
    call_upload_id        TEXT REFERENCES call_uploads(id) ON DELETE CASCADE,
    draft_id              TEXT,
    event_type            TEXT,
    level                 TEXT,
    message               TEXT,
    payload               JSONB,
    created_at            TEXT
);

CREATE TABLE IF NOT EXISTS draft_dispatch_orders (
    id                    TEXT PRIMARY KEY,
    owner_id              TEXT,
    source_call_ids       JSONB,
    context               TEXT,
    customer_name         TEXT,
    customer_name_conf    DOUBLE PRECISION,
    customer_name_src     TEXT,
    customer_id           TEXT,
    site_name             TEXT,
    site_name_conf        DOUBLE PRECISION,
    site_id               TEXT,
    equipment_json        JSONB,
    loading_date          TEXT,
    loading_date_conf     DOUBLE PRECISION,
    loading_time          TEXT,
    loading_time_conf     DOUBLE PRECISION,
    contact_person        TEXT,
    contact_person_conf   DOUBLE PRECISION,
    contact_phone         TEXT,
    note                  TEXT,
    is_new_customer       BOOLEAN,
    customer_registered   BOOLEAN,
    status                TEXT,
    urgency               TEXT,
    merged_from           TEXT,
    created_at            TEXT,
    submitted_at          TEXT,
    submitted_by_id       TEXT
);
CREATE INDEX IF NOT EXISTS idx_psettlement_ym ON purchase_settlements("settlementYm");
CREATE INDEX IF NOT EXISTS idx_psettlement_vendor ON purchase_settlements("vendorId");
CREATE INDEX IF NOT EXISTS idx_psettlement_tax_inv ON purchase_settlements("taxInvoiceNo");

-- ==============================================================================
-- üì° [ÎèÑÎ©îÏù∏ 21] ÌòÑÏû• Î¨¥Ï†ÑÍ∏∞ ÎèôÏ†Å Ï±ÑÎÑê (Walkie-Talkie Dynamic Channels)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS walkie_channels (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL,
    code                  TEXT NOT NULL,
    "desc"                TEXT,
    "createdById"         TEXT NOT NULL,
    "createdByName"       TEXT NOT NULL,
    "memberIds"           JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt"           TEXT NOT NULL,
    "isDefault"           BOOLEAN NOT NULL DEFAULT FALSE,
    "tenant_id"           TEXT NOT NULL DEFAULT 'tenant-giyeonlift',
    "updatedAt"           TEXT NOT NULL
);


-- [DEEP AUDIT V2 PATCH] Í∞ïÏ†ú RLS ÌôúÏÑ±Ìôî
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_leave_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumables ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumable_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE mechanic_consumable_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE transport_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_inout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_consumables ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumable_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE standard_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE billings ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_deposit_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_matching_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_initial_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_settlement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_flow_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE prepaid_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE delinquency_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_notice_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_notice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_operation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_manuals ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktaking_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktaking_audit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE collected_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_dispatch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE walkie_channels ENABLE ROW LEVEL SECURITY;


-- =================================================================================


-- =================================================================================
-- [APPROVAL ENGINE] Í≤∞Ïû¨ ÏóîÏßÑ Î∞è Ìï©Ïùò ÎùºÏö∞ÌåÖ ÌÖåÏù¥Î∏î
-- =================================================================================

CREATE TABLE IF NOT EXISTS approval_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL DEFAULT 'giyeonlift',
    event_code TEXT NOT NULL,
    event_name TEXT NOT NULL,
    description TEXT,
    is_enabled BOOLEAN DEFAULT true,
    required_tier INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS rule_consensus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rule_id UUID REFERENCES approval_rules(id) ON DELETE CASCADE,
    trigger_after_tier INT NOT NULL,
    target_dept_id TEXT REFERENCES departments(id) ON DELETE CASCADE,
    consensus_tier INT NOT NULL,
    execution_type TEXT DEFAULT 'PARALLEL',
    seq_order INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS approval_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL DEFAULT 'giyeonlift',
    rule_id UUID REFERENCES approval_rules(id) ON DELETE CASCADE,
    originator_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    target_record_id TEXT NOT NULL,
    target_table TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    current_step INT DEFAULT 1,
    escalated_tier INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS approval_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID REFERENCES approval_requests(id) ON DELETE CASCADE,
    step_index INT NOT NULL,
    step_type TEXT NOT NULL,
    approver_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING',
    tier_level INT NOT NULL,
    comment TEXT,
    acted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS delegation_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delegator_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    delegate_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    valid_from DATE NOT NULL,
    valid_until DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT delegate_tier_check CHECK (delegate_id != delegator_id)
);

CREATE TABLE IF NOT EXISTS approval_tier_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id TEXT NOT NULL DEFAULT 'giyeonlift',
    category TEXT NOT NULL CHECK (category IN ('POSITION', 'DUTY')),
    title TEXT NOT NULL,
    tier_level INT NOT NULL DEFAULT 0,
    description TEXT,
    seq_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(tenant_id, category, title)
);

ALTER TABLE approval_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_consensus ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_tier_configs ENABLE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- üìä ÏõîÍ∞Ñ Í≤∞ÏÇ∞ ÏÜêÏùµÍ≥ÑÏÇ∞ÏÑú ÏóîÌã∞Ìã∞ (monthly_income_statements)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS monthly_income_statements (
    id TEXT PRIMARY KEY,
    "targetYm" TEXT,
    target_ym TEXT,
    status TEXT,
    "issuedAt" TEXT,
    issued_at TEXT,
    "issuedBy" TEXT,
    issued_by TEXT,
    "issuedByName" TEXT,
    issued_by_name TEXT,
    "rentalRevenue" NUMERIC DEFAULT 0,
    rental_revenue NUMERIC DEFAULT 0,
    "distributionRevenue" NUMERIC DEFAULT 0,
    distribution_revenue NUMERIC DEFAULT 0,
    "otherRevenue" JSONB,
    other_revenue JSONB,
    "totalRevenue" NUMERIC DEFAULT 0,
    total_revenue NUMERIC DEFAULT 0,
    "rentalCost" JSONB,
    rental_cost JSONB,
    "pureRentalProfit" NUMERIC DEFAULT 0,
    pure_rental_profit NUMERIC DEFAULT 0,
    "rentalMarginRate" NUMERIC DEFAULT 0,
    rental_margin_rate NUMERIC DEFAULT 0,
    "distributionCost" NUMERIC DEFAULT 0,
    distribution_cost NUMERIC DEFAULT 0,
    "pureDistributionProfit" NUMERIC DEFAULT 0,
    pure_distribution_profit NUMERIC DEFAULT 0,
    "distributionMarginRate" NUMERIC DEFAULT 0,
    distribution_margin_rate NUMERIC DEFAULT 0,
    "otherCost" JSONB,
    other_cost JSONB,
    "otherNetProfit" NUMERIC DEFAULT 0,
    other_net_profit NUMERIC DEFAULT 0,
    "totalCostOfSales" NUMERIC DEFAULT 0,
    total_cost_of_sales NUMERIC DEFAULT 0,
    "grossProfit" NUMERIC DEFAULT 0,
    gross_profit NUMERIC DEFAULT 0,
    "grossMarginRate" NUMERIC DEFAULT 0,
    gross_margin_rate NUMERIC DEFAULT 0,
    "sgaExpenses" JSONB,
    sga_expenses JSONB,
    "operatingProfit" NUMERIC DEFAULT 0,
    operating_profit NUMERIC DEFAULT 0,
    "operatingMarginRate" NUMERIC DEFAULT 0,
    operating_margin_rate NUMERIC DEFAULT 0,
    "estimatedTax" NUMERIC DEFAULT 0,
    estimated_tax NUMERIC DEFAULT 0,
    "projectedNetProfit" NUMERIC DEFAULT 0,
    projected_net_profit NUMERIC DEFAULT 0,
    "netMarginRate" NUMERIC DEFAULT 0,
    net_margin_rate NUMERIC DEFAULT 0,
    "settlementClosingStatus" JSONB,
    settlement_closing_status JSONB,
    "createdAt" TEXT,
    created_at TEXT,
    "updatedAt" TEXT,
    updated_at TEXT,
    tenant_id TEXT DEFAULT 'giyeonlift'
);

ALTER TABLE monthly_income_statements DISABLE ROW LEVEL SECURITY;
GRANT ALL ON monthly_income_statements TO anon, authenticated, service_role;
-- ==============================================================================
-- ?ß† eBro ERP: Hindsight 4-Tier Memory System DDL Specification
-- ?èõÔ∏??Ä?úÎ?Íµ?Í∞úÏù∏?ïÎ≥¥Î≥¥Ìò∏Î≤?PIPA) Î∞??ÑÏÇ¨ ?úÏä§??Í∞úÎ∞ú ?úÏ? ?åÏû• Ï§Ä??-- ?? Supabase Pro (pgvector HNSW, JSONB, RLS, 4?Ä Î©îÎ™®Î¶??ÑÌÇ§?çÏ≤ò)
-- ==============================================================================

-- 1. pgvector Í≥†ÏÑ±??Î≤°ÌÑ∞ ?ïÏû• Í∏∞Îä• ?úÏÑ±??CREATE EXTENSION IF NOT EXISTS vector;

-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
-- 1. World facts (?¨Ïã§ ÏßÄ??: ?ÑÏÇ¨ ?úÏ? ?åÏû•, Í∏∞Ï? ?ïÎ≥¥, ?•ÎπÑ ?úÏõê, Î∂àÎ? Í≥µÎ¶¨
-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
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

-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
-- 2. Experiences (Í≤ΩÌóò ?∞Ïù¥??: ?¨Ïö©???∏ÌÑ∞?ôÏÖò, Î©îÎâ¥ Ï°∞Ïûë, Î≥Ä??SQL Î¨¥Ïùå Ï∫°Ï≤ò
-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
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

-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
-- 3. Observations (Í¥ÄÏ∞∞¬∑Ìå®??: ?ÑÏ†Å??Í≤ΩÌóò?ºÎ°úÎ∂Ä??Í∑Ä?©Ï†Å?ºÎ°ú Ï∂îÏ∂ú???†ÎÖêÍ≥??µÍ≥Ñ
-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
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

-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
-- 4. Mental models (Î©òÌÉà Î™®Îç∏): ?ÅÎπÑ ÏßÄ???ÑÌÇ§, standing Q&A, 1Ï¥?Ï∂îÏ≤ú ?ÑÎ°ú?ùÏÖò
-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
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

-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
-- 5. pgvector HNSW ?∏Îç±??(Í≥†ÏÜç ?úÎß®??Í≤Ä??
-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
CREATE INDEX IF NOT EXISTS idx_hs_wf_embedding ON hindsight_world_facts USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_hs_exp_embedding ON hindsight_experiences USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_hs_obs_embedding ON hindsight_observations USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX IF NOT EXISTS idx_hs_mm_embedding ON hindsight_mental_models USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
-- 6. Row Level Security (RLS) ?ïÏ±Ö
-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
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

-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
-- 7. ?òÏúÑ ?∏Ìôò??Î∑? Í∏∞Ï°¥ awp_shared_memories?Ä hindsight_experiences ?∞Îèô
-- ?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä?Ä
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
