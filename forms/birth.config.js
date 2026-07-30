/* =====================================================================
   출생신고서(양식 제1호) — FORM 설정
   engine/engine.js와 함께 build-form.js가 자체완결 HTML로 인라인한다.
   재생성: node tools/build-form.js birth
   ===================================================================== */
var EDU=["학력 없음","초등학교","중학교","고등학교","대학(교)","대학원 이상"];
var SEX_OPTS=["남","여"];
var MARITAL_OPTS=["혼인 중","혼인 외"];
var PLACE_OPTS=["자택","병원","기타"];
var YN_OPTS=["예","아니요"];
var QUAL_OPTS=["부","모","동거친족","기타"];

// ② 부모 인적사항
function parentFields(p){
  var isM=(p==="m");
  return [
    {k:p+"_name", label:"성명(한글)", req:isM, ph:isM?"이순자":"김철수"},
    {k:p+"_nameHan", label:"성명(한자)", ph:isM?"李順子":"金哲洙"},
    {k:p+"_bon", label:"본(한자)", ph:isM?"全州":"金海", help:"성씨의 본관을 한자로. 모르면 비워 두세요."},
    {k:p+"_jumin", label:"주민등록번호", type:"jumin", req:isM, ph:"800101-0000000",
      help:"외국인은 외국인등록번호를 적습니다."},
    {k:p+"_regBase", label:"등록기준지", req:isM, ph:"경기도 군포시 …",
      help:"가족관계등록부의 기준이 되는 주소. 외국인은 국적을 적습니다."}
  ];
}
function reporterFields(){
  return [
    {k:"reporter_name", label:"신고인 성명", req:true, ph:"김철수"},
    {k:"reporter_jumin", label:"주민등록번호", type:"jumin", ph:"800101-0000000"},
    {k:"reporter_addr", label:"주소", ph:"경기도 군포시 …"},
    {k:"reporter_phone", label:"전화번호", type:"phone", req:true, ph:"010-0000-0000"},
    {k:"reporter_email", label:"이메일", ph:"name@example.com"}
  ];
}
function childName(){ return ((state.child_surKor||"")+(state.child_givenKor||"")).trim(); }
function parentName(p){ return (state[p+"_name"]||"").trim(); }
function buildSummary(){
  var d=state, h='';
  h+='<div class="sum-sec"><h4>출생자</h4>';
  h+=sumRow("이름", childName()+(d.child_sex?" · "+d.child_sex:""));
  h+=sumRow("출생일시", [d.child_birthDate, (d.child_birthHour?d.child_birthHour+"시":"")+(d.child_birthMin?" "+d.child_birthMin+"분":"")].filter(function(x){return x&&x.trim();}).join(" "));
  h+=sumRow("출생장소", d.child_birthPlace+(d.child_birthPlace==="기타"&&d.child_birthPlaceEtc?" · "+d.child_birthPlaceEtc:""));
  h+=sumRow("등록기준지", d.child_regBase);
  h+=sumRow("주소", d.child_addr);
  h+='</div>';
  h+='<div class="sum-sec"><h4>부모</h4>';
  h+=sumRow("아버지(부)", parentName("f")+(d.f_jumin?" · "+formatJumin(d.f_jumin):""));
  h+=sumRow("어머니(모)", parentName("m")+(d.m_jumin?" · "+formatJumin(d.m_jumin):""));
  h+='</div>';
  h+='<div class="sum-sec"><h4>신고인</h4>';
  h+=sumRow("성명", d.reporter_name+(d.reporter_qual?" · "+d.reporter_qual+(d.reporter_qual==="기타"&&d.reporter_qualEtc?"("+d.reporter_qualEtc+")":""):""));
  h+=sumRow("전화", formatPhone(d.reporter_phone));
  h+='</div>';
  return h;
}

