/* =====================================================================
   부동산거래계약 신고서 (부동산 거래신고 등에 관한 법률 시행규칙 별지 제1호서식,
   개정 2026. 2. 6.) — FORM 설정
   engine/engine.js와 함께 build-form.js가 자체완결 HTML로 인라인한다.
   재생성: python tools/prep-bg.py realestate "부동산거래계약 신고서.pdf"
          node tools/build-form.js realestate
   좌표계: PW=595 / PH=841 (PDF 포인트). 값 위치는 각 칸의 빈 공간 중심.

   ⚠️ ①매도인·②매수인의 「주민등록번호(법인ㆍ외국인등록번호)」 칸은 서식의 라벨이
      칸 폭(288.8→460.2)의 거의 전부(291.8→453.1)를 차지해 라벨 오른쪽에 7pt밖에
      남지 않는다(서식 자체의 한계). 그래서 값은 라벨 바로 아래 줄, 같은 열 중앙에
      배치한다(주소 칸 윗줄). 주소 값은 아래 줄로 내려 겹치지 않게 했다.
      cf. 개업공인중개사 칸은 같은 라벨이지만 폭이 넓어(63pt) 라벨 오른쪽에 정상 배치.
   ===================================================================== */

/* 금액 → 한글 읽기 ("350000000" → "3억 5,000만원") — 0 자릿수 실수 방지용 */
function moneyKor(v){
  var n=digits(v).replace(/^0+(?=\d)/,"");
  if(!n || n.length>15) return "";
  var rest=Number(n), out="";
  [[1e12,"조"],[1e8,"억"],[1e4,"만"]].forEach(function(u){
    var q=Math.floor(rest/u[0]);
    if(q){ out+=(out?" ":"")+formatMoney(String(q))+u[1]; rest-=q*u[0]; }
  });
  if(rest) out+=(out?" ":"")+formatMoney(String(rest));
  return out?out+"원":"";
}
/* 금액 입력칸 + 한글 읽기 안내 (0 하나 더/덜 입력하는 실수 방지) */
function moneyField(A,f){
  f.type="money";                       // 입력칸에 3자리 콤마 자동
  var h=A.inputHtml(f), kor=moneyKor(A.state[f.k]);
  if(kor){                              // 입력칸 바로 아래(= 마지막 </div> 앞)에 붙인다
    var i=h.lastIndexOf("</div>");
    h=h.slice(0,i)+'<div class="q-help money-kor">= '+A.esc(kor)+'</div>'+h.slice(i);
  }
  return h;
}
function isPrevNeeded(){ return state.d_rightKind==="입주권"; }

function buildSummary(){
  var d=state, h='';
  h+='<div class="sum-sec"><h4>① 매도인</h4>';
  h+=sumRow("성명(법인명)", d.s_name);
  h+=sumRow("주민등록번호", d.s_jumin?formatJumin(d.s_jumin):"");
  h+=sumRow("주소", d.s_addr);
  h+=sumRow("휴대전화", formatPhone(d.s_mobile));
  h+='</div>';
  h+='<div class="sum-sec"><h4>② 매수인</h4>';
  h+=sumRow("성명(법인명)", d.b_name);
  h+=sumRow("주민등록번호", d.b_jumin?formatJumin(d.b_jumin):"");
  h+=sumRow("주소", d.b_addr);
  h+=sumRow("휴대전화", formatPhone(d.b_mobile));
  if(d.b_isForeign) h+=sumRow("외국인 매수용도", d.f_use);
  h+='</div>';
  if(d.hasAgent){
    h+='<div class="sum-sec"><h4>개업공인중개사</h4>';
    h+=sumRow("성명(법인명)", d.a_name);
    h+=sumRow("상호", d.a_office);
    h+=sumRow("등록번호", d.a_regno);
    h+='</div>';
  }
  h+='<div class="sum-sec"><h4>거래대상</h4>';
  h+=sumRow("종류", d.d_kind+(d.d_bldgKind?" ("+d.d_bldgKind+")":""));
  if(d.d_supply) h+=sumRow("계약 종류", d.d_supply+(d.d_rightKind?" · "+d.d_rightKind:"")+(d.d_stage?" · "+d.d_stage:""));
  h+=sumRow("소재지", d.p_addr);
  h+=sumRow("계약대상 면적", [d.c_landArea?"토지 "+d.c_landArea+"㎡":"", d.c_bldgArea?"건축물 "+d.c_bldgArea+"㎡":""].filter(Boolean).join(" / "));
  h+='</div>';
  h+='<div class="sum-sec"><h4>거래가격</h4>';
  h+=sumRow("물건별 거래가격", d.pr_item?formatMoney(d.pr_item)+"원":"");
  h+=sumRow("총 실제거래가격(합계)", d.pr_total?formatMoney(d.pr_total)+"원":"");
  if(d.pr_total) h+=sumRow("", moneyKor(d.pr_total));
  h+=sumRow("계약금", d.pr_down?formatMoney(d.pr_down)+"원":"");
  h+=sumRow("계약 체결일", d.dt_contract);
  h+=sumRow("중도금 / 지급일", [d.pr_mid?formatMoney(d.pr_mid)+"원":"", d.dt_mid].filter(Boolean).join(" / "));
  h+=sumRow("잔금 / 지급일", [d.pr_bal?formatMoney(d.pr_bal)+"원":"", d.dt_bal].filter(Boolean).join(" / "));
  h+='</div>';
  if(isPrevNeeded()){
    h+='<div class="sum-sec"><h4>⑩ 종전 부동산</h4>';
    h+=sumRow("소재지", d.v_addr);
    h+=sumRow("거래금액 합계", d.v_total?formatMoney(d.v_total)+"원":"");
    h+='</div>';
  }
  return h;
}

