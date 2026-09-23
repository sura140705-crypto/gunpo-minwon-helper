# -*- coding: utf-8 -*-
"""인쇄 위치 미세 보정이 **인쇄물을 실제로 그만큼 움직이는가**를 잰다.

    python tools/verify-print-offset.py            # 기본 3종 · 보정 4가지
    python tools/verify-print-offset.py --only realestate
    python tools/verify-print-offset.py -v

**왜 따로 있는가.** 이 저장소에는 「설정이 인쇄물을 바꾸는지」 보는 도구가 없었다.

| 도구 | 이 값을 못 보는 이유 |
|---|---|
| `verify-print.py` | **설정이 없는 상태로만** 잰다. 보정은 기본값 0 이라 아무 일도 안 일어난다 |
| `verify-site-config.py` | **화면**이 설정을 받는지를 본다. 인쇄물은 보지 않는다 |

그래서 보정이 **조용히 아무것도 안 해도** 둘 다 통과한다. 이 저장소는 이미 같은 부류의
사고를 겪었다(`state.unsure` 가 쓰기만 하고 읽는 곳이 0곳이었던 것). 하필 이 값은
**틀리면 종이가 틀린다** — 그래서 눈으로 믿지 않고 픽셀로 잰다.

재는 것은 세 가지다.

1. **보정 0 이면 아무 CSS 도 안 들어간다** — `offsetCss()` 가 빈 문자열이어야 한다.
   (여기가 깨지면 보정을 안 쓰는 기관의 인쇄물이 기준선과 달라진다)
2. **넣은 만큼 움직인다** — 잉크의 경계상자가 요청한 mm 만큼 이동해야 한다.
   150dpi 에서 1mm = 5.91px 이므로 0.5mm 는 약 3px 이다.
3. **모든 쪽이 함께 움직인다** — 2쪽짜리 서식(부동산 별지·여권 법정대리인 동의서)에서
   ⚠️ 이것이 이 검사의 핵심이다. 옮길 대상을 `.stage` 로 잘못 잡으면 **1쪽만 움직이고
      2쪽이 제자리에 남는다**(별지는 `.paper.extra` 로 형제다). 눈으로는 1쪽만 보고
      「맞았다」 하기 쉽다.

⚠️ 실제 인쇄가 지나가는 **Electron 경로**로만 잰다. 크롬 경로에는 보정 주입이 없다.
⚠️ main.js 가 인쇄 직전에 부르는 것과 **같은 함수**(`print-options.offsetCss`)를 태운다.
"""
import argparse
import io
import os
import re
import subprocess
import sys
import tempfile

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ELECTRON_EXE = os.path.join(ROOT, "kiosk-app", "node_modules", "electron", "dist", "electron.exe")
ELECTRON_SCRIPT = os.path.join(ROOT, "tools", "print-electron.js")

DPI = 150
MM_PX = DPI / 25.4          # 1mm 가 몇 px 인가 — 150dpi 에서 5.905
TOL_PX = 1.6                # 반올림·잉크 경계 흔들림 여유. 0.5mm(=2.95px)보다 한참 작다

# ⚠️ **2쪽짜리를 반드시 넣는다.** 1쪽짜리만 재면 별지가 안 따라오는 사고를 못 본다.
FORMS = [
    ("realestate", "apt"),      # 2쪽 — 별지(.paper.extra)
    ("passport",   "minor"),    # 2쪽 — 법정대리인 동의서
    ("cert",       "self"),     # 1쪽
]

# 넣어 볼 보정값 (x, y) mm. 0.5 눈금 · 양·음 방향 · 두 축 동시.
CASES = [(0.0, 0.5), (0.0, -0.5), (0.5, 0.0), (-1.0, 1.0)]

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


