// 군포시 민원 서식 작성 도우미 — 키오스크(Electron) preload
//
// 키오스크에서는 인쇄 대화상자를 열지 않는다. 대화상자를 열면 목적지 목록에
// 'PDF로 저장'류가 나타나 개인정보가 파일로 남을 수 있기 때문이다(붙임4 제Ⅴ항).
// 크롬 방식은 이를 관리자_개인정보보호_설정.bat 의 정책·가상 프린터 제거로 막지만,
// Electron 방식은 대화상자 자체를 열지 않아 목적지가 존재하지 않는다.
//
// contextIsolation: true 를 유지한 채 페이지(메인 월드)에 함수 하나만 노출한다.
// 서식 HTML 은 고칠 필요가 없다 — main.js 가 window.print 를 이 함수로 바꿔 끼운다.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__kioskPrint', function () {
  return ipcRenderer.invoke('kiosk:print');
});
