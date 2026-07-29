/* =====================================================================
   개명신고서(양식 제27호) — FORM 설정
   engine/engine.js와 함께 build-form.js가 자체완결 HTML로 인라인한다.
   재생성: python tools/prep-bg.py naming 개명신고서.pdf
          node tools/build-form.js naming
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
  docTitle:"개명신고서 작성 미리보기 도우미",
  formName:"개명신고서",
  org:{ orgName:"경기도 군포시", officeName:"군포시청 민원실" },
  sampleLabels:["작성예시(본인 신고)","작성예시(법정대리인 신고)"],
  sampleKinds:["self","legal"],
  rerenderOnSet:["r_qual"],
  today:{ y:85, yx:112, mx:157, dx:200 },

  stateKeys:[].concat(
    ["bef_surKor","bef_givenKor","bef_surHan","bef_givenHan",
     "aft_surKor","aft_givenKor","aft_surHan","aft_givenHan",
     "bon","n_jumin","n_regBase","n_addr"],
    ["permDate","court"],
    ["etc"],
    ["r_name","r_jumin","r_qual","r_qualEtc","r_addr","r_phone","r_email",
     "sub_name","sub_jumin"]),

  CO:{
    texts:{
      // ① 개명 전 이름
      "bef_surKor":{x:205.8,y:137,a:"c",size:7,nb:true}, "bef_givenKor":{x:236,y:137,a:"c",size:7,nb:true},
      "bef_surHan":{x:290,y:137,a:"c",size:7,nb:true}, "bef_givenHan":{x:325,y:137,a:"c",size:7,nb:true},
      // ② 개명 후 이름
      "aft_surKor":{x:383,y:137,a:"c",size:7,nb:true}, "aft_givenKor":{x:412.7,y:137,a:"c",size:7,nb:true},
      "aft_surHan":{x:465,y:137,a:"c",size:7,nb:true}, "aft_givenHan":{x:503,y:137,a:"c",size:7,nb:true},
      // 본(한자) · 주민등록번호 (개명자)
      "bon":{x:218,y:167,a:"c",size:7.5},
      "n_jumin1":{x:403.7,y:167,a:"c",size:7,nb:true}, "n_jumin2":{x:485.3,y:167,a:"c",size:7,nb:true},
      // 등록기준지 · 주소
      "n_regBase":{x:168,y:193,a:"l",size:7,w:348,wrap:true,nb:true},
      "n_addr":{x:168,y:222,a:"l",size:7,w:348,wrap:true,nb:true},
      // ③ 허가일자 · 법원명
      "permY":{x:180,y:252,a:"c",size:7.5,nb:true}, "permMo":{x:224,y:252,a:"c",size:7.5,nb:true},
      "permD":{x:268,y:252,a:"c",size:7.5,nb:true},
      "court":{x:372,y:252,a:"l",size:7,w:148,nb:true},
      // ④ 기타사항
      "etc":{x:168,y:281,a:"l",size:7.5,w:350,wrap:true},
      // ⑤ 신고인
      "r_name":{x:205,y:312,a:"c",size:8}, "r_jumin1":{x:427.6,y:312,a:"c",size:7,nb:true}, "r_jumin2":{x:493.2,y:312,a:"c",size:7,nb:true},
      "r_qualEtc":{x:368,y:338,a:"l",size:6.5,w:125,nb:true},
      "r_addr":{x:168,y:362,a:"l",size:6.5,w:138,nb:true},
      "r_phone":{x:338,y:362,a:"l",size:6.5,w:70,nb:true},
      "r_email":{x:448,y:362,a:"l",size:5.5,w:74,nb:true},
      // ⑥ 제출인
      "sub_name":{x:213,y:391,a:"c",size:8}, "sub_jumin1":{x:379.9,y:391,a:"c",size:7,nb:true}, "sub_jumin2":{x:477.4,y:391,a:"c",size:7,nb:true}
    },
    checks:{
      "r_qual":{"본인":[175.6,338.6],"법정대리인":[225.2,338.6],"기타":[307.9,338.6]}
    },
    attend:{}
  },

  STEP_HL:{
    2:[[163,122,341,153]],
    3:[[341,122,523,153]],
    4:[[103,153,523,237.8]],
    5:[[72,237.8,523,265.9]],
    6:[[72,265.9,523,296.8]],
    7:[[72,296.8,523,375]],
    8:[[72,375,523,407.6]]
  },

  buildVals:function(state){
    var d=state, v={};
    ["bef_surKor","bef_givenKor","bef_surHan","bef_givenHan",
     "aft_surKor","aft_givenKor","aft_surHan","aft_givenHan",
     "bon","n_regBase","n_addr","court","etc",
     "r_name","r_qualEtc","r_addr","r_email","sub_name"
    ].forEach(function(k){ v[k]=d[k]||""; });
    v.r_phone=formatPhone(d.r_phone);
    ["n_jumin","r_jumin","sub_jumin"].forEach(function(f){ v[f+"1"]=j1(d[f]); v[f+"2"]=j2(d[f]); });
    var b=ymd(d.permDate); v.permY=b[0]; v.permMo=b[1]; v.permD=b[2];
    return v;
  },

  signatureHI:function(v){
    var HI=[];
    if(v.r_name) HI.push([255,299,328,326]);
    return HI;
  },

  STEPS:[
    {n:1, short:"시작", title:"개명신고서 작성 시작",
      q:"함께 한 단계씩 채워 볼까요?",
      why:"개명신고는 법원의 개명허가를 받은 뒤에 하는 신고입니다. 개명허가결정등본을 받은 날부터 1개월 이내에 신고해야 하며, 개명허가결정등본을 함께 준비하세요. 서명·날인은 인쇄한 뒤 직접 하시면 됩니다.",
      kind:"intro",
      body:function(){
        return '<div class="note-box">이 도구는 <b>미리보기</b>이며, 실제 접수는 담당 직원의 확인을 따릅니다. '
          +'입력 내용은 저장되지 않습니다.</div>'
          +'<div class="opts"><button type="button" class="opt sel" data-next="1">시작하기 →</button></div>';
      }},
    {n:2, short:"개명 전 이름", title:"① 개명 전 이름",
      q:"바꾸기 전(지금까지 쓰던) 이름을 입력하세요.",
      why:"성과 이름을 나누어 적습니다. 한자 이름이 없으면 한글만 적어도 됩니다.",
      kind:"fields",
      required:function(s){ var m=[];
        if(!String(s.bef_surKor||"").trim()) m.push("성(한글)");
        if(!String(s.bef_givenKor||"").trim()) m.push("이름(한글)");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"bef_surKor", label:"성(한글)", req:true, half:true, ph:"김"});
        h+=A.inputHtml({k:"bef_givenKor", label:"이름(한글)", req:true, half:true, ph:"철수"});
        h+=A.inputHtml({k:"bef_surHan", label:"성(한자)", half:true, ph:"金"});
        h+=A.inputHtml({k:"bef_givenHan", label:"이름(한자)", half:true, ph:"哲洙"});
        return h;
      }},
    {n:3, short:"개명 후 이름", title:"② 개명 후 이름",
      q:"새로 바꾼(개명허가를 받은) 이름을 입력하세요.",
      why:"개명허가결정등본에 적힌 새 이름을 그대로 적습니다. 보통 성은 그대로 두고 이름만 바뀝니다. 한자가 없으면 한글만 적으세요.",
      kind:"fields",
      required:function(s){ var m=[];
        if(!String(s.aft_surKor||"").trim()) m.push("성(한글)");
        if(!String(s.aft_givenKor||"").trim()) m.push("이름(한글)");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"aft_surKor", label:"성(한글)", req:true, half:true, ph:"김"});
        h+=A.inputHtml({k:"aft_givenKor", label:"이름(한글)", req:true, half:true, ph:"도윤"});
        h+=A.inputHtml({k:"aft_surHan", label:"성(한자)", half:true, ph:"金"});
        h+=A.inputHtml({k:"aft_givenHan", label:"이름(한자)", half:true, ph:"道潤"});
        return h;
      }},
    {n:4, short:"개명자 정보", title:"① 개명자 — 본·주민등록번호·주소",
      q:"개명자 본인의 나머지 정보를 입력하세요.",
      why:"본(本)은 본관의 한자(예: 金海)를 적습니다. 등록기준지는 가족관계등록부의 기준이 되는 주소입니다.",
      kind:"fields",
      required:function(s){ var m=[];
        if(!String(s.n_jumin||"").trim()) m.push("주민등록번호");
        if(!String(s.n_regBase||"").trim()) m.push("등록기준지");
        if(!String(s.n_addr||"").trim()) m.push("주소");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"bon", label:"본(한자)", ph:"金海",
          help:"본관을 한자로 적습니다. 모르면 비워 두고 창구에서 확인하세요."});
        h+=A.inputHtml({k:"n_jumin", label:"주민등록번호", type:"jumin", req:true, ph:"900101-0000000"});
        h+=A.inputHtml({k:"n_regBase", label:"등록기준지", req:true, ph:"경기도 군포시 …",
          help:"가족관계등록부의 기준이 되는 주소."});
        h+=A.inputHtml({k:"n_addr", label:"주소", req:true, ph:"경기도 군포시 …",
          help:"개명자의 주민등록 주소."});
        return h;
      }},
    {n:5, short:"허가일자", title:"③ 개명허가일자 · 법원명",
      q:"법원에서 개명허가를 받은 날짜와 법원 이름을 입력하세요.",
      why:"개명허가결정등본에 적힌 허가 연월일과 결정한 법원 이름을 그대로 옮겨 적습니다.",
      kind:"fields",
      required:function(s){ var m=[];
        if(!String(s.permDate||"").trim()) m.push("허가일자");
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
      q:"특별히 밝힐 내용이 있으면 적습니다. 없으면 넘어가세요.",
      kind:"etc",
      body:function(A){
        var h='';
        h+='<div class="note-box">대부분 <b>비워 둡니다.</b> 해당하는 경우에만 적으세요.</div>';
        h+=A.inputHtml({k:"etc", label:"④ 기타사항", help:"가족관계등록부 기록에 특별히 필요한 사항."});
        return h;
      }},
    {n:7, short:"신고인", title:"⑤ 신고인",
      q:"신고서를 작성·제출하는 분(신고인)의 정보를 입력하세요.",
      why:"개명자 본인이 신고하면 자격은 ‘본인’이고, 성명은 개명 후의 이름을 적습니다. 미성년자 등은 부모 같은 법정대리인이 신고합니다.",
      kind:"reporter",
      required:function(s){ var m=[];
        if(!String(s.r_name||"").trim()) m.push("신고인 성명");
        if(!String(s.r_qual||"").trim()) m.push("신고인 자격");
        if(!String(s.r_phone||"").trim()) m.push("휴대전화번호");
        return m; },
      body:function(A){
        var h='';
        h+=A.inputHtml({k:"r_name", label:"신고인 성명", req:true, ph:"김도윤",
          help:"본인이 신고하면 개명 후의 이름을 적습니다."});
        h+=A.inputHtml({k:"r_jumin", label:"주민등록번호", type:"jumin", ph:"900101-0000000"});
        h+='<div class="field"><label class="field-label">신고인 자격 <span class="fb fb-req">필수</span></label>'
          +A.choiceHtml("r_qual",QUAL_OPTS,"개명자 본인이면 ‘본인’, 부모 등이면 ‘법정대리인’.")+'</div>';
        if(A.state.r_qual==="기타")
          h+=A.inputHtml({k:"r_qualEtc", label:"자격(기타) — 어떤 자격인지", ph:"예: 성년후견인"});
        h+=A.inputHtml({k:"r_addr", label:"주소", ph:"경기도 군포시 …"});
        h+=A.inputHtml({k:"r_phone", label:"휴대전화번호 등", type:"phone", req:true, ph:"010-0000-0000"});
        h+=A.inputHtml({k:"r_email", label:"이메일", ph:"name@example.com"});
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
    {n:9, short:"완료", title:"작성 내용 확인", q:"입력한 내용을 확인하세요.", kind:"summary",
      body:function(){
        return buildSummary()
          +'<div class="info-box">인쇄한 뒤, 신고인이 서명·날인을 직접 하여 민원실에 제출하세요. '
          +'개명허가결정등본 등 첨부서류는 담당 직원이 안내합니다.</div>';
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
      // 미성년 자녀 개명 — 부(법정대리인)가 신고
      Object.assign(state,{
        bef_surKor:"이", bef_givenKor:"민준", bef_surHan:"李", bef_givenHan:"敏俊",
        aft_surKor:"이", aft_givenKor:"서준", aft_surHan:"李", aft_givenHan:"舒俊",
        bon:"全州", n_jumin:"1503111000000",
        permDate:"2026.07.01", court:"수원가정법원",
        r_name:"이철수", r_jumin:"8203151000000", r_qual:"법정대리인", r_qualEtc:"",
        r_email:"lee@example.com"
      });
    }
  }
};
