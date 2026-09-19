# 군포시 민원 서식 작성 도우미

> 🚧 **시범운영 중입니다 (2026.08~).** `main` 은 현장 피드백을 반영하며 계속 바뀝니다.
> **다른 기관에서 가져다 쓰실 때는 `main` 이 아니라 태그를 받으십시오** —
> 현재 현장에서 도는 판은 [`v1.5.0-pilot`](../../releases/tag/v1.5.0-pilot) 입니다
> (태그 번호는 그 판으로 만든 **키오스크 설치본 버전**과 같습니다).
> 변경 이력은 [`CHANGELOG.md`](CHANGELOG.md).
> 확산 절차는 [`docs/타지자체-확산.md`](docs/타지자체-확산.md), 라이선스는 공공누리 제1유형([`LICENSE`](LICENSE)).
>
> ⛔ **옛 태그 [`v0.9-pilot`](../../releases/tag/v0.9-pilot)(2026.08.03)은 받지 마십시오.**
> **인쇄 용지를 A4로 명시하기 전(2026.08.12)** 판이라, 그것으로 설치본을 만들면
> Electron 이 서식 CSS 를 무시하고 Letter 로 조판해 **인쇄물이 어긋납니다.**

민원실을 찾은 시민이 **신청서를 손으로 채우기 전에** 화면 안내를 따라가며 서식을 완성해
그대로 인쇄하는 키오스크 앱. 현재 서식 **8종**.

- 어르신 친화 — 큰 글씨·고대비·한 번에 한 가지만 묻는 단계 진행
- **양식 위 작성** — 실제 관공서 서식을 배경으로 깔고 절대좌표로 값을 얹어, 인쇄하면 서식 원본 그대로
- **무저장** — 입력값은 메모리에만 존재. 파일·서버 기록 0, 외부 통신 0 → 완전 오프라인
- **자체완결 HTML** — 서식 이미지·글꼴·로직이 파일 하나에 들어 있어 `file://` 로 바로 열림
- **규칙 기반** — 실행 경로에 모델 추론이 없다. 같은 답을 넣으면 **언제나 같은 종이**가 나온다
  (AI 는 만드는 과정에 썼다). 나가는 것이 판독기를 타는 법정 별지서식이라 그렇게 정했다
- **기관 설정은 화면에서** — 기관표기·대표색·취급 서식·신고관청을 환경설정 창에서 바꾼다.
  **배포본 하나로 여러 기관이 쓴다**(고유값 일괄 교체는 `tools/rebrand.py`)
- **한자 찾기** — 이름 한자를 음으로 찾아 글자마다 고른다. 표를 내장해 **통신 없이** 동작(6종)
- **운영 통계** — 개인정보 없이 이용 현황만 남긴다(접속·인쇄·유휴·가동시간·서식별 완주)

## 문서

이 파일은 **개발자용 지도**다. 「무엇을 왜 만드는가」는 아래에 있다.

| | |
|---|---|
| [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) | **무엇을 만들고 있으며 왜 만드는가** — 처음 오셨다면 여기부터 |
| [`docs/디자인검토/DESIGN_PHILOSOPHY.md`](docs/디자인검토/DESIGN_PHILOSOPHY.md) | 어떤 원칙으로 디자인하는가 (기준 문서) |
| [`docs/UX_DECISIONS.md`](docs/UX_DECISIONS.md) | 무엇을 고민했고 **왜 그렇게 정했는가** |
| [`docs/EXPANSION_PLAYBOOK.md`](docs/EXPANSION_PLAYBOOK.md) | 새 서식·다른 기관으로 어떻게 넓히는가 |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | **앞으로 어디로 가는가** — 플랫폼·콘텐츠 분리와 장기 방향 |
| [`docs/history/`](docs/history/) | 화면이 어떻게 여기까지 왔는가 |
| [`AGENTS.md`](AGENTS.md) | 이 리포에서 작업할 때의 지침 — **고치기 전에 읽는다** |

## 서식 8종