def prep_html(name, kind):
    src = os.path.join(ROOT, "%s-helper-v1.html" % name)
    html = io.open(src, encoding="utf-8").read()
    m = re.search(r"<head[^>]*>", html, re.I)
    html = html[:m.end()] + CLOCK_FREEZE + html[m.end():]
    inject = ('<script>try{fillSample("%s");renderAll();}'
              'catch(e){document.title="SAMPLE_FAIL: "+e.message;}</script>' % kind)
    at = html.rfind("</body>")
    html = html[:at] + inject + html[at:]
    tmp = os.path.join(ROOT, "_vo_%s_%s.html" % (name, kind))
    io.open(tmp, "w", encoding="utf-8", newline="").write(html)
    return tmp


def render(tmp_html, tag, cfg_json):
    """Electron 으로 PDF 를 뽑아 **쪽별 잉크 분포**(가로·세로 1차원 프로파일)를 돌려준다.

    ⚠️ 경계상자로 재지 마라. 여권 2쪽(법정대리인 동의서)처럼 서식이 **가장자리까지 차 있는**
       쪽은 상자가 종이에 잘려, 실제로 옮겨져도 상자 왼쪽이 0 에 붙은 채 움직이지 않는다.
       실제로 이 검사를 처음 돌렸을 때 그 쪽만 「안 움직였다」고 나왔다 — 값이 아니라
       **재는 법이 틀린 것**이었다.
    그래서 행·열별 잉크량 곡선을 만들어 **곡선끼리 맞춰 보고**(교차상관) 이동량을 찾는다.
    잘려 나간 가장자리가 있어도 안쪽 무늬가 맞으므로 값이 흔들리지 않는다.
    """
    import fitz
    import numpy as np
    tmp_pdf = os.path.join(ROOT, "_vo_%s.pdf" % tag)
    cmd = [ELECTRON_EXE, ELECTRON_SCRIPT, tmp_html, tmp_pdf, "--css-page",
           "--cfg", cfg_json]
    r = subprocess.run(cmd, capture_output=True, cwd=tempfile.gettempdir(), timeout=180,
                       text=True, encoding="utf-8", errors="replace")
    if not os.path.exists(tmp_pdf):
        return None, "PDF 생성 실패: %s" % ((r.stderr or r.stdout or "").strip()[:120])
    pages = []
    with fitz.open(tmp_pdf) as doc:
        for pg in doc:
            pm = pg.get_pixmap(dpi=DPI, colorspace=fitz.csGRAY)
            a = np.frombuffer(pm.samples, dtype=np.uint8).reshape(pm.height, pm.width)
            ink = (255 - a.astype(np.float32))      # 흰 종이 0 · 잉크가 클수록 큰 값
            pages.append((ink.sum(axis=1), ink.sum(axis=0)))   # (행 프로파일, 열 프로파일)
    os.remove(tmp_pdf)
    return pages, None


