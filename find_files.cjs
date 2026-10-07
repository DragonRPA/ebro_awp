const fs = require("fs");
const path = require("path");

const plan = JSON.parse(fs.readFileSync("D:/01.AntiGravity/eBro/hindsight-plan.json", "utf-8"));
const srcDir = "D:/01.AntiGravity/eBro/src";

function findFile(dir, name) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      const res = findFile(fullPath, name);
      if (res) return res;
    } else if (item === name) {
      return fullPath;
    }
  }
  return null;
}

for (const f of plan) {
  const resolved = findFile(srcDir, f.file);
  if (resolved) {
    f.fullPath = resolved;
  } else {
    console.log("NOT FOUND:", f.file);
  }
}

fs.writeFileSync("D:/01.AntiGravity/eBro/hindsight-plan-resolved.json", JSON.stringify(plan, null, 2));
console.log("Resolved paths saved.");
