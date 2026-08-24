# -*- coding: utf-8 -*-
"""기관별 설정(환경설정 창의 값)이 화면에 실제로 걸리는지 본다.

설정을 바꿔도 **인쇄물은 그대로여야** 하므로 `verify-print.py` 가 그쪽을 지키고,
이 도구는 **화면 쪽**을 지킨다 — 기관 표기·대표색·취급 서식·여권 접수 기준이
설정대로 걸리는지, 그리고 **설정이 없을 때 종전 동작 그대로인지**(웹 배포본)를 본다.

    python tools/verify-site-config.py              # 검사 — 어긋나면 exit 1
    python tools/verify-site-config.py -v           # 참고값까지 전부 출력

    # 눈으로 볼 때 (색·로고를 고를 때 편하다). 브라우저가 열린다.
    python tools/verify-site-config.py --preview index.html --color "#7a2f6d" --org "경기도 안양시"
    python tools/verify-site-config.py --preview passport-helper-v1.html --proxy --no-keyboard

동작 방식: 서식 HTML 에 `window.__kioskCfg` 를 심은 임시 파일을 만들고 헤드리스 크롬으로
띄운 뒤, 화면 안에서 시나리오를 태워 결과를 JSON 으로 돌려받는다. 키오스크에서 preload 가
하는 일과 같은 것을 흉내 낸다.
"""
import argparse
import io
import json
import os
import re
import subprocess
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]


def chrome():
    for p in CHROME_CANDIDATES:
        if os.path.exists(p):
            return p
    sys.exit("크롬을 찾지 못했습니다. verify-print.py 의 CHROME_CANDIDATES 를 확인하세요.")


def build(src, cfg, script=None):
    """설정을 심은 임시 HTML 을 만들어 경로를 돌려준다."""
    s = io.open(os.path.join(ROOT, src), encoding="utf-8").read()
    # ⚠️ preload 와 같은 자리 — SITE-CONFIG 블록보다 **먼저** 들어가야 한다.
    inject = "<script>window.__kioskCfg=%s;</script>" % json.dumps(cfg, ensure_ascii=False)
    s = s.replace("<head>", "<head>" + inject, 1)
    if script:
        test = ('<script>setTimeout(function(){var R;try{R=(function(){%s})();}'
                'catch(e){R={ERR:String(e&&e.stack||e)};}'
                'var d=document.createElement("div");d.id="__R";'
                'd.textContent=JSON.stringify(R);document.body.appendChild(d);},250);</script>' % script)
        s = s.replace("</body>", test + "</body>")
    p = os.path.join(ROOT, "_sc_%s" % os.path.basename(src))
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    return p


