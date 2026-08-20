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

/* 5) 우측 위저드 렌더 */
var el={};
function num(i){ return "①②③④⑤⑥⑦⑧⑨⑩".charAt(i); }

function inputHtml(f){
  var v=state[f.k]||"", req=f.req?'<span class="fb fb-req">필수</span>':'<span class="fb fb-opt">선택</span>';
  // 재렌더(단계 이동·조건부 갱신) 때도 입력 중과 같은 형식으로 보이게 한다
  if(f.type==="money") v=formatMoney(v);
  else if(f.type==="jumin") v=formatJumin(v);
  else if(f.type==="phone") v=formatPhone(v);
  var cls="field"+(f.half?" half":"");
  var h='<div class="'+cls+'"><label class="field-label" for="in_'+f.k+'">'+esc(f.label)+req+'</label>';
  if(f.help) h+='<div class="q-help">'+esc(f.help)+'</div>';
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
function sumRow(k,val){
  var empty=!val;
  return '<div class="sum-row"><span class="k">'+esc(k)+'</span>'
    +'<span class="val'+(empty?" empty":"")+'">'+(empty?"(비어 있음)":esc(val))+'</span></div>';
}

// 서식 config의 단계 body(API)에 넘길 헬퍼 묶음
var API={ get state(){return state;}, esc:esc, inputHtml:inputHtml, choiceHtml:choiceHtml,
  toggleHtml:toggleHtml, sumRow:sumRow, num:num, formatJumin:formatJumin, formatPhone:formatPhone,
  formatMoney:formatMoney, digits:digits };

function renderStepBody(step){
  var def=FORM.STEPS[step-1], h='';
  h+='<div class="coach-q">'+esc(def.q)+'</div>';
  if(def.why) h+='<div class="why-box"><span class="ic">💡</span><span>'+esc(def.why)+'</span></div>';
  if(def.body) h+=def.body(API);
  return h;
}

function renderStepper(){
  var cur=state.step, STEPS=FORM.STEPS, TOTAL=STEPS.length, h='';
  for(var i=0;i<TOTAL;i++){
    var n=i+1, cls="stp", inner=String(n);
    if(n<cur){ cls+=" done nav"; inner="✓"; }
    else if(n===cur){ cls+=" cur"; }
    var navAttr = n<cur ? ' data-goto="'+n+'" tabindex="0" role="button" aria-label="'+esc(STEPS[i].short)+' 단계로"' : '';
    h+='<div class="'+cls+'"><div class="stp-dot"'+navAttr+'>'+inner+'</div>'
      +'<div class="stp-lab">'+esc(STEPS[i].short)+'</div></div>';
  }
  el.stepper.innerHTML=h;
  el.stepper.setAttribute("aria-valuenow", cur);
}
function renderStep(){
  var def=FORM.STEPS[state.step-1], TOTAL=FORM.STEPS.length;
  el.wizTitle.textContent=def.title;
  el.wizCount.textContent=state.step+" / "+TOTAL+" 단계";
  el.wizBody.innerHTML=renderStepBody(state.step);
  el.stepWarn.textContent="";
  el.btnPrev.disabled = state.step===1;
  el.btnNext.textContent = state.step===TOTAL ? "인쇄하기 🖨️" : "다음 →";
  el.btnSkip.style.display = (def.kind==="intro"||def.kind==="summary") ? "none" : "block";
  renderStepper();
}
function renderAll(){ renderStep(); renderForm(); }

/* 6) 검증 · 네비게이션 */
function requiredMissing(step){
  var def=FORM.STEPS[step-1];
  return def.required ? (def.required(state)||[]) : [];
}
// 인쇄 직전 알림: 여백 없음·배율 100%(실제 크기)로 인쇄해야 서식이 정확히 출력됨
function doPrint(){
  var why="실제 크기로 인쇄해야 서식의 칸 위치가 정확하게 맞습니다.";
  if(window.__printNotice){ window.__printNotice(why, function(){ window.print(); }); return; }
  window.print();
}
function goNext(){
  var TOTAL=FORM.STEPS.length;
  if(state.step===TOTAL){ doPrint(); return; }
  var miss=requiredMissing(state.step);
  if(miss.length){
    el.stepWarn.textContent="다음 항목을 입력해 주세요: "+miss.join(", ");
    return;
  }
  state.step++; renderAll(); scrollTop();
}
function goPrev(){ if(state.step>1){ state.step--; renderAll(); scrollTop(); } }
function gotoStep(n){ if(n>=1 && n<state.step){ state.step=n; renderAll(); scrollTop(); } }
function skipStep(){ var TOTAL=FORM.STEPS.length; state.unsure[state.step]=true; if(state.step<TOTAL){ state.step++; renderAll(); scrollTop(); } }
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
    if((FORM.rerenderOnSet||[]).indexOf(k)>=0){ renderStep(); renderForm(); }
    else renderAll();
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

/* 미리보기 모달 */
function openPreview(){ renderForm(); document.body.classList.add("pv-open"); }
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
  document.getElementById("btnPrint").addEventListener("click", function(){ doPrint(); });
  document.getElementById("btnPreview").addEventListener("click", openPreview);
  document.getElementById("btnPreviewMobile").addEventListener("click", openPreview);
  document.getElementById("btnCloseModal").addEventListener("click", closePreview);
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
  setLabelHtml("btnSampleAdult", esc(labels[0])+'<span class="test-tag">테스트용</span>');
  setLabelHtml("btnSampleMinor", esc(labels[1])+'<span class="test-tag">테스트용</span>');
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
  renderAll();
  el.stepper.setAttribute("aria-valuemax", FORM.STEPS.length);
}
init();
