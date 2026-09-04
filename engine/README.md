# 가족관계등록 신고서 공통 엔진

혼인·이혼·출생 도우미에서 공통이던 로직(포매터·`renderForm`/`buildVals` 스캐폴딩·스텝퍼·네비게이션·이벤트·미리보기·인쇄)을 추출한 **이미지-오버레이 엔진**입니다. 서식마다 다른 부분(좌표맵·필드·단계·예시)만 config로 분리해, 새 신고서는 config 하나로 만듭니다.

## 구조

```
engine/
  base-product.html  공통 CSS + HTML 골격 (Product UI v1 · 플레이스홀더 3개)
  engine.js        공통 엔진 — 전역 FORM 설정을 읽어 동작
  assets/<이름>.b64 배경 이미지 data URI (prep-bg.py 생성, .gitignore·재생성 가능)
forms/
  <이름>.config.js  서식별 FORM 설정 (좌표·필드·단계·예시)
tools/
  prep-bg.py       서식 PDF 1쪽 → engine/assets/<이름>.b64
  build-form.js    base+engine+config+배경 → <이름>-helper-v1.html (자체완결)
  sync-kiosk.sh    루트 배포 HTML → kiosk-app/app/ 동기화
  make-manual.py   운영문서 .md → 배포용 PDF (화면 그림을 헤드리스 크롬으로 촬영·삽입)
  embed-logo.py    assets/logo.png → 허브 상단바·입력 패널 머리에 로고 삽입
  make-icon.py     assets/logo.png → kiosk-app/build/icon.ico (Electron 앱 아이콘)
  verify-print.py  인쇄물 8종×예시2 를 tests/baseline/ 과 픽셀 비교 (회귀 안전망)
  rebrand.py       지역 고유값(기관명·부서·연락처·로고) 일괄 교체 → 타 지자체 확산
서식원본/
  <서식>.pdf        관공서 서식 원본 (prep-bg.py 의 입력. 앱 실행에는 쓰이지 않음)
```

> **로고**: `python tools/embed-logo.py` 를 돌리면 허브(민트 원본)와 서식 도우미
> 입력 패널 파란 머리(흰색 반전본)에 base64로 박힌다. `--remove` 로 원상복구.
> 껍데기(`engine/base-product.html`)도 함께 고치므로 **엔진 서식 7종은 재빌드**해야 반영된다.
> 로고는 화면 전용이며 인쇄물(서식)에는 절대 나오지 않는다(8종 인쇄 0px 검증).

> **앱 아이콘(Electron 대안)**: `python tools/make-icon.py` → `kiosk-app/build/icon.ico`
> (16·24·32·48·64·128·256px). electron-builder 가 이 경로를 읽어 실행파일·설치본·바로가기에
> 박으므로, 아이콘을 바꾸면 **`cd kiosk-app && npm run dist` 로 설치본을 다시 만들어야** 한다.
> 로고 안쪽이 투명해 바탕화면이 비치면 민트 글자가 안 읽히므로 **흰색으로 메워** 담는다.

> **운영문서 PDF**: `운영문서/*.md` 가 원본이고 PDF는 항상 다시 만든다.
> 서식을 추가하면 `.md` 를 고치고 아래 두 줄을 돌릴 것.
> ```bash
> python tools/make-manual.py                                   # 붙임2 → 사용매뉴얼.pdf (간단본)
> python tools/make-manual.py "운영문서/붙임2-1_사용매뉴얼(상세).md" 운영문서/사용매뉴얼_상세.pdf
> ```
> ⚠️ **날짜는 점 표기(`2026.08.04`)로 쓸 것.** 연·월·일을 하이픈으로 끊으면 DRM/DLP가 개인정보로
> 오인해 만들어진 PDF를 그 자리에서 암호화한다(열면 `no objects found`). 점 표기는 통과한다.
>
> 그림은 `![캡션](fig:이름)` 으로 넣고, 이름은 `make-manual.py` 의 `FIGURES` 에 정의한다.
> `FIGURES` 항목은 `{file, js, size, crop, patch, budget}` — `js` 로 예시를 채우고 원하는
> 단계로 이동시킨 뒤 촬영하고, `crop` 으로 화면 일부만 오려낼 수 있다(용량 절감).

