/* =====================================================================
   혼인신고서(양식 제10호) — FORM 설정
   engine/engine.js와 함께 build-form.js가 자체완결 HTML로 인라인한다.

   ⚠️ 2026.08.29 — 이 파일은 **새로 만든 것이 아니라 제자리로 되돌린 것**이다.
      종전에는 `marriage-helper-v1.html` 안에 옛 엔진이 통째로 복제돼 있었고
      (`CO`·`STEPS`·`STEP_HL`·`renderForm` 인라인) 손으로 유지되고 있었다.
      포크가 갈라져 **필수 검증(`required`)이 한 곳도 없었다.**

   ⛔ **인쇄층의 원본은 `서식원본/혼인신고서(20260828).pdf` 하나다.**
      같은 폴더의 `혼인신고서(서식).pdf` 는 **구본(통계청 표기 시절)** 이고 대조용이다.
      ⚠️ 그것으로 배경을 다시 만들면 **판면이 달라 좌표가 전부 어긋난다** —
         화면은 멀쩡하고 **인쇄물만** 어긋나므로 눈치채기 어렵다.

   재생성: python tools/prep-bg.py marriage "서식원본/혼인신고서(20260828).pdf"
          node tools/build-form.js marriage
          python tools/verify-print.py        ← 반드시 0px 확인
   ===================================================================== */
var MARTYPE=["초혼","사별 후 재혼","이혼 후 재혼"];
var EDU=["학력 없음","초등학교","중학교","고등학교","대학(교)","대학원 이상"];
var JOB=["관리직","전문직","사무직","서비스직","판매직","농림어업","기능직",
         "장치·기계 조작 및 조립","단순노무직","군인","학생·가사·무직"];

