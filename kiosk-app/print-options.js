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

/* ── 적색 드롭아웃 흉내내기 (2026.08.13) ─────────────────────────────────
   **미리 인쇄된 용지 없이** 흑백 프린터로 판독 가능한 인쇄물을 내는 방법이다.

   무엇이 문제였나 (㉞):
     여권 서식의 기재칸 테두리는 빨강(255,0,0)이고, 접수처 스캐너는 빨강을 걸러내고
     적힌 글자만 읽는다. 그런데 흑백 프린터는 빨강을 **밝기 136 의 검은 선**으로 찍는다.
     드롭아웃이 안 되니 선이 글자로 읽힌다 — 실측으로 이진화 임계 128 에서
     빨간 선의 **29.6%** 가 검은 선으로 살아남았다.

   왜 '전체를 밝게' 로는 못 고치나:
     밝기는 색을 구분하지 못한다. 전체를 25% 밝게 하면 빨간 선은 사라지지만(0%)
     **「필수 기재란」·「한글성명」 같은 검은 항목명도 같이 사라진다(0%).** 실측값이다.

   그래서 **빨강 채널만** 회색조로 쓴다 — 적색 드롭아웃 스캐너가 하는 연산 그대로다.
     빨강(255,0,0) → R=255 → 흰색, 사라짐
     살구색 기재란 배경  → R≈250 → 거의 흰색, 사라짐
     검정 항목명(0,0,0) → R=0  → 검정, 그대로 남음
   완전히 지우면 사람이 칸을 못 보므로 KEEP(14%)만 되살린다.
     Out = 0.86R + 0.07G + 0.07B  — 빨강 자리 밝기 169.7 → 230.6(옅은 안내선)

   실측(Electron 인쇄 경로 · 이진화 임계 128):
     빨간 선이 남는 비율  29.6% → **1.2%**      검은 항목명 보존  100% → **83%**

   ⚠️ **`color-interpolation-filters="sRGB"` 를 빼지 마라.** 기본값은 linearRGB 라
      Chromium 이 감마를 풀고 계산해 값이 전혀 달라진다(선이 다시 진해진다).
   ⚠️ **하프톤은 시뮬레이션으로 안 풀린다.** 흑백 레이저는 밝기 230 을 균일한 회색이 아니라
      **띄엄띄엄한 검은 점**으로 찍는다. 스캐너가 그 점을 주울 수 있다.
      **반드시 실물을 뽑아 접수처 스캔으로 확인하고** 켜라. 그래서 기본값이 꺼짐이다. */
const DROPOUT_KEEP = 0.14;   // 사람 눈에 남길 정도. 0 이면 칸선이 완전히 사라진다
const DROPOUT_R = (1 - DROPOUT_KEEP).toFixed(2);          // 0.86
const DROPOUT_GB = (DROPOUT_KEEP / 2).toFixed(2);         // 0.07

const DROPOUT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg">' +
  '<filter id="d" color-interpolation-filters="sRGB">' +
  '<feColorMatrix type="matrix" values="' +
  [DROPOUT_R, DROPOUT_GB, DROPOUT_GB, 0, 0,
   DROPOUT_R, DROPOUT_GB, DROPOUT_GB, 0, 0,
   DROPOUT_R, DROPOUT_GB, DROPOUT_GB, 0, 0,
   0, 0, 0, 1, 0].join(' ') +
  '"/></filter></svg>';

const MONO_DROPOUT_CSS = [
  '@media print{',
  "  .stage .bg{ filter: url('data:image/svg+xml;utf8," + DROPOUT_SVG + "#d') !important; }",
  '}',
].join('\n');

/* 서식 파일 이름에서 서식 키를 뽑는다 — `passport-helper-v1.html` → `passport` */
function formKey(url) {
  const m = /([a-z]+)-helper-v\d+\.html/i.exec(String(url || ''));
  return m ? m[1].toLowerCase() : '';
}

/* 설정이 없을 때의 기본값.
   여권은 드롭아웃 컬러 서식이라 흑백 프린터로 **서식까지** 찍으면 스캔 판독이 실패한다(㉞).
   설정 파일이 없거나 초기화돼도(하드보안관 복원·재설치 등) 서식이 딸려 나오지 않도록
   기본으로 켜 둔다 — 설정을 깜빡해서 접수가 막히는 쪽이 훨씬 나쁘다.
   ⛔ 끄려면 kiosk.json 에 **`"overlayPrintForms": []`** 를 명시한다(키를 지우면 기본값이 다시 켜진다). */