def run(src, cfg, script):
    p = build(src, cfg, script)
    try:
        out = subprocess.run(
            [chrome(), "--headless=new", "--disable-gpu", "--no-sandbox",
             "--virtual-time-budget=4000", "--dump-dom", "file:///" + p.replace("\\", "/")],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        try:
            os.remove(p)
        except OSError:
            pass
    m = re.search(r'<div id="__R">(.*?)</div>', out.stdout or "", re.S)
    if not m:
        return {"ERR": "결과를 못 받았습니다 (화면이 뜨지 않았거나 스크립트가 죽었습니다)"}
    raw = (m.group(1).replace("&quot;", '"').replace("&lt;", "<")
           .replace("&gt;", ">").replace("&amp;", "&"))
    try:
        return json.loads(raw)
    except ValueError as e:
        return {"ERR": "결과를 읽지 못했습니다: %s" % e}


# ── 시나리오 ──────────────────────────────────────────────────────────
# 값이 True 면 통과. `참고_` 로 시작하는 항목은 눈으로 보라고 찍는 것이고 판정하지 않는다.

CLICK = '''
function click(txt){
  var n=[].filter.call(document.querySelectorAll(".card"),
         function(b){ return b.textContent.indexOf(txt)>=0; })[0];
  if(!n) return "X 카드 없음: "+txt;
  n.click(); return true;
}
function labels(){ return [].map.call(document.querySelectorAll(".card .card-label"),
                                      function(n){ return n.textContent; }); }
'''

SCENARIOS = [
    ("허브 — 기관 표기·대표색·취급 서식",
     "index.html",
     {"org": {"orgName": "경기도 안양시"}, "themeColor": "#7a2f6d",
      "forms": {"passport": False, "death": False}},
     '''
     /* ⚠️ 2026.08.24 — 허브가 배치 1 로 바뀌면서 마크업이 달라졌다.
        종전에는 `.card .title`·`.sec-head h3` 를 봤는데, 그 선택자가 아무것도 못 찾아
        **「끈서식숨음」·「빈섹션사라짐」이 빈 배열로 거짓 통과**하고 있었다.
        이제 시민의 말(`.card-label`)과 행정명칭(`.card-formal`) 둘 다 본다. */
     var cs=getComputedStyle(document.documentElement);
     var L=[].map.call(document.querySelectorAll(".card .card-label"),function(n){return n.textContent;});
     var F=[].map.call(document.querySelectorAll(".card .card-formal"),function(n){return n.textContent;});
     return {
       기관명바뀜: document.getElementById("orgName").textContent==="경기도 안양시",
       대표색바뀜: cs.getPropertyValue("--blue").indexOf("310")>=0,
       그라데이션생김: cs.getPropertyValue("--grad").indexOf("gradient")>=0,
       끈서식숨음: L.indexOf("여권 만들기")<0 && F.indexOf("여권발급신청서")<0
                && L.indexOf("사망 신고하기")<0 && F.indexOf("사망신고서")<0,
       켠서식보임: L.indexOf("혼인 신고하기")>=0 && F.indexOf("혼인신고서")>=0,
       카드가여섯장: L.length===6 && F.length===6,
       시민의말이큰글씨: L.length>0 && F.length===L.length,
       참고_대표색: cs.getPropertyValue("--blue").trim(),
       참고_남은카드: L.join(" · ")
     };'''),

    ("허브 — 설정이 없을 때 (웹 배포본)",
     "index.html", {},
     '''
     var L=[].map.call(document.querySelectorAll(".card .card-label"),function(n){return n.textContent;});
     return {
       기본기관명: document.getElementById("orgName").textContent==="경기도 군포시",
       기본대표색: getComputedStyle(document.documentElement).getPropertyValue("--blue").trim()==="#1b5fc0",
       서식전부보임: L.length===8,
       참고_카드: L.join(" · ")
     };'''),

    ("여권 — 기본값(대리 신청은 창구로)",
     "passport-helper-v1.html", {},
     CLICK + '''
     var out={ 참고_첫화면: labels(), 대리카드있음: labels().join("|").indexOf("대신 신청")>=0 };
     click("대신 신청");
     out.창구로전환=!!state.ui.counter;
     out.사유코드가P01=!!state.ui.counter && state.ui.counter.code==="P-01";
     out.경로안바뀜=state.ui.path===null;
     out.코드보임=!!document.querySelector(".counter-code");
     return out;'''),

    ("여권 — 대리 허용·로마자 재입력·긴급연락처 선택·코드 숨김·터치 전용",
     "passport-helper-v1.html",
     {"org": {"orgName": "경기도 안양시"},
      "policy": {"allowProxy": True, "allowRomanBlank": False,
                 "requireEmergency": False, "showCounterCode": False},
      "hasKeyboard": False},
     CLICK + '''
     var out={};
     out.기관명바뀜=document.getElementById("orgName").textContent==="경기도 안양시";
     out.키보드안내나옴=!!document.querySelector(".kb-help");
     out.대리경로진입=click("대신 신청")===true && state.ui.path==="proxy";
     out.applyBy대리인=state.data.applyBy==="대리인";
     click("확인했습니다");
     state.data.nameKor="홍길동"; state.ui.status.jumin="manual";
     var ids=[];
     for(var i=0;i<40;i++){
       var id=curScreenId(); ids.push(id);
       if(id==="confirm") break;
       if(id==="phone"){ state.data.phone="01011112222"; goNext(); continue; }
       if(id==="agent"){ state.data.agentName="김대리"; state.data.guardianRel="배우자";
                         state.data.agentBirth="19800101"; state.data.agentPhone="01033334444";
                         state.data.agentAddr="경기도 안양시"; goNext(); continue; }
       if(id==="oldpass"){ click("있습니다"); continue; }
       if(id==="romansame"){ click("같은 이름"); continue; }
       if(id==="roman"){ state.data.romanSur="HONG"; state.data.romanGiven="GILDONG"; goNext(); continue; }
       if(id==="kind"){ click("일반 여권"); continue; }
       if(id==="period"){ click("10년"); continue; }
       if(id==="pages"){ click("58면"); continue; }
       if(id==="recv"){ click("창구에서 직접"); continue; }
       if(id==="extra"){ click("해당하는 것이 없습니다"); continue; }
       goNext();
     }
     out.끝까지감=ids[ids.length-1]==="confirm";
     out.로마자다시입력받음=ids.indexOf("roman")>=0;      // 빈칸 접수를 끈 기관
     out.위임장붙음=needsProxy(state.data) && document.body.classList.contains("needs-proxy");
     out.동의서는아님=!needsConsent(state.data);
     out.긴급연락처건너뜀=!POLICY.requireEmergency;
     toCounter("P-04"); renderAll();
     out.코드숨음=!document.querySelector(".counter-code");
     out.사유는보임=!!document.querySelector(".counter-reason");
     out.참고_지난화면=ids.join(" → ");
     return out;'''),

    ("여권 — 미성년 유효기간 고정을 끈 경우",
     "passport-helper-v1.html", {"policy": {"minorPeriodFixed": False}},
     CLICK + '''
     click("미성년 자녀"); click("네, 제가 부모"); click("확인했습니다");
     var ids=[];
     for(var i=0;i<40;i++){
       var id=curScreenId(); ids.push(id);
       if(id==="confirm"||id==="period") break;
       if(id==="oldpass"){ click("없습니다"); continue; }
       if(id==="roman"){ state.data.romanSur="A"; state.data.romanGiven="B"; goNext(); continue; }
       if(id==="kind"){ click("일반 여권"); continue; }
       state.data.nameKor="홍아기"; state.ui.status.jumin="manual";
       goNext();
     }
     var lb=labels();
     return {
       유효기간을물어봄: ids.indexOf("period")>=0,
       "10년은안보임": lb.indexOf("10년")<0,        // 미성년은 법으로 10년 여권을 못 받는다
       "5년은보임": lb.indexOf("5년")>=0,
       참고_카드: lb
     };'''),

    ("여권 — 미성년 유효기간 고정(기본)",
     "passport-helper-v1.html", {},
     CLICK + '''
     click("미성년 자녀"); click("네, 제가 부모"); click("확인했습니다");
     applyAgeRules();
     return {
       기간을묻지않음: flow().indexOf("period")<0,
       기간이5년: state.data.period==="5년",
       동의서경로: needsConsent(state.data)===true
     };'''),
]


def check(verbose):
    fails = 0
    for title, src, cfg, script in SCENARIOS:
        print("\n== %s ==" % title)
        r = run(src, cfg, script)
        if "ERR" in r:
            print("  X", r["ERR"])
            fails += 1
            continue
        bad = 0
        for k, v in r.items():
            if k.startswith("참고_"):
                if verbose:
                    print("     %s : %s" % (k[3:], v))
                continue
            ok = (v is True)
            if not ok:
                bad += 1
            print("  %s %s%s" % ("✓" if ok else "X", k, "" if ok else "  → %s" % v))
        if bad:
            fails += 1
    print()
    if fails:
        print("X %d 개 시나리오가 어긋납니다." % fails)
        return 1
    print("✓ 전부 통과 — 시나리오 %d 개" % len(SCENARIOS))
    return 0


def preview(args):
    cfg = {}
    if args.config:
        raw = args.config
        if os.path.exists(raw):
            raw = io.open(raw, encoding="utf-8").read()
        cfg = json.loads(raw)
    if args.org:
        cfg.setdefault("org", {})["orgName"] = args.org
    if args.color:
        cfg["themeColor"] = args.color
    if args.no_keyboard:
        cfg["hasKeyboard"] = False
    if args.proxy:
        cfg.setdefault("policy", {})["allowProxy"] = True
    if args.off:
        cfg.setdefault("forms", {})
        for k in args.off:
            cfg["forms"][k] = False

    p = build(args.preview, cfg)          # 지우지 않는다 — 브라우저가 읽어야 한다
    print("설정 : %s" % json.dumps(cfg, ensure_ascii=False))
    print("파일 : %s" % p)
    print("  ⚠️ `_` 로 시작하는 임시 파일입니다. 확인이 끝나면 지우세요.")
    try:
        os.startfile(p)                   # Windows 기본 브라우저
    except Exception:
        print("  브라우저를 열지 못했습니다. 위 파일을 직접 여세요.")
    return 0


def main():
    ap = argparse.ArgumentParser(description="기관별 설정이 화면에 걸리는지 검사·미리보기")
    ap.add_argument("-v", "--verbose", action="store_true", help="참고값까지 출력")
    ap.add_argument("--preview", metavar="파일", help="검사 대신 설정을 심은 화면을 브라우저로 연다")
    ap.add_argument("--config", metavar="JSON|경로", help="미리보기에 쓸 설정(JSON 문자열 또는 파일)")
    ap.add_argument("--org", metavar="기관명", help="미리보기: 기관명")
    ap.add_argument("--color", metavar="#RRGGBB", help="미리보기: 대표색")
    ap.add_argument("--no-keyboard", action="store_true", help="미리보기: 터치 전용")
    ap.add_argument("--proxy", action="store_true", help="미리보기: 여권 대리 신청 허용")
    ap.add_argument("--off", action="append", metavar="서식", help="미리보기: 끄는 서식(여러 번)")
    args = ap.parse_args()
    return preview(args) if args.preview else check(args.verbose)


if __name__ == "__main__":
    sys.exit(main())
