// 인쇄 조판 옵션 — **실제 인쇄와 회귀 검증이 같은 값을 쓰도록** 한 곳에 모아 둔다.
//
// 왜 따로 빼 두는가 (2026.08.12):
//   `pageSize` 를 지정하지 않으면 Electron 은 서식 CSS 의 `@page{size:A4 portrait}` 를 무시하고
//   **Letter(215.9×279.4mm)** 로 조판한다. A4 조판을 Letter 에 맞추면 가로로 +2.9% 늘고
//   세로로 -5.9% 눌려, 좌표가 칸을 벗어난다. 두 축이 반대로 움직이므로 프린터 여백 설정으로는
//   고쳐지지 않고, 프린터를 바꿔도 그대로 따라온다.
//   → 용지를 여기서 한 번만 정하고, 인쇄 경로와 검증 경로가 이것을 함께 쓴다.
//
// ⛔ 이 파일을 옮기거나 이름을 바꾸면 `package.json` 의 `build.files` 도 함께 고쳐라.
//    빠뜨리면 포장된 실행본에서만 `require` 가 실패한다(개발 중에는 멀쩡하다).

const PAGE_SIZE = 'A4';   // 서식 8종은 전부 A4 별지서식이다

module.exports = {
  PAGE_SIZE: PAGE_SIZE,

  /* webContents.print() 용 — 실제 인쇄가 쓰는 값. */
  forPrint: function () {
    return {
      printBackground: true,             // 서식 배경(원본 서식 이미지)이 함께 나와야 한다
      margins: { marginType: 'none' },   // 서식이 A4 전면을 쓰므로 여백을 두지 않는다
      scaleFactor: 100,                  // 실제 크기 — 'fit to page' 로 줄이면 좌표가 어긋난다
      pageSize: PAGE_SIZE,
      copies: 1,
    };
  },

  /* webContents.printToPDF() 용 — 같은 조판을 PDF 로 재현한다(검증용).
     print() 와 옵션 이름이 다르다: marginType → 수치(inch), scaleFactor → scale. */
  forPdf: function () {
    return {
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      pageSize: PAGE_SIZE,
    };
  },

  /* 기준선 대조용 — 서식 CSS 의 `@page` 를 그대로 따르게 한다.
     데스크톱 크롬 `--print-to-pdf` 와 **같은 페이지 상자**가 나오므로 픽셀 비교가 가능하다.
     (`pageSize:'A4'` 는 Electron 내부 반올림 때문에 210.23×297.35mm 로 0.1% 크게 나온다.) */
  forPdfCssPage: function () {
    return {
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      preferCSSPageSize: true,
    };
  },
};