/* 혼인당사자 한 사람의 항목. `p` 는 "h"(남편) 또는 "w"(아내).
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
function parentFields(p){
  return [
    {k:p+"_fName", label:"아버지 성명", req:true, ph:"김철수"},
    {k:p+"_fJumin", label:"아버지 주민등록번호", type:"jumin", req:true, ph:"600101-0000000"},
    {k:p+"_fRegBase", label:"아버지 등록기준지", ph:"경기도 …", optHint:true},
    {k:p+"_mName", label:"어머니 성명", req:true, ph:"이순자"},
    {k:p+"_mJumin", label:"어머니 주민등록번호", type:"jumin", req:true, ph:"630101-0000000"},
    {k:p+"_mRegBase", label:"어머니 등록기준지", ph:"경기도 …", optHint:true}
  ];
}
var WIT_FIELDS=[
  {k:"wit1_name", label:"증인 1 성명", req:true, ph:"홍길동"},
  {k:"wit1_jumin", label:"증인 1 주민등록번호", type:"jumin", req:true},
  {k:"wit1_addr", label:"증인 1 주소", req:true, ph:"경기도 …"},
  {k:"wit2_name", label:"증인 2 성명", req:true, ph:"성춘향"},
  {k:"wit2_jumin", label:"증인 2 주민등록번호", type:"jumin", req:true},
  {k:"wit2_addr", label:"증인 2 주소", req:true, ph:"경기도 …"}
];
function personKeys(p){
  return [p+"_surKor",p+"_givenKor",p+"_surHan",p+"_givenHan",p+"_bon",p+"_phone",
          p+"_birth",p+"_jumin",p+"_regBase",p+"_addr",
          p+"_fName",p+"_fJumin",p+"_fRegBase",p+"_mName",p+"_mJumin",p+"_mRegBase",
          p+"_marType",p+"_edu",p+"_job",
          p+"_cFather",p+"_cMother",p+"_gName",p+"_gJumin"];
}
function fullName(p){ return ((state[p+"_surKor"]||"")+(state[p+"_givenKor"]||"")).trim(); }
function buildSummary(){
  var d=state, h='';
  h+='<div class="sum-sec"><h4>혼인당사자</h4>';
  h+=sumRow("남편(부)", fullName("h")+(d.h_jumin?" · "+formatJumin(d.h_jumin):""));
  h+=sumRow("아내(처)", fullName("w")+(d.w_jumin?" · "+formatJumin(d.w_jumin):""));
  h+=sumRow("남편 등록기준지", d.h_regBase);
  h+=sumRow("아내 등록기준지", d.w_regBase);
  h+='</div><div class="sum-sec"><h4>증인</h4>';
  h+=sumRow("증인 1", (d.wit1_name||"")+(d.wit1_jumin?" · "+formatJumin(d.wit1_jumin):""));
  h+=sumRow("증인 2", (d.wit2_name||"")+(d.wit2_jumin?" · "+formatJumin(d.wit2_jumin):""));
  h+='</div><div class="sum-sec"><h4>신고 항목</h4>';
  h+=sumRow("근친혼 여부", d.kinship);
  h+=sumRow("성·본 협의", d.seongbon);
  h+=sumRow("출석", [d.attend_h?"남편":"", d.attend_w?"아내":""].filter(Boolean).join(", "));
  return h+'</div>';
}

var FORM={
  /* ⛔ 이 한 줄이 껍데기를 정한다 — Product UI v1(`engine/base-product.html`). */
  shell:"product",
  docTitle:"혼인신고서 작성 미리보기 도우미",
  formName:"혼인신고서",
  org:{ orgName:"경기도 군포시", officeName:"군포시청 민원실" },
  sampleLabels:["작성예시(성인)","작성예시(미성년)"],
  sampleKinds:["adult","minor"],

  /* 안내 기둥의 준비물 — 담당자 확인(2026.08.29).
     ⛔ 지어내지 마라. 서식 첨부서류는 대부분 조건부이고, 상시 필요한 것은 신분확인뿐이다.
     ⚠️ 혼인은 **당사자가 둘**이라 신분증도 둘이다 — 한 줄로 묶지 않는다. */
  ready:[
    { t:"남편(부) 신분증", s:"접수할 때 창구에서 확인합니다", g:"idcard", req:true },
    { t:"아내(처) 신분증", s:"접수할 때 창구에서 확인합니다", g:"idcard", req:true },
    { t:"도장", s:"서명으로 갈음할 수 있습니다", g:"stamp", req:true }
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

  stateKeys:[].concat(personKeys("h"),personKeys("w"),
    ["seongbon","kinship","foreignDate","etc",
     "wit1_name","wit1_jumin","wit1_addr","wit2_name","wit2_jumin","wit2_addr",
     "attend_h","attend_w","sub_name","sub_jumin","cohabitDate"]),
  stateDefaults:{ attend_h:false, attend_w:false },

  CO:{
    texts:{
      "h_surKor":{x:172.5,y:116.3,a:"c",size:8},
      "h_givenKor":{x:230.2,y:116.3,a:"c",size:8},
      "w_surKor":{x:379.5,y:116.3,a:"c",size:8},
      "w_givenKor":{x:450.6,y:116.3,a:"c",size:8},
      "h_surHan":{x:165.8,y:131.8,a:"c",size:8},
      "h_givenHan":{x:239.1,y:131.8,a:"c",size:8},
      "w_surHan":{x:367.6,y:131.8,a:"c",size:8},
      "w_givenHan":{x:450.6,y:131.8,a:"c",size:8},
      "h_bon":{x:162.5,y:147.8,a:"c",size:7.5},
      "h_phone":{x:283.5,y:147.8,a:"c",size:7},
      "w_bon":{x:405.5,y:147.8,a:"c",size:7.5},
      "w_phone":{x:502.9,y:147.8,a:"c",size:7},
      "h_birth":{x:238.0,y:164.1,a:"c",size:8},
      "w_birth":{x:443.8,y:164.1,a:"c",size:8},
      "h_jumin1":{x:186.9,y:179.3,a:"c",size:8},
      "h_jumin2":{x:289.1,y:179.3,a:"c",size:8},
      "w_jumin1":{x:389.7,y:179.3,a:"c",size:8},
      "w_jumin2":{x:497.8,y:179.3,a:"c",size:8},
      "h_regBase":{x:143.7,y:195.1,a:"l",size:7,w:189.0,wrap:true},
      "w_regBase":{x:342.6,y:195.1,a:"l",size:7,w:198.0,wrap:true},
      "h_addr":{x:143.7,y:217.8,a:"l",size:7,w:189.0,wrap:true},
      "w_addr":{x:342.6,y:217.8,a:"l",size:7,w:198.0,wrap:true},
      "h_fName":{x:238.0,y:240.9,a:"c",size:8},
      "w_fName":{x:443.8,y:240.9,a:"c",size:8},
      "h_fJumin1":{x:186.9,y:257.2,a:"c",size:8},
      "h_fJumin2":{x:289.1,y:257.2,a:"c",size:8},
      "w_fJumin1":{x:389.7,y:257.2,a:"c",size:8},
      "w_fJumin2":{x:497.8,y:257.2,a:"c",size:8},
      "h_fRegBase":{x:143.7,y:272.6,a:"l",size:7,w:189.0,wrap:true},
      "w_fRegBase":{x:342.6,y:272.6,a:"l",size:7,w:198.0,wrap:true},
      "h_mName":{x:238.0,y:288.9,a:"c",size:8},
      "w_mName":{x:443.8,y:288.9,a:"c",size:8},
      "h_mJumin1":{x:186.9,y:305.1,a:"c",size:8},
      "h_mJumin2":{x:289.1,y:305.1,a:"c",size:8},
      "w_mJumin1":{x:389.7,y:305.1,a:"c",size:8},
      "w_mJumin2":{x:497.8,y:305.1,a:"c",size:8},
      "h_mRegBase":{x:143.7,y:320.4,a:"l",size:7,w:189.0,wrap:true},
      "w_mRegBase":{x:342.6,y:320.4,a:"l",size:7,w:198.0,wrap:true},
      "foreignY":{x:280.5,y:337.7,a:"c",size:8},
      "foreignM":{x:342.3,y:337.7,a:"c",size:8},
      "foreignD":{x:405.3,y:337.7,a:"c",size:8},
      "etc":{x:147.1,y:385.6,a:"l",size:7.5,w:383.0,wrap:true},
      "wit1_name":{x:194.6,y:399.9,a:"c",size:8},
      "wit1_jumin1":{x:465.8,y:399.9,a:"c",size:7},
      "wit1_jumin2":{x:523.0,y:399.9,a:"c",size:7},
      "wit1_addr":{x:143.7,y:415.2,a:"l",size:7,w:389.0,wrap:true},
      "wit2_name":{x:194.6,y:431.5,a:"c",size:8},
      "wit2_jumin1":{x:465.8,y:431.5,a:"c",size:7},
      "wit2_jumin2":{x:523.0,y:431.5,a:"c",size:7},
      "wit2_addr":{x:143.7,y:447.8,a:"l",size:7,w:389.0,wrap:true},
      "h_cFather":{x:184.7,y:462.1,a:"c",size:7.5},
      "h_cMother":{x:184.7,y:476.5,a:"c",size:7.5},
      "w_cFather":{x:184.7,y:492.8,a:"c",size:7.5},
      "w_cMother":{x:184.7,y:508.9,a:"c",size:7.5},
      "h_gName":{x:466.6,y:462.1,a:"c",size:7.5},
      "h_gJumin":{x:484.8,y:476.5,a:"c",size:7,w:133.0},
      "w_gName":{x:466.6,y:492.8,a:"c",size:7.5},
      "w_gJumin":{x:484.8,y:508.9,a:"c",size:7,w:133.0},
      "sub_name":{x:241.6,y:543.1,a:"c",size:8},
      "sub_jumin1":{x:463.5,y:543.1,a:"c",size:7},
      "sub_jumin2":{x:523.6,y:543.1,a:"c",size:7},
      "cohabitY":{x:264.8,y:654.3,a:"c",size:8},
      "cohabitM":{x:300.3,y:654.3,a:"c",size:8},
      "cohabitD":{x:336.8,y:654.3,a:"c",size:8}
    },
    checks:{
      "seongbon":{"예":[437.0,352.1], "아니요":[489.0,352.1]},
      "kinship":{"예":[437.0,367.9], "아니요":[490.0,367.9]},
      "h_marType":{"초혼":[138.7,667.3], "사별 후 재혼":[172.4,667.3], "이혼 후 재혼":[242.1,667.3]},
      "w_marType":{"초혼":[362.6,667.3], "사별 후 재혼":[396.3,667.3], "이혼 후 재혼":[466.0,667.3]},
      "h_edu":{"학력 없음":[138.7,682.4], "초등학교":[200.9,682.4], "중학교":[265.3,682.4], "고등학교":[138.7,697.4], "대학(교)":[200.9,697.4], "대학원 이상":[265.3,697.4]},
      "w_edu":{"학력 없음":[362.6,682.4], "초등학교":[426.1,682.4], "중학교":[491.4,682.4], "고등학교":[362.6,697.4], "대학(교)":[426.1,697.4], "대학원 이상":[491.4,697.4]},
      "h_job":{"관리직":[138.7,712.5], "전문직":[215.1,712.5], "사무직":[138.7,727.6], "서비스직":[215.1,727.6], "판매직":[138.7,742.7], "농림어업":[215.1,742.7], "기능직":[138.7,757.9], "장치·기계 조작 및 조립":[215.1,757.9], "단순노무직":[138.7,773.0], "군인":[215.1,773.0], "학생·가사·무직":[138.7,788.0]},
      "w_job":{"관리직":[362.6,712.5], "전문직":[440.2,712.5], "사무직":[362.6,727.6], "서비스직":[440.2,727.6], "판매직":[362.6,742.7], "농림어업":[440.2,742.7], "기능직":[362.6,757.9], "장치·기계 조작 및 조립":[440.2,757.9], "단순노무직":[362.6,773.0], "군인":[440.2,773.0], "학생·가사·무직":[362.6,788.0]}
    },
    attend:{"attend_h":[267.5,527.8], "attend_w":[380.5,527.8]}
  },

  STEP_HL:{
  2:[[137.2,105.9,339.1,232.3]], 3:[[335.7,105.9,551.8,232.3]],
  4:[[137.3,232.3,339.1,328.1]], 5:[[335.7,232.3,551.8,328.1]],
  6:[[43.9,328.1,551.6,392.3]],  7:[[44.0,392.3,551.8,455.4]],
  8:[[44.0,455.4,551.7,550.7]],  9:[[41.9,634.1,553.5,798.4]]
},

  buildVals:function(state){
    var d=state, v={};
    ["h_surKor","h_givenKor","h_surHan","h_givenHan","h_bon","h_birth","h_regBase","h_addr",
     "w_surKor","w_givenKor","w_surHan","w_givenHan","w_bon","w_birth","w_regBase","w_addr",
     "h_fName","h_fRegBase","h_mName","h_mRegBase","w_fName","w_fRegBase","w_mName","w_mRegBase",
     "etc","wit1_name","wit1_addr","wit2_name","wit2_addr",
     "h_gName","w_gName","sub_name"
    ].forEach(function(k){ v[k]=d[k]||""; });
    /* ⑧ 동의자 — 미성년자가 혼인하는 경우에만, ② 부모(양부모)에 적은 이름을 그대로 쓴다 */
    v.h_cFather = isMinor("h") ? (d.h_fName||"") : "";
    v.h_cMother = isMinor("h") ? (d.h_mName||"") : "";
    v.w_cFather = isMinor("w") ? (d.w_fName||"") : "";
    v.w_cMother = isMinor("w") ? (d.w_mName||"") : "";
    v.h_phone=formatPhone(d.h_phone); v.w_phone=formatPhone(d.w_phone);
    ["h_jumin","w_jumin","h_fJumin","w_fJumin","h_mJumin","w_mJumin",
     "wit1_jumin","wit2_jumin","sub_jumin"].forEach(function(f){
      v[f+"1"]=j1(d[f]); v[f+"2"]=j2(d[f]);
    });
    v.h_gJumin=formatJumin(d.h_gJumin); v.w_gJumin=formatJumin(d.w_gJumin);
    var fd=ymd(d.foreignDate); v.foreignY=fd[0]; v.foreignM=fd[1]; v.foreignD=fd[2];
    var cd=ymd(d.cohabitDate); v.cohabitY=cd[0]; v.cohabitM=cd[1]; v.cohabitD=cd[2];
    return v;
  },

  /* 인쇄 후 직접 서명·날인해야 하는 칸 — 내용이 있을 때만 형광펜을 친다 */
  signatureHI:function(v){
    var HI=[];
    if(v.h_surKor||v.h_givenKor) HI.push([264.6,108.2,336.8,140.0]);
    if(v.w_surKor||v.w_givenKor) HI.push([479.0,108.2,550.7,140.0]);
    if(v.wit1_name) HI.push([258.0,392.3,339.9,407.6]);
    if(v.wit2_name) HI.push([258.0,423.8,339.9,439.2]);
    if(v.h_cFather) HI.push([254.4,456.4,340.1,471.8]);
    if(v.h_cMother) HI.push([254.4,471.8,340.1,487.0]);
    if(v.w_cFather) HI.push([254.4,488.0,340.1,503.4]);
    if(v.w_cMother) HI.push([254.4,504.3,303.8,519.1]);
    if(v.h_gName) HI.push([507.5,456.4,550.7,471.8]);
    if(v.w_gName) HI.push([507.5,488.0,550.7,503.4]);
    return HI;
  },

  STEPS:[
    /* ⛔ 시작 화면은 보여 주지 않는다 — 허브에서 이미 혼인신고를 고르고 들어왔다.
       ⚠️ 단계를 지우지 않고 `when` 으로 숨긴다(`STEP_HL`·`applySample` 이 절대 번호를 쓴다). */
    {n:1, short:"시작", title:"혼인신고서 작성 시작",
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
      required:function(s){ return reqParent(s,"h","남편"); },
      body:function(A){ return parentFields("h").map(A.inputHtml).join(""); }},

    {n:5, short:"아내 부모", title:"② 아내(처)의 부모",
      q:"아내(처)의 부모(양부모) 정보를 입력하세요.",
      required:function(s){ return reqParent(s,"w","아내"); },
      body:function(A){ return parentFields("w").map(A.inputHtml).join(""); }},

    {n:6, short:"신고항목", title:"신고 관련 항목", q:"해당하는 항목을 선택하세요.",
      required:function(s){ var m=[];
        if(!s.seongbon) m.push("성·본의 협의");
        if(!s.kinship) m.push("근친혼 여부");
        return m; },
      body:function(A){
        var h='';
        h+='<div class="field"><label class="field-label">④ 성·본의 협의 <span class="fb fb-req">필수</span></label>';
        h+=A.choiceHtml("seongbon",["예","아니요"],"자녀의 성·본을 어머니의 성·본으로 하기로 협의했나요? 해당 없으면 ‘아니요’.")+'</div>';
        h+='<div class="field"><label class="field-label">⑤ 근친혼 여부 <span class="fb fb-req">필수</span></label>';
        h+=A.choiceHtml("kinship",["예","아니요"],"두 사람이 8촌 이내 혈족인가요? 보통은 ‘아니요’입니다.")+'</div>';
        h+=A.inputHtml({k:"foreignDate", label:"③ 외국방식 혼인성립일자", type:"date",
          ph:"2026.01.01", help:"외국 방식으로 이미 혼인한 경우에만 적습니다. 아니면 비워 두세요."});
        h+=A.inputHtml({k:"etc", label:"⑥ 기타사항", help:"특별히 밝힐 내용이 있을 때만 적습니다."});
        return h;
      }},

    {n:7, short:"증인", title:"⑦ 증인 2명",
      q:"성년(만 19세 이상) 증인 2명의 정보를 입력하세요.",
      why:"혼인신고에는 성년 증인 2명의 서명 또는 날인이 필요합니다.",
      required:function(s){ var m=[];
        ["wit1","wit2"].forEach(function(w,i){
          if(!String(s[w+"_name"]||"").trim()) m.push("증인 "+(i+1)+" 성명");
          if(!String(s[w+"_jumin"]||"").trim()) m.push("증인 "+(i+1)+" 주민등록번호");
          if(!String(s[w+"_addr"]||"").trim()) m.push("증인 "+(i+1)+" 주소");
        });
        return m; },
      body:function(A){
        /* ⚠️ 담당자 요구 문구다(2026.08.29). ⛔ 부드럽게 고쳐 쓰지 마라 —
           대리서명은 신고 자체가 무효가 될 수 있는 자리다. */
        return '<div class="warn-strong">인쇄 후 직접 서명 또는 날인을 합니다. (대리서명 금지)</div>'
          + WIT_FIELDS.map(A.inputHtml).join("");
      }},

    {n:8, short:"출석·제출", title:"⑨⑩⑧ 출석·제출·동의",
      q:"출석 여부와 제출인을 확인하세요.",
      required:function(s){
        return (s.attend_h||s.attend_w) ? [] : ["출석하신 분(남편·아내)"];
      },
      body:function(A){
        var h='';
        h+='<div class="field"><label class="field-label">⑨ 신고인 출석 여부 <span class="fb fb-req">필수</span></label>';
        h+='<div class="q-help">신고서를 제출하러 직접 오신 분을 모두 선택하세요.</div>';
        h+='<div class="opts row">'+A.toggleHtml("attend_h","남편(부)")+A.toggleHtml("attend_w","아내(처)")+'</div></div>';
        h+='<div class="field"><label class="field-label">⑩ 제출인 <span class="fb fb-opt">선택</span></label>';
        h+='<div class="q-help">신고인이 아닌 다른 사람이 제출할 때만 적습니다.</div></div>';
        h+=A.inputHtml({k:"sub_name", label:"제출인 성명", half:true});
        h+=A.inputHtml({k:"sub_jumin", label:"제출인 주민등록번호", type:"jumin", half:true});
        var minorH=isMinor("h"), minorW=isMinor("w");
        if(minorH||minorW){
          var who=[minorH?"남편(부)":"", minorW?"아내(처)":""].filter(Boolean).join("·");
          h+='<div class="note-box">⑧ 미성년자('+who+')가 혼인하는 경우 <b>부모(또는 후견인)의 동의</b>가 필요합니다. '
            +'<b>② 부모(양부모)</b>에 입력한 이름이 동의자란에 자동으로 표시됩니다. '
            +'부모가 아닌 <b>후견인</b>이 동의하는 경우에만 아래에 입력하세요. 서명·날인은 인쇄 후 직접 하시면 됩니다.</div>';
          if(minorH){
            h+=A.inputHtml({k:"h_gName", label:"남편 측 후견인 성명", half:true, help:"후견인이 동의하는 경우에만"});
            h+=A.inputHtml({k:"h_gJumin", label:"남편 측 후견인 주민등록번호", type:"jumin", half:true});
          }
          if(minorW){
            h+=A.inputHtml({k:"w_gName", label:"아내 측 후견인 성명", half:true, help:"후견인이 동의하는 경우에만"});
            h+=A.inputHtml({k:"w_gJumin", label:"아내 측 후견인 주민등록번호", type:"jumin", half:true});
          }
        }
        return h;
      }},

    {n:9, short:"인구동향", title:"인구동향조사(통계)",
      /* ⚠️ 신서식은 이 조사의 주체를 「국가데이터처」로 적는다(구본은 통계청). */
      q:"국가데이터처 인구동향조사 항목입니다.",
      why:"성실응답 의무가 있는 통계 항목이며, 개인정보는 보호됩니다. 신고서 맨 뒤에 있는 항목입니다.",
      required:function(s){ var m=[];
        if(!String(s.cohabitDate||"").trim()) m.push("실제 결혼(동거) 시작일");
        [["h","남편"],["w","아내"]].forEach(function(x){
          if(!s[x[0]+"_marType"]) m.push(x[1]+" 혼인종류");
          if(!s[x[0]+"_edu"]) m.push(x[1]+" 최종 졸업학교");
          if(!s[x[0]+"_job"]) m.push(x[1]+" 직업");
        });
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"cohabitDate", label:"㉮ 실제 결혼(동거) 시작일", type:"date", req:true,
          ph:"2025.12.01", help:"결혼식·혼인신고와 관계없이 실제로 함께 살기 시작한 날."});
        [["h","남편"],["w","아내"]].forEach(function(x){
          h+='<div class="field"><label class="field-label">㉯ 혼인종류 — '+x[1]
            +' <span class="fb fb-req">필수</span></label>'+A.choiceHtml(x[0]+"_marType",MARTYPE)+'</div>';
        });
        [["h","남편"],["w","아내"]].forEach(function(x){
          h+='<div class="field"><label class="field-label">㉰ 최종 졸업학교 — '+x[1]
            +' <span class="fb fb-req">필수</span></label>'+A.choiceHtml(x[0]+"_edu",EDU)+'</div>';
        });
        [["h","남편"],["w","아내"]].forEach(function(x){
          h+='<div class="field"><label class="field-label">㉱ 직업 — '+x[1]
            +' <span class="fb fb-req">필수</span></label>'+A.choiceHtml(x[0]+"_job",JOB)+'</div>';
        });
        return h;
      }},

    {n:10, short:"완료", title:"작성 내용 확인", q:"입력한 내용을 확인하세요.", kind:"summary",
      body:function(){
        return buildSummary()
          +'<div class="info-box">인쇄한 뒤, 서명·날인을 직접 하고 증인·부모 서명을 받아 '
          +'민원실에 제출하세요. 첨부서류(기본·혼인관계·가족관계증명서 등)는 담당 직원이 안내합니다.</div>';
      }}
  ],

  applySample:function(state, kind){
    Object.assign(state,{
      step:2,
      h_surKor:"김", h_givenKor:"영수", h_surHan:"金", h_givenHan:"英洙", h_bon:"金海",
      h_phone:"01012345678", h_birth:"1992.03.15", h_jumin:"9203151000000",
      h_regBase:"경기도 군포시 산본로 000", h_addr:"경기도 군포시 산본로 000, 101동 1001호",
      h_fName:"김철수", h_fJumin:"6001011000000", h_fRegBase:"경기도 군포시 산본로 000",
      h_mName:"이순자", h_mJumin:"6305012000000", h_mRegBase:"경기도 군포시 산본로 000",
      h_marType:"초혼", h_edu:"대학(교)", h_job:"사무직",
      w_surKor:"이", w_givenKor:"지은", w_surHan:"李", w_givenHan:"智恩", w_bon:"全州",
      w_phone:"01098765432", w_birth:"1994.07.22", w_jumin:"9407222000000",
      w_regBase:"서울특별시 강남구 테헤란로 000", w_addr:"경기도 군포시 산본로 000, 101동 1001호",
      w_fName:"이대한", w_fJumin:"6208011000000", w_fRegBase:"서울특별시 강남구 테헤란로 000",
      w_mName:"박민정", w_mJumin:"6511012000000", w_mRegBase:"서울특별시 강남구 테헤란로 000",
      w_marType:"초혼", w_edu:"대학(교)", w_job:"전문직",
      kinship:"아니요", seongbon:"아니요",
      wit1_name:"홍길동", wit1_jumin:"8001011000000", wit1_addr:"경기도 군포시 …",
      wit2_name:"성춘향", wit2_jumin:"8203022000000", wit2_addr:"경기도 안양시 …",
      attend_h:true, attend_w:true, cohabitDate:"2025.12.01"
    });
    if(kind==="minor"){
      /* 아슬아슬한 미성년 부부 — ⑧ 동의자란에 양쪽 ② 부모가 자동 표시된다 */
      state.h_jumin="0801153000000"; state.h_birth="2008.01.15";
      state.w_jumin="0903204000000"; state.w_birth="2009.03.20";
    }
  }
};

/* 필수 검증 도우미 — ⛔ 본·한자·등록기준지는 넣지 마라(선택 항목이다). */
function reqPerson(s, p, who){
  var m=[];
  if(!String(s[p+"_surKor"]||"").trim()) m.push(who+" 성(한글)");
  if(!String(s[p+"_givenKor"]||"").trim()) m.push(who+" 이름(한글)");
  if(!String(s[p+"_phone"]||"").trim()) m.push(who+" 전화번호");
  if(!String(s[p+"_jumin"]||"").trim()) m.push(who+" 주민등록번호");
  if(!String(s[p+"_birth"]||"").trim()) m.push(who+" 출생연월일");
  if(!String(s[p+"_addr"]||"").trim()) m.push(who+" 주소");
  return m;
}
function reqParent(s, p, who){
  var m=[];
  if(!String(s[p+"_fName"]||"").trim()) m.push(who+" 아버지 성명");
  if(!String(s[p+"_fJumin"]||"").trim()) m.push(who+" 아버지 주민등록번호");
  if(!String(s[p+"_mName"]||"").trim()) m.push(who+" 어머니 성명");
  if(!String(s[p+"_mJumin"]||"").trim()) m.push(who+" 어머니 주민등록번호");
  return m;
}
