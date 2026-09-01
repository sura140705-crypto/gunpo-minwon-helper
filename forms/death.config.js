/* =====================================================================
   사망신고서(양식 제19호) — FORM 설정
   engine/engine.js와 함께 build-form.js가 자체완결 HTML로 인라인한다.

   ⛔ **인쇄층의 원본은 `서식원본/사망신고서(20260828).pdf` 하나다.**
      같은 폴더의 `사망신고서.pdf` 는 **구본(2쪽·통계청 표기 시절)** 이고 대조용이다.
      ⚠️ 그것으로 배경을 다시 만들면 **판면이 달라 좌표가 전부 어긋난다** —
         화면은 멀쩡하고 **인쇄물만** 어긋나므로 눈치채기 어렵다.

   재생성: python tools/prep-bg.py death "서식원본/사망신고서(20260828).pdf"
          node tools/build-form.js death
          python tools/verify-print.py        ← 반드시 0px 확인
   ===================================================================== */
var EDU=["학력 없음","초등학교","중학교","고등학교","대학(교)","대학원 이상"];
var SEX_OPTS=["남","여"];
var MARITAL_OPTS=["미혼","배우자 있음","이혼","사별"];
var PLACE_OPTS=["주택","의료기관","사회복지시설","공공시설","도로","상업·서비스시설","산업장","농장","병원 이송 중 사망","기타"];
var QUAL_OPTS=["동거친족","비동거친족","동거자","기타"];

function deceasedName(){ return ((state.d_surKor||"")+(state.d_givenKor||"")).trim(); }
function deathTime(){
  var d=state, hm=(d.d_deathHour?d.d_deathHour+"시":"")+(d.d_deathMin?" "+d.d_deathMin+"분":"");
  return [d.d_deathDate, hm].filter(function(x){ return x && x.trim(); }).join(" ");
}
/* ⛔ Review 는 **핵심 선택**만이다(2026.08.29 §2). 성명·주민등록번호·주소·전화·이메일·
   자유입력은 가운데 PAPER 가 실시간으로 보여 주므로 여기서 되풀이하지 않는다. */
function buildSummary(){
  var d=state, h='';
  h+=sumRowIf("성별", d.d_sex);
  h+=sumRowIf("사망 장소 구분", (d.d_place||"")
    +(d.d_place==="기타" && d.d_placeEtc ? " · "+d.d_placeEtc : ""), 3);
  h+=sumRowIf("③ 신고인 자격", d.r_qual);
  h+=sumRowIf("㉯ 혼인 상태", d.d_marital);
  return h;
}