| 배포 파일 | 서식 | 만드는 방식 |
|---|---|---|
| `passport-helper-v1.html` | 여권발급신청서 (미성년 법정대리인 동의서·위임장 자동 첨부) | 손작성 |
| `marriage-helper-v1.html` | 혼인신고서 (양식 제10호) | 엔진 |
| `divorce-helper-v1.html` | 이혼(친권자 지정)신고서 (양식 제11호) | 엔진 |
| `birth-helper-v1.html` | 출생신고서 (양식 제1호) | 엔진 |
| `death-helper-v1.html` | 사망신고서 (양식 제19호) | 엔진 |
| `naming-helper-v1.html` | 개명신고서 (양식 제27호) | 엔진 |
| `cert-helper-v1.html` | 가족관계 등록사항별 증명서 교부 등 신청서 (별지 제11호) | 엔진 |
| `realestate-helper-v1.html` | 부동산거래계약 신고서 (+당사자·부동산 추가 별지) | 엔진 |
| `index.html` | 허브 — 4개 구역(여권 / 가족관계등록 신고 / 증명서 발급 / 부동산) | — |

**손작성**은 그 HTML 자체가 원본이고, **엔진**은 `forms/<이름>.config.js` 를 원본으로 두고 빌드해 만든다.

## 어디를 고쳐야 하는가

가장 자주 틀리는 지점이라 먼저 적는다.

| 고칠 것 | 고칠 파일 | 뒤이어 할 일 |
|---|---|---|
| 손작성(여권) 내용 | `passport-helper-v1.html` | `sync-kiosk.sh` |
| 엔진 7종 내용 | `forms/<이름>.config.js` | `build-form.js` 재빌드 → `sync-kiosk.sh` |
| 8종 공통 동작 (유휴 초기화·인쇄 안내 모달·CSS 등) | `engine/engine.js` · 껍데기 `engine/base-product.html` **와** 여권에 같은 내용 손수 반영 | 엔진 7종 재빌드 → `sync-kiosk.sh` |
| 허브 메뉴 | `index.html` | `sync-kiosk.sh` |
| 운영·제출 문서 | `운영문서/*.md` (원본) | 필요할 때 `make-manual.py` 로 PDF 재생성 |

> ⚠️ **엔진 7종의 루트 HTML을 직접 고치지 말 것** — 다음 재빌드에 덮여 사라진다.
> ⚠️ **배포 HTML은 사본이 하나 있다** (루트 = 원본 / `kiosk-app/app/`).
> 항상 루트만 고치고 `bash tools/sync-kiosk.sh` 로 맞춘 뒤, 커밋 전 `--check` 로 확인한다.

## 디렉터리

```
gunpo_minwon/
├─ AGENTS.md         ☞ 작업 지침(원본·생성물 구분, 필수 검증, 금지사항) — 고치기 전에 읽는다
│                     Claude Code·Codex·사람 공용. CLAUDE.md 는 이 파일을 불러오는 한 줄짜리다
├─ index.html, *-helper-v1.html (8종)   배포 원본 ★루트 고정(상대경로·file:// 실행)
├─ engine/          공통 엔진 — base-product.html(껍데기) · engine.js · hanja-table.js · assets/*.b64(배경, 재생성물)
│   └─ README.md    ☞ 새 서식 만들기 · FORM(config) 인터페이스 · 좌표 잡는 법
├─ forms/           엔진 서식 7종의 config (좌표맵·필드·단계·작성예시)
├─ tools/           빌드·동기화·문서·로고 도구 (아래 표)
├─ assets/          logo.png (기관 로고 — 허브·입력 패널 머리에 base64로 박음)
├─ 서식원본/         관공서 서식 원본 PDF·HWP — prep-bg.py 의 입력. 앱 실행과 무관
│                   ⛔ 같은 서식의 파일이 둘이면 **어느 것이 현행인지** 각 config 머리말이 정한다.
│                     출생신고서 = `출생신고서(20260828).pdf` 가 현행 ·
│                     `출생신고서.pdf` 는 구본(통계청 표기)이고 대조용이다
├─ 운영문서/         시청 제출·현장용 문서. **.md 가 원본**, PDF는 재생성물
├─ kiosk-app/       배포(Electron 설치본) — main.js(키오스크 통제)·preload.js·app/(사본 9개)
│   └─ admin/      관리자 설정 스크립트 · 인쇄실패·점검 안내 화면
├─ tests/baseline/  인쇄물 기준선 이미지 19쪽 (verify-print.py 가 비교하는 대상)
├─ PROJECT_OVERVIEW.md  ☞ 무엇을 왜 만드는가 (개요·현황·용어)
├─ docs/            GOTCHAS.md(함정 목록) · 타지자체-확산.md · archive/(과거 인계 문서)
│   ├─ UX_DECISIONS.md       ☞ 왜 그렇게 정했는가 (의사결정 기록)
│   ├─ EXPANSION_PLAYBOOK.md ☞ 새 서식·다른 기관으로 넓히는 절차
│   ├─ history/              ☞ 화면 변화의 시각적 기록
│   └─ 디자인검토/           DESIGN_PHILOSOPHY.md(기준) · 구조동결 · 갈무리 · 밖에 넘기는 묶음
├─ CHANGELOG.md     시범운영 피드백 반영 이력
└─ LICENSE          공공누리 제1유형(출처표시)
```

