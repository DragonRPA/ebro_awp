const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'pages', 'OrganizationSettings.tsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Update imports and remove local Department interface
const oldImportPattern = /import\s*\{\s*db,\s*ApprovalTierConfig,\s*loadApprovalTierConfigs,\s*getStoredApprovalTierConfigs,\s*getUserEffectiveTier\s*\}\s*from\s*'\.\.\/services\/db';\s*import\s*\{\s*exportToExcel\s*\}\s*from\s*'\.\.\/services\/excel';\s*\/\/\s*---\s*Type Definitions\s*---\s*interface Department\s*\{[\s\S]*?\}/;

const newImports = `import { 
  db, 
  ApprovalTierConfig, 
  loadApprovalTierConfigs, 
  getStoredApprovalTierConfigs, 
  getUserEffectiveTier,
  Department,
  UNIVERSAL_FUNCTIONAL_ATTRIBUTES,
  FunctionalAttributeConfig,
  getDepartmentFunctionalTags
} from '../services/db';
import { exportToExcel } from '../services/excel';

// --- Type Definitions ---`;

if (oldImportPattern.test(content)) {
  content = content.replace(oldImportPattern, newImports);
  console.log('[1/5] Successfully updated imports and Department interface.');
} else {
  console.error('[1/5] Failed to match oldImportPattern');
}

// 2. Add handleToggleDeptFunctionalTag and update handleAddDept
const oldAddDeptPattern = /const handleAddDept = \(\) => \{[\s\S]*?updatedAt: nowIso\s*\}\s*;\s*setDepartments\(\[\.\.\.departments, newDept\]\);/;

const newAddDept = `const handleToggleDeptFunctionalTag = (deptId: string, attrId: string) => {
    if (!canEdit) return;
    setDepartments(prev => prev.map(d => {
      if (d.id !== deptId) return d;
      const currentTags = getDepartmentFunctionalTags(d);
      const exists = currentTags.includes(attrId);
      const nextTags = exists ? currentTags.filter(t => t !== attrId) : [...currentTags, attrId];
      return {
        ...d,
        functional_tags: nextTags,
        functionalTags: nextTags,
        updatedAt: new Date().toISOString()
      };
    }));
  };

  const handleAddDept = () => {
    if (!canEdit) return;
    const nowIso = new Date().toISOString();
    const newDept: Department = {
      id: db.generateNextId('departments', departments),
      name: '',
      parentDepartmentId: selectedDeptId || null,
      functional_tags: [],
      functionalTags: [],
      createdAt: nowIso,
      updatedAt: nowIso
    };
    setDepartments([...departments, newDept]);`;

if (oldAddDeptPattern.test(content)) {
  content = content.replace(oldAddDeptPattern, newAddDept);
  console.log('[2/5] Successfully added handleToggleDeptFunctionalTag and updated handleAddDept.');
} else {
  console.error('[2/5] Failed to match oldAddDeptPattern');
}

// 3. Update handleSaveAll cleanDepts to preserve functional_tags
const oldCleanDeptsPattern = /const cleanDepts = departments\.map\(d => \{\s*const \{ modelName, supplier, \.\.\.rest \} = \(d as any\);\s*return rest as Department;\s*\}\);/;

const newCleanDepts = `const cleanDepts = departments.map(d => {
        const { modelName, supplier, ...rest } = (d as any);
        return {
          ...rest,
          functional_tags: d.functional_tags || d.functionalTags || [],
          functionalTags: d.functionalTags || d.functional_tags || []
        } as Department;
      });`;

if (oldCleanDeptsPattern.test(content)) {
  content = content.replace(oldCleanDeptsPattern, newCleanDepts);
  console.log('[3/5] Successfully updated cleanDepts in handleSaveAll.');
} else {
  console.error('[3/5] Failed to match oldCleanDeptsPattern');
}

