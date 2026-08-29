/* =====================================================================
   개명신고서(양식 제27호) — FORM 설정
   engine/engine.js와 함께 build-form.js가 자체완결 HTML로 인라인한다.

   ⛔ **인쇄층의 원본은 `서식원본/개명신고서(20260828).pdf` 하나다.**
      같은 폴더의 `개명신고서.pdf` 는 **구본**이고 대조용이다.
      ⚠️ 두 판은 **성명칸의 짜임이 다르다** — 구본은 「(성)/(명)」으로 갈라져 있었고
         신본은 **한글 한 칸 · 한자 한 칸**이다. 구본으로 배경을 다시 만들면
         화면은 멀쩡하고 **인쇄물만** 어긋난다.

   재생성: python tools/prep-bg.py naming "서식원본/개명신고서(20260828).pdf"
          node tools/build-form.js naming
          python tools/verify-print.py        ← 반드시 0px 확인
   ===================================================================== */
var QUAL_OPTS=["본인","법정대리인","기타"];

function afterNameKor(){ return ((state.aft_surKor||"")+(state.aft_givenKor||"")).trim(); }
function beforeNameKor(){ return ((state.bef_surKor||"")+(state.bef_givenKor||"")).trim(); }

function buildSummary(){
  var d=state, h='';
  h+='<div class="sum-sec"><h4>개명자</h4>';
  h+=sumRow("개명 전 이름", beforeNameKor()+(d.bef_surHan||d.bef_givenHan?" ("+((d.bef_surHan||"")+(d.bef_givenHan||""))+")":""));
  h+=sumRow("개명 후 이름", afterNameKor()+(d.aft_surHan||d.aft_givenHan?" ("+((d.aft_surHan||"")+(d.aft_givenHan||""))+")":""));
  h+=sumRow("본(한자)", d.bon);
  h+=sumRow("주민등록번호", d.n_jumin?formatJumin(d.n_jumin):"");
  h+=sumRow("등록기준지", d.n_regBase);
  h+=sumRow("주소", d.n_addr);
  h+='</div>';
  h+='<div class="sum-sec"><h4>개명허가</h4>';
  h+=sumRow("허가일자", d.permDate);
  h+=sumRow("법원명", d.court);
  h+='</div>';
  h+='<div class="sum-sec"><h4>신고인</h4>';
  h+=sumRow("성명", (d.r_name||"")+(d.r_qual?" · "+d.r_qual+(d.r_qual==="기타"&&d.r_qualEtc?"("+d.r_qualEtc+")":""):""));
  h+=sumRow("전화", formatPhone(d.r_phone));
  h+='</div>';
  return h;
}

