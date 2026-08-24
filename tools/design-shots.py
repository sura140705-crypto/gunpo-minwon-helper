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
     "여권 첫 화면. 2026.08.21 개편으로 **세 영역**(질문면·서식·안내 기둥)이 됐다 — "
     "나머지 7종에는 이 흐름이 없다."),
    ("pass-02-주민번호", "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다"); '
             'state.data.nameKor="홍길동"; goNext(); goNext();',
     "카드와 입력칸이 한 화면에 같이 있는 경우(선택 → 그 자리에서 입력칸이 열린다). "
     "왼쪽 아래 빨간 줄은 **아직 안 적었다는 표시**다 — 틀렸다는 뜻이 아니다."),
    ("pass-03-입력화면", "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다"); goNext();',
     "글자를 치는 화면. 왼쪽이 질문면, 가운데가 실제 인쇄될 서식, 오른쪽이 안내 기둥이다."),
    ("pass-04-최종확인", "passport-helper-v1.html", {},
     'fillSample("adult"); renderAll(); state.step=flow().length; renderAll();',
     "인쇄 직전 요약. 줄마다 「수정」이 붙어 그 자리에서 고치러 간다(2026.08.21 신설). "
     "[다음] 자리를 인쇄 버튼이 받는다."),
    ("pass-05-창구전환", "passport-helper-v1.html", {},
     'toCounter("P-04"); renderAll();',
     "창구로 넘기는 화면. 오류가 아니라 정상 완료 유형 중 하나로 설계했다."),
    ("pass-06-작성예시", "passport-helper-v1.html", {},
     'fillSample("adult"); renderAll();',
     "작성예시(가상 인물)를 채운 상태. 가운데 서식에 값이 얹힌다."),
    ("pass-07-작성전준비", "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다");',
     "「작성 전 준비」(2026.08.21 신설). 무엇을 들고 와야 하는지 한 번 보여 준다 — "
     "⛔ 없어도 막지 않는다. 같은 목록이 오른쪽 기둥에 작성 내내 남는다."),
    ("pass-08-공동친권자", "passport-helper-v1.html", {},
     'fillSample("minor"); state.data.guardian2Name=""; state.data.guardian2Rel="";'
     'state.step=flow().indexOf("guardian2")+1; renderAll();',
     "「공동친권자」(2026.08.21 신설, 미성년 경로). 앞에서 적은 긴급연락처가 부·모면 "
     "그분을 카드로 그대로 제안한다. 전부 선택이라 비워 두어도 된다."),
    # ── 크게 보기 (2026.08.24 신설, §13) ─────────────────────────────────
    # ⛔ 전체 화면 Zoom 이 아니다. 같은 질문 화면을 나란히 놓고 봐야 판단이 된다.
    ("pass-10a-일반보기", "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다"); click("확인했습니다");',
     "「성명」 화면 — 일반 보기. 아래 `pass-10b` 와 같은 화면이다."),
    ("pass-10b-크게보기", "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다"); click("확인했습니다");'
             'document.getElementById("btnBig").click();',
     "같은 화면 — 크게 보기. 질문면이 넓어지고 글자·입력칸·카드가 커지며, "
     "가운데 Paper 는 남은 폭에 스스로 맞춰진다(fit-to-area). 오른쪽 기둥은 폭 그대로 글자만 커진다."),
    # ── Validation 표시 시점 (2026.08.24, 결정 §3) ───────────────────────
    ("pass-11a-검증전", "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다"); click("확인했습니다");',
     "화면에 막 들어선 상태. **경고가 없다** — 아무것도 하지 않았으므로 정상이다. "
     "종전에는 이 자리에 빨간 상자로 「아직 입력하지 않은 항목이 있어요」가 떠 있었다."),
    ("pass-11b-검증후", "passport-helper-v1.html", {},
     CLICK + 'click("제 여권"); click("확인했습니다"); click("확인했습니다");'
             'document.getElementById("btnNext").click();',
     "빈칸인 채로 [다음]을 누른 뒤. **그때 처음** 알리고, 어느 칸인지 이름을 불러 준다."),
    ("pass-09-로마자이름", "passport-helper-v1.html", {},
     'fillSample("adult"); state.data.romanSur=""; state.data.romanGiven="";'
     'state.step=flow().indexOf("roman")+1; renderAll();',
     "로마자 성명. `시안/2026.08.21-로마자이름-시안.png` 이 이 화면의 시안이었다 — "
     "무엇을 따르고 무엇을 따르지 않았는지는 2회차 문서 §3 에 적혀 있다."),

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

    # ── 화면 초기화 3종 (2026.08.23 추가) ────────────────────────────────
    # 「뒷사람에게 앞사람 내용이 보이면 안 된다」를 지키는 장치다. 시간이 지나야 뜨는
    # 화면이라 손으로는 찍기 어렵다 — **환경설정 값을 줄여·늘려** 갈무리 안에서 띄운다.
    # ⚠️ 앱 코드는 건드리지 않는다. `window.__kioskCfg` 는 키오스크가 실제로 쓰는 통로다
    #    (`idleMs`·`printedMs`). 여기서는 그 값만 짧게·길게 준다.
    ("reset-01-무동작경고", "passport-helper-v1.html", {"idleMs": 30500},
     'fillSample("adult"); renderAll();',
     "무동작 경고. 실제로는 3분 무동작 뒤(마지막 30초)에 뜬다 — 갈무리에서는 "
     "`idleMs` 를 30.5초로 줄여 띄웠다. 숫자는 1초마다 줄어든다."),
    ("reset-02-인쇄전안내", "passport-helper-v1.html", {},
     'fillSample("adult"); renderAll();'
     'window.__printNotice("실제 크기로 인쇄해야 여권 판독기가 신청서를 정확히 읽습니다.",'
     'function(){});',
     "[인쇄]를 누르면 먼저 뜨는 안내. ①개인정보 ②여백 없음·배율 100%. "
     "「인쇄를 취소해도 초기화된다」를 여기서 미리 알린다."),
    ("reset-03-인쇄후", "passport-helper-v1.html", {"printedMs": 600000},
     'fillSample("adult"); renderAll();'
     'window.dispatchEvent(new Event("afterprint"));',
     "인쇄 창이 닫힌 뒤. 화면을 거의 불투명하게 덮고 5초 뒤 허브로 간다 — "
     "갈무리에서는 `printedMs` 를 10분으로 늘려 멈춰 세웠다."),
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


