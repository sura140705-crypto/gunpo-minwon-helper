// 군포시 민원 서식 작성 도우미 — 키오스크(Electron) 메인 프로세스
// 전체화면 키오스크로 로컬 index.html 실행. 인터넷·외부 통신 없음.
//
// 2026.08 보안성 검토 반영 — 이 파일이 지키는 다섯 가지
//   1. 인쇄는 **지정된 실물 프린터로만**, 대화상자 없이. 보호 장치가 안 걸리면 **인쇄를 막는다**.
//   2. 렌더러는 sandbox·devTools 차단. 승인된 내부 화면 밖으로 나갈 수 없다.
//   3. 중복 실행 금지. 종료는 관리자 PIN 을 거쳐야 한다.
//   4. 개인정보를 디스크에 남기지 않는다 — 저장소·크래시덤프를 임시 경로에 두고 지운다.
//   5. `--selfcheck` 로 위 상태를 파일에 찍어 **근거로 제출**할 수 있다.
//
// ⚠️ 설정은 `kiosk.json` 에서 읽는다. 찾는 순서는 아래 configDir() 주석 참조 —
//    하드보안관이 걸린 PC 를 위해 **보존 영역을 먼저** 본다.
//    프린터가 지정돼 있지 않으면 **인쇄를 하지 않는다.** 기본 프린터로 흘려보내면
//    그것이 가상 프린터일 때 개인정보가 파일로 남기 때문이다.
const { app, BrowserWindow, Menu, session, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const printOptions = require('./print-options');
const { Stats } = require('./stats');

/* 운영 통계 — 서식별 접속·인쇄, 유휴 접근·중도 이탈, 가동시간.
   ⛔ 개인정보는 담지 않는다(화면 이름·시간대·횟수뿐). `stats.js` 머리말 참조.
   ⚠️ 설정과 **같은 폴더**를 쓴다 — 보존 드라이브를 쓰면 통계도 함께 살아남고,
      안 쓰면 하드보안관에 재부팅마다 함께 사라진다. */
const stats = new Stats(() => configDir());

const SELFCHECK = process.argv.includes('--selfcheck');
/* `--stats` — 운영 통계를 사람이 읽는 글로 내려놓는다(점검결과와 같은 자리).
   ⚠️ 점검 모드와 마찬가지로 **창을 띄우지 않는다** — 운영 중에도 볼 수 있어야 한다. */
const STATSMODE = process.argv.includes('--stats');

/* ── 설정 ────────────────────────────────────────────────────────────── */

const FOLDER = '군포민원서식도우미';
const PROGRAMDATA_DIR = path.join(process.env.ProgramData || os.tmpdir(), FOLDER);

/* ── 설정 파일을 어디서 찾는가 (2026.08.13) ──────────────────────────────
   현장 PC 에는 **하드보안관**이 걸려 있다. C: 는 재부팅마다 원복되므로
   `%ProgramData%` 에 저장한 설정은 다음 부팅에 사라진다. 그러면 **지정 프린터가
   비어 인쇄가 전면 차단된다**(지정이 없으면 안 찍는 것이 설계다). 설정 편의가 아니라
   운영 중단 문제다.

   그래서 **보존 영역을 먼저 본다.** 관리자가 원복되지 않는 드라이브에
   `군포민원서식도우미` 폴더를 만들어 두기만 하면, 앱이 그것을 찾아 그곳에 저장한다.
   폴더가 없으면 종전대로 `%ProgramData%` 를 쓴다 — 하드보안관이 없는 PC 는 그대로다.

     ① 환경변수 `GUNPO_KIOSK_CONFIG` 에 적힌 파일 (경로를 직접 못박고 싶을 때)
     ② D:~H: 중 `<드라이브>:\군포민원서식도우미\` 폴더가 **있는** 첫 드라이브
     ③ %ProgramData%\군포민원서식도우미\   (기본)

   ⚠️ 드라이브 훑기는 **폴더 존재 확인만** 한다(`existsSync`). 없는 드라이브·빈 이동식
      드라이브에서 조용히 false 를 돌려주므로 대화상자가 뜨지 않는다.
   ⚠️ 폴더를 만들어 두는 것이 곧 '여기에 저장하라'는 지시다. 파일이 아직 없어도 된다.
      어느 경로를 쓰고 있는지는 `--selfcheck` 와 환경설정 창에 그대로 찍힌다. */
const PRESERVE_DRIVES = 'DEFGH';

function configDir() {
  const env = process.env.GUNPO_KIOSK_CONFIG;
  if (env) { try { return path.dirname(env); } catch (e) { /* 무시하고 아래로 */ } }
  for (const L of PRESERVE_DRIVES) {
    const dir = L + ':\\' + FOLDER;
    try { if (fs.existsSync(dir)) return dir; } catch (e) { /* 접근 불가는 없는 셈 친다 */ }
  }
  return PROGRAMDATA_DIR;
}

function configPath() {
  const env = process.env.GUNPO_KIOSK_CONFIG;
  if (env) return env;
  return path.join(configDir(), 'kiosk.json');
}

/* 이 경로가 재부팅에 살아남는가 — %ProgramData%(C:) 면 하드보안관에 원복된다. */
function configIsPreserved() {
  return path.resolve(configDir()).toLowerCase() !== path.resolve(PROGRAMDATA_DIR).toLowerCase();
}
const JOB_TIMEOUT_SEC = 60;          // 이 시간이 지나도 남아 있는 인쇄 작업은 회수한다
const PRINT_ERROR_MS = 6000;         // 인쇄 실패 안내를 보여 주는 시간

/* 화면 쪽 기본값 — 환경설정 창에서 바꾸며, 서식 HTML 이 이 값을 읽어 쓴다.
   ⚠️ 서식 HTML 의 기본값과 **같은 수**여야 한다(웹 배포본은 설정이 없어 그쪽 기본값을 쓴다). */
const DEFAULT_IDLE_MS = 3 * 60 * 1000;   // 무동작 초기화
const DEFAULT_PRINTED_MS = 5000;         // 인쇄 후 처음 화면으로

function loadConfig() {
  // BOM 을 떼고 읽는다 — PowerShell 로 저장하면 BOM 이 붙기 쉽고, 붙으면 JSON.parse 가 실패한다.
  try { return JSON.parse(fs.readFileSync(configPath(), 'utf8').replace(/^﻿/, '')); }
  catch (e) { return {}; }
}

/* 설정 저장 — 환경설정 창만 쓴다.
   ⚠️ **BOM 없이** 쓴다. BOM 이 붙으면 loadConfig 의 JSON.parse 가 실패해 설정 전체가
      무시되고, 프린터 지정까지 같이 날아가 인쇄가 멈춘다. Node 의 'utf8' 은 BOM 을 붙이지 않는다.
   ⚠️ 모르는 키(exitPinHash 등)는 **그대로 보존**한다 — 창이 다루지 않는 값을 지우면 안 된다. */
function saveConfig(patch) {
  const next = Object.assign(loadConfig(), patch);
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2) + '\n', 'utf8');
  return next;
}