def best_shift(p0, p1, span):
    """두 1차원 곡선이 가장 잘 겹치는 이동량(px)을 찾는다. 없으면 None."""
    import numpy as np
    n = min(len(p0), len(p1))
    p0, p1 = p0[:n], p1[:n]
    if float(np.abs(p0).sum()) < 1.0:
        return None                      # 잉크가 없는 쪽 — 잴 것이 없다
    best, bestd = None, None
    for s in range(-span, span + 1):
        # p1 을 s 만큼 되돌렸을 때 p0 과 얼마나 다른가. 겹치는 구간만 견준다.
        lo, hi = max(0, s), min(n, n + s)
        if hi - lo < n // 2:
            continue
        d = float(np.abs(p0[lo - s:hi - s] - p1[lo:hi]).sum()) / (hi - lo)
        if bestd is None or d < bestd:
            best, bestd = s, d
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("-v", "--verbose", action="store_true")
    a = ap.parse_args()

    if not os.path.exists(ELECTRON_EXE):
        sys.exit("Electron 이 없습니다: %s  (cd kiosk-app && npm install)" % ELECTRON_EXE)

    print("인쇄 위치 보정 검증  dpi=%d  1mm=%.2fpx  허용 ±%.1fpx\n" % (DPI, MM_PX, TOL_PX))

    fails = []

    # ── ① 보정 0 이면 CSS 가 아예 없어야 한다 ─────────────────────────────
    r = subprocess.run(
        ["node", "-e",
         "const p=require('./kiosk-app/print-options.js');"
         "const z=p.offsetCss({});"
         "const q=p.offsetCss({printOffsetY:0,printOffsetX:0});"
         "console.log(JSON.stringify([z,q]));"],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8")
    zero_ok = r.stdout.strip() == '["",""]'
    print("  %s 보정 0 → CSS 없음  %s" % ("✓" if zero_ok else "X", r.stdout.strip()))
    if not zero_ok:
        fails.append("보정 0 인데 CSS 가 들어간다 — 기준선이 흔들린다")
    print("")

    # ── ②③ 넣은 만큼, 모든 쪽이 함께 움직이는가 ──────────────────────────
    for name, kind in FORMS:
        if a.only and a.only not in name:
            continue
        tmp_html = prep_html(name, kind)
        try:
            base, err = render(tmp_html, "%s_base" % name, "{}")
            if err:
                print("  X %-12s 기준 %s" % (name, err))
                fails.append("%s 기준 렌더 실패" % name)
                continue
            print("── %s-%s  (%d쪽)" % (name, kind, len(base)))
            for (dx, dy) in CASES:
                cfg = '{"printOffsetX":%s,"printOffsetY":%s}' % (dx, dy)
                cur, err = render(tmp_html, "%s_c" % name, cfg)
                if err:
                    print("     X 보정 %+.1f,%+.1f — %s" % (dx, dy, err))
                    fails.append("%s 보정 %+.1f,%+.1f — %s" % (name, dx, dy, err))
                    continue
                if len(cur) != len(base):
                    # ⚠️ 이것은 진짜 결함이다 — 보정이 **쪽 나눔을 바꿨다**는 뜻이다.
                    #    transform 은 배치를 안 바꾸므로 여기가 걸리면 방식이 틀렸다.
                    print("     X 보정 %+.1f,%+.1f — 쪽수가 %d → %d 로 바뀌었다"
                          % (dx, dy, len(base), len(cur)))
                    fails.append("%s 보정 %+.1f,%+.1f — 쪽수 %d→%d"
                                 % (name, dx, dy, len(base), len(cur)))
                    continue
                want_x, want_y = dx * MM_PX, dy * MM_PX
                span = int(max(abs(want_x), abs(want_y))) + 6
                page_notes, bad = [], False
                for i, ((r0, c0), (r1, c1)) in enumerate(zip(base, cur)):
                    gy, gx = best_shift(r0, r1, span), best_shift(c0, c1, span)
                    if gy is None or gx is None:
                        page_notes.append("%d쪽 잉크 없음" % (i + 1)); bad = True; continue
                    ok = abs(gx - want_x) <= TOL_PX and abs(gy - want_y) <= TOL_PX
                    if not ok:
                        bad = True
                    page_notes.append("%d쪽 %+d,%+dpx%s" % (i + 1, gx, gy, "" if ok else " ✗"))
                mark = "X" if bad else "✓"
                print("     %s 보정 %+.1f,%+.1f mm → 기대 %+.1f,%+.1fpx · 실측 %s"
                      % (mark, dx, dy, want_x, want_y, " | ".join(page_notes)))
                if bad:
                    fails.append("%s 보정 %+.1f,%+.1f — %s" % (name, dx, dy, " | ".join(page_notes)))
            print("")
        finally:
            os.path.exists(tmp_html) and os.remove(tmp_html)

    if fails:
        print("X 실패 %d 건" % len(fails))
        for f in fails:
            print("   · %s" % f)
        return 1
    print("✓ 통과 — 보정이 인쇄물을 정확히 그만큼 옮긴다 (모든 쪽 함께)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
