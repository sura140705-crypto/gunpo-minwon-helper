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
  python tools/verify-print.py --electron      # 키오스크와 같은 Electron 조판으로 검증

⚠️ 기본값은 데스크톱 크롬이다. 그런데 **실제 인쇄가 지나가는 것은 Electron 경로**이므로,
   크롬만 검증하면 둘 사이의 차이를 못 본다 — 2026.08.12 의 용지 사고(Electron 이
   `@page{size:A4}` 를 무시하고 Letter 로 조판)가 정확히 그 틈으로 빠져나갔다.
   `--electron` 은 같은 기준선에 대고 Electron 조판을 비교하고, **용지가 A4 인지도 검사**한다.
   기준선은 하나다 — 두 경로가 같은 결과를 내야 한다는 것이 이 검증의 요지다.

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
    # proxy = 성인 대리 신청. 2쪽 「위임장」은 이 예시가 아니면 어느 도구도 보지 못한다.
    ("passport",   ["adult", "minor", "proxy"]),
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

# 키오스크가 실제로 쓰는 Electron. `kiosk-app` 의 개발 의존성에 들어 있다.
ELECTRON_EXE = os.path.join(ROOT, "kiosk-app", "node_modules", "electron", "dist", "electron.exe")
ELECTRON_SCRIPT = os.path.join(ROOT, "tools", "print-electron.js")

# 용지 검사 허용 오차(mm). Electron 내부 반올림이 0.1mm 안팎 있으므로 0 은 쓸 수 없다.
PAGE_MM = (210.0, 297.0)
PAGE_TOL = 0.5

# 기준선은 16단계 회색으로 양자화해 저장한다(용량 1/2). 비교할 때 양쪽에 같은 처리를
# 하므로 판정은 그대로 엄격하다 — 회색 단계가 하나라도 다르면 '다른 픽셀'로 센다.
TOL = 8

# `--electron` 전용 허용치. 크롬 경로는 지금도 **0px 가 기본값**이고 여기서 느슨해지지 않는다.
#
# 크롬과 Electron 은 크로미움 빌드가 달라 글자 몇 개의 안티에일리어싱이 미세하게 다르다
# (실측: 19쪽 중 18쪽이 0px, 나머지 1쪽이 주민번호 숫자 몇 글자에서 246px).
# 반면 **조판이 어긋나면 자릿수가 다르다** — 기준선을 1px(0.17mm) 밀어 보면
# 66,000~300,000px 가 달라진다. 그래서 이 값은 글자 잡음(수백)보다 크고
# 실제 어긋남(수만)보다 두 자릿수 작은 자리에 둔다. 넘긴 쪽은 회귀로 잡힌다.
ELECTRON_PX_TOL = 2000

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


def electron_path():
    if not os.path.exists(ELECTRON_EXE):
        sys.exit("Electron 을 찾을 수 없습니다: %s\n  kiosk-app 에서 `npm install` 을 먼저 하세요."
                 % ELECTRON_EXE)
    if not os.path.exists(ELECTRON_SCRIPT):
        sys.exit("렌더러가 없습니다: %s" % ELECTRON_SCRIPT)
    return ELECTRON_EXE


def paper_check(electron):
    """실제 인쇄와 같은 옵션(`print-options.forPdf()`)으로 한 장 뽑아 **용지**만 본다.

    `pageSize` 가 빠지면 Electron 은 CSS 의 `@page{size:A4}` 를 무시하고 Letter 로 조판한다.
    A4 조판을 Letter 에 맞추면 가로 +2.9%·세로 -5.9% 로 **두 축이 반대로** 어긋나므로
    프린터 여백 설정으로는 고쳐지지 않는다. 픽셀 비교와 별개로 여기서 먼저 잡는다.
    """
    src = os.path.join(ROOT, "passport-helper-v1.html")
    tmp_pdf = os.path.join(ROOT, "_vp_paper.pdf")
    try:
        r = subprocess.run([electron, ELECTRON_SCRIPT, src, tmp_pdf],
                           capture_output=True, timeout=180)
        m = re.search(r"PAGE_MM\s+([\d.]+)\s+([\d.]+)", r.stdout.decode("utf-8", "replace"))
        if not m:
            return False, "용지를 읽지 못했습니다(렌더러 실패)"
        w, h = float(m.group(1)), float(m.group(2))
        ok = abs(w - PAGE_MM[0]) <= PAGE_TOL and abs(h - PAGE_MM[1]) <= PAGE_TOL
        note = "%.2f x %.2f mm" % (w, h)
        if not ok:
            note += "  (A4 는 %.0f x %.0f — Letter 는 215.9 x 279.4)" % PAGE_MM
        return ok, note
    finally:
        os.path.exists(tmp_pdf) and os.remove(tmp_pdf)


def render(name, kind, dpi, engine):
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

    kindof, exe = engine
    if kindof == "electron":
        # 키오스크와 같은 Chromium 으로 조판한다. 기준선(크롬)과 **같은 페이지 상자**를 얻으려고
        # `--css-page`(preferCSSPageSize) 를 쓴다 — `pageSize:'A4'` 는 내부 반올림 때문에
        # 0.1% 크게 나와 픽셀 비교가 크기 불일치로 떨어진다. 용지 자체는 paper_check() 가 본다.
        cmd = [exe, ELECTRON_SCRIPT, tmp_html, tmp_pdf, "--css-page"]
    else:
        url = "file:///" + tmp_html.replace("\\", "/")  # ⚠️ file:///C:/... 형식만 동작
        cmd = [
            exe, "--headless=new", "--disable-gpu", "--hide-scrollbars",
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
    use_electron = "--electron" in args
    if update and use_electron:
        sys.exit("--update 는 크롬 경로에서만 하십시오. 기준선은 하나이고, "
                 "Electron 조판이 그 기준선과 같아야 한다는 것이 이 검증의 요지입니다.")
    dpi = 150
    if "--dpi" in args:
        dpi = int(args[args.index("--dpi") + 1])
        args = args[: args.index("--dpi")] + args[args.index("--dpi") + 2:]
    only = [a for a in args if not a.startswith("--")]
    todo = [(n, k) for n, k in FORMS if not only or n in only]
    if not todo:
        sys.exit("해당하는 서식이 없습니다: %s" % ", ".join(only))

    os.makedirs(BASE, exist_ok=True)
    engine = ("electron", electron_path()) if use_electron else ("chrome", chrome_path())
    print("%s  dpi=%d  대상 %d종  경로=%s" % (
        "기준선 갱신" if update else "인쇄물 검증", dpi, len(todo),
        "Electron(키오스크)" if use_electron else "크롬(기준선)"))

    from PIL import Image
    bad, checked, missing = [], 0, 0

    # Electron 경로에서는 픽셀 비교에 앞서 **용지**부터 본다. 여기서 틀리면 나머지는 볼 것도 없다.
    if use_electron:
        ok, note = paper_check(engine[1])
        print("  %s 용지(실제 인쇄 옵션)      %s" % ("✓" if ok else "✗", note))
        if not ok:
            bad.append("용지")
    for name, kinds in todo:
        for kind in kinds:
            label = "%s-%s" % (name, kind)
            pages, err = render(name, kind, dpi, engine)
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
                elif use_electron and 0 < n <= ELECTRON_PX_TOL:
                    # 숨기지 않고 숫자를 그대로 보여 준다 — 늘어나면 눈에 띄어야 한다.
                    print("  ✓ %-22s %d px (글자 렌더 차이 · 허용 %d)" % (tag, n, ELECTRON_PX_TOL))
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
