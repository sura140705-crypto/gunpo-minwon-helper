/* =====================================================================
   공통 엔진 — 가족관계등록 신고서 도우미 (이미지-오버레이 방식)
   FORM 설정 객체(forms/<이름>.config.js)가 서식별 좌표·필드·단계를 정의하고,
   이 엔진이 렌더·검증·네비게이션·이벤트·인쇄를 담당한다.
   ⚠️ 이 파일은 build-form.js가 자체완결 HTML로 인라인한다. 외부 로드 안 함.
   ===================================================================== */

/* 0) 실행 시각 (무저장) */
var APP_TODAY = null;

/* 1) 상태 (메모리 전용 · 저장 안 함 · 새로고침 시 소멸) */
function createEmptyState(){
  var s={ step:1, unsure:{} };
  var keys=FORM.stateKeys||[];
  for(var i=0;i<keys.length;i++) s[keys[i]]="";
  var def=FORM.stateDefaults||{};
  for(var k in def){ if(def.hasOwnProperty(k)) s[k]=def[k]; }
  return s;
}
var state = createEmptyState();

/* 2) 파생 (서식 config에서 쓸 수 있는 공통 헬퍼) */
function juminAge(jumin){
  var j=String(jumin||"").replace(/\D/g,"");
  if(j.length<7) return null;
  var yy=+j.slice(0,2), mm=+j.slice(2,4), dd=+j.slice(4,6), code=+j.charAt(6), c;
  if(code===1||code===2||code===5||code===6) c=1900;
  else if(code===3||code===4||code===7||code===8) c=2000;
  else if(code===9||code===0) c=1800;
  else return null;
  if(mm<1||mm>12||dd<1||dd>31) return null;
  var t=APP_TODAY||new Date();
  return t.getFullYear()-(c+yy)-((t.getMonth()+1<mm)||(t.getMonth()+1===mm&&t.getDate()<dd)?1:0);
}
function isMinor(p){ var a=juminAge(state[p+"_jumin"]); return a!=null && a<19; }
/* 주민등록번호 → 출생연월일 "YYYY.MM.DD" (7번째 자리로 세기 판정) */
function birthFromJumin(jumin){
  var j=digits(jumin); if(j.length<7) return "";
  var yy=j.slice(0,2), mm=j.slice(2,4), dd=j.slice(4,6), code=+j.charAt(6), c;
  if(code===1||code===2||code===5||code===6) c=1900;
  else if(code===3||code===4||code===7||code===8) c=2000;
  else if(code===9||code===0) c=1800;
  else return "";
  var m=+mm, d=+dd; if(m<1||m>12||d<1||d>31) return "";
  return (c+ +yy)+"."+mm+"."+dd;
}

/* 3) 포매터 */
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function formatDate(d){
  var y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0");
  var w=["일","월","화","수","목","금","토"][d.getDay()];
  return y+"년 "+m+"월 "+day+"일 ("+w+")";
}
function formatJumin(v){
  var d=String(v||"").replace(/\D/g,"").slice(0,13);
  if(d.length<=6) return d;
  return d.slice(0,6)+"-"+d.slice(6);
}
function formatPhone(v){
  var d=String(v||"").replace(/\D/g,"").slice(0,11);
  if(d.length<4) return d;
  if(d.slice(0,2)==="02"){                       // 서울 지역번호만 2자리
    if(d.length<=5) return d.slice(0,2)+"-"+d.slice(2);
    if(d.length<=9) return d.slice(0,2)+"-"+d.slice(2,5)+"-"+d.slice(5);
    return d.slice(0,2)+"-"+d.slice(2,6)+"-"+d.slice(6);
  }
  if(d.length<7) return d.slice(0,3)+"-"+d.slice(3);
  if(d.length<11) return d.slice(0,3)+"-"+d.slice(3,6)+"-"+d.slice(6);
  return d.slice(0,3)+"-"+d.slice(3,7)+"-"+d.slice(7);
}
/* 숫자 8자리 → yyyy.mm.dd, 그 외는 입력값 유지 */
function formatDateFlexible(v){
  var raw=String(v||"");
  var d=raw.replace(/\D/g,"");
  if(d.length===8) return d.slice(0,4)+"."+d.slice(4,6)+"."+d.slice(6);
  return raw;
}
function digits(s){ return String(s||"").replace(/\D/g,""); }
/* 금액: 숫자만 남기고 3자리마다 콤마 (거래가격 등 — 0 자릿수 확인용) */
function formatMoney(v){ var d=digits(v).replace(/^0+(?=\d)/,""); return d?d.replace(/\B(?=(\d{3})+(?!\d))/g,","):""; }
function j1(s){ return digits(s).slice(0,6); }
function j2(s){ return digits(s).slice(6,13); }
function ymd(s){ var m=String(s||"").match(/(\d{4})\D*(\d{1,2})\D*(\d{1,2})/); return m?[m[1],m[2],m[3]]:["","",""]; }

/* 4) 좌측: 실제 서식 이미지 위에 값 오버레이 */
var PW=595, PH=841;        // PDF 포인트 좌표계 (배경 이미지도 동일 A4 비율)
var CO=FORM.CO, STEP_HL=FORM.STEP_HL||{};

function buildVals(){ return FORM.buildVals(state); }

function stepHighlights(X,Y){
  var boxes=STEP_HL[state.step]; if(!boxes) return "";
  var h="";
  boxes.forEach(function(b){
    h+='<span class="ovhl" style="left:'+X(b[0])+'%;top:'+Y(b[1])+'%;width:'+
       ((b[2]-b[0])/PW*100).toFixed(2)+'%;height:'+((b[3]-b[1])/PH*100).toFixed(2)+'%;"></span>';
  });
  return h;
}

