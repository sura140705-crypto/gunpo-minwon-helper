// 환경설정 창 전용 preload. 화면과 메인 프로세스 사이에 이 세 가지만 오간다.
//
// ⛔ 이 파일을 옮기거나 이름을 바꾸면 `package.json` 의 `build.files` 도 함께 고쳐라.
//    빠뜨리면 포장된 실행본에서만 창이 비어 보인다(개발 중에는 멀쩡하다).
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__settings', {
  load: () => ipcRenderer.invoke('settings:load'),     // 현재 설정 + 프린터 목록
  save: (v) => ipcRenderer.invoke('settings:save', v), // { ok } 또는 { ok:false, error }
  close: () => ipcRenderer.send('settings:close'),
  // 로고 PNG 고르기 — 파일 대화상자는 **메인 프로세스가 연다**(창은 경로를 모른다).
  // 돌려주는 값은 null(취소) · { ok:true, uri } · { ok:false, error }
  pickLogo: () => ipcRenderer.invoke('settings:pickLogo'),
});