/* ── 기관별 설정 (2026.08.19 확산 대응) ─────────────────────────────────
   같은 설치본을 다른 기관이 그대로 쓰게 하려고, 코드에 박혀 있던 기관 고유값을
   **환경설정 창에서 바꿀 수 있게** 뺐다. 값은 `kiosk.json` 에 함께 저장된다.

   ⛔ **인쇄물에 영향이 가는 값은 여기에 넣지 마라.** 기관명·로고·색상은 `.topbar` 안에
      있거나 화면 전용 CSS 라서 인쇄 CSS 가 전부 숨긴다 → `verify-print.py` 기준선이
      흔들리지 않는다. 이 경계를 깨는 값을 추가하면 그 순간 안전망이 무너진다.
   ⚠️ **빈 값은 '서식의 기본값을 쓴다'는 뜻이다.** 기본값을 여기에 또 적지 않는다 —
      두 벌이 되면 갈라진다. 웹(GitHub Pages) 배포본에는 preload 가 없어 설정 자체가
      없고, 그때도 서식이 자기 기본값으로 멀쩡히 동작해야 한다.

   ORG_KEYS  기관 표기. 서식 HTML 의 `ORG_CONFIG` 를 같은 이름으로 덮는다.
   POLICY_KEYS 여권 업무 정책. 기관마다 접수 기준이 달라 창구 전환 여부가 갈린다.
   FORM_KEYS 취급 서식. 여권은 시·군·구청만 취급하는 식으로 기관마다 다르다. */
const ORG_KEYS = ['orgName', 'officeName', 'windowName', 'phone', 'address', 'notice'];
const POLICY_KEYS = [
  'allowProxy',        // 대리 신청을 키오스크에서 끝까지 받는가 (false → 창구 전환)
  'allowRomanBlank',   // 기존 여권이 있을 때 로마자 칸을 비워 접수하는가
  'minorPeriodFixed',  // 미성년 유효기간을 5년으로 고정하는가 (false → 물어본다)
  'requireEmergency',  // 긴급연락처를 필수로 받는가
  'showCounterCode',   // 창구 전환 화면에 사유 코드(P-01…)를 띄우는가
];
const FORM_KEYS = ['passport', 'marriage', 'birth', 'death', 'naming', 'divorce', 'cert', 'realestate'];

/* 로고는 설정 폴더(보존 영역)의 `logo.png` 를 쓴다. 파일이 없으면 서식에 박힌
   기본 로고가 그대로 나온다. 페이지마다 다시 읽지 않도록 캐시한다 —
   `pageConfig()` 는 **sendSync** 로 불려서 페이지 로드를 붙잡고 있다. */
const LOGO_MAX_BYTES = 512 * 1024;
let logoCache = null;                 // { mtimeMs, size, uri } | { missing:true }
function logoDataUri() {
  const p = path.join(configDir(), 'logo.png');
  let st = null;
  try { st = fs.statSync(p); } catch (e) { logoCache = null; return ''; }
  if (st.size > LOGO_MAX_BYTES) return '';          // 너무 크면 무시 — 창에서 미리 막는다
  if (logoCache && logoCache.mtimeMs === st.mtimeMs && logoCache.size === st.size) return logoCache.uri;
  try {
    const uri = 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
    logoCache = { mtimeMs: st.mtimeMs, size: st.size, uri };
    return uri;
  } catch (e) { return ''; }
}

/* 대표색 — `#rrggbb` 만 받는다. 명암·그라데이션은 서식 쪽에서 이 한 색에서 만든다
   (같은 규칙을 두 곳에 두지 않으려고 계산을 화면 쪽에 몰아 뒀다). */
function normHex(v) {
  const s = String(v || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : '';
}

/* 서식 HTML 에 넘기는 값. preload 가 페이지 스크립트보다 **먼저** 이것을 창에 심는다.
   (나중에 넣으면 늦다 — 서식은 로드 시점에 타이머를 걸어 버린다) */
function pageConfig() {
  const cfg = loadConfig();
  const num = (v, d) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : d);

  const org = {};
  for (const k of ORG_KEYS) {
    const v = String((cfg.org && cfg.org[k]) || '').trim();
    if (v) org[k] = v;                    // 빈 값은 넘기지 않는다 = 서식 기본값 유지
  }
  const policy = {};
  for (const k of POLICY_KEYS) {
    if (cfg.policy && typeof cfg.policy[k] === 'boolean') policy[k] = cfg.policy[k];
  }
  const forms = {};
  for (const k of FORM_KEYS) {
    if (cfg.forms && cfg.forms[k] === false) forms[k] = false;   // 끈 것만 넘긴다
  }

  return {
    idleMs: num(cfg.idleMs, DEFAULT_IDLE_MS),
    printedMs: num(cfg.printedMs, DEFAULT_PRINTED_MS),
    formLeft: cfg.formLeft === true,
    org,
    themeColor: normHex(cfg.themeColor),
    logo: logoDataUri(),
    forms,
    policy,
    hasKeyboard: cfg.hasKeyboard !== false,   // 기본은 '키보드 있음'(현재 현장 구성)
  };
}

/* 파일로 저장하는 프린터 판별 — `kiosk-privacy.ps1` 의 목록과 같은 것을 쓴다.
   ⛔ DriverName 에 'PDF' 매칭은 하지 않는다(실물 프린터 드라이버명에 PDF가 들어갈 수 있다). */
const VIRTUAL_NAME_RE = /Print to PDF|XPS Document Writer|OneNote|Hancom|Adobe PDF|CutePDF|doPDF|Bullzip|PDF24|Foxit|PrimoPDF|Nitro|PDFCreator|Fax|팩스/i;
const VIRTUAL_PORT_RE = /^(PORTPROMPT:|SHRFAX:|nul:?)$/i;

/* ── 개인정보: 저장소를 임시 경로로 옮긴다 ───────────────────────────────
   기본 경로(%APPDATA%)에 두면 강제 종료 시 캐시·크래시덤프가 그대로 남는다.
   경로를 **고정**해 두는 이유는 중복 실행 잠금(lock)이 userData 안에 만들어지기 때문이다 —
   실행마다 다른 경로를 쓰면 잠금이 동작하지 않는다. 대신 시작·종료 때마다 비운다. */
const RUNTIME_DIR = path.join(os.tmpdir(), 'gunpo-minwon-kiosk');
app.setPath('userData', RUNTIME_DIR);
app.setPath('sessionData', RUNTIME_DIR);
app.setPath('crashDumps', path.join(RUNTIME_DIR, 'crash'));
app.commandLine.appendSwitch('disable-logging');   // 로그 파일을 만들지 않는다

let win = null;
let adminMode = false;    // PIN 창이 떠 있는 동안 이탈 감지를 멈춘다
let allowQuit = false;    // 관리자 확인을 거친 종료만 허용
let printHookOk = false;  // 인쇄 보호 장치가 실제로 걸렸는지

/* ── 인쇄 보호 장치 ──────────────────────────────────────────────────────
   서식 HTML 의 window.print 를 대화상자 없는 인쇄로 바꿔 끼운다(메인 월드에 주입).
   HTML 8종은 인쇄 후 afterprint 로 화면을 가리고 첫 화면으로 돌아가므로,
   인쇄가 끝나면 그 이벤트를 직접 발생시켜야 개인정보 초기화가 유지된다.
   실패해도 발생시킨다 — 화면에 개인정보를 남겨 두는 쪽이 더 위험하다.

   ⚠️ `__kioskPrint` 가 없으면 **아무 일도 하지 않는다**(fail-closed).
      예전에는 이 경우 원래의 window.print 가 그대로 남아 네이티브 인쇄 대화상자가 열렸고,
      거기서 'Hancom PDF' 같은 가상 프린터를 고를 수 있었다(2026.08 보안성 검토 지적). */