// 배경 서식 이미지 위에 값/영표를 얹어 그림 (좌측 + 미리보기 모달 공용)
function renderForm(){
  var v=buildVals(), h="";
  var X=function(x){return (x/PW*100).toFixed(2);}, Y=function(y){return (y/PH*100).toFixed(2);};
  var fs=function(pt){return (pt/PW*100).toFixed(2);};   // 포인트 → cqw

  /* 원본 서식에 **인쇄돼 있는 글자를 흰색으로 덮는다** — config 가 필요할 때만 돌려준다.
     ⛔ 함부로 쓰지 마라. 관공서 서식의 인쇄물을 가리는 일이라 **담당자 요청이 있을 때만** 쓴다.
     ⛔ 좌표는 원본 PDF 에서 **잉크를 실측**해서 넣는다 — 눈대중으로 덮으면 옆 글자·격자선까지 지운다.
     ⚠️ 맨 먼저 그린다. 단계 강조·형광펜·값이 모두 이 위에 얹혀야 한다.
        (여권은 손작성본이라 같은 `.cover` 를 제 코드에서 직접 쓴다 — 껍데기 CSS 는 공용이다.) */
  var CV=(FORM.covers?FORM.covers(v,state):[])||[];
  CV.forEach(function(b){
    h+='<span class="cover" style="left:'+X(b[0])+'%;top:'+Y(b[1])+'%;width:'+
       ((b[2]-b[0])/PW*100).toFixed(2)+'%;height:'+((b[3]-b[1])/PH*100).toFixed(2)+'%;"></span>';
  });

  // 현재 단계 강조(맨 밑에 깔림)
  h+=stepHighlights(X,Y);

  // 형광펜: 인쇄 후 날인·서명해야 하는 칸 — 서식 config가 조건부로 반환
  var HI=(FORM.signatureHI?FORM.signatureHI(v,state):[])||[];
  HI.forEach(function(b){
    h+='<span class="ovhi" style="left:'+X(b[0])+'%;top:'+Y(b[1])+'%;width:'+
       ((b[2]-b[0])/PW*100).toFixed(2)+'%;height:'+((b[3]-b[1])/PH*100).toFixed(2)+'%;"></span>';
  });

  // 자유 텍스트 값 (신청서 내부 글자 — 가독성 위해 +1.5pt 확대; nb면 확대 안 함)
  var TEXT_BUMP=1.5;
  Object.keys(CO.texts).forEach(function(k){
    var val=String(v[k]==null?"":v[k]).trim(); if(!val) return;
    var t=CO.texts[k], cls="ov"+(t.a==="l"?" t":"")+(t.a==="r"?" r":"");
    var st="left:"+X(t.x)+"%;top:"+Y(t.y)+"%;font-size:"+fs(t.size+(t.nb?0:TEXT_BUMP))+"cqw;";
    if(t.wrap){ st+="width:"+(t.w/PW*100).toFixed(2)+"%;white-space:normal;line-height:1.2;"; }
    h+='<span class="'+cls+'" style="'+st+'">'+esc(val)+'</span>';
  });

  // 선택항목 표기 — 서식이 지시하는 기호를 쓴다.
  // 가족관계등록 신고서는 '영표(○)', 부동산거래계약 신고서 등 [ ] 서식은 '√표'.
  var MK=FORM.checkMark||"○", MKS=FORM.checkSize||12;
  var MKC=FORM.checkBlack?" blk":"";     // 검정 표기(인쇄 CSS가 !important라 클래스로 처리)
  var circle=function(p){ return '<span class="ov o'+MKC+'" style="left:'+X(p[0])+'%;top:'+Y(p[1])
    +'%;font-size:'+fs(MKS)+'cqw;">'+MK+'</span>'; };
  Object.keys(CO.checks||{}).forEach(function(field){
    if(FORM.checkVisible && !FORM.checkVisible(field,state)) return;
    var val=state[field]; if(!val) return;
    var pos=CO.checks[field][val]; if(pos) h+=circle(pos);
  });
  Object.keys(CO.attend||{}).forEach(function(field){ if(state[field]) h+=circle(CO.attend[field]); });

  // 신고일(오늘) — 제목 아래 ( 년 월 일 )
  var t=APP_TODAY||new Date(), td=FORM.today;
  if(td){
    var ds=function(x,val){ return '<span class="ov" style="left:'+X(x)+'%;top:'+Y(td.y)
      +'%;font-size:'+fs(7.5)+'cqw;">'+val+'</span>'; };
    h+=ds(td.yx,t.getFullYear())+ds(td.mx,t.getMonth()+1)+ds(td.dx,t.getDate());
  }

  document.querySelectorAll(".ovl").forEach(function(o){ o.innerHTML=h; });
  renderExtras();
}

/* 첨부 페이지(별지 등) — FORM.extraPages(state)가 HTML을 돌려주면 서식 뒤에 붙는다.
   내용이 없으면 빈 문자열을 돌려주고, .extra:empty 규칙으로 화면·인쇄에서 사라진다. */
function renderExtras(){
  var html=FORM.extraPages?(FORM.extraPages(state)||""):"";
  document.querySelectorAll(".extra").forEach(function(e){ e.innerHTML=html; });
}

/* ══ 선 아이콘 (Product UI v1 · 24 격자 · 굵기 1.7 · 둥근 끝 · currentColor) ══
   ⛔ 이모지를 화면에 그리지 않는다 — OS·글꼴마다 모양이 달라지고 색이 여럿이다.
   ⛔ 아이콘 폰트·외부 세트를 받아 오지 않는다(오프라인). 인라인으로 둔다.
   ⚠️ 여권(`passport-helper-v1.html`)과 **같은 문법**이다. 그림만 이 서식에 필요한 것을 둔다.
   📌 표에 없는 이름을 부르면 `document`(서류 한 장)로 물러난다. */
var ICON_ATTR='viewBox="0 0 24 24" fill="none" stroke="currentColor" '+
              'stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
var ICONS={
  check:'<path d="M4.5 12.5l5 5 10-10.5"/>',
  lock:'<rect x="4.6" y="10.4" width="14.8" height="9.4" rx="2.2"/>'+
       '<path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8"/>',
  checklist:'<path d="M4.6 7.2l1.8 1.8 3-3.2"/><path d="M4.6 15.4l1.8 1.8 3-3.2"/>'+
            '<path d="M12.4 7.4h7"/><path d="M12.4 15.6h7"/>',
  document:'<path d="M6.4 3.4h7l4.2 4.2v13H6.4z"/><path d="M13.4 3.4v4.2h4.2"/>'+
           '<path d="M9.2 12.6h5.6"/><path d="M9.2 16.2h5.6"/>',
  idcard:'<rect x="3.2" y="5.6" width="17.6" height="12.8" rx="2.2"/>'+
         '<circle cx="8.8" cy="11.2" r="2"/><path d="M5.6 16.2c.5-1.6 1.7-2.4 3.2-2.4s2.7.8 3.2 2.4"/>'+
         '<path d="M14.6 10.4h4"/><path d="M14.6 13.8h4"/>',
  cert:'<path d="M6.4 3.4h7l4.2 4.2v9.2H6.4z"/><path d="M13.4 3.4v4.2h4.2"/>'+
       '<circle cx="12" cy="18.4" r="2.4"/><path d="M9.2 10.6h5.6"/>',
  photo:'<rect x="3.4" y="5.4" width="17.2" height="13.2" rx="2.2"/>'+
        '<circle cx="9.4" cy="10.6" r="2"/><path d="M4.4 17.4l4.8-4.2 3.4 3 2.8-2.4 4.2 3.6"/>',
  pay:'<rect x="3.2" y="6.2" width="17.6" height="11.6" rx="2.2"/><path d="M3.2 10.2h17.6"/>'+
      '<path d="M6.8 14.4h3.2"/>',
  /* 도장 — 손잡이 + 인면. ⚠️ 붉은 인주를 그리지 않는다(색은 「골라짐」에만 쓴다). */
  stamp:'<path d="M9.6 3.6h4.8v3.2c0 1.5 1 2.2 2 3 1.2 1 2 2 2 3.6v1.2H5.6v-1.2'+
        'c0-1.6.8-2.6 2-3.6 1-.8 2-1.5 2-3z"/><rect x="4.2" y="17.4" width="15.6" height="3" rx="1.2"/>'
};
function svgIcon(key, cls){
  var d=ICONS[key]||ICONS.document;
  return '<svg class="ic-svg'+(cls?" "+cls:"")+'" '+ICON_ATTR+' aria-hidden="true">'+d+'</svg>';
}

