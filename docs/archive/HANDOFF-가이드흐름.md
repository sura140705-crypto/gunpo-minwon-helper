# 여권발급신청서 작성 도우미 — 인계 문서 (작성 가이드 흐름)

> 이 문서를 이어받는 AI에게 그대로 전달하세요. 대상 작업은 **우측 "작성 코치" 가이드 흐름**의 개선·확장입니다.
> **좌측 서식 표기(오버레이 좌표)는 완성됐으니 건드리지 마세요.**

---

## 1. 프로젝트 목적
- 군포시 민원실 **키오스크/모바일용 여권발급신청서 작성 도우미**.
- 어르신 친화(큰 글씨·고대비), 한 화면에 **좌: 실제 서식 실시간 미리보기 / 우: 단계별 작성 코치**.
- 사용자가 어려워하는 항목(주민번호 자리, 로마자 표기, 긴급연락처, 등록기준지 등)을 쉬운 말로 안내.

## 2. 파일 / 실행 / 검증
- **단일 자체완결 파일**: `C:\gunpo_minwon\passport-helper-v1.html` (약 444KB, 대부분 배경 이미지 base64).
- 외부 리소스 **0** (CDN·폰트·이미지·서버 없음). 브라우저로 파일을 바로 열면 동작.
- **검증 방법(중요)**:
  - 로직: `<script>`만 추출해 `node --check`로 구문 검사.
  - 화면: **헤드리스 크롬으로 렌더 후 픽셀 확인**.
    ```
    "/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu \
      --screenshot=out.png --window-size=1400,2200 \
      "file:///C:/gunpo_minwon/passport-helper-v1.html"
    ```
  - ⚠️ **Read/이미지 뷰어 도구가 크롭 이미지를 캐싱해 낡은 화면을 보여주는 버그**가 있었음. 화면 검증은 **헤드리스 렌더 + PIL 픽셀 스캔**으로 하세요. 눈으로 본 크롭을 믿지 말 것.

## 3. 제약(반드시 유지)
- **단일 HTML, 외부 리소스 0.** 새 라이브러리/CDN/폰트 추가 금지.
- **저장 0.** localStorage 등 사용 금지. `state`는 메모리 전용, 새로고침 시 소멸.
- **개인정보 원칙**: 이름·주민번호 등은 브라우저 메모리에서만 처리, 서버 전송·저장 절대 금지.
- **재사용성**: 상단 `ORG_CONFIG`(지자체명·창구명·전화 등)만 바꾸면 다른 민원실에 재사용. 하드코딩 지양.
- 어르신 친화 톤(큰 글씨·쉬운 말·"모르겠어요" 배려) 유지.

## 4. 이미 완성된 부분 (수정 금지 영역)
- **좌측 서식 표기 = `CO` 맵 + `renderForm()`** (파일 line ~537~625).
  - `CO.checks`(체크 ✔), `CO.grids`(격자칸 값), `CO.texts`(자유텍스트 regBase/mailAddr), `CO.sign`(서명란 성명·작성일).
  - 좌표계 = **794×1123 (PW,PH)**. 배경 이미지는 A4 동일비율이라 `%`로 환산.
  - 주민번호 6+대시+7, 연락처/성명 칸 폭, 로마자 간격, 서명란 성명·날짜 자동기입, 등록기준지 안내문 옅게 처리(흰 덮개 `.cover` + 연회색 재렌더 `.guide`) — **모두 완료·검증됨.**
  - ⚠️ 좌표를 다시 만질 일이 있으면: **측정 시 x범위를 넉넉히** 잡을 것(라벨 제외 후 입력영역 전체). 과거 x범위를 좁게 잡아 100px 오측정한 사고 있었음.

## 5. 당신이 작업할 부분: 가이드 흐름
### 데이터 모델
- `createEmptyState()` → `state = { step, unsure:{}, data:{...} }` (line ~257).
- `data` 필드(서식 항목과 1:1):
  `kind, travelType, pages, period` / `nameKor, jumin, phone` / `emgName, emgRel, emgPhone` / `hasPassport, romanSur, romanGiven, regBase` / `spouseRoman, braille, mailService, mailAddr`.

