'use strict';
/* =====================================================================
   check-files.js — 굽기 전에 **포장 목록이 빠짐없는지** 본다 (2026.09.01)

   `package.json` 의 `build.files` 는 **화이트리스트**다. 새 모듈을 만들고 여기에
   적는 것을 잊으면, 개발 중에는 멀쩡하고 **구운 뒤에만** 죽는다 —
   실행하자마자 `Cannot find module './stats'` 대화상자가 뜨고 앱이 아예 안 뜬다.
   ⚠️ 2026.09.01 에 `stats.js` 로 실제로 그랬다. 3분을 들여 구운 뒤에야 알았고,
      점검 모드가 「느린 것」처럼 보여 원인을 한참 헤맸다(대화상자가 클릭을 기다리고 있었다).

   그래서 `npm run dist` 앞에 이것을 세워 둔다(`predist`). 빠진 것이 있으면 **굽지 않는다.**
   ⛔ 이 검사를 건너뛰지 마라. 여기서 1초에 잡을 것을 놓치면 현장에서 앱이 안 뜬다.
   ===================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const files = (pkg.build && pkg.build.files) || [];

/* `files` 항목이 이 파일을 덮는가. `app/**` 같은 글로브도 대충 받아 준다. */
function covered(rel) {
  const p = rel.replace(/\\/g, '/');
  return files.some((pat) => {
    const g = String(pat).replace(/\\/g, '/');
    if (g === p) return true;
    const re = new RegExp('^' + g.replace(/[.+^${}()|[\]]/g, '\\$&')
      .replace(/\*\*\/\*/g, '.*').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
    return re.test(p);
  });
}

/* 시작점에서 `require('./…')` 를 따라가며 실제로 쓰이는 우리 파일을 모은다.
   ⛔ `node_modules` 는 electron-builder 가 알아서 담으므로 보지 않는다. */
const seen = new Set();
const missing = [];
function walk(rel) {
  if (seen.has(rel)) return;
  seen.add(rel);
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { missing.push(rel + '  ← 파일이 없다'); return; }
  if (!covered(rel)) missing.push(rel + '  ← package.json 의 build.files 에 없다');
  const src = fs.readFileSync(abs, 'utf8');
  const re = /require\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    let next = path.posix.join(path.posix.dirname(rel.replace(/\\/g, '/')), m[1]);
    if (!/\.[a-z]+$/i.test(next)) next += '.js';
    walk(next);
  }
}

// 시작점 — 메인 프로세스와 preload 들. 여기서 뻗어 나가는 것이 모두 포장돼야 한다.
['main.js', 'preload.js', 'admin/pin-preload.js', 'admin/settings-preload.js'].forEach(walk);

if (missing.length) {
  console.error('⛔ 포장 목록에서 빠진 파일이 있습니다 — 구우면 앱이 뜨지 않습니다.\n');
  missing.forEach((m) => console.error('   ' + m));
  console.error('\n   kiosk-app/package.json 의 "build" → "files" 에 더하고 다시 시도하세요.');
  process.exit(1);
}
console.log('✓ 포장 목록 확인 — 따라간 파일 ' + seen.size + '개가 모두 담깁니다');