/* 5) 우측 위저드 렌더 */
var el={};
function num(i){ return "①②③④⑤⑥⑦⑧⑨⑩".charAt(i); }

/* ══ 선택사항 공통 안내 (2026.08.29 담당자 요구) ═══════════════════════
   가족관계등록 신고서는 원칙적으로 **모든 사항이 필수**다. 다만 **등록기준지·본·한자**는
   시민이 그 자리에서 알기 어려워 창구가 채운다 — 그 칸에는 아래 한 문장을 붙인다.
   ⛔ **화면마다 비슷한 말을 새로 짓지 마라.** 문구는 여기 하나뿐이고, 서식은
      `{optHint:true}` 로 부르기만 한다. 말이 조금씩 달라지면 시민은 「이 칸은 좀 다른가」로 읽는다.
   ⚠️ 아무 칸에나 붙이지 마라. 붙는 순간 「비워도 되는 칸」이 된다. */
var OPT_HINT="모를 경우 비워두세요. 접수 시 알려드리겠습니다.";

/* ══ 주민등록번호는 **언제나 선택**이다 (2026.08.30 담당자) ═══════════════════════
   여기는 **공용 키오스크**다. 지나가는 사람이 보는 화면에 주민등록번호를 적기 꺼려지는
   것은 당연하고, 그 사람에게 길이 없으면 도우미를 통째로 포기하게 된다.
   그래서 여권이 하던 것과 같은 선택권을 7종에도 준다 — **비워 두면 그 칸이 빈 채로
   인쇄되고, 종이에 직접 적으면 된다.**
   ⛔ 서식마다 다른 말을 짓지 마라. 문구는 여기 하나뿐이다.
   ⛔ 대신할 새 입력항목(예: 「생년월일만 적기」)을 만들지 마라 — 그런 요청이 아니다. */
var JUMIN_HINT="공용 화면에 적기 불편하시면 비워 두세요. 그 칸은 빈 채로 인쇄되고, 인쇄한 뒤 직접 적으셔도 됩니다.";

function inputHtml(f){
  /* ⛔ 주민등록번호는 config 가 `req:true` 라 적어도 **선택**으로 낸다.
     한 곳에서 막아 두면 서식이 서른 몇 군데에서 제각각 되돌아가는 일이 없다.
     ⚠️ 이것은 **표시**만 바꾼다. 진행을 막는 것은 각 단계의 `required()` 이므로
        그쪽에서도 주민등록번호를 빼야 실제로 선택이 된다(7종 전부 그렇게 했다). */
  var isReq = f.req && f.type!=="jumin";
  var v=state[f.k]||"", req=isReq?'<span class="fb fb-req">필수</span>':'<span class="fb fb-opt">선택</span>';
  // 재렌더(단계 이동·조건부 갱신) 때도 입력 중과 같은 형식으로 보이게 한다
  if(f.type==="money") v=formatMoney(v);
  else if(f.type==="jumin") v=formatJumin(v);
  else if(f.type==="phone") v=formatPhone(v);
  var cls="field"+(f.half?" half":"");
  var h='<div class="'+cls+'"><label class="field-label" for="in_'+f.k+'">'+esc(f.label)+req+'</label>';
  if(f.help) h+='<div class="q-help">'+esc(f.help)+'</div>';
  if(f.optHint) h+='<div class="q-help opt-hint">'+esc(OPT_HINT)+'</div>';
  if(f.type==="jumin") h+='<div class="q-help opt-hint">'+esc(JUMIN_HINT)+'</div>';
  h+='<input class="text-input" id="in_'+f.k+'" data-f="'+f.k+'" data-t="'+(f.type||"text")+'" '
    +'value="'+esc(v)+'" '
    +(f.type==="jumin"||f.type==="phone"||f.type==="money"?'inputmode="numeric" ':'')+'autocomplete="off"></div>';
  return h;
}
function choiceHtml(field, opts, help){
  var h='';
  if(help) h+='<div class="q-help">'+esc(help)+'</div>';
  h+='<div class="opts row">';
  for(var i=0;i<opts.length;i++){
    var sel=state[field]===opts[i]?" sel":"";
    h+='<button type="button" class="opt'+sel+'" data-set="'+field+'" data-val="'+esc(opts[i])+'">'+esc(opts[i])+'</button>';
  }
  h+='</div>';
  return h;
}
function toggleHtml(field, label){
  var on=state[field]?" sel":"";
  return '<button type="button" class="opt'+on+'" data-toggle="'+field+'">'+(state[field]?"☑ ":"☐ ")+esc(label)+'</button>';
}
function sumRow(k,val,step){
  var empty=!val;
  /* `step` 을 주면 그 단계로 되돌아가는 「수정」이 붙는다(여권과 같은 문법).
     ⛔ 모든 행에 기계적으로 달지 마라 — Review 가 다시 길어지면 뜻이 없다.
        되돌아갈 값이 실제로 있는 선택에만 붙인다. */
  var edit = (step && !empty)
    ? '<button type="button" class="sum-edit" data-goto="'+step+'">수정</button>' : '';
  return '<div class="sum-row"><span class="k">'+esc(k)+'</span>'
    +'<span class="val'+(empty?" empty":"")+'">'+(empty?"(비어 있음)":esc(val))+'</span>'+edit+'</div>';
}
/* ══ Review 전용 — 값이 없거나 해당하지 않으면 **그 줄을 내지 않는다** (2026.08.29 §2 정리)
   ⛔ Review 는 전체 입력값 요약이 아니다. 시민이 내린 **핵심 선택**만 다시 보여 준다.
      주관식 개인정보(성명·주민등록번호·주소·전화·이메일·자유입력)는 가운데 PAPER 가
      실시간으로 보여 주므로 **여기서 되풀이하지 않는다.** */
function sumRowIf(k,val,step){
  return (val==null || String(val).trim()==="") ? "" : sumRow(k,String(val).trim(),step);
}

// 서식 config의 단계 body(API)에 넘길 헬퍼 묶음
var API={ get state(){return state;}, esc:esc, inputHtml:inputHtml, choiceHtml:choiceHtml,
  toggleHtml:toggleHtml, sumRow:sumRow, sumRowIf:sumRowIf, num:num,
  formatJumin:formatJumin, formatPhone:formatPhone, formatMoney:formatMoney, digits:digits };

