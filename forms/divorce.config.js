/* =====================================================================
   이혼(친권자 지정)신고서(양식 제11호) — FORM 설정
   engine/engine.js와 함께 build-form.js가 자체완결 HTML로 인라인한다.

   ⚠️ 2026.08.29 — 이 파일은 **새로 만든 것이 아니라 제자리로 되돌린 것**이다.
      종전에는 `divorce-helper-v1.html` 안에 옛 엔진이 통째로 복제돼 있었고
      (`CO`·`STEPS`·`STEP_HL`·`renderForm` 인라인) 손으로 유지되고 있었다.
      혼인(`923ecff`)과 같은 포크였고, 갈라진 탓에 **필수 검증이 한 곳도 없었다.**

   ⛔ **인쇄층의 원본은 `서식원본/이혼신고서(20260828).pdf` 하나다.**
      같은 폴더의 `이혼(친권자 지정)신고서(서식).pdf` 는 **구본(2쪽·통계청 표기 시절)** 이고
      대조용이다.
      ⚠️ 그것으로 배경을 다시 만들면 **판면이 달라 좌표가 전부 어긋난다** —
         화면은 멀쩡하고 **인쇄물만** 어긋나므로 눈치채기 어렵다.

   재생성: python tools/prep-bg.py divorce "서식원본/이혼신고서(20260828).pdf"
          node tools/build-form.js divorce
          python tools/verify-print.py        ← 반드시 0px 확인
   ===================================================================== */
var EDU=["학력 없음","초등학교","중학교","고등학교","대학(교)","대학원 이상"];
var JOB=["관리직","전문직","사무직","서비스직","판매직","농림어업","기능직",
         "장치·기계 조작 및 조립","단순노무직","군인","학생·가사·무직"];
var CUST_OPTS=["부","모","부모"];          // ⑤ 친권자
var CAUSE_OPTS=["협의","재판"];             // ⑤ 원인
var DIV_TYPE=["협의이혼","재판상 이혼"];     // 화면 분기용 — 서식에는 이 칸이 없다
var CHILD_CNT=["없음","1명","2명","3명","4명"];

/* 미성년 자녀 수(0~4). ⚠️ 서식의 ⑤ 칸이 **네 자리**뿐이라 상한이 4다. */
function childN(s){ var i=CHILD_CNT.indexOf(s&&s.childCnt); return i>0?i:0; }
function isJudicial(s){ return (s&&s.divType)==="재판상 이혼"; }

/* 이혼당사자 한 사람의 항목. `p` 는 "h"(남편) 또는 "w"(아내).
   ⛔ 본·한자·등록기준지는 필수로 만들지 마라 — 창구가 채운다(`optHint`). */
function personFields(p){
  return [
    {k:p+"_surKor", label:"성(한글)", ph:"김", req:true, half:true},
    {k:p+"_givenKor", label:"이름(한글)", ph:"영수", req:true, half:true},
    {k:p+"_surHan", label:"성(한자)", ph:"金", half:true, optHint:true},
    {k:p+"_givenHan", label:"이름(한자)", ph:"英洙", half:true, optHint:true},
    {k:p+"_bon", label:"본(한자)", ph:"金海 (본관)", help:"성씨의 본관을 한자로.", optHint:true},
    {k:p+"_phone", label:"전화번호", type:"phone", req:true, ph:"010-0000-0000"},
    {k:p+"_jumin", label:"주민등록번호", type:"jumin", ph:"900101-0000000", req:true,
      help:"외국인은 외국인등록번호를 적습니다."},
    {k:p+"_birth", label:"출생연월일", type:"date", req:true, ph:"1990.01.01",
      help:"주민등록번호를 입력하면 자동으로 채워집니다. 실제와 다르면 고쳐 주세요."},
    {k:p+"_regBase", label:"등록기준지", ph:"경기도 군포시 …",
      help:"가족관계등록부의 기준이 되는 주소입니다. 외국인은 국적을 적습니다.", optHint:true},
    {k:p+"_addr", label:"주소", req:true, ph:"경기도 군포시 …", help:"현재 살고 있는 주소(주민등록 주소)."}
  ];
}
/* ⚠️ 이혼신고서 ② 는 **성명·주민등록번호 넉 줄뿐**이다(혼인신고서와 달리 등록기준지 칸이 없다). */
function parentFields(p){
  return [
    {k:p+"_fName", label:"아버지(양부) 성명", req:true, ph:"김철수"},
    {k:p+"_fJumin", label:"아버지 주민등록번호", type:"jumin", req:true, ph:"600101-0000000"},
    {k:p+"_mName", label:"어머니(양모) 성명", req:true, ph:"이순자"},
    {k:p+"_mJumin", label:"어머니 주민등록번호", type:"jumin", req:true, ph:"630101-0000000"}
  ];
}
function personKeys(p){
  return [p+"_surKor",p+"_givenKor",p+"_surHan",p+"_givenHan",p+"_bon",p+"_phone",
          p+"_birth",p+"_jumin",p+"_regBase",p+"_addr",
          p+"_fName",p+"_fJumin",p+"_mName",p+"_mJumin",
          p+"_edu",p+"_job"];
}
function childKeys(){
  var a=[];
  /* ⛔ `c*_effDate` 는 더 이상 **묻지도 담지도 않는다**(2026.08.30 담당자 2차).
     효력발생일은 이혼 종류에서 그대로 나온다 — `effDateOf()` 참조. */
  for(var i=1;i<=4;i++) a=a.concat(["c"+i+"_name","c"+i+"_jumin","c"+i+"_cust",
                                    "c"+i+"_cause"]);
  return a;
}

