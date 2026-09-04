/* =====================================================================
   출생신고서(양식 제1호) — FORM 설정
   engine/engine.js와 함께 build-form.js가 자체완결 HTML로 인라인한다.

   ⛔ **인쇄층의 원본은 `서식원본/출생신고서(20260828).pdf` 하나다.**
      같은 폴더의 `출생신고서.pdf` 는 **구본(통계청 표기 시절)** 이고 대조용으로만 남겨 뒀다.
      ⚠️ 그것으로 배경을 다시 만들면 **판면이 달라 좌표 69개가 전부 어긋난다** —
         화면은 멀쩡하고 **인쇄물만** 어긋나므로 눈치채기 어렵다(2026.08.29).

   재생성: python tools/prep-bg.py birth "서식원본/출생신고서(20260828).pdf"
          node tools/build-form.js birth
          python tools/verify-print.py        ← 반드시 0px 확인
   ===================================================================== */
/* ══ 업무규칙 (2026.08.29 담당자 확인) ═══════════════════════════════════
   가족관계등록 신고서는 **모든 사항을 적어야 한다.** 다만 시민이 그 자리에서 알기
   어려운 세 가지 — **등록기준지 · 본 · 한자** — 는 선택으로 두고 창구가 채운다.
   ⛔ 그 셋을 필수로 바꾸지 마라. 모르면 앞으로 나아갈 수 없게 되어, 정작 창구에서
      1분이면 알려 줄 것 때문에 작성 자체를 포기한다.
   ⚠️ 아래 문구는 **그 셋에만** 붙인다. 아무 데나 붙이면 「비워도 되는구나」로 읽힌다. */
/* 이 값을 고르면 아버지(부) 단계와 성·본 협의 질문이 사라진다(아래 `when` 참조) */
var UNWED="혼인 외";

var EDU=["학력 없음","초등학교","중학교","고등학교","대학(교)","대학원 이상"];
var SEX_OPTS=["남","여"];
var MARITAL_OPTS=["혼인 중","혼인 외"];
var PLACE_OPTS=["자택","병원","기타"];
var YN_OPTS=["예","아니요"];
var QUAL_OPTS=["부","모","동거친족","기타"];

// ② 부모 인적사항
/* 부·모 공통 항목. ⚠️ 성명·주민등록번호는 **양쪽 다 필수**다 —
   아버지 단계 자체가 혼인 중일 때만 나오므로(아래 `when`), 나왔다면 적어야 한다.
   ⛔ 본·한자·등록기준지는 필수로 만들지 마라(`OPT_HELP` 참조). */
function parentFields(p){
  var isM=(p==="m");
  return [
    {k:p+"_name", label:"성명(한글)", req:true, ph:isM?"윤부곡":"정군포"},
    /* ⚠️ 부·모는 한글도 **성명 한 칸**이라 성/이름 경계가 없다 — 묶음이 하나뿐이다.
       ⛔ 그래서 여기서는 **성씨 우선을 쓰지 않는다.** 복성이면 두 글자인데 어디까지가
          성인지 알 길이 없다(글자 수로 추론하지 않는다 — 여권 복성 사고와 같은 이유). */
    {hanja:{gid:p+"Name", label:"성명 한자 찾기", parts:[[p+"_name",p+"_nameHan"]]}},
    /* ⛔ `_bon_kor` 는 화면에만 사는 칸이다 — 종이에는 한자(`_bon`)만 들어간다. */
    {k:p+"_bon_kor", label:"본(한글)", ph:isM?"파평":"동래",
      help:"성씨의 본관입니다. 한글로 적으면 아래에서 한자를 고를 수 있습니다.", optHint:true},
    {hanja:{gid:p+"Bon", label:"본 한자 찾기", parts:[[p+"_bon_kor",p+"_bon"]]}},
    {k:p+"_jumin", label:"주민등록번호", type:"jumin", req:true, ph:"800101-0000000",
      help:"외국인은 외국인등록번호를 적습니다."},
    {k:p+"_regBase", label:"등록기준지", ph:"경기도 군포시 …",
      help:"가족관계등록부의 기준이 되는 주소. 외국인은 국적을 적습니다.", optHint:true}
  ];
}
/* 신고인란은 **이메일만 선택**이다(2026.08.29 담당자 확인). 창구가 신분증과 대조하는
   자리라 성명·주민등록번호·주소·전화가 다 있어야 한다. */