TOKENS = re.compile(r"<!--DESIGN-TOKENS v1-->\s*<style>(.*?)</style>\s*<!--/DESIGN-TOKENS-->", re.S)


def main_style(s):
    """디자인 토큰 블록과 **그 뒤에 오는 본 스타일**을 갈라 돌려준다.

    ⚠️ 종전에는 「첫 `<style>` = 본 스타일」이었는데, 2026.08.24 에 토큰 블록이
       그 앞에 생겨 이 함수가 토큰만 집어 오게 됐다(뽑힌 CSS 가 절반으로 줄어
       밖에 넘기는 자료가 조용히 반쪽이 됐다). 이제 둘을 나눠서 둘 다 뽑는다."""
    tok = TOKENS.search(s)
    rest = s[tok.end():] if tok else s
    m = re.search(r"<style>(.*?)</style>", rest, re.S)
    return (tok.group(1).strip() if tok else None), (m.group(1).strip() if m else None)


def dump_css():
    """지금 쓰는 화면 CSS 를 한 파일로 뽑는다 — 디자인 쪽이 고칠 대상이 이것이다.

    ⛔ `@media print` 블록은 **인쇄물의 일부**다. 뽑아 주되 고치지 말라고 표시해 둔다."""
    parts = []
    for src, note in [("engine/base.html", "엔진 서식 5종 + 손작성 2종(혼인·이혼)이 공유하는 틀"),
                      ("passport-helper-v1.html", "여권 도우미(2026.08 개편으로 세 영역이 됐다)"),
                      ("index.html", "허브(첫 화면)")]:
        s = io.open(os.path.join(ROOT, src), encoding="utf-8").read()
        tok, body = main_style(s)
        if tok and not parts:            # 9개 화면에 똑같이 들어가므로 한 번만 싣는다
            parts.append("/* ══════════════════════════════════════════════════════════\n"
                         "   디자인 토큰 — 9개 화면이 **글자까지 똑같이** 갖고 있는 블록\n"
                         "   — 원본은 engine/base.html, 값을 고치는 곳은 여기 하나입니다\n"
                         "   ══════════════════════════════════════════════════════════ */\n%s" % tok)
        if not body:
            continue
        parts.append("/* ══════════════════════════════════════════════════════════\n"
                     "   %s\n   — %s\n"
                     "   ══════════════════════════════════════════════════════════ */\n%s"
                     % (src, note, body))
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
