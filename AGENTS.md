# 이 리포에서 작업할 때 (에이전트·개발자 공용 지침)

군포시 민원실 키오스크용 **신청서 작성 도우미 8종**. 실제 관공서 서식 이미지를 배경으로 깔고
절대좌표로 값을 얹어 인쇄한다. 전체 지도는 `README.md`, 서식 제작법은 `engine/README.md`.

**작업 시작 전에 `docs/GOTCHAS.md` 를 읽어라.** 이 프로젝트는 조용히 실패하는 함정이 많다
(치환이 0건 매칭되고, PDF가 몇 분 뒤 암호화되고, 인쇄물만 어긋나는 식). 대부분 그 문서에 있다.

> 이 파일이 **에이전트 지침의 원본**이다. Claude Code(`CLAUDE.md`)·Codex(`AGENTS.md`)·사람이
> 같은 문서를 본다. 지침을 고칠 일이 있으면 **이 파일만** 고쳐라.

## 0. 개발 환경 (현장 PC 기준)

| 필요한 것 | 확인 | 없으면 |
|---|---|---|
| Windows + **Git Bash**(`bash`) | `bash --version` | `tools/*.sh` 가 안 돈다. PowerShell·cmd 로는 실행하지 마라 |
| Python 3 (`python`) + `Pillow` · `PyMuPDF` | `python -c "import PIL, fitz"` | `pip install pillow pymupdf` |
| Node.js | `node -v` | 엔진 빌드(`tools/build-form.js`)가 안 돈다 |
| Chrome (기본 경로 설치) | `tools/verify-print.py` 의 `CHROME_CANDIDATES` | 인쇄 검증의 **기준선 경로**가 막힌다 |
| Electron | `kiosk-app/node_modules/electron/dist/electron.exe` | `cd kiosk-app && npm install` |

- 앱 자체는 **의존성이 없다.** 서식 HTML 은 자체완결이라 `file://` 로 그냥 열린다.
  위 도구들은 **빌드·검증용**이다.
- 파일명·경로에 **한글이 있다**(`서식원본/`·`운영문서/`). 경로를 다룰 때 인코딩을 깨뜨리지 마라.
- 인쇄 검증은 Chrome·Electron **프로세스를 띄우고 임시 PDF를 만든다.** 샌드박스가 있는
  에이전트라면 프로세스 실행·파일 쓰기 승인이 필요하다. 네트워크는 쓰지 않는다.
- Git Bash 에서 `/status` 같은 인자는 경로로 바뀐다. `MSYS_NO_PATHCONV=1` 을 앞에 붙인다.

## 1. 원본이 무엇인지 먼저 확인한다

| 배포되는 것 | 그것의 원본 | 고치는 법 |
|---|---|---|
| `birth·death·naming·cert·realestate-helper-v1.html` | **`forms/<이름>.config.js`** | config 수정 → `node tools/build-form.js <이름>` |
| `passport·marriage·divorce-helper-v1.html` | **그 HTML 자체**(손작성) | 파일 직접 수정 |
| 8종 공통 동작·CSS | **`engine/engine.js`·`engine/base.html`** + 손작성 3종 | 엔진 수정 → 5종 재빌드 → 손작성 3종에 같은 내용 손수 반영 |
| `index.html`(허브) | 그 파일 | 직접 수정 |
| `운영문서/*.pdf` | **`운영문서/*.md`** | `.md` 수정 → `python tools/make-manual.py …` |
| `kiosk-app/app/` 안의 HTML | **루트의 같은 파일** | 루트 수정 → `bash tools/sync-kiosk.sh` |
| 키오스크 동작·보안·인쇄 통제 | **`kiosk-app/main.js`·`preload.js`** | 직접 수정 → `--selfcheck` 로 확인 |
| 인쇄 조판(용지·여백·배율) | **`kiosk-app/print-options.js`** | 수정 → `verify-print.py --electron` |
| 기관별 설정 적용(SITE-CONFIG 블록) | **`engine/base.html`** 의 `<!--SITE-CONFIG v1-->` | 수정 → 5종 재빌드 → `python tools/check-site-block.py --fix` |
| 디자인 값 — 색·반경·간격·글자 크기 | **`engine/base.html`** 의 `<!--DESIGN-TOKENS v1-->` | 수정 → 5종 재빌드 → `python tools/check-design-tokens.py --fix` |
| 환경설정 창의 항목 | **`kiosk-app/admin/settings.html`** + `main.js` 의 `ORG_KEYS`·`POLICY_KEYS`·`FORM_KEYS` | 양쪽 이름이 같아야 한다 |

