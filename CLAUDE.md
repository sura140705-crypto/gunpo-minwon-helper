# 이 리포에서 작업할 때 (에이전트·개발자 공용 지침)

군포시 민원실 키오스크용 **신청서 작성 도우미 8종**. 실제 관공서 서식 이미지를 배경으로 깔고
절대좌표로 값을 얹어 인쇄한다. 전체 지도는 `README.md`, 서식 제작법은 `engine/README.md`.

**작업 시작 전에 `docs/GOTCHAS.md` 를 읽어라.** 이 프로젝트는 조용히 실패하는 함정이 많다
(치환이 0건 매칭되고, PDF가 몇 분 뒤 암호화되고, 인쇄물만 어긋나는 식). 대부분 그 문서에 있다.

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

> ⛔ **엔진 5종의 루트 HTML을 직접 고치지 마라.** 다음 재빌드에 조용히 덮인다.
> ⛔ **`kiosk-app/app/` 안의 파일을 직접 고치지 마라.** 원본은 루트다.

## 2. 끝내기 전에 반드시 통과시켜야 하는 것

```bash
python tools/verify-print.py            # 인쇄물 회귀 — 8종×예시2 = 19쪽, "전부 0px"가 기본값
python tools/verify-print.py --electron # 키오스크와 같은 Electron 조판 + 용지(A4) 검사
bash tools/sync-kiosk.sh --check        # 루트 → kiosk-app/app 드리프트 — 다르면 exit 1
node --check <고친 파일>.js              # 문법(엔진·config)
```

`--electron` 은 **인쇄 옵션(`kiosk-app/print-options.js`)·Electron 버전·인쇄 CSS** 를 건드렸을 때 필수다.
기본값(크롬)만으로는 **실제 인쇄가 지나가는 경로를 못 본다** — 2026.08.12 의 용지 사고가 그 틈으로 빠져나갔다
(`docs/GOTCHAS.md ㉝`). 기준선은 하나이고 두 경로가 같은 결과를 내야 하므로 `--electron --update` 는 막혀 있다.

`verify-print.py` 가 **이 프로젝트의 유일한 안전망**이다. 좌표·서식·엔진·CSS를 건드렸으면
반드시 돌리고 결과를 보고에 적어라. 인쇄물이 달라졌는데 그게 의도였다면
`--update` 로 기준선을 갱신하고 **왜 달라졌는지 `CHANGELOG.md` 에 남겨라**. 설명 없이 갱신하지 마라.

화면(코치 패널)만 고쳤어도 인쇄물 0px를 확인하는 편이 안전하다 — 실수로 인쇄 CSS를 건드리는 일이 잦다.

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

## 6. 다른 기관에 확산할 때

지역 고유값(기관명·부서·연락처·로고·앱 이름)은 `python tools/rebrand.py` 로 일괄 교체한다.
절차는 `docs/타지자체-확산.md`. 서식 좌표맵은 법정 별지서식 기준이라 전국 공통으로 재사용된다.