function reporterFields(){
  return [
    {k:"reporter_name", label:"신고인 성명", req:true, ph:"정군포"},
    {k:"reporter_jumin", label:"주민등록번호", type:"jumin", req:true, ph:"800101-0000000"},
    {k:"reporter_addr", label:"주소", req:true, ph:"경기도 군포시 …"},
    {k:"reporter_phone", label:"전화번호", type:"phone", req:true, ph:"010-0000-0000"},
    /* ⚠️ 이메일만 선택이다. 다른 선택 칸과 달리 **창구가 대신 채워 줄 수 없어서**
       공통 안내(`optHint`)를 붙이지 않는다 — 「접수 시 알려드리겠습니다」가 말이 안 된다. */
    {k:"reporter_email", label:"이메일", ph:"name@example.com",
      help:"없으면 비워 두셔도 됩니다."}
  ];
}
function childName(){ return ((state.child_surKor||"")+(state.child_givenKor||"")).trim(); }
function parentName(p){ return (state[p+"_name"]||"").trim(); }
/* ⛔ Review 는 **핵심 선택**만이다(2026.08.29 §2). 이름·주민등록번호·주소·전화는
   가운데 PAPER 가 실시간으로 보여 주므로 여기서 되풀이하지 않는다.
   ⚠️ 「혼인 중/외」에만 [수정]을 단다 — 그 답이 **아버지 단계를 없애거나 살리는** 갈래다. */
function buildSummary(){
  var d=state, h='';
  h+=sumRowIf("성별", d.child_sex, 2);
  h+=sumRowIf("혼인 중/외의 출생자", d.child_marital, 2);
  h+=sumRowIf("출생 장소", [d.child_birthPlace, d.child_birthPlaceEtc]
    .filter(function(x){ return x && x.trim(); }).join(" · "));
  h+=sumRowIf("성·본 협의서 제출", d.sonbon_consent);
  h+=sumRowIf("신고인 자격", (d.reporter_qual||"")
    +(d.reporter_qual==="기타" && d.reporter_qualEtc ? "("+d.reporter_qualEtc+")" : ""));
  return h;
}