const PRINT_HOOK = `(function(){
  if (window.__kioskPrintHooked) return true;
  window.__kioskPrintHooked = true;
  window.print = function(){
    if (!window.__kioskPrint) return;            // 보호 장치 없음 → 인쇄하지 않는다
    window.__kioskPrint().catch(function(){}).then(function(){
      window.dispatchEvent(new Event('afterprint'));
    });
  };
  return !!window.__kioskPrint;
})();`;

/* ── PowerShell 도우미 ───────────────────────────────────────────────────
   프린터 상태와 대기열은 Electron API 로 다룰 수 없어 PowerShell 을 쓴다.
   한글 프린터 이름이 깨지지 않도록 출력 인코딩을 UTF-8 로 강제한다(콘솔 기본은 cp949). */
function ps(script) {
  return new Promise((resolve) => {
    execFile('powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
       '[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; ' + script],
      { windowsHide: true, timeout: 15000, maxBuffer: 1 << 20 },
      (err, stdout) => resolve(err ? null : String(stdout).trim()));
  });
}
const psQuote = (s) => "'" + String(s).replace(/'/g, "''") + "'";

async function printerInfo(name) {
  const out = await ps(
    '$p = Get-Printer -Name ' + psQuote(name) + ' -ErrorAction SilentlyContinue; ' +
    'if ($p) { [pscustomobject]@{ name=$p.Name; status=$p.PrinterStatus.ToString(); ' +
    'port=$p.PortName; keep=[bool]$p.KeepPrintedJobs; ' +
    'jobs=@(Get-PrintJob -PrinterName $p.Name -ErrorAction SilentlyContinue).Count } | ConvertTo-Json -Compress }');
  try { return out ? JSON.parse(out) : null; } catch (e) { return null; }
}

/* 인쇄 작업이 대기열에 남는 것은 곧 개인정보가 스풀 파일로 남는 것이다.
   프린터가 멈춰 있거나 정체되면 일정 시간 뒤 해당 작업을 지운다. */
async function sweepJobs(name, olderThanSec) {
  const age = Number(olderThanSec) || 0;
  await ps('Get-PrintJob -PrinterName ' + psQuote(name) + ' -ErrorAction SilentlyContinue | ' +
           'Where-Object { $_.SubmittedTime -lt (Get-Date).AddSeconds(-' + age + ') } | ' +
           'Remove-PrintJob -ErrorAction SilentlyContinue');
}

/* ── 인쇄 대상 결정 ──────────────────────────────────────────────────────
   지정된 프린터가 있어야만, 그리고 그것이 실물이고 준비 상태여야만 인쇄한다. */
async function resolvePrinter(contents) {
  const name = loadConfig().printerDeviceName;
  if (!name) return { ok: false, reason: '프린터가 지정되지 않았습니다 (관리자 설정 필요)' };

  const list = await contents.getPrintersAsync();
  const found = list.find((p) => p.name === name);
  if (!found) return { ok: false, reason: '지정된 프린터를 찾을 수 없습니다 : ' + name };
  if (VIRTUAL_NAME_RE.test(found.name)) {
    return { ok: false, reason: '파일로 저장하는 프린터는 사용할 수 없습니다 : ' + name };
  }

  // 상태·포트는 PowerShell 로 확인한다. 확인 자체가 실패하면(정책 등) 인쇄는 진행하되 기록을 남긴다.
  const info = await printerInfo(name);
  if (info) {
    if (VIRTUAL_PORT_RE.test(info.port || '')) {
      return { ok: false, reason: '파일로 저장하는 포트입니다 : ' + info.port };
    }
    if (info.status && info.status !== 'Normal') {
      return { ok: false, reason: '프린터가 준비되지 않았습니다 : ' + statusText(info.status) };
    }
  } else {
    console.error('[키오스크] 프린터 상태를 확인하지 못했습니다(PowerShell).');
  }
  return { ok: true, name: name };
}

function statusText(s) {
  const t = {
    Paused: '일시중지됨', Error: '오류', PaperJam: '용지 걸림', PaperOut: '용지 없음',
    PaperProblem: '용지 문제', Offline: '오프라인', OutputBinFull: '출력함 가득참',
    NotAvailable: '사용할 수 없음', NoToner: '토너 없음', DoorOpen: '덮개 열림',
    UserInterventionRequired: '조작 필요', OutOfMemory: '메모리 부족',
    PendingDeletion: '삭제 대기', ServerUnknown: '서버 확인 불가',
  };
  return (t[s] || s) + ' (' + s + ')';
}

/* 서식 HTML 이 쓰는 값(무동작 시간·인쇄 후 대기)을 페이지 스크립트보다 **먼저** 넘긴다.
   preload 가 `sendSync` 로 받아 `window.__kioskCfg` 에 심는다 — 비동기로 넘기면
   서식이 이미 기본값으로 타이머를 걸어 버린 뒤라 늦다.
   개인정보는 담기지 않는다(시간 값과 배치 여부뿐). */
ipcMain.on('kiosk:cfg', (event) => { event.returnValue = pageConfig(); });

/* 화면이 알려 주는 통계 사건 — 유휴 시연이 사람 손에 멈춤(`wake`),
   무동작으로 초기화됨(`idle`). ⛔ **이름 말고는 아무것도 받지 않는다.** */
ipcMain.on('kiosk:stat', (event, name) => {
  try {
    if (name === 'wake') stats.wake();
    else if (name === 'idle') stats.idleReset();
  } catch (e) { /* 통계는 운영을 막지 않는다 */ }
});

/* ── 인쇄 ────────────────────────────────────────────────────────────── */

ipcMain.handle('kiosk:print', async (event) => {
  const target = await resolvePrinter(event.sender);
  if (!target.ok) {
    console.error('[키오스크] 인쇄 거부:', target.reason);
    try { stats.printed(event.sender.getURL(), false); } catch (e) { /* 무시 */ }
    showPrintError(target.reason);
    return { ok: false };
  }

  const ok = await new Promise((resolve) => {
    // 조판 옵션(용지·여백·배율)은 `print-options.js` 에 있다 — 검증 도구와 같은 값을 쓴다.
    event.sender.print(Object.assign({
      silent: true,                      // 대화상자 없음 → 'PDF로 저장' 목적지가 아예 없다
      deviceName: target.name,           // 지정된 실물 프린터로만
    }, printOptions.forPrint()), (done, reason) => {
      if (!done) console.error('[키오스크] 인쇄 실패:', reason);
      resolve(done);
    });
  });

  // ⛔ 세는 것은 **성공 여부와 어느 서식이었나**뿐이다. 인쇄 내용은 건드리지 않는다.
  try { stats.printed(event.sender.getURL(), ok); } catch (e) { /* 통계는 운영을 막지 않는다 */ }

  // 성공이든 실패든, 대기열에 남은 작업은 개인정보다. 일정 시간 뒤 회수한다.
  setTimeout(() => { sweepJobs(target.name, JOB_TIMEOUT_SEC); }, (JOB_TIMEOUT_SEC + 5) * 1000);
  if (!ok) showPrintError('프린터로 보내지 못했습니다');
  return { ok: ok };
});

/* 인쇄가 안 됐다는 사실을 시민에게 알린 뒤 첫 화면으로 돌린다.
   안내 화면은 서식 파일이 아니라 `admin/` 에 둔다 — 배포 동기화 대상(app/)을 건드리지 않기 위해서다. */
function showPrintError(reason) {
  if (!win || win.isDestroyed()) return;
  win.loadFile(path.join(__dirname, 'admin', 'print-error.html'),
               { query: { reason: String(reason || '') } });
  setTimeout(() => {
    if (win && !win.isDestroyed()) win.loadFile(path.join(__dirname, 'app', 'index.html'));
  }, PRINT_ERROR_MS);
}

/* ── 창 ──────────────────────────────────────────────────────────────── */

const APP_DIR = path.join(__dirname, 'app');
const ADMIN_DIR = path.join(__dirname, 'admin');

/* 승인된 내부 화면인지 — app/ 과 admin/ 안의 파일만 허용한다. */
function isAllowedUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'file:') return false;
    const p = path.normalize(decodeURIComponent(u.pathname).replace(/^\//, ''));
    return p.startsWith(APP_DIR) || p.startsWith(ADMIN_DIR);
  } catch (e) { return false; }
}