// 4. Update renderDeptTree to render functional attribute badges
const oldDeptNameSpan = /<span style=\{\{\s*fontWeight: isSelected \? '600' : '400', flex: 1, color: dept\.name \? 'inherit' : 'var\(--text-muted\)'\s*\}\}>\s*\{dept\.name \|\| '새 부서\(명칭 미입력\)'\}\s*<\/span>\s*<span style=\{\{\s*fontSize: '11px', padding: '2px 6px'/;

const newDeptNameSpan = `<span style={{ fontWeight: isSelected ? '600' : '400', flex: 1, color: dept.name ? 'inherit' : 'var(--text-muted)' }}>
                      {dept.name || '새 부서(명칭 미입력)'}
                    </span>
                    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                      {getDepartmentFunctionalTags(dept).slice(0, 3).map(tagId => {
                        const attr = UNIVERSAL_FUNCTIONAL_ATTRIBUTES.find(a => a.id === tagId || a.code === tagId);
                        if (!attr) return null;
                        return (
                          <span
                            key={attr.id}
                            style={{
                              fontSize: '10px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: attr.badgeBg,
                              color: attr.badgeText,
                              border: \`1px solid \${attr.color}33\`,
                              whiteSpace: 'nowrap',
                              fontWeight: '600'
                            }}
                            title={attr.description}
                          >
                            {attr.label}
                          </span>
                        );
                      })}
                      {getDepartmentFunctionalTags(dept).length > 3 && (
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          +{getDepartmentFunctionalTags(dept).length - 3}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', padding: '2px 6px'`;

if (oldDeptNameSpan.test(content)) {
  content = content.replace(oldDeptNameSpan, newDeptNameSpan);
  console.log('[4/5] Successfully updated renderDeptTree with functional tags badges.');
} else {
  console.error('[4/5] Failed to match oldDeptNameSpan');
}

// 5. Add Universal Functional Attributes Card in Center Panel
const oldCenterHeader = /<div style=\{\{\s*display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var\(--border-color\)', paddingBottom: '12px'\s*\}\}>\s*<h3 style=\{\{\s*fontSize: '16px', fontWeight: '700'\s*\}\}>\s*\{activeTab === 'DEPT'[\s\S]*?<\/div>/;

const newCenterSection = `<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700' }}>
              {activeTab === 'DEPT' 
                ? \`\${departments.find(d => d.id === selectedDeptId)?.name || '선택된 부서'} 소속원 (\${displayedUsers.length}명)\`
                : \`미배정 대기 임직원 (\${displayedUsers.length}명)\`}
            </h3>
            {canEdit && (
              <button className="btn-secondary" onClick={handleAddUser} style={{ padding: '6px 12px', fontSize: '13px' }}>
                <Plus size={14} style={{ marginRight: '4px' }} /> 신규 직원 등록
              </button>
            )}
          </div>

          {/* 부서 보편 기능 속성 매핑 (Universal Functional Attributes) */}
          {activeTab === 'DEPT' && selectedDeptId && (() => {
            const currentSelectedDept = departments.find(d => d.id === selectedDeptId);
            if (!currentSelectedDept) return null;
            const currentDeptTags = getDepartmentFunctionalTags(currentSelectedDept);
            
            // 전사 미할당 기능 감지 (소규모 테넌트 전사 공유 ToDo 풀 대상)
            const allAssignedTags = new Set(
              departments.flatMap(d => getDepartmentFunctionalTags(d))
            );
            const unassignedCompanyAttributes = UNIVERSAL_FUNCTIONAL_ATTRIBUTES.filter(
              attr => !allAssignedTags.has(attr.id) && !allAssignedTags.has(attr.code)
            );

            return (
              <div style={{
                marginBottom: '16px',
                padding: '12px 14px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
                      보편 조직 기능 매핑 (Universal Attributes)
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      (복수 겸임 지원 • 직무별 ToDo 피드 자동 라우팅)
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    할당 기능: <strong>{currentDeptTags.length}개</strong>
                  </div>
                </div>

                {/* 9대 보편 기능 칩 버튼 목록 */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {UNIVERSAL_FUNCTIONAL_ATTRIBUTES.map(attr => {
                    const isAssigned = currentDeptTags.includes(attr.id) || currentDeptTags.includes(attr.code);
                    return (
                      <button
                        key={attr.id}
                        type="button"
                        disabled={!canEdit}
                        onClick={() => handleToggleDeptFunctionalTag(currentSelectedDept.id, attr.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: isAssigned ? '700' : '500',
                          backgroundColor: isAssigned ? attr.badgeBg : 'var(--bg-card)',
                          color: isAssigned ? attr.badgeText : 'var(--text-secondary)',
                          border: isAssigned ? \`1.5px solid \${attr.color}\` : '1px solid var(--border-color)',
                          cursor: canEdit ? 'pointer' : 'default',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap'
                        }}
                        title={\`\${attr.label}: \${attr.description}\`}
                      >
                        <span style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: isAssigned ? attr.color : 'var(--border-color)'
                        }} />
                        {attr.label}
                      </button>
                    );
                  })}
                </div>

                {/* 미할당 기능 공용 큐 안내 (소규모 테넌트 예외 처리) */}
                {unassignedCompanyAttributes.length > 0 && (
                  <div style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    paddingTop: '4px',
                    borderTop: '1px dashed var(--border-color)'
                  }}>
                    <span>💡 전사 미할당 기능: {unassignedCompanyAttributes.map(a => a.label).join(', ')}</span>
                    <span style={{ color: 'var(--primary)' }}>(전사 공용 공유 ToDo 풀로 자동 개방됨)</span>
                  </div>
                )}
              </div>
            );
          })()}`;

if (oldCenterHeader.test(content)) {
  content = content.replace(oldCenterHeader, newCenterSection);
  console.log('[5/5] Successfully added Universal Functional Attributes Card to center panel.');
} else {
  console.error('[5/5] Failed to match oldCenterHeader');
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Update script completed.');
