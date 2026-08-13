// 군포시 민원 서식 작성 도우미 — 키오스크(Electron) preload
//
// 키오스크에서는 인쇄 대화상자를 열지 않는다. 대화상자를 열면 목적지 목록에
// 'PDF로 저장'류가 나타나 개인정보가 파일로 남을 수 있기 때문이다(운영문서/붙임3 제Ⅵ항).
// 크롬 방식은 이를 정책·가상 프린터 제거로 막았지만,
// 이 방식은 대화상자 자체를 열지 않아 목적지가 존재하지 않는다.
//
// contextIsolation: true · sandbox: true 를 유지한 채 페이지(메인 월드)에 최소한만 노출한다.
// 서식 HTML 은 고칠 필요가 없다 — main.js 가 window.print 를 이 함수로 바꿔 끼운다.
const { contextBridge, ipcRenderer } = require('electron');

// 인쇄. 돌려주는 값은 { ok: boolean } — 실패 안내 화면은 main.js 가 띄운다.
contextBridge.exposeInMainWorld('__kioskPrint', function () {
  return ipcRenderer.invoke('kiosk:print');
});

// 환경설정 창에서 정한 화면 쪽 값(무동작 초기화 시간·인쇄 후 대기 시간).
// ⚠️ **sendSync** 다. preload 는 페이지 스크립트보다 먼저 도는데, 여기서 비동기로 받으면
//    서식이 이미 기본값으로 타이머를 걸어 버린 뒤에 값이 도착해 아무 효과가 없다.
//    웹(GitHub Pages) 배포본에는 preload 가 없으므로 이 값도 없고, 서식은 자기 기본값을 쓴다.
let __cfg = {};
try { __cfg = ipcRenderer.sendSync('kiosk:cfg') || {}; } catch (e) { __cfg = {}; }
contextBridge.exposeInMainWorld('__kioskCfg', __cfg);

// 점검 모드(`--selfcheck`)가 렌더러의 보안 설정이 실제로 적용됐는지 확인하는 데 쓴다.
// 개인정보는 담기지 않으며, 값을 읽기만 할 뿐 아무것도 바꾸지 않는다.
contextBridge.exposeInMainWorld('__kioskEnv', {
  sandboxed: process.sandboxed,
  contextIsolated: process.contextIsolated,
  electron: process.versions.electron,
  chrome: process.versions.chrome,
});
