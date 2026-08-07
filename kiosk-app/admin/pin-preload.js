// 관리자 종료 PIN 입력 창 전용 preload. 화면과 메인 프로세스 사이에 이 두 가지만 오간다.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('__admin', {
  check: (pin) => ipcRenderer.invoke('admin:pin', pin),   // 맞으면 프로그램이 종료된다
  cancel: () => ipcRenderer.send('admin:cancel'),
});