## 도구

| 도구 | 하는 일 |
|---|---|
| `python tools/prep-bg.py <이름> 서식원본/<서식.pdf>` | 서식 1쪽 → `engine/assets/<이름>.b64` 배경 |
| `node tools/build-form.js <이름>` | base + engine + config + 배경 → 자체완결 `<이름>-helper-v1.html` |
| `bash tools/sync-kiosk.sh [--check]` | 루트 배포 HTML 9개 → `kiosk-app/app/` 동기화(검증) |
| `python tools/verify-print.py [--update]` | **인쇄물 회귀 검증** — 8종×예시2 = 19쪽을 `tests/baseline/` 과 픽셀 비교 |
| `python tools/verify-print.py --electron` | 같은 19쪽을 **키오스크와 같은 Electron 조판**으로 검증 + 용지(A4) 검사 |
| `python tools/check-site-block.py [--fix]` | 기관별 설정 블록(`<!--SITE-CONFIG v1-->`)이 9개 화면에서 같은지 |
| `python tools/check-design-tokens.py [--fix]` | 디자인 토큰 블록(`<!--DESIGN-TOKENS v1-->`)이 9개 화면에서 같은지 |
| `python tools/check-icons.py` | 선 아이콘이 9개 화면에서 **같은 그림**인지 (이름만 같고 갈라지는 것을 잡는다) |
| `python tools/verify-site-config.py [--preview …]` | **화면 회귀 검증** — 환경설정 값이 화면에 실제로 걸리는지(6가지 조합) |
| `python tools/measure-screen.py [--baseline]` | **화면 구조 실측** — 가로 넘침·종이 축소가 새로 생기면 실패(나빠진 것만 본다) |
| `python tools/verify-review.py` | **Review·인쇄 준비 화면 실측**(8종×2) — 「총 N장」이 맞는지, [수정]이 실제로 그 단계로 가는지 |
| `electron tools/print-electron.js <입력.html> <출력.pdf>` | `verify-print.py --electron` 이 부르는 렌더러 — 키오스크와 같은 Electron 조판 |
| `python tools/build-hanja-table.py` | 한글 음절 → 한자 후보·훈음 표 생성 → `engine/hanja-table.js` (원본 Unihan·libhangul) |
| `python tools/design-shots.py [--only …]` | 디자인 검토용 화면 갈무리 → `docs/디자인검토/shots/` + `현재-스타일.css` |
| `python tools/design-bundle.py` | 그 자료를 밖에 넘길 묶음으로 → `_디자인검토/`(폴더 + zip) |
| `tools/calibration-sheet.html` | **프린터 검수지** — 인쇄해서 기기별 인쇄 불가 영역·배율을 재고 기록(설치 검수용) |
| `python tools/rebrand.py --city ○○시 …` | 지역 고유값(기관명·부서·연락처·로고) 일괄 교체 → 타 지자체 확산 |
| `python tools/make-manual.py [입력.md] [출력.pdf]` | 운영문서 `.md` → 배포 PDF (화면 그림을 헤드리스 크롬으로 촬영·삽입) |
| `python tools/embed-logo.py [--remove]` | 로고를 허브·입력 패널에 base64 삽입 |
| `python tools/make-icon.py` | 로고 → `kiosk-app/build/icon.ico` (Electron 앱 아이콘) |