function renderStepBody(step){
  var def=FORM.STEPS[step-1], h='';
  h+='<div class="coach-q">'+esc(def.q)+'</div>';
  /* ⚠️ Review(마지막 확인)에는 **어디를 보면 전체가 있는지** 한 줄로 알려 준다.
     ⛔ 서식마다 다른 말을 짓지 마라 — 여권과 같은 뜻의 한 문장이다. */
  if(def.kind==="summary")
    h+='<div class="why-box"><span class="ic">💡</span><span>적으신 값 전체는 <b>옆의 신청서</b>에 '
      +'그대로 보입니다. 여기서는 <b>고르신 것</b>만 확인해 주세요.</span></div>';
  if(def.why) h+='<div class="why-box"><span class="ic">💡</span><span>'+esc(def.why)+'</span></div>';
  if(def.body) h+=def.body(API);
  return h;
}

/* 진행 표시 — 막대 + 지나온 단계(2026.08.25, 여권과 같은 결).
   ⚠️ 종전에는 동그라미 스텝퍼였다. 같은 키오스크에서 여권과 표시가 갈리지 않게 바꿨다.
   ⛔ **되돌아가는 길을 없애지 않았다.** 지나온 단계는 눌러서 뛸 수 있다 —
      앞으로 건너뛰기는 `gotoStep` 쪽에서 막는다. 7종의 요약 화면에는 아직
      줄마다 「수정」이 없어서, 이 길을 없애면 [이전]을 여러 번 눌러야 한다. */
/* 새 껍데기(Product UI)를 쓰는가 — 안내 기둥이 있으면 그렇다 */
function isRailShell(){ return !!document.getElementById("railInfo"); }

/* ══ 안내 기둥의 진행 표시 (Product UI v1 · 여권과 같은 문법) ═══════════
   캡션 + 큰 숫자 + 지금 묶음 + 막대 + 묶음 목록.
   ⚠️ 분모는 **활성 단계 수**다 — 출생신고는 혼인 중 10 / 혼인 외 9 로 갈린다.
      「N / 10」 같은 고정 표기는 맞지 않는다.
   ⚠️ 지나온 묶음은 눌러 되돌아갈 수 있다. 앞으로 건너뛰기는 `gotoStep` 이 막는다. */
function renderRailProg(){
  var act=activeSteps(), n=act.length, pos=act.indexOf(state.step)+1;
  var pct=Math.round((pos||1)/(n||1)*100);
  var cur=FORM.STEPS[state.step-1];
  var h='<div class="rail-cap">작성 진행</div>';
  h+='<div class="rail-num">'+pos+' <span>/ '+n+'</span></div>';
  h+='<div class="rail-now">'+esc(cur?cur.short:"")+'</div>';
  h+='<div class="pbar"><div class="pbar-fill" style="width:'+pct+'%"></div></div>';
  h+='<div class="rail-steps">';
  act.forEach(function(nn){
    var st=FORM.STEPS[nn-1], done=nn<state.step, now=nn===state.step;
    var cls=done?"done":(now?"now":"");
    var mark=done?svgIcon("check","ic-dot"):"";
    h+= done
      ? '<button type="button" class="rail-step '+cls+'" data-goto="'+nn+'">'+
        '<span class="dot">'+mark+'</span><span>'+esc(st.short)+'</span></button>'
      : '<div class="rail-step '+cls+'"><span class="dot">'+mark+'</span>'+
        '<span>'+esc(st.short)+'</span></div>';
  });
  h+='</div>';
  el.stepper.innerHTML=h;
  el.stepper.setAttribute("aria-valuemin",1);
  el.stepper.setAttribute("aria-valuemax",n);
  el.stepper.setAttribute("aria-valuenow",pos);
  el.stepper.setAttribute("aria-valuetext",pos+" / "+n+" 단계 · "+(cur?cur.short:""));
}

/* ══ 안내 기둥의 아래쪽 — 준비물과 안심 안내 ════════════════════════════
   ⛔ **준비물을 지어내지 않는다.** `FORM.ready` 가 없으면 그 구역을 아예 내지 않는다 —
      있는 것처럼 보이는 것이 없는 것보다 나쁘다. */
function renderRailInfo(){
  var box=document.getElementById("railInfo"); if(!box) return;
  var h='';
  var ready=FORM.ready||[];
  if(ready.length){
    h+='<div class="rail-rule"></div>';
    h+='<div class="rail-sec"><div class="rail-head">'+svgIcon("checklist","ic-sm")+'준비하셨나요?</div>';
    h+='<div class="rail-items">';
    ready.forEach(function(it){
      h+='<div class="rail-item'+(it.req?" req":"")+'">'+
         '<span class="rail-ic" aria-hidden="true">'+svgIcon(it.g||"document","ic-rail")+'</span>'+
         '<div><b>'+esc(it.t)+'</b>'+(it.s?'<small>'+esc(it.s)+"</small>":"")+"</div></div>";
    });
    h+='</div></div>';
  }
  h+='<div class="rail-safe"><div class="rail-head">'+svgIcon("lock","ic-sm")+'안심하고 작성하세요</div>'+
     "<p>적으신 내용은 저장·전송되지 않고, 인쇄가 끝나거나 자리를 비우면 지워집니다.</p>"+
     "<p>불편한 칸은 비워 두고 <b>인쇄한 뒤</b> 적으셔도 됩니다. "+
     "출력물은 <b>본인이</b> 챙겨 주세요.</p></div>";
  box.innerHTML=h;
}

function renderStepper(){
  if(isRailShell()){ renderRailProg(); renderRailInfo(); return; }
  var cur=state.step, STEPS=FORM.STEPS, h='';
  /* ⚠️ 세는 것은 **활성 단계**다. 숨긴 단계까지 세면 「진행 5 / 10」인데 다섯 번만
     누르면 끝나는 식이 되어 시민이 남은 양을 잘못 짐작한다. */
  var act=activeSteps(), TOTAL=act.length, pos=act.indexOf(cur)+1;
  var fill=document.getElementById("pbarFill");
  if(fill) fill.style.width = Math.round((pos||1)/(TOTAL||1)*100)+"%";
  for(var ai=0; ai<act.length; ai++){
    var n=act[ai], i=n-1, done=n<cur, now=n===cur;
    var cls="stp"+(done?" done":(now?" cur":""));
    var tick='<span class="tick" aria-hidden="true">'+(done?"✓":(now?"▶":"·"))+'</span>';
    var lab='<span>'+esc(STEPS[i].short)+'</span>';
    h += done
      ? '<button type="button" class="'+cls+'" data-goto="'+n+'"'
        +' aria-label="'+esc(STEPS[i].short)+' 단계로 돌아가기">'+tick+lab+'</button>'
      : '<span class="'+cls+'">'+tick+lab+'</span>';
  }
  el.stepper.innerHTML=h;
  el.stepper.setAttribute("aria-valuemax", TOTAL);
  el.stepper.setAttribute("aria-valuenow", pos);
  el.stepper.setAttribute("aria-valuetext", pos+" / "+TOTAL+" 단계 · "+STEPS[cur-1].short);
}
/* ══ 단계가 바뀔 때만 질문면을 짧게 들여보낸다 (2026.08.30 · 공통 마감 ⑤) ═══════
   ⛔ **매번 돌리지 마라.** 선택지를 하나 누를 때마다 `renderAll()` 이 질문면을 다시
      그리는데, 그때도 연출이 돌면 고를 때마다 화면이 들썩인다.
   ⚠️ 그래서 「단계 번호가 달라졌을 때」만 class 를 다시 건다.
   ⚠️ 줄여 달라고 한 사용자에게는 CSS 가 애니메이션을 통째로 끈다(§17) — 여기서
      따로 갈라 두지 않아도 된다. class 만 붙고 아무 일도 일어나지 않는다.
   ⛔ **이 둘은 최상위여야 한다.** 한 번 `renderStepper()` 안에 넣었다가 `stepMotion` 이
      지역 함수가 되어 `renderStep()` 이 ReferenceError 로 죽었다 — 화면이 아니라
      **인쇄물 16쪽**이 깨져서야 드러났다(2026.08.30). */
