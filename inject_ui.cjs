const { Project, SyntaxKind } = require("ts-morph");
const fs = require("fs");
const path = require("path");

const plan = JSON.parse(fs.readFileSync("D:/01.AntiGravity/eBro/hindsight-plan.json", "utf-8"));
const targetFiles = process.argv.slice(2);

const project = new Project({
  tsConfigFilePath: "D:/01.AntiGravity/eBro/tsconfig.json",
  skipAddingFilesFromTsConfig: true
});

function getTriggerNameEng(triggerText) {
  const t = triggerText.toLowerCase();
  if (t === "approve") return ["approve", "승인", "결재"];
  if (t === "save") return ["save", "저장"];
  if (t === "delete") return ["delete", "삭제"];
  if (t === "register") return ["register", "등록", "신규"];
  if (t === "process") return ["process", "처리", "마감"];
  if (t === "apply") return ["apply", "적용"];
  if (t === "confirm") return ["confirm", "확인", "확정"];
  return [triggerText];
}

for (const f of plan) {
  if (targetFiles.length > 0 && !targetFiles.includes(f.file)) continue;

  const fullPath = path.join("D:/01.AntiGravity/eBro/src/pages", f.file);
  // Also check if it's in a subfolder like /src/components or just recursively find it
  // We'll just search for it using a fast glob or assume it's in src/pages or src/**/
  // But wait, the easiest way is to add it to project by searching src dir.
}