자세한 사용법과 새 서식 추가 절차는 **`engine/README.md`**.

## 배포

**Electron 설치본** — `cd kiosk-app && npm run dist` → NSIS 설치본·portable.
배포 방식은 이것 하나다(2026.08 보안성 검토 대응으로 크롬 키오스크 방식은 폐지).

키오스크 통제는 전부 `kiosk-app/main.js` 에 있다.

- **인쇄** — 대화상자를 열지 않고 **설정에 지정된 실물 프린터로만** 출력. 여백 없음·배율 100%·배경 인쇄를 코드로 고정.
  보호 장치가 걸리지 않으면 **인쇄를 하지 않는다**(안내 화면으로 멈춘다). 남은 인쇄 작업은 회수한다.
- **화면** — sandbox·devTools 차단, `app/`·`admin/` 밖으로 이동 차단, 새 창·권한 요청 차단.
- **실행** — 중복 실행 차단, 종료는 관리자 PIN(`Ctrl+Shift+Q`) · 첫 화면 복귀 `Ctrl+Shift+H`.
- **개인정보** — 저장소·크래시덤프를 임시 경로에 두고 시작·종료 때 지운다. 창을 벗어나면 첫 화면으로 초기화.

**설치 PC에서 반드시 1회** — `kiosk-app/admin/관리자_개인정보보호_설정.bat` (관리자 권한)

```
/status              프린터 이름 확인 (변경 없음)
/only "프린터이름"    그 프린터만 남기고 지정 + 가상 프린터 제거 + 대기열 잔존 방지
/pin                 관리자 종료 PIN 설정
```

설정은 `%ProgramData%\군포민원서식도우미\kiosk.json` 에 기록되고 프로그램이 시작할 때 읽는다.
**프린터를 지정하지 않으면 인쇄되지 않는다.** 적용 결과는 `군포민원서식도우미.exe --selfcheck` 로 확인한다.

> ⚠️ Alt+Tab·Windows 키 차단은 프로그램이 할 수 없다 — 전용 계정 + 셸 교체 등 OS 설정의 몫이다.
> 상세는 `운영문서/붙임3_키오스크_설치운영_안내.md`.

## 개인정보 보호 (설계 전제)

- **기록 없음** — 입력값은 메모리 전용. 저장·전송·로그 없음, 외부 통신 0
- **3분 무동작** → 마지막 30초 카운트다운 경고 → 허브로 이동(입력값 소멸)
- **인쇄 직후** 화면을 즉시 가리고 5초 뒤 허브로 (브라우저가 인쇄/취소를 구분해 주지 않아 **취소해도 초기화**된다 — 인쇄 전 안내에 명시)
- **인쇄 전 안내 모달** — 여백 없음·배율 100% + 출력물 개인정보 주의
- **'PDF로 저장' 차단은 PC 설정 몫** — 앱(JS)으로는 인쇄창 목적지를 제어할 수 없다

## 검증 관행