> ⛔ **엔진 5종의 루트 HTML을 직접 고치지 마라.** 다음 재빌드에 조용히 덮인다.
> ⛔ **`kiosk-app/app/` 안의 파일을 직접 고치지 마라.** 원본은 루트다.

## 2. 끝내기 전에 반드시 통과시켜야 하는 것

```bash
python tools/verify-print.py            # 인쇄물 회귀 — 8종×예시2 = 19쪽, "전부 0px"가 기본값
python tools/verify-print.py --electron # 키오스크와 같은 Electron 조판 + 용지(A4) 검사
bash tools/sync-kiosk.sh --check        # 루트 → kiosk-app/app 드리프트 — 다르면 exit 1
python tools/check-site-block.py        # 기관별 설정 블록이 9개 화면에서 같은지 — 다르면 exit 1
python tools/check-design-tokens.py     # 디자인 토큰 블록이 9개 화면에서 같은지 — 다르면 exit 1
python tools/verify-site-config.py      # 환경설정 값이 화면에 걸리는지(6가지 조합) — 다르면 exit 1
python tools/measure-screen.py          # 화면 구조 실측 — 가로 넘침·종이 축소가 생기면 exit 1
node --check <고친 파일>.js              # 문법(엔진·config·kiosk-app)
```

`verify-print.py` 가 **인쇄물**을 지키고, `verify-site-config.py` 가 **화면**을 지킨다.
기관별 설정(기관표기·대표색·취급 서식·여권 접수 기준)을 건드렸으면 뒤엣것을 돌려라 —
설정 하나가 화면 흐름을 통째로 바꿀 수 있는데 인쇄물은 그대로라서 `verify-print.py` 가 아무 말도 하지 않는다.
색·로고를 눈으로 볼 때는 `--preview` 를 쓴다(`--preview index.html --color "#0f6b4f"`).

`--electron` 은 **인쇄 옵션(`kiosk-app/print-options.js`)·Electron 버전·인쇄 CSS** 를 건드렸을 때 필수다.
기본값(크롬)만으로는 **실제 인쇄가 지나가는 경로를 못 본다** — 2026.08.12 의 용지 사고가 그 틈으로 빠져나갔다
(`docs/GOTCHAS.md ㉝`). 기준선은 하나이고 두 경로가 같은 결과를 내야 하므로 `--electron --update` 는 막혀 있다.

`verify-print.py` 가 **이 프로젝트의 유일한 안전망**이다. 좌표·서식·엔진·CSS를 건드렸으면
반드시 돌리고 결과를 보고에 적어라. 인쇄물이 달라졌는데 그게 의도였다면
`--update` 로 기준선을 갱신하고 **왜 달라졌는지 `CHANGELOG.md` 에 남겨라**. 설명 없이 갱신하지 마라.

화면(코치 패널)만 고쳤어도 인쇄물 0px를 확인하는 편이 안전하다 — 실수로 인쇄 CSS를 건드리는 일이 잦다.

**화면 조형을 바꿨으면 `measure-screen.py` 를 돌려라.** `verify-print.py` 는 인쇄 경로만 보므로
화면이 망가져도 19쪽 0px 는 그대로 통과한다 — 그 틈을 이 도구가 메운다.
⛔ 픽셀을 고정하는 도구가 아니다. **나빠진 것만** 실패로 본다(가로 넘침이 새로 생김 · 종이가
기준선보다 작아짐 · 측정 실패). 값이 달라지는 것은 정상이고, 의도한 변화면
**왜 달라졌는지 적고** `--baseline` 으로 기준선(`tests/screen-baseline.json`)을 갱신한다.
눈으로 볼 것은 `python tools/design-shots.py` 갈무리가 맡는다 — 둘은 같은 상태 스크립트를 쓴다.

## 3. 하지 말 것

- **파생 산출물을 요청 없이 재생성하지 마라** — 운영문서 PDF·Electron 설치본.
  현재 시범운영 기간이라 사용자가 재생성을 멈춰 두었다(`CHANGELOG.md` 참조).
- **`kiosk-app/admin/관리자_개인정보보호_설정.bat` 을 적용·되돌리기 모드로 실행하지 마라.**
  관리자 권한이면 **실제로 프린터가 삭제된다.** 점검은 `/preview`(무변경) 또는 `/status` 로만.
  Git Bash 에서는 `/status` 가 경로로 바뀌므로 `MSYS_NO_PATHCONV=1` 을 앞에 붙인다.
