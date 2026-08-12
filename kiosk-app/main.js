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
// ⚠️ 설정은 `%ProgramData%\군포민원서식도우미\kiosk.json` 에서 읽는다(설치 시 관리자가 만든다).
//    프린터가 지정돼 있지 않으면 **인쇄를 하지 않는다.** 기본 프린터로 흘려보내면
//    그것이 가상 프린터일 때 개인정보가 파일로 남기 때문이다.
const { app, BrowserWindow, Menu, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const printOptions = require('./print-options');

const SELFCHECK = process.argv.includes('--selfcheck');

/* ── 설정 ────────────────────────────────────────────────────────────── */

const CONFIG_DIR = path.join(process.env.ProgramData || os.tmpdir(), '군포민원서식도우미');
const CONFIG_PATH = path.join(CONFIG_DIR, 'kiosk.json');
const JOB_TIMEOUT_SEC = 60;          // 이 시간이 지나도 남아 있는 인쇄 작업은 회수한다
const PRINT_ERROR_MS = 6000;         // 인쇄 실패 안내를 보여 주는 시간

function loadConfig() {
  // BOM 을 떼고 읽는다 — PowerShell 로 저장하면 BOM 이 붙기 쉽고, 붙으면 JSON.parse 가 실패한다.
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8').replace(/^﻿/, '')); }
  catch (e) { return {}; }
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

/* ── 인쇄 ────────────────────────────────────────────────────────────── */

ipcMain.handle('kiosk:print', async (event) => {
  const target = await resolvePrinter(event.sender);
  if (!target.ok) {
    console.error('[키오스크] 인쇄 거부:', target.reason);
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

    // 겹쳐 찍기 — 미리 인쇄된 서식 용지에 값만 얹는다(kiosk.json 의 overlayPrintForms).
    // 서식 HTML 은 건드리지 않는다. 이 모드는 키오스크 인쇄에만 걸린다.
    if (printOptions.isOverlayForm(loadConfig(), url)) {
      win.webContents.insertCSS(printOptions.OVERLAY_PRINT_CSS)
        .catch((e) => console.error('[키오스크] 겹쳐 찍기 CSS 적용 실패:', e && e.message));
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
    if (k === 'H') {
      e.preventDefault();
      if (win && !win.isDestroyed()) win.loadFile(path.join(APP_DIR, 'index.html'));
    }
  });
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

function askPinAndQuit() {
  if (adminMode) return;
  if (!win || win.isDestroyed()) { quitNow(); return; }   // 물어볼 창이 없으면 매달리지 않는다
  const cfg = loadConfig();

  // PIN 이 설정돼 있지 않으면 종료를 막지 않는다 — 잠긴 키오스크를 열 수단이 없어지면
  // 복구가 불가능해지기 때문이다. 대신 `--selfcheck` 가 '미설정'으로 보고한다.
  if (!cfg.exitPinHash) { quitNow(); return; }

  adminMode = true;
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
    adminMode = false;
    if (!allowQuit && win && !win.isDestroyed()) win.focus();
  });

  ipcMain.removeHandler('admin:pin');
  ipcMain.handle('admin:pin', (e, value) => {
    const ok = sha256(value) === String(cfg.exitPinHash).toLowerCase();
    if (ok) { if (!pin.isDestroyed()) pin.close(); quitNow(); }
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
  try { await session.defaultSession.clearStorageData(); } catch (e) { /* 무시 */ }
  try { await session.defaultSession.clearCache(); } catch (e) { /* 무시 */ }
  const name = loadConfig().printerDeviceName;
  if (name) { try { await sweepJobs(name, 0); } catch (e) { /* 무시 */ } }
  try { fs.rmSync(path.join(RUNTIME_DIR, 'crash'), { recursive: true, force: true }); } catch (e) { /* 무시 */ }
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
  line('설정 파일', CONFIG_PATH);
  line('설정 파일 존재', mark(fs.existsSync(CONFIG_PATH)) + fs.existsSync(CONFIG_PATH));
  line('지정 프린터', mark(!!cfg.printerDeviceName) + (cfg.printerDeviceName || '미지정 → 인쇄 차단'));
  line('관리자 PIN', mark(!!cfg.exitPinHash) + (cfg.exitPinHash ? '설정됨' : '미설정 → PIN 없이 종료 가능'));
  // 겹쳐 찍기는 **미리 인쇄된 서식 용지가 트레이에 있어야** 한다. 검수 기록에 남긴다.
  const ov = Array.isArray(cfg.overlayPrintForms) ? cfg.overlayPrintForms : [];
  line('겹쳐 찍기(값만 인쇄)', (ov.length ? '[확인] ' : '[양호] ') +
       (ov.length ? ov.join(', ') + ' → 미리 인쇄된 서식 용지 필요' : '없음 (서식까지 통째로 인쇄)'));
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
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    out = path.join(CONFIG_DIR, '점검결과_' + stamp + '.txt');
    fs.writeFileSync(out, text, 'utf8');
  } catch (e) { out = '(파일 저장 실패)'; }

  process.stdout.write(text + '\r\n저장 위치 : ' + out + '\r\n');
  if (!probe.isDestroyed()) probe.destroy();
  return out;
}

/* ── 시작 ────────────────────────────────────────────────────────────── */

// 중복 실행 차단 (점검 모드는 예외 — 운영 중에도 상태를 볼 수 있어야 한다)
if (!SELFCHECK && !app.requestSingleInstanceLock()) {
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

    if (SELFCHECK) {
      await runSelfCheck();
      app.exit(0);
      return;
    }

    createWindow();

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
