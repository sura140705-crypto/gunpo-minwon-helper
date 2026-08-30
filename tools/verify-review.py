# -*- coding: utf-8 -*-
"""Review(마지막 확인)와 인쇄 준비 화면(미리보기)을 8종×2예시로 실측한다.

    python tools/verify-review.py            # 8종 전부
    python tools/verify-review.py --only cert realestate
    python tools/verify-review.py -v         # 항목별 상세

**왜 따로 있는가.** 이 두 화면은 다른 도구가 보지 못하는 사각지대다.

| 도구 | 이 화면을 못 보는 이유 |
|---|---|
| `verify-print.py` | 인쇄 CSS 가 `.modal-back` 을 통째로 숨긴다 — 미리보기는 종이에 안 나간다 |
| `measure-screen.py` | 모달을 열지 않는다. Review 의 [수정] 단추를 누르지도 않는다 |

그래서 **화면이 통째로 죽어도 19쪽 0px 가 그대로 통과한다.** 그 틈을 여기서 메운다.

재는 것은 두 가지다.

1. **인쇄 준비 화면** — 「총 N장」이 참말인가. `verify-print.py` 의 기준선 쪽수(EXPECT)와
   맞춰 본다. 썸네일이 그 수만큼 있고 **안이 실제로 채워졌는지**(빈 상자가 아닌지),
   인쇄 단추 라벨이 「N장 인쇄하기」인지도 함께 본다.
   ⚠️ 장수는 서식에 적어 두는 값이 아니라 **DOM 을 재서** 나온다 — 별지는 내용이 늘면
      두 장이 되므로, 조판이 어긋나면 여기서 수가 틀어진다.

2. **Review 의 [수정] 단추** — 눌러서 **실제로 그 단계로 가는가.**
   ⚠️ `gotoStep(n)` 은 `n < state.step && stepActive(n)` 일 때만 움직인다. 조건부 단계나
      잘못된 번호에 [수정]을 달면 **눌러도 아무 일이 없는 죽은 단추**가 된다.
      화면에는 멀쩡히 보이므로 눈으로는 잡히지 않는다(2026.08.30 에 혼인에서 실제로 나왔다).

⚠️ 인쇄물과는 무관하다. 좌표 회귀는 `verify-print.py` 가 본다.
⚠️ 작성예시는 전부 가상 인물이다(리포 규칙).
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

# ⛔ `verify-print.py` 의 FORMS 와 **같은 순서·같은 예시 키**로 둔다. 한쪽만 고치면
#    "총 장수 = 인쇄 기준선 쪽수" 라는 이 도구의 판정 근거가 무너진다.
FORMS = [
    ("passport",   ["adult", "minor"]),
    ("marriage",   ["adult", "minor"]),
    ("divorce",    ["consensual", "judicial"]),
    ("birth",      ["wed", "unwed"]),
    ("death",      ["hospital", "home"]),
    ("naming",     ["self", "legal"]),
    ("cert",       ["self", "agent"]),
    ("realestate", ["apt", "right"]),
]

# 기준선이 가진 쪽수 — `tests/baseline/<서식>-<예시>-pN.png` 의 N 을 세서 만든다.
# 파일이 없으면(기준선 미생성) 그 조합은 장수 비교를 건너뛴다.
def expected_pages(form, kind):
    d = os.path.join(ROOT, "tests", "baseline")
    if not os.path.isdir(d):
        return None
    n = len([f for f in os.listdir(d)
             if re.match(r"^%s-%s-p\d+\.png$" % (re.escape(form), re.escape(kind)), f)])
    return n or None


CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

# ⚠️ 시계를 고정한다. 서식은 로드 시점에 오늘 날짜를 붙잡으므로, 고정하지 않으면
#    코드를 한 줄도 안 고쳐도 결과가 매일 달라진다(`docs/GOTCHAS.md ㉛`).
FIXED_DATE = (2026, 8, 4)
CLOCK_FREEZE = """<script>(function(){
  var D=Date, F=new D(%d,%d,%d,10,0,0).getTime();
  function K(){
    if(!(this instanceof K)) return new D(F).toString();
    if(arguments.length===0) return new D(F);
    return new (D.bind.apply(D,[null].concat([].slice.call(arguments))))();
  }
  K.prototype=D.prototype; K.now=function(){return F;}; K.parse=D.parse; K.UTC=D.UTC;
  window.Date=K;
})();</script>""" % (FIXED_DATE[0], FIXED_DATE[1] - 1, FIXED_DATE[2])

# JS 오류를 조용히 삼키지 않는다 — 미리보기는 오류가 나도 화면이 반쯤 서는 일이 있다
ERR_TRAP = ('<script>window.__jsErr="";window.addEventListener("error",'
            'function(e){window.__jsErr=String(e.message);});</script>')

# 엔진 7종과 여권은 인쇄 단추 id 가 다르다(`btnPrintModal` / `pvPrint`). 둘 다 본다.
PROBE = """
setTimeout(function(){
  try{
    fillSample("%(kind)s"); if(typeof renderAll==="function") renderAll();
    var isEngine = !!(typeof FORM==="object" && FORM && FORM.STEPS);
    var last = isEngine ? FORM.STEPS.length : flow().length;

    /* ── ① Review 의 [수정] 단추 ─────────────────────────────────────
       한 번 누르면 그 단계로 떠나므로, 매번 Review 로 되돌린 뒤 i 번째를 다시 찾아 누른다. */
    state.step = last; renderAll();
    var visible = function(){
      return [].slice.call(document.querySelectorAll(".sum-edit"))
               .filter(function(b){ return b.offsetParent!==null; });
    };
    var n = visible().length, edits = [];
    for(var i=0;i<n;i++){
      state.step = last; renderAll();
      var b = visible()[i];
      if(!b){ edits.push({k:"?", err:"단추 사라짐"}); continue; }
      var kn = b.parentNode.querySelector(".k");
      var want = b.getAttribute("data-goto") || b.getAttribute("data-step") || "";
      b.click();
      edits.push({ k:(kn?kn.textContent.trim():"?"), want:want, got:String(state.step),
                   moved:(String(state.step)!==String(last)) });
    }
    state.step = last; renderAll();

    /* ── ② 인쇄 준비 화면 ─────────────────────────────────────────── */
    openPreview();
    setTimeout(function(){
      var q=function(s){ var x=document.querySelector(s); return x?x.textContent.trim():""; };
      var cnt=q("#pvCount"), m=cnt.match(/(\\d+)/);
      document.title = "VR" + JSON.stringify({
        open:   document.body.classList.contains("pv-open"),
        total:  m ? +m[1] : -1,
        thumbs: document.querySelectorAll(".pv-th").length,
        filled: [].filter.call(document.querySelectorAll(".pv-th-inner"),
                  function(x){ return x.children.length>0; }).length,
        btn:    q("#btnPrintModal") || q("#pvPrint"),
        after:  q("#pvAfter").length,
        ref:    q("#pvRef").length,
        edits:  edits,
        err:    window.__jsErr||""
      }) + "VR";
    }, 600);
  }catch(e){ document.title = 'VR{"fatal":"' + String(e.message).replace(/"/g,"'") + '"}VR'; }
}, 400);
"""


def chrome():
    for p in CHROME_CANDIDATES:
        if os.path.exists(p):
            return p
    sys.exit("크롬을 찾지 못했습니다. verify-print.py 의 CHROME_CANDIDATES 를 확인하세요.")


def measure(form, kind):
    src = os.path.join(ROOT, "%s-helper-v1.html" % form)
    if not os.path.exists(src):
        return {"fatal": "파일 없음: %s" % os.path.basename(src)}
    s = io.open(src, encoding="utf-8").read()
    s = s.replace("<head>", "<head>" + CLOCK_FREEZE + ERR_TRAP, 1)   # ⚠️ 날짜 고정이 먼저다
    s = s.replace("</body>", "<script>" + (PROBE % {"kind": kind}) + "</script></body>", 1)
    tmp = os.path.join(ROOT, "_vr_%s.html" % form)
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    try:
        r = subprocess.run(
            [chrome(), "--headless=new", "--disable-gpu", "--no-sandbox",
             "--hide-scrollbars", "--force-device-scale-factor=1",
             "--window-size=1366,768", "--virtual-time-budget=8000",
             "--dump-dom", "file:///" + tmp.replace("\\", "/")],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
    m = re.search(r"VR(\{.*?\})VR", r.stdout or "", re.S)
    if not m:
        return {"fatal": "측정 실패(화면이 서지 않았습니다)"}
    return json.loads(m.group(1))


def main():
    ap = argparse.ArgumentParser(description="Review·인쇄 준비 화면 실측")
    ap.add_argument("--only", nargs="+", metavar="서식", help="이 서식만 (예: cert realestate)")
    ap.add_argument("-v", "--verbose", action="store_true", help="[수정] 단추를 항목별로 보여 준다")
    a = ap.parse_args()

    forms = [(f, k) for f, k in FORMS if not a.only or f in a.only]
    if not forms:
        sys.exit("고른 서식이 없습니다: %s" % ", ".join(a.only or []))

    print("Review·인쇄 준비 화면 검증  대상 %d종" % len(forms))
    bad, seen = 0, 0
    for form, kinds in forms:
        for kind in kinds:
            seen += 1
            name = "%s-%s" % (form, kind)
            d = measure(form, kind)
            if d.get("fatal"):
                print("  X %-22s %s" % (name, d["fatal"]))
                bad += 1
                continue

            why = []
            if not d["open"]:
                why.append("미리보기가 열리지 않음")
            if d["err"]:
                why.append("JS 오류: " + d["err"])

            exp = expected_pages(form, kind)
            if exp and d["total"] != exp:
                why.append("총 장수 %s ≠ 인쇄 기준선 %d쪽" % (d["total"], exp))
            if d["thumbs"] != d["total"]:
                why.append("썸네일 %d개 ≠ 총 %s장" % (d["thumbs"], d["total"]))
            if d["filled"] != d["thumbs"]:
                why.append("빈 썸네일 %d개" % (d["thumbs"] - d["filled"]))
            if str(d["total"]) not in (d["btn"] or ""):
                why.append("인쇄 단추 라벨「%s」에 장수가 없음" % d["btn"])

            # 죽은 [수정] 단추 — 눌러도 안 움직이거나 엉뚱한 단계로 간다
            dead = [e for e in d["edits"]
                    if not e.get("moved") or (e.get("want") and e["want"] != e.get("got"))]
            if dead:
                why.append("죽은 [수정] %d개 (%s)"
                           % (len(dead), ", ".join(e.get("k", "?") for e in dead)))

            ok = not why
            if not ok:
                bad += 1
            print("  %s %-22s 총 %s장 · 썸네일 %d · [수정] %d개%s"
                  % ("✓" if ok else "X", name, d["total"], d["thumbs"], len(d["edits"]),
                     "" if ok else "   ← " + " · ".join(why)))
            if a.verbose and d["edits"]:
                for e in d["edits"]:
                    print("      %s %s → %s단계(간 곳 %s)"
                          % ("·" if e.get("moved") else "X", e.get("k", "?"),
                             e.get("want", "?"), e.get("got", "?")))

    if bad:
        print("\n✗ 어긋난 화면 %d / %d" % (bad, seen))
        return 1
    print("\n✓ 전부 통과 — 잰 화면 %d" % seen)
    return 0


if __name__ == "__main__":
    sys.exit(main())