var FORM={
  /* ⛔ 이 한 줄이 껍데기를 정한다 — Product UI v1(`engine/base-product.html`). */
  shell:"product",
  docTitle:"사망신고서 작성 미리보기 도우미",
  formName:"사망신고서",
  org:{ orgName:"경기도 군포시", officeName:"군포시청 민원실" },
  sampleLabels:["작성예시(의료기관 사망)","작성예시(자택 사망)"],
  sampleKinds:["hospital","home"],
  /* 신고일 — 제목 아래 「( 년 월 일)」. ⚠️ 이 서식은 신고일을 **찍는다**(출생과 같다). */
  today:{ y:89.9, yx:114.8, mx:162.5, dx:201.6 },

  /* 안내 기둥의 준비물 — **담당자 원문 그대로다**(2026.08.29 확정). 둘뿐이다.
     ⛔ **도장을 넣지 마라.** 한 번 넣었다가 뺐다 — 다른 신고서에 있다는 이유로 가져온 것이었고
        담당자가 준 사망신고 준비물에는 없다. 「과거 화면에 있었다」는 근거가 되지 않는다. */
  ready:[
    { t:"신고인 신분증", s:"접수할 때 창구에서 확인합니다", g:"idcard", req:true },
    { t:"사망진단서(또는 시체검안서) 원본", s:"의사가 작성한 것", g:"cert", req:true }
  ],

  /* 안내 기둥 맨 아래 「이용 안내」 — 2줄(Product UI v1). ⛔ 늘리지 마라. */
  noticeItems:[
    "필요 서류는 직원 확인을 따릅니다.",
    "여기서 접수되지는 않습니다."
  ],

  /* 인쇄 준비 화면의 「인쇄한 뒤에 하실 일」 — 종전 완료 화면 문구 그대로. */
  afterPrint:"인쇄한 뒤, 신고인이 서명 또는 날인을 직접 하여 민원실에 제출하세요. "
    +"<b>사망진단서(또는 시체검안서) 원본</b>을 함께 내셔야 하며, "
    +"그 밖의 첨부서류는 담당 직원이 안내합니다.",

  rerenderOnSet:["d_place"],

  stateKeys:[].concat(
    ["d_surKor","d_givenKor","d_surHan","d_givenHan","d_sex","d_jumin",
     "d_regBase","d_addr","d_headName","d_headRel",
     "d_deathDate","d_deathHour","d_deathMin","d_placeDetail","d_place","d_placeEtc",
     "d_edu","d_marital"],
    ["etc"],
    ["r_name","r_jumin","r_qual","r_rel","r_addr","r_phone","r_email","sub_name","sub_jumin"]),

  /* ──────────────────────────────────────────────────────────────
     좌표 — 2026.08.29 신서식(`사망신고서(20260828).pdf`) 실측.
     격자선(`get_drawings`)으로 셀을 잡고, 인쇄된 안내글자(「(성)」·「년」·「의」·
     번호 네모 ①②③)는 **잉크 덩어리를 실측**해 그 옆·그 위에 얹었다.
     ⛔ 눈대중으로 옮기지 마라. 구본과 판면이 다르다 — 특히 사망일시의 년·월·일·시·분
        간격과 인구동향 번호칸이 오른쪽으로 밀렸다.
     ────────────────────────────────────────────────────────────── */
  CO:{
    texts:{
      /* ① 사망자 */
      "d_surKor":{x:197.5,y:108.7,a:"c",size:8},
      "d_givenKor":{x:256.5,y:108.7,a:"c",size:8},
      "d_surHan":{x:197.5,y:132.5,a:"c",size:8},
      "d_givenHan":{x:256.5,y:132.5,a:"c",size:8},
      "d_jumin1":{x:457.4,y:120.6,a:"c",size:7},
      "d_jumin2":{x:519.8,y:120.6,a:"c",size:7},
      "d_regBase":{x:133.6,y:158.3,a:"l",size:7,w:412.0,wrap:true},
      "d_addr":{x:133.6,y:190.4,a:"l",size:7,w:205.0,wrap:true},
      /* 세대주·관계 — 서식에 「의」가 인쇄돼 있어 그 좌우로 나눠 얹는다 */
      "d_headName":{x:480.0,y:190.4,a:"r",size:7},
      "d_headRel":{x:497.0,y:190.4,a:"l",size:7},
      /* 사망 일시 — 년 월 일 시 분 이 각각 인쇄돼 있고 그 왼쪽에 값이 들어간다 */
      "deathY":{x:154.7,y:222.6,a:"c",size:7.5},
      "deathMo":{x:191.4,y:222.6,a:"c",size:7.5},
      "deathD":{x:225.0,y:222.6,a:"c",size:7.5},
      "deathH":{x:257.3,y:222.6,a:"c",size:7.5},
      "deathMin":{x:290.1,y:222.6,a:"c",size:7.5},
      /* 사망 장소 */
      "d_placeDetail":{x:170.0,y:252.0,a:"l",size:7,w:379.0,wrap:true},
      "d_placeEtc":{x:213.0,y:370.9,a:"l",size:7,w:265.0},
      /* ② 기타사항 */
      "etc":{x:133.6,y:394.0,a:"l",size:7.5,w:412.0,wrap:true},
      /* ③ 신고인 */
      "r_name":{x:205.0,y:421.9,a:"c",size:8},
      "r_jumin1":{x:457.4,y:421.9,a:"c",size:7},
      "r_jumin2":{x:519.8,y:421.9,a:"c",size:7},
      "r_rel":{x:488.6,y:448.4,a:"c",size:7},
      "r_addr":{x:133.6,y:508.6,a:"l",size:7,w:205.0,wrap:true},
      "r_phone":{x:428.2,y:497.4,a:"l",size:7,w:120.0},
      "r_email":{x:428.2,y:519.9,a:"l",size:6,w:120.0},
      /* ④ 제출인 */
      "sub_name":{x:255.3,y:545.1,a:"c",size:8},
      "sub_jumin1":{x:457.4,y:545.1,a:"c",size:7},
      "sub_jumin2":{x:519.8,y:545.1,a:"c",size:7}
    },
    /* 영표(○)는 서식에 인쇄된 **번호 네모** 위에 찍는다 — 글자가 아니라 번호에. */
    checks:{
      "d_sex":{"남":[294.6,131.8], "여":[322.3,131.8]},
      "d_place":{
        "주택":[177.3,275.8], "의료기관":[348.7,275.8],
        "사회복지시설":[177.2,296.6], "공공시설":[348.2,296.5],
        "도로":[177.5,317.6], "상업·서비스시설":[348.8,317.6],
        "산업장":[177.3,335.5], "농장":[348.9,335.2],
        "병원 이송 중 사망":[177.3,353.1], "기타":[177.4,370.9]
      },
      "r_qual":{"동거친족":[141.9,447.9], "비동거친족":[204.1,447.9],
                "동거자":[275.0,447.9], "기타":[141.7,473.2]},
      "d_edu":{"학력 없음":[141.7,680.1], "초등학교":[211.1,680.1], "중학교":[280.2,680.1],
               "고등학교":[343.8,680.1], "대학(교)":[413.7,680.1], "대학원 이상":[480.1,680.1]},
      "d_marital":{"미혼":[141.8,707.4], "배우자 있음":[210.4,707.4],
                   "이혼":[308.2,707.4], "사별":[371.2,707.4]}
    },
    attend:{}
  },

  STEP_HL:{
    2:[[73.3,96.8,551.0,208.6]],
    3:[[73.3,208.6,551.0,380.0]],
    4:[[43.9,380.0,551.0,408.0]],
    5:[[43.9,408.0,551.0,531.1]],
    6:[[43.9,531.1,551.0,559.0]],
    7:[[43.4,643.7,550.7,721.8]]
  },

  buildVals:function(state){
    var d=state, v={};
    ["d_surKor","d_givenKor","d_surHan","d_givenHan",
     "d_regBase","d_addr","d_headName","d_headRel","d_placeDetail","etc",
     "r_name","r_rel","r_addr","r_email","sub_name"
     /* ⚠️ `r_addr`(신고인 주소)는 종전 config 에서 **빠져 있었다** — 좌표는 있는데
        값을 만들지 않아 화면에만 보이고 **인쇄물에는 빈칸**이었다(2026.08.29 발견). */
    ].forEach(function(k){ v[k]=d[k]||""; });
    /* 「기타」를 고르지 않았으면 상세를 찍지 않는다 — 되돌린 뒤 남은 값이 인쇄되면 안 된다 */
    v.d_placeEtc = (d.d_place==="기타") ? (d.d_placeEtc||"") : "";
    v.r_phone=formatPhone(d.r_phone);
    ["d_jumin","r_jumin","sub_jumin"].forEach(function(f){ v[f+"1"]=j1(d[f]); v[f+"2"]=j2(d[f]); });
    var b=ymd(d.d_deathDate); v.deathY=b[0]; v.deathMo=b[1]; v.deathD=b[2];
    v.deathH=digits(d.d_deathHour); v.deathMin=digits(d.d_deathMin);
    return v;
  },

  /* 인쇄 후 직접 서명·날인해야 하는 칸 — 내용이 있을 때만 형광펜을 친다 */
  signatureHI:function(v){
    var HI=[];
    if(v.r_name) HI.push([282.0,408.0,342.5,435.8]);
    return HI;
  },

  STEPS:[
    /* ⛔ 시작 화면은 보여 주지 않는다 — 허브에서 이미 사망신고를 고르고 들어왔다.
       ⚠️ 단계를 지우지 않고 `when` 으로 숨긴다(`STEP_HL`·`applySample` 이 절대 번호를 쓴다). */
    {n:1, short:"시작", title:"사망신고서 작성 시작",
      when:function(){ return false; },
      q:"함께 한 단계씩 채워 볼까요?", kind:"intro",
      body:function(){ return '<div class="opts"><button type="button" class="opt sel" data-next="1">시작하기</button></div>'; }},

    {n:2, short:"사망자", title:"① 사망자 — 인적사항",
      q:"돌아가신 분(사망자)의 정보를 입력하세요.",
      why:"사망신고는 사망 사실을 안 날부터 1개월 이내에 해야 합니다. 성명·주민등록번호·주소는 가족관계등록부 대조에 쓰입니다.",
      required:function(s){ var m=[];
        if(!String(s.d_surKor||"").trim()) m.push("성(한글)");
        if(!String(s.d_givenKor||"").trim()) m.push("이름(한글)");
        if(!s.d_sex) m.push("성별");
        /* ⛔ 주민등록번호는 **선택**이다(2026.08.30 담당자) — 필수 목록에 다시 넣지 마라. */
        if(!String(s.d_addr||"").trim()) m.push("주소");
        if(!String(s.d_headName||"").trim()) m.push("세대주 성명");
        if(!String(s.d_headRel||"").trim()) m.push("세대주와의 관계");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"d_surKor", label:"성(한글)", req:true, half:true, ph:"조"});
        h+=A.inputHtml({k:"d_givenKor", label:"이름(한글)", req:true, half:true, ph:"속달"});
        /* 한자는 **한자 찾기**로 받는다(2026.09.01) — 8종 공통 component.
           ⛔ 「성(한자)·이름(한자)」 두 칸으로 되돌리지 마라. */
        h+=A.hanjaGridHtml("dName", [["d_surKor","d_surHan","성"],
                                     ["d_givenKor","d_givenHan","이름"]],
                           "이름 한자 찾기");
        h+='<div class="field"><label class="field-label">성별 <span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("d_sex",SEX_OPTS)+'</div>';
        h+=A.inputHtml({k:"d_jumin", label:"주민등록번호", type:"jumin", req:true, ph:"400101-0000000",
          help:"외국인은 외국인등록번호를 적습니다."});
        h+=A.inputHtml({k:"d_regBase", label:"등록기준지", ph:"경기도 군포시 …",
          help:"가족관계등록부의 기준이 되는 주소입니다. 외국인은 국적을 적습니다.", optHint:true});
        h+=A.inputHtml({k:"d_addr", label:"주소", req:true, ph:"경기도 군포시 …",
          help:"사망자의 주민등록 주소."});
        h+=A.inputHtml({k:"d_headName", label:"세대주 성명", req:true, half:true, ph:"조속달",
          help:"사망자가 속한 세대의 세대주."});
        h+=A.inputHtml({k:"d_headRel", label:"세대주와의 관계", req:true, half:true, ph:"본인"});
        return h;
      }},

    {n:3, short:"사망 일시·장소", title:"① 사망 일시·장소",
      q:"언제·어디서 돌아가셨는지 입력하세요.",
      why:"사망일시는 24시각제로 적습니다(예: 오후 2시 30분 → 14시 30분). 사망장소 구분은 해당하는 한 곳을 고르세요.",
      required:function(s){ var m=[];
        if(!String(s.d_deathDate||"").trim()) m.push("사망 연월일");
        if(!String(s.d_deathHour||"").trim()) m.push("사망 시각(시)");
        if(!String(s.d_deathMin||"").trim()) m.push("사망 시각(분)");
        if(!String(s.d_placeDetail||"").trim()) m.push("사망 장소(상세)");
        if(!s.d_place) m.push("사망 장소 구분");
        /* 화면에 나타났으면 필수 — 「기타」를 골랐을 때만 묻는다 */
        if(s.d_place==="기타" && !String(s.d_placeEtc||"").trim()) m.push("사망 장소(기타) 상세");
        return m; },
      /* ⚠️ 「비었다」와 「값이 틀렸다」는 안내 문장이 달라야 한다 — 그래서 `required` 와 나눈다. */
      invalid:function(s){
        var m=[], hh=String(s.d_deathHour||"").trim(), mm=String(s.d_deathMin||"").trim();
        if(hh && !(/^\d{1,2}$/.test(hh) && +hh<=23)) m.push("사망 시각의 ‘시’는 0~23 사이 숫자로 적어 주세요(24시각제).");
        if(mm && !(/^\d{1,2}$/.test(mm) && +mm<=59)) m.push("사망 시각의 ‘분’은 0~59 사이 숫자로 적어 주세요.");
        return m;
      },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"d_deathDate", label:"사망 연월일", type:"date", req:true, ph:"2026.07.10",
          help:"예: 2026.07.10 (숫자 8자리를 적으면 자동으로 정리됩니다)"});
        /* ⚠️ 라벨이 「사망 시각 — 시(時)」면 크게 보기에서 필수 배지가 접힌다(출생에서 겪었다). */
        h+=A.inputHtml({k:"d_deathHour", label:"시", req:true, half:true, ph:"9",
          help:"24시각제. 오후 2시 → 14"});   /* ⚠️ 출생과 **같은 문장**이다. 길어지면 반 칸에서 두 줄이 돼 짝이 어긋난다 */
        h+=A.inputHtml({k:"d_deathMin", label:"분", req:true, half:true, ph:"20"});
        /* ⚠️ 2026.08.30 담당자 2차 — **주소까지만.** 종전에는 「돌아가신 곳의 이름이나 주소」라
           안내하고 예시로 병원명을 보여 줬다. 담당자 확인: 병원명·건물명은 적지 않는다.
           ⛔ 시설명·건물명을 적도록 유도하지 마라(예시·도움말 둘 다). */
        h+=A.inputHtml({k:"d_placeDetail", label:"사망 장소(상세)", req:true,
          ph:"예: 경기도 군포시 산본로 000",
          help:"돌아가신 곳의 주소까지만 적어 주세요. 병원명이나 건물명은 적지 않습니다."});
        h+='<div class="field"><label class="field-label">사망 장소 구분 <span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("d_place",PLACE_OPTS,"해당하는 한 곳을 고르세요.")+'</div>';
        if(A.state.d_place==="기타")
          h+=A.inputHtml({k:"d_placeEtc", label:"사망 장소(기타) 상세", req:true, ph:"예: 이동 중 차량 안"});
        return h;
      }},

    {n:4, short:"기타", title:"② 기타사항",
      q:"특별히 밝힐 내용이 있으면 적습니다.",
      body:function(A){
        var h='';
        h+='<div class="note-box">대부분 <b>비워 둡니다.</b> 해당하는 경우에만 적으세요.</div>';
        h+=A.inputHtml({k:"etc", label:"② 기타사항", help:"가족관계등록부 기록에 특별히 필요한 사항."});
        return h;
      }},

    {n:5, short:"신고인", title:"③ 신고인",
      q:"신고서를 작성·제출하는 분(신고인)의 정보를 입력하세요.",
      why:"신고인은 보통 동거친족(함께 살던 가족) 등입니다. 사망자와의 관계를 함께 적습니다.",
      required:function(s){ var m=[];
        if(!String(s.r_name||"").trim()) m.push("신고인 성명");
        /* ⛔ 주민등록번호는 **선택**이다(2026.08.30 담당자) — 필수 목록에 다시 넣지 마라. */
        if(!s.r_qual) m.push("신고인 자격");
        if(!String(s.r_rel||"").trim()) m.push("사망자와의 관계");
        if(!String(s.r_addr||"").trim()) m.push("신고인 주소");
        if(!String(s.r_phone||"").trim()) m.push("휴대전화번호");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"r_name", label:"신고인 성명", req:true, ph:"조수리"});
        h+=A.inputHtml({k:"r_jumin", label:"주민등록번호", type:"jumin", req:true, ph:"800101-0000000"});
        h+='<div class="field"><label class="field-label">신고인 자격 <span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("r_qual",QUAL_OPTS,"사망자와 함께 살았으면 ‘동거친족’, 따로 살았으면 ‘비동거친족’.")+'</div>';
        h+=A.inputHtml({k:"r_rel", label:"사망자와의 관계", req:true, ph:"예: 자(子), 배우자",
          help:"신고인이 사망자와 어떤 사이인지."});
        h+=A.inputHtml({k:"r_addr", label:"주소", req:true, ph:"경기도 군포시 …"});
        h+=A.inputHtml({k:"r_phone", label:"휴대전화번호 등", type:"phone", req:true, ph:"010-0000-0000"});
        /* ⚠️ 이메일만 예외 문구다 — 없는 사람은 창구도 대신 만들어 줄 수 없다(출생과 같다). */
        h+=A.inputHtml({k:"r_email", label:"이메일", ph:"name@example.com",
          help:"없으면 비워 두셔도 됩니다."});
        return h;
      }},

    {n:6, short:"제출인", title:"④ 제출인",
      q:"신고인이 아닌 다른 사람이 제출할 때만 적습니다.",
      body:function(A){
        var h='';
        h+='<div class="note-box">신고인 본인이 직접 제출하면 이 단계는 <b>비워 두세요.</b> '
          +'신고인이 아닌 다른 사람이 대신 제출할 때만 적습니다.</div>';
        h+=A.inputHtml({k:"sub_name", label:"제출인 성명", half:true});
        h+=A.inputHtml({k:"sub_jumin", label:"제출인 주민등록번호", type:"jumin", half:true});
        return h;
      }},

    {n:7, short:"인구동향", title:"인구동향조사(통계)",
      /* ⚠️ 신서식은 이 조사의 주체를 「국가데이터처」로 적는다(구본은 통계청). */
      q:"국가데이터처 인구동향조사 항목입니다.",
      why:"성실응답 의무가 있는 통계 항목이며, 개인정보는 보호됩니다. 사망자의 최종 졸업학교와 혼인 상태를 고르세요.",
      required:function(s){ var m=[];
        if(!s.d_edu) m.push("최종 졸업학교");
        if(!s.d_marital) m.push("혼인 상태");
        return m; },
      body:function(A){
        var h='';
        h+='<div class="field"><label class="field-label">㉮ 최종 졸업학교 — 사망자 '
          +'<span class="fb fb-req">필수</span></label>'+A.choiceHtml("d_edu",EDU)+'</div>';
        h+='<div class="field"><label class="field-label">㉯ 혼인 상태 — 사망자 '
          +'<span class="fb fb-req">필수</span></label>'+A.choiceHtml("d_marital",MARITAL_OPTS)+'</div>';
        return h;
      }},

    {n:8, short:"완료", title:"작성 내용 확인", q:"고르신 것만 다시 확인해 주세요.", kind:"summary",
      body:function(){
        return buildSummary();
      }}
  ],

  applySample:function(state, kind){
    Object.assign(state,{
      step:2,
      d_surKor:"조", d_givenKor:"속달", d_surHan:"趙", d_givenHan:"束達", d_sex:"남",
      d_jumin:"4001011000000", d_regBase:"경기도 군포시 산본로 000",
      d_addr:"경기도 군포시 산본로 000",
      d_headName:"조속달", d_headRel:"본인",
      d_deathDate:"2026.07.10", d_deathHour:"9", d_deathMin:"20",
      /* ⛔ 작성예시에 **병원명·건물명을 넣지 마라**(2026.08.30 담당자 2차). 예시가 곧 본보기다 —
         여기에 시설명이 있으면 안내문으로 아무리 막아도 그대로 따라 적는다.
         ⚠️ 「의료기관」은 장소 **구분**(영표)이라 그대로 둔다 — 주소칸과 다른 것이다. */
      d_placeDetail:"경기도 군포시 산본로 000", d_place:"의료기관", d_placeEtc:"",
      d_edu:"고등학교", d_marital:"사별",
      etc:"",
      r_name:"조수리", r_jumin:"7203151000000", r_qual:"동거친족", r_rel:"자(子)",
      r_addr:"경기도 군포시 산본로 000", r_phone:"01012345678",
      r_email:"suri@example.com"
    });
    if(kind==="home"){
      state.d_place="주택"; state.d_placeDetail="경기도 군포시 산본로 000";
      state.d_marital="배우자 있음";
      state.r_name="정송부"; state.r_jumin="4503152000000"; state.r_qual="동거친족"; state.r_rel="배우자";
      state.r_email="songbu@example.com";
    }
  }
};