var FORM={
  /* ⛔ 이 한 줄이 껍데기를 정한다. Product UI v1(`engine/base-product.html`)을 쓴다 —
     ASK 26 / PAPER 56 / RAIL 18 · BAR 62px · Normal/Big · 선 아이콘.
     ⚠️ 나머지 4종은 아직 옛 껍데기다. 그것들을 옮길 때 이 줄을 더하면 된다. */
  shell:"product",
  docTitle:"출생신고서 작성 미리보기 도우미",
  formName:"출생신고서",

  /* 안내 기둥의 준비물 — **허브 카탈로그(`index.html`)와 같은 값**이다.
     근거는 서식 첨부서류 1항(출생증명서)·6항(신분확인)이고, 2~5항은 조건부라 두지 않는다.
     ⛔ 새 준비물을 지어내지 마라. 확인된 것이 없으면 비워 두고 그 구역을 내지 않는다. */
  ready:[
    { t:"신고인 신분증", s:"접수할 때 창구에서 확인합니다", g:"idcard", req:true },
    { t:"출생증명서 원본", s:"병원에서 받은 것 · 의사·조산사가 작성합니다", g:"cert", req:true }
  ],
  org:{ orgName:"경기도 군포시", officeName:"군포시청 민원실" },
  sampleLabels:["작성예시(혼인 중)","작성예시(혼인 외)"],
  sampleKinds:["wed","unwed"],
  /* 안내 기둥 맨 아래 「이용 안내」 — **2줄**(Product UI v1 · 여권과 같은 문법).
     ⚠️ 종전 5줄에서 셋을 줄였는데 **버린 것이 아니라 옮겨져 있다** —
        「저장·전송 안 함」은 위 안심 문단에, 「필요 서류(출생증명서)」는 준비물에,
        「서명·날인은 인쇄한 뒤」는 마지막 확인 단계의 안내 상자에 있다.
     ⛔ 다시 늘리지 마라 — 이 기둥이 스크롤되면 정작 진행·준비물이 화면 밖으로 밀린다
        (크게 보기에서 실제로 8px 넘쳤다). */
  noticeItems:[
    "필요 서류는 직원 확인을 따릅니다.",
    "여기서 접수되지는 않습니다."
  ],
  today:{ y:87.8, yx:99.8, mx:145.1, dx:190.3 },

  /* 인쇄 준비 화면(미리보기)의 「인쇄한 뒤에 하실 일」.
     ⛔ 새로 지은 문구가 아니다 — 종전 완료 화면의 안내를 그대로 옮겼다. */
  afterPrint:"인쇄한 뒤, 신고인이 서명·날인을 직접 하여 민원실에 제출하세요. "
    +"출생증명서(병원 발급) 등 첨부서류는 담당 직원이 안내합니다.",

  stateKeys:[].concat(
    /* ⚠️ `*_bon_kor` 는 **화면에만 사는 칸**이다(본관을 한글로 받아 한자를 고르게 한다).
        ⛔ `CO` 에 좌표를 만들지 마라 — 종이의 본란에는 한자만 들어간다. */
    ["child_surKor","child_givenKor","child_surHan","child_givenHan","child_bon","child_bon_kor",
     "child_sex","child_marital","child_birthDate","child_birthHour","child_birthMin",
     "child_birthPlace","child_birthPlaceAddr","child_birthPlaceEtc","child_regBase","child_addr",
     "child_headName","child_headRel","child_dualNat"],
    ["f_name","f_nameHan","f_bon","f_bon_kor","f_jumin","f_regBase","f_edu"],
    ["m_name","m_nameHan","m_bon","m_bon_kor","m_jumin","m_regBase","m_edu"],
    ["sonbon_consent"],
    ["closed_name","closed_jumin","closed_regBase","etc"],
    ["reporter_name","reporter_jumin","reporter_qual","reporter_qualEtc",
     "reporter_addr","reporter_phone","reporter_email","sub_name","sub_jumin"]),

  CO:{
    texts:{
      "child_surKor":{x:158.1,y:111.8,a:"c",size:8}, "child_givenKor":{x:210.4,y:111.8,a:"c",size:8},
      "child_surHan":{x:158.1,y:146.9,a:"c",size:8}, "child_givenHan":{x:210.4,y:146.9,a:"c",size:8},
      "child_bon":{x:322.0,y:129.9,a:"c",size:7.5},
      "birthY":{x:178.0,y:174.9,a:"c",size:7.5,nb:true}, "birthMo":{x:217.0,y:174.9,a:"c",size:7.5,nb:true},
      "birthD":{x:255.5,y:174.9,a:"c",size:7.5,nb:true}, "birthH":{x:290.0,y:174.9,a:"c",size:7.5,nb:true},
      "birthMin":{x:325.0,y:174.9,a:"c",size:7.5,nb:true},
      /* ⚠️ 서식의 이 줄에는 ①②③ 오른쪽에 **넓은 칸 하나뿐**이다(284.6~550.8pt).
         그래서 「기타 상세」와 「주소」를 **한 줄로 합쳐** 이 칸에 찍는다(`birthPlaceCell`).
         ⛔ 좌표를 옮기지 마라 — Phase 1 에서 판면을 기준으로 확정한 자리다.
         📌 두 값을 한 칸에 함께 찍는 것이 맞는지는 담당자 확인 항목이다. */
      "birthPlaceCell":{x:297.0,y:193.8,a:"l",size:7,w:241.0},
      "child_regBase":{x:209.3,y:213.7,a:"l",size:7,w:314.0,wrap:true,nb:true},
      "child_addr":{x:128.6,y:238.8,a:"l",size:7,w:222.0,wrap:true,nb:true},
      "child_headName":{x:483.6,y:238.8,a:"r",size:7}, "child_headRel":{x:504.2,y:238.8,a:"l",size:7},
      "child_dualNat":{x:367.5,y:263.7,a:"l",size:6.5,w:151.0},
      "f_name":{x:144.4,y:283.8,a:"c",size:7.5}, "f_nameHan":{x:234.8,y:283.8,a:"c",size:7},
      "f_bon":{x:340.2,y:283.8,a:"c",size:7}, "f_jumin1":{x:460.4,y:283.8,a:"c",size:6.5}, "f_jumin2":{x:519.9,y:283.8,a:"c",size:6.5},
      "m_name":{x:144.4,y:302.7,a:"c",size:7.5}, "m_nameHan":{x:234.8,y:302.7,a:"c",size:7},
      "m_bon":{x:340.2,y:302.7,a:"c",size:7}, "m_jumin1":{x:460.4,y:302.7,a:"c",size:6.5}, "m_jumin2":{x:519.9,y:302.7,a:"c",size:6.5},
      "f_regBase":{x:168.9,y:321.6,a:"l",size:7,w:359.0,wrap:true,nb:true},
      "m_regBase":{x:168.9,y:341.7,a:"l",size:7,w:359.0,wrap:true,nb:true},
      "closed_name":{x:249.5,y:398.8,a:"c",size:7}, "closed_jumin1":{x:425.9,y:398.8,a:"c",size:7}, "closed_jumin2":{x:510.6,y:398.8,a:"c",size:7},
      "closed_regBase":{x:233.4,y:418.6,a:"l",size:7,w:286.0,wrap:true,nb:true},
      "etc":{x:122.7,y:438.4,a:"l",size:7.5,w:410.0,wrap:true},
      "reporter_name":{x:164.5,y:458.3,a:"c",size:8}, "reporter_jumin1":{x:425.9,y:458.3,a:"c",size:7}, "reporter_jumin2":{x:510.6,y:458.3,a:"c",size:7},
      "reporter_qualEtc":{x:322.0,y:478.3,a:"l",size:6.5,w:123.0},
      "reporter_addr":{x:122.7,y:503.4,a:"l",size:7.5,w:410.0,wrap:true,nb:true},
      "reporter_phone":{x:172.2,y:529.1,a:"c",size:7.5}, "reporter_email":{x:326.7,y:529.1,a:"l",size:6.5,w:213.0},
      "sub_name":{x:202.3,y:548.3,a:"c",size:8}, "sub_jumin1":{x:376.6,y:548.3,a:"c",size:7}, "sub_jumin2":{x:495.3,y:548.3,a:"c",size:7}
    },
    checks:{
      "child_sex":{"남":[409.0,120.9],"여":[409.0,138.9]},
      "child_marital":{"혼인 중":[454.3,120.9],"혼인 외":[454.3,138.9]},
      "child_birthPlace":{"자택":[167.0,193.8],"병원":[209.5,193.8],"기타":[252.0,193.8]},
      "sonbon_consent":{"예":[459.0,361.1],"아니요":[508.0,361.1]},
      "reporter_qual":{"부":[128.0,478.3],"모":[160.5,478.3],"동거친족":[193.0,478.3],"기타":[255.5,478.3]},
      "f_edu":{"학력 없음":[163.5,677.2],"초등학교":[230.5,677.2],"중학교":[293.0,677.2],"고등학교":[345.5,677.2],"대학(교)":[408.0,677.2],"대학원 이상":[468.0,677.2]},
      "m_edu":{"학력 없음":[163.5,700.8],"초등학교":[230.5,700.8],"중학교":[293.0,700.8],"고등학교":[345.5,700.8],"대학(교)":[408.0,700.8],"대학원 이상":[468.0,700.8]}
    },
    attend:{}
  },

  STEP_HL:{
    2:[[72.7,94.8,550.6,165.9]],
    3:[[72.7,165.9,550.5,273.8]],
    4:[[72.7,273.8,550.5,292.7],[72.7,312.6,550.6,331.7]],
    5:[[72.7,292.7,550.5,312.6],[72.7,331.7,550.6,370.7]],
    6:[[43.5,370.7,550.6,448.5]],
    7:[[43.5,448.5,550.6,538.8]],
    8:[[43.5,538.8,550.5,559.0]],
    9:[[43.4,667.8,552.1,705.5]]
  },

  buildVals:function(state){
    var d=state, v={};
    /* ⚠️ `*_bon_kor` 는 **화면에만 사는 칸**이다(본관을 한글로 받아 한자를 고르게 한다).
        ⛔ `CO` 에 좌표를 만들지 마라 — 종이의 본란에는 한자만 들어간다. */
    ["child_surKor","child_givenKor","child_surHan","child_givenHan","child_bon","child_bon_kor",
     "child_regBase","child_addr","child_headName","child_headRel","child_dualNat",
     "f_name","f_nameHan","f_bon","f_regBase","m_name","m_nameHan","m_bon","m_regBase",
     "closed_name","closed_regBase","etc","reporter_name","reporter_qualEtc","reporter_email","sub_name"
    ].forEach(function(k){ v[k]=d[k]||""; });
    v.reporter_phone=formatPhone(d.reporter_phone);
    ["f_jumin","m_jumin","closed_jumin","reporter_jumin","sub_jumin"].forEach(function(f){
      v[f+"1"]=j1(d[f]); v[f+"2"]=j2(d[f]);
    });
    /* 「기타」였다면 무엇이었는지를 앞에 두고 주소를 뒤에 붙인다 */
    v.birthPlaceCell=[d.child_birthPlaceEtc, d.child_birthPlaceAddr]
      .filter(function(x){ return x && String(x).trim(); }).join(" · ");
    var b=ymd(d.child_birthDate); v.birthY=b[0]; v.birthMo=b[1]; v.birthD=b[2];
    v.birthH=digits(d.child_birthHour); v.birthMin=digits(d.child_birthMin);
    return v;
  },

  signatureHI:function(v){
    var HI=[];
    if(v.reporter_name) HI.push([225.7,450.6,299.7,467.0]);
    return HI;
  },

  STEPS:[
    /* ⛔ **이 화면은 더 이상 보여 주지 않는다**(2026.08.29 Phase 3).
       허브 Main 에서 「아이 출생 신고하기」를 이미 고르고 들어왔는데 여기서 또
       「시작하기」를 누르게 하면 같은 결정을 두 번 시키는 것이다.
       ⚠️ **단계를 지우지 않고 `when` 으로 숨겼다.** `STEP_HL`·`applySample`·`required` 가
          전부 절대 번호를 쓰고 있어, 번호를 당기면 인쇄 강조와 작성예시가 조용히 어긋난다.
          ⛔ 이 안내문의 내용(1개월 이내·출생증명서·서명은 인쇄 뒤)은 버린 것이 아니라
             안내 기둥의 준비물·안심 문단과 마지막 확인 단계에 들어 있다. */
    {n:1, short:"시작", title:"출생신고서 작성 시작",
      when:function(){ return false; },
      q:"함께 한 단계씩 채워 볼까요?",
      why:"출생신고는 출생 후 1개월 이내에 해야 합니다. 아이 이름·출생 정보와 부모 정보를 안내합니다. 병원에서 받은 출생증명서를 함께 준비하세요. 서명·날인은 인쇄한 뒤 직접 하시면 됩니다.",
      kind:"intro",
      body:function(){
        return '<div class="note-box">이 도구는 <b>미리보기</b>이며, 실제 접수는 담당 직원의 확인을 따릅니다. '
          +'입력 내용은 저장되지 않습니다.</div>'
          +'<div class="opts"><button type="button" class="opt sel" data-next="1">시작하기 →</button></div>';
      }},
    {n:2, short:"아이 이름", title:"① 출생자 — 이름·성별",
      q:"태어난 아이의 이름과 성별을 입력하세요.",
      why:"이름은 대법원이 정한 인명용 한자만 쓸 수 있고, 이름자(성 제외)는 5자를 넘길 수 없습니다.",
      kind:"childName",
      required:function(s){ var m=[];
        if(!String(s.child_surKor||"").trim()) m.push("성(한글)");
        if(!String(s.child_givenKor||"").trim()) m.push("이름(한글)");
        if(!s.child_sex) m.push("성별");
        /* ⚠️ 이 답이 뒤의 흐름을 가른다 — 「혼인 외」면 아버지(부) 단계와 성·본 협의가
           사라진다. 비워 둔 채로 넘어가면 그 갈림길이 정해지지 않는다. */
        if(!s.child_marital) m.push("혼인 중/외의 출생자");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"child_surKor", label:"성(한글)", req:true, half:true, ph:"정"});
        h+=A.inputHtml({k:"child_givenKor", label:"이름(한글)", req:true, half:true, ph:"산본"});
        /* 한자는 **한자 찾기**로 받는다(2026.09.01) — 8종 공통 component.
           ⛔ 「성(한자)·이름(한자)」 두 칸으로 되돌리지 마라. */
        h+=A.hanjaGridHtml("childName", [["child_surKor","child_surHan","성"],
                                         ["child_givenKor","child_givenHan","이름"]],
                           "아이 이름 한자 찾기");
        /* ⛔ `child_bon_kor` 는 화면에만 사는 칸이다 — 종이에는 한자(`child_bon`)만 들어간다. */
        h+=A.inputHtml({k:"child_bon_kor", label:"본(한글)", ph:"동래",
          help:"성씨의 본관입니다. 한글로 적으면 아래에서 한자를 고를 수 있습니다.", optHint:true});
        h+=A.hanjaGridHtml("childBon", [["child_bon_kor","child_bon"]], "본 한자 찾기");
        /* ⚠️ 배지와 검증은 **한 쌍**이다. 화면이 「필수」라 하고 넘어가지게 두거나,
           막으면서 아무 말도 하지 않으면 시민은 왜 막혔는지 모른다(2026.08.29 에 그랬다). */
        h+='<div class="field"><label class="field-label">성별 <span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("child_sex",SEX_OPTS)+'</div>';
        h+='<div class="field"><label class="field-label">혼인 중/외의 출생자'
          +' <span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("child_marital",MARITAL_OPTS,"부모가 혼인신고를 한 사이에 태어났으면 ‘혼인 중’입니다.")+'</div>';
        return h;
      }},
    {n:3, short:"출생 정보", title:"① 출생자 — 출생 정보",
      q:"언제·어디서 태어났는지 입력하세요.",
      why:"출생일시는 24시각제로 적습니다(예: 오후 2시 30분 → 14시 30분). 등록기준지·주소는 부모가 정한 곳을 적습니다.",
      kind:"childBirth",
      required:function(s){ var m=[];
        if(!String(s.child_birthDate||"").trim()) m.push("출생 연월일");
        /* 출생 시각은 가족관계등록부에 그대로 올라간다 — 비워 두면 창구에서 되돌아온다 */
        if(!String(s.child_birthHour||"").trim()) m.push("출생 시각(시)");
        if(!String(s.child_birthMin||"").trim()) m.push("출생 시각(분)");
        if(!s.child_birthPlace) m.push("출생 장소");
        if(!String(s.child_birthPlaceAddr||"").trim()) m.push("출생 장소 주소");
        /* 조건부로 나타난 칸도 나타난 이상 필수다(담당자 요구) */
        if(s.child_birthPlace==="기타" && !String(s.child_birthPlaceEtc||"").trim())
          m.push("출생 장소(기타) 상세");
        if(!String(s.child_addr||"").trim()) m.push("주소");
        if(!String(s.child_headName||"").trim()) m.push("세대주 성명");
        if(!String(s.child_headRel||"").trim()) m.push("세대주와의 관계");
        return m; },
      /* 비어 있는지가 아니라 **말이 되는 값인지**를 본다. 출생 시각은 24시각제라
         25시·70분 같은 값이 그대로 가족관계등록부에 올라가면 창구에서 되돌아온다. */
      invalid:function(s){ var m=[];
        var hh=String(s.child_birthHour||"").trim(), mi=String(s.child_birthMin||"").trim();
        if(hh && (!/^\d{1,2}$/.test(hh) || +hh>23)) m.push("출생 시각(시)은 0~23 사이 숫자로 적어 주세요");
        if(mi && (!/^\d{1,2}$/.test(mi) || +mi>59)) m.push("출생 시각(분)은 0~59 사이 숫자로 적어 주세요");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"child_birthDate", label:"출생 연월일", type:"date", req:true, ph:"2026.07.20",
          help:"예: 2026.07.20 (숫자 8자리를 적으면 자동으로 정리됩니다)"});
        /* ⚠️ 라벨을 「시」·「분」으로 줄였다(2026.08.29). 반 칸이라 폭이 좁은데
           「출생 시각 — 시(時)」는 크게 보기에서 **필수 배지가 아랫줄로 접혔다.**
           바로 위가 「출생 연월일」이고 아래 설명이 24시각제를 말하므로 뜻은 그대로다.
           ⛔ 경고 문구(`required`)는 문장 안에 들어가므로 「출생 시각(시)」를 그대로 쓴다. */
        h+=A.inputHtml({k:"child_birthHour", label:"시", req:true, half:true, ph:"14",
          help:"24시각제. 오후 2시 → 14"});
        h+=A.inputHtml({k:"child_birthMin", label:"분", req:true, half:true, ph:"30"});
        h+='<div class="field"><label class="field-label">출생 장소 <span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("child_birthPlace",PLACE_OPTS)+'</div>';
        /* ⚠️ 2026.08.29 — **주소와 「기타」 상세는 다른 것이다**(담당자 요구). 종류를 고르는
           칸(`child_birthPlace`) · 어디인지 적는 칸(`child_birthPlaceAddr`) ·
           「기타」가 무엇인지 적는 칸(`child_birthPlaceEtc`) 셋을 섞지 않는다.
           ⛔ 주소칸을 조건부로 만들지 마라 — 자택·병원이어도 주소는 있어야 한다. */
        /* ⚠️ 2026.08.30 담당자 2차 — **주소까지만.** 종전에는 「병원이면 병원 이름까지 적으면
           좋습니다」라고 안내하고 예시에도 병원명을 넣어 두었다. 담당자 확인: 병원명은 적지 않는다.
           ⛔ 시설명을 적도록 유도하지 마라(예시·도움말 둘 다). */
        h+=A.inputHtml({k:"child_birthPlaceAddr", label:"출생 장소 주소", req:true,
          ph:"예: 경기도 군포시 산본로 000",
          help:"출생한 곳의 주소까지만 적어 주세요. 병원명은 적지 않습니다."});
        if(A.state.child_birthPlace==="기타")
          h+=A.inputHtml({k:"child_birthPlaceEtc", label:"출생 장소(기타) 상세", req:true,
            ph:"예: 이동 중 차량 안",
            help:"자택·병원이 아닌 어떤 곳이었는지 적습니다."});
        h+=A.inputHtml({k:"child_regBase", label:"부모가 정한 등록기준지", ph:"경기도 군포시 …",
          help:"아이의 가족관계등록부 기준이 되는 주소.", optHint:true});
        h+=A.inputHtml({k:"child_addr", label:"주소", req:true, ph:"경기도 군포시 …",
          help:"아이가 실제로 살(주민등록) 주소."});
        h+=A.inputHtml({k:"child_headName", label:"세대주 성명", req:true, half:true, ph:"정군포",
          help:"아이가 속할 세대의 세대주."});
        h+=A.inputHtml({k:"child_headRel", label:"세대주와의 관계", req:true, half:true, ph:"자녀(자·녀)"});
        h+=A.inputHtml({k:"child_dualNat", label:"복수국적 시 취득한 외국 국적", ph:"예: 미국",
          help:"아이가 복수국적자인 경우에만 적습니다."});
        return h;
      }},
    /* ⚠️ **혼인 외 출생이면 이 단계를 통째로 건너뛴다**(2026.08.29 담당자 확인).
       종전에는 늘 보여 주고 안내문으로만 「비워 둘 수 있습니다」라고 했는데,
       「모든 항목 필수」로 바꾸는 순간 **적을 수 없는 분들이 갇힌다.**
       ⛔ 이 `when` 을 지우려면 아래 `required` 도 함께 봐라 — 둘이 한 쌍이다. */
    {n:4, short:"부(父)", title:"② 아버지(부) 정보",
      when:function(s){ return s.child_marital!==UNWED; },
      q:"아버지(부)의 정보를 입력하세요.",
      why:"혼인 중의 출생자는 아버지 정보를 함께 적습니다. 본·한자·등록기준지는 모르면 비워 두세요.",
      kind:"fields",
      required:function(s){ var m=[];
        if(!String(s.f_name||"").trim()) m.push("아버지 성명(한글)");
        /* ⛔ 주민등록번호는 **선택**이다(2026.08.30 담당자) — 필수 목록에 다시 넣지 마라. */
        return m; },
      body:function(A){ return A.fieldsHtml(parentFields("f")); }},
    {n:5, short:"모(母)", title:"② 어머니(모) 정보",
      q:"어머니(모)의 정보를 입력하세요.", kind:"mother",
      required:function(s){ var m=[];
        if(!String(s.m_name||"").trim()) m.push("어머니 성명(한글)");
        /* ⛔ 주민등록번호는 **선택**이다(2026.08.30 담당자) — 필수 목록에 다시 넣지 마라. */
        /* ⛔ 등록기준지는 필수가 아니다 — 모르면 창구가 알려 준다(`OPT_HELP`). */
        if(s.child_marital!==UNWED && !s.sonbon_consent) m.push("성·본 협의서 제출 여부");
        return m; },
      body:function(A){
        var h=A.fieldsHtml(parentFields("m"));
        /* ⚠️ 서식 문구가 「**혼인신고 시** …」라 혼인 중에만 뜻이 있다. 혼인 외에는 묻지 않는다
           (2026.08.29 담당자 확인). ⛔ 항상 묻도록 되돌리지 마라. */
        if(A.state.child_marital!==UNWED)
          h+='<div class="field"><label class="field-label">혼인신고 시 성·본 협의서 제출 여부'
            +' <span class="fb fb-req">필수</span></label>'
            +A.choiceHtml("sonbon_consent",YN_OPTS,"자녀의 성·본을 어머니의 성·본으로 하는 협의서를 냈으면 ‘예’.")+'</div>';
        return h;
      }},
    {n:6, short:"기타", title:"③④ 특정사항·기타사항",
      q:"해당하는 경우에만 적습니다. 없으면 넘어가세요.",
      why:"③은 친생자관계 부존재확인판결 등으로 가족관계등록부가 폐쇄된 뒤 다시 출생신고하는 드문 경우입니다. ④는 그 밖에 특별히 밝힐 사항입니다.",
      kind:"etc",
      body:function(A){
        var h='';
        h+='<div class="note-box">대부분 <b>비워 둡니다.</b> 해당하는 경우에만 적으세요.</div>';
        h+='<div class="sum-sec"><h4>③ 폐쇄등록부상 특정사항 (드문 경우)</h4>';
        h+=A.inputHtml({k:"closed_name", label:"성명", half:true});
        h+=A.inputHtml({k:"closed_jumin", label:"주민등록번호", type:"jumin", half:true});
        h+=A.inputHtml({k:"closed_regBase", label:"등록기준지", optHint:true})+'</div>';
        h+=A.inputHtml({k:"etc", label:"④ 기타사항", help:"후순위 신고, 태아인지 관련 등 특별히 밝힐 내용."});
        return h;
      }},
    {n:7, short:"신고인", title:"⑤ 신고인",
      q:"신고서를 작성·제출하는 분(신고인)의 정보를 입력하세요.",
      why:"보통 아버지 또는 어머니가 신고인입니다. 신고인 성명·주민등록번호는 대조 확인용입니다.",
      kind:"reporter",
      required:function(s){ var m=[];
        if(!String(s.reporter_name||"").trim()) m.push("신고인 성명");
        /* ⛔ 주민등록번호는 **선택**이다(2026.08.30 담당자) — 필수 목록에 다시 넣지 마라. */
        if(!String(s.reporter_addr||"").trim()) m.push("신고인 주소");
        if(!String(s.reporter_phone||"").trim()) m.push("전화번호");
        if(!s.reporter_qual) m.push("신고인 자격");
        if(s.reporter_qual==="기타" && !String(s.reporter_qualEtc||"").trim()) m.push("기타 자격 상세");
        return m; },
      body:function(A){
        var h='', rf=reporterFields();
        for(var r=0;r<rf.length;r++) h+=A.inputHtml(rf[r]);
        h+='<div class="field"><label class="field-label">신고인 자격 <span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("reporter_qual",QUAL_OPTS,"신고인이 아이와 어떤 관계인지 선택하세요.")+'</div>';
        if(A.state.reporter_qual==="기타")
          h+=A.inputHtml({k:"reporter_qualEtc", label:"기타 자격 상세", req:true, ph:"예: 후견인"});
        return h;
      }},
    {n:8, short:"제출인", title:"⑥ 제출인",
      q:"신고인이 아닌 다른 사람이 제출할 때만 적습니다.", kind:"submit",
      body:function(A){
        var h='';
        h+='<div class="note-box">신고인 본인이 직접 제출하면 이 단계는 <b>비워 두세요.</b> '
          +'신고인이 아닌 다른 사람이 대신 제출할 때만 적습니다.</div>';
        h+=A.inputHtml({k:"sub_name", label:"제출인 성명", half:true});
        h+=A.inputHtml({k:"sub_jumin", label:"제출인 주민등록번호", type:"jumin", half:true});
        return h;
      }},
    /* ⚠️ 2026.08.29 — 신서식은 이 조사의 주체를 「통계청」이 아니라 **「국가데이터처」**로 적는다.
       ⛔ 나머지 3종(사망·혼인·이혼)의 서식 원본은 아직 통계청 표기다 — 거기 문구는 건드리지 마라. */
    {n:9, short:"인구동향", title:"인구동향조사(통계)",
      q:"국가데이터처 인구동향조사 항목입니다.",
      why:"성실응답 의무가 있는 통계 항목이며, 개인정보는 보호됩니다. 부모의 최종 졸업학교를 선택하세요.", kind:"survey",
      required:function(s){ var m=[];
        /* 아버지 학력은 아버지 단계가 나온 경우에만 묻는다(혼인 중) */
        if(s.child_marital!==UNWED && !s.f_edu) m.push("아버지 최종 졸업학교");
        if(!s.m_edu) m.push("어머니 최종 졸업학교");
        return m; },
      body:function(A){
        var h='';
        if(A.state.child_marital!==UNWED)
          h+='<div class="field"><label class="field-label">㉮ 최종 졸업학교 — 아버지(부)'
            +' <span class="fb fb-req">필수</span></label>'+A.choiceHtml("f_edu",EDU)+'</div>';
        h+='<div class="field"><label class="field-label">㉮ 최종 졸업학교 — 어머니(모)'
          +' <span class="fb fb-req">필수</span></label>'+A.choiceHtml("m_edu",EDU)+'</div>';
        return h;
      }},
    {n:10, short:"완료", title:"작성 내용 확인", q:"고르신 것만 다시 확인해 주세요.", kind:"summary",
      body:function(){
        /* ⛔ 출력 후 행동은 여기 두지 않는다 — 미리보기(인쇄 준비 화면)의 `afterPrint` 로 옮겼다. */
        return buildSummary();
      }}
  ],

  applySample:function(state, kind){
    Object.assign(state,{
      step:2,
      child_surKor:"정", child_givenKor:"산본", child_surHan:"鄭", child_givenHan:"山本",
      child_bon:"東萊", child_bon_kor:"동래", child_sex:"여", child_marital:"혼인 중",
      child_birthDate:"2026.07.20", child_birthHour:"14", child_birthMin:"30",
      child_birthPlace:"병원",
      /* ⛔ 작성예시에 **병원명을 넣지 마라**(2026.08.30 담당자 2차). 예시가 곧 본보기다 —
         여기에 시설명이 있으면 안내문으로 아무리 막아도 그대로 따라 적는다. */
      child_birthPlaceAddr:"경기도 군포시 산본로 000",
      child_regBase:"경기도 군포시 산본로 000",
      child_addr:"경기도 군포시 산본로 000, 101동 1001호",
      child_headName:"정군포", child_headRel:"자녀(녀)",
      f_name:"정군포", f_nameHan:"鄭軍浦", f_bon:"東萊", f_bon_kor:"동래", f_jumin:"8803151000000",
      f_regBase:"경기도 군포시 산본로 000", f_edu:"대학(교)",
      m_name:"윤부곡", m_nameHan:"尹富谷", m_bon:"坡平", m_bon_kor:"파평", m_jumin:"9007222000000",
      m_regBase:"경기도 군포시 산본로 000", m_edu:"대학(교)",
      sonbon_consent:"아니요",
      reporter_name:"정군포", reporter_jumin:"8803151000000", reporter_qual:"부",
      reporter_addr:"경기도 군포시 산본로 000, 101동 1001호", reporter_phone:"01012345678",
      reporter_email:"gunpo@example.com"
    });
    if(kind==="unwed"){
      state.child_marital="혼인 외";
      state.child_headName="윤부곡"; state.child_headRel="자녀(녀)";
      state.f_name=""; state.f_nameHan=""; state.f_bon=""; state.f_jumin=""; state.f_regBase=""; state.f_edu="";
      state.reporter_name="윤부곡"; state.reporter_jumin="9007222000000"; state.reporter_qual="모";
      state.reporter_email="bugok@example.com";
    }
  }
};
