// print-electron.js — 서식 HTML 을 **키오스크와 같은 Electron 조판으로** PDF 로 뽑는다.
//
// `verify-print.py --electron` 이 부르는 렌더러다. 기존 안전망은 데스크톱 크롬
// `--print-to-pdf` 로만 검증해서, 실제 인쇄가 지나가는 Electron 경로를 보지 못했다.
// 2026.08.12 의 용지 사고(Letter 조판)가 그 틈으로 빠져나갔다.
//
//   electron tools/print-electron.js <입력.html> <출력.pdf> [--css-page]
//
//   기본값        `print-options.forPdf()`   — 실제 인쇄와 같은 용지(A4) 지정
//   --css-page   `print-options.forPdfCssPage()` — 서식 CSS 의 @page 를 따름(기준선 대조용)
//
// 종료 시 마지막 줄에 `PAGE_MM <가로> <세로>` 를 찍는다 — 호출한 쪽이 용지를 검사한다.

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const printOptions = require(path.join(__dirname, '..', 'kiosk-app', 'print-options.js'));

const argv = process.argv.slice(app.isPackaged ? 1 : 2);
const files = argv.filter((a) => !a.startsWith('--'));
const cssPage = argv.includes('--css-page');
const [inHtml, outPdf] = files;

if (!inHtml || !outPdf) {
  console.error('사용법: electron tools/print-electron.js <입력.html> <출력.pdf> [--css-page]');
  app.exit(2);
}

const PT = 25.4 / 72;   // 포인트 → mm

/* PDF 첫 쪽의 MediaBox 를 mm 로. 용지가 바뀌면 여기서 바로 드러난다. */
function pageMm(buf) {
  const m = /\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/
    .exec(buf.toString('latin1'));
  if (!m) return null;
  return [(m[3] - m[1]) * PT, (m[4] - m[2]) * PT];
}

app.on('window-all-closed', () => { /* 우리가 직접 끈다 */ });

app.whenReady().then(async () => {
  // 화면 없이(show:false) 렌더한다. 서식은 인쇄 CSS 로 조판되므로 창 크기는 영향이 없지만,
  // 레이아웃이 안정된 뒤 뽑도록 넉넉한 크기를 준다.
  const win = new BrowserWindow({
    show: false,
    width: 1600,
    height: 1200,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
  });

  try {
    await win.loadFile(path.resolve(inHtml));

    // 서식 스크립트가 배경 이미지를 얹고 좌표를 그릴 시간을 준다.
    // (크롬 쪽은 --virtual-time-budget=4000 으로 같은 일을 한다)
    await win.webContents.executeJavaScript('document.fonts ? document.fonts.ready.then(()=>1) : 1');
    await new Promise((r) => setTimeout(r, 1200));

    const opts = cssPage ? printOptions.forPdfCssPage() : printOptions.forPdf();
    const buf = await win.webContents.printToPDF(opts);
    fs.writeFileSync(path.resolve(outPdf), buf);

    const mm = pageMm(buf);
    if (mm) console.log('PAGE_MM %s %s', mm[0].toFixed(2), mm[1].toFixed(2));
    else console.log('PAGE_MM ? ?');

    app.exit(0);
  } catch (e) {
    console.error('실패: ' + (e && e.message ? e.message : e));
    app.exit(1);
  }
});