var FORM={
  /* ⛔ 이 한 줄이 껍데기를 정한다 — Product UI v1(`engine/base-product.html`). */
  shell:"product",
  docTitle:"개명신고서 작성 미리보기 도우미",
  formName:"개명신고서",
  org:{ orgName:"경기도 군포시", officeName:"군포시청 민원실" },
  sampleLabels:["작성예시(본인 신고)","작성예시(법정대리인 신고)"],
  sampleKinds:["self","legal"],
  /* 신고일 — 제목 아래 「( 년 월 일)」 */
  today:{ y:79.2, yx:84.6, mx:137.2, dx:185.8 },

  /* 안내 기둥의 준비물 — **담당자 원문 그대로다**(2026.08.29 확정). 둘뿐이다.
     ⛔ 그럴듯한 서류를 보태지 마라. 담당자가 준 목록에 없는 것은 창구가 안내한다. */
  ready:[
    { t:"신고인 신분증", s:"접수할 때 창구에서 확인합니다", g:"idcard", req:true },
    { t:"법원 결정문 원본", s:"개명허가를 받은 결정문", g:"cert", req:true }
  ],

  /* 안내 기둥 맨 아래 「이용 안내」 — 2줄(Product UI v1). ⛔ 늘리지 마라. */
  noticeItems:[
    "필요 서류는 직원 확인을 따릅니다.",
    "여기서 접수되지는 않습니다."
  ],

  rerenderOnSet:["r_qual"],

  stateKeys:[].concat(
    ["bef_surKor","bef_givenKor","bef_surHan","bef_givenHan",
     "aft_surKor","aft_givenKor","aft_surHan","aft_givenHan",
     "bon","n_jumin","n_regBase","n_addr"],
    ["permDate","court"],
    ["etc"],
    ["r_name","r_jumin","r_qual","r_qualEtc","r_addr","r_phone","r_email",
     "sub_name","sub_jumin"]),

  /* ──────────────────────────────────────────────────────────────
     좌표 — 2026.08.29 신서식(`개명신고서(20260828).pdf`) 실측.
     이 서식은 텍스트층이 살아 있어 `get_text("words")`·`rawdict` 로 라벨을 바로 쟀다.
     ⚠️ **성명칸이 구본과 다르다** — 「(성)/(명)」 두 칸이 아니라 **한 칸**이므로
        성과 이름을 붙여 한 번에 찍는다(`buildVals` 의 `befKor`·`aftKor` 등).
     ────────────────────────────────────────────────────────────── */
  CO:{
    texts:{
      /* ① 개명 전 이름 · ② 개명 후 이름 — 각각 한글 한 칸 · 한자 한 칸 */
      "befKor":{x:183.8,y:134.8,a:"c",size:8},
      "befHan":{x:297.2,y:134.8,a:"c",size:8},
      "aftKor":{x:409.9,y:134.8,a:"c",size:8},
      "aftHan":{x:529.6,y:134.8,a:"c",size:8},
      /* 본(한자) · 주민등록번호 */
      "bon":{x:185.5,y:182.3,a:"c",size:7.5},
      "n_jumin1":{x:417.4,y:182.3,a:"c",size:7.5},
      "n_jumin2":{x:527.4,y:182.3,a:"c",size:7.5},
      /* 등록기준지 · 주소 */
      "n_regBase":{x:114.3,y:221.7,a:"l",size:7,w:462.0,wrap:true},
      "n_addr":{x:114.3,y:257.4,a:"l",size:7,w:462.0,wrap:true},
      /* ③ 허가일자 · 법원명 */
      "permY":{x:163.4,y:290.0,a:"c",size:7.5},
      "permMo":{x:232.5,y:290.0,a:"c",size:7.5},
      "permD":{x:292.0,y:290.0,a:"c",size:7.5},
      "court":{x:367.4,y:290.0,a:"l",size:7.5,w:208.0},
      /* ④ 기타사항 */
      "etc":{x:114.3,y:316.6,a:"l",size:7.5,w:462.0,wrap:true},
      /* ⑤ 신고인 — 성명 칸의 오른쪽에 「㊞ 또는 서명」이 인쇄돼 있다 */
      "r_name":{x:186.2,y:344.6,a:"c",size:8},
      "r_jumin1":{x:445.1,y:344.6,a:"c",size:7.5},
      "r_jumin2":{x:536.6,y:344.6,a:"c",size:7.5},
      "r_qualEtc":{x:313.0,y:370.4,a:"l",size:7,w:126.0},
      "r_addr":{x:114.3,y:402.3,a:"l",size:7,w:234.0,wrap:true},
      "r_phone":{x:397.8,y:393.2,a:"l",size:7,w:178.0},
      "r_email":{x:397.8,y:417.4,a:"l",size:6.5,w:178.0},
      /* ⑥ 제출인 */
      "sub_name":{x:207.3,y:438.6,a:"c",size:8},
      "sub_jumin1":{x:429.7,y:438.6,a:"c",size:7.5},
      "sub_jumin2":{x:531.5,y:438.6,a:"c",size:7.5}
    },
    /* 영표(○)는 서식에 인쇄된 **번호 네모** 위에 찍는다 */
    checks:{
      "r_qual":{"본인":[124.5,370.4], "법정대리인":[172.2,370.4], "기타":[250.5,370.4]}
    },
    attend:{}
  },

  STEP_HL:{
    2:[[112.3,88.6,341.2,161.5]],
    3:[[341.2,88.6,579.0,161.5]],
    4:[[49.7,161.5,579.0,274.6]],
    5:[[27.0,274.6,579.0,305.4]],
    6:[[27.0,305.4,579.0,327.8]],
    7:[[27.0,327.8,579.0,426.5]],
    8:[[27.0,426.5,579.0,450.6]]
  },

  buildVals:function(state){
    var d=state, v={};
    ["bon","n_regBase","n_addr","court","etc","r_name","r_addr","r_email","sub_name"
    ].forEach(function(k){ v[k]=d[k]||""; });
    /* ⚠️ 신서식은 성명칸이 **한 칸**이다 — 성과 이름을 붙여 찍는다. */
    v.befKor=((d.bef_surKor||"")+(d.bef_givenKor||"")).trim();
    v.befHan=((d.bef_surHan||"")+(d.bef_givenHan||"")).trim();
    v.aftKor=((d.aft_surKor||"")+(d.aft_givenKor||"")).trim();
    v.aftHan=((d.aft_surHan||"")+(d.aft_givenHan||"")).trim();
    /* 「기타」를 고르지 않았으면 상세를 찍지 않는다 — 되돌린 뒤 남은 값이 인쇄되면 안 된다 */
    v.r_qualEtc = (d.r_qual==="기타") ? (d.r_qualEtc||"") : "";
    v.r_phone=formatPhone(d.r_phone);
    ["n_jumin","r_jumin","sub_jumin"].forEach(function(f){ v[f+"1"]=j1(d[f]); v[f+"2"]=j2(d[f]); });
    var b=ymd(d.permDate); v.permY=b[0]; v.permMo=b[1]; v.permD=b[2];
    return v;
  },

  /* 인쇄 후 직접 서명·날인해야 하는 칸 — 내용이 있을 때만 형광펜을 친다 */
  signatureHI:function(v){
    var HI=[];
    if(v.r_name) HI.push([259.0,327.8,318.5,361.5]);
    return HI;
  },

  STEPS:[
    /* ⛔ 시작 화면은 보여 주지 않는다 — 허브에서 이미 개명신고를 고르고 들어왔다.
       ⚠️ 단계를 지우지 않고 `when` 으로 숨긴다(`STEP_HL`·`applySample` 이 절대 번호를 쓴다). */
    {n:1, short:"시작", title:"개명신고서 작성 시작",
      when:function(){ return false; },
      q:"함께 한 단계씩 채워 볼까요?", kind:"intro",
      body:function(){ return '<div class="opts"><button type="button" class="opt sel" data-next="1">시작하기</button></div>'; }},

    {n:2, short:"개명 전 이름", title:"① 개명 전 이름",
      q:"바꾸기 전(지금까지 쓰던) 이름을 입력하세요.",
      why:"개명신고는 법원의 개명허가를 받은 뒤에 합니다. 결정문을 받은 날부터 1개월 이내에 신고해야 합니다.",
      required:function(s){ var m=[];
        if(!String(s.bef_surKor||"").trim()) m.push("개명 전 성(한글)");
        if(!String(s.bef_givenKor||"").trim()) m.push("개명 전 이름(한글)");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"bef_surKor", label:"성(한글)", req:true, half:true, ph:"김"});
        h+=A.inputHtml({k:"bef_givenKor", label:"이름(한글)", req:true, half:true, ph:"철수"});
        h+=A.inputHtml({k:"bef_surHan", label:"성(한자)", half:true, ph:"金", optHint:true});
        h+=A.inputHtml({k:"bef_givenHan", label:"이름(한자)", half:true, ph:"哲洙", optHint:true});
        return h;
      }},

    {n:3, short:"개명 후 이름", title:"② 개명 후 이름",
      q:"새로 바꾼(개명허가를 받은) 이름을 입력하세요.",
      why:"법원 결정문에 적힌 새 이름을 그대로 적습니다. 보통 성은 그대로 두고 이름만 바뀝니다. 한자가 없으면 한글만 적으세요.",
      required:function(s){ var m=[];
        if(!String(s.aft_surKor||"").trim()) m.push("개명 후 성(한글)");
        if(!String(s.aft_givenKor||"").trim()) m.push("개명 후 이름(한글)");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"aft_surKor", label:"성(한글)", req:true, half:true, ph:"김"});
        h+=A.inputHtml({k:"aft_givenKor", label:"이름(한글)", req:true, half:true, ph:"도윤"});
        h+=A.inputHtml({k:"aft_surHan", label:"성(한자)", half:true, ph:"金", optHint:true});
        h+=A.inputHtml({k:"aft_givenHan", label:"이름(한자)", half:true, ph:"道潤", optHint:true});
        return h;
      }},

    {n:4, short:"개명자 정보", title:"① 개명자 — 본·주민등록번호·주소",
      q:"개명자 본인의 나머지 정보를 입력하세요.",
      required:function(s){ var m=[];
        if(!String(s.n_jumin||"").trim()) m.push("주민등록번호");
        if(!String(s.n_addr||"").trim()) m.push("주소");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"bon", label:"본(한자)", ph:"金海",
          help:"성씨의 본관을 한자로.", optHint:true});
        h+=A.inputHtml({k:"n_jumin", label:"주민등록번호", type:"jumin", req:true, ph:"900101-0000000"});
        h+=A.inputHtml({k:"n_regBase", label:"등록기준지", ph:"경기도 군포시 …",
          help:"가족관계등록부의 기준이 되는 주소입니다.", optHint:true});
        h+=A.inputHtml({k:"n_addr", label:"주소", req:true, ph:"경기도 군포시 …",
          help:"개명자의 주민등록 주소(도로명주소)."});
        return h;
      }},

    {n:5, short:"허가일자", title:"③ 개명허가일자 · 법원명",
      q:"법원에서 개명허가를 받은 날짜와 법원 이름을 입력하세요.",
      why:"법원 결정문에 적힌 허가 연월일과 결정한 법원 이름을 그대로 옮겨 적습니다.",
      required:function(s){ var m=[];
        if(!String(s.permDate||"").trim()) m.push("개명허가일자");
        if(!String(s.court||"").trim()) m.push("법원명");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"permDate", label:"개명허가일자", type:"date", req:true, ph:"2026.06.15",
          help:"예: 2026.06.15 (숫자 8자리를 적으면 자동으로 정리됩니다)"});
        h+=A.inputHtml({k:"court", label:"법원명", req:true, ph:"수원가정법원",
          help:"개명허가를 결정한 법원 이름."});
        return h;
      }},

    {n:6, short:"기타", title:"④ 기타사항",
      q:"특별히 밝힐 내용이 있으면 적습니다.",
      body:function(A){
        var h='';
        h+='<div class="note-box">대부분 <b>비워 둡니다.</b> 해당하는 경우에만 적으세요.</div>';
        h+=A.inputHtml({k:"etc", label:"④ 기타사항", help:"가족관계등록부 기록에 특별히 필요한 사항."});
        return h;
      }},

    {n:7, short:"신고인", title:"⑤ 신고인",
      q:"신고서를 작성·제출하는 분(신고인)의 정보를 입력하세요.",
      why:"개명자 본인이 신고하면 자격은 ‘본인’이고, 성명은 개명 후의 이름을 적습니다. 미성년자 등은 부모 같은 법정대리인이 신고합니다.",
      required:function(s){ var m=[];
        if(!String(s.r_name||"").trim()) m.push("신고인 성명");
        if(!String(s.r_jumin||"").trim()) m.push("신고인 주민등록번호");
        if(!s.r_qual) m.push("신고인 자격");
        /* 화면에 나타났으면 필수 — 「기타」를 골랐을 때만 묻는다 */
        if(s.r_qual==="기타" && !String(s.r_qualEtc||"").trim()) m.push("자격(기타) 상세");
        if(!String(s.r_addr||"").trim()) m.push("신고인 주소");
        if(!String(s.r_phone||"").trim()) m.push("휴대전화번호");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"r_name", label:"신고인 성명", req:true, ph:"김도윤",
          help:"본인이 신고하면 개명 후의 이름을 적습니다."});
        h+=A.inputHtml({k:"r_jumin", label:"주민등록번호", type:"jumin", req:true, ph:"900101-0000000"});
        h+='<div class="field"><label class="field-label">신고인 자격 <span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("r_qual",QUAL_OPTS,"개명자 본인이면 ‘본인’, 부모 등이면 ‘법정대리인’.")+'</div>';
        if(A.state.r_qual==="기타")
          h+=A.inputHtml({k:"r_qualEtc", label:"자격(기타) — 어떤 자격인지", req:true, ph:"예: 성년후견인"});
        h+=A.inputHtml({k:"r_addr", label:"주소", req:true, ph:"경기도 군포시 …",
          help:"도로명주소로 적습니다."});
        h+=A.inputHtml({k:"r_phone", label:"휴대전화번호 등", type:"phone", req:true, ph:"010-0000-0000"});
        /* ⚠️ 이메일만 예외 문구다 — 없는 사람은 창구도 대신 만들어 줄 수 없다. */
        h+=A.inputHtml({k:"r_email", label:"이메일", ph:"name@example.com",
          help:"없으면 비워 두셔도 됩니다."});
        return h;
      }},

    {n:8, short:"제출인", title:"⑥ 제출인",
      q:"신고인이 아닌 다른 사람이 제출할 때만 적습니다.",
      body:function(A){
        var h='';
        h+='<div class="note-box">신고인 본인이 직접 제출하면 이 단계는 <b>비워 두세요.</b> '
          +'신고인이 아닌 다른 사람이 대신 제출할 때만 적습니다.</div>';
        h+=A.inputHtml({k:"sub_name", label:"제출인 성명", half:true});
        h+=A.inputHtml({k:"sub_jumin", label:"제출인 주민등록번호", type:"jumin", half:true});
        return h;
      }},

    {n:9, short:"완료", title:"작성 내용 확인", q:"입력한 내용을 확인하세요.", kind:"summary",
      body:function(){
        return buildSummary()
          +'<div class="info-box">인쇄한 뒤, 신고인이 서명 또는 날인을 직접 하여 민원실에 제출하세요. '
          +'<b>법원 결정문 원본</b>을 함께 내셔야 하며, 그 밖의 첨부서류는 담당 직원이 안내합니다.</div>';
      }}
  ],

  applySample:function(state, kind){
    Object.assign(state,{
      step:2,
      bef_surKor:"김", bef_givenKor:"철수", bef_surHan:"金", bef_givenHan:"哲洙",
      aft_surKor:"김", aft_givenKor:"도윤", aft_surHan:"金", aft_givenHan:"道潤",
      bon:"金海", n_jumin:"9001011000000",
      n_regBase:"경기도 군포시 산본로 000",
      n_addr:"경기도 군포시 산본로 000, 101동 1001호",
      permDate:"2026.06.15", court:"수원가정법원",
      etc:"",
      r_name:"김도윤", r_jumin:"9001011000000", r_qual:"본인", r_qualEtc:"",
      r_addr:"경기도 군포시 산본로 000, 101동 1001호", r_phone:"01012345678",
      r_email:"kim@example.com",
      sub_name:"", sub_jumin:""
    });
    if(kind==="legal"){
      /* 미성년 자녀 개명 — 부(법정대리인)가 신고 */
      Object.assign(state,{
        bef_surKor:"이", bef_givenKor:"민준", bef_surHan:"李", bef_givenHan:"敏俊",
        aft_surKor:"이", aft_givenKor:"서준", aft_surHan:"李", aft_givenHan:"舒俊",
        bon:"全州", n_jumin:"1503111000000",
        n_regBase:"서울특별시 강남구 테헤란로 000",
        permDate:"2026.07.01", court:"수원가정법원",
        r_name:"이철수", r_jumin:"8203151000000", r_qual:"법정대리인", r_qualEtc:"",
        r_email:"lee@example.com"
      });
    }
  }
};