### 흐름 정의 = `STEP_DEFS` (line ~280~421, **11단계**)
각 단계 객체 구조:
```js
{
  title:"단계 제목",
  why:"이 항목을 왜/언제 적는지 쉬운 설명",
  groups:[   // 큰 선택 버튼(라디오형)
    { field:"kind", label:"...", req:true, opts:[...], cond:fn? }
  ],
  inputs:[   // 타이핑 입력
    { field:"nameKor", label:"...", req:true, type:"text|tel",
      mask:"jumin|phone"?, inputmode?, maxlength?, ph:"플레이스홀더", hint:"도움말", upper:true? }
  ],
  condInputs:[ // 조건부 입력(cond가 참일 때만)
    { field:"mailAddr", ..., cond:function(d){ return d.mailService==="희망"; } }
  ]
}
```
- 단계 순서: ①여권종류 ②면수 ③기간 ④한글성명 ⑤주민번호 ⑥본인연락처 ⑦긴급연락처(성명·관계·전화) ⑧기존여권여부+로마자(성/이름) ⑨등록기준지 ⑩선택기재(배우자로마자·점자·우편+상세주소) ⑪요약/미리보기.
- 조건부 로직 예: `travelType`은 `kind==="여행증명서"`일 때만, `mailAddr`은 `mailService==="희망"`일 때만.

### 렌더/네비게이션 (line ~707~)
- `renderStep()` — 현재 `state.step`의 STEP_DEFS를 우측 패널에 그림. `renderForm()`도 함께 호출해 좌측 반영.
- `getStepFieldSet(step)` — 그 단계가 다루는 필드 집합(좌측 하이라이트용).
- `stepRequired(def)` — 필수 항목 목록(조건 고려). 다음 단계로 못 넘어가게 막는 검증에 사용.
- 진행바·이전/다음 버튼: `el.progressBar/btnPrev/btnNext`, `TOTAL_STEPS`.
- DOM 훅: `el = { wizTitle, wizCount, progressBar, wizBody, stepWarn, btnPrev, btnNext }`.

### 입력 보조 유틸
- `formatJumin` / `formatPhone` (자동 하이픈 정렬), `applyMask(mask,val)`.
- 로마자 제안: `SURNAME_ROMAN`(성씨 관용표기) + `romanizeSyllable`(음절 로마자화) → `suggestSurname` / `suggestGiven`. **자동 확정이 아니라 "권장 예시 제안"**(사용자가 여권과 일치하는 표기를 직접 확인).
- `unsure{}` — "🤔 잘 모르겠어요" 표시. 미입력·불확실 항목은 마지막에 "직원에게 여쭤볼 항목"으로 요약.

### 요약/마무리
- 마지막 단계: `SUMMARY_ROWS`(line ~427) 기반 요약 + 미완/불확실 목록 + **미리보기 모달**(`openPreview`, line ~629) + 인쇄/PDF(`window.print()`, `@page margin:0`, 컬러 유지).

## 6. 도메인 핵심(여권 서식 규칙)
- 기본값 안내: 표시 없으면 **일반여권·10년·58면**이 발급된다는 안내가 서식에 있음.
- 여권종류: 일반/관용/외교관/긴급/여행증명서(→왕복/편도). 면수: 26/58. 기간: 10년/단수(1년)/잔여기간/5년/5년미만("담당자 문의 후 선택").
- 주민번호 13자리 전체(6+7), '-' 없이 숫자만 기재하는 칸(연락처).
- 긴급연락처는 **본인이 아닌 다른 사람**(해외 사고 대비).
- 로마자성명은 **처음 신청/기존 로마자성명 변경 시에만** 기재. 기존여권 있으면 **기존 로마자성명과 일치**가 최우선(불일치 경고 필요).
- 등록기준지: 담당공무원 요청 시에만. 배우자 로마자 성: 'spouse of 성' 형태. 점자여권: 시각장애인만. 우편배송: 희망 시 상세주소.

## 7. 향후 방향(참고)
- 현재는 프로토타입 완성 단계. 이후 계획: **GitHub Pages 정적 배포 + Cloudflare Worker API 게이트웨이**(juso 도로명주소 검색부터, 키는 Worker secret). 주소 자동검색이 붙으면 `regBase`·`mailAddr` 입력이 개선됨.
- 장기: 여권 외 **민원실 신청서 전반**으로 확장(스키마 레지스트리 방식). 지금은 여권 하나에 집중.

## 8. 가이드 흐름에서 개선하면 좋을 것(제안)
- 각 단계 `why`/`hint`를 뒷면 유의사항 기준으로 더 쉬운 말로 다듬기.
- 로마자 단계: 제안 예시를 보여주되 "여권과 반드시 일치" 경고를 눈에 띄게.
- 기존여권 "있음" 선택 시 로마자 불일치 경고 강화.
- "잘 모르겠어요" 흐름과 마지막 "직원 확인 항목" 요약 연결 점검.
- 단계 이동 시 필수 미입력 막기(`stepRequired`)와 안내 문구.
- 접근성: 키보드 이동·포커스·큰 터치 타깃·대비 재점검.

---
**요약**: `STEP_DEFS`(흐름 정의) + `renderStep`(렌더) + 유틸(마스크·로마자)만으로 가이드 흐름이 데이터 구동됩니다. 좌측 `CO`/`renderForm`은 완성품이니 손대지 말고, 검증은 **헤드리스 크롬**으로 하세요.
