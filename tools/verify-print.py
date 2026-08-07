#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
verify-print.py — 인쇄물 회귀 검증 (이 프로젝트의 안전망)

서식 도우미 8종 × 작성예시 2종 = 16건을 헤드리스 크롬으로 인쇄(PDF)하고,
tests/baseline/ 의 기준선 이미지와 **픽셀 단위로** 비교한다.
좌표·서식·엔진을 고친 뒤 "인쇄물이 안 변했다"를 증명하는 용도.

  python tools/verify-print.py                 # 전체 16건 검증
  python tools/verify-print.py passport cert   # 일부만
  python tools/verify-print.py --update        # 기준선 갱신(변경이 '의도된' 것일 때만!)
  python tools/verify-print.py --dpi 200       # 더 촘촘히 (기준선도 같은 dpi여야 함)

판정
  ✓ 0px    — 인쇄물 동일 (기대값)
  ✗ N px   — 다름. `_vp_diff_<서식>-<예시>-p<쪽>.png` 에 다른 자리를 빨갛게 표시해 둔다
  ✗ 쪽수    — 페이지 수가 달라짐(첨부·별지가 붙거나 빠짐)

⚠️ 렌더 → 래스터화 → 비교를 **한 프로세스 안에서** 끝낸다.
   이 PC의 DRM 에이전트가 새로 만든 PDF를 몇 분 뒤 암호화하기 때문에,
   PDF를 파일로 남겨 두고 나중에 다시 열면 `no objects found` 로 실패한다.

⚠️ 서식에는 **오늘 날짜가 찍힌다**(신청일·동의일). 날짜를 그대로 두면 기준선을 만든
   다음 날부터 매일 '회귀'로 잡히므로, 렌더할 때 시계를 FIXED_DATE 로 고정한다.
