/* =====================================================================
   가족관계 등록사항별 증명서 교부 등 신청서 (별지 제11호) — FORM 설정
   engine/engine.js와 함께 build-form.js가 자체완결 HTML로 인라인한다.
   재생성: python tools/prep-bg.py cert "서식원본/[별지 제11호 서식]...pdf"
          node tools/build-form.js cert
   좌표계: PW=595 / PH=841 (PDF 포인트). 값 위치는 각 칸의 세로 중심.
   ===================================================================== */

/* 「그 밖의 증명서」 문(4단계) — 닫혀 있으면 5~8단계가 아예 나오지 않는다.
   ⚠️ 문을 닫으면 그 안에서 적었던 값은 **없는 것으로 본다**(`buildVals`·`buildSummary`·
      `checkVisible` 세 곳 전부). 하나라도 빠지면 「예 → 적음 → 아니요」로 되돌린 시민의
      종이에 지운 줄 알았던 값이 남는다 — AGENTS.md 가 말하는 「조건 변경 뒤 잔상」이다. */
function advOn(s){ return (s||state).adv_need==="예"; }

/* 문 안쪽에서만 적는 값 — 문이 닫히면 인쇄에서 뺀다. */
var ADV_KEYS=[
  "c_fam_spec","c_fam_det",
  "c_bas_det","c_bas_s1","c_bas_s2","c_bas_s3","c_bas_s4","c_bas_s5","c_bas_s6",
  "c_mar_spec","c_mar_det",
  "c_adopt_gen","c_adopt_det","c_spadopt_gen","c_spadopt_det",
  "c_doc","c_accept","c_jeok_deung","c_jeok_cho","c_jeok_view",
  "fam_child_name","mar_spec_ex",
  "view_y","view_mo","view_d","view_name","jeok_bonjeok","jeok_hoju","jeok_target"
];

/* 통수/건수 요약 행 (0통은 표시 안 함)
   네 번째 값은 **[수정]이 돌아갈 단계**다. ⚠️ 종전에는 전부 `3` 이었는데, 상세·특정은
   3단계에 칸이 없어서 눌러도 엉뚱한 화면으로 갔다. 적은 자리로 돌려보낸다. */
function certRows(){
  var d=state;
  return [
    ["가족관계증명서(일반)", d.c_fam_gen, "통", 3],
    ["가족관계증명서(특정)", d.c_fam_spec, "통", 5],
    ["가족관계증명서(상세)", d.c_fam_det, "통", 5],
    ["기본증명서(일반)", d.c_bas_gen, "통", 3],
    ["기본증명서(상세)", d.c_bas_det, "통", 6],
    ["기본특정 · 출생·사망·실종", d.c_bas_s1, "통", 6],
    ["기본특정 · 인지·친생자관계정정", d.c_bas_s2, "통", 6],
    ["기본특정 · 친권·미성년후견", d.c_bas_s3, "통", 6],
    ["기본특정 · 개명·성본변경", d.c_bas_s4, "통", 6],
    ["기본특정 · 국적취득·상실", d.c_bas_s5, "통", 6],
    ["기본특정 · 성별정정", d.c_bas_s6, "통", 6],
    ["혼인관계증명서(일반)", d.c_mar_gen, "통", 3],
    ["혼인관계증명서(특정)", d.c_mar_spec, "통", 7],
    ["혼인관계증명서(상세)", d.c_mar_det, "통", 7],
    ["입양관계증명서(일반)", d.c_adopt_gen, "통", 7],
    ["입양관계증명서(상세)", d.c_adopt_det, "통", 7],
    ["친양자입양관계증명서(일반)", d.c_spadopt_gen, "통", 7],
    ["친양자입양관계증명서(상세)", d.c_spadopt_det, "통", 7],
    ["신고서류기재사항증명", d.c_doc, "건", 8],
    ["수리·불수리증명", d.c_accept, "건", 8],
    ["제적 등본", d.c_jeok_deung, "통", 8],
    ["제적 초본", d.c_jeok_cho, "통", 8],
    ["제적 열람", d.c_jeok_view, "건", 8]
  ];
}

/* ⛔ Review 는 **핵심 선택**만이다(2026.08.29 §2). 성명·주민등록번호·주소·전화·이메일·
   자유입력은 가운데 PAPER 가 실시간으로 보여 주므로 여기서 되풀이하지 않는다. */