const DEFAULT_OVERLAY_FORMS = ['passport'];

/* 이 키오스크에서 겹쳐 찍기로 인쇄할 서식 목록 */
function overlayForms(cfg) {
  const v = cfg && cfg.overlayPrintForms;
  return Array.isArray(v) ? v.map(String) : DEFAULT_OVERLAY_FORMS;
}

/* 적색 드롭아웃을 흉내낼 서식 목록 — **기본값은 꺼짐**이다.
   실물 스캔으로 판독을 확인하기 전에는 켜면 안 된다(하프톤 문제). */
function dropoutForms(cfg) {
  const v = cfg && cfg.monoDropoutForms;
  return Array.isArray(v) ? v.map(String) : [];
}

function inList(list, url) {
  if (!list.length) return false;
  const key = formKey(url);
  return !!key && list.map((s) => s.toLowerCase()).indexOf(key) >= 0;
}

/* ── 여권 인쇄 방식 (환경설정 창이 쓰는 3택) ──────────────────────────────
   두 목록(overlayPrintForms · monoDropoutForms)을 직접 만지게 하면 관리자가
   서로 모순되는 조합을 만들 수 있다. 창에서는 **하나의 방식**만 고르게 하고,
   목록으로의 번역은 여기서 한 곳으로 모은다.

     color    컬러 프린터용 — 서식과 값을 통째로 인쇄 (원래 동작)
     overlay  흑백·겹쳐 찍기 — 미리 인쇄된 컬러 서식 용지에 값만
     dropout  흑백·드롭아웃 — 서식도 찍되 빨간 칸선을 걸러내 인쇄(㉞-2)

   ⚠️ 여권에만 적용한다. 나머지 7종은 드롭아웃 컬러 서식이 아니라 손댈 이유가 없다. */
const PASSPORT = 'passport';
const PRINT_MODES = ['color', 'overlay', 'dropout'];

function passportMode(cfg) {
  const url = PASSPORT + '-helper-v1.html';
  if (inList(overlayForms(cfg), url)) return 'overlay';
  if (inList(dropoutForms(cfg), url)) return 'dropout';
  return 'color';
}

/* 고른 방식을 두 목록으로 되돌린다. 여권 외의 서식이 목록에 들어 있으면 그대로 둔다. */
function applyPassportMode(cfg, mode) {
  const keep = (list) => list.filter((s) => String(s).toLowerCase() !== PASSPORT);
  const ov = keep(overlayForms(cfg));
  const dp = keep(dropoutForms(cfg));
  if (mode === 'overlay') ov.push(PASSPORT);
  if (mode === 'dropout') dp.push(PASSPORT);
  return { overlayPrintForms: ov, monoDropoutForms: dp };
}

module.exports = {
  PAGE_SIZE: PAGE_SIZE,
  OVERLAY_PRINT_CSS: OVERLAY_PRINT_CSS,
  MONO_DROPOUT_CSS: MONO_DROPOUT_CSS,
  DEFAULT_OVERLAY_FORMS: DEFAULT_OVERLAY_FORMS,
  formKey: formKey,
  overlayForms: overlayForms,
  dropoutForms: dropoutForms,
  PRINT_MODES: PRINT_MODES,
  passportMode: passportMode,
  applyPassportMode: applyPassportMode,

  /* 설정에 목록이 있으면 그것을, 없으면 기본값(여권)을 쓴다. */
  isOverlayForm: function (cfg, url) {
    return inList(overlayForms(cfg), url);
  },

  /* 드롭아웃 흉내를 낼 서식인가.
     ⛔ 겹쳐 찍기가 켜진 서식에는 걸지 않는다 — 그쪽은 배경을 통째로 숨기므로
        필터를 걸 대상이 없고, 둘을 같이 켜면 무엇이 적용됐는지 헷갈린다. */
  isDropoutForm: function (cfg, url) {
    if (inList(overlayForms(cfg), url)) return false;
    return inList(dropoutForms(cfg), url);
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