"""
import io, os, re, sys, subprocess, tempfile

sys.stdout.reconfigure(encoding="utf-8")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, "tests", "baseline")

# 서식 → 작성예시 키 2종. 엔진 서식은 config 의 sampleKinds, 손작성 3종은 fillSample 인자.
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

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

# 기준선은 16단계 회색으로 양자화해 저장한다(용량 1/2). 비교할 때 양쪽에 같은 처리를
# 하므로 판정은 그대로 엄격하다 — 회색 단계가 하나라도 다르면 '다른 픽셀'로 센다.
TOL = 8

# 렌더할 때 고정하는 날짜(기준선을 처음 만든 날). 서식의 신청일·동의일이 이 날짜로 찍힌다.
# 바꾸면 인쇄물이 달라지므로 --update 로 기준선을 다시 만들어야 한다.
FIXED_DATE = (2026, 8, 4)

# 페이지의 모든 스크립트보다 **먼저** 실행돼야 한다(<head> 첫머리에 넣는 이유).
# 서식들은 로드 시점에 APP_TODAY=new Date() 로 오늘을 붙잡아 두므로, 나중에 끼워 넣으면 늦다.
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


def norm(img):
    """비교·저장 공통 정규화: 흑백 + 16단계 양자화 (같은 입력 → 같은 출력)."""
    return img.convert("L").point(lambda v: (v >> 4) << 4)


def chrome_path():
    for p in CHROME_CANDIDATES:
        if os.path.exists(p):
            return p
    sys.exit("크롬을 찾을 수 없습니다. CHROME_CANDIDATES 경로를 확인하세요.")


def render(name, kind, dpi, chrome):
    """도우미 HTML에 작성예시를 채워 인쇄한 뒤, 쪽별 흑백 이미지(PIL) 목록을 돌려준다."""
    from PIL import Image
    import fitz

    src = os.path.join(ROOT, "%s-helper-v1.html" % name)
    html = io.open(src, encoding="utf-8").read()

    # 시계 고정을 <head> 첫머리에 — 페이지 스크립트보다 먼저 실행돼야 한다.
    m = re.search(r"<head[^>]*>", html, re.I)
    if not m:
        sys.exit("%s: <head> 를 찾을 수 없습니다(시계 고정 주입 실패)." % src)
    html = html[:m.end()] + CLOCK_FREEZE + html[m.end():]

    # 작성예시를 채우고 다시 그린다. 실패하면 title 로 알린다(조용한 실패 방지).
    inject = (
        '<script>try{fillSample("%s");renderAll();}'
        'catch(e){document.title="SAMPLE_FAIL: "+e.message;}</script>' % kind
    )
    at = html.rfind("</body>")
    if at < 0:
        sys.exit("%s: </body> 를 찾을 수 없습니다." % src)
    html = html[:at] + inject + html[at:]

    # 임시 산출물은 `_` 로 시작(.gitignore 처리됨). PDF는 이 함수 안에서만 살아 있다.
    tmp_html = os.path.join(ROOT, "_vp_%s_%s.html" % (name, kind))
    tmp_pdf = os.path.join(ROOT, "_vp_%s_%s.pdf" % (name, kind))
    io.open(tmp_html, "w", encoding="utf-8", newline="").write(html)

    url = "file:///" + tmp_html.replace("\\", "/")  # ⚠️ file:///C:/... 형식만 동작
    cmd = [
        chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
        "--no-pdf-header-footer", "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=4000",
        "--print-to-pdf=" + tmp_pdf, url,
    ]
    subprocess.run(cmd, capture_output=True,
                   cwd=tempfile.gettempdir(), timeout=180)
    if not os.path.exists(tmp_pdf):
        os.path.exists(tmp_html) and os.remove(tmp_html)
        return None, "인쇄(PDF) 생성 실패"

    pages = []
    with fitz.open(tmp_pdf) as doc:
        for pg in doc:
            pm = pg.get_pixmap(dpi=dpi, colorspace=fitz.csGRAY)
            pages.append(norm(Image.open(io.BytesIO(pm.tobytes("png")))))

    for f in (tmp_html, tmp_pdf):
        os.path.exists(f) and os.remove(f)
    return pages, None


def compare(cur, ref):
    """다른 픽셀 수와 진단용 diff 이미지를 돌려준다."""
    from PIL import Image, ImageChops
    if cur.size != ref.size:
        return -1, None
    diff = ImageChops.difference(cur, ref)
    mask = diff.point(lambda v: 255 if v > TOL else 0)
    n = sum(mask.histogram()[255:])
    if n == 0:
        return 0, None
    # 기준선을 옅게 깔고 다른 자리를 빨갛게
    out = Image.merge("RGB", (cur.point(lambda v: 255 - (255 - v) // 3),) * 3)
    red = Image.new("RGB", cur.size, (220, 20, 20))
    out.paste(red, mask=mask)
    return n, out


def main():
    args = sys.argv[1:]
    update = "--update" in args
    dpi = 150
    if "--dpi" in args:
        dpi = int(args[args.index("--dpi") + 1])
        args = args[: args.index("--dpi")] + args[args.index("--dpi") + 2:]
    only = [a for a in args if not a.startswith("--")]
    todo = [(n, k) for n, k in FORMS if not only or n in only]
    if not todo:
        sys.exit("해당하는 서식이 없습니다: %s" % ", ".join(only))

    os.makedirs(BASE, exist_ok=True)
    chrome = chrome_path()
    print("%s  dpi=%d  대상 %d종" % ("기준선 갱신" if update else "인쇄물 검증", dpi, len(todo)))

    from PIL import Image
    bad, checked, missing = [], 0, 0
    for name, kinds in todo:
        for kind in kinds:
            label = "%s-%s" % (name, kind)
            pages, err = render(name, kind, dpi, chrome)
            if err:
                print("  ✗ %-22s %s" % (label, err)); bad.append(label); continue

            for i, img in enumerate(pages, 1):
                ref_path = os.path.join(BASE, "%s-p%d.png" % (label, i))
                tag = "%s-p%d" % (label, i)
                if update or not os.path.exists(ref_path):
                    img.save(ref_path, optimize=True)
                    print("  + %-22s 기준선 %s (%dx%d, %.0fKB)" % (
                        tag, "갱신" if update else "생성", img.width, img.height,
                        os.path.getsize(ref_path) / 1024))
                    missing += 0 if update else 1
                    continue
                n, dimg = compare(img, norm(Image.open(ref_path)))
                checked += 1
                if n == 0:
                    print("  ✓ %-22s 0px" % tag)
                else:
                    if n < 0:
                        print("  ✗ %-22s 크기 불일치 (인쇄 배율·용지가 바뀜)" % tag)
                    else:
                        d = os.path.join(ROOT, "_vp_diff_%s.png" % tag)
                        dimg.save(d)
                        print("  ✗ %-22s %d px 다름 → %s" % (tag, n, os.path.basename(d)))
                    bad.append(tag)

            # 기준선에는 있는데 이번엔 안 나온 쪽 = 첨부·별지가 사라진 것
            extra = 1 + len(pages)
            while os.path.exists(os.path.join(BASE, "%s-p%d.png" % (label, extra))):
                print("  ✗ %s-p%d 쪽이 사라졌습니다(첨부·별지 누락)" % (label, extra))
                bad.append("%s-p%d" % (label, extra))
                extra += 1

    print()
    if update:
        print("기준선을 갱신했습니다. 변경이 의도된 것인지 확인하고 커밋하십시오.")
    elif bad:
        print("✗ 회귀 %d건: %s" % (len(bad), ", ".join(bad)))
        print("  의도한 변경이라면 --update 로 기준선을 갱신하고, 그 이유를 CHANGELOG.md 에 적으십시오.")
        sys.exit(1)
    else:
        print("✓ 전부 동일 — 검증 %d쪽%s" % (
            checked, ", 기준선 신규 %d쪽" % missing if missing else ""))


if __name__ == "__main__":
    main()
