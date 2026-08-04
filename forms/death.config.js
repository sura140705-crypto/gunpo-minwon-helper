/* =====================================================================
   사망신고서(양식 제19호) — FORM 설정
   engine/engine.js와 함께 build-form.js가 자체완결 HTML로 인라인한다.
   재생성: python tools/prep-bg.py death 서식원본/사망신고서.pdf
          node tools/build-form.js death
   ===================================================================== */
var EDU=["학력 없음","초등학교","중학교","고등학교","대학(교)","대학원 이상"];
var SEX_OPTS=["남","여"];
var MARITAL_OPTS=["미혼","배우자 있음","이혼","사별"];
var PLACE_OPTS=["주택","의료기관","사회복지시설","공공시설","도로","상업·서비스시설","산업장","농장","병원 이송 중 사망","기타"];
var QUAL_OPTS=["동거친족","비동거친족","동거자","기타"];

function reporterFields(){
  return [
    {k:"r_name", label:"신고인 성명", req:true, ph:"김철수"},
    {k:"r_jumin", label:"주민등록번호", type:"jumin", ph:"800101-0000000"},
    {k:"r_addr", label:"주소", ph:"경기도 군포시 …"},
    {k:"r_phone", label:"휴대전화번호 등", type:"phone", req:true, ph:"010-0000-0000"},
    {k:"r_email", label:"이메일", ph:"name@example.com"}
  ];
}
function deceasedName(){ return ((state.d_surKor||"")+(state.d_givenKor||"")).trim(); }
function buildSummary(){
  var d=state, h='';
  h+='<div class="sum-sec"><h4>사망자</h4>';
  h+=sumRow("성명", deceasedName()+(d.d_sex?" · "+d.d_sex:""));
  h+=sumRow("주민등록번호", d.d_jumin?formatJumin(d.d_jumin):"");
  h+=sumRow("사망일시", [d.d_deathDate, (d.d_deathHour?d.d_deathHour+"시":"")+(d.d_deathMin?" "+d.d_deathMin+"분":"")].filter(function(x){return x&&x.trim();}).join(" "));
  h+=sumRow("사망장소", (d.d_place||"")+(d.d_place==="기타"&&d.d_placeEtc?" · "+d.d_placeEtc:"")+(d.d_placeDetail?" ("+d.d_placeDetail+")":""));
  h+=sumRow("주소", d.d_addr);
  h+='</div>';
  h+='<div class="sum-sec"><h4>신고인</h4>';
  h+=sumRow("성명", (d.r_name||"")+(d.r_qual?" · "+d.r_qual:"")+(d.r_rel?" ("+d.r_rel+")":""));
  h+=sumRow("전화", formatPhone(d.r_phone));
  h+='</div>';
  return h;
}