/* ⑤ 친권자 지정의 **효력발생일** — 담당자 2차 확인(2026.08.30)
     협의이혼   → 협의이혼 **신고일**(= 이 신고서를 내는 날)
     재판상 이혼 → **재판확정일**(④ 에서 이미 적은 그 날짜)
   ⛔ **다시 묻지 않는다.** 둘 다 이미 아는 값이라, 같은 날짜를 두 번 적게 하면
      서로 어긋난 날짜가 한 장에 찍힐 수 있다(종전에는 자녀마다 따로 물었다).
   ⚠️ 협의이혼의 신고일은 **오늘**이다 — 이 도우미는 창구에 낼 그 날 인쇄한다.
      ⛔ 서식의 「( 년 월 일 )」 신고일 칸은 이 도우미가 찍지 않는다(종전 그대로). */
function effDateOf(s){
  if(s.divType==="재판상 이혼") return String(s.courtDate||"").trim();
  if(s.divType!=="협의이혼") return "";          // 아직 고르지 않았다
  var t=APP_TODAY||new Date(), p=function(n){ return (n<10?"0":"")+n; };
  return t.getFullYear()+"."+p(t.getMonth()+1)+"."+p(t.getDate());
}
function fullName(p){ return ((state[p+"_surKor"]||"")+(state[p+"_givenKor"]||"")).trim(); }
function buildSummary(){
  var d=state, h='';
  /* ⚠️ 「이혼 종류」·「미성년 자녀 수」에만 [수정]을 단다 — 둘 다 **뒤 화면과 인쇄 칸을
     바꾸는 갈래**다. 나머지에 기계적으로 달면 Review 가 다시 길어진다. */
  h+=sumRowIf("이혼 종류", d.divType, 6);
  h+=sumRowIf("미성년 자녀 수", d.childCnt, 7);
  var n=childN(d);
  for(var i=1;i<=n;i++){ var c="c"+i;
    h+=sumRowIf("자녀 "+i+" 친권자", (d[c+"_cust"]||"")
      +(d[c+"_cause"]?" ("+d[c+"_cause"]+")":""));
  }
  h+=sumRowIf("⑥ 출석", [d.attend_h?"남편(부)":"", d.attend_w?"아내(처)":""].filter(Boolean).join(" · "));
  return h;
}