/* 설치본은 실행파일에 아이콘이 박혀 있어 창이 그것을 물려받는다(build/icon.ico 는 포장에 안 들어감).
   `npm start` 로 개발 실행할 때만 아이콘 파일을 직접 지정한다. */
const DEV_ICON = app.isPackaged ? undefined : path.join(__dirname, 'build', 'icon.ico');

function baseWebPreferences() {
  return {
    contextIsolation: true,
    nodeIntegration: false,   // 렌더러에서 Node 접근 차단
    sandbox: true,            // 렌더러 샌드박스 — 기본값이지만 검토 대상이라 명시한다
    devTools: false,          // 개발자도구 자체를 만들지 않는다(단축키 차단에만 의존하지 않는다)
    webviewTag: false,
    spellcheck: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
  };
}

function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    kiosk: true,               // 키오스크 잠금(전체화면·창 조작 제한)
    autoHideMenuBar: true,
    backgroundColor: '#eef2f7',
    icon: DEV_ICON,
    webPreferences: Object.assign(baseWebPreferences(), {
      preload: path.join(__dirname, 'preload.js'),
    }),
  });

  /* 서식별 접속수 — 허브가 `href` 로 서식 HTML 을 여는 **같은 창 이동**이라
     여기 한 곳에서 8종을 전부 본다. ⛔ 서식 HTML 은 건드리지 않는다. */
  win.webContents.on('did-navigate', (e, url) => {
    try { stats.visit(url); } catch (err) { /* 통계는 운영을 막지 않는다 */ }
  });

  Menu.setApplicationMenu(null); // 상단 메뉴 제거
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(APP_DIR, 'index.html'));

  // 외부 링크·새 창 차단(키오스크에서 밖으로 못 나가게)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // 승인된 내부 화면 외 이동 차단
  win.webContents.on('will-navigate', (e, url) => {
    if (!isAllowedUrl(url)) { e.preventDefault(); console.error('[키오스크] 이동 차단:', url); }
  });

  // 서식을 옮겨 다녀도(첫 화면 ↔ 각 서식) 매번 다시 걸어 준다.
  // 안내 화면(admin/)에서는 건너뛴다 — 실패 안내 화면이 다시 실패를 알리는 고리를 만들지 않기 위해서다.
  win.webContents.on('did-finish-load', () => {
    const url = String(win.webContents.getURL());
    if (url.includes('/admin/')) return;
    win.webContents.executeJavaScript(PRINT_HOOK)
      .then((hooked) => {
        printHookOk = !!hooked;
        if (!hooked) fatal('인쇄 보호 기능을 적용하지 못했습니다.');
      })
      .catch(() => { printHookOk = false; fatal('인쇄 보호 기능을 적용하지 못했습니다.'); });

    // 인쇄 보정 — 둘 다 서식 HTML 은 건드리지 않고, 키오스크 인쇄에만 걸린다.
    //   겹쳐 찍기   미리 인쇄된 서식 용지에 값만 얹는다   (overlayPrintForms)
    //   드롭아웃    빨간 칸선을 인쇄 단계에서 걸러낸다     (monoDropoutForms)
    // 겹쳐 찍기가 우선이다 — 배경을 통째로 숨기므로 필터를 걸 대상이 없다.
    // 화면 좌우 배치 — 서식이 쓰는 `body.form-left` 를 그대로 건다.
    // 2026.08.15 부터 화면에는 「↔ 좌우 바꾸기」 버튼이 없다 — 배치를 정하는 곳은 여기뿐이다.
    if (pageConfig().formLeft) {
      win.webContents.executeJavaScript('document.body.classList.add("form-left");1')
        .catch(() => {});
    }

    const printCfg = loadConfig();
    if (printOptions.isOverlayForm(printCfg, url)) {
      win.webContents.insertCSS(printOptions.OVERLAY_PRINT_CSS)
        .catch((e) => console.error('[키오스크] 겹쳐 찍기 CSS 적용 실패:', e && e.message));
    } else if (printOptions.isDropoutForm(printCfg, url)) {
      win.webContents.insertCSS(printOptions.MONO_DROPOUT_CSS)
        .catch((e) => console.error('[키오스크] 드롭아웃 CSS 적용 실패:', e && e.message));
    }
  });

  // 시민이 화면을 벗어나면(Alt+Tab 등) 입력 내용을 남겨 두지 않는다.
  // Alt+Tab·Windows 키 자체는 앱이 막을 수 없다 — 이탈은 OS 설정으로 막고, 여기서는 **잔존**을 막는다.
  //
  // ⚠️ 네이티브 대화상자가 떠 있을 때는 손대면 안 된다. 대화상자는 Win32 모달이라 부모 창을
  //    **비활성 상태(isEnabled=false)** 로 만드는데, 여기서 focus() 로 포커스만 되돌리면
  //    "포커스는 있는데 입력은 막힌" 상태가 되어 화면이 완전히 먹통이 된다.
  //    2026.08 포터블 시험에서 서식의 「초기화」(confirm) 로 실제 발생 — 서식 쪽은 페이지 안
  //    확인 창으로 바꿨고(engine.js `askConfirm`), 여기서는 원인 자체를 막아 둔다.
  win.on('blur', () => {
    if (adminMode || allowQuit || !win || win.isDestroyed()) return;
    if (!win.isEnabled()) return;                // 대화상자가 떠 있다 → 이탈이 아니다
    // 잠깐 사이의 포커스 이동은 이탈이 아니다. 조금 뒤에 다시 확인하고 초기화한다.
    setTimeout(() => {
      if (!win || win.isDestroyed() || adminMode || allowQuit) return;
      if (!win.isEnabled() || win.isFocused()) return;
      win.loadFile(path.join(APP_DIR, 'index.html'));
      win.show();
      win.focus();
    }, 300);
  });

  // Alt+F4·창 닫기는 관리자 확인을 거친 뒤에만
  win.on('close', (e) => { if (!allowQuit) e.preventDefault(); });
  win.on('closed', () => { win = null; });

  blockKeys(win.webContents);
  adminKeys(win.webContents);
  return win;
}