var lastMotionStep=null;
function stepMotion(step){
  if(!el.wizBody) return;
  if(step===lastMotionStep) return;
  lastMotionStep=step;
  el.wizBody.classList.remove("step-in");
  void el.wizBody.offsetWidth;          // ⚠️ 리플로우 — 없으면 다시 타지 않는다
  el.wizBody.classList.add("step-in");
}

function renderStep(){
  var def=FORM.STEPS[state.step-1];
  var act=activeSteps(), TOTAL=act.length, pos=act.indexOf(state.step)+1;
  /* ⚠️ 제목을 **함수**로도 받는다(2026.08.29 · 실사용 QA 1차).
     한 단계가 조건에 따라 다른 항목을 보일 때, 고정 제목은 **화면에 없는 항목을 말한다**
     (혼인 「⑨⑩⑧ 출석·제출·동의」 — 미성년이 아니면 ⑧ 이 없다.
      이혼 「③④ … 재판확정일자 …」 — 협의이혼이면 ④ 가 없다).
     ⛔ `short`(안내 기둥의 묶음 이름)는 고정이다. 진행 표시가 흔들리면 안 된다. */
  el.wizTitle.textContent = (typeof def.title==="function") ? def.title(state) : def.title;
  el.wizCount.textContent="진행 "+pos+" / "+TOTAL;   // 여권과 같은 문구
  el.wizBody.innerHTML=renderStepBody(state.step);
  stepMotion(state.step);
  el.stepWarn.textContent="";
  el.btnPrev.disabled = !prevActive(state.step);
  /* ⛔ 새 껍데기에서는 이모지·화살표 활자를 쓰지 않는다 — 선 아이콘이 껍데기 안에 있다.
     ⚠️ 마지막 단계의 [신청서 인쇄]는 여권 Product Flow 와 같은 자리다. */
  if(isRailShell()){
    var lastLbl = isLastStep() ? "신청서 인쇄" : "다음";
    var sp=el.btnNext.querySelector("span"); if(sp) sp.textContent=lastLbl;
    var ic=el.btnNext.querySelector(".btn-ic");
    if(ic) ic.style.display = isLastStep() ? "none" : "";
  } else {
    el.btnNext.textContent = isLastStep() ? "인쇄하기 🖨️" : "다음 →";
  }
  var skipWrap = el.btnSkip.closest ? el.btnSkip.closest(".ask-skip") : null;
  var hideSkip = (def.kind==="intro"||def.kind==="summary");
  if(skipWrap) skipWrap.style.display = hideSkip ? "none" : "";
  el.btnSkip.style.display = hideSkip ? "none" : "block";
  renderStepper();
}
function renderAll(){ normalizeStep(); renderStep(); renderForm(); }

/* 6) 검증 · 네비게이션 */

/* ══ 조건부 단계 (2026.08.29) ═══════════════════════════════════════════
   서식이 단계에 `when:function(state){…}` 를 달면 **거짓일 때 그 단계를 건너뛴다.**
   출생신고의 「아버지(부) 정보」가 첫 사례다 — 혼인 외 출생이면 적을 것이 없는데도
   화면이 나와서, 「모든 항목 필수」로 바꾸는 순간 **그분들이 갇힌다.**

   ⚠️ `state.step` 은 **`FORM.STEPS` 의 절대 번호**를 그대로 쓴다. 걸러낸 목록의 번호로
      바꾸지 않는다 — `STEP_HL`·`applySample`·`required` 가 전부 절대 번호를 쓰고 있어
      한 곳만 어긋나도 조용히 엉뚱한 단계가 강조된다.
   ⚠️ 화면에 보이는 「진행 n / N」과 진행 막대는 **활성 단계 기준**으로 센다.
   ⛔ `when` 이 없는 서식(나머지 4종)은 전부 활성이라 지금과 완전히 같다. */
function stepActive(n){
  var d=FORM.STEPS[n-1];
  return !!d && (!d.when || !!d.when(state));
}
function activeSteps(){
  var a=[];
  for(var i=1;i<=FORM.STEPS.length;i++) if(stepActive(i)) a.push(i);
  return a;
}
/* 지금 서 있는 단계가 조건이 바뀌어 사라졌으면 **앞쪽에서 가장 가까운 활성 단계**로 옮긴다.
   (예: 4단계에 서 있다가 2단계로 돌아가 「혼인 외」로 바꾸고 다시 온 경우) */
function normalizeStep(){
  if(stepActive(state.step)) return;
  var a=activeSteps(); if(!a.length) return;
  for(var i=0;i<a.length;i++) if(a[i]>state.step){ state.step=a[i]; return; }
  state.step=a[a.length-1];
}
function requiredMissing(step){
  var def=FORM.STEPS[step-1];
  return def.required ? (def.required(state)||[]) : [];
}
/* 「비었는가」가 아니라 「값이 말이 되는가」를 본다(예: 출생 시각 25시).
   ⚠️ `required` 와 나눠 둔 이유는 **안내 문장이 다르기 때문**이다 —
      비었으면 「입력해 주세요」, 틀렸으면 그 자리에서 무엇이 잘못인지 말해야 한다.
   ⛔ 이 훅이 없는 서식은 아무 일도 일어나지 않는다(나머지 4종). */