var FORM={
  /* ⛔ 이 한 줄이 껍데기를 정한다 — Product UI v1(`engine/base-product.html`). */
  shell:"product",
  docTitle:"이혼(친권자 지정)신고서 작성 미리보기 도우미",
  formName:"이혼(친권자 지정)신고서",
  org:{ orgName:"경기도 군포시", officeName:"군포시청 민원실" },
  sampleLabels:["작성예시(협의이혼)","작성예시(재판상 이혼)"],
  sampleKinds:["consensual","judicial"],
  maxChild:4,

  /* 안내 기둥의 준비물 — **담당자 원문 그대로다**(2026.08.29 확정).
       · 당사자 신분증
       · 도장
       · 협의서 원본 또는 법원 판결문 원본
     ⛔ 서류명을 「협의이혼의사확인서 등본」·「판결 등본 및 확정증명서」로 **구체화하지 마라.**
        한 번 그렇게 적었다가 되돌렸다 — 담당자가 말한 것과 다른 서류를 떼러 가게 된다.
     ⛔ 협의/재판 갈래로 나눠 보여주지도 않는다. 담당자 원문이 한 줄로 「또는」이다.
     📌 확인 TODO — ① 「당사자 신분증」이 실제로는 **신고하러 오는 사람의 신분증만**인지,
        ② 「협의서 원본」의 정확한 서류명이 무엇인지. 답이 오기 전까지 여기를 고치지 마라. */
  ready:[
    { t:"당사자 신분증", s:"접수할 때 창구에서 확인합니다", g:"idcard", req:true },
    { t:"도장", s:"서명으로 갈음할 수 있습니다", g:"stamp", req:true },
    { t:"협의서 원본 또는 법원 판결문 원본", s:"이혼 종류에 따라 해당하는 것", g:"cert", req:true }
  ],

  /* 안내 기둥 맨 아래 「이용 안내」 — 2줄(Product UI v1). ⛔ 늘리지 마라. */
  noticeItems:[
    "필요 서류는 직원 확인을 따릅니다.",
    "여기서 접수되지는 않습니다."
  ],

  /* 주민등록번호를 적으면 출생연월일이 따라 채워진다 */
  onJuminChange:function(field, val, s){
    if(field==="h_jumin" || field==="w_jumin"){
      var p=field.slice(0,1), b=birthFromJumin(val);
      if(b){ s[p+"_birth"]=b; var el=document.getElementById("in_"+p+"_birth"); if(el) el.value=b; }
    }
  },

  /* 인쇄 준비 화면의 「인쇄한 뒤에 하실 일」 — 종전 완료 화면 문구 그대로.
     ⛔ 서류명을 지어내지 마라 — 담당자 원문이다. */
  afterPrint:"인쇄한 뒤, 서명 또는 날인을 직접 하고 민원실에 제출하세요. "
    +"<b>협의서 원본 또는 법원 판결문 원본</b>을 함께 내셔야 하며, "
    +"그 밖의 첨부서류는 담당 직원이 안내합니다.",

  /* 제목 아래 「( 년 월 일 )」 = **신고일**. 창구에 내는 그 날이라 오늘 날짜를 찍는다.
     ⚠️ 2026.08.30 담당자 요청 — 종전에는 이혼·혼인만 이 칸을 **비워 둔 채** 인쇄했다.
        협의이혼은 이 날짜가 곧 ⑤ 친권자 지정의 효력발생일이라(`effDateOf`), 한쪽만 찍히면
        같은 날을 뜻하는 두 칸이 종이 위에서 어긋나 보였다. 이제 8종이 모두 신고일을 찍는다.
     ⚠️ 좌표는 `이혼신고서(20260828).pdf` 에서 **잉크를 실측**했다 —
        「(」101.72 · 「년」143.50 · 「월」174.69 · 「일」206.38, 글자 세로 중앙 89.47.
        값은 그 사이 빈 곳의 한가운데에 둔다(`.ov` 는 좌표를 **중심**으로 잡는다). */
  today:{ y:89.5, yx:122.6, mx:159.1, dx:190.5 },

  stateKeys:[].concat(personKeys("h"),personKeys("w"),childKeys(),
    ["divType","childCnt","etc","courtDate","courtName",
     "attend_h","attend_w","sub_name","sub_jumin",
     "cohabitDate","divorceDate","childUnder19"]),
  stateDefaults:{ attend_h:false, attend_w:false },

  /* ⑤ 는 자녀 넷 자리가 늘 그려져 있다. 고르지 않은 자리에 영표가 남지 않게 가린다. */
  checkVisible:function(field, s){
    var m=field.match(/^c(\d)_/);
    return !m || +m[1] <= childN(s);
  },

  /* ──────────────────────────────────────────────────────────────
     좌표 — 2026.08.29 신서식(`이혼신고서(20260828).pdf`) 실측.
     격자선(`get_drawings`)으로 셀을 잡고, 인쇄된 안내글자(「(성)」·「년」·「명」·
     번호 네모 ①②③)는 **잉크 덩어리를 실측**해 그 옆·그 위에 얹었다.
     ⛔ 눈대중으로 옮기지 마라. 이 서식은 판면이 구본과 다르다.
     ────────────────────────────────────────────────────────────── */
  CO:{
    texts:{
      /* ① 이혼당사자 */
      "h_surKor":{x:176.6,y:119.2,a:"c",size:8},
      "h_givenKor":{x:243.0,y:119.2,a:"c",size:8},
      "w_surKor":{x:381.2,y:119.2,a:"c",size:8},
      "w_givenKor":{x:447.2,y:119.2,a:"c",size:8},
      "h_surHan":{x:176.2,y:137.6,a:"c",size:8},
      "h_givenHan":{x:242.8,y:137.6,a:"c",size:8},
      "w_surHan":{x:380.8,y:137.6,a:"c",size:8},
      "w_givenHan":{x:446.8,y:137.6,a:"c",size:8},
      "h_bon":{x:182.7,y:156.6,a:"c",size:7.5},
      "h_phone":{x:300.8,y:156.6,a:"c",size:7},
      "w_bon":{x:413.3,y:156.6,a:"c",size:7.5},
      "w_phone":{x:507.9,y:156.6,a:"c",size:7},
      "h_jumin1":{x:192.9,y:175.9,a:"c",size:8},
      "h_jumin2":{x:295.2,y:175.9,a:"c",size:8},
      "w_jumin1":{x:397.5,y:175.9,a:"c",size:8},
      "w_jumin2":{x:499.8,y:175.9,a:"c",size:8},
      "h_birth":{x:244.0,y:195.4,a:"c",size:8},
      "w_birth":{x:448.6,y:195.4,a:"c",size:8},
      "h_regBase":{x:143.7,y:214.9,a:"l",size:7,w:198.0,wrap:true},
      "w_regBase":{x:348.3,y:214.9,a:"l",size:7,w:198.0,wrap:true},
      "h_addr":{x:143.7,y:238.5,a:"l",size:7,w:198.0,wrap:true},
      "w_addr":{x:348.3,y:238.5,a:"l",size:7,w:198.0,wrap:true},
      /* ② 부모(양부모) — 이 서식은 등록기준지 칸이 없다 */
      "h_fName":{x:244.0,y:265.1,a:"c",size:8},
      "w_fName":{x:448.6,y:265.1,a:"c",size:8},
      "h_fJumin1":{x:192.9,y:290.3,a:"c",size:8},
      "h_fJumin2":{x:295.2,y:290.3,a:"c",size:8},
      "w_fJumin1":{x:397.5,y:290.3,a:"c",size:8},
      "w_fJumin2":{x:499.8,y:290.3,a:"c",size:8},
      "h_mName":{x:244.0,y:315.5,a:"c",size:8},
      "w_mName":{x:448.6,y:315.5,a:"c",size:8},
      "h_mJumin1":{x:192.9,y:340.8,a:"c",size:8},
      "h_mJumin2":{x:295.2,y:340.8,a:"c",size:8},
      "w_mJumin1":{x:397.5,y:340.8,a:"c",size:8},
      "w_mJumin2":{x:499.8,y:340.8,a:"c",size:8},
      /* ③ 기타사항 · ④ 재판확정일자 */
      "etc":{x:143.7,y:361.2,a:"l",size:7.5,w:403.0,wrap:true},
      "courtY":{x:205.9,y:380.8,a:"c",size:7.5},
      "courtM":{x:241.1,y:380.8,a:"c",size:7.5},
      "courtD":{x:273.0,y:380.8,a:"c",size:7.5},
      "courtName":{x:480.0,y:380.8,a:"r",size:7.5},
      /* ⑤ 친권자 지정 — 넷(위 두 자리 / 아래 두 자리) */
      "c1_name":{x:244.0,y:415.9,a:"c",size:7.5},
      "c1_jumin1":{x:192.9,y:431.4,a:"c",size:7.5},
      "c1_jumin2":{x:295.2,y:431.4,a:"c",size:7.5},
      "c1_effY":{x:251.2,y:448.0,a:"c",size:6},
      "c1_effM":{x:279.5,y:448.0,a:"c",size:6},
      "c1_effD":{x:305.2,y:448.0,a:"c",size:6},
      "c2_name":{x:448.6,y:415.9,a:"c",size:7.5},
      "c2_jumin1":{x:397.5,y:431.4,a:"c",size:7.5},
      "c2_jumin2":{x:499.8,y:431.4,a:"c",size:7.5},
      "c2_effY":{x:455.4,y:448.0,a:"c",size:6},
      "c2_effM":{x:483.6,y:448.0,a:"c",size:6},
      "c2_effD":{x:509.4,y:448.0,a:"c",size:6},
      "c3_name":{x:244.0,y:482.3,a:"c",size:7.5},
      "c3_jumin1":{x:192.9,y:497.9,a:"c",size:7.5},
      "c3_jumin2":{x:295.2,y:497.9,a:"c",size:7.5},
      "c3_effY":{x:251.2,y:514.4,a:"c",size:6},
      "c3_effM":{x:279.5,y:514.4,a:"c",size:6},
      "c3_effD":{x:305.2,y:514.4,a:"c",size:6},
      "c4_name":{x:448.6,y:482.3,a:"c",size:7.5},
      "c4_jumin1":{x:397.5,y:497.9,a:"c",size:7.5},
      "c4_jumin2":{x:499.8,y:497.9,a:"c",size:7.5},
      "c4_effY":{x:455.4,y:514.4,a:"c",size:6},
      "c4_effM":{x:483.6,y:514.4,a:"c",size:6},
      "c4_effD":{x:509.4,y:514.4,a:"c",size:6},
      /* ⑦ 제출인 */
      "sub_name":{x:213.0,y:564.2,a:"c",size:8},
      "sub_jumin1":{x:394.2,y:564.2,a:"c",size:7},
      "sub_jumin2":{x:500.0,y:564.2,a:"c",size:7},
      /* 인구동향조사 ㉮㉯㉰ */
      "cohabitY":{x:230.8,y:678.0,a:"c",size:7.5},
      "cohabitM":{x:260.2,y:678.0,a:"c",size:7.5},
      "cohabitD":{x:283.1,y:678.0,a:"c",size:7.5},
      "divorceY":{x:230.8,y:690.2,a:"c",size:7.5},
      "divorceM":{x:260.2,y:690.2,a:"c",size:7.5},
      "divorceD":{x:283.1,y:690.2,a:"c",size:7.5},
      "childUnder19":{x:530.0,y:684.1,a:"c",size:8}
    },
    /* 영표(○)는 서식에 인쇄된 **번호 네모 ①②③** 위에 찍는다 — 글자가 아니라 번호에.
       ⚠️ 아래 y 는 줄 간격 12.3pt(직업)·12.4pt(학력)·11.7pt(친권자)로 균등하다. */
    checks:{
      "c1_cust":{"부":[149.9,445.3], "모":[149.9,457.0], "부모":[149.9,468.6]},
      "c2_cust":{"부":[354.5,445.3], "모":[354.5,457.0], "부모":[354.5,468.6]},
      "c3_cust":{"부":[149.9,511.7], "모":[149.9,523.4], "부모":[149.9,535.0]},
      "c4_cust":{"부":[354.5,511.7], "모":[354.5,523.4], "부모":[354.5,535.0]},
      "c1_cause":{"협의":[258.0,465.7], "재판":[298.0,465.7]},
      "c2_cause":{"협의":[463.8,465.7], "재판":[504.2,465.7]},
      "c3_cause":{"협의":[258.0,532.1], "재판":[298.0,532.1]},
      "c4_cause":{"협의":[463.8,532.1], "재판":[504.2,532.1]},
      "h_edu":{"학력 없음":[119.3,702.6], "초등학교":[187.4,702.6], "중학교":[256.7,702.6], "고등학교":[119.3,715.0], "대학(교)":[187.4,715.0], "대학원 이상":[256.7,715.0]},
      "w_edu":{"학력 없음":[351.0,702.6], "초등학교":[420.6,702.6], "중학교":[488.5,702.6], "고등학교":[351.0,715.0], "대학(교)":[420.6,715.0], "대학원 이상":[488.5,715.0]},
      "h_job":{"관리직":[119.8,727.3], "전문직":[207.5,727.3], "사무직":[119.8,739.6], "서비스직":[207.5,739.6], "판매직":[119.8,751.9], "농림어업":[207.5,751.9], "기능직":[119.8,764.2], "장치·기계 조작 및 조립":[207.5,764.2], "단순노무직":[119.8,776.5], "군인":[207.5,776.5], "학생·가사·무직":[119.8,788.8]},
      "w_job":{"관리직":[351.7,727.3], "전문직":[439.0,727.3], "사무직":[351.7,739.6], "서비스직":[439.0,739.6], "판매직":[351.7,751.9], "농림어업":[439.0,751.9], "기능직":[351.7,764.2], "장치·기계 조작 및 조립":[439.0,764.2], "단순노무직":[351.7,776.5], "군인":[439.0,776.5], "학생·가사·무직":[351.7,788.8]}
    },
    attend:{"attend_h":[276.2,548.3], "attend_w":[377.8,548.3]}
  },

  STEP_HL:{
    2:[[141.7,109.9,346.3,252.4]], 3:[[346.3,109.9,550.9,252.4]],
    4:[[141.7,252.4,346.3,353.4]], 5:[[346.3,252.4,550.9,353.4]],
    6:[[44.0,353.4,550.9,392.5]],  7:[[44.0,392.5,550.9,540.8]],
    8:[[44.0,540.8,550.9,572.0]],  9:[[43.8,651.4,551.3,794.9]]
  },

  buildVals:function(state){
    var d=state, v={};
    ["h_surKor","h_givenKor","h_surHan","h_givenHan","h_bon","h_birth","h_regBase","h_addr",
     "w_surKor","w_givenKor","w_surHan","w_givenHan","w_bon","w_birth","w_regBase","w_addr",
     "h_fName","h_mName","w_fName","w_mName","etc","sub_name","childUnder19"
    ].forEach(function(k){ v[k]=d[k]||""; });
    v.h_phone=formatPhone(d.h_phone); v.w_phone=formatPhone(d.w_phone);
    ["h_jumin","w_jumin","h_fJumin","w_fJumin","h_mJumin","w_mJumin","sub_jumin"].forEach(function(f){
      v[f+"1"]=j1(d[f]); v[f+"2"]=j2(d[f]);
    });
    /* ④ 재판확정일자·법원명 — **재판상 이혼일 때만** 찍는다.
       ⛔ 협의이혼인데 값이 남아 있으면 창구가 되돌려보낸다. */
    var jd=isJudicial(d);
    var ct=ymd(jd?d.courtDate:""); v.courtY=ct[0]; v.courtM=ct[1]; v.courtD=ct[2];
    v.courtName=jd?(d.courtName||""):"";
    /* ⑤ 자녀 — 고른 수만큼만 */
    var n=childN(d);
    for(var i=1;i<=4;i++){
      var c="c"+i, on=i<=n;
      v[c+"_name"]=on?(d[c+"_name"]||""):"";
      v[c+"_jumin1"]=on?j1(d[c+"_jumin"]):""; v[c+"_jumin2"]=on?j2(d[c+"_jumin"]):"";
      /* 효력발생일은 자녀마다 묻지 않는다 — 이혼 종류 하나에서 나온다(`effDateOf`) */
      var ed=ymd(on?effDateOf(d):"");
      v[c+"_effY"]=ed[0]; v[c+"_effM"]=ed[1]; v[c+"_effD"]=ed[2];
    }
    var cd=ymd(d.cohabitDate); v.cohabitY=cd[0]; v.cohabitM=cd[1]; v.cohabitD=cd[2];
    var dv=ymd(d.divorceDate); v.divorceY=dv[0]; v.divorceM=dv[1]; v.divorceD=dv[2];
    return v;
  },

  /* ④ 법원명 칸에 **인쇄돼 있는 「법원」을 가린다** — 담당자 요청(2026.08.30).
     ⚠️ 서식은 「법원명 [____] 법원」이라 **앞부분만** 적는 것을 전제한다. 그런데 실제 작성
        형태는 「수원가정법원 안양지원」처럼 **전체 법원명**이라, 그대로 두면 인쇄물이
        「… 안양지원 법원」이 된다. 그래서 그 두 글자를 덮는다.
     ⛔ **적은 값이 있을 때만** 덮는다. 비어 있는 협의이혼에서는 원본을 건드리지 않는다.
     ⚠️ 좌표는 `이혼신고서(20260828).pdf` 에서 **잉크를 실측**했다 —
        「법원」 글자 x 485.12~501.31 · y 376.44~384.81, 셀 안쪽은 x 402~551 · y 373~391.
        아래 상자는 그 사이에 있다. ⛔ 넓히지 마라 — 격자선이나 옆 글자가 지워진다. */
  covers:function(v){
    return v.courtName ? [[483.6, 374.6, 502.9, 386.6]] : [];
  },

  /* 인쇄 후 직접 서명·날인해야 하는 칸 — 내용이 있을 때만 형광펜을 친다 */
  signatureHI:function(v){
    var HI=[];
    if(v.h_surKor||v.h_givenKor) HI.push([281.4,109.9,346.3,146.8]);
    if(v.w_surKor||v.w_givenKor) HI.push([484.8,109.9,550.9,146.8]);
    return HI;
  },

  STEPS:[
    /* ⛔ 시작 화면은 보여 주지 않는다 — 허브에서 이미 이혼신고를 고르고 들어왔다.
       ⚠️ 단계를 지우지 않고 `when` 으로 숨긴다(`STEP_HL`·`applySample` 이 절대 번호를 쓴다). */
    {n:1, short:"시작", title:"이혼(친권자 지정)신고서 작성 시작",
      when:function(){ return false; },
      q:"함께 한 단계씩 채워 볼까요?", kind:"intro",
      body:function(){ return '<div class="opts"><button type="button" class="opt sel" data-next="1">시작하기</button></div>'; }},

    {n:2, short:"남편(부)", title:"① 남편(부) 인적사항",
      q:"남편(부)의 정보를 입력하세요.",
      required:function(s){ return reqPerson(s,"h","남편"); },
      body:function(A){ return personFields("h").map(A.inputHtml).join(""); }},

    {n:3, short:"아내(처)", title:"① 아내(처) 인적사항",
      q:"아내(처)의 정보를 입력하세요.",
      required:function(s){ return reqPerson(s,"w","아내"); },
      body:function(A){ return personFields("w").map(A.inputHtml).join(""); }},

    {n:4, short:"남편 부모", title:"② 남편(부)의 부모",
      q:"남편(부)의 부모(양부모) 정보를 입력하세요.",
      why:"양자인 경우에는 양부모의 인적사항을 적습니다.",
      required:function(s){ return reqParent(s,"h","남편"); },
      body:function(A){ return parentFields("h").map(A.inputHtml).join(""); }},

    {n:5, short:"아내 부모", title:"② 아내(처)의 부모",
      q:"아내(처)의 부모(양부모) 정보를 입력하세요.",
      required:function(s){ return reqParent(s,"w","아내"); },
      body:function(A){ return parentFields("w").map(A.inputHtml).join(""); }},

    {n:6, short:"이혼 종류",
      /* ⚠️ 2026.08.29 실사용 QA — 고정 제목 「③④ 이혼 종류·재판확정일자·기타사항」은
         **협의이혼을 고르면 화면에 없는 ④ 재판확정일자**를 계속 말하고 있었다.
         이제 실제로 보이는 것만 말한다. 번호는 각 항목 라벨(④·③)이 달고 있다. */
      title:function(s){
        return isJudicial(s)
          ? "이혼 종류 · 재판확정일자 · 기타사항"
          : "이혼 종류 · 기타사항";
      },
      q:"어떤 이혼인지 골라 주세요.",
      required:function(s){
        var m=[];
        if(!s.divType) m.push("이혼 종류");
        if(isJudicial(s)){
          if(!String(s.courtDate||"").trim()) m.push("재판확정일자");
          if(!String(s.courtName||"").trim()) m.push("법원명");
        }
        return m;
      },
      body:function(A){
        var h='';
        h+='<div class="field"><label class="field-label">이혼 종류 <span class="fb fb-req">필수</span></label>';
        h+=A.choiceHtml("divType",DIV_TYPE,"법원의 협의이혼의사확인을 받았으면 ‘협의이혼’, 판결·조정 등으로 이혼했으면 ‘재판상 이혼’.")+'</div>';
        if(A.state.divType==="협의이혼"){
          /* ⚠️ 서식 스스로 「아래 친권자란은 협의이혼 시에는 법원의 협의이혼의사확인 후에
             기재합니다」라고 적고 있다. 지어낸 문장이 아니다. */
          /* ⛔ 첨부서류의 정확한 이름을 여기서 지어내지 마라 — 준비물은 담당자 원문
             「협의서 원본 또는 법원 판결문 원본」뿐이고, 안내 기둥이 그것을 낸다. */
          h+='<div class="note-box"><b>협의이혼</b>은 <b>법원의 협의이혼의사확인</b>을 받은 뒤에 신고합니다. '
            +'④ 재판확정일자·법원명은 <b>비워 둡니다.</b></div>';
        }
        if(isJudicial(A.state)){
          h+='<div class="note-box"><b>재판상 이혼</b>(판결·조정 등)은 재판이 확정된 날과 법원 이름을 적습니다.</div>';
          h+=A.inputHtml({k:"courtDate", label:"④ 재판확정일자", type:"date", req:true, ph:"2026.05.10"});
          /* ⚠️ 2026.08.30 담당자 2차 — **지원까지 적을 수 있어야 한다.** 담당자가 든 실제
             작성 형태가 「수원가정법원 안양지원」이다. 종전 안내는 「앞부분만 적습니다 ·
             예: 수원가정」이라 지원을 적지 못하게 막고 있었다.
             ⛔ 「법원명 정도까지만」으로 되돌리지 마라. ⛔ 지원 입력칸을 따로 만들지도 마라 —
                이 한 칸에 전체 법원명을 적는다(길이 제한 없음). */
          h+=A.inputHtml({k:"courtName", label:"법원명", req:true, ph:"수원가정법원 안양지원",
            help:"지원까지 있으면 함께 적습니다. 예: 수원가정법원 안양지원"});
        }
        h+=A.inputHtml({k:"etc", label:"③ 기타사항", help:"특별히 밝힐 내용이 있을 때만 적습니다."});
        return h;
      }},

    {n:7, short:"친권자", title:"⑤ 친권자 지정",
      q:"미성년(만 19세 미만) 자녀가 몇 명인가요?",
      why:"미성년 자녀가 있으면 자녀마다 친권자를 정해 적습니다. 협의이혼은 법원의 협의이혼의사확인을 받은 뒤에 기재합니다.",
      required:function(s){
        var m=[];
        if(!s.childCnt) m.push("미성년 자녀 수");
        var n=childN(s);
        for(var i=1;i<=n;i++){ var c="c"+i;
          if(!String(s[c+"_name"]||"").trim()) m.push("자녀 "+i+" 성명");
          /* ⛔ 주민등록번호는 **선택**이다(2026.08.30 담당자) — 필수 목록에 다시 넣지 마라. */
          if(!s[c+"_cust"]) m.push("자녀 "+i+" 친권자");
          /* ⛔ 효력발생일은 여기서 묻지 않으므로 필수 목록에도 없다(`effDateOf`) */
          if(!s[c+"_cause"]) m.push("자녀 "+i+" 원인");
        }
        return m;
      },
      body:function(A){
        var h='';
        h+='<div class="field"><label class="field-label">미성년 자녀 수 <span class="fb fb-req">필수</span></label>';
        h+=A.choiceHtml("childCnt",CHILD_CNT,"서식의 ⑤ 칸은 네 자리입니다. 다섯 명 이상이면 창구에 말씀해 주세요.")+'</div>';
        var n=childN(A.state);
        if(!n && A.state.childCnt) h+='<div class="note-box">미성년 자녀가 없으면 ⑤ 친권자란은 비워 둡니다.</div>';
        for(var i=1;i<=n;i++){
          var c="c"+i;
          h+='<div class="sum-sec"><h4>미성년 자녀 '+i+'</h4>';
          h+=A.inputHtml({k:c+"_name", label:"자녀 성명", req:true, half:true, ph:"김하나"});
          h+=A.inputHtml({k:c+"_jumin", label:"자녀 주민등록번호", type:"jumin", req:true, half:true});
          h+='<div class="field"><label class="field-label">친권자 <span class="fb fb-req">필수</span></label>'
            +A.choiceHtml(c+"_cust",CUST_OPTS,"누가 친권을 갖는지 고르세요.")+'</div>';
          /* 효력발생일 — **묻지 않고 알려만 준다**(2026.08.30 담당자 2차).
             ⛔ 다시 입력칸을 만들지 마라. 같은 날짜를 두 번 적게 하면 한 장에 서로 다른
                날짜가 찍힐 수 있다. 값은 `effDateOf()` 하나에서 나온다. */
          h+='<div class="field"><label class="field-label">효력 발생일</label>'
            + '<div class="q-help">'+(A.state.divType==="재판상 이혼"
                ? "재판상 이혼은 <b>재판확정일</b>이 들어갑니다 — ④ 에 적으신 날짜를 그대로 씁니다."
                : "협의이혼은 <b>협의이혼 신고일</b>이 들어갑니다 — 이 신고서를 내시는 날입니다.")
            + '</div>'
            + '<div class="q-help"><b>'+A.esc(effDateOf(A.state)||"이혼 종류를 먼저 고르세요")+'</b></div></div>';
          h+='<div class="field"><label class="field-label">원인 <span class="fb fb-req">필수</span></label>'
            +A.choiceHtml(c+"_cause",CAUSE_OPTS,"협의로 정했으면 ‘협의’, 재판으로 정했으면 ‘재판’.")+'</div>';
          h+='</div>';
        }
        return h;
      }},

    {n:8, short:"출석·제출", title:"⑥⑦ 출석·제출",
      q:"출석 여부와 제출인을 확인하세요.",
      required:function(s){
        return (s.attend_h||s.attend_w) ? [] : ["출석하신 분(남편·아내)"];
      },
      body:function(A){
        var h='';
        h+='<div class="field"><label class="field-label">⑥ 신고인 출석 여부 <span class="fb fb-req">필수</span></label>';
        h+='<div class="q-help">신고서를 제출하러 직접 오신 분을 모두 선택하세요.</div>';
        h+='<div class="opts row">'+A.toggleHtml("attend_h","남편(부)")+A.toggleHtml("attend_w","아내(처)")+'</div></div>';
        h+='<div class="field"><label class="field-label">⑦ 제출인 <span class="fb fb-opt">선택</span></label>';
        h+='<div class="q-help">신고인이 아닌 다른 사람이 제출할 때만 적습니다.</div></div>';
        h+=A.inputHtml({k:"sub_name", label:"제출인 성명", half:true});
        h+=A.inputHtml({k:"sub_jumin", label:"제출인 주민등록번호", type:"jumin", half:true});
        return h;
      }},

    {n:9, short:"인구동향", title:"인구동향조사(통계)",
      /* ⚠️ 신서식은 이 조사의 주체를 「국가데이터처」로 적는다(구본은 통계청). */
      q:"국가데이터처 인구동향조사 항목입니다.",
      why:"성실응답 의무가 있는 통계 항목이며, 개인정보는 보호됩니다. 신고서 맨 뒤에 있는 항목입니다.",
      required:function(s){ var m=[];
        if(!String(s.cohabitDate||"").trim()) m.push("실제 결혼 생활 시작일");
        if(!String(s.divorceDate||"").trim()) m.push("실제 이혼 연월일");
        if(!String(s.childUnder19||"").trim()) m.push("19세 미만 자녀 수");
        [["h","남편"],["w","아내"]].forEach(function(x){
          if(!s[x[0]+"_edu"]) m.push(x[1]+" 최종 졸업학교");
          if(!s[x[0]+"_job"]) m.push(x[1]+" 직업");
        });
        return m; },
      invalid:function(s){
        var v=String(s.childUnder19||"").trim();
        if(v && !/^\d{1,2}$/.test(v)) return ["19세 미만 자녀 수는 숫자로 적어 주세요(없으면 0)."];
        return [];
      },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"cohabitDate", label:"㉮ 실제 결혼 생활 시작일", type:"date", req:true,
          ph:"2015.05.01", help:"결혼식·혼인신고와 관계없이 실제로 함께 살기 시작한 날."});
        h+=A.inputHtml({k:"divorceDate", label:"㉯ 실제 이혼 연월일", type:"date", req:true,
          ph:"2026.03.01", help:"실제로 헤어져 따로 살기 시작한(별거) 날."});
        h+=A.inputHtml({k:"childUnder19", label:"㉰ 19세 미만 자녀 수", req:true, ph:"2",
          help:"만 19세 미만 자녀 수(명). 없으면 0."});
        [["h","남편"],["w","아내"]].forEach(function(x){
          h+='<div class="field"><label class="field-label">㉱ 최종 졸업학교 — '+x[1]
            +' <span class="fb fb-req">필수</span></label>'+A.choiceHtml(x[0]+"_edu",EDU)+'</div>';
        });
        [["h","남편"],["w","아내"]].forEach(function(x){
          h+='<div class="field"><label class="field-label">㉲ 직업 — '+x[1]
            +' <span class="fb fb-req">필수</span></label>'+A.choiceHtml(x[0]+"_job",JOB)+'</div>';
        });
        return h;
      }},

    {n:10, short:"완료", title:"작성 내용 확인", q:"고르신 것만 다시 확인해 주세요.", kind:"summary",
      body:function(){
        return buildSummary();
      }}
  ],

  applySample:function(state, kind){
    Object.assign(state,{
      step:2,
      h_surKor:"강", h_givenKor:"태우", h_surHan:"姜", h_givenHan:"泰佑", h_bon:"晋州",
      h_phone:"01012345678", h_birth:"1988.03.15", h_jumin:"8803151000000",
      h_regBase:"경기도 군포시 산본동 000-0", h_addr:"경기도 군포시 산본동 000-0, 305동 1102호",
      h_fName:"강병철", h_fJumin:"6001011000000",
      h_mName:"윤정희", h_mJumin:"6305012000000",
      h_edu:"대학(교)", h_job:"사무직",
      w_surKor:"임", w_givenKor:"수경", w_surHan:"林", w_givenHan:"秀卿", w_bon:"羅州",
      w_phone:"01098765432", w_birth:"1990.07.22", w_jumin:"9007222000000",
      w_regBase:"경기도 군포시 둔대동 000-0", w_addr:"경기도 군포시 산본동 000-0, 305동 1102호",
      w_fName:"임대성", w_fJumin:"6208011000000",
      w_mName:"정혜란", w_mJumin:"6511012000000",
      w_edu:"대학(교)", w_job:"전문직",
      divType:"협의이혼", courtDate:"", courtName:"",
      childCnt:"2명", childUnder19:"2",
      c1_name:"강하나", c1_jumin:"1503154000000", c1_cust:"모", c1_cause:"협의",
      c2_name:"강두리", c2_jumin:"1809204000000", c2_cust:"모", c2_cause:"협의",
      attend_h:true, attend_w:true,
      cohabitDate:"2015.05.01", divorceDate:"2026.03.01"
    });
    if(kind==="judicial"){
      /* 재판상 이혼 — ④ 재판확정일자·법원명이 찍히고, 친권자 원인은 「재판」, 자녀 1명 */
      state.divType="재판상 이혼";
      /* ⚠️ 담당자가 든 실제 작성 형태(2026.08.30 2차) — 지원까지 적는다 */
      state.courtDate="2026.05.10"; state.courtName="수원가정법원 안양지원";
      state.childCnt="1명"; state.childUnder19="1";
      state.c1_cust="모"; state.c1_cause="재판";
      state.c2_name=""; state.c2_jumin=""; state.c2_cust=""; state.c2_cause="";
    }
  }
};