/* 직원용 단축키. 예전에는 globalShortcut(OS 전역)이라 다른 프로그램에도 걸렸다 — 창 안으로 한정한다.
   종료는 곧바로 되지 않고 관리자 PIN 을 거친다. */
function adminKeys(contents) {
  contents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta) || !input.shift) return;
    const k = String(input.key || '').toUpperCase();
    if (k === 'Q') { e.preventDefault(); askPinAndQuit(); }
    /* 터치 전용으로 설정한 자리에서는 환경설정도 PIN 뒤에 둔다 — 그런 자리에 나중에
       키보드를 꽂았을 때 시민이 설정을 열어 버리는 것을 막는다. PIN 이 없으면
       종전대로 그냥 열린다(잠글 수단만 만들고 열 수단을 없애지 않는다). */
    if (k === 'S') {
      e.preventDefault();
      if (loadConfig().hasKeyboard === false) askPin(openSettings);
      else openSettings();
    }
    if (k === 'H') {
      e.preventDefault();
      if (win && !win.isDestroyed()) win.loadFile(path.join(APP_DIR, 'index.html'));
    }
  });
}

/* ── 환경설정 창 (Ctrl+Shift+S) ──────────────────────────────────────────
   관리자가 kiosk.json 을 손으로 고치지 않게 하려고 만들었다. 손으로 고치면
   **BOM 하나에 설정 전체가 조용히 무시된다**(그러면 프린터 지정까지 날아가 인쇄가 멈춘다).

   ⚠️ PIN 을 묻지 않는다(2026.08.13 결정). 시민이 키보드를 만질 수 있는 자리라면
      OS 쪽에서 키보드를 막거나 PIN 을 설정하는 편이 안전하다. `--selfcheck` 가
      PIN 미설정을 계속 보고한다.
   ⚠️ 저장 후에는 **처음 화면으로 되돌린다.** 설정 일부(무동작 시간·좌우 배치)는
      서식이 로드될 때 preload 로 들어가므로, 보고 있던 화면에는 적용되지 않는다. */
