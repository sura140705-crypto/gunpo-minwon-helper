/* =====================================================================
   가족관계 등록사항별 증명서 교부 등 신청서 (별지 제11호) — FORM 설정
   engine/engine.js와 함께 build-form.js가 자체완결 HTML로 인라인한다.
   재생성: python tools/prep-bg.py cert "서식원본/[별지 제11호 서식]...pdf"
          node tools/build-form.js cert
   좌표계: PW=595 / PH=841 (PDF 포인트). 값 위치는 각 칸의 세로 중심.
   ===================================================================== */

/* 통수/건수 요약 행 (0통은 표시 안 함) */
function certRows(){
  var d=state;
  return [
    ["가족관계증명서(일반)", d.c_fam_gen, "통"],
    ["가족관계증명서(특정)", d.c_fam_spec, "통"],
    ["가족관계증명서(상세)", d.c_fam_det, "통"],
    ["기본증명서(일반)", d.c_bas_gen, "통"],
    ["기본증명서(상세)", d.c_bas_det, "통"],
    ["기본특정 · 출생·사망·실종", d.c_bas_s1, "통"],
    ["기본특정 · 인지·친생자관계정정", d.c_bas_s2, "통"],
    ["기본특정 · 친권·미성년후견", d.c_bas_s3, "통"],
    ["기본특정 · 개명·성본변경", d.c_bas_s4, "통"],
    ["기본특정 · 국적취득·상실", d.c_bas_s5, "통"],
    ["기본특정 · 성별정정", d.c_bas_s6, "통"],
    ["혼인관계증명서(일반)", d.c_mar_gen, "통"],
    ["혼인관계증명서(특정)", d.c_mar_spec, "통"],
    ["혼인관계증명서(상세)", d.c_mar_det, "통"],
    ["입양관계증명서(일반)", d.c_adopt_gen, "통"],
    ["입양관계증명서(상세)", d.c_adopt_det, "통"],
    ["친양자입양관계증명서(일반)", d.c_spadopt_gen, "통"],
    ["친양자입양관계증명서(상세)", d.c_spadopt_det, "통"],
    ["신고서류기재사항증명", d.c_doc, "건"],
    ["수리·불수리증명", d.c_accept, "건"],
    ["제적 등본", d.c_jeok_deung, "통"],
    ["제적 초본", d.c_jeok_cho, "통"],
    ["제적 열람", d.c_jeok_view, "건"]
  ];
}