## 새 서식 만들기

```bash
# 1) 배경 이미지 준비 (PyMuPDF 필요)
python tools/prep-bg.py death 서식원본/사망신고서.pdf

# 2) forms/death.config.js 작성 (forms/birth.config.js 참고)
#    - 좌표는 PDF 텍스트/격자선 추출로: get_text('words') + get_drawings()

# 3) 생성
node tools/build-form.js death            # → death-helper-v1.html
node tools/build-form.js death _gen.html  # 검증용 임시 출력

# 4) index.html 허브에 href 연결

# 5) 배포 동기화 (루트 → kiosk-app/app/)
bash tools/sync-kiosk.sh          # 복사
bash tools/sync-kiosk.sh --check  # 커밋 전 드리프트 검증(다르면 exit 1)
```

> **드리프트 주의**: 배포 HTML은 루트(원본)와 `kiosk-app/app/` 두 곳에
> 사본이 존재한다. **항상 루트 파일만 수정**하고 `sync-kiosk.sh` 로 배포 위치를 맞출 것.
> 손작성본(여권)을 고칠 때도 동일하게 루트 수정 후 동기화한다.
> 엔진 서식(출생·혼인·이혼·사망·개명·증명서·부동산거래계약)은 **루트 파일을 직접 고치지 말고**
> `forms/<이름>.config.js` 를 고쳐 재빌드할 것 — 직접 고치면 다음 재빌드에 덮여 사라진다.

## config(FORM) 인터페이스

| 키 | 설명 |
|---|---|
| `docTitle` / `formName` | 상단 제목 / 모달·배경 alt |
| `org` | `{orgName, officeName}` |
| `sampleLabels` / `sampleKinds` | 작성예시 버튼 2개 라벨 / 종류 키 |
| `noticeItems` | 화면 하단 「이용 안내」 목록을 서식 고유 문구로 교체(생략하면 껍데기의 일반 문구). 예) 출생신고서는 "필요 서류(출생증명서 등)" 처럼 서식 이름을 넣어 안내한다 |
| `today` | 제목 아래 `( 년 월 일 )` 좌표 `{y,yx,mx,dx}` |
| `stateKeys` / `stateDefaults` | 상태 필드 목록 / 기본값 |
| `CO` | `{texts,checks,attend}` 좌표맵 (PDF 포인트, PW=595/PH=841) |
| `STEP_HL` | 단계별 서식 강조 영역 `{step:[[x0,y0,x1,y1],…]}` |
| `buildVals(state)` | 상태 → 오버레이 값(주민 6-7분할·포맷 등) |
| `signatureHI(v,state)` | 서명·날인 형광 박스 배열(내용 있을 때만) |
| `STEPS[]` | `{n,short,title,q,why,kind,body(A),required(state)}` |
| `applySample(state,kind)` | 작성예시 채우기 |
| `checkVisible(field,state)` | 선택 표기를 조건부로 숨김(해당 없는 항목 잔상 방지) |
| `checkMark` / `checkSize` | 선택 표기 기호·크기 (기본 `"○"`·12pt). 서식 머리말이 지시하는 기호를 따를 것 — 가족관계등록 신고서는 영표 `○`, `[ ]` 를 쓰는 부동산거래계약 신고서는 `"✔"`·8pt |
| `checkBlack` | 선택 표기를 검정으로 (기본은 빨강 영표). 인쇄 CSS가 `!important` 라 클래스로 처리한다 |
| `extraPages(state)` / `extraCss` | **첨부 페이지(별지 등)** HTML과 그 CSS. 서식 이미지 뒤 `.paper.extra` 에 들어가고 인쇄 시 다음 장부터 나온다. 빈 문자열을 돌려주면 페이지가 사라진다(`.extra:empty`). 좌표 고정이 아닌 HTML 표라 줄 수가 자유롭고 넘치면 자동으로 다음 장으로 이어진다 — `forms/realestate.config.js` 의 별지 참고 |

