# -*- coding: utf-8 -*-
"""단계별 **세로 넘침** 실측 — 「이 단계가 너무 길다」를 숫자로 말한다.

    python tools/measure-steps.py                    # 엔진 7종 · 1920x1080
    python tools/measure-steps.py --only cert
    python tools/measure-steps.py --size 1080x1920   # 세로 키오스크
    python tools/measure-steps.py --extra 'state.adv_need="예";'   # 조건부 단계를 열고

**왜 따로 있는가.** `measure-screen.py` 는 허브와 여권 15화면만 재고, **엔진 7종의
단계는 한 번도 열지 않는다.** 그래서 한 단계에 입력칸이 스물한 개 쌓여 화면 세 장
반이 되어도 어느 도구도 아무 말을 하지 않았다(2026.09.23 에 증명서에서 실제로 나왔다).

재는 것은 하나다 — `.wiz-body` 의 **scrollHeight − clientHeight**,
곧 **시민이 손으로 굴려야 하는 양**이다. 입력칸·선택단추 개수를 함께 적는다.

⛔ **합격·불합격을 가르지 않는다**(언제나 종료코드 0). 세로 넘침은 굴리면 읽히므로
   그 자체가 결함이 아니다 — 가로 넘침을 실패로 보는 `measure-screen.py` 와 다르다.
   이 도구가 주는 것은 **판단의 근거**이지 판정이 아니다.
⚠️ 조건부 단계(`when`)는 꺼져 있으면 목록에서 빠진다. 열고 재려면 `--extra` 를 쓴다.
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

# ⛔ 여권은 없다 — `FORM.STEPS` 가 없는 손작성본이라 이 도구의 문법이 통하지 않는다.
#    여권 화면은 `measure-screen.py` 가 시나리오로 잰다.
FORMS = [
    ("marriage",   "adult"),
    ("divorce",    "consensual"),
    ("birth",      "wed"),
    ("death",      "hospital"),
    ("naming",     "self"),
    ("cert",       "self"),
    ("realestate", "apt"),
]

# ⚠️ 시계를 고정한다 — 고정하지 않으면 코드를 안 고쳐도 날짜 칸 때문에 값이 달라진다
#    (`docs/GOTCHAS.md ㉛` · `verify-review.py` 와 같은 이유).
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

PROBE = """
setTimeout(function(){
 try{
  fillSample("%(kind)s"); %(extra)s renderAll();
  var out=[], last=FORM.STEPS.length;
  for(var s=1;s<=last;s++){
    state.step=s; renderAll();
    /* 모션을 걷어낸 뒤에 잰다 — 헤드리스는 전환 애니메이션을 첫 프레임에 세워 두고,
       그 상태의 `translateY(6px)` 가 높이에 섞인다(`measure-screen.py` 의 같은 주석). */
    [].forEach.call(document.querySelectorAll(".step-in"),
      function(n){ n.classList.remove("step-in"); });
    var b=document.getElementById("wizBody"), d=FORM.STEPS[s-1];
    out.push({n:s, short:d.short||"", kind:d.kind||"", active:!!stepActive(s),
              sh:b?b.scrollHeight:0, ch:b?b.clientHeight:0,
              over:b?(b.scrollHeight-b.clientHeight):0,
              fields:document.querySelectorAll("#wizBody .field").length,
              inputs:document.querySelectorAll("#wizBody input,#wizBody textarea,"
                     +"#wizBody select").length,
              opts:document.querySelectorAll("#wizBody .opt").length});
  }
  document.title="SM"+JSON.stringify(out)+"SM";
 }catch(e){ document.title='SM{"fatal":"'+String(e.message).replace(/"/g,"'")+'"}SM'; }
}, 400);
"""


def chrome():
    for p in CHROME_CANDIDATES:
        if os.path.exists(p):
            return p
    sys.exit("크롬을 찾지 못했습니다. verify-print.py 의 CHROME_CANDIDATES 를 확인하세요.")


def measure(form, kind, size, extra=""):
    src = os.path.join(ROOT, "%s-helper-v1.html" % form)
    if not os.path.exists(src):
        return {"fatal": "파일 없음: %s" % os.path.basename(src)}
    s = io.open(src, encoding="utf-8").read()
    s = s.replace("<head>", "<head>" + CLOCK_FREEZE, 1)
    s = s.replace("</body>",
                  "<script>" + (PROBE % {"kind": kind, "extra": extra}) + "</script></body>", 1)
    tmp = os.path.join(ROOT, "_ms_step_%s.html" % form)
    io.open(tmp, "w", encoding="utf-8", newline="").write(s)
    try:
        r = subprocess.run(
            [chrome(), "--headless=new", "--disable-gpu", "--no-sandbox",
             "--hide-scrollbars", "--force-device-scale-factor=1",
             "--window-size=%d,%d" % size, "--virtual-time-budget=8000",
             "--dump-dom", "file:///" + tmp.replace("\\", "/")],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
    m = re.search(r"<title>SM(.*?)SM</title>", r.stdout or "", re.S)
    return json.loads(m.group(1)) if m else {"fatal": "측정 실패"}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", default="1920x1080", help="화면 크기 (가로x세로)")
    ap.add_argument("--only", default="", help="이름에 이 말이 든 서식만")
    ap.add_argument("--extra", default="", help="재기 전에 돌릴 JS (조건부 단계 열기 등)")
    ap.add_argument("--json", default="")
    a = ap.parse_args()
    w, h = [int(x) for x in a.size.split("x")]
    print("단계별 세로 넘침 실측  화면 %dx%d  (넘침 = 시민이 굴려야 하는 px)\n" % (w, h))

    worst, all_out = [], {}
    for form, kind in FORMS:
        if a.only and a.only not in form:
            continue
        r = measure(form, kind, (w, h), a.extra)
        if isinstance(r, dict):
            print("  %-11s X %s" % (form, r.get("fatal")))
            continue
        all_out[form] = r
        print("── %s (작성예시 %s)" % (form, kind))
        for d in r:
            if not d["active"] or d["kind"] in ("intro", "summary"):
                continue
            print("   %2d %-13s 칸%-3d 입력%-3d 선택%-3d  내용 %4d / 보임 %4d  넘침 %4d%s"
                  % (d["n"], d["short"], d["fields"], d["inputs"], d["opts"],
                     d["sh"], d["ch"], d["over"], "  ⚠" if d["over"] > 0 else ""))
            if d["over"] > 0:
                worst.append((d["over"], form, d["n"], d["short"]))
        print("")

    if a.json:
        io.open(a.json, "w", encoding="utf-8", newline="").write(
            json.dumps(all_out, ensure_ascii=False, indent=1))
        print("기록: %s\n" % a.json)

    worst.sort(reverse=True)
    print("넘치는 단계 %d개 — 많이 굴려야 하는 순서" % len(worst))
    for o, f, n, s in worst[:15]:
        print("   %5dpx  %-11s %2d단계 %s" % (o, f, n, s))
    if len(worst) > 15:
        print("   … 그리고 %d 개" % (len(worst) - 15))
    print("\n⛔ 넘침은 그 자체로 실패가 아니다 — 굴리면 읽힌다. 이 표는 **판단의 근거**다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