function stepInvalid(step){
  var def=FORM.STEPS[step-1];
  return def.invalid ? (def.invalid(state)||[]) : [];
}
// 인쇄 직전 알림: 여백 없음·배율 100%(실제 크기)로 인쇄해야 서식이 정확히 출력됨
function doPrint(){
  var why="실제 크기로 인쇄해야 서식의 칸 위치가 정확하게 맞습니다.";
  if(window.__printNotice){ window.__printNotice(why, function(){ window.print(); }); return; }
  window.print();
}
function nextActive(n){ var a=activeSteps(); for(var i=0;i<a.length;i++) if(a[i]>n) return a[i]; return 0; }
function prevActive(n){ var a=activeSteps(); for(var i=a.length-1;i>=0;i--) if(a[i]<n) return a[i]; return 0; }
function isLastStep(){ var a=activeSteps(); return a.length ? state.step===a[a.length-1] : true; }
function goNext(){
  if(isLastStep()){ doPrint(); return; }
  var miss=requiredMissing(state.step);
  if(miss.length){
    el.stepWarn.textContent="다음 항목을 입력해 주세요: "+miss.join(", ");
    return;
  }
  var bad=stepInvalid(state.step);
  if(bad.length){ el.stepWarn.textContent=bad.join(" · "); return; }
  var n=nextActive(state.step); if(!n) return;
  state.step=n; renderAll(); scrollTop();
}
function goPrev(){ var n=prevActive(state.step); if(n){ state.step=n; renderAll(); scrollTop(); } }
function gotoStep(n){ if(n>=1 && n<state.step && stepActive(n)){ state.step=n; renderAll(); scrollTop(); } }
/* ⛔ **필수 항목을 건너뛰어 완성하는 길을 두지 않는다**(2026.08.29 담당자 요구).
      종전에는 이 단추가 `required` 를 통째로 넘겨서, 반드시 있어야 할 값이 빈 채로
      인쇄까지 갔다. 창구에서 되돌아오면 시민이 처음부터 다시 적는다.
   ⚠️ 그래서 지금 이 단추는 **선택 항목만** 건너뛴다. 필수가 비어 있으면 [다음]과 똑같이 막는다.
   📌 「정말로 판단이 어려운 자리」는 건너뛰기가 아니라 **직원을 부르는 길**이어야 한다 —
      Product UI v1 의 Human Handoff 로 옮기는 것이 Phase 3 과제다.
   📌 `state.unsure` 는 아직 **적히기만 하고 아무도 읽지 않는다.** 창구로 전달되지 않으므로
      이 기능은 완성된 것이 아니다(Phase 3에서 함께 정리한다). */
function skipStep(){
  var miss=requiredMissing(state.step);
  if(miss.length){
    el.stepWarn.textContent="이 항목은 비워 둘 수 없습니다: "+miss.join(", ");
    return;
  }
  var bad=stepInvalid(state.step);
  if(bad.length){ el.stepWarn.textContent=bad.join(" · "); return; }
  state.unsure[state.step]=true;
  var n=nextActive(state.step); if(n){ state.step=n; renderAll(); scrollTop(); }
}
function scrollTop(){ el.wizBody.scrollTop=0; window.scrollTo(0,0); }

/* 7) 이벤트 */
function onInput(e){
  var t=e.target, f=t.getAttribute("data-f"); if(!f) return;
  var typ=t.getAttribute("data-t"), val=t.value;
  if(typ==="jumin"){ val=t.value.replace(/\D/g,"").slice(0,13); state[f]=val; t.value=formatJumin(val);
    if(FORM.onJuminChange) FORM.onJuminChange(f, val, state);
  }
  else if(typ==="phone"){ val=t.value.replace(/\D/g,"").slice(0,11); state[f]=val; t.value=formatPhone(val); }
  else if(typ==="money"){ val=t.value.replace(/\D/g,"").slice(0,15); state[f]=val; t.value=formatMoney(val); }
  else { state[f]=val; }
  renderForm();
}
function onBlurDate(e){
  var t=e.target; if(t.getAttribute("data-t")!=="date") return;
  var f=t.getAttribute("data-f"); state[f]=formatDateFlexible(state[f]); t.value=state[f]; renderForm();
}
function onClick(e){
  var t=e.target.closest("[data-set],[data-toggle],[data-next],[data-goto],[data-childinc],[data-inc]");
  if(!t) return;
  if(t.hasAttribute("data-set")){
    var k=t.getAttribute("data-set"), val=t.getAttribute("data-val");
    state[k]=(state[k]===val)?"":val;   // 같은 항목 다시 누르면 해제(토글)
    /* ⚠️ 선택 하나로 **다음 단계의 존재 여부**가 바뀔 수 있다(조건부 단계).
       그래서 언제나 `renderAll()` 로 진행 표시까지 다시 센다.
       📌 `FORM.rerenderOnSet` 은 이제 하는 일이 없다 — 종전에도 두 갈래가
          `renderStep(); renderForm();` 으로 **똑같았다.** 5종 config 에 남아 있어
          지우지 않고 둔다(지우려면 5종을 함께 봐야 한다). */
    renderAll();
  }
  else if(t.hasAttribute("data-toggle")){ var kk=t.getAttribute("data-toggle"); state[kk]=!state[kk]; renderAll(); }
  else if(t.hasAttribute("data-next")){ goNext(); }
  else if(t.hasAttribute("data-goto")){ gotoStep(+t.getAttribute("data-goto")); }
  else if(t.hasAttribute("data-inc")){
    // 범용 카운터(별지 추가 인원·물건 수 등) — data-inc=상태키, data-by=증감, data-max/min
    var ik=t.getAttribute("data-inc"), by=+t.getAttribute("data-by")||1;
    var lo=+(t.getAttribute("data-min")||0), hi=+(t.getAttribute("data-max")||4);
    state[ik]=String(Math.max(lo, Math.min(hi, (+state[ik]||0)+by)));
    renderStep(); renderForm();
  }
  else if(t.hasAttribute("data-childinc")){
    var nc=(state.childCount||1)+(+t.getAttribute("data-childinc"));
    state.childCount=Math.max(1,Math.min(FORM.maxChild||4,nc)); renderAll();
  }
}
function onStepperKey(e){
  if(e.key!=="Enter"&&e.key!==" ") return;
  var t=e.target.closest("[data-goto]"); if(!t) return;
  e.preventDefault(); gotoStep(+t.getAttribute("data-goto"));
}

/* ══ 미리보기 = **인쇄 준비 화면** (2026.08.29 §2 정리) ═════════════════════════
   총 N장 → 축소 썸네일 → 출력물 이름 → 출력 후 행동 → 참고정보 → [N장 인쇄하기].
   ⛔ 새 업무안내 문구를 만들지 않는다. 완료 화면에 **이미 있던 확정 문구**만 옮겨 왔다
      (`FORM.afterPrint`). 없는 서식은 그 구역을 아예 내지 않는다.
   ⛔ 미리보기 전용 렌더러를 만들지 않는다. 아래 썸네일은 **실제 인쇄에 나가는 그 DOM** 이다. */