- 서식 변경은 **인쇄물 픽셀로 검증**한다 — `python tools/verify-print.py` 가 8종×예시2 = 19쪽을 `tests/baseline/` 과 비교한다. **"전부 0px"가 기본값**이고, 달라졌다면 이유를 설명할 수 있어야 한다(설명 없이 `--update` 금지)
- 검증용 렌더·스크린샷·분석 스크립트는 **`_` 로 시작**해 이름 짓는다(`.gitignore` 처리됨)
- ⚠️ 이 PC의 DRM 에이전트가 새로 만든 PDF를 몇 분 뒤 암호화한다 → **생성과 분석을 한 스크립트 안에서** 끝낼 것(나중에 열면 `no objects found`)
- ⚠️ **날짜는 `2026.08.04` 처럼 점으로 쓴다.** 연·월·일을 하이픈으로 끊는 표기는 DRM/DLP가 개인정보(주민등록번호 등)로 오인해 **문서를 암호화**해 버린다 — 점 표기는 통과한다. 전화·주민번호 형태의 예시도 문서 본문에는 넣지 않는다
- 커밋 전 `bash tools/sync-kiosk.sh --check`

## 다른 기관이 가져다 쓰는 법

서식 좌표맵 8종은 **법정 별지서식 기준이라 전국 공통**이다. 바꿀 것은 기관 표기·부서·연락처·로고뿐.

대부분은 **코드를 고치지 않고 환경설정 창(`Ctrl+Shift+S`)에서 끝난다** — 기관표기·대표색·
취급 서식·신고관청 표기·여권 접수 기준이 거기에 있다. 즉 **같은 배포본을 여러 기관이 쓴다.**
리포 안에 박힌 고유값(앱 이름·로고·문서의 기관명)까지 한 번에 바꿀 때만 아래를 쓴다.

```bash
python tools/rebrand.py --city 안양시 --dry-run    # 무엇이 바뀌는지 미리보기
```

절차·체크리스트·유지보수를 AI에게 맡길 때 줄 지시문은 **`docs/타지자체-확산.md`**.
라이선스는 **공공누리 제1유형(출처표시)** — 상업적 이용·변형 모두 가능(`LICENSE`).
단, **군포시 로고와 서식 원본은 적용 대상이 아니다**(로고는 각 기관 것으로 교체).

## 현재 상태 (2026.09.04)

서식 8종 **시범운영 중**. 화면 조형은 8종 전부 Product UI v1 로 통일했고(2026.08.29),
현장에서 도는 키오스크 설치본은 **1.5.0**(2026.09.04) 이다.
시범운영 기간에는 파생 산출물(운영문서 PDF·Electron 설치본) **재생성을 멈추고** 현장 피드백을 모은다.
반영 이력은 `CHANGELOG.md`.

지나온 자리 — 보안성 검토(보고서·조치결과서) 완료, `운영문서/` 붙임1~4 플레이스홀더 기입 완료.

남은 일

- **공통 마감 단계 ①~⑤** — 실사용 QA · Review/미리보기 단순화 · 색 · 아이콘 · 모션
  (개별 서식을 다시 열지 않고 8종에 한 번에 적용한다 — `AGENTS.md` §5-1)
- **사람이 기기 앞에서 확인할 것 셋** — 부동산 「받는 곳」 실물 인쇄 · 환경설정 통계 탭 ·
  3분 유휴 중도 이탈
- (온라인 배포용 후보) 도로명주소 검색 연동 — 키오스크는 오프라인 유지

## 향후 확장 방향

지금은 서식 8종을 직접 구현해 두었지만, 길게 보면 **개별 신청서를 계속 직접 개발하기보다
공통 작성지원 플랫폼과 신청서별 콘텐츠를 분리하는 구조**를 지향한다.

법정 신청서 한 종을 **콘텐츠 한 단위**로 관리하고, 실제 업무 담당자가 AI의 도움을 받아
질문·분기·도움말을 작성·수정·검증하며, 전국 공통서식은 기관 간 재사용할 수 있는 구조로
넓히는 것을 검토하고 있다.

⛔ **실행 단계의 원칙은 바뀌지 않는다** — 시민이 쓰는 화면에서 생성형 AI가 민원 내용을
실시간으로 판단하게 만들지 않는다. AI 는 콘텐츠를 **만드는 단계**에만 둔다.

자세한 내용과 현재 구현 범위와의 구분은 **[`docs/ROADMAP.md`](docs/ROADMAP.md)**.