단계 `body(A)`는 `A.inputHtml/choiceHtml/toggleHtml/sumRow/state/formatMoney/digits/…`를 써서 HTML 문자열을 반환합니다.

버튼 속성: `data-set`/`data-val`(선택) · `data-toggle`(켜기·끄기) · `data-goto`(단계 이동) ·
`data-inc`(카운터 증감 — `data-by`·`data-max`·`data-min`, 별지 추가 인원 수 등).

입력칸 `type` : `text`(기본) · `jumin`(6-7 하이픈) · `phone`(02는 2자리 지역번호) · `money`(3자리 콤마) · `date`(숫자 8자리 → yyyy.mm.dd, blur 시).

### 참고할 config

| 파일 | 성격 |
|---|---|
| `forms/naming.config.js` | 가장 단순한 표준형 신고서 |
| `forms/death.config.js` | 다지선다 + 조건부 상세 입력 |
| `forms/birth.config.js` | 필드가 많은 복잡한 신고서 |
| `forms/cert.config.js` | 체크박스 + 통수(건수) 위주 |
| `forms/realestate.config.js` | 금액·면적·지분 위주, 조건부 구역(외국인·중개사·종전 부동산)이 많은 서식 |
| `forms/divorce.config.js` | 같은 블록이 **네 벌 그려진 서식**(⑤ 친권자 4자리) — 고른 수만큼만 찍고 나머지는 `checkVisible` 로 가린다 |

## 검증

**출생신고서는 2026.07.30 부터 엔진 생성본이 배포본입니다.** 그 전까지는 손작성 `birth-helper-v1.html` 과
`forms/birth.config.js` 가 나란히 존재해 드리프트 위험이 있었는데, 교체 직전에 다음을 확인한 뒤 단일화했습니다.

- 인쇄 출력: 예시 2종(혼인 중·혼인 외) 모두 손작성본과 **0px 차이**
- 화면: 10단계 전부 패널 DOM 동일, 데스크톱·모바일 스크린샷 **0px 차이**
  (단, 주민등록번호·전화번호 입력칸은 엔진 쪽이 재렌더 시 하이픈을 넣어 보여 준다 — 엔진 서식 4종에 이미 적용된 개선)

현재 엔진 생성본 = 출생·**혼인**·**이혼**·사망·개명·증명서·부동산거래계약 **7종**입니다.
혼인(`923ecff`)·이혼(2026.08.29)은 손작성 포크였다가 엔진으로 되돌아왔습니다 —
포크가 갈라진 탓에 **필수 검증이 한 곳도 없던** 상태였습니다.
손작성본은 **여권 하나**뿐이며, 엔진 공용 스니펫(유휴 초기화·인쇄 안내 모달 등)을 고칠 때는
여권도 같은 내용으로 함께 손봐야 합니다.

✅ **껍데기는 `base-product.html`(Product UI v1) 하나뿐입니다.** 엔진 7종이 모두 이것을
씁니다(2026.08.29 이식 완료). 옛 껍데기 `engine/base.html` 은 쓰는 서식이 없어
**2026.09.04 에 지웠습니다** — 고쳐도 배포물이 바뀌지 않는 함정이었습니다.
📌 되살릴 일이 있으면 git 이력에서 꺼내십시오. ⛔ 껍데기를 다시 둘로 가르지 마십시오.

엔진(`engine.js`·`base-product.html`)을 고친 뒤에는 **7종을 모두 재빌드**하고, 커밋본과
인쇄·화면 픽셀을 비교해 회귀가 없는지 확인하십시오.