/* 인쇄에 나가는 쪽 목록. `@page{margin:0}` 이라 한 쪽의 세로/가로 비율은 A4 그대로다.
   ⛔ 서식별 장수를 적어 두지 마라 — 별지는 내용이 늘면 두 장이 된다. 여기서 **재서** 센다. */
var A4_RATIO = 297/210;
function printPageNodes(){
  var root=document.querySelector(".form-col"); if(!root) return [];
  var out=[];
  var main=root.querySelector(".paper:not(.extra)");
  if(main) out.push({node:main, label:(FORM.formName||"신청서")});
  root.querySelectorAll(".paper.extra .xpaper").forEach(function(x){
    var h2=x.querySelector("h2");
    out.push({node:x, label:(h2?h2.textContent.trim():"별지")});
  });
  return out;
}
/* 한 노드가 실제로 몇 장을 차지하는가.
   ⛔ **화면의 그 노드를 그대로 재지 마라.** 화면의 종이는 창에 맞춰 줄어 있고(1366px
      창에서 720px), 별지는 화면 여백(14mm)과 인쇄 여백(12mm)이 다르다. 좁은 폭에서는
      글이 더 접혀 세로가 길어지므로 **인쇄는 2장인데 「총 3장」이라고 말하게 된다**
      (2026.08.30 부동산 별지 최대 상태에서 실측: 화면 1.134쪽 → 인쇄 1쪽).
   ✅ 그래서 화면 밖 `.pv-measure`(폭 210mm · 인쇄 여백)에 **복제해 펴 놓고** 잰다.
   ⚠️ 0.02 는 반올림 여유다 — A4 배경 이미지(1191×1684)는 비율이 1.41393 이라
      그대로 나누면 0.9998 이 나온다. 여유가 없으면 1장이 2장으로 세어진다. */
var _pvRule=null;
function measureBox(){
  if(!_pvRule || !_pvRule.isConnected){
    _pvRule=document.createElement("div");
    _pvRule.className="pv-measure";
    document.body.appendChild(_pvRule);
  }
  return _pvRule;
}
function pagesOf(node){
  var box=measureBox(), c=node.cloneNode(true);
  c.style.width="210mm"; c.style.margin="0"; c.style.height="auto"; c.style.maxHeight="none";
  box.innerHTML=""; box.appendChild(c);
  var w=c.clientWidth, h=c.scrollHeight;
  box.innerHTML="";
  if(!w || !h) return 1;
  return Math.max(1, Math.ceil((h/w)/A4_RATIO - 0.02));
}
function previewPages(){
  return printPageNodes().map(function(p){
    return { label:p.label, node:p.node, pages:pagesOf(p.node) };
  });
}
function renderPreview(){
  var list=previewPages(), total=0;
  list.forEach(function(p){ total+=p.pages; });

  var cnt=document.getElementById("pvCount");
  if(cnt) cnt.innerHTML='총 <b>'+total+'장</b>이 인쇄됩니다';

  /* 썸네일 — 인쇄에 나가는 노드를 그대로 복제해 줄여 보여 준다.
     ⚠️ 「읽는 것」이 아니라 **무엇이 몇 장 나오는지 알아보는 것**이 목적이다. */
  var th=document.getElementById("pvThumbs");
  if(th){
    var h='', n=0;
    list.forEach(function(p){
      for(var i=0;i<p.pages;i++){
        n++;
        var cap=esc(p.label)+(p.pages>1?" ("+(i+1)+"/"+p.pages+")":"");
        h+='<figure class="pv-th"><div class="pv-th-box" data-i="'+n+'"></div>'
          +'<figcaption><span class="pv-th-no">'+n+'</span>'+cap+'</figcaption></figure>';
      }
    });
    th.innerHTML=h;
    /* 복제는 innerHTML 을 넣은 **뒤에** 붙인다(위 문자열에 노드를 넣을 수 없다) */
    var boxes=th.querySelectorAll(".pv-th-box"), bi=0;
    list.forEach(function(p){
      for(var i=0;i<p.pages;i++){
        var box=boxes[bi++]; if(!box) continue;
        var c=p.node.cloneNode(true);
        c.style.width="210mm"; c.style.margin="0"; c.style.boxShadow="none";
        /* 여러 장짜리는 그 장에 해당하는 부분만 보이게 위로 민다 */
        if(p.pages>1) c.style.marginTop = "-"+(i*297)+"mm";
        var inner=document.createElement("div");
        inner.className="pv-th-inner"; inner.appendChild(c);
        box.appendChild(inner);
      }
    });
  }

  var after=document.getElementById("pvAfter");
  if(after){
    var txt=(typeof FORM.afterPrint==="function") ? FORM.afterPrint(state) : (FORM.afterPrint||"");
    after.innerHTML = txt ? '<div class="pv-sec"><h4>인쇄한 뒤에 하실 일</h4><div>'+txt+'</div></div>' : "";
  }
  var ref=document.getElementById("pvRef");
  if(ref){
    var rt=(typeof FORM.refInfo==="function") ? FORM.refInfo(state) : (FORM.refInfo||"");
    ref.innerHTML = rt ? '<div class="pv-sec ref"><h4>참고</h4><div>'+rt+'</div></div>' : "";
  }
  var bp=document.getElementById("btnPrintModal");
  if(bp){ var sp=bp.querySelector("span"); if(sp) sp.textContent=total+"장 인쇄하기"; else bp.textContent=total+"장 인쇄하기"; }
}
function openPreview(){
  renderForm();
  document.body.classList.add("pv-open");
  renderPreview();
}
function closePreview(){ document.body.classList.remove("pv-open"); }

/* 확인 창 — 네이티브 confirm() 을 쓰지 않는다.
   키오스크(Electron)에서 네이티브 대화상자가 뜨면 창이 **비활성 상태**가 되는데,
   키오스크의 화면 이탈 방지 조치가 그것을 이탈로 오인해 포커스를 도로 가져간다.
   그러면 포커스는 있는데 입력은 막힌 채로 남아 화면이 먹통이 된다(2026.08 포터블 시험에서 확인).
   페이지 안에서 뜨고 닫히는 창이면 이 문제가 없고, 터치 대상도 크게 만들 수 있다. */
