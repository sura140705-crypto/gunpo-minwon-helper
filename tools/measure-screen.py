# -*- coding: utf-8 -*-
"""화면 구조 실측 — 영역 폭·높이·넘침을 재서 **화면 회귀**를 잡는다.

    python tools/measure-screen.py                 # 전 시나리오 측정 + 기준선과 비교
    python tools/measure-screen.py --only pass     # 이름에 pass 가 든 것만
    python tools/measure-screen.py --baseline      # 지금 값을 기준선으로 저장
    python tools/measure-screen.py --json out.json # 결과를 파일로
    python tools/measure-screen.py -v              # 값 전부 보기

⚠️ **이 도구는 픽셀을 고정하지 않는다.** `verify-print.py` 는 인쇄물을 1px 도 못 움직이게
   묶어 두지만, 화면은 계속 바뀌는 것이 정상이다. 그래서 여기서는 **구조값을 재고**
   기준선과 **달라진 것을 보여 줄 뿐**이고, 다음 셋만 실패로 본다(종료코드 1).

     ① 가로 넘침이 생긴 화면      — 글자가 잘리거나 가로 스크롤이 생겼다는 뜻
     ② 종이 크기가 달라진 화면    — 794×1122(A4 1:1)는 인쇄 좌표의 화면 쪽 짝이다
     ③ 화면이 아예 안 그려진 경우 — 영역이 사라졌거나 스크립트가 죽었다

   ⛔ 값이 달라졌다고 자동으로 기준선을 갱신하지 마라. **왜 달라졌는지 적고** 나서
      `--baseline` 을 돌린다(`verify-print.py --update` 와 같은 규칙이다).

기준선: `tests/screen-baseline.json`
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
BASELINE = os.path.join(ROOT, "tests", "screen-baseline.json")
CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

# 서식 안에서 카드를 누르는 공용 함수 (design-shots.py 와 같은 것)
CLICK = '''
function click(t){ var n=[].filter.call(document.querySelectorAll(".card"),
  function(b){ return b.textContent.indexOf(t)>=0; })[0]; if(n) n.click(); }
'''
BIG = 'document.getElementById("btnBig").click();'

# (이름, 소스, 설정, 상태 스크립트, 화면크기)
#
# ⚠️ 상태 스크립트는 `design-shots.py` 와 **같은 것을 쓴다.** 갈무리와 실측이 다른 화면을
#    보면 둘을 맞춰 볼 수 없다. 시나리오를 늘릴 때 두 파일을 함께 고쳐라.
W, H = 1920, 1080
SCENARIOS = [
    ("hub-01-첫화면",        "index.html", {}, "", (W, H)),
    ("hub-02-크게",          "index.html", {}, BIG, (W, H)),
    ("hub-03-세로",          "index.html", {}, "", (1080, 1920)),
    ("pass-01-경로선택",     "passport-helper-v1.html", {}, "", (W, H)),
    ("pass-03-입력화면",     "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다"); goNext();', (W, H)),
    # ⚠️ 2026.08.28 단계 4 — 두 화면을 정식 시나리오로 올렸다. 여태 임시로 재던 자리인데
    #    ① 주민번호는 **카드와 입력칸이 한 화면에** 있는 유일한 형태이고
    #    ② 법정대리인은 **입력칸이 가장 많은 화면**(495px 질문면에서 가장 먼저 넘친다).
    #    ⛔ 화면 수를 늘리려고 시나리오를 더 붙이지 마라 — 재는 데 드는 시간만큼 안 돌린다.
    ("pass-02-주민번호",     "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다"); '
             'state.data.nameKor="홍길동"; goNext(); goNext();', (W, H)),
    ("pass-04-최종확인",     "passport-helper-v1.html", {},
     'fillSample("adult"); renderAll(); state.step=flow().length; renderAll();', (W, H)),
    ("pass-07-법정대리인",   "passport-helper-v1.html", {},
     'fillSample("minor"); state.step=flow().indexOf("guardian")+1; renderAll();', (W, H)),
    ("pass-08-공동친권자",   "passport-helper-v1.html", {},
     'fillSample("minor"); state.data.guardian2Name=""; state.data.guardian2Rel="";'
     'state.step=flow().indexOf("guardian2")+1; renderAll();', (W, H)),
    ("pass-09-로마자이름",   "passport-helper-v1.html", {},
     'fillSample("adult"); state.data.romanSur=""; state.data.romanGiven="";'
     'state.step=flow().indexOf("roman")+1; renderAll();', (W, H)),
    ("pass-10a-일반보기",    "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다"); click("확인했습니다");', (W, H)),
    ("pass-10b-크게보기",    "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다"); click("확인했습니다");' + BIG, (W, H)),
    ("pass-12-최종확인크게",  "passport-helper-v1.html", {},
     'fillSample("adult"); renderAll(); state.step=flow().length; renderAll();' + BIG, (W, H)),
    ("pass-13-미성년2쪽",    "passport-helper-v1.html", {},
     'fillSample("minor"); renderAll();', (W, H)),
    ("pass-14-세로",         "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다"); goNext();', (1080, 1920)),
]

# 재는 것 — **구조**와 **넘침**만. 색·글자는 눈으로 보는 편이 낫다(갈무리가 그 몫이다).
PROBE = r'''
function m(sel){
  var n=document.querySelector(sel); if(!n) return null;
  var r=n.getBoundingClientRect();
  return {w:Math.round(r.width), h:Math.round(r.height),
          x:Math.round(r.left), y:Math.round(r.top),
          ox:n.scrollWidth-n.clientWidth, oy:n.scrollHeight-n.clientHeight};
}
/* 가로로 넘치는 요소 — **글자가 잘리는 자리**다. 세로 넘침은 스크롤로 읽을 수 있지만
   가로 넘침은 키오스크에서 사실상 못 읽는다.

   ⚠️ **입력칸(`input`·`textarea`·`select`)은 빼고 센다**(2026.08.28에 오탐을 잡았다).
      적은 값이 칸보다 길면 브라우저가 칸 **안에서** 가로로 굴린다 — 캐럿을 따라 보이므로
      잘린 것이 아니다. 실제로 법정대리인 화면의 주소 예시가 9px 넘쳤는데, 단계 3에서도
      똑같이 넘쳤다(조형 변경과 무관). 이것을 실패로 세면 매 단계 거짓 경보가 난다.
      대신 아래 `입력칸넘침` 으로 **보고만** 한다 — 칸이 정말 좁아지면 눈에 걸리게. */
function isField(n){ var t=n.tagName; return t==="INPUT"||t==="TEXTAREA"||t==="SELECT"; }
function wide(){
  var out=[], fields=[], all=document.querySelectorAll("body *");
  for(var i=0;i<all.length;i++){
    var n=all[i];
    if(n.scrollWidth - n.clientWidth > 1 && n.clientWidth > 0){
      var c=getComputedStyle(n);
      if(c.overflowX==="auto"||c.overflowX==="scroll") continue;   // 구르라고 만든 자리
      var name=(n.className&&n.className.baseVal===undefined&&n.className
                ? "."+String(n.className).trim().split(/\s+/)[0]
                : n.tagName.toLowerCase())+" +"+(n.scrollWidth-n.clientWidth);
      (isField(n) ? fields : out).push(name);
    }
  }
  return [out.slice(0,8), fields.slice(0,8)];
}
function tok(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
var paper=[].filter.call(document.querySelectorAll(".form-col .paper, .paper-fit .gp-img"),
  function(n){ return n.offsetParent!==null; })[0];
var pr=paper?paper.getBoundingClientRect():null;
var nav=document.querySelector(".wiz-nav");
var out={
  뷰포트:[innerWidth, innerHeight],
  BAR:m(".topbar"), ASK:m(".task-col"),
  PAPER:m(".form-col")||m(".ready-col"), RAIL:m(".rail-col"),
  종이:pr?{w:Math.round(pr.width), h:Math.round(pr.height)}:null,
  질문칸:m(".wiz-body"), 목록칸:m(".ask-body"),
  네비:nav?{w:Math.round(nav.getBoundingClientRect().width),
            h:Math.round(nav.getBoundingClientRect().height),
            열:getComputedStyle(nav).gridTemplateColumns}:null,
  가로넘침:wide()[0], 입력칸넘침:wide()[1],
  토큰:{cols:tok("--cols")||null, m_cols:tok("--m-cols")||null,
        topbar:tok("--topbar-h")||null, m_bar:tok("--m-bar-h")||null,
        big:document.documentElement.classList.contains("big")}
};
document.title="MEAS"+JSON.stringify(out);
'''


def chrome():
    for p in CHROME_CANDIDATES:
        if os.path.exists(p):
            return p
    sys.exit("크롬을 찾지 못했습니다. verify-print.py 의 CHROME_CANDIDATES 를 확인하세요.")


def measure(src, cfg, script, size):
    s = io.open(os.path.join(ROOT, src), encoding="utf-8").read()
    if cfg:
        s = s.replace("<head>", "<head><script>window.__kioskCfg=%s;</script>"
                      % json.dumps(cfg, ensure_ascii=False), 1)
    # 상태를 만든 **뒤에** 잰다. 여는 순간 재면 시연·초기 렌더 중간값이 잡힌다.
    s = s.replace("</body>", '<script>setTimeout(function(){try{%s}catch(e){'
                             'document.title="ERR "+e;}\nsetTimeout(function(){%s},120);},250);'
                             '</script></body>' % (script, PROBE))
    tmp = os.path.join(ROOT, "_ms_%s" % os.path.basename(src))
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    try:
        r = subprocess.run(
            [chrome(), "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
             "--force-device-scale-factor=1", "--window-size=%d,%d" % size,
             "--virtual-time-budget=5000", "--dump-dom",
             "file:///" + tmp.replace("\\", "/")],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
    m = re.search(r"<title>MEAS(.*?)</title>", r.stdout or "", re.S)
    if not m:
        err = re.search(r"<title>(ERR.*?)</title>", r.stdout or "")
        return {"오류": err.group(1)[:120] if err else "측정 실패"}
    return json.loads(m.group(1))


# 종이의 이상적인 화면 크기 — A4(210×297mm)를 96dpi 로 그린 값(인쇄 좌표의 화면 쪽 짝).
# ⚠️ **고정값이 아니라 눈금**이다. 지금 크게 보기에서는 757×1070 이고, 그것은 알려진
#    사실이지 실패가 아니다(`--cols` 가 5:5:2 로 바뀌기 때문 · 2026.08.24 결정).
PAPER_IDEAL = (794, 1122)


def judge(name, cur, prev):
    """실패로 볼 것만 고른다 — **기준선보다 나빠진 것**만이다.

    ⛔ 절대값으로 묶지 않는다. 화면은 바뀌는 것이 정상이고, 이 도구가 잡아야 하는 것은
       「무엇이 달라졌나」가 아니라 「**나빠졌나**」다.
         · 가로 넘침이 **새로** 생겼다      → 실패 (글자가 잘린다)
         · 종이가 기준선보다 **작아졌다**    → 실패 (화면에서 읽기 어려워진다)
         · 영역이 사라졌다·측정이 죽었다     → 실패
       종이가 커지거나 넘침이 사라진 것은 **개선**이므로 통과다.
    """
    bad = []
    if cur.get("오류"):
        return ["측정 실패 — %s" % cur["오류"]]
    if not cur.get("ASK") or not cur.get("PAPER"):
        bad.append("영역이 없다(ASK/PAPER)")

    was = set((prev or {}).get("가로넘침") or [])
    now = cur.get("가로넘침") or []
    # 넘친 양이 달라도 같은 요소면 「새로 생긴 것」으로 보지 않는다(이름으로 견준다)
    new_over = [o for o in now if o.split(" +")[0] not in {w.split(" +")[0] for w in was}]
    if new_over:
        bad.append("가로 넘침이 새로 생겼다 — %s" % ", ".join(new_over))

    p, q = cur.get("종이"), (prev or {}).get("종이")
    if p and q and (p["w"] < q["w"] - 1 or p["h"] < q["h"] - 1):
        bad.append("종이가 작아졌다 %dx%d → %dx%d" % (q["w"], q["h"], p["w"], p["h"]))
    return bad


def note(name, cur):
    """실패는 아니지만 눈에 두어야 하는 것."""
    out = []
    if cur.get("입력칸넘침"):
        out.append("입력칸 안에서 값이 구른다(잘림 아님) %s" % ", ".join(cur["입력칸넘침"]))
    p = cur.get("종이")
    if p and (p["w"], p["h"]) != PAPER_IDEAL and abs(p["w"] - PAPER_IDEAL[0]) > 1:
        out.append("종이 %dx%d — A4 1:1(794x1122)보다 작다" % (p["w"], p["h"]))
    if cur.get("가로넘침"):
        out.append("가로 넘침 %s" % ", ".join(cur["가로넘침"]))
    return out


def diff(old, new, path=""):
    """기준선과 달라진 값을 평평하게 뽑는다."""
    out = []
    if isinstance(old, dict) and isinstance(new, dict):
        for k in sorted(set(list(old.keys()) + list(new.keys()))):
            out += diff(old.get(k), new.get(k), path + "/" + str(k) if path else str(k))
    elif old != new:
        out.append("%s: %s → %s" % (path, json.dumps(old, ensure_ascii=False),
                                    json.dumps(new, ensure_ascii=False)))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--baseline", action="store_true", help="지금 값을 기준선으로 저장")
    ap.add_argument("--json", default="")
    ap.add_argument("-v", "--verbose", action="store_true")
    a = ap.parse_args()

    base = {}
    if os.path.exists(BASELINE):
        base = json.load(io.open(BASELINE, encoding="utf-8"))

    cur, fails, changed = {}, [], []
    for name, src, cfg, script, size in SCENARIOS:
        if a.only and a.only not in name:
            continue
        r = measure(src, cfg, script, size)
        cur[name] = r
        prev = base.get(name)
        bad = judge(name, r, prev)
        d = diff(prev, r) if prev else []
        mark = "X" if bad else ("~" if d else "OK")
        area = ""
        if r.get("ASK") and r.get("PAPER"):
            area = "ASK %s / PAPER %s / RAIL %s" % (
                r["ASK"]["w"], r["PAPER"]["w"], (r.get("RAIL") or {}).get("w", "-"))
            if r.get("종이"):
                area += "  종이 %dx%d" % (r["종이"]["w"], r["종이"]["h"])
        print("  %-2s %-20s %s" % (mark, name, area))
        for b in bad:
            print("       X %s" % b)
            fails.append((name, b))
        for n in note(name, r):
            print("       · %s" % n)
        for line in d:
            changed.append((name, line))
            if a.verbose:
                print("       ~ %s" % line)
        if a.verbose and not d:
            print("       %s" % json.dumps(r, ensure_ascii=False))

    if a.json:
        io.open(a.json, "w", encoding="utf-8", newline="").write(
            json.dumps(cur, ensure_ascii=False, indent=1))
        print("\n기록: %s" % a.json)

    if a.baseline:
        os.makedirs(os.path.dirname(BASELINE), exist_ok=True)
        io.open(BASELINE, "w", encoding="utf-8", newline="").write(
            json.dumps(cur, ensure_ascii=False, indent=1))
        print("\n기준선 저장: tests/screen-baseline.json (%d 화면)" % len(cur))
        return 0

    if changed and not a.verbose:
        print("\n기준선과 달라진 값 %d 건 — `-v` 로 봅니다." % len(changed))
        for n, line in changed[:12]:
            print("  ~ %-18s %s" % (n, line))
        if len(changed) > 12:
            print("  … 그리고 %d 건" % (len(changed) - 12))
        print("  ⚠️ 화면을 고쳤으면 달라지는 것이 정상입니다. **왜 달라졌는지 적고**")
        print("     `--baseline` 으로 갱신하십시오.")

    if fails:
        print("\nX 실패 %d 건 — 가로 넘침·종이 크기·측정 실패는 넘어가지 않습니다." % len(fails))
        return 1
    print("\n✓ 통과 — 잰 화면 %d 개 (가로 넘침 없음 · 종이 794x1122 유지)" % len(cur))
    return 0


if __name__ == "__main__":
    sys.exit(main())