function buildSummary(){
  var d=state, h='';
  h+='<div class="sum-sec"><h4>발급 대상자</h4>';
  h+=sumRow("성명", (d.t_name||"")+(d.t_nameHan?" ("+d.t_nameHan+")":""));
  h+=sumRow("등록기준지", d.t_regBase);
  h+=sumRow("주민등록번호", d.t_jumin?formatJumin(d.t_jumin):"");
  h+='</div>';
  h+='<div class="sum-sec"><h4>신청 증명서</h4>';
  var any='';
  certRows().forEach(function(r){ var n=digits(r[1]); if(n && +n>0) any+=sumRow(r[0], n+r[2]); });
  h+= any || '<div class="sum-row"><span class="val empty">(선택된 증명서가 없습니다)</span></div>';
  h+='</div>';
  h+='<div class="sum-sec"><h4>신청인</h4>';
  h+=sumRow("성명", d.ap_name);
  h+=sumRow("자격", d.ap_qual);
  h+=sumRow("전화", formatPhone(d.ap_phone));
  h+='</div>';
  if(d.del_name){
    h+='<div class="sum-sec"><h4>위임인</h4>'+sumRow("성명", d.del_name)
      +sumRow("주민등록번호", d.del_jumin?formatJumin(d.del_jumin):"")+'</div>';
  }
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
  rerenderOnSet:[],

  /* ⛔ **이 서식은 「가족관계등록 신고서」가 아니다.** 2026.08.29 담당자 확정본의
        공통 필수/선택 원칙(모든 사항 필수 · 등록기준지·본·한자만 선택 · 신고인란 필수)은
        **신고서 5종에만** 적용된다. 여기의 필수 조건은 **기존 업무규칙 그대로** 두고,
        새 필수 조건을 추정해 보태지 않는다.
     ⛔ 준비물도 담당자가 준 것이 없으므로 **비워 둔다** — 없으면 그 구역을 아예 내지 않는다.
        「신분증이 필요할 것이다」 같은 짐작으로 채우지 마라. */
  ready:[],

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
    ["ap_name","ap_jumin","ap_qual","ap_addr","ap_phone","del_name","del_jumin"]),

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

  STEP_HL:{
    2:[[119,124,545,199]],
    3:[[119,199,545,293]],
    4:[[119,217,545,399]],
    5:[[119,515,545,574]],
    6:[[119,399,545,515],[119,574,545,607]]
  },

  buildVals:function(state){
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
        h+=A.inputHtml({k:"t_name", label:"대상자 성명(한글)", req:true, half:true, ph:"홍길동"});
        h+=A.inputHtml({k:"t_nameHan", label:"성명(한자)", half:true, ph:"洪吉童"});
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

    {n:4, short:"그 밖의 증명서", title:"그 밖의 증명서 (선택)",
      q:"자세한 증명서나 입양·제적 등이 필요할 때만 적으세요. 대부분 비워 둡니다.",
      kind:"advanced",
      body:function(A){ var h='';
        h+='<div class="note-box">필요할 때만 적는 <b>선택</b> 항목입니다. 없으면 <b>[다음]</b>으로 넘어가세요.</div>';
        // 가족관계 상세·특정
        h+='<div class="field-label">가족관계증명서 — 상세·특정</div>';
        h+=A.inputHtml({k:"c_fam_det", label:"상세 — 통수", half:true, ph:""});
        h+=A.inputHtml({k:"c_fam_spec", label:"특정 — 통수", half:true, ph:""});
        h+='<div class="q-help">특정 증명서에 포함할 사람을 고르세요.</div>';
        h+='<div class="opts row">'+A.toggleHtml("famWhoFu","부")+A.toggleHtml("famWhoMo","모")
          +A.toggleHtml("famWhoSp","배우자")+A.toggleHtml("famWhoCh","자녀")+'</div>';
        if(A.state.famWhoCh) h+=A.inputHtml({k:"fam_child_name", label:"자녀 성명", ph:"홍자녀"});
        // 기본 상세·특정
        h+='<div class="field-label" style="margin-top:8px">기본증명서 — 상세·특정</div>';
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
        // 혼인 상세·특정
        h+='<div class="field-label" style="margin-top:8px">혼인관계증명서 — 상세·특정</div>';
        h+=A.inputHtml({k:"c_mar_det", label:"상세 — 통수", half:true});
        h+=A.inputHtml({k:"c_mar_spec", label:"특정 — 통수", half:true});
        h+=A.inputHtml({k:"mar_spec_ex", label:"전(前) 배우자 성명", ph:""});
        // 입양·친양자
        h+='<div class="field-label" style="margin-top:8px">입양·친양자입양 증명서</div>';
        h+=A.inputHtml({k:"c_adopt_gen", label:"입양(일반) — 통수", half:true});
        h+=A.inputHtml({k:"c_adopt_det", label:"입양(상세) — 통수", half:true});
        h+=A.inputHtml({k:"c_spadopt_gen", label:"친양자입양(일반) — 통수", half:true});
        h+=A.inputHtml({k:"c_spadopt_det", label:"친양자입양(상세) — 통수", half:true});
        // 신고서류·제적
        h+='<div class="field-label" style="margin-top:8px">신고서류 · 제적</div>';
        h+=A.inputHtml({k:"c_doc", label:"신고서류기재사항증명 — 건수", half:true});
        h+=A.inputHtml({k:"c_accept", label:"수리·불수리증명 — 건수", half:true});
        h+=A.inputHtml({k:"c_jeok_deung", label:"제적 등본 — 통수", half:true});
        h+=A.inputHtml({k:"c_jeok_cho", label:"제적 초본 — 통수", half:true});
        h+=A.inputHtml({k:"c_jeok_view", label:"제적 열람 — 건수", half:true});
        // 특정증명서 포함 옵션
        h+='<div class="field-label" style="margin-top:8px">특정증명서 포함 항목</div>';
        h+='<div class="opts row">'+A.toggleHtml("spec_incReg","등록기준지 포함")
          +A.toggleHtml("spec_incBon","본(本) 포함")+'</div>';
        return h; }},

    {n:5, short:"신청인", title:"신청인 (신청하는 사람)",
      q:"이 신청서를 내는 사람의 정보를 입력하세요.",
      why:"본인이 직접 신청하면 신청인은 본인입니다. 가족이나 대리인이 대신 신청할 수도 있습니다. 서명·날인은 인쇄한 뒤 직접 하세요.",
      kind:"reporter",
      required:function(s){ var m=[];
        if(!String(s.ap_name||"").trim()) m.push("신청인 성명");
        return m; },
      body:function(A){ var h='';
        h+=A.inputHtml({k:"ap_name", label:"신청인 성명", req:true, ph:"홍길동"});
        h+=A.inputHtml({k:"ap_jumin", label:"주민등록번호", type:"jumin", ph:"900101-0000000"});
        h+=A.inputHtml({k:"ap_qual", label:"신청인 자격", ph:"본인",
          help:"대상자 본인이면 ‘본인’. 가족이면 ‘홍길동의 자녀’처럼 관계를 적습니다."});
        h+=A.inputHtml({k:"ap_addr", label:"주소", ph:"경기도 군포시 …"});
        h+=A.inputHtml({k:"ap_phone", label:"휴대전화번호", type:"phone", ph:"010-0000-0000"});
        h+='<div class="field"><label class="field-label">아포스티유 제출용 <span class="fb fb-opt">선택</span></label>'
          +'<div class="opts">'+A.toggleHtml("apostille","증명서 발급정보 전송에 동의")+'</div>'
          +'<div class="q-help">외국에 제출하는 아포스티유 신청일 때만 선택하세요.</div></div>';
        return h; }},

    {n:6, short:"위임·사유", title:"위임인 · 청구 사유 (선택)",
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

    {n:7, short:"완료", title:"작성 내용 확인", q:"입력한 내용을 확인하세요.", kind:"summary",
      body:function(){
        return buildSummary()
          +'<div class="info-box">인쇄한 뒤, 신청인이 서명·날인을 직접 하여 민원실에 제출하세요. '
          +'신분증을 함께 준비하고, 대리 신청은 위임장과 대리인 신분증이 필요합니다. '
          +'수수료는 증명서 1통당 1,000원(제적초본 500원, 열람·증명 1건당 200원)입니다.</div>';
      }}
  ],

  applySample:function(state, kind){
    Object.assign(state,{
      step:2,
      t_name:"홍길동", t_nameHan:"洪吉童",
      t_regBase:"경기도 군포시 산본로 000", t_jumin:"9001011000000",
      c_fam_gen:"1", c_bas_gen:"1", c_mar_gen:"",
      ap_name:"홍길동", ap_jumin:"9001011000000", ap_qual:"본인",
      ap_addr:"경기도 군포시 산본로 000, 101동 1001호", ap_phone:"01012345678"
    });
    if(kind==="agent"){
      // 대리 신청 — 자녀가 부(대상자)의 증명서를 대리 신청
      Object.assign(state,{
        c_fam_gen:"1", c_bas_gen:"", c_mar_gen:"1",
        ap_name:"홍길순", ap_jumin:"8503152000000", ap_qual:"홍길동의 자녀",
        ap_addr:"경기도 군포시 번영로 000", ap_phone:"01098765432",
        del_name:"홍길동", del_jumin:"9001011000000",
        claim_reason:"부동산 상속 관련 은행 제출용",
        disc_scope:"신청대상자 본인만 공개", disc_reason:"본인·가족"
      });
    }
  }
};