function buildSummary(){
  var d=state, h='';
  /* 이 서식의 핵심 선택은 **무엇을 몇 통 떼는가**다 — 0통은 내지 않는다.
     ⚠️ 문(4단계)이 닫혀 있으면 상세·특정 줄은 내지 않는다. 내면 [수정]이 **비활성 단계**를
        가리켜 눌러도 아무 일이 없는 죽은 단추가 된다(`gotoStep` 은 `stepActive` 를 본다). */
  certRows().forEach(function(r){
    if(r[3]!==3 && !advOn(d)) return;
    var n=digits(r[1]); if(n && +n>0) h+=sumRowIf(r[0], n+r[2], r[3]);
  });
  h+=sumRowIf("대리 신청", d.del_name ? "예" : "", 10);
  h+=sumRowIf("주민등록번호 공개", [d.disc_scope, d.disc_reason].filter(Boolean).join(" · "), 10);
  h+=sumRowIf("아포스티유 제출용", d.apostille ? "동의" : "", 9);
  return h;
}

var FORM={
  /* ⛔ 이 한 줄이 껍데기를 정한다 — Product UI v1(`engine/base-product.html`). */
  shell:"product",
  docTitle:"증명서 발급신청 작성 미리보기 도우미",
  formName:"가족관계 등록사항별 증명서 교부 등 신청서",
  org:{ orgName:"경기도 군포시", officeName:"군포시청 민원실" },
  sampleLabels:["작성예시(본인 신청)","작성예시(대리 신청)"],
  sampleKinds:["self","agent"],
  /* 인쇄 준비 화면 — 종전 완료 화면 문구를 **행동**과 **참고**로 갈라 옮겼다.
     ⛔ 문구를 새로 짓지 않았다. */
  afterPrint:"인쇄한 뒤, 신청인이 서명·날인을 직접 하여 민원실에 제출하세요. "
    +"신분증을 함께 준비하고, 대리 신청은 위임장과 대리인 신분증이 필요합니다.",
  refInfo:"수수료는 증명서 1통당 1,000원(제적초본 500원, 열람·증명 1건당 200원)입니다.",

  /* ⛔ **이 서식은 「가족관계등록 신고서」가 아니다.** 2026.08.29 담당자 확정본의
        공통 필수/선택 원칙(모든 사항 필수 · 등록기준지·본·한자만 선택 · 신고인란 필수)은
        **신고서 5종에만** 적용된다. 여기의 필수 조건은 **기존 업무규칙 그대로** 두고,
        새 필수 조건을 추정해 보태지 않는다.
     ⚠️ 준비물이 **2026.08.30 에 담당자 지시로 들어왔다**(종전에는 받은 것이 없어 비워 뒀다).
     ⛔ 담당자가 준 두 줄이 전부다. 「위임장」·「대리인 신분증」처럼 **개별 서류명을 열거하지 마라** —
        대리 신청의 형태는 여러 가지이고, 무엇이 필요한지는 창구가 정한다.
     ⛔ **허브 카탈로그(`index.html`)의 같은 항목과 글자까지 같아야 한다.** 두 곳이 갈라지면
        Main 에서 본 준비물과 서식에서 본 준비물이 달라진다. */
  ready:[
    { t:"신분증", s:"접수할 때 창구에서 확인합니다", g:"idcard", req:true },
    { t:"대리 신청 시 관련 서류", s:"대리 신청인 경우 위임 등 관련 서류가 필요할 수 있습니다", g:"document" }
  ],

  /* 안내 기둥 맨 아래 「이용 안내」 — 2줄(Product UI v1). ⛔ 늘리지 마라. */
  noticeItems:[
    "필요 서류는 직원 확인을 따릅니다.",
    "여기서 접수되지는 않습니다."
  ],

  stateKeys:[].concat(
    // 발급 대상자
    ["t_name","t_nameHan","t_regBase","t_jumin"],
    // 신청내용 — 통수/건수
    ["c_fam_gen","c_fam_spec","c_fam_det",
     "c_bas_gen","c_bas_det","c_bas_s1","c_bas_s2","c_bas_s3","c_bas_s4","c_bas_s5","c_bas_s6",
     "c_mar_gen","c_mar_spec","c_mar_det",
     "c_adopt_gen","c_adopt_det","c_spadopt_gen","c_spadopt_det",
     "c_doc","c_accept","c_jeok_deung","c_jeok_cho","c_jeok_view"],
    // 신청내용 — 부가(체크·텍스트)
    ["famWhoFu","famWhoMo","famWhoSp","famWhoCh","fam_child_name",
     "mar_spec_ex","bas_s3_scope","spec_incReg","spec_incBon",
     "view_y","view_mo","view_d","view_name",
     "jeok_bonjeok","jeok_hoju","jeok_target"],
    // 주민번호 공개신청 · 청구사유 · 아포스티유
    ["disc_scope","disc_reason","claim_reason","proof_material","apostille"],
    // 신청인 · 위임인
    ["ap_name","ap_jumin","ap_qual","ap_addr","ap_phone","del_name","del_jumin"],
    // 「그 밖의 증명서」 문 — 화면에만 사는 값이다(⛔ `CO` 에 좌표를 만들지 마라)
    ["adv_need"]),

  /* 문은 **닫힌 채로 시작한다.** 대부분은 고르지 않고 [다음]만 누르므로, 종전 한 단계짜리
     선택 화면과 누르는 횟수가 같다. ⛔ 기본값을 「예」로 돌리지 마라 — 21칸을 아무도
     안 쓰는데 모두에게 보여 주던 것이 바로 이 변경이 없앤 문제다. */
  stateDefaults:{ adv_need:"아니요" },

  /* 선택 ○ 표시를 조건부로 숨김 — 문이 닫히면 문 안쪽의 표시도 종이에서 뺀다 */
  checkVisible:function(field, s){
    if(field==="famWhoFu"||field==="famWhoMo"||field==="famWhoSp"||field==="famWhoCh"
       ||field==="bas_s3_scope"||field==="spec_incReg"||field==="spec_incBon") return advOn(s);
    return true;
  },

  CO:{
    texts:{
      // ── 발급 대상자 ──
      "t_name":{x:314,y:135,a:"c",size:9},
      "t_nameHan":{x:492,y:135,a:"c",size:8},
      "t_regBase":{x:222,y:156,a:"l",size:7.5,w:315,wrap:true},
      "t_jumin1":{x:335,y:189,a:"c",size:8,nb:true}, "t_jumin2":{x:450,y:189,a:"c",size:8,nb:true},
      // ── 신청내용 통수/건수 ──
      "c_fam_gen":{x:239,y:209,a:"c",size:8,nb:true},
      "c_fam_spec":{x:297,y:209,a:"c",size:8,nb:true},
      "fam_child_name":{x:461,y:209,a:"c",size:6.5,nb:true},
      "c_fam_det":{x:522,y:209,a:"c",size:8,nb:true},
      "c_bas_s1":{x:360,y:227,a:"c",size:7,nb:true},
      "c_bas_s2":{x:465,y:227,a:"c",size:7,nb:true},
      "c_bas_s3":{x:429,y:240,a:"c",size:7,nb:true},
      "c_bas_gen":{x:239,y:247,a:"c",size:8,nb:true},
      "c_bas_det":{x:522,y:247,a:"c",size:8,nb:true},
      "c_bas_s4":{x:362,y:253,a:"c",size:7,nb:true},
      "c_bas_s5":{x:450,y:253,a:"c",size:7,nb:true},
      "c_bas_s6":{x:344,y:266,a:"c",size:7,nb:true},
      "c_mar_gen":{x:239,y:285,a:"c",size:8,nb:true},
      "c_mar_spec":{x:299,y:285,a:"c",size:8,nb:true},
      "mar_spec_ex":{x:442,y:285,a:"c",size:6.5,nb:true},
      "c_mar_det":{x:522,y:285,a:"c",size:8,nb:true},
      "c_adopt_gen":{x:239,y:303,a:"c",size:8,nb:true},
      "c_adopt_det":{x:297,y:303,a:"c",size:8,nb:true},
      "c_spadopt_gen":{x:467,y:303,a:"c",size:8,nb:true},
      "c_spadopt_det":{x:523,y:303,a:"c",size:8,nb:true},
      "c_doc":{x:243,y:321.5,a:"c",size:8,nb:true},
      "c_accept":{x:415,y:321.5,a:"c",size:8,nb:true},
      // 열람(신고서류)
      "view_y":{x:225,y:340,a:"c",size:7,nb:true}, "view_mo":{x:266,y:340,a:"c",size:7,nb:true},
      "view_d":{x:306,y:340,a:"c",size:7,nb:true}, "view_name":{x:389,y:340,a:"c",size:7,nb:true},
      // 제적
      "c_jeok_deung":{x:289,y:358,a:"c",size:8,nb:true},
      "c_jeok_cho":{x:346,y:358,a:"c",size:8,nb:true},
      "c_jeok_view":{x:404,y:358,a:"c",size:8,nb:true},
      "jeok_bonjeok":{x:150,y:373,a:"l",size:7,w:165,nb:true},
      "jeok_hoju":{x:350,y:373,a:"l",size:7,w:55,nb:true},
      "jeok_target":{x:445,y:373,a:"l",size:7,w:44,nb:true},
      // ── 청구사유 · 소명자료 ──
      "claim_reason":{x:125,y:469,a:"l",size:7.5,w:415,wrap:true},
      "proof_material":{x:125,y:490,a:"l",size:7.5,w:415,wrap:true},
      // ── 신청인 ──
      "ap_name":{x:150,y:528,a:"l",size:8,w:100},
      "ap_jumin1":{x:425,y:528,a:"c",size:8,nb:true}, "ap_jumin2":{x:505,y:528,a:"c",size:8,nb:true},
      "ap_qual":{x:393,y:549,a:"l",size:7,w:150,nb:true},
      "ap_addr":{x:150,y:558,a:"l",size:7,w:165,wrap:true},
      "ap_phone":{x:393,y:567,a:"l",size:7,w:150,nb:true},
      // ── 위임인 ──
      "del_name":{x:150,y:584,a:"l",size:8,w:165},
      "del_jumin1":{x:425,y:584,a:"c",size:8,nb:true}, "del_jumin2":{x:505,y:584,a:"c",size:8,nb:true},
      // ── 신청일 (20〔YY〕. 〔M〕. 〔D〕) ──
      "d_yy":{x:275,y:619,a:"c",size:8,nb:true}, "d_mo":{x:300,y:619,a:"c",size:8,nb:true},
      "d_dd":{x:325,y:619,a:"c",size:8,nb:true}
    },
    checks:{
      // 주민등록번호 공개 범위 / 사유 (라디오)
      "disc_scope":{"전부 공개":[125.4,416],"신청대상자 본인만 공개":[125.4,432]},
      "disc_reason":{"정확기재":[223.7,406],"본인·가족":[223.7,417.7],"재판소명":[223.7,441],"공용소명":[223.7,452.9]},
      // 기본증명서 특정 · 친권·미성년후견 범위 (라디오)
      "bas_s3_scope":{"전부":[373,240],"현재":[399,240]}
    },
    attend:{
      // 가족관계 특정증명서 포함 대상
      "famWhoFu":[321,209], "famWhoMo":[342,209], "famWhoSp":[363,209], "famWhoCh":[401,209],
      // 특정증명서 포함 옵션
      "spec_incReg":[391,391.3], "spec_incBon":[473,391.3],
      // 아포스티유 동의
      "apostille":[508,508.7]
    }
  },

  /* ⚠️ **절대 단계번호**다. 2026.09.23 에 옛 4단계(그 밖의 증명서)를 문 하나 + 네 단계로
     갈랐고, 그래서 신청인 5→9 · 위임·사유 6→10 으로 밀렸다. 한 곳만 안 옮기면
     엉뚱한 자리가 강조된다(엔진 주석 `stepActive` 참조). */
  STEP_HL:{
    2:[[119,124,545,199]],
    3:[[119,199,545,293]],
    4:[[119,199,545,399]],          // 문 — 「그 밖의 증명서」 구역 전체를 가리킨다
    5:[[119,199,545,218]],          // 가족관계 상세·특정 (행 y≈209)
    6:[[119,218,545,275]],          // 기본증명서 상세·특정 (행 y≈227~266)
    7:[[119,275,545,312]],          // 혼인(285) · 입양·친양자(303)
    8:[[119,312,545,399]],          // 신고서류(321)·열람(340)·제적(358~373)·포함항목(391)
    9:[[119,515,545,574]],
    10:[[119,399,545,515],[119,574,545,607]]
  },

  buildVals:function(state){
    /* 문(4단계)이 닫혀 있으면 문 안쪽 값은 **종이에 올리지 않는다.**
       ⛔ `state` 를 지우지 마라 — 「예」로 되돌리면 적어 둔 것이 그대로 돌아와야 한다.
          여기서는 인쇄용 사본만 비운다. */
    if(!advOn(state)){
      var clean={}; for(var ck in state) clean[ck]=state[ck];
      ADV_KEYS.forEach(function(k){ clean[k]=""; });
      state=clean;
    }
    var d=state, v={};
    ["t_name","t_nameHan","t_regBase","fam_child_name","mar_spec_ex",
     "view_y","view_mo","view_d","view_name",
     "jeok_bonjeok","jeok_hoju","jeok_target",
     "claim_reason","proof_material","ap_name","ap_qual","ap_addr","del_name"
    ].forEach(function(k){ v[k]=d[k]||""; });
    v.ap_phone=formatPhone(d.ap_phone);
    ["c_fam_gen","c_fam_spec","c_fam_det","c_bas_gen","c_bas_det",
     "c_bas_s1","c_bas_s2","c_bas_s3","c_bas_s4","c_bas_s5","c_bas_s6",
     "c_mar_gen","c_mar_spec","c_mar_det","c_adopt_gen","c_adopt_det",
     "c_spadopt_gen","c_spadopt_det","c_doc","c_accept",
     "c_jeok_deung","c_jeok_cho","c_jeok_view"
    ].forEach(function(k){ v[k]=digits(d[k]); });
    ["t_jumin","ap_jumin","del_jumin"].forEach(function(f){ v[f+"1"]=j1(d[f]); v[f+"2"]=j2(d[f]); });
    var t=APP_TODAY||new Date();
    v.d_yy=String(t.getFullYear()).slice(2); v.d_mo=String(t.getMonth()+1); v.d_dd=String(t.getDate());
    return v;
  },

  signatureHI:function(v){
    var HI=[];
    if(v.ap_name) HI.push([254,520,320,536]);   // 신청인 (서명 또는 날인)
    return HI;
  },

  STEPS:[
    /* ⛔ 시작 화면은 보여 주지 않는다 — 허브에서 이미 증명서 발급을 고르고 들어왔다.
       ⚠️ 단계를 지우지 않고 `when` 으로 숨긴다(`STEP_HL`·`applySample` 이 절대 번호를 쓴다). */
    {n:1, short:"시작", title:"증명서 발급신청 작성 시작",
      when:function(){ return false; },
      q:"함께 한 단계씩 채워 볼까요?", kind:"intro",
      body:function(){ return '<div class="opts"><button type="button" class="opt sel" data-next="1">시작하기</button></div>'; }},

    {n:2, short:"발급 대상자", title:"발급받을 사람 (대상자)",
      q:"증명서를 발급받을 사람의 정보를 입력하세요.",
      why:"가족관계등록부의 주인, 즉 증명서에 나올 사람입니다. 본인·배우자·직계혈족은 성명과 주민등록번호만으로도 신청할 수 있고, 그 밖의 경우에는 등록기준지가 필요합니다.",
      kind:"fields",
      required:function(s){ var m=[];
        if(!String(s.t_name||"").trim()) m.push("대상자 성명");
        if(!String(s.t_regBase||"").trim() && !String(s.t_jumin||"").trim()) m.push("등록기준지 또는 주민등록번호");
        return m; },
      body:function(A){ var h='';
        h+=A.inputHtml({k:"t_name", label:"대상자 성명(한글)", req:true, half:true, ph:"장당정"});
        /* ⚠️ 대상자는 한글도 **성명 한 칸**이라 성/이름 경계가 없다 — 묶음이 하나뿐이고,
           그래서 **성씨 우선을 쓰지 않는다**(어디까지가 성인지 추론하지 않는다). */
        h+=A.hanjaGridHtml("tName", [["t_name","t_nameHan"]], "성명 한자 찾기");
        h+=A.inputHtml({k:"t_regBase", label:"등록기준지", ph:"경기도 군포시 …",
          help:"가족관계등록부의 기준이 되는 주소. 우편으로 신청할 때는 반드시 필요합니다."});
        h+=A.inputHtml({k:"t_jumin", label:"주민등록번호", type:"jumin", ph:"900101-0000000",
          help:"본인·배우자·직계혈족은 주민등록번호만으로도 신청할 수 있습니다."});
        return h; }},

    {n:3, short:"필요한 증명서", title:"어떤 증명서가 필요하세요?",
      q:"필요한 증명서의 통수를 적으세요. 필요 없는 것은 비워 두세요.",
      why:"가장 많이 쓰는 세 가지입니다. ‘일반’은 현재의 기본 정보만 나오는 보통의 증명서입니다. 더 자세한 종류(상세·특정)나 입양·제적 증명서는 다음 단계에서 고를 수 있습니다.",
      kind:"certs",
      body:function(A){ var h='';
        h+='<div class="note-box">보통 <b>한 종류, 1통</b>이면 됩니다. 필요한 칸에 숫자만 적으세요.</div>';
        h+=A.inputHtml({k:"c_fam_gen", label:"가족관계증명서 (일반) — 통수", ph:"예: 1",
          help:"부모·배우자·자녀 등 가족 관계를 보여 줍니다."});
        h+=A.inputHtml({k:"c_bas_gen", label:"기본증명서 (일반) — 통수", ph:"예: 1",
          help:"본인의 출생·사망·개명 등 기본 사항을 보여 줍니다."});
        h+=A.inputHtml({k:"c_mar_gen", label:"혼인관계증명서 (일반) — 통수", ph:"예: 1",
          help:"혼인·이혼 등 혼인 관계를 보여 줍니다."});
        return h; }},

    /* ══ 「그 밖의 증명서」 — 문 하나 + 네 단계 (2026.09.23 · QA_BACKLOG U6) ═══════════
       종전에는 이 전부가 **한 단계**였다. 실측으로 내용 2068px / 보이는 곳 601px —
       입력칸 21개가 화면 세 장 반에 걸쳐 있었고, 엔진 7종 약 50단계 가운데 가장 길었다
       (2위와 200px 차이). 그런데 **전부 선택 항목**이라 대부분은 한 글자도 적지 않는다.

       그래서 쪼개기만 하지 않고 **문을 먼저 세웠다.** 닫혀 있으면 네 단계가 통째로
       사라지므로, 대부분이 걷는 길은 종전과 누르는 횟수가 같다(문에서 [다음] 한 번).
       필요한 사람만 한 화면에 들어오는 네 단계를 지난다.
       ⛔ 업무 문구를 새로 짓지 않았다 — 문에 쓴 말은 종전 안내상자에 있던 문장 그대로다. */
    {n:4, short:"그 밖의 증명서", title:"그 밖의 증명서가 필요하세요?",
      q:"자세한 증명서나 입양·제적 등이 필요할 때만 「예」를 고르세요.",
      why:"3단계에서 고른 ‘일반’ 증명서로 대부분의 일이 됩니다. 상세·특정 증명서나 입양·제적 증명서는 필요하다고 안내받았을 때만 고르세요.",
      kind:"advgate",
      body:function(A){ var h='';
        h+='<div class="note-box">대부분 <b>비워 둡니다.</b> 그대로 <b>[다음]</b>으로 넘어가세요.</div>';
        h+=A.choiceHtml("adv_need",["아니요","예"],"");
        return h; }},

    {n:5, short:"가족관계 상세", title:"가족관계증명서 — 상세·특정",
      when:advOn, kind:"advFam",
      body:function(A){ var h='';
        h+=A.inputHtml({k:"c_fam_det", label:"상세 — 통수", half:true, ph:""});
        h+=A.inputHtml({k:"c_fam_spec", label:"특정 — 통수", half:true, ph:""});
        h+='<div class="q-help">특정 증명서에 포함할 사람을 고르세요.</div>';
        h+='<div class="opts row">'+A.toggleHtml("famWhoFu","부")+A.toggleHtml("famWhoMo","모")
          +A.toggleHtml("famWhoSp","배우자")+A.toggleHtml("famWhoCh","자녀")+'</div>';
        if(A.state.famWhoCh) h+=A.inputHtml({k:"fam_child_name", label:"자녀 성명", ph:"장금정"});
        return h; }},

    {n:6, short:"기본증명서 상세", title:"기본증명서 — 상세·특정",
      when:advOn, kind:"advBas",
      body:function(A){ var h='';
        h+=A.inputHtml({k:"c_bas_det", label:"상세 — 통수", half:true});
        h+=A.inputHtml({k:"c_bas_s1", label:"특정·출생·사망·실종", half:true});
        h+=A.inputHtml({k:"c_bas_s2", label:"특정·인지·친생자관계정정", half:true});
        h+=A.inputHtml({k:"c_bas_s3", label:"특정·친권·미성년후견", half:true});
        if(digits(A.state.c_bas_s3))
          h+='<div class="field"><label class="field-label">친권·미성년후견 범위</label>'
            +A.choiceHtml("bas_s3_scope",["전부","현재"],"")+'</div>';
        h+=A.inputHtml({k:"c_bas_s4", label:"특정·개명·성본변경", half:true});
        h+=A.inputHtml({k:"c_bas_s5", label:"특정·국적취득·상실", half:true});
        h+=A.inputHtml({k:"c_bas_s6", label:"특정·성별정정", half:true});
        return h; }},

    {n:7, short:"혼인·입양", title:"혼인관계 · 입양 증명서",
      when:advOn, kind:"advMar",
      body:function(A){ var h='';
        h+='<div class="field-label">혼인관계증명서 — 상세·특정</div>';
        h+=A.inputHtml({k:"c_mar_det", label:"상세 — 통수", half:true});
        h+=A.inputHtml({k:"c_mar_spec", label:"특정 — 통수", half:true});
        h+=A.inputHtml({k:"mar_spec_ex", label:"전(前) 배우자 성명", ph:""});
        h+='<div class="field-label" style="margin-top:8px">입양·친양자입양 증명서</div>';
        h+=A.inputHtml({k:"c_adopt_gen", label:"입양(일반) — 통수", half:true});
        h+=A.inputHtml({k:"c_adopt_det", label:"입양(상세) — 통수", half:true});
        h+=A.inputHtml({k:"c_spadopt_gen", label:"친양자입양(일반) — 통수", half:true});
        h+=A.inputHtml({k:"c_spadopt_det", label:"친양자입양(상세) — 통수", half:true});
        return h; }},

    {n:8, short:"신고서류·제적", title:"신고서류 · 제적 증명서",
      when:advOn, kind:"advJeok",
      body:function(A){ var h='';
        h+=A.inputHtml({k:"c_doc", label:"신고서류기재사항증명 — 건수", half:true});
        h+=A.inputHtml({k:"c_accept", label:"수리·불수리증명 — 건수", half:true});
        h+=A.inputHtml({k:"c_jeok_deung", label:"제적 등본 — 통수", half:true});
        h+=A.inputHtml({k:"c_jeok_cho", label:"제적 초본 — 통수", half:true});
        h+=A.inputHtml({k:"c_jeok_view", label:"제적 열람 — 건수", half:true});
        h+='<div class="field-label" style="margin-top:8px">특정증명서 포함 항목</div>';
        h+='<div class="opts row">'+A.toggleHtml("spec_incReg","등록기준지 포함")
          +A.toggleHtml("spec_incBon","본(本) 포함")+'</div>';
        return h; }},

    {n:9, short:"신청인", title:"신청인 (신청하는 사람)",
      q:"이 신청서를 내는 사람의 정보를 입력하세요.",
      why:"본인이 직접 신청하면 신청인은 본인입니다. 가족이나 대리인이 대신 신청할 수도 있습니다. 서명·날인은 인쇄한 뒤 직접 하세요.",
      kind:"reporter",
      required:function(s){ var m=[];
        if(!String(s.ap_name||"").trim()) m.push("신청인 성명");
        return m; },
      body:function(A){ var h='';
        h+=A.inputHtml({k:"ap_name", label:"신청인 성명", req:true, ph:"장당정"});
        h+=A.inputHtml({k:"ap_jumin", label:"주민등록번호", type:"jumin", ph:"900101-0000000"});
        h+=A.inputHtml({k:"ap_qual", label:"신청인 자격", ph:"본인",
          help:"대상자 본인이면 ‘본인’. 가족이면 ‘장당정의 자녀’처럼 관계를 적습니다."});
        h+=A.inputHtml({k:"ap_addr", label:"주소", ph:"경기도 군포시 …"});
        h+=A.inputHtml({k:"ap_phone", label:"휴대전화번호", type:"phone", ph:"010-0000-0000"});
        h+='<div class="field"><label class="field-label">아포스티유 제출용 <span class="fb fb-opt">선택</span></label>'
          +'<div class="opts">'+A.toggleHtml("apostille","증명서 발급정보 전송에 동의")+'</div>'
          +'<div class="q-help">외국에 제출하는 아포스티유 신청일 때만 선택하세요.</div></div>';
        return h; }},

    {n:10, short:"위임·사유", title:"위임인 · 청구 사유 (선택)",
      q:"대리인이 신청하거나, 청구 사유·주민번호 공개가 필요할 때만 적으세요.",
      kind:"delegate",
      body:function(A){ var h='';
        h+='<div class="note-box">본인이 직접 신청하면 대부분 <b>비워 둡니다.</b></div>';
        h+='<div class="field-label">위임인 (대리 신청일 때)</div>';
        h+=A.inputHtml({k:"del_name", label:"위임인 성명", half:true,
          help:"대리로 신청받은 경우, 위임한 사람(본인)의 성명."});
        h+=A.inputHtml({k:"del_jumin", label:"위임인 주민등록번호", type:"jumin", half:true});
        h+='<div class="q-help">위임을 받은 경우 위임장은 별도로 첨부해야 합니다.</div>';
        h+='<div class="field-label" style="margin-top:8px">청구 사유 · 소명자료</div>';
        h+=A.inputHtml({k:"claim_reason", label:"청구사유", ph:"예: 가사소송 관련 법원 제출용",
          help:"대리·공용 목적일 때 구체적으로 적습니다."});
        h+=A.inputHtml({k:"proof_material", label:"소명자료", ph:"예: 법원 보정명령서"});
        h+='<div class="field-label" style="margin-top:8px">주민등록번호 공개신청 (필요 시)</div>';
        h+='<div class="field"><label class="field-label">공개 범위</label>'
          +A.choiceHtml("disc_scope",["전부 공개","신청대상자 본인만 공개"],"대상자 주민번호 뒷 6자리 공개가 필요할 때만 고릅니다.")+'</div>';
        h+='<div class="field"><label class="field-label">공개 사유</label>'
          +A.choiceHtml("disc_reason",["정확기재","본인·가족","재판소명","공용소명"],"해당하는 사유 하나를 고르세요.")+'</div>';
        return h; }},

    {n:11, short:"완료", title:"작성 내용 확인", q:"고르신 것만 다시 확인해 주세요.", kind:"summary",
      body:function(){
        return buildSummary();
      }}
  ],

  applySample:function(state, kind){
    Object.assign(state,{
      step:2,
      /* ⚠️ 대상자는 **1960년생**이다. 아래 `agent` 예시에서 **자녀가 대리 신청**하는데,
         종전에는 대상자가 1990년생이고 자녀가 1985년생이라 나이가 뒤집혀 있었다. */
      t_name:"장당정", t_nameHan:"張堂井",
      t_regBase:"경기도 군포시 산본로 000", t_jumin:"6001011000000",
      c_fam_gen:"1", c_bas_gen:"1", c_mar_gen:"",
      ap_name:"장당정", ap_jumin:"6001011000000", ap_qual:"본인",
      ap_addr:"경기도 군포시 산본로 000, 105동 802호", ap_phone:"01012345678"
    });
    if(kind==="agent"){
      // 대리 신청 — 자녀가 부(대상자)의 증명서를 대리 신청
      Object.assign(state,{
        c_fam_gen:"1", c_bas_gen:"", c_mar_gen:"1",
        ap_name:"장금정", ap_jumin:"9003152000000", ap_qual:"장당정의 자녀",
        ap_addr:"경기도 군포시 산본로 000, 302동 1104호", ap_phone:"01098765432",
        del_name:"장당정", del_jumin:"6001011000000",
        claim_reason:"부동산 상속 관련 은행 제출용",
        disc_scope:"신청대상자 본인만 공개", disc_reason:"본인·가족"
      });
    }
  }
};