var FORM={
  docTitle:"부동산거래계약 신고서 작성 미리보기 도우미",
  formName:"부동산거래계약 신고서",
  org:{ orgName:"경기도 군포시", officeName:"군포시청 민원실" },
  sampleLabels:["작성예시(아파트 매매)","작성예시(입주권 전매)"],
  sampleKinds:["apt","right"],
  /* 이 서식은 머리말이 "[  ]에는 해당하는 곳에 √표를 합니다" — 영표(○)가 아니라 체크,
     색도 신고서 5종의 빨간 영표와 달리 검정으로 표기한다. */
  checkMark:"✔", checkSize:8, checkBlack:true,
  /* 선택 즉시 조건부 입력칸이 나타나야 하는 항목 */
  rerenderOnSet:["d_kind","d_supply","d_rightKind","f_visaType"],

  stateKeys:[].concat(
    // ① 매도인 / ② 매수인
    ["s_name","s_jumin","s_natl","s_addr","s_shareDen","s_shareNum","s_phone","s_mobile"],
    ["b_name","b_jumin","b_natl","b_addr","b_shareDen","b_shareNum","b_phone","b_mobile"],
    // ③ 법인신고서등
    ["corpDoc"],
    // 외국인 매수인 전용 · 위탁관리인
    ["b_isForeign","f_use","f_visaType","f_visaCode","f_resident",
     "t_name","t_jumin","t_addr","t_phone","t_mobile"],
    // 개업공인중개사
    ["hasAgent","a_name","a_jumin","a_phone","a_mobile","a_office","a_regno","a_addr"],
    // ④⑤ 거래대상 종류 · 계약 종류
    ["d_kind","d_bldgKind","d_supply","d_rightKind","d_stage","d_rentConv"],
    // ⑥ 소재지·지목·면적 / ⑦ 계약대상 면적
    ["p_addr","p_jimok","p_landArea","p_landShareDen","p_landShareNum",
     "p_daejiDen","p_daejiNum","p_bldgArea","p_bldgShareDen","p_bldgShareNum",
     "c_landArea","c_bldgArea"],
    // ⑧ 물건별 거래가격 / ⑨ 총 실제거래가격
    ["pr_item","pr_supply","pr_balcony","pr_extra",
     "pr_total","pr_down","dt_contract","pr_mid","dt_mid","pr_bal","dt_bal"],
    // ⑩ 종전 부동산
    ["v_addr","v_jimok","v_landArea","v_landShareDen","v_landShareNum",
     "v_daejiDen","v_daejiNum","v_bldgArea","v_bldgShareDen","v_bldgShareNum",
     "v_cLandArea","v_cBldgArea","v_bldgType",
     "v_total","v_extra","v_right","v_down","v_mid","v_bal"],
    // ⑪ 계약의 조건 및 참고사항
    ["memo"]),

  CO:{
    texts:{
      // ── ① 매도인 (행 115.8~165.2) ──
      "s_name":{x:230,y:122.7,a:"c",size:8},
      "s_jumin":{x:375,y:134.5,a:"c",size:6.5,nb:true},   // 라벨 아래 줄(위 주석 참고)
      "s_natl":{x:512,y:122.7,a:"c",size:7},
      "s_addr":{x:195,y:145.8,a:"l",size:7,w:225},
      "s_shareDen":{x:465,y:145.8,a:"c",size:6.5,nb:true},
      "s_shareNum":{x:517,y:145.8,a:"c",size:6.5,nb:true},
      "s_phone":{x:236,y:158.3,a:"c",size:7.5},
      "s_mobile":{x:461,y:158.3,a:"c",size:7.5},
      // ── ② 매수인 (행 165.2~214.6) ──
      "b_name":{x:230,y:172.1,a:"c",size:8},
      "b_jumin":{x:375,y:183.9,a:"c",size:6.5,nb:true},
      "b_natl":{x:512,y:172.1,a:"c",size:7},
      "b_addr":{x:195,y:195.2,a:"l",size:7,w:225},
      "b_shareDen":{x:465,y:195.2,a:"c",size:6.5,nb:true},
      "b_shareNum":{x:517,y:195.2,a:"c",size:6.5,nb:true},
      "b_phone":{x:236,y:207.7,a:"c",size:7.5},
      "b_mobile":{x:461,y:207.7,a:"c",size:7.5},
      // ── 외국인 전용: 체류자격 비자코드 ──
      "f_visaCode":{x:438,y:263.3,a:"c",size:7},
      // ── 위탁관리인 ──
      "t_name":{x:297,y:298.9,a:"c",size:7},
      "t_jumin":{x:458,y:298.9,a:"c",size:7.5},
      "t_addr":{x:281,y:311.6,a:"l",size:7,w:255},
      // 전화번호 칸은 라벨이 폭(255.9→317.1)의 대부분을 써 옆에 22pt뿐 → 라벨 윗줄에 배치
      "t_phone":{x:286,y:321.6,a:"c",size:5.5,nb:true},
      "t_mobile":{x:458,y:330.3,a:"c",size:7.5},
      // ── 개업공인중개사 ──
      "a_name":{x:245,y:346.7,a:"c",size:8},
      "a_jumin":{x:510,y:346.7,a:"c",size:6.5,nb:true},
      "a_phone":{x:237,y:360.6,a:"c",size:7.5},
      "a_mobile":{x:461,y:360.6,a:"c",size:7.5},
      "a_office":{x:227,y:374.4,a:"c",size:7.5},
      "a_regno":{x:451,y:374.4,a:"c",size:7.5},
      "a_addr":{x:186,y:388.2,a:"l",size:7,w:350},
      // ── ④ 종류: 건축물 종류 ( ) 두 곳 (선택에 따라 하나만 채움) ──
      "d_bldgKind1":{x:344,y:402.0,a:"c",size:6.5,nb:true},   // [ ]건축물 (   )
      "d_bldgKind2":{x:503,y:402.0,a:"c",size:6.5,nb:true},   // [ ]토지 및 건축물 (   )
      // ── ⑥ 소재지/지목/면적 ──
      "p_addr":{x:237,y:438.1,a:"l",size:7,w:300},
      "p_jimok":{x:267,y:451.8,a:"c",size:7},
      "p_landArea":{x:395,y:458.79,a:"r",size:7,nb:true},
      "p_landShareDen":{x:447,y:459.9,a:"c",size:6.5,nb:true},
      "p_landShareNum":{x:499,y:459.9,a:"c",size:6.5,nb:true},
      "p_daejiDen":{x:233,y:480.3,a:"c",size:6.5,nb:true},
      "p_daejiNum":{x:282,y:480.3,a:"c",size:6.5,nb:true},
      "p_bldgArea":{x:395,y:479.67,a:"r",size:7,nb:true},
      "p_bldgShareDen":{x:449,y:480.8,a:"c",size:6.5,nb:true},
      "p_bldgShareNum":{x:502,y:480.8,a:"c",size:6.5,nb:true},
      // ── ⑦ 계약대상 면적 ──
      "c_landArea":{x:286,y:493.47,a:"r",size:7.5,nb:true},
      "c_bldgArea":{x:407,y:493.47,a:"r",size:7.5,nb:true},
      // ── ⑧ 물건별 거래가격 ──
      "pr_item":{x:395,y:506.79,a:"r",size:8,nb:true},
      "pr_supply":{x:321,y:529.6,a:"r",size:7,nb:true},     // 분양가격
      "pr_balcony":{x:437,y:529.6,a:"r",size:7,nb:true},    // 발코니 확장 등 선택비용
      "pr_extra":{x:524,y:527.6,a:"r",size:7,nb:true},      // 추가 지급액 등
      // ── ⑨ 총 실제거래가격 ──
      "pr_total":{x:187,y:560.19,a:"r",size:8,nb:true},
      "pr_down":{x:336,y:542.43,a:"r",size:7.5,nb:true},
      "dt_contract":{x:498,y:541.9,a:"c",size:7,nb:true},
      "pr_mid":{x:336,y:555.27,a:"r",size:7.5,nb:true},
      "dt_mid":{x:498,y:554.7,a:"c",size:7,nb:true},
      "pr_bal":{x:336,y:568.11,a:"r",size:7.5,nb:true},
      "dt_bal":{x:498,y:567.5,a:"c",size:7,nb:true},
      // ── ⑩ 종전 부동산 (입주권 매매일 때만) ──
      "v_addr":{x:237,y:580.3,a:"l",size:7,w:300},
      "v_jimok":{x:267,y:593.7,a:"c",size:7},
      "v_landArea":{x:395,y:600.75,a:"r",size:7,nb:true},
      "v_landShareDen":{x:447,y:601.4,a:"c",size:6.5,nb:true},
      "v_landShareNum":{x:499,y:601.4,a:"c",size:6.5,nb:true},
      "v_daejiDen":{x:233,y:621.2,a:"c",size:6.5,nb:true},
      "v_daejiNum":{x:282,y:621.2,a:"c",size:6.5,nb:true},
      "v_bldgArea":{x:395,y:620.55,a:"r",size:7,nb:true},
      "v_bldgShareDen":{x:447,y:621.2,a:"c",size:6.5,nb:true},
      "v_bldgShareNum":{x:499,y:621.2,a:"c",size:6.5,nb:true},
      "v_cLandArea":{x:285,y:633.39,a:"r",size:7,nb:true},
      "v_cBldgArea":{x:393,y:633.39,a:"r",size:7,nb:true},
      "v_bldgType":{x:494,y:633.39,a:"c",size:6.5,nb:true},
      "v_total":{x:294,y:653.19,a:"r",size:7,nb:true},
      "v_extra":{x:395,y:654.0,a:"r",size:6.5,nb:true},
      "v_right":{x:524,y:652.11,a:"r",size:7,nb:true},
      "v_down":{x:294,y:672.03,a:"r",size:7,nb:true},
      "v_mid":{x:395,y:672.03,a:"r",size:7,nb:true},
      "v_bal":{x:524,y:672.03,a:"r",size:7,nb:true},
      // ── ⑪ 계약의 조건 및 참고사항 ──
      "memo":{x:204,y:684.2,a:"l",size:7,w:330,wrap:true},
      // ── 신고인 서명란 (인쇄 후 직접 서명·날인) ──
      "sign_seller":{x:310,y:734.9,a:"l",size:8},
      "sign_buyer":{x:310,y:745.0,a:"l",size:8},
      "sign_agent":{x:344,y:755.0,a:"l",size:8}
    },
    checks:{
      // ③ 법인신고서등
      "corpDoc":{"제출":[245.4,222.1],"별도 제출":[325.5,222.1],"해당 없음":[430.5,222.1]},
      // 외국인의 부동산등 매수용도
      "f_use":{"주거용(아파트)":[265.5,238.3],"주거용(단독주택)":[346.2,238.3],
               "주거용(그 밖의 주택)":[438.0,238.3],"레저용":[265.2,248.3],
               "상업용":[334.8,248.3],"공업용":[414.9,248.3],"그 밖의 용도":[473.9,248.3]},
      // 체류자격 (비자코드 / 무비자)
      "f_visaType":{"비자코드":[344.8,264.0],"무비자":[497.9,264.0]},
      // 국내 주소·183일 이상 거소 여부
      "f_resident":{"있음":[347.8,282.2],"없음":[392.8,282.2]},
      // ④ 거래대상 종류
      "d_kind":{"토지":[224.4,402.4],"건축물":[273.2,402.4],"토지 및 건축물":[395.5,402.4]},
      // ⑤ 공급계약 / 전매
      "d_supply":{"공급계약":[224.1,420.6],"전매":[282.9,420.6]},
      "d_rightKind":{"분양권":[321.5,420.6],"입주권":[371.9,420.6]},
      "d_stage":{"준공 전":[434.2,415.7],"준공 후":[494.2,415.7]}
    },
    attend:{
      // 임대주택 분양전환
      "d_rentConv":[434.2,425.6]
    }
  },

  /* 선택 ○ 표시를 조건부로 숨김 (해당 없는 항목을 껐을 때 잔상 방지) */
  checkVisible:function(field, s){
    if(field==="f_use"||field==="f_visaType"||field==="f_resident") return !!s.b_isForeign;
    if(field==="d_rightKind") return s.d_supply==="전매";
    if(field==="d_stage") return s.d_supply==="공급계약";
    return true;
  },

  STEP_HL:{
    2:[[50.6,115.8,541.7,165.2]],
    3:[[50.6,165.2,541.7,214.6]],
    4:[[113.7,228.3,541.7,339.8]],
    5:[[50.6,339.8,541.7,395.1]],
    6:[[113.7,395.1,541.7,431.6]],
    7:[[113.7,431.6,541.7,499.9]],
    8:[[113.7,499.9,541.7,573.9]],
    9:[[50.6,573.9,541.7,677.7]],
    10:[[113.7,214.6,541.7,228.3],[50.6,677.7,541.7,690.6]]
  },

  buildVals:function(state){
    var d=state, v={};
    // 자유 텍스트 (그대로)
    ["s_name","s_natl","s_addr","b_name","b_natl","b_addr",
     "t_name","t_addr","a_name","a_office","a_regno","a_addr",
     "f_visaCode","p_addr","p_jimok","v_addr","v_jimok","v_bldgType","memo",
     "dt_contract","dt_mid","dt_bal"
    ].forEach(function(k){ v[k]=d[k]||""; });
    // 숫자만 (지분·면적)
    ["s_shareDen","s_shareNum","b_shareDen","b_shareNum",
     "p_landArea","p_landShareDen","p_landShareNum","p_daejiDen","p_daejiNum",
     "p_bldgArea","p_bldgShareDen","p_bldgShareNum","c_landArea","c_bldgArea",
     "v_landArea","v_landShareDen","v_landShareNum","v_daejiDen","v_daejiNum",
     "v_bldgArea","v_bldgShareDen","v_bldgShareNum","v_cLandArea","v_cBldgArea"
    ].forEach(function(k){ v[k]=d[k]||""; });
    // 금액 — 3자리 콤마
    ["pr_item","pr_supply","pr_balcony","pr_extra","pr_total","pr_down","pr_mid","pr_bal",
     "v_total","v_extra","v_right","v_down","v_mid","v_bal"
    ].forEach(function(k){ v[k]=formatMoney(d[k]); });
    // 주민등록번호(법인·외국인등록번호) — 6-7 하이픈
    ["s_jumin","b_jumin","t_jumin","a_jumin"].forEach(function(k){ v[k]=d[k]?formatJumin(d[k]):""; });
    // 전화번호
    ["s_phone","s_mobile","b_phone","b_mobile","t_phone","t_mobile","a_phone","a_mobile"
    ].forEach(function(k){ v[k]=formatPhone(d[k]); });
    // ④ 건축물 종류 — 선택한 쪽의 ( )에만 기입
    v.d_bldgKind1 = (d.d_kind==="건축물") ? (d.d_bldgKind||"") : "";
    v.d_bldgKind2 = (d.d_kind==="토지 및 건축물") ? (d.d_bldgKind||"") : "";
    // 외국인 전용 칸은 외국인 매수인일 때만 출력
    if(!d.b_isForeign){ v.f_visaCode=""; v.t_name=""; v.t_jumin=""; v.t_addr=""; v.t_phone=""; v.t_mobile=""; }
    // 개업공인중개사 중개가 아니면 중개사 칸 비움
    if(!d.hasAgent){ ["a_name","a_jumin","a_phone","a_mobile","a_office","a_regno","a_addr"]
      .forEach(function(k){ v[k]=""; }); }
    // ⑩ 종전 부동산은 입주권 매매일 때만
    if(d.d_rightKind!=="입주권"){
      ["v_addr","v_jimok","v_landArea","v_landShareDen","v_landShareNum","v_daejiDen","v_daejiNum",
       "v_bldgArea","v_bldgShareDen","v_bldgShareNum","v_cLandArea","v_cBldgArea","v_bldgType",
       "v_total","v_extra","v_right","v_down","v_mid","v_bal"].forEach(function(k){ v[k]=""; });
    }
    // 신고인 서명란 이름
    v.sign_seller=d.s_name||"";
    v.sign_buyer=d.b_name||"";
    v.sign_agent=d.hasAgent?(d.a_name||""):"";
    return v;
  },

  /* 인쇄 후 서명·날인해야 하는 자리 = 우측 「(서명 또는 인)」 칸.
     이름 옆이 아니라 이 괄호 위에 직접 서명·날인한다(실측 x 466.1~516.7). */
  signatureHI:function(v){
    var HI=[];
    if(v.sign_seller) HI.push([464.5,735.6,518.5,744.0]);   // 매도인
    if(v.sign_buyer)  HI.push([464.5,743.7,518.5,752.0]);   // 매수인
    if(v.sign_agent)  HI.push([464.5,751.8,518.5,760.3]);   // 개업공인중개사
    return HI;
  },

  /* 신고일 — "  년      월      일" */
  today:{y:723.2, yx:445, mx:481, dx:517},

  STEPS:[
    {n:1, short:"시작", title:"부동산거래계약 신고서 작성 시작",
      q:"함께 한 단계씩 채워 볼까요?",
      why:"부동산 매매계약을 맺으면 계약 체결일부터 30일 안에 시·군·구청에 신고해야 합니다. 신고하지 않거나 거짓으로 신고하면 과태료가 부과됩니다.",
      kind:"intro",
      body:function(){
        return '<div class="note-box">이 도구는 <b>미리보기</b>이며, 실제 접수는 담당 직원의 확인을 따릅니다. '
          +'입력 내용은 저장되지 않습니다.</div>'
          +'<div class="note-box">준비물 : <b>부동산 거래계약서</b>, 매도인·매수인 신분증, '
          +'계약금 지급을 확인할 수 있는 서류(단독신고·중개사 신고 시). '
          +'인터넷(<b>rtms.molit.go.kr</b>)으로도 신고할 수 있습니다.</div>'
          +'<div class="opts"><button type="button" class="opt sel" data-next="1">시작하기 →</button></div>';
      }},

    {n:2, short:"매도인", title:"① 매도인 (파는 사람)",
      q:"부동산을 파는 사람의 정보를 입력하세요.",
      why:"거래계약서에 적힌 매도인과 같아야 합니다. 법인이면 법인명·법인등록번호·법인소재지를 적습니다.",
      kind:"fields",
      required:function(s){ var m=[];
        if(!String(s.s_name||"").trim()) m.push("매도인 성명");
        if(!String(s.s_addr||"").trim()) m.push("매도인 주소");
        return m; },
      body:function(A){ var h='';
        h+=A.inputHtml({k:"s_name", label:"성명(법인명)", req:true, ph:"홍길동"});
        h+=A.inputHtml({k:"s_jumin", label:"주민등록번호(법인·외국인등록번호)", type:"jumin", ph:"900101-0000000"});
        h+=A.inputHtml({k:"s_addr", label:"주소(법인소재지)", req:true, ph:"경기도 군포시 …"});
        h+=A.inputHtml({k:"s_natl", label:"국적", half:true, ph:"대한민국",
          help:"외국인일 때만 반드시 적습니다."});
        h+=A.inputHtml({k:"s_phone", label:"전화번호", type:"phone", half:true, ph:"031-000-0000"});
        h+=A.inputHtml({k:"s_mobile", label:"휴대전화번호", type:"phone", ph:"010-0000-0000"});
        h+='<div class="field-label" style="margin-top:8px">거래지분 비율 <span class="fb fb-opt">선택</span></div>';
        h+='<div class="q-help">여러 명이 함께 사고파는 경우에만 적습니다. 혼자면 비워 두세요. '
          +'예) 2분의 1 → 왼쪽 2, 오른쪽 1</div>';
        h+=A.inputHtml({k:"s_shareDen", label:"( ○○ 분의", half:true, ph:"2"});
        h+=A.inputHtml({k:"s_shareNum", label:"○○ )", half:true, ph:"1"});
        return h; }},

    {n:3, short:"매수인", title:"② 매수인 (사는 사람)",
      q:"부동산을 사는 사람의 정보를 입력하세요.",
      why:"매도인과 매수인의 거래지분 비율은 서로 일치해야 합니다.",
      kind:"fields",
      required:function(s){ var m=[];
        if(!String(s.b_name||"").trim()) m.push("매수인 성명");
        if(!String(s.b_addr||"").trim()) m.push("매수인 주소");
        return m; },
      body:function(A){ var h='';
        h+=A.inputHtml({k:"b_name", label:"성명(법인명)", req:true, ph:"김철수"});
        h+=A.inputHtml({k:"b_jumin", label:"주민등록번호(법인·외국인등록번호)", type:"jumin", ph:"850315-0000000"});
        h+=A.inputHtml({k:"b_addr", label:"주소(법인소재지)", req:true, ph:"경기도 군포시 …"});
        h+=A.inputHtml({k:"b_natl", label:"국적", half:true, ph:"대한민국"});
        h+=A.inputHtml({k:"b_phone", label:"전화번호", type:"phone", half:true, ph:"031-000-0000"});
        h+=A.inputHtml({k:"b_mobile", label:"휴대전화번호", type:"phone", ph:"010-0000-0000"});
        h+='<div class="field-label" style="margin-top:8px">거래지분 비율 <span class="fb fb-opt">선택</span></div>';
        h+='<div class="q-help">매도인과 같은 비율로 적습니다. 혼자면 비워 두세요.</div>';
        h+=A.inputHtml({k:"b_shareDen", label:"( ○○ 분의", half:true, ph:"2"});
        h+=A.inputHtml({k:"b_shareNum", label:"○○ )", half:true, ph:"1"});
        return h; }},

    {n:4, short:"외국인", title:"매수인이 외국인일 때만",
      q:"매수인이 외국인인가요? 아니라면 그대로 [다음]을 누르세요.",
      why:"외국인이 부동산을 사는 경우에만 매수용도·체류자격·국내 거소 여부를 적습니다. 국내에 주소나 183일 이상 거소가 없으면 위탁관리인도 적어야 합니다.",
      kind:"foreign",
      body:function(A){ var h='';
        h+='<div class="opts">'+A.toggleHtml("b_isForeign","매수인이 외국인입니다")+'</div>';
        if(!A.state.b_isForeign)
          return h+'<div class="note-box">해당하지 않으면 <b>[다음]</b>으로 넘어가세요.</div>';
        h+='<div class="field"><label class="field-label">부동산등 매수용도</label>'
          +A.choiceHtml("f_use",["주거용(아파트)","주거용(단독주택)","주거용(그 밖의 주택)",
            "레저용","상업용","공업용","그 밖의 용도"],"하나만 고르세요.")+'</div>';
        h+='<div class="field"><label class="field-label">체류자격</label>'
          +A.choiceHtml("f_visaType",["비자코드","무비자"],"")+'</div>';
        if(A.state.f_visaType==="비자코드")
          h+=A.inputHtml({k:"f_visaCode", label:"비자코드", ph:"F-2"});
        h+='<div class="field"><label class="field-label">국내에 주소를 두거나 183일 이상 거소를 두고 있는지</label>'
          +A.choiceHtml("f_resident",["있음","없음"],"")+'</div>';
        if(A.state.f_resident==="없음"){
          h+='<div class="field-label" style="margin-top:8px">위탁관리인 (국내에 주소·거소가 없는 경우)</div>';
          h+=A.inputHtml({k:"t_name", label:"성명", half:true});
          h+=A.inputHtml({k:"t_jumin", label:"주민등록번호", type:"jumin", half:true});
          h+=A.inputHtml({k:"t_addr", label:"주소"});
          h+=A.inputHtml({k:"t_phone", label:"전화번호", type:"phone", half:true});
          h+=A.inputHtml({k:"t_mobile", label:"휴대전화번호", type:"phone", half:true});
        }
        return h; }},

    {n:5, short:"중개사", title:"개업공인중개사 (중개 시)",
      q:"공인중개사를 통해 거래했나요? 직거래라면 그대로 [다음]을 누르세요.",
      why:"중개사가 중개한 거래는 중개사가 신고 의무자입니다. 매도인·매수인끼리 직접 거래(직거래)했다면 두 사람이 함께 신고합니다.",
      kind:"agent",
      required:function(s){ var m=[];
        if(s.hasAgent){
          if(!String(s.a_name||"").trim()) m.push("개업공인중개사 성명");
          if(!digits(s.a_phone)) m.push("개업공인중개사 전화번호(사무실)");
        }
        return m; },
      body:function(A){ var h='';
        h+='<div class="opts">'+A.toggleHtml("hasAgent","개업공인중개사가 중개했습니다")+'</div>';
        if(!A.state.hasAgent)
          return h+'<div class="note-box">직거래는 <b>매도인과 매수인이 함께</b> 신고합니다. '
            +'한쪽이 신고를 거부하면 단독으로 신고할 수 있고, 이때는 <b>단독신고사유서</b>를 첨부합니다.</div>';
        h+=A.inputHtml({k:"a_name", label:"성명(법인명)", req:true, ph:"박중개"});
        h+=A.inputHtml({k:"a_jumin", label:"주민등록번호(법인등록번호)", type:"jumin"});
        h+=A.inputHtml({k:"a_office", label:"상호", half:true, ph:"○○공인중개사사무소"});
        h+=A.inputHtml({k:"a_regno", label:"등록번호", half:true, ph:"41410-2026-00000"});
        h+=A.inputHtml({k:"a_addr", label:"사무소 소재지", ph:"경기도 군포시 …"});
        h+=A.inputHtml({k:"a_phone", label:"전화번호 (사무실)", type:"phone", req:true, ph:"031-000-0000",
          help:"사무소 전화번호는 반드시 적어야 합니다. 휴대전화번호로 대신할 수 없습니다."});
        h+=A.inputHtml({k:"a_mobile", label:"휴대전화번호", type:"phone", half:true});
        return h; }},

    {n:6, short:"거래대상", title:"④⑤ 무엇을 거래했나요?",
      q:"거래한 부동산의 종류와 계약의 종류를 고르세요.",
      why:"아파트를 샀다면 대개 ‘토지 및 건축물’이고, 건축물 종류에 ‘아파트’라고 적습니다. 분양받은 새 아파트라면 ‘공급계약’, 분양권·입주권을 넘겨받았다면 ‘전매’입니다.",
      kind:"kind",
      required:function(s){ return String(s.d_kind||"").trim()?[]:["거래대상 종류"]; },
      body:function(A){ var h='';
        h+='<div class="field"><label class="field-label">④ 종류<span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("d_kind",["토지","건축물","토지 및 건축물"],
            "아파트·빌라·단독주택은 대부분 ‘토지 및 건축물’입니다.")+'</div>';
        if(A.state.d_kind==="건축물" || A.state.d_kind==="토지 및 건축물")
          h+=A.inputHtml({k:"d_bldgKind", label:"건축물의 종류", ph:"아파트",
            help:"아파트, 연립, 다세대, 단독, 다가구, 오피스텔, 근린생활시설, 사무소, 공장 등"});
        h+='<div class="field" style="margin-top:8px"><label class="field-label">⑤ 공급계약 · 전매 <span class="fb fb-opt">선택</span></label>'
          +A.choiceHtml("d_supply",["공급계약","전매"],
            "일반적인 매매(기존 주택을 사고파는 경우)는 비워 두세요.")+'</div>';
        if(A.state.d_supply==="공급계약"){
          h+='<div class="field"><label class="field-label">준공 여부</label>'
            +A.choiceHtml("d_stage",["준공 전","준공 후"],"")+'</div>';
          h+='<div class="opts">'+A.toggleHtml("d_rentConv","임대주택 분양전환")+'</div>';
        }
        if(A.state.d_supply==="전매"){
          h+='<div class="field"><label class="field-label">전매 대상</label>'
            +A.choiceHtml("d_rightKind",["분양권","입주권"],
              "입주권을 고르면 ⑩ 종전 부동산 단계가 필요합니다.")+'</div>';
        }
        return h; }},

    {n:7, short:"소재지·면적", title:"⑥⑦ 어디에 있는 부동산인가요?",
      q:"거래한 부동산의 소재지와 면적을 적으세요.",
      why:"소재지는 반드시 지번주소로, 지번까지(아파트 등은 동·호수까지) 적습니다. 면적은 토지대장의 토지면적, 건축물대장의 건축물 면적(아파트 등 집합건축물은 전용면적)을 적습니다.",
      kind:"parcel",
      required:function(s){ return String(s.p_addr||"").trim()?[]:["소재지"]; },
      body:function(A){ var h='';
        h+='<div class="note-box"><b>⚠️ 소재지는 지번주소로 적습니다.</b> 도로명주소(○○로 00)로 적으면 '
          +'접수되지 않습니다. 등기사항증명서·토지대장에 적힌 <b>지번</b>(○○동 000-0)으로, '
          +'아파트 등 집합건축물은 <b>동·호수까지</b> 적으세요.</div>';
        h+=A.inputHtml({k:"p_addr", label:"⑥ 소재지 (지번주소)", req:true,
          ph:"경기도 군포시 산본동 000-0 101동 1001호",
          help:"도로명주소 아님. ①② 주소란(주민등록 주소)은 도로명으로 적어도 되지만, 이 칸은 지번주소여야 합니다."});
        h+=A.inputHtml({k:"p_jimok", label:"지목", half:true, ph:"대",
          help:"토지대장에 적힌 지목(대, 전, 답 등)."});
        h+=A.inputHtml({k:"p_landArea", label:"토지면적(㎡)", ph:"45000",
          help:"아파트 등 집합건축물은 내 지분이 아니라 그 아파트 토지(단지 대지)의 전체 면적을 적습니다. 내 몫은 아래 대지권비율로 나타냅니다."});
        h+='<div class="q-help">토지 거래지분 — 여러 명이 나눠 살 때만. 예) 2분의 1</div>';
        h+=A.inputHtml({k:"p_landShareDen", label:"토지 지분 ( ○○ 분의", half:true});
        h+=A.inputHtml({k:"p_landShareNum", label:"○○ )", half:true});
        h+='<div class="q-help" style="margin-top:8px">대지권비율 — 아파트 등 집합건축물의 등기사항증명서에 적힌 비율. '
          +'<b>분모(왼쪽)는 위 토지면적, 즉 단지 전체 면적</b>이고 분자(오른쪽)가 내 몫입니다. 예) 45000분의 52.43</div>';
        h+=A.inputHtml({k:"p_daejiDen", label:"대지권비율 ( ○○ 분의", half:true, ph:"45000"});
        h+=A.inputHtml({k:"p_daejiNum", label:"○○ )", half:true, ph:"52.43"});
        h+=A.inputHtml({k:"p_bldgArea", label:"건축물면적(㎡)", half:true, ph:"84.97",
          help:"아파트 등 집합건축물은 전용면적, 그 밖은 연면적."});
        h+=A.inputHtml({k:"p_bldgShareDen", label:"건축물 지분 ( ○○ 분의", half:true});
        h+=A.inputHtml({k:"p_bldgShareNum", label:"○○ )", half:true});
        h+='<div class="field-label" style="margin-top:8px">⑦ 계약대상 면적</div>';
        h+='<div class="q-help">실제로 거래한 면적입니다. 혼자 전부 사는 경우에는 위 면적과 같습니다.</div>';
        h+=A.inputHtml({k:"c_landArea", label:"토지(㎡)", half:true, ph:"52.43"});
        h+=A.inputHtml({k:"c_bldgArea", label:"건축물(㎡)", half:true, ph:"84.97"});
        return h; }},

    {n:8, short:"거래가격", title:"⑧⑨ 얼마에 거래했나요?",
      q:"거래가격과 지급 일정을 적으세요. 숫자만 넣으면 콤마가 자동으로 붙습니다.",
      why:"가장 중요한 항목입니다. 실제 거래가격을 그대로 적어야 하며, 거짓으로 적으면 과태료가 부과됩니다. 분양·전매는 부가가치세를 포함한 금액, 그 밖의 거래는 부가가치세를 뺀 금액을 적습니다.",
      kind:"price",
      required:function(s){ var m=[];
        if(!digits(s.pr_total)) m.push("총 실제거래가격");
        if(!String(s.dt_contract||"").trim()) m.push("계약 체결일");
        return m; },
      body:function(A){ var h='';
        h+=moneyField(A,{k:"pr_item", label:"⑧ 물건별 거래가격(원)", ph:"350000000",
          help:"부동산 하나하나의 거래가격. 한 건만 거래했다면 총 거래가격과 같습니다."});
        if(A.state.d_supply){
          h+='<div class="field-label" style="margin-top:8px">공급계약 또는 전매인 경우</div>';
          h+=moneyField(A,{k:"pr_supply", label:"분양가격(원)"});
          h+=moneyField(A,{k:"pr_balcony", label:"발코니 확장 등 선택비용(원)"});
          h+=moneyField(A,{k:"pr_extra", label:"추가 지급액 등(원)",
            help:"프리미엄 등 분양가격을 넘거나 못 미치는 금액."});
        }
        h+='<div class="field-label" style="margin-top:8px">⑨ 총 실제거래가격 (전체)</div>';
        h+=moneyField(A,{k:"pr_total", label:"합계(원)", req:true, ph:"350000000"});
        h+=moneyField(A,{k:"pr_down", label:"계약금(원)"});
        h+=A.inputHtml({k:"dt_contract", label:"계약 체결일", type:"date", req:true, ph:"2026.07.28",
          help:"거래 내용에 합의한 날. 계약금을 낸 날이 있으면 그 날입니다. 이 날부터 30일 안에 신고해야 합니다."});
        h+=moneyField(A,{k:"pr_mid", label:"중도금(원)"});
        h+=A.inputHtml({k:"dt_mid", label:"중도금 지급일", type:"date", ph:"2026.08.28"});
        h+=moneyField(A,{k:"pr_bal", label:"잔금(원)"});
        h+=A.inputHtml({k:"dt_bal", label:"잔금 지급일", type:"date", ph:"2026.10.28"});
        return h; }},

    {n:9, short:"종전 부동산", title:"⑩ 종전 부동산 (입주권일 때만)",
      q:"입주권 매매가 아니면 그대로 [다음]을 누르세요.",
      why:"⑩ 종전 부동산란은 입주권 매매의 경우에만 작성합니다. 재개발·재건축으로 없어지는 원래 부동산의 내용입니다.",
      kind:"prev",
      body:function(A){
        if(!isPrevNeeded())
          return '<div class="note-box">⑤에서 <b>전매 · 입주권</b>을 고른 경우에만 적는 칸입니다. '
            +'해당하지 않으면 <b>[다음]</b>으로 넘어가세요.</div>';
        var h='';
        h+=A.inputHtml({k:"v_addr", label:"소재지", ph:"경기도 군포시 …"});
        h+=A.inputHtml({k:"v_jimok", label:"지목", half:true, ph:"대"});
        h+=A.inputHtml({k:"v_landArea", label:"토지면적(㎡)", half:true});
        h+=A.inputHtml({k:"v_landShareDen", label:"토지 지분 ( ○○ 분의", half:true});
        h+=A.inputHtml({k:"v_landShareNum", label:"○○ )", half:true});
        h+=A.inputHtml({k:"v_daejiDen", label:"대지권비율 ( ○○ 분의", half:true});
        h+=A.inputHtml({k:"v_daejiNum", label:"○○ )", half:true});
        h+=A.inputHtml({k:"v_bldgArea", label:"건축물면적(㎡)", half:true});
        h+=A.inputHtml({k:"v_bldgShareDen", label:"건축물 지분 ( ○○ 분의", half:true});
        h+=A.inputHtml({k:"v_bldgShareNum", label:"○○ )", half:true});
        h+='<div class="field-label" style="margin-top:8px">계약대상 면적 · 건축물 유형</div>';
        h+=A.inputHtml({k:"v_cLandArea", label:"토지(㎡)", half:true});
        h+=A.inputHtml({k:"v_cBldgArea", label:"건축물(㎡)", half:true});
        h+=A.inputHtml({k:"v_bldgType", label:"건축물 유형", ph:"아파트"});
        h+='<div class="field-label" style="margin-top:8px">거래금액</div>';
        h+=moneyField(A,{k:"v_total", label:"합계(원)"});
        h+=moneyField(A,{k:"v_extra", label:"추가 지급액 등(원)"});
        h+=moneyField(A,{k:"v_right", label:"권리가격(원)"});
        h+=moneyField(A,{k:"v_down", label:"계약금(원)"});
        h+=moneyField(A,{k:"v_mid", label:"중도금(원)"});
        h+=moneyField(A,{k:"v_bal", label:"잔금(원)"});
        return h; }},

    {n:10, short:"그 밖의 사항", title:"③⑪ 그 밖의 사항 (선택)",
      q:"해당하는 것만 적으세요. 대부분 비워 둡니다.",
      kind:"etc",
      body:function(A){ var h='';
        h+='<div class="field"><label class="field-label">③ 법인신고서등</label>'
          +A.choiceHtml("corpDoc",["제출","별도 제출","해당 없음"],
            "법인 주택 거래계약 신고서, 주택취득자금 조달 및 입주계획서 등을 이 신고서와 함께 내는지 고릅니다. "
            +"해당 없으면 ‘해당 없음’.")+'</div>';
        h+=A.inputHtml({k:"memo", label:"⑪ 계약의 조건 및 참고사항",
          help:"계약에 조건이나 기한을 붙였거나, 참고할 내용이 있을 때만 적습니다."});
        return h; }},

    {n:11, short:"완료", title:"작성 내용 확인", q:"입력한 내용을 확인하세요.", kind:"summary",
      body:function(){
        return buildSummary()
          +'<div class="info-box">인쇄한 뒤 <b>매도인·매수인</b>(중개 거래는 개업공인중개사)이 '
          +'서명 또는 날인하여 부동산 소재지 관할 <b>시·군·구청</b>에 제출하세요. '
          +'신고 기한은 <b>계약 체결일부터 30일 이내</b>이며, 기한을 넘기거나 거짓으로 신고하면 과태료가 부과됩니다.</div>'
          +'<div class="note-box">첨부서류 — 단독신고이거나 개업공인중개사가 신고하는 경우: '
          +'거래계약서 사본, 계약금 지급을 확인할 수 있는 서류(영수증·통장 사본 등). '
          +'단독신고는 <b>단독신고사유서</b>도 필요합니다.</div>'
          +'<div class="note-box">소유권이전등기는 별도로, 「부동산등기 특별조치법」에 따른 날부터 '
          +'<b>60일 이내</b>에 신청해야 합니다.</div>';
      }}
  ],

  applySample:function(state, kind){
    // 흔한 경우 — 개인 간 아파트 매매(중개 거래)
    Object.assign(state,{
      step:2,
      s_name:"홍길동", s_jumin:"6001011000000",
      s_addr:"경기도 군포시 산본로 000, 101동 1001호",
      s_natl:"대한민국", s_phone:"0313900000", s_mobile:"01012345678",
      b_name:"김철수", b_jumin:"8503152000000",
      b_addr:"경기도 안양시 동안구 시민대로 000",
      b_natl:"대한민국", b_mobile:"01098765432",
      hasAgent:true, a_name:"박중개", a_jumin:"7205051000000",
      a_office:"산본공인중개사사무소", a_regno:"41410-2026-00001",
      a_addr:"경기도 군포시 산본로 111, 1층",
      a_phone:"0313901234", a_mobile:"01055556666",
      d_kind:"토지 및 건축물", d_bldgKind:"아파트",
      // ⑥ 소재지는 지번주소(도로명 아님). 토지면적은 단지 대지 전체 면적이고,
      // 내 몫은 대지권비율(45000분의 52.43)로 나타낸다 → ⑦ 계약대상 토지면적과 일치.
      p_addr:"경기도 군포시 산본동 000-0 101동 1001호",
      p_jimok:"대", p_landArea:"45000", p_bldgArea:"84.97",
      p_daejiDen:"45000", p_daejiNum:"52.43",
      c_landArea:"52.43", c_bldgArea:"84.97",
      pr_item:"350000000", pr_total:"350000000",
      pr_down:"35000000", dt_contract:"2026.07.10",
      pr_mid:"100000000", dt_mid:"2026.08.20",
      pr_bal:"215000000", dt_bal:"2026.10.15",
      corpDoc:"해당 없음"
    });
    if(kind==="right"){
      // 입주권 전매 — ⑤전매·입주권, ⑧ 분양가격/추가지급액, ⑩ 종전 부동산까지
      Object.assign(state,{
        hasAgent:false, a_name:"", a_jumin:"", a_office:"", a_regno:"", a_addr:"", a_mobile:"",
        d_kind:"토지 및 건축물", d_bldgKind:"아파트",
        d_supply:"전매", d_rightKind:"입주권",
        p_addr:"경기도 군포시 금정동 000-0 101동 1502호",
        p_jimok:"대", p_landArea:"38000", p_bldgArea:"74.52",
        p_daejiDen:"38000", p_daejiNum:"48.10",
        c_landArea:"48.10", c_bldgArea:"74.52",
        pr_item:"420000000", pr_supply:"380000000",
        pr_balcony:"12000000", pr_extra:"28000000",
        pr_total:"420000000", pr_down:"42000000", dt_contract:"2026.07.05",
        pr_mid:"", dt_mid:"", pr_bal:"378000000", dt_bal:"2026.09.30",
        v_addr:"경기도 군포시 금정동 000-1", v_jimok:"대",
        v_landArea:"38000", v_bldgArea:"59.80",
        v_daejiDen:"38000", v_daejiNum:"66.20",
        v_cLandArea:"66.20", v_cBldgArea:"59.80", v_bldgType:"아파트",
        v_total:"330000000", v_extra:"28000000", v_right:"302000000",
        v_down:"33000000", v_mid:"", v_bal:"297000000",
        corpDoc:"해당 없음"
      });
    }
  }
};
