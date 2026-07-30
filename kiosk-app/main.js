// 군포시 민원 서식 작성 도우미 — 키오스크(Electron) 메인 프로세스
// 전체화면 키오스크로 로컬 index.html 실행. 인터넷·외부 통신 없음.
const { app, BrowserWindow, Menu, globalShortcut, session, ipcMain } = require('electron');
const path = require('path');

let win = null;

/* 서식 HTML 의 window.print 를 대화상자 없는 인쇄로 바꿔 끼운다(메인 월드에 주입).
   HTML 8종은 인쇄 후 afterprint 로 화면을 가리고 첫 화면으로 돌아가므로,
   인쇄가 끝나면 그 이벤트를 직접 발생시켜야 개인정보 초기화가 유지된다.
   실패해도 발생시킨다 — 화면에 개인정보를 남겨 두는 쪽이 더 위험하다. */
const PRINT_HOOK = `(function(){
  if (!window.__kioskPrint || window.__kioskPrintHooked) return;
  window.__kioskPrintHooked = true;
  window.print = function(){
    window.__kioskPrint().catch(function(){}).then(function(){
      window.dispatchEvent(new Event('afterprint'));
    });
  };
})();`;

function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    kiosk: true,               // 키오스크 잠금(전체화면·창 조작 제한)
    autoHideMenuBar: true,
    backgroundColor: '#eef2f7',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,  // 렌더러에서 Node 접근 차단(보안)
      spellcheck: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  Menu.setApplicationMenu(null); // 상단 메뉴 제거
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // 외부 링크·새 창 차단(키오스크에서 밖으로 못 나가게)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // 서식을 옮겨 다녀도(첫 화면 ↔ 각 서식) 매번 다시 걸어 준다
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(PRINT_HOOK).catch(() => {});
  });

  win.on('closed', () => { win = null; });
  return win;
}

/* 대화상자 없이 기본 프린터로 바로 인쇄한다.
   여백 없음·배율 100% 는 매뉴얼이 직원에게 눈으로 확인하라고 안내하던 값인데,
   여기서는 코드로 고정하므로 설정을 잘못 만질 여지가 없다. */
ipcMain.handle('kiosk:print', (event) => new Promise((resolve) => {
  event.sender.print({
    silent: true,                      // 대화상자 없음 → 'PDF로 저장' 목적지가 아예 없다
    printBackground: true,             // 서식 배경(원본 서식 이미지)이 함께 나와야 한다
    margins: { marginType: 'none' },
    scaleFactor: 100,
    copies: 1,
  }, (ok, reason) => {
    if (!ok) console.error('[키오스크] 인쇄 실패:', reason);
    resolve(ok);
  });
}));

app.whenReady().then(() => {
  // 개인정보: 세션에 아무것도 남기지 않도록 캐시/저장소 비우기
  session.defaultSession.clearStorageData().catch(() => {});

  createWindow();

  // 관리자용 종료 단축키 (시민은 알기 어려움)
  globalShortcut.register('Control+Shift+Q', () => app.quit());
  // 관리자용 첫 화면 복귀 단축키
  globalShortcut.register('Control+Shift+H', () => {
    if (win) win.loadFile(path.join(__dirname, 'app', 'index.html'));
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => { globalShortcut.unregisterAll(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