function openSettings() {
  if (adminMode) return;
  if (!win || win.isDestroyed()) return;
  adminMode = true;

  const w = new BrowserWindow({
    parent: win, modal: true, show: false, frame: true, resizable: true,
    width: 720, height: 760, minWidth: 560, minHeight: 520,
    title: '환경설정', backgroundColor: '#f4f6f9', autoHideMenuBar: true,
    webPreferences: Object.assign(baseWebPreferences(), {
      preload: path.join(ADMIN_DIR, 'settings-preload.js'),
    }),
  });
  w.setMenu(null);
  w.loadFile(path.join(ADMIN_DIR, 'settings.html'));
  w.once('ready-to-show', () => w.show());
  w.on('closed', () => {
    adminMode = false;
    if (win && !win.isDestroyed()) win.focus();
  });

  ipcMain.removeHandler('settings:load');
  ipcMain.handle('settings:load', async () => {
    const cfg = loadConfig();
    const pc = pageConfig();
    const printers = await win.webContents.getPrintersAsync().catch(() => []);
    return {
      path: configPath(),
      exists: fs.existsSync(configPath()),
      preserved: configIsPreserved(),
      today: nowStamp(),      // 담당자가 창을 열 때마다 PC 날짜를 눈으로 확인하게 한다

      mode: printOptions.passportMode(cfg),
      printerDeviceName: cfg.printerDeviceName || '',
      idleMs: pc.idleMs,
      printedMs: pc.printedMs,
      formLeft: pc.formLeft,
      // 기관별 설정 — 저장된 값만 넘긴다. 비어 있으면 창이 빈칸으로 보여 주고,
      // 그 빈칸이 곧 '프로그램 기본값을 쓴다'는 뜻이다.
      org: pc.org,
      themeColor: pc.themeColor,
      logo: pc.logo,
      forms: cfg.forms || {},
      policy: cfg.policy || {},
      hasKeyboard: pc.hasKeyboard,
      printers: printers.map((p) => ({
        name: p.name, isDefault: !!p.isDefault, virtual: VIRTUAL_NAME_RE.test(p.name),
      })),
    };
  });

  /* 로고 PNG 고르기. 창은 경로를 다루지 않는다 — 대화상자를 여기서 열고 **내용만** 넘긴다.
     실제 복사는 [저장]을 눌렀을 때 한다(고르기만 하고 닫으면 아무것도 바뀌지 않아야 한다). */
  /* 운영 통계 — 환경설정 창의 「통계」 탭이 읽는다.
     ⛔ **읽기 전용이다.** 지우거나 고치는 통로를 만들지 마라 — 운영 기록이다.
     ⛔ 개인정보는 애초에 담기지 않는다(`stats.js` 머리말 참조). */
  ipcMain.removeHandler('settings:stats');
  ipcMain.handle('settings:stats', () => {
    try {
      stats.flush();                       // 지금까지 센 것을 파일에 반영한 뒤 읽는다
      return { lines: stats.summary(0), dir: stats.dir(), preserved: configIsPreserved() };
    } catch (e) {
      return { lines: ['통계를 읽지 못했습니다: ' + e.message], dir: '', preserved: true };
    }
  });

  /* 통계 폴더 열기 — CSV 원본을 집어 가려고. 탐색기가 키오스크 위로 열린다.
     ⛔ 여는 곳은 **통계 폴더 하나뿐**이다. 임의 경로를 화면에서 받지 않는다. */
  ipcMain.removeHandler('settings:openStats');
  ipcMain.handle('settings:openStats', async () => {
    try {
      const d = stats.dir();
      fs.mkdirSync(d, { recursive: true });
      await shell.openPath(d);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.removeHandler('settings:pickLogo');
  ipcMain.handle('settings:pickLogo', async () => {
    const r = await dialog.showOpenDialog(w, {
      title: '기관 로고 PNG 고르기',
      properties: ['openFile'],
      filters: [{ name: 'PNG 그림', extensions: ['png'] }],
    }).catch(() => null);
    if (!r || r.canceled || !r.filePaths || !r.filePaths.length) return null;
    try {
      const buf = fs.readFileSync(r.filePaths[0]);
      if (buf.length > LOGO_MAX_BYTES) {
        return { ok: false, error: '그림이 너무 큽니다(512KB 이하만 됩니다). 크기를 줄여 주세요.' };
      }
      // PNG 서명(‰PNG\r\n\x1a\n) 확인 — 확장자만 바꾼 파일을 걸러낸다.
      const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (buf.length < 8 || !buf.slice(0, 8).equals(sig)) {
        return { ok: false, error: 'PNG 그림이 아닙니다. 확장자만 바꾼 파일일 수 있습니다.' };
      }
      return { ok: true, uri: 'data:image/png;base64,' + buf.toString('base64') };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  ipcMain.removeHandler('settings:save');
  ipcMain.handle('settings:save', (e, v) => {
    try {
      v = v || {};
      const mode = printOptions.PRINT_MODES.includes(v.mode) ? v.mode : 'color';
      const name = String(v.printerDeviceName || '');
      // 가상 프린터는 저장 자체를 막는다 — 고르지 못하게 해 뒀지만 여기서 한 번 더 본다.
      if (name && VIRTUAL_NAME_RE.test(name)) {
        return { ok: false, error: '파일로 저장하는 프린터는 지정할 수 없습니다.' };
      }
      const num = (x, allowed, d) => (allowed.includes(Number(x)) ? Number(x) : d);

      /* 기관별 설정 — **아는 키만** 받아 넣는다. 창이 보내 준 것을 그대로 저장하면
         엉뚱한 키가 설정 파일에 쌓이고, 그것이 다음 판에서 뜻을 갖게 될 수 있다. */
      const org = {};
      for (const k of ORG_KEYS) org[k] = String((v.org && v.org[k]) || '').trim().slice(0, 120);
      const forms = {};
      for (const k of FORM_KEYS) forms[k] = !(v.forms && v.forms[k] === false);
      if (!FORM_KEYS.some((k) => forms[k])) {
        return { ok: false, error: '서식을 하나도 켜지 않으면 첫 화면이 비어 버립니다.' };
      }
      const policy = {};
      for (const k of POLICY_KEYS) if (v.policy && typeof v.policy[k] === 'boolean') policy[k] = v.policy[k];

      /* 로고 — 고른 그림을 설정 폴더에 `logo.png` 로 복사한다. 설정 폴더에 두는 이유는
         하드보안관이 걸린 PC 에서도 살아남는 자리이기 때문이다(설정 파일과 같은 곳). */
      const logoPath = path.join(configDir(), 'logo.png');
      if (v.logo === 'clear') {
        try { fs.unlinkSync(logoPath); } catch (err) { /* 없으면 그만 */ }
        logoCache = null;
      } else if (v.logo && typeof v.logo.uri === 'string') {
        const b64 = v.logo.uri.replace(/^data:image\/png;base64,/, '');
        const buf = Buffer.from(b64, 'base64');
        if (buf.length > LOGO_MAX_BYTES) return { ok: false, error: '로고 그림이 너무 큽니다.' };
        fs.mkdirSync(path.dirname(logoPath), { recursive: true });
        fs.writeFileSync(logoPath, buf);
        logoCache = null;
      }

      saveConfig(Object.assign(printOptions.applyPassportMode(loadConfig(), mode), {
        printerDeviceName: name,
        formLeft: v.formLeft === true,
        idleMs: num(v.idleMs, [60000, 180000, 300000, 600000], DEFAULT_IDLE_MS),
        printedMs: num(v.printedMs, [0, 1000, 3000, 5000, 10000], DEFAULT_PRINTED_MS),
        org,
        themeColor: normHex(v.themeColor),
        forms,
        policy,
        hasKeyboard: v.hasKeyboard !== false,
      }));
      // 바뀐 값이 실제로 걸리도록 처음 화면부터 다시 읽힌다.
      if (win && !win.isDestroyed()) win.loadFile(path.join(APP_DIR, 'index.html'));
      setTimeout(() => { if (!w.isDestroyed()) w.close(); }, 900);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  ipcMain.removeAllListeners('settings:close');
  ipcMain.on('settings:close', () => { if (!w.isDestroyed()) w.close(); });
}

/* 개발자도구·인쇄·창 닫기 단축키를 입력 단계에서 막는다.
   (메뉴를 없앴으므로 대부분 동작하지 않지만, 기본 설정에만 의존하지 말라는 검토 지적을 반영한다) */
function blockKeys(contents) {
  contents.on('before-input-event', (e, input) => {
    const k = String(input.key || '').toUpperCase();
    const ctrl = input.control || input.meta;
    const blocked =
      k === 'F12' ||
      (ctrl && input.shift && ['I', 'J', 'C'].includes(k)) ||   // 개발자도구
      (ctrl && k === 'P') ||                                     // 인쇄 대화상자
      (ctrl && ['W', 'N', 'T', 'R'].includes(k)) ||              // 창·새로고침
      (input.alt && k === 'F4');                                 // 종료
    if (blocked) e.preventDefault();
  });
}

/* 되돌릴 수 없는 상태 — 시민에게 안내만 남기고 입력은 받지 않는다. */
function fatal(message) {
  if (!win || win.isDestroyed()) return;
  win.loadFile(path.join(ADMIN_DIR, 'fatal.html'), { query: { message: String(message || '') } });
}

/* ── 관리자 종료 (PIN) ───────────────────────────────────────────────── */

const sha256 = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');

function askPinAndQuit() { askPin(quitNow); }

/* 관리자 PIN 을 묻고 맞으면 `onOk()` 를 실행한다. 종료(Ctrl+Shift+Q)와, 터치 전용으로
   설정한 자리의 환경설정(Ctrl+Shift+S)이 이것을 쓴다. */
function askPin(onOk) {
  if (adminMode) return;
  if (!win || win.isDestroyed()) { onOk(); return; }   // 물어볼 창이 없으면 매달리지 않는다
  const cfg = loadConfig();

  // PIN 이 설정돼 있지 않으면 막지 않는다 — 잠긴 키오스크를 열 수단이 없어지면
  // 복구가 불가능해지기 때문이다. 대신 `--selfcheck` 가 '미설정'으로 보고한다.
  if (!cfg.exitPinHash) { onOk(); return; }

  adminMode = true;
  let handedOff = false;      // PIN 이 맞아 다음 창으로 넘긴 뒤에는 adminMode 를 건드리지 않는다
  const pin = new BrowserWindow({
    parent: win, modal: true, show: false, frame: false, resizable: false,
    width: 420, height: 240, backgroundColor: '#ffffff',
    webPreferences: Object.assign(baseWebPreferences(), {
      preload: path.join(ADMIN_DIR, 'pin-preload.js'),
    }),
  });
  pin.loadFile(path.join(ADMIN_DIR, 'pin.html'));
  pin.once('ready-to-show', () => pin.show());
  pin.on('closed', () => {
    if (!handedOff) adminMode = false;
    if (!allowQuit && win && !win.isDestroyed()) win.focus();
  });

  ipcMain.removeHandler('admin:pin');
  ipcMain.handle('admin:pin', (e, value) => {
    const ok = sha256(value) === String(cfg.exitPinHash).toLowerCase();
    if (ok) {
      handedOff = true;
      adminMode = false;              // onOk 가 새 창을 열 수 있게 **먼저** 푼다
      if (!pin.isDestroyed()) pin.close();
      onOk();
    }
    return ok;
  });
  ipcMain.removeAllListeners('admin:cancel');
  ipcMain.on('admin:cancel', () => { if (!pin.isDestroyed()) pin.close(); });
}

function quitNow() {
  allowQuit = true;
  cleanup().then(() => app.quit());
}

/* ── 뒷정리 ──────────────────────────────────────────────────────────── */

async function cleanup() {
  try { stats.stop(); } catch (e) { /* 통계 때문에 종료가 막히면 안 된다 */ }
  try { await session.defaultSession.clearStorageData(); } catch (e) { /* 무시 */ }
  try { await session.defaultSession.clearCache(); } catch (e) { /* 무시 */ }
  const name = loadConfig().printerDeviceName;
  if (name) { try { await sweepJobs(name, 0); } catch (e) { /* 무시 */ } }
  try { fs.rmSync(path.join(RUNTIME_DIR, 'crash'), { recursive: true, force: true }); } catch (e) { /* 무시 */ }
}

/* ── 시각 점검 (2026.08.18) ──────────────────────────────────────────────
   서식의 신청일·동의일은 이 PC 의 시계를 그대로 읽어 찍는다(`APP_TODAY=new Date()`).
   시계가 멈춰 있으면 인쇄물의 날짜가 통째로 틀린다 — 실제로 그렇게 나갔다. */
function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  // 하이픈 금지(이 PC 의 DLP 가 날짜를 개인정보로 오인해 문서를 암호화한다)
  return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate()) +
         ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) +
         ' (' + '일월화수목금토'.charAt(d.getDay()) + ')';
}
/* 시각 동기화 원본. ⚠️ 한글 윈도우의 `w32tm` 출력은 cp949 라 UTF-8 로 읽으면 깨진다 →
   latin1 로 받아 **ASCII 일 때만** 그대로 싣고(서버 주소는 보통 ASCII), 아니면 비운다.
   깨진 글자를 검수지에 남기느니 '확인 불가'로 두고 사람이 날짜를 대조하는 편이 낫다. */
function timeSource() {
  return new Promise((resolve) => {
    try {
      execFile('w32tm', ['/query', '/source'], { encoding: 'latin1', timeout: 4000 },
        (err, stdout) => {
          if (err) return resolve('');
          const s = String(stdout || '').trim();
          resolve(/^[\x20-\x7E]+$/.test(s) ? s : '');
        });
    } catch (e) { resolve(''); }
  });
}

/* ── 점검 모드 ───────────────────────────────────────────────────────────
   화면을 점유하지 않고(숨은 창) 상태만 확인해 파일로 남긴다.
   보안 검토 회신에 "설정이 실제로 적용되었다"는 근거로 첨부할 수 있다. */
async function runSelfCheck() {
  const L = [];
  const line = (k, v) => L.push('  ' + String(k).padEnd(28) + ' : ' + v);
  const mark = (ok) => (ok ? '[양호] ' : '[확인] ');

  const probe = new BrowserWindow({
    show: false,
    webPreferences: Object.assign(baseWebPreferences(), {
      preload: path.join(__dirname, 'preload.js'),
    }),
  });
  await probe.loadFile(path.join(APP_DIR, 'index.html'));

  let env = {};
  try {
    env = JSON.parse(await probe.webContents.executeJavaScript(
      'JSON.stringify(Object.assign({}, window.__kioskEnv||{},' +
      ' {nodeInPage: typeof window.require === "function" || typeof window.module === "object"}))'));
  } catch (e) { /* 무시 */ }
  const hooked = await probe.webContents.executeJavaScript(PRINT_HOOK).catch(() => false);

  // devTools:false 가 실제로 먹었는지 — 열어 보고 안 열리는 것을 확인한다
  try { probe.webContents.openDevTools({ mode: 'detach' }); } catch (e) { /* 무시 */ }
  const devToolsOpened = probe.webContents.isDevToolsOpened();

  L.push('군포시 민원 서식 작성 도우미 — 키오스크 점검 결과');
  L.push('');
  L.push('[프로그램]');
  line('앱 버전', app.getVersion());
  /* ⚠️ **빌드 시각** — 판 번호만으로는 같은 번호로 두 번 구운 것을 가를 수 없다.
     번호를 올리는 진짜 이유가 「현장 PC 에 어느 것이 깔렸나」를 아는 것이었으므로,
     그 구분을 번호가 아니라 이 줄이 지게 한다. 같은 1.4.0 이라도 시각이 다르면 다른 것이다.
     📌 포장된 `app.asar` 의 시각을 본다 — 개발 중(풀린 상태)에는 `main.js` 시각을 쓴다. */
  line('빌드 시각', buildStamp());
  line('Electron', process.versions.electron);
  line('Chromium', process.versions.chrome);
  line('Node', process.versions.node);
  L.push('');
  L.push('[렌더러 보안]');
  line('sandbox', mark(env.sandboxed === true) + env.sandboxed);
  line('contextIsolation', mark(env.contextIsolated === true) + env.contextIsolated);
  line('nodeIntegration', mark(env.nodeInPage !== true) + (env.nodeInPage === true));
  line('devTools 열림 시도', mark(!devToolsOpened) + (devToolsOpened ? '열림' : '차단됨'));
  line('인쇄 보호 장치', mark(hooked === true) + (hooked ? '적용됨' : '적용 안 됨 → 인쇄 차단'));
  L.push('');

  const cfg = loadConfig();
  L.push('[설정]');
  line('설정 파일', configPath());
  line('설정 파일 존재', mark(fs.existsSync(configPath())) + fs.existsSync(configPath()));
  // 하드보안관이 걸린 PC 에서 %ProgramData% 에 두면 재부팅마다 설정이 사라진다(인쇄 차단).
  line('재부팅 후 유지', (configIsPreserved() ? '[양호] 보존 영역 — 유지됨'
       : '[확인] %ProgramData%(C:) — 하드보안관이 있으면 부팅 시 원복됨'));
  line('지정 프린터', mark(!!cfg.printerDeviceName) + (cfg.printerDeviceName || '미지정 → 인쇄 차단'));
  line('관리자 PIN', mark(!!cfg.exitPinHash) + (cfg.exitPinHash ? '설정됨' : '미설정 → PIN 없이 종료 가능'));
  /* ⚠️ 통계는 없어도 인쇄는 되므로 **사라져도 몇 달 뒤에야 눈치챈다.** 매번 알린다. */
  line('운영 통계', (configIsPreserved() ? '[양호] 보존 영역 — 유지됨'
       : '[확인] %ProgramData%(C:) — 재부팅마다 사라짐') + '  (`--stats` 로 요약)');
  // 겹쳐 찍기는 **미리 인쇄된 서식 용지가 트레이에 있어야** 한다. 검수 기록에 남긴다.
  const ov = printOptions.overlayForms(cfg);
  const ovSrc = Array.isArray(cfg.overlayPrintForms) ? '설정' : '기본값';
  line('겹쳐 찍기(값만 인쇄)', (ov.length ? '[확인] ' : '[양호] ') +
       (ov.length ? ov.join(', ') + ' (' + ovSrc + ') → 미리 인쇄된 서식 용지 필요'
                  : '없음 (' + ovSrc + ') → 서식까지 통째로 인쇄'));
  // 드롭아웃은 **실물 스캔으로 판독을 확인한 뒤에만** 켠다(하프톤 문제). 검수 기록에 남긴다.
  const dropAll = printOptions.dropoutForms(cfg);
  const drop = dropAll.filter((f) => !ov.map(String).map((s) => s.toLowerCase())
                                        .includes(String(f).toLowerCase()));
  line('적색 드롭아웃(칸선 걸러냄)', (drop.length ? '[확인] ' : '[양호] ') +
       (drop.length ? drop.join(', ') + ' → 백지 인쇄 · 접수처 스캔 판독 확인 필수'
                    : '없음 → 서식을 그대로 인쇄') +
       (dropAll.length > drop.length ? '  (겹쳐 찍기와 겹친 서식은 제외됨)' : ''));
  L.push('');

  L.push('[프린터]');
  const printers = await probe.webContents.getPrintersAsync().catch(() => []);
  for (const p of printers) {
    const virt = VIRTUAL_NAME_RE.test(p.name);
    L.push('  ' + (virt ? '[가상] ' : '       ') + p.name + (p.isDefault ? '  (기본)' : ''));
  }
  const anyVirtual = printers.some((p) => VIRTUAL_NAME_RE.test(p.name));
  line('파일로 저장하는 프린터', mark(!anyVirtual) + (anyVirtual ? '있음 → 제거 필요' : '없음'));
  if (cfg.printerDeviceName) {
    const info = await printerInfo(cfg.printerDeviceName);
    if (info) {
      line('지정 프린터 상태', mark(info.status === 'Normal') + statusText(info.status));
      line('포트', mark(!VIRTUAL_PORT_RE.test(info.port || '')) + info.port);
      line('인쇄된 문서 유지', mark(!info.keep) + (info.keep ? '켜짐 → 꺼야 함' : '꺼짐'));
      line('대기 중인 인쇄 작업', mark(!info.jobs) + info.jobs + '건');
    } else {
      line('지정 프린터 상태', '[확인] 확인 실패 (PowerShell)');
    }
  }
  L.push('');

  /* [시각] 2026.08.18 신설 — 서식의 신청일·동의일은 이 PC 의 시계를 그대로 찍는다.
     시계가 틀리면 인쇄물의 날짜가 통째로 틀리는데, 화면 어디에도 날짜가 크게 보이지 않아
     현장에서 나흘 뒤에야 발견됐다(하드보안관이 날짜까지 설치일로 되돌리고 있었다). */
  L.push('[시각]');
  line('현재 날짜·시각', nowStamp() + '  ← 오늘 날짜와 같은지 눈으로 대조하세요');
  line('동기화 원본', (await timeSource()) || '(확인 불가 — 위 날짜를 직접 대조하세요)');
  L.push('  ※ 날짜가 다르면 신청일·동의일이 틀리게 인쇄되어 창구에서 반려될 수 있다.');
  L.push('    복원 프로그램(하드보안관 등)이 날짜까지 되돌리는 사례가 있다. 그런 PC 는');
  L.push('    보호를 해제한 상태에서 시각을 맞추고 기준 상태를 다시 저장해야 유지된다.');
  L.push('');

  L.push('[개인정보 잔존]');
  line('저장소 경로', app.getPath('userData'));
  line('임시 경로 사용', mark(app.getPath('userData').startsWith(os.tmpdir())) +
       app.getPath('userData').startsWith(os.tmpdir()));
  line('크래시덤프 경로', app.getPath('crashDumps'));
  L.push('');
  L.push('[차단 항목]');
  L.push('  단축키   F12 · Ctrl+Shift+I/J/C · Ctrl+P · Ctrl+W/N/T/R · Alt+F4');
  L.push('  이동     app/ · admin/ 밖으로 이동 차단, 새 창·외부 링크 차단, 권한 요청 전면 거부');
  L.push('  실행     중복 실행 차단, 창 이탈 시 첫 화면으로 초기화');
  L.push('');
  L.push('※ Alt+Tab·Windows 키 차단은 프로그램이 아니라 OS 설정의 몫이다(붙임3 참조).');

  const text = L.join('\r\n') + '\r\n';
  const d = new Date();
  const stamp = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' +
                String(d.getDate()).padStart(2, '0');   // 하이픈 금지(DLP가 개인정보로 오인)
  let out = '';
  try {
    fs.mkdirSync(PROGRAMDATA_DIR, { recursive: true });
    out = path.join(PROGRAMDATA_DIR, '점검결과_' + stamp + '.txt');
    fs.writeFileSync(out, text, 'utf8');
  } catch (e) { out = '(파일 저장 실패)'; }

  process.stdout.write(text + '\r\n저장 위치 : ' + out + '\r\n');
  if (!probe.isDestroyed()) probe.destroy();
  return out;
}

const EOL = String.fromCharCode(13, 10);   // 메모장에서 줄이 붙어 보이지 않게 CRLF

/* 이 설치본이 언제 구워졌는가. 같은 판 번호로 두 번 구웠을 때 가르는 유일한 값이다. */
function buildStamp() {
  const p2 = (n) => String(n).padStart(2, '0');
  for (const p of [path.join(process.resourcesPath || '', 'app.asar'), __filename]) {
    try {
      const d = fs.statSync(p).mtime;
      return d.getFullYear() + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate())
             + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
    } catch (e) { /* 다음 후보로 */ }
  }
  return '(확인 불가)';
}

/* ── 운영 통계 내려놓기 (`--stats`) ──────────────────────────────────────
   ⛔ 이 글에는 개인정보가 없다 — 화면 이름·시간대·횟수뿐이다(`stats.js` 참조).
   ⚠️ 통계 **원본 CSV 는 설정 폴더**에 있고, 이 요약은 그것을 읽어 다시 쓴 것이다. */
function runStats() {
  const L = stats.summary(0);
  if (!configIsPreserved()) {
    L.push('⚠️ 통계가 %ProgramData%(C:) 에 있습니다 — 하드보안관이 걸린 PC 라면');
    L.push('   재부팅마다 **통계가 통째로 사라집니다.** 보존 드라이브(D:~H:)에');
    L.push('   `군포민원서식도우미` 폴더를 만들어 두십시오(설치안내 2-1 참조).');
    L.push('');
  }
  const text = L.join(EOL) + EOL;
  const d = new Date();
  const stamp = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' +
                String(d.getDate()).padStart(2, '0');   // 하이픈 금지(DLP가 개인정보로 오인)
  let out = '';
  try {
    const dir = configDir();
    fs.mkdirSync(dir, { recursive: true });
    out = path.join(dir, '운영통계_' + stamp + '.txt');
    fs.writeFileSync(out, text, 'utf8');
  } catch (e) { out = '(파일 저장 실패)'; }
  process.stdout.write(text + EOL + '저장 위치 : ' + out + EOL);
  return out;
}

/* ── 시작 ────────────────────────────────────────────────────────────── */

// 중복 실행 차단 (점검 모드는 예외 — 운영 중에도 상태를 볼 수 있어야 한다)
if (!SELFCHECK && !STATSMODE && !app.requestSingleInstanceLock()) {
  app.exit(0);
} else {
  app.on('second-instance', () => {
    if (win && !win.isDestroyed()) { win.show(); win.focus(); }
  });

  app.whenReady().then(async () => {
    // 개인정보: 지난 실행의 흔적을 먼저 지운다(강제 종료 대비)
    try { await session.defaultSession.clearStorageData(); } catch (e) { /* 무시 */ }
    try { fs.rmSync(path.join(RUNTIME_DIR, 'crash'), { recursive: true, force: true }); } catch (e) { /* 무시 */ }

    // 권한 요청(카메라·위치·알림 등)은 전부 거부
    session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    if (session.defaultSession.setDevicePermissionHandler) {
      session.defaultSession.setDevicePermissionHandler(() => false);
    }

    if (STATSMODE) {
      runStats();
      app.exit(0);
      return;
    }

    if (SELFCHECK) {
      await runSelfCheck();
      app.exit(0);
      return;
    }

    createWindow();
    stats.start();          // 가동시간 — 1분마다 그 시간대에 1분씩 더한다

    // 지난 실행에서 남은 인쇄 작업 회수(전원 차단 등으로 남았을 수 있다)
    const name = loadConfig().printerDeviceName;
    if (name) sweepJobs(name, 0);

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

// 어떤 경로로 만들어진 화면이든 같은 통제를 받게 한다
app.on('web-contents-created', (e, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (ev, url) => { if (!isAllowedUrl(url)) ev.preventDefault(); });
  blockKeys(contents);
});

app.on('before-quit', (e) => {
  if (!allowQuit) { e.preventDefault(); askPinAndQuit(); }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