function askConfirm(message, onYes){
  var old=document.getElementById("askc"); if(old) old.remove();
  if(!document.getElementById("askc-style")){
    var st=document.createElement("style"); st.id="askc-style";
    st.textContent="@media print{#askc{display:none !important;}}";
    document.head.appendChild(st);
  }
  var back=document.createElement("div"); back.id="askc";
  back.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:200;"+
    "display:flex;align-items:center;justify-content:center;padding:20px;";
  var box=document.createElement("div");
  box.style.cssText="background:#fff;border-radius:14px;padding:26px 24px 20px;max-width:440px;"+
    "width:100%;box-shadow:0 10px 40px rgba(0,0,0,.35);font-size:17px;line-height:1.6;"+
    "color:#222;text-align:center;";
  var msg=document.createElement("div"); msg.textContent=message;
  var row=document.createElement("div"); row.style.cssText="display:flex;gap:10px;margin-top:22px;";
  var bs="flex:1;font-family:inherit;font-size:17px;font-weight:800;padding:14px;border:0;"+
         "border-radius:10px;cursor:pointer;";
  var no=document.createElement("button");
  no.textContent="아니요"; no.style.cssText=bs+"background:#e9edf3;color:#333;";
  var yes=document.createElement("button");
  yes.textContent="예"; yes.style.cssText=bs+"background:var(--blue);color:#fff;";
  function close(){ back.remove(); document.removeEventListener("keydown", onKey, true); }
  function onKey(e){ if(e.key==="Escape"){ e.preventDefault(); close(); } }
  no.addEventListener("click", close);
  yes.addEventListener("click", function(){ close(); onYes(); });
  back.addEventListener("click", function(e){ if(e.target===back) close(); });
  document.addEventListener("keydown", onKey, true);
  row.appendChild(no); row.appendChild(yes);
  box.appendChild(msg); box.appendChild(row); back.appendChild(box);
  document.body.appendChild(back);
  no.focus();
}

/* 초기화 / 예시 */
function resetAll(){
  askConfirm("입력한 모든 내용을 지우고 처음부터 다시 시작할까요?", function(){
    state=createEmptyState(); renderAll(); scrollTop();
  });
}
function fillSample(kind){
  state=createEmptyState();
  if(FORM.applySample) FORM.applySample(state, kind);
  renderAll(); scrollTop();
}

function on(id, ev, fn){ var e=document.getElementById(id); if(e) e.addEventListener(ev, fn); }
function bind(){
  el.wizBody.addEventListener("input", onInput);
  el.wizBody.addEventListener("blur", onBlurDate, true);
  el.wizBody.addEventListener("click", onClick);
  el.stepper.addEventListener("click", function(e){
    var t=e.target.closest("[data-goto]"); if(t) gotoStep(+t.getAttribute("data-goto"));
  });
  el.stepper.addEventListener("keydown", onStepperKey);
  el.btnNext.addEventListener("click", goNext);
  el.btnPrev.addEventListener("click", goPrev);
  el.btnSkip.addEventListener("click", skipStep);
  document.getElementById("btnReset").addEventListener("click", resetAll);
  var kinds=FORM.sampleKinds||["a","b"];
  document.getElementById("btnSampleAdult").addEventListener("click", function(){ fillSample(kinds[0]); });
  document.getElementById("btnSampleMinor").addEventListener("click", function(){ fillSample(kinds[1]); });
  /* ⚠️ 껍데기마다 있는 단추가 다르다 — 없으면 조용히 넘어간다.
     ⛔ 새 껍데기에는 **BAR 직접 인쇄(`btnPrint`)가 없다.** 인쇄는 미리보기를 거친다. */
  on("btnPrint", "click", function(){ doPrint(); });
  on("btnPrintModal", "click", function(){ doPrint(); });
  on("btnPreview", "click", openPreview);
  on("btnPreviewMobile", "click", openPreview);
  on("btnCloseModal", "click", closePreview);
  /* 크게 보기 — 여권과 같은 규칙. ⚠️ 저장하지 않는다(다음 시민이 물려받지 않게). */
  on("btnBig", "click", function(){
    var big=document.documentElement.classList.toggle("big");
    this.setAttribute("aria-pressed", big?"true":"false");
    var lb=document.getElementById("btnBigLabel");
    if(lb) lb.textContent = big ? "일반 보기로" : "크게 보기";
  });
  document.getElementById("modalBack").addEventListener("click", function(e){
    if(e.target===this) closePreview();
  });
}

/* 8) 초기화 */
function setText(id,txt){ var e=document.getElementById(id); if(e) e.textContent=txt; }
function setLabelHtml(id,html){ var e=document.getElementById(id); if(e) e.innerHTML=html; }
function init(){
  APP_TODAY=new Date();
  el.wizTitle=document.getElementById("wizTitle");
  el.wizCount=document.getElementById("wizCount");
  el.wizBody=document.getElementById("wizBody");
  el.stepWarn=document.getElementById("stepWarn");
  el.stepper=document.getElementById("stepper");
  el.btnPrev=document.getElementById("btnPrev");
  el.btnNext=document.getElementById("btnNext");
  el.btnSkip=document.getElementById("btnSkip");
  // 서식별 텍스트 주입
  document.title=FORM.docTitle;
  setText("docTitle", FORM.docTitle);
  setText("modalTitle", FORM.formName+" 미리보기");
  var labels=FORM.sampleLabels||["작성예시 1","작성예시 2"];
  /* ⛔ 시민 화면에 「테스트용」이라 쓰지 않는다 — 시민이 읽을 말이 아니다(Product UI v1).
     옛 껍데기 4종은 아직 그 배지를 쓰므로 갈라 둔다. */
  var tag = isRailShell() ? "" : '<span class="test-tag">테스트용</span>';
  setLabelHtml("btnSampleAdult", esc(labels[0])+tag);
  setLabelHtml("btnSampleMinor", esc(labels[1])+tag);
  document.querySelectorAll(".bg").forEach(function(img){ img.alt=FORM.formName; });
  // 이용 안내(화면 하단) — 서식 고유 문구가 있으면 교체, 없으면 base.html 기본 문구
  if(FORM.noticeItems){
    var nl=document.getElementById("noticeList");
    if(nl) nl.innerHTML=FORM.noticeItems.map(function(t){ return "<li>"+esc(t)+"</li>"; }).join("");
  }
  /* 기관 표기 — config 의 값이 기본이고, 키오스크 환경설정에 기관명이 들어 있으면
     그것이 이긴다(다른 기관이 같은 배포본을 쓰게 하려는 것. base.html 의 SITE-CONFIG 참조).
     설정이 없는 웹 배포본에서는 `__site` 자체가 없으므로 config 값이 그대로 쓰인다. */
  var org=FORM.org||{orgName:"경기도 군포시", officeName:"군포시청 민원실"};
  if(typeof window!=="undefined" && window.__site) org=window.__site.org(org);
  setText("orgName", org.orgName);
  setText("today", formatDate(APP_TODAY));
  document.querySelectorAll(".bg").forEach(function(img){ img.src=FORM_IMG; });
  // 서식별 첨부 페이지 CSS 주입(있을 때만)
  if(FORM.extraCss){
    var st=document.createElement("style"); st.textContent=FORM.extraCss;
    document.head.appendChild(st);
  }
  bind();
  /* ⛔ 여기서 `aria-valuemax` 를 따로 넣지 않는다 — `renderStepper()` 가 **활성 단계 수**로
     매번 다시 넣는다. 조건부 단계가 생긴 뒤로는 전체 개수가 답이 아니다(2026.08.29). */
  renderAll();
}
init();
