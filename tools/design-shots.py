# -*- coding: utf-8 -*-
"""디자인 검토용 화면 갈무리 — 8종 + 허브의 주요 화면을 PNG 로 찍는다.

디자인을 밖(다른 사람·다른 도구)에 맡기려면 **화면을 보여 줘야 한다.** 이 리포는 서식 HTML 이
자체완결이라 그냥 열면 되지만, 상태별 화면(경로 선택·요약·창구 전환·작성예시 채운 상태)은
손으로 만들기 번거롭다. 그것을 한 번에 찍는다.

    python tools/design-shots.py                 # docs/디자인검토/shots/ 에 전부 찍는다
    python tools/design-shots.py --only pass     # 이름에 pass 가 들어간 것만
    python tools/design-shots.py --size 1366x768 # 다른 해상도로

⚠️ 인쇄물과는 무관하다. 화면만 찍는다 — 인쇄 회귀는 `verify-print.py` 가 본다.
⚠️ 작성예시는 **전부 가상 인물**이다(리포 규칙). 갈무리에 실제 개인정보가 들어갈 일이 없다.
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
OUT = os.path.join(ROOT, "docs", "디자인검토", "shots")
CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

# 서식 안에서 카드를 누르는 공용 함수 (여권 시나리오가 쓴다)
CLICK = '''
function click(t){ var n=[].filter.call(document.querySelectorAll(".card"),
  function(b){ return b.textContent.indexOf(t)>=0; })[0]; if(n) n.click(); }
'''
# 엔진 5종·손작성 2종의 「작성예시」 버튼
SAMPLE = 'var b=document.getElementById("btnSampleAdult"); if(b) b.click();'

# (파일이름, 소스, 설정, 화면을 만드는 스크립트, 설명)
SHOTS = [
    ("hub-01-첫화면", "index.html", {}, "",
     "허브(첫 화면). 시민이 여기서 서식을 고른다."),
    ("hub-02-기관색교체", "index.html",
     {"org": {"orgName": "경기도 안양시"}, "themeColor": "#0f6b4f",
      "forms": {"passport": False}},
     "", "다른 기관이 대표색을 초록으로 바꾸고 여권을 끈 상태. 색은 기관마다 달라진다."),

    ("pass-01-경로선택", "passport-helper-v1.html", {}, "",
     "여권 첫 화면. 2026.08 개편으로 큰 터치 카드가 됐다 — 나머지 7종에는 이 흐름이 없다."),
    ("pass-02-주민번호", "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다"); '
             'state.data.nameKor="홍길동"; goNext(); goNext();',
     "카드와 입력칸이 한 화면에 같이 있는 경우(선택 → 그 자리에서 입력칸이 열린다)."),
    ("pass-03-입력화면", "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다"); goNext();',
     "글자를 치는 화면. 왼쪽은 실제 서식, 오른쪽이 안내 패널이다."),
    ("pass-04-최종확인", "passport-helper-v1.html", {},
     'fillSample("adult"); renderAll(); state.step=flow().length; renderAll();',
     "인쇄 직전 요약. 빈칸의 뜻을 6가지로 구분해 보여 준다."),
    ("pass-05-창구전환", "passport-helper-v1.html", {},
     'toCounter("P-04"); renderAll();',
     "창구로 넘기는 화면. 오류가 아니라 정상 완료 유형 중 하나로 설계했다."),
    ("pass-06-작성예시", "passport-helper-v1.html", {},
     'fillSample("adult"); renderAll();',
     "작성예시(가상 인물)를 채운 상태. 왼쪽 서식에 값이 얹힌다."),

    ("form-01-혼인-초기", "marriage-helper-v1.html", {}, "",
     "여권 말고 다른 서식의 **빈 첫 화면**. 카드가 없고 곧바로 입력 폼이다."),
    ("form-02-혼인", "marriage-helper-v1.html", {}, SAMPLE,
     "혼인신고서(손작성 서식). 작성예시를 채운 상태."),
    ("form-03-출생", "birth-helper-v1.html", {}, SAMPLE,
     "출생신고서(엔진 서식). 5종이 같은 틀을 쓴다."),
    ("form-04-사망", "death-helper-v1.html", {}, SAMPLE, "사망신고서."),
    ("form-05-개명", "naming-helper-v1.html", {}, SAMPLE, "개명신고서."),
    ("form-06-이혼", "divorce-helper-v1.html", {}, SAMPLE, "이혼(친권자 지정)신고서."),
    ("form-07-증명서", "cert-helper-v1.html", {}, SAMPLE,
     "증명서 발급신청. 고를 것이 많아 화면이 가장 빽빽하다."),
    ("form-08-부동산", "realestate-helper-v1.html", {}, SAMPLE,
     "부동산거래계약 신고서. 2쪽짜리라 세로로 가장 길다."),

    ("etc-01-무동작경고", "index.html", {},
     'var s=document.createElement("script"); s.textContent="";'
     'document.dispatchEvent(new Event("__none"));',
     "(참고) 개인정보 보호 오버레이는 3분 무동작 뒤에 뜬다 — 이 갈무리에는 담기지 않는다."),
]

# 세로 화면(키오스크를 세워 놓는 곳이 있다)으로도 몇 장 찍는다
PORTRAIT = ["hub-01-첫화면", "pass-01-경로선택", "form-03-출생"]


def chrome():
    for p in CHROME_CANDIDATES:
        if os.path.exists(p):
            return p
    sys.exit("크롬을 찾지 못했습니다. verify-print.py 의 CHROME_CANDIDATES 를 확인하세요.")


def build(src, cfg, script):
    s = io.open(os.path.join(ROOT, src), encoding="utf-8").read()
    if cfg:
        s = s.replace("<head>", "<head><script>window.__kioskCfg=%s;</script>"
                      % json.dumps(cfg, ensure_ascii=False), 1)
    if script:
        s = s.replace("</body>",
                      '<script>setTimeout(function(){try{%s}catch(e){'
                      'document.title="ERR "+e;}},250);</script></body>' % script)
    p = os.path.join(ROOT, "_ds_%s" % os.path.basename(src))
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    return p


def shoot(name, src, cfg, script, w, h, suffix=""):
    tmp = build(src, cfg, script)
    out = os.path.join(OUT, "%s%s.png" % (name, suffix))
    try:
        r = subprocess.run(
            [chrome(), "--headless=new", "--disable-gpu", "--no-sandbox",
             "--hide-scrollbars", "--force-device-scale-factor=1",
             "--window-size=%d,%d" % (w, h), "--virtual-time-budget=5000",
             "--screenshot=" + out, "file:///" + tmp.replace("\\", "/")],
            capture_output=True, text=True, encoding="utf-8", errors="replace")
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
    if not os.path.exists(out):
        print("  X %-24s 찍지 못했습니다 %s" % (name, (r.stderr or "")[:120]))
        return 0
    kb = os.path.getsize(out) / 1024.0
    print("  ✓ %-24s %5.0f KB  %dx%d" % (name + suffix, kb, w, h))
    return os.path.getsize(out)


def dump_css():
    """지금 쓰는 화면 CSS 를 한 파일로 뽑는다 — 디자인 쪽이 고칠 대상이 이것이다.

    ⛔ `@media print` 블록은 **인쇄물의 일부**다. 뽑아 주되 고치지 말라고 표시해 둔다."""
    parts = []
    for src, note in [("engine/base.html", "엔진 서식 5종 + 손작성 2종(혼인·이혼)이 공유하는 틀"),
                      ("passport-helper-v1.html", "여권 도우미(2026.08 개편으로 카드 흐름이 됐다)"),
                      ("index.html", "허브(첫 화면)")]:
        s = io.open(os.path.join(ROOT, src), encoding="utf-8").read()
        m = re.search(r"<style>(.*?)</style>", s, re.S)     # 첫 번째 = 본 스타일
        if not m:
            continue
        parts.append("/* ══════════════════════════════════════════════════════════\n"
                     "   %s\n   — %s\n"
                     "   ══════════════════════════════════════════════════════════ */\n%s"
                     % (src, note, m.group(1).strip()))
    out = os.path.join(os.path.dirname(OUT), "현재-스타일.css")
    io.open(out, "w", encoding="utf-8", newline="").write(
        "/* 지금 쓰는 화면 스타일 — `python tools/design-shots.py` 가 원본에서 뽑아 씁니다.\n"
        "   이 파일을 고쳐도 앱에 반영되지 않습니다(원본은 각 HTML 안의 <style>).\n"
        "   제안은 이 파일 위에서 하시면 저희가 원본에 옮깁니다.\n\n"
        "   ⛔ `@media print { … }` 블록은 인쇄물의 일부입니다. 그 안은 건드리지 마세요. */\n\n"
        + "\n\n".join(parts) + "\n")
    print("  ✓ %-24s %5.0f KB" % ("현재-스타일.css", os.path.getsize(out) / 1024.0))


def main():
    ap = argparse.ArgumentParser(description="디자인 검토용 화면 갈무리")
    ap.add_argument("--size", default="1920x1080", help="가로 화면 크기 (기본 1920x1080)")
    ap.add_argument("--only", help="이름에 이 글자가 든 것만")
    ap.add_argument("--no-portrait", action="store_true", help="세로 화면은 건너뛴다")
    ap.add_argument("--css-only", action="store_true", help="CSS 만 다시 뽑는다")
    a = ap.parse_args()

    if a.css_only:
        os.makedirs(OUT, exist_ok=True)
        dump_css()
        return 0

    w, h = (int(x) for x in a.size.lower().split("x"))
    os.makedirs(OUT, exist_ok=True)
    total = 0
    print("화면 갈무리 → %s  (%dx%d)\n" % (os.path.relpath(OUT, ROOT), w, h))
    for name, src, cfg, script, _desc in SHOTS:
        if name.startswith("etc-"):
            continue                      # 설명만 있는 항목
        if a.only and a.only not in name:
            continue
        total += shoot(name, src, cfg, script, w, h)
        if not a.no_portrait and name in PORTRAIT:
            total += shoot(name, src, cfg, script, 1080, 1920, "-세로")
    dump_css()
    print("\n합계 %.1f MB" % (total / 1048576.0))
    return 0


if __name__ == "__main__":
    sys.exit(main())