var FORM={
  docTitle:"사망신고서 작성 미리보기 도우미",
  formName:"사망신고서",
  org:{ orgName:"경기도 군포시", officeName:"군포시청 민원실" },
  sampleLabels:["작성예시(의료기관 사망)","작성예시(자택 사망)"],
  sampleKinds:["hospital","home"],
  rerenderOnSet:["d_place"],
  today:{ y:132, yx:113, mx:152, dx:190 },

  stateKeys:[].concat(
    ["d_surKor","d_givenKor","d_surHan","d_givenHan","d_sex","d_jumin",
     "d_regBase","d_addr","d_headName","d_headRel",
     "d_deathDate","d_deathHour","d_deathMin","d_placeDetail","d_place","d_placeEtc",
     "d_edu","d_marital"],
    ["etc"],
    ["r_name","r_jumin","r_qual","r_rel","r_addr","r_phone","r_email","sub_name","sub_jumin"]),

  CO:{
    texts:{
      "d_surKor":{x:189,y:151,a:"c",size:8}, "d_givenKor":{x:248,y:151,a:"c",size:8},
      "d_surHan":{x:189,y:175,a:"c",size:8}, "d_givenHan":{x:248,y:175,a:"c",size:8},
      "d_jumin1":{x:455,y:162,a:"c",size:7}, "d_jumin2":{x:521,y:162,a:"c",size:7},
      "d_regBase":{x:136,y:197,a:"l",size:7,w:410,wrap:true,nb:true},
      "d_addr":{x:136,y:227,a:"l",size:7,w:205,wrap:true,nb:true},
      "d_headName":{x:481,y:227,a:"r",size:7}, "d_headRel":{x:497,y:227,a:"l",size:7},
      "deathY":{x:148,y:257,a:"c",size:7.5,nb:true}, "deathMo":{x:184,y:257,a:"c",size:7.5,nb:true},
      "deathD":{x:211,y:257,a:"c",size:7.5,nb:true}, "deathH":{x:239,y:257,a:"c",size:7.5,nb:true},
      "deathMin":{x:266,y:257,a:"c",size:7.5,nb:true},
      "d_placeDetail":{x:173,y:285,a:"l",size:7,w:370,wrap:true,nb:true},
      "d_placeEtc":{x:213,y:404,a:"l",size:7,w:260,nb:true},
      "etc":{x:150,y:425,a:"l",size:7.5,w:395,wrap:true},
      "r_name":{x:175,y:450,a:"c",size:8}, "r_jumin1":{x:455,y:450,a:"c",size:7}, "r_jumin2":{x:521,y:450,a:"c",size:7},
      "r_rel":{x:488,y:475,a:"c",size:7},
      "r_addr":{x:136,y:530,a:"l",size:7,w:205,wrap:true,nb:true},
      "r_phone":{x:430,y:521,a:"l",size:7,w:120,nb:true},
      "r_email":{x:430,y:538,a:"l",size:6,w:120},
      "sub_name":{x:230,y:559,a:"c",size:8}, "sub_jumin1":{x:455,y:559,a:"c",size:7}, "sub_jumin2":{x:521,y:559,a:"c",size:7}
    },
    checks:{
      /* ○ 좌표 = 서식 □ 글리프(U+F000)의 중심. .ov 가 translate(-50%,-50%) 라 중심을 그대로 쓴다.
         2026-07-30 재실측(get_text("rawdict") 문자 bbox 중심)으로 전부 교체 —
         성별·신고인 자격은 8~9pt 왼쪽, 최종졸업학교는 13~15pt 왼쪽, 사회복지시설은 8pt 위로 밀려 있었다. */
      "d_sex":{"남":[294.4,174.9],"여":[322.1,174.9]},
      "d_place":{
        "주택":[174.3,310.1], "의료기관":[348.8,310.1],
        "사회복지시설":[174.3,330.4], "공공시설":[348.8,330.4],
        "도로":[174.3,350.8], "상업·서비스시설":[348.8,350.8],
        "산업장":[174.3,368.5], "농장":[348.8,368.5],
        "병원 이송 중 사망":[174.3,386.4], "기타":[174.3,404.1]
      },
      "r_qual":{"동거친족":[142.3,475.8],"비동거친족":[195.3,475.8],"동거자":[257.1,475.8],"기타":[142.9,500.8]},
      "d_edu":{"학력 없음":[142.1,697.8],"초등학교":[209.7,697.8],"중학교":[272.4,697.8],"고등학교":[325.1,697.8],"대학(교)":[387.8,697.8],"대학원 이상":[448,697.8]},
      "d_marital":{"미혼":[141.9,725.2],"배우자 있음":[210.5,725.2],"이혼":[313.5,725.2],"사별":[382.2,725.2]}
    },
    attend:{}
  },

  STEP_HL:{
    2:[[73,139,551,245]],
    3:[[73,245,551,413]],
    4:[[43,413,551,438]],
    5:[[43,438,551,547]],
    6:[[43,547,551,572]],
    7:[[43,680,551,732]]
  },

  buildVals:function(state){
    var d=state, v={};
    ["d_surKor","d_givenKor","d_surHan","d_givenHan",
     "d_regBase","d_addr","d_headName","d_headRel","d_placeDetail","d_placeEtc","etc",
     "r_name","r_rel","r_email","sub_name"
    ].forEach(function(k){ v[k]=d[k]||""; });
    v.r_phone=formatPhone(d.r_phone);
    ["d_jumin","r_jumin","sub_jumin"].forEach(function(f){ v[f+"1"]=j1(d[f]); v[f+"2"]=j2(d[f]); });
    var b=ymd(d.d_deathDate); v.deathY=b[0]; v.deathMo=b[1]; v.deathD=b[2];
    v.deathH=digits(d.d_deathHour); v.deathMin=digits(d.d_deathMin);
    return v;
  },

  signatureHI:function(v){
    var HI=[];
    if(v.r_name) HI.push([281,439,341,462]);
    return HI;
  },

  STEPS:[
    {n:1, short:"시작", title:"사망신고서 작성 시작",
      q:"함께 한 단계씩 채워 볼까요?",
      why:"사망신고는 사망 사실을 안 날부터 1개월 이내에 해야 합니다. 의사가 작성한 사망진단서(또는 시체검안서)를 함께 준비하세요. 서명·날인은 인쇄한 뒤 직접 하시면 됩니다.",
      kind:"intro",
      body:function(){
        return '<div class="note-box">이 도구는 <b>미리보기</b>이며, 실제 접수는 담당 직원의 확인을 따릅니다. '
          +'입력 내용은 저장되지 않습니다.</div>'
          +'<div class="opts"><button type="button" class="opt sel" data-next="1">시작하기 →</button></div>';
      }},
    {n:2, short:"사망자", title:"① 사망자 — 인적사항",
      q:"돌아가신 분(사망자)의 정보를 입력하세요.",
      why:"성명·주민등록번호·주소는 가족관계등록부 대조에 쓰입니다. 외국인은 외국인등록번호·국적을 적습니다.",
      kind:"fields",
      required:function(s){ var m=[];
        if(!String(s.d_surKor||"").trim()) m.push("성(한글)");
        if(!String(s.d_givenKor||"").trim()) m.push("이름(한글)");
        if(!String(s.d_jumin||"").trim()) m.push("주민등록번호");
        if(!String(s.d_addr||"").trim()) m.push("주소");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"d_surKor", label:"성(한글)", req:true, half:true, ph:"김"});
        h+=A.inputHtml({k:"d_givenKor", label:"이름(한글)", req:true, half:true, ph:"판석"});
        h+=A.inputHtml({k:"d_surHan", label:"성(한자)", half:true, ph:"金"});
        h+=A.inputHtml({k:"d_givenHan", label:"이름(한자)", half:true, ph:"判石"});
        h+='<div class="field"><label class="field-label">성별</label>'+A.choiceHtml("d_sex",SEX_OPTS)+'</div>';
        h+=A.inputHtml({k:"d_jumin", label:"주민등록번호", type:"jumin", req:true, ph:"400101-0000000",
          help:"외국인은 외국인등록번호를 적습니다."});
        h+=A.inputHtml({k:"d_regBase", label:"등록기준지", ph:"경기도 군포시 …",
          help:"가족관계등록부의 기준이 되는 주소. 외국인은 국적."});
        h+=A.inputHtml({k:"d_addr", label:"주소", req:true, ph:"경기도 군포시 …",
          help:"사망자의 주민등록 주소."});
        h+=A.inputHtml({k:"d_headName", label:"세대주 성명", half:true, ph:"김판석",
          help:"사망자가 속한 세대의 세대주."});
        h+=A.inputHtml({k:"d_headRel", label:"세대주와의 관계", half:true, ph:"본인"});
        return h;
      }},
    {n:3, short:"사망 일시·장소", title:"① 사망 일시·장소",
      q:"언제·어디서 돌아가셨는지 입력하세요.",
      why:"사망일시는 24시각제로 적습니다(예: 오후 2시 30분 → 14시 30분). 사망장소 구분은 해당하는 한 곳을 고르세요.",
      kind:"deathPlace",
      required:function(s){ var m=[];
        if(!String(s.d_deathDate||"").trim()) m.push("사망 연월일");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"d_deathDate", label:"사망 연월일", type:"date", req:true, ph:"2026.07.10",
          help:"예: 2026.07.10 (숫자 8자리를 적으면 자동으로 정리됩니다)"});
        h+=A.inputHtml({k:"d_deathHour", label:"사망 시각 — 시(時)", half:true, ph:"9",
          help:"24시각제. 오후 2시 → 14"});
        h+=A.inputHtml({k:"d_deathMin", label:"분(分)", half:true, ph:"20"});
        h+=A.inputHtml({k:"d_placeDetail", label:"사망 장소(상세)", ph:"예: ○○대학교병원 / 자택 주소",
          help:"돌아가신 곳의 이름이나 주소."});
        h+='<div class="field"><label class="field-label">사망 장소 구분 <span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("d_place",PLACE_OPTS,"해당하는 한 곳을 고르세요.")+'</div>';
        if(A.state.d_place==="기타")
          h+=A.inputHtml({k:"d_placeEtc", label:"사망 장소(기타) 상세", ph:"예: 이동 중 차량 안"});
        return h;
      }},
    {n:4, short:"기타", title:"② 기타사항",
      q:"특별히 밝힐 내용이 있으면 적습니다. 없으면 넘어가세요.",
      kind:"etc",
      body:function(A){
        var h='';
        h+='<div class="note-box">대부분 <b>비워 둡니다.</b> 해당하는 경우에만 적으세요.</div>';
        h+=A.inputHtml({k:"etc", label:"② 기타사항", help:"가족관계등록부 기록에 특별히 필요한 사항."});
        return h;
      }},
    {n:5, short:"신고인", title:"③ 신고인",
      q:"신고서를 작성·제출하는 분(신고인)의 정보를 입력하세요.",
      why:"신고인은 보통 동거친족(함께 살던 가족) 등입니다. 사망자와의 관계를 함께 적습니다.",
      kind:"reporter",
      required:function(s){ var m=[];
        if(!String(s.r_name||"").trim()) m.push("신고인 성명");
        if(!String(s.r_rel||"").trim()) m.push("사망자와의 관계");
        if(!String(s.r_phone||"").trim()) m.push("휴대전화번호");
        return m; },
      body:function(A){
        var h='', rf=reporterFields();
        h+=A.inputHtml(rf[0]); h+=A.inputHtml(rf[1]);
        h+='<div class="field"><label class="field-label">신고인 자격 <span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("r_qual",QUAL_OPTS,"사망자와 함께 살았으면 ‘동거친족’, 따로 살았으면 ‘비동거친족’.")+'</div>';
        h+=A.inputHtml({k:"r_rel", label:"사망자와의 관계", req:true, ph:"예: 자(子), 배우자",
          help:"신고인이 사망자와 어떤 사이인지."});
        h+=A.inputHtml(rf[2]); h+=A.inputHtml(rf[3]); h+=A.inputHtml(rf[4]);
        return h;
      }},
    {n:6, short:"제출인", title:"④ 제출인",
      q:"신고인이 아닌 다른 사람이 제출할 때만 적습니다.", kind:"submit",
      body:function(A){
        var h='';
        h+='<div class="note-box">신고인 본인이 직접 제출하면 이 단계는 <b>비워 두세요.</b> '
          +'신고인이 아닌 다른 사람이 대신 제출할 때만 적습니다.</div>';
        h+=A.inputHtml({k:"sub_name", label:"제출인 성명", half:true});
        h+=A.inputHtml({k:"sub_jumin", label:"제출인 주민등록번호", type:"jumin", half:true});
        return h;
      }},
    {n:7, short:"인구동향", title:"인구동향조사(통계)",
      q:"통계청 인구동향조사 항목입니다.",
      why:"성실응답 의무가 있는 통계 항목이며, 개인정보는 보호됩니다. 사망자의 최종 졸업학교와 혼인상태를 고르세요.", kind:"survey",
      body:function(A){
        var h='';
        h+='<div class="field"><label class="field-label">㉮ 최종 졸업학교 (사망자)</label>'+A.choiceHtml("d_edu",EDU)+'</div>';
        h+='<div class="field"><label class="field-label">㉯ 혼인 상태 (사망자)</label>'+A.choiceHtml("d_marital",MARITAL_OPTS)+'</div>';
        return h;
      }},
    {n:8, short:"완료", title:"작성 내용 확인", q:"입력한 내용을 확인하세요.", kind:"summary",
      body:function(){
        return buildSummary()
          +'<div class="info-box">인쇄한 뒤, 신고인이 서명·날인을 직접 하여 민원실에 제출하세요. '
          +'사망진단서(또는 시체검안서) 등 첨부서류는 담당 직원이 안내합니다.</div>';
      }}
  ],

  applySample:function(state, kind){
    Object.assign(state,{
      step:2,
      d_surKor:"김", d_givenKor:"판석", d_surHan:"金", d_givenHan:"判石", d_sex:"남",
      d_jumin:"4001011000000", d_regBase:"경기도 군포시 산본로 000",
      d_addr:"경기도 군포시 산본로 000, 101동 1001호",
      d_headName:"김판석", d_headRel:"본인",
      d_deathDate:"2026.07.10", d_deathHour:"9", d_deathMin:"20",
      d_placeDetail:"○○대학교병원", d_place:"의료기관",
      d_edu:"고등학교", d_marital:"사별",
      etc:"",
      r_name:"김철수", r_jumin:"7203151000000", r_qual:"동거친족", r_rel:"자(子)",
      r_addr:"경기도 군포시 산본로 000, 101동 1001호", r_phone:"01012345678",
      r_email:"chulsoo@example.com"
    });
    if(kind==="home"){
      state.d_place="주택"; state.d_placeDetail="경기도 군포시 산본로 000, 101동 1001호";
      state.d_marital="배우자 있음";
      state.r_name="이영자"; state.r_jumin="4503152000000"; state.r_qual="동거친족"; state.r_rel="배우자";
      state.r_email="youngja@example.com";
    }
  }
};
