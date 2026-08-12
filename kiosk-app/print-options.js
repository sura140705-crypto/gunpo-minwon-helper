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

/* ── 겹쳐 찍기(오버레이) 인쇄 ────────────────────────────────────────────
   **미리 인쇄된 관공서 서식 용지에 값만** 얹어 찍는 모드다.

   왜 필요한가 (2026.08.12):
     여권발급신청서는 **드롭아웃 컬러 서식**이다 — 기재칸 테두리가 빨강(255,0,0)으로
     인쇄돼 있고, 스캔할 때 빨강을 걸러내 적힌 글자만 읽는다. 이것을 흑백 프린터로 뽑으면
     빨강이 밝기 76 의 **검은 선**이 되어 드롭아웃이 안 되고, 판독이 실패한다.
     컬러 프린터가 준비되기 전까지의 임시 방편으로, 실물 서식 용지에 값만 찍는다.

   ⚠️ 이 모드에서는 **프린터 정합 공차가 그대로 어긋남이 된다.**
      서식과 값을 함께 찍을 때는 둘이 같이 밀려서 무해했지만, 여기서는 칸이 종이에 고정돼
      있고 값만 움직인다. 기재칸 높이 약 7mm · 글자 약 4mm 이므로 위아래 여유가 ±1.5mm 뿐이다.
   ⚠️ **한 인쇄 작업의 모든 쪽에 적용된다.** 여권 미성년자 신청은 2쪽(신청서+법정대리인
      동의서)이 나오는데, 트레이에는 한 종류의 용지만 들어간다. 2쪽짜리 서식에 이 모드를
      켜기 전에 용지 운영을 먼저 정해야 한다.

   숨기는 것 — 서식을 '재현'하는 요소 전부. 남기는 것은 값(.ov)뿐이다.
     .bg    배경 서식 이미지 → **visibility 로 숨긴다.** display:none 으로 지우면
            .stage 의 높이가 사라져(높이가 이 이미지에서 나온다) 좌표 기준이 무너진다.
     .cover 원본 안내문을 덮는 흰 사각형
     .guide 옅은 회색으로 다시 그린 안내문
     .ovhi  서명란 노란 형광펜 — 드롭아웃 대상 색이 아니어서 스캔을 방해할 수 있다 */
const OVERLAY_PRINT_CSS = [
  '@media print{',
  '  .stage .bg{ visibility:hidden !important; }',
  '  .cover, .guide, .ovhi{ display:none !important; }',
  '}',
].join('\n');

/* 서식 파일 이름에서 서식 키를 뽑는다 — `passport-helper-v1.html` → `passport` */
function formKey(url) {
  const m = /([a-z]+)-helper-v\d+\.html/i.exec(String(url || ''));
  return m ? m[1].toLowerCase() : '';
}

module.exports = {
  PAGE_SIZE: PAGE_SIZE,
  OVERLAY_PRINT_CSS: OVERLAY_PRINT_CSS,
  formKey: formKey,

  /* 이 서식을 겹쳐 찍기로 인쇄해야 하는가 — kiosk.json 의 overlayPrintForms 목록으로 정한다.
     설정에 없으면 종전대로 서식까지 통째로 인쇄한다(안전한 기본값). */
  isOverlayForm: function (cfg, url) {
    const list = (cfg && cfg.overlayPrintForms) || [];
    if (!Array.isArray(list) || !list.length) return false;
    const key = formKey(url);
    return !!key && list.map(String).map((s) => s.toLowerCase()).indexOf(key) >= 0;
  },

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