var FORM={
  docTitle:"출생신고서 작성 미리보기 도우미",
  formName:"출생신고서",
  org:{ orgName:"경기도 군포시", officeName:"군포시청 민원실" },
  sampleLabels:["작성예시(혼인 중)","작성예시(혼인 외)"],
  sampleKinds:["wed","unwed"],
  // 화면 하단 「이용 안내」 — 출생신고 고유 문구(1·4번째가 기본 문구와 다름)
  noticeItems:[
    "본 도구는 출생신고서 작성을 돕기 위한 미리보기 도구입니다.",
    "입력한 내용은 서버로 전송되지 않으며 저장되지 않습니다.",
    "공식 신고서와 항목·배치가 다를 수 있습니다.",
    "실제 접수 가능 여부와 필요 서류(출생증명서 등)는 담당 직원의 확인을 따릅니다.",
    "서명·날인은 인쇄한 뒤 본인이 직접 해야 합니다."
  ],
  rerenderOnSet:["child_birthPlace","reporter_qual"],
  today:{ y:88, yx:128, mx:173, dx:218 },

  stateKeys:[].concat(
    ["child_surKor","child_givenKor","child_surHan","child_givenHan","child_bon",
     "child_sex","child_marital","child_birthDate","child_birthHour","child_birthMin",
     "child_birthPlace","child_birthPlaceEtc","child_regBase","child_addr",
     "child_headName","child_headRel","child_dualNat"],
    ["f_name","f_nameHan","f_bon","f_jumin","f_regBase","f_edu"],
    ["m_name","m_nameHan","m_bon","m_jumin","m_regBase","m_edu"],
    ["sonbon_consent"],
    ["closed_name","closed_jumin","closed_regBase","etc"],
    ["reporter_name","reporter_jumin","reporter_qual","reporter_qualEtc",
     "reporter_addr","reporter_phone","reporter_email","sub_name","sub_jumin"]),

  CO:{
    texts:{
      "child_surKor":{x:186,y:112,a:"c",size:8}, "child_givenKor":{x:238,y:112,a:"c",size:8},
      "child_surHan":{x:186,y:147,a:"c",size:8}, "child_givenHan":{x:238,y:147,a:"c",size:8},
      "child_bon":{x:336,y:130,a:"c",size:7.5},
      "birthY":{x:206,y:175,a:"c",size:7.5,nb:true}, "birthMo":{x:245,y:175,a:"c",size:7.5,nb:true},
      "birthD":{x:283,y:175,a:"c",size:7.5,nb:true}, "birthH":{x:318,y:175,a:"c",size:7.5,nb:true},
      "birthMin":{x:353,y:175,a:"c",size:7.5,nb:true},
      "child_birthPlaceEtc":{x:300,y:194,a:"l",size:7,w:215},
      "child_regBase":{x:236,y:214,a:"l",size:7,w:280,wrap:true,nb:true},
      "child_addr":{x:156,y:239,a:"l",size:7,w:198,wrap:true,nb:true},
      "child_headName":{x:472,y:239,a:"r",size:7}, "child_headRel":{x:488,y:239,a:"l",size:7},
      "child_dualNat":{x:385,y:264,a:"l",size:6.5,w:135},
      "f_name":{x:170,y:284,a:"c",size:7.5}, "f_nameHan":{x:250,y:284,a:"c",size:7},
      "f_bon":{x:356,y:284,a:"c",size:7}, "f_jumin1":{x:465,y:284,a:"c",size:6.5}, "f_jumin2":{x:504,y:284,a:"c",size:6.5},
      "m_name":{x:170,y:303,a:"c",size:7.5}, "m_nameHan":{x:250,y:303,a:"c",size:7},
      "m_bon":{x:356,y:303,a:"c",size:7}, "m_jumin1":{x:465,y:303,a:"c",size:6.5}, "m_jumin2":{x:504,y:303,a:"c",size:6.5},
      "f_regBase":{x:196,y:322,a:"l",size:7,w:320,wrap:true,nb:true},
      "m_regBase":{x:196,y:342,a:"l",size:7,w:320,wrap:true,nb:true},
      "closed_name":{x:274,y:399,a:"c",size:7}, "closed_jumin1":{x:418,y:399,a:"c",size:7}, "closed_jumin2":{x:490,y:399,a:"c",size:7},
      "closed_regBase":{x:260,y:418,a:"l",size:7,w:255,wrap:true,nb:true},
      "etc":{x:150,y:437,a:"l",size:7.5,w:365,wrap:true},
      "reporter_name":{x:190,y:456,a:"c",size:8}, "reporter_jumin1":{x:418,y:456,a:"c",size:7}, "reporter_jumin2":{x:490,y:456,a:"c",size:7},
      "reporter_qualEtc":{x:340,y:475,a:"l",size:6.5,w:110},
      "reporter_addr":{x:150,y:500,a:"l",size:7.5,w:365,wrap:true,nb:true},
      "reporter_phone":{x:200,y:525,a:"c",size:7.5}, "reporter_email":{x:330,y:525,a:"l",size:6.5,w:190},
      "sub_name":{x:230,y:543,a:"c",size:8}, "sub_jumin1":{x:395,y:543,a:"c",size:7}, "sub_jumin2":{x:483,y:543,a:"c",size:7}
    },
    checks:{
      "child_sex":{"남":[405,121],"여":[405,139]},
      "child_marital":{"혼인 중":[437,121],"혼인 외":[437,139]},
      "child_birthPlace":{"자택":[191,194],"병원":[226,194],"기타":[261,194]},
      "sonbon_consent":{"예":[455.6,361.5],"아니요":[494.4,361.5]},
      "reporter_qual":{"부":[156,475],"모":[186,475],"동거친족":[216,475],"기타":[276,475]},
      "f_edu":{"학력 없음":[159,682],"초등학교":[224,682],"중학교":[285,682],"고등학교":[336,682],"대학(교)":[397,682],"대학원 이상":[456,682]},
      "m_edu":{"학력 없음":[159,707],"초등학교":[224,707],"중학교":[285,707],"고등학교":[336,707],"대학(교)":[397,707],"대학원 이상":[456,707]}
    },
    attend:{}
  },

  STEP_HL:{
    2:[[101,95,524,166]],
    3:[[101,166,524,274]],
    4:[[101,274,524,293],[101,313,524,332]],
    5:[[101,293,524,313],[101,332,524,371]],
    6:[[72,371,524,447]],
    7:[[72,447,524,534]],
    8:[[72,534,524,553]],
    9:[[72,672,524,712]]
  },

  buildVals:function(state){
    var d=state, v={};
    ["child_surKor","child_givenKor","child_surHan","child_givenHan","child_bon",
     "child_birthPlaceEtc","child_regBase","child_addr","child_headName","child_headRel","child_dualNat",
     "f_name","f_nameHan","f_bon","f_regBase","m_name","m_nameHan","m_bon","m_regBase",
     "closed_name","closed_regBase","etc","reporter_name","reporter_qualEtc","reporter_email","sub_name"
    ].forEach(function(k){ v[k]=d[k]||""; });
    v.reporter_phone=formatPhone(d.reporter_phone);
    ["f_jumin","m_jumin","closed_jumin","reporter_jumin","sub_jumin"].forEach(function(f){
      v[f+"1"]=j1(d[f]); v[f+"2"]=j2(d[f]);
    });
    var b=ymd(d.child_birthDate); v.birthY=b[0]; v.birthMo=b[1]; v.birthD=b[2];
    v.birthH=digits(d.child_birthHour); v.birthMin=digits(d.child_birthMin);
    return v;
  },

  signatureHI:function(v){
    var HI=[];
    if(v.reporter_name) HI.push([248,449,318,464]);
    return HI;
  },

  STEPS:[
    {n:1, short:"시작", title:"출생신고서 작성 시작",
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
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"child_surKor", label:"성(한글)", req:true, half:true, ph:"김"});
        h+=A.inputHtml({k:"child_givenKor", label:"이름(한글)", req:true, half:true, ph:"하늘"});
        h+=A.inputHtml({k:"child_surHan", label:"성(한자)", half:true, ph:"金"});
        h+=A.inputHtml({k:"child_givenHan", label:"이름(한자)", half:true, ph:"하늘(한자)"});
        h+=A.inputHtml({k:"child_bon", label:"본(한자)", ph:"金海 (본관)", help:"성씨의 본관을 한자로. 모르면 비워 두세요."});
        h+='<div class="field"><label class="field-label">성별</label>'+A.choiceHtml("child_sex",SEX_OPTS)+'</div>';
        h+='<div class="field"><label class="field-label">혼인 중/외의 출생자</label>'
          +A.choiceHtml("child_marital",MARITAL_OPTS,"부모가 혼인신고를 한 사이에 태어났으면 ‘혼인 중’입니다.")+'</div>';
        return h;
      }},
    {n:3, short:"출생 정보", title:"① 출생자 — 출생 정보",
      q:"언제·어디서 태어났는지 입력하세요.",
      why:"출생일시는 24시각제로 적습니다(예: 오후 2시 30분 → 14시 30분). 등록기준지·주소는 부모가 정한 곳을 적습니다.",
      kind:"childBirth",
      required:function(s){ var m=[];
        if(!String(s.child_birthDate||"").trim()) m.push("출생 연월일");
        if(!String(s.child_addr||"").trim()) m.push("주소");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"child_birthDate", label:"출생 연월일", type:"date", req:true, ph:"2026.07.20",
          help:"예: 2026.07.20 (숫자 8자리를 적으면 자동으로 정리됩니다)"});
        h+=A.inputHtml({k:"child_birthHour", label:"출생 시각 — 시(時)", half:true, ph:"14",
          help:"24시각제. 오후 2시 → 14"});
        h+=A.inputHtml({k:"child_birthMin", label:"분(分)", half:true, ph:"30"});
        h+='<div class="field"><label class="field-label">출생 장소 <span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("child_birthPlace",PLACE_OPTS)+'</div>';
        if(A.state.child_birthPlace==="기타")
          h+=A.inputHtml({k:"child_birthPlaceEtc", label:"출생 장소(기타) 상세", ph:"예: 이동 중 차량 안"});
        h+=A.inputHtml({k:"child_regBase", label:"부모가 정한 등록기준지", ph:"경기도 군포시 …",
          help:"아이의 가족관계등록부 기준이 되는 주소."});
        h+=A.inputHtml({k:"child_addr", label:"주소", req:true, ph:"경기도 군포시 …",
          help:"아이가 실제로 살(주민등록) 주소."});
        h+=A.inputHtml({k:"child_headName", label:"세대주 성명", half:true, ph:"김철수",
          help:"아이가 속할 세대의 세대주."});
        h+=A.inputHtml({k:"child_headRel", label:"세대주와의 관계", half:true, ph:"자녀(자·녀)"});
        h+=A.inputHtml({k:"child_dualNat", label:"복수국적 시 취득한 외국 국적", ph:"예: 미국",
          help:"아이가 복수국적자인 경우에만 적습니다."});
        return h;
      }},
    {n:4, short:"부(父)", title:"② 아버지(부) 정보",
      q:"아버지(부)의 정보를 입력하세요.",
      why:"혼인 외 출생자를 어머니가 신고하는 경우에는 아버지 정보를 비워 둘 수 있습니다.",
      kind:"fields",
      body:function(A){ var h='', ff=parentFields("f"); for(var i=0;i<ff.length;i++) h+=A.inputHtml(ff[i]); return h; }},
    {n:5, short:"모(母)", title:"② 어머니(모) 정보",
      q:"어머니(모)의 정보를 입력하세요.", kind:"mother",
      required:function(s){ var m=[];
        if(!String(s.m_name||"").trim()) m.push("어머니 성명(한글)");
        if(!String(s.m_jumin||"").trim()) m.push("어머니 주민등록번호");
        if(!String(s.m_regBase||"").trim()) m.push("어머니 등록기준지");
        return m; },
      body:function(A){
        var h='', mf=parentFields("m");
        for(var j=0;j<mf.length;j++) h+=A.inputHtml(mf[j]);
        h+='<div class="field"><label class="field-label">혼인신고 시 성·본 협의서 제출 여부</label>'
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
        h+=A.inputHtml({k:"closed_regBase", label:"등록기준지"})+'</div>';
        h+=A.inputHtml({k:"etc", label:"④ 기타사항", help:"후순위 신고, 태아인지 관련 등 특별히 밝힐 내용."});
        return h;
      }},
    {n:7, short:"신고인", title:"⑤ 신고인",
      q:"신고서를 작성·제출하는 분(신고인)의 정보를 입력하세요.",
      why:"보통 아버지 또는 어머니가 신고인입니다. 신고인 성명·주민등록번호는 대조 확인용입니다.",
      kind:"reporter",
      required:function(s){ var m=[];
        if(!String(s.reporter_name||"").trim()) m.push("신고인 성명");
        if(!String(s.reporter_phone||"").trim()) m.push("전화번호");
        return m; },
      body:function(A){
        var h='', rf=reporterFields();
        for(var r=0;r<rf.length;r++) h+=A.inputHtml(rf[r]);
        h+='<div class="field"><label class="field-label">신고인 자격 <span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("reporter_qual",QUAL_OPTS,"신고인이 아이와 어떤 관계인지 선택하세요.")+'</div>';
        if(A.state.reporter_qual==="기타")
          h+=A.inputHtml({k:"reporter_qualEtc", label:"기타 자격 상세", ph:"예: 후견인"});
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
    {n:9, short:"인구동향", title:"인구동향조사(통계)",
      q:"통계청 인구동향조사 항목입니다.",
      why:"성실응답 의무가 있는 통계 항목이며, 개인정보는 보호됩니다. 부모의 최종 졸업학교를 선택하세요.", kind:"survey",
      body:function(A){
        var h='';
        h+='<div class="field"><label class="field-label">㉮ 최종 졸업학교 — 아버지(부)</label>'+A.choiceHtml("f_edu",EDU)+'</div>';
        h+='<div class="field"><label class="field-label">㉮ 최종 졸업학교 — 어머니(모)</label>'+A.choiceHtml("m_edu",EDU)+'</div>';
        return h;
      }},
    {n:10, short:"완료", title:"작성 내용 확인", q:"입력한 내용을 확인하세요.", kind:"summary",
      body:function(){
        return buildSummary()
          +'<div class="info-box">인쇄한 뒤, 신고인이 서명·날인을 직접 하여 민원실에 제출하세요. '
          +'출생증명서(병원 발급) 등 첨부서류는 담당 직원이 안내합니다.</div>';
      }}
  ],

  applySample:function(state, kind){
    Object.assign(state,{
      step:2,
      child_surKor:"김", child_givenKor:"하늘", child_surHan:"金", child_givenHan:"하늘",
      child_bon:"金海", child_sex:"여", child_marital:"혼인 중",
      child_birthDate:"2026.07.20", child_birthHour:"14", child_birthMin:"30",
      child_birthPlace:"병원", child_regBase:"경기도 군포시 산본로 000",
      child_addr:"경기도 군포시 산본로 000, 101동 1001호",
      child_headName:"김철수", child_headRel:"자녀(녀)",
      f_name:"김철수", f_nameHan:"金哲洙", f_bon:"金海", f_jumin:"8803151000000",
      f_regBase:"경기도 군포시 산본로 000", f_edu:"대학(교)",
      m_name:"이순자", m_nameHan:"李順子", m_bon:"全州", m_jumin:"9007222000000",
      m_regBase:"경기도 군포시 산본로 000", m_edu:"대학(교)",
      sonbon_consent:"아니요",
      reporter_name:"김철수", reporter_jumin:"8803151000000", reporter_qual:"부",
      reporter_addr:"경기도 군포시 산본로 000, 101동 1001호", reporter_phone:"01012345678",
      reporter_email:"chulsoo@example.com"
    });
    if(kind==="unwed"){
      state.child_marital="혼인 외";
      state.child_headName="이순자"; state.child_headRel="자녀(녀)";
      state.f_name=""; state.f_nameHan=""; state.f_bon=""; state.f_jumin=""; state.f_regBase=""; state.f_edu="";
      state.reporter_name="이순자"; state.reporter_jumin="9007222000000"; state.reporter_qual="모";
      state.reporter_email="soonja@example.com";
    }
  }
};