/* 필수 검증 도우미 — ⛔ 본·한자·등록기준지는 넣지 마라(선택 항목이다). */
function reqPerson(s, p, who){
  var m=[];
  if(!String(s[p+"_surKor"]||"").trim()) m.push(who+" 성(한글)");
  if(!String(s[p+"_givenKor"]||"").trim()) m.push(who+" 이름(한글)");
  if(!String(s[p+"_phone"]||"").trim()) m.push(who+" 전화번호");
  /* ⛔ 주민등록번호는 **선택**이다(2026.08.30 담당자) — 필수 목록에 다시 넣지 마라. */
  if(!String(s[p+"_birth"]||"").trim()) m.push(who+" 출생연월일");
  if(!String(s[p+"_addr"]||"").trim()) m.push(who+" 주소");
  return m;
}
function reqParent(s, p, who){
  var m=[];
  if(!String(s[p+"_fName"]||"").trim()) m.push(who+" 아버지 성명");
  /* ⛔ 주민등록번호는 **선택**이다(2026.08.30 담당자) — 필수 목록에 다시 넣지 마라. */
  if(!String(s[p+"_mName"]||"").trim()) m.push(who+" 어머니 성명");
  /* ⛔ 주민등록번호는 **선택**이다(2026.08.30 담당자) — 필수 목록에 다시 넣지 마라. */
  return m;
}