- 개인정보를 리포에 넣지 마라. 작성예시는 전부 가상 인물이어야 한다.
- 서식 좌표를 "대충 맞으면 됨"으로 넘기지 마라. 인쇄물은 판독기·창구 접수용이다.

## 4. 검증용 임시 파일

`_` 로 시작하는 이름을 쓴다(`_vp_*.png`, `_check.js` …). `.gitignore` 처리돼 있다.
남겨두지 말고 확인 후 지운다. 정식 도구로 승격할 값이 있으면 `tools/` 로 옮기고 문서화한다.

## 5. 문서·커밋

- **날짜는 `2026.08.04` 처럼 점으로 쓴다.** 연·월·일을 하이픈으로 끊으면 이 PC의 DRM/DLP가
  개인정보로 오인해 만들어진 문서를 암호화한다(`docs/GOTCHAS.md` 참조).
- 커밋 메시지는 한국어. 제목은 `영역: 무엇을 왜` 형태(`여권: 긴급여권은 면수도 12면 고정 — …`).
- 이 리포 관행은 **브랜치 없이 `main` 직접 커밋 후 푸시**다. 다만 커밋·푸시는 사용자가 요청할 때만 한다.
- 성격이 다른 변경은 커밋을 나눈다(코드 / 이동·정리 / 문서).
- 현장에서 온 의견을 반영했으면 `CHANGELOG.md` 에 **무엇을·왜·어디를·확인** 형식으로 남긴다.

## 5-1. 화면 조형 — **Product UI v1 이 기준점이다** (커밋 `1d735fc` · 2026.08.28)

여권에서 **Product Shell**(상단 BAR) · **Product Typography** · **ASK Component System**
(Button Role 4종·Navigation Zone) · **Handoff Family** · **크게 보기** · **한국어 조판**을
확정했다. 값은 전부 [`docs/PRODUCT_SKIN_v1.md`](docs/PRODUCT_SKIN_v1.md) 에 있다.

⛔ **이것들을 재설계하지 마라.** 새 서식을 붙일 때 UI 값을 새로 만들지 말고 **이식만** 한다 —
이식은 판단이 아니라 복제다. 서식마다 값이 갈라지면 「같은 제품」이 무너진다.

서식 하나를 붙이는 순서는 **다섯 단계**다(`docs/EXPANSION_PLAYBOOK.md` 가 각 단계의 세부):

1. **실제 서식·업무규칙 확인** — 법정 별지서식·소관 부서 기준
2. **질문 흐름·조건 정의** — 무엇을 언제 묻고 어디서 갈라지는지
3. **Product UI v1 이식** — `PRODUCT_SKIN_v1.md` 를 한 번에 적용
4. **인쇄 좌표 검증** — `verify-print.py --update` 로 기준선에 넣고 이유를 `CHANGELOG.md` 에
5. **회귀검증** — §2 의 도구 전부

⛔ 기존 공통 component 를 **서식별로 변형하지 마라.** Product UI v1 로 표현할 수 없는
**실제 업무 요구**가 나왔을 때만 새 component·variant 를 **제안하고 승인을 받는다.**
⛔ 여권 화면은 `1d735fc` 이후 **기능·업무규칙·인쇄·개인정보·접근성 결함**일 때만 연다.
미관상의 이유로 다시 열지 않는다.
📌 **Color & Visual Polish**(BAR tint·primary/secondary 위계·미리보기 강조도·Handoff 두
variant 의 톤·전체 색 농도)는 **별도 backlog** 다 — 서식 하나에서 색만 손대지 마라.

## 6. 다른 기관에 확산할 때

지역 고유값(기관명·부서·연락처·로고·앱 이름)은 `python tools/rebrand.py` 로 일괄 교체한다.
절차는 `docs/타지자체-확산.md`. 서식 좌표맵은 법정 별지서식 기준이라 전국 공통으로 재사용된다.

## 7. 사용자에게 보고할 때

- 한국어로 답한다(기술 식별자·파일명은 원문 그대로).
- **돌린 검증과 그 결과를 적는다.** 안 돌렸으면 안 돌렸다고, 왜 생략했는지 적는다.
- 인쇄물에 영향이 갈 수 있는 변경이면 그 사실을 먼저 말한다.
