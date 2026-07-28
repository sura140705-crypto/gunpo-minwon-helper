# 가족관계등록 신고서 공통 엔진

혼인·이혼·출생 도우미에서 공통이던 로직(포매터·`renderForm`/`buildVals` 스캐폴딩·스텝퍼·네비게이션·이벤트·미리보기·인쇄)을 추출한 **이미지-오버레이 엔진**입니다. 서식마다 다른 부분(좌표맵·필드·단계·예시)만 config로 분리해, 새 신고서는 config 하나로 만듭니다.

## 구조

```
engine/
  base.html        공통 CSS + HTML 골격 (플레이스홀더 3개)
  engine.js        공통 엔진 — 전역 FORM 설정을 읽어 동작
  assets/<이름>.b64 배경 이미지 data URI (prep-bg.py 생성, .gitignore·재생성 가능)
forms/
  <이름>.config.js  서식별 FORM 설정 (좌표·필드·단계·예시)
tools/
  prep-bg.py       서식 PDF 1쪽 → engine/assets/<이름>.b64
  build-form.js    base+engine+config+배경 → <이름>-helper-v1.html (자체완결)
  sync-kiosk.sh    루트 배포 HTML → 키오스크배포/ · kiosk-app/app/ 동기화
  pack-kiosk.sh    키오스크배포/ → 키오스크배포.zip (전달용, .gitignore·재생성 가능)
  make-manual.py   운영문서 .md → 배포용 PDF (화면 그림을 헤드리스 크롬으로 촬영·삽입)
```

> **운영문서 PDF**: `운영문서/*.md` 가 원본이고 PDF는 항상 다시 만든다.
> 서식을 추가하면 `.md` 를 고치고 `python tools/make-manual.py` 를 돌릴 것.
> 그림은 `![캡션](fig:이름)` 으로 넣고, 이름은 `make-manual.py` 의 `FIGURES` 에 정의한다.

## 새 서식 만들기

```bash
# 1) 배경 이미지 준비 (PyMuPDF 필요)
python tools/prep-bg.py death 사망신고서.pdf

# 2) forms/death.config.js 작성 (forms/birth.config.js 참고)
#    - 좌표는 PDF 텍스트/격자선 추출로: get_text('words') + get_drawings()

# 3) 생성
node tools/build-form.js death            # → death-helper-v1.html
node tools/build-form.js death _gen.html  # 검증용 임시 출력

# 4) index.html 허브에 href 연결

# 5) 배포 3곳 동기화 (루트 → 키오스크배포/ · kiosk-app/app/)
bash tools/sync-kiosk.sh          # 복사
bash tools/sync-kiosk.sh --check  # 커밋 전 드리프트 검증(다르면 exit 1)

# 6) 담당자 전달용 압축본 갱신 (필요할 때만)
bash tools/pack-kiosk.sh          # 키오스크배포/ → 키오스크배포.zip (내부에서 --check 선행)
```

> **드리프트 주의**: 배포 HTML은 루트(원본) / `키오스크배포/` / `kiosk-app/app/` 3곳에
> 사본이 존재한다. **항상 루트 파일만 수정**하고 `sync-kiosk.sh` 로 두 배포 위치를 맞출 것.
> 기존 서식(혼인·이혼·출생 등 손작성본 포함)을 고칠 때도 동일하게 루트 수정 후 동기화한다.

## config(FORM) 인터페이스

| 키 | 설명 |
|---|---|
| `docTitle` / `formName` | 상단 제목 / 모달·배경 alt |
| `org` | `{orgName, officeName}` |
| `sampleLabels` / `sampleKinds` | 작성예시 버튼 2개 라벨 / 종류 키 |
| `rerenderOnSet` | 선택 시 조건부 입력칸 갱신이 필요한 필드 목록 |
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

단계 `body(A)`는 `A.inputHtml/choiceHtml/toggleHtml/sumRow/state/formatMoney/digits/…`를 써서 HTML 문자열을 반환합니다.

입력칸 `type` : `text`(기본) · `jumin`(6-7 하이픈) · `phone`(02는 2자리 지역번호) · `money`(3자리 콤마) · `date`(숫자 8자리 → yyyy.mm.dd, blur 시).

### 참고할 config

| 파일 | 성격 |
|---|---|
| `forms/naming.config.js` | 가장 단순한 표준형 신고서 |
| `forms/death.config.js` | 다지선다 + 조건부 상세 입력 |
| `forms/birth.config.js` | 필드가 많은 복잡한 신고서 |
| `forms/cert.config.js` | 체크박스 + 통수(건수) 위주 |
| `forms/realestate.config.js` | 금액·면적·지분 위주, 조건부 구역(외국인·중개사·종전 부동산)이 많은 서식 |

## 검증

`birth.config.js` + 엔진으로 생성한 결과는 손으로 만든 `birth-helper-v1.html`과 **인쇄 출력 픽셀 완전 동일**함을 확인했습니다(혼인 중/혼인 외 예시 각 0px 차이). 기존 배포 3종(혼인·이혼·출생)은 그대로 두고, 엔진은 신규 서식(사망·개명 등)에 사용합니다.
