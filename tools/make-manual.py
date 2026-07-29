#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make-manual.py — 운영문서 마크다운 → 배포용 PDF (그림 자동 촬영·삽입)

  사용: python tools/make-manual.py                     # 붙임2 사용매뉴얼 → 운영문서/사용매뉴얼.pdf
        python tools/make-manual.py 운영문서/붙임1_시행계획서.md 운영문서/시행계획서.pdf

마크다운이 원본(single source of truth)이고 PDF는 여기서 다시 만든다.
서식을 추가하면 .md만 고치고 이 스크립트를 돌리면 PDF가 갱신된다.

그림은 마크다운에 `![캡션](fig:이름)` 으로 표시하면, 아래 FIGURES에 정의된
화면을 헤드리스 크롬으로 그때그때 촬영해 base64로 박아 넣는다(외부 파일 없음).

필요 : 크롬(헤드리스). PyMuPDF는 결과 확인용으로만 쓰며 없어도 동작한다.
"""
import base64, io, os, re, subprocess, sys, tempfile

try:                       # 콘솔 코드페이지(cp949)와 무관하게 한글·기호 출력
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
]

# 그림 정의 — 이름 → {file, js, size, crop, patch, budget}
#   file   : 촬영할 HTML (리포 루트 기준)
#   js     : 촬영 전 주입할 스크립트 (예: 예시 채우고 특정 단계로 이동)
#   size   : 창 크기 (뷰포트). 잘라 찍는 방식이라 문서가 더 길면 아래쪽은 안 담긴다.
#   crop   : (l,t,r,b) 로 일부만 오려낸다 — 화면 일부를 설명할 때 · PDF 용량 절감
#   patch  : 사본의 소스 문자열 치환 (타이머 단축 등)
#   budget : 가상시간(ms). 기본 6000. 타이머 화면은 짧게 줘야 원하는 순간이 잡힌다.
APT = 'fillSample("apt");'
FIGURES = {
    # ── 공통 화면 ──
    # 허브는 문서 전체 높이가 1802px — 마지막 '부동산' 섹션까지 담기게 잘라 찍는다
    "hub":        {"file": "index.html", "size": (1440, 1530)},
    "passport":   {"file": "passport-helper-v1.html", "size": (1440, 1000),
                   "js": 'fillSample("adult"); state.step=3; renderAll();'},
    # 유휴 경고 오버레이 — 대기시간을 경고시간과 같게 줄여 즉시 표시시킨다(사본만 수정)
    "idle":       {"file": "passport-helper-v1.html", "size": (1440, 1000), "budget": 1200,
                   "js": 'fillSample("adult"); state.step=3; renderAll();',
                   "patch": {"IDLE_MS = 3*60*1000": "IDLE_MS = 30*1000"}},
    # 인쇄 직전 안내 창 — 실제로 [인쇄] 를 눌러 띄우고, 인쇄는 막아 둔다
    "notice":     {"file": "passport-helper-v1.html", "size": (1440, 900), "budget": 900,
                   "js": 'fillSample("adult"); state.step=3; renderAll();'
                         ' window.print=function(){};'
                         ' document.getElementById("btnPrint").click();'},
    # 인쇄 직후 초기화 안내 — afterprint 를 직접 발생시키고, 허브 이동은 막아 화면만 담는다
    "printed":    {"file": "passport-helper-v1.html", "size": (1440, 1000), "budget": 1200,
                   "js": 'fillSample("adult"); state.step=3; renderAll();'
                         ' window.dispatchEvent(new Event("afterprint"));',
                   "patch": {"PRINTED_MS = 5000": "PRINTED_MS = 9999999"}},
    "marriage":   {"file": "marriage-helper-v1.html", "size": (1440, 1000),
                   "js": 'fillSample("adult"); state.step=4; renderAll();'},
    "realestate": {"file": "realestate-helper-v1.html", "size": (1440, 1000),
                   "js": APT + ' state.step=8; renderAll();'},

    # ── 상세 매뉴얼용 ──
    "coach":      {"file": "realestate-helper-v1.html", "size": (1500, 1150),
                   "js": APT + ' state.step=7; renderAll();', "crop": (1020, 90, 1500, 1080)},
    "topbar":     {"file": "realestate-helper-v1.html", "size": (1500, 400),
                   "js": APT, "crop": (0, 0, 1500, 120)},
    "required":   {"file": "realestate-helper-v1.html", "size": (1500, 1000),
                   "js": 'state.step=2; renderAll(); goNext();', "crop": (1020, 820, 1500, 1000)},
    "preview":    {"file": "realestate-helper-v1.html", "size": (1440, 1000),
                   "js": APT + ' openPreview();'},
    "summary":    {"file": "realestate-helper-v1.html", "size": (1500, 1150),
                   "js": APT + ' state.step=11; renderAll();', "crop": (1020, 90, 1500, 1120)},
    "mobile":     {"file": "realestate-helper-v1.html", "size": (560, 1000),
                   "js": APT + ' state.step=8; renderAll();'},
    "money":      {"file": "realestate-helper-v1.html", "size": (1500, 1150),
                   "js": APT + ' state.step=8; renderAll();', "crop": (1020, 480, 1500, 1080)},
    # ── 서식별 대표 화면(8종) ──
    "f_passport": {"file": "passport-helper-v1.html", "size": (1300, 880),
                   "js": 'fillSample("adult"); state.step=2; renderAll();'},
    "f_marriage": {"file": "marriage-helper-v1.html", "size": (1300, 880),
                   "js": 'fillSample("adult"); state.step=2; renderAll();'},
    "f_birth":    {"file": "birth-helper-v1.html", "size": (1300, 880),
                   "js": 'fillSample("adult"); state.step=2; renderAll();'},
    "f_death":    {"file": "death-helper-v1.html", "size": (1300, 880),
                   "js": 'fillSample("hospital"); state.step=2; renderAll();'},
    "f_naming":   {"file": "naming-helper-v1.html", "size": (1300, 880),
                   "js": 'fillSample("self"); state.step=2; renderAll();'},
    "f_divorce":  {"file": "divorce-helper-v1.html", "size": (1300, 880),
                   "js": 'fillSample("adult"); state.step=2; renderAll();'},
    "f_cert":     {"file": "cert-helper-v1.html", "size": (1300, 880),
                   "js": 'fillSample("self"); state.step=3; renderAll();'},
    "f_realest":  {"file": "realestate-helper-v1.html", "size": (1300, 880),
                   "js": APT + ' state.step=7; renderAll();'},
    # 별지 — 본 서식 종이를 숨겨 별지만 위로 올린 뒤 촬영한다
    "byeolji":    {"file": "realestate-helper-v1.html", "size": (1100, 1250),
                   "crop": (30, 20, 1070, 1150),
                   "js": APT + ' Object.assign(state,{nxs:"1",nxa:"1",'
                         'xs1_name:"홍길순", xs1_jumin:"6503051000000",'
                         'xs1_addr:"경기도 군포시 산본동 000-0 101동 1001호",'
                         'xs1_sd:"2", xs1_sn:"1", xs1_mobile:"01011112222",'
                         'xa1_name:"최중개", xa1_jumin:"8001011000000",'
                         'xa1_office:"금정공인중개사사무소", xa1_regno:"41410-2026-00002",'
                         'xa1_addr:"경기도 군포시 금정로 22, 2층", xa1_phone:"0313902222"});'
                         ' renderAll();'
                         ' document.querySelector(".form-col .paper:not(.extra)").style.display="none";'},
}

CSS = """
@page { size: A4; margin: 17mm 15mm 15mm; }
* { box-sizing: border-box; }
body { font-family:'Malgun Gothic','맑은 고딕',sans-serif; color:#1b1f24;
       font-size:10.5pt; line-height:1.62; margin:0; }
h1 { font-size:20pt; color:#1b5fc0; margin:0 0 2mm; letter-spacing:-.3px; }
h2 { font-size:14pt; color:#1b5fc0; margin:9mm 0 3mm; padding-bottom:1.6mm;
     border-bottom:2px solid #1b5fc0; page-break-after:avoid; }
h3 { font-size:11.5pt; margin:5mm 0 2mm; color:#123f7f; page-break-after:avoid; }
p  { margin:0 0 2.4mm; }
ul,ol { margin:0 0 2.8mm; padding-left:6mm; }
li { margin:0 0 1.4mm; }
li > ul, li > ol { margin:1.4mm 0 0; }
strong { color:#0f172a; }
hr { border:0; border-top:1px solid #d7dde5; margin:6mm 0; }
.subtitle { color:#5b6470; font-size:9.5pt; margin:0 0 6mm; }
blockquote { margin:4mm 0; padding:3.5mm 5mm; background:#fff8e1;
             border:1px solid #f0d48a; border-left:4px solid #e8a13a;
             border-radius:5px; page-break-inside:avoid; }
blockquote h3 { margin:0 0 2mm; color:#8a5a00; }
blockquote ul { margin-bottom:0; }
blockquote p:last-child { margin-bottom:0; }
table { width:100%; border-collapse:collapse; margin:3mm 0 4mm; font-size:9.8pt; }
th,td { border:1px solid #c8d0da; padding:2.2mm 3mm; vertical-align:top; text-align:left; }
th { background:#eef3fb; color:#123f7f; font-weight:700; }
tr { page-break-inside:avoid; }
figure { margin:4mm 0 5mm; page-break-inside:avoid; text-align:center; }
figure img { width:100%; border:1px solid #c8d0da; border-radius:5px; display:block;
             margin:0 auto; }
figure.tall img { width:62%; }      /* 세로로 긴 화면은 줄여서 한 쪽을 다 먹지 않게 */
figcaption { font-size:9pt; color:#5b6470; margin-top:1.8mm; text-align:left; }
.tail { margin-top:8mm; padding-top:3mm; border-top:1px solid #d7dde5;
        color:#5b6470; font-size:9.5pt; }
"""


def png_size(data):
    """PNG IHDR에서 (가로, 세로) — 외부 라이브러리 없이."""
    return (int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big"))


def chrome():
    for c in CHROME_CANDIDATES:
        if os.path.exists(c):
            return c
    sys.exit("크롬을 찾을 수 없습니다: " + " / ".join(CHROME_CANDIDATES))


def shoot(name, spec, tmpdir):
    """FIGURES 항목을 헤드리스 크롬으로 촬영해 PNG 바이트를 돌려준다."""
    vw, vh = spec["size"]
    src = io.open(os.path.join(ROOT, spec["file"]), encoding="utf-8").read()
    for old, new in (spec.get("patch") or {}).items():
        if old not in src:
            sys.exit("그림 '%s': 치환 대상을 찾지 못했습니다 → %s" % (name, old))
        src = src.replace(old, new)
    js = spec.get("js")
    if js:
        i = src.rindex("</script>")
        src = src[:i] + "\n" + js + "\n" + src[i:]
    page = os.path.join(tmpdir, "fig_%s.html" % name)
    io.open(page, "w", encoding="utf-8").write(src)
    png = os.path.join(tmpdir, "fig_%s.png" % name)
    subprocess.run([chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--window-size=%d,%d" % (vw, vh), "--screenshot=" + png,
                    "--virtual-time-budget=%d" % spec.get("budget", 6000),
                    "file:///" + page.replace("\\", "/")], capture_output=True)
    if not os.path.exists(png):
        sys.exit("그림 '%s' 촬영 실패" % name)
    crop = spec.get("crop")
    if crop:
        try:
            from PIL import Image
        except ImportError:
            sys.exit("crop 옵션에는 Pillow가 필요합니다:  pip install pillow")
        im = Image.open(png)
        box = (max(0, crop[0]), max(0, crop[1]), min(im.width, crop[2]), min(im.height, crop[3]))
        buf = io.BytesIO()
        im.crop(box).save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    return io.open(png, "rb").read()


# ── 마크다운(이 문서들이 쓰는 부분집합) → HTML ────────────────────────────
def inline(t):
    t = (t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"`(.+?)`", r"<code>\1</code>", t)
    return t


def md_to_html(md, figs):
    out, lines, i = [], md.split("\n"), 0
    list_stack = []          # 'ul' / 'ol'

    def close_lists(depth=0):
        while len(list_stack) > depth:
            out.append("</%s>" % list_stack.pop())

    while i < len(lines):
        raw = lines[i].rstrip()
        line = raw.strip()

        # 그림: ![캡션](fig:이름)
        m = re.match(r"^!\[(.*)\]\(fig:([a-z0-9_]+)\)$", line)
        if m:
            close_lists()
            cap, key = m.group(1), m.group(2)
            b64, (iw, ih) = figs[key]
            cls = " class=\"tall\"" if ih > iw * 0.75 else ""
            out.append('<figure%s><img src="data:image/png;base64,%s" alt="%s">'
                       '<figcaption>%s</figcaption></figure>'
                       % (cls, b64, inline(cap), inline(cap)))
            i += 1
            continue

        if not line:
            close_lists(); i += 1; continue

        if line.startswith("---"):
            close_lists(); out.append("<hr>"); i += 1; continue

        # 표 (| … | 로 시작하고 다음 줄이 구분선)
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|$", lines[i+1].strip()):
            close_lists()
            head = [c.strip() for c in line.strip("|").split("|")]
            out.append("<table><thead><tr>"
                       + "".join("<th>%s</th>" % inline(c) for c in head)
                       + "</tr></thead><tbody>")
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                cells = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                out.append("<tr>" + "".join("<td>%s</td>" % inline(c) for c in cells) + "</tr>")
                i += 1
            out.append("</tbody></table>")
            continue

        # 인용(콜아웃) 블록
        if line.startswith(">"):
            close_lists()
            block = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                block.append(re.sub(r"^>\s?", "", lines[i].strip()))
                i += 1
            out.append("<blockquote>" + md_to_html("\n".join(block), figs) + "</blockquote>")
            continue

        if line.startswith("### "):
            close_lists(); out.append("<h3>%s</h3>" % inline(line[4:])); i += 1; continue
        if line.startswith("## "):
            close_lists(); out.append("<h2>%s</h2>" % inline(line[3:])); i += 1; continue
        if line.startswith("# "):
            close_lists(); out.append("<h1>%s</h1>" % inline(line[2:])); i += 1; continue

        # 목록 (들여쓰기 2~3칸 = 한 단계 중첩)
        m = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", raw)
        if m:
            indent, marker, text = len(m.group(1)), m.group(2), m.group(3)
            depth = 1 if indent >= 2 else 0
            kind = "ul" if marker in ("-", "*") else "ol"
            while len(list_stack) > depth + 1:
                out.append("</%s>" % list_stack.pop())
            if len(list_stack) == depth + 1 and list_stack[-1] != kind:
                out.append("</%s>" % list_stack.pop())
            if len(list_stack) < depth + 1:
                out.append("<%s>" % kind); list_stack.append(kind)
            out.append("<li>%s</li>" % inline(text))
            i += 1
            continue

        close_lists()
        if line.startswith("*") and line.endswith("*") and len(line) > 2:
            out.append('<p class="tail">%s</p>' % inline(line[1:-1]))
        else:
            out.append("<p>%s</p>" % inline(line))
        i += 1

    close_lists()
    return "\n".join(out)


def main():
    md_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join("운영문서", "붙임2_사용매뉴얼.md")
    pdf_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join("운영문서", "사용매뉴얼.pdf")
    md_path = md_path if os.path.isabs(md_path) else os.path.join(ROOT, md_path)
    pdf_path = pdf_path if os.path.isabs(pdf_path) else os.path.join(ROOT, pdf_path)

    md = io.open(md_path, encoding="utf-8").read()
    needed = sorted(set(re.findall(r"\]\(fig:([a-z0-9_]+)\)", md)))

    tmpdir = tempfile.mkdtemp(prefix="manual_")
    figs = {}
    for name in needed:
        if name not in FIGURES:
            sys.exit("정의되지 않은 그림: fig:%s (make-manual.py의 FIGURES에 추가하세요)" % name)
        png = shoot(name, FIGURES[name], tmpdir)
        figs[name] = (base64.b64encode(png).decode("ascii"), png_size(png))
        print("  촬영: %-11s %6.0f KB  %dx%d" % ((name, len(png) / 1024) + png_size(png)))

    # 제목 다음 줄(〔붙임…〕)은 부제로 처리
    body_md = md
    m = re.match(r"^#\s+(.*?)\n+(〔.*?)\n", md)
    head = ""
    if m:
        head = "<h1>%s</h1>\n<p class=\"subtitle\">%s</p>" % (inline(m.group(1)), inline(m.group(2)))
        body_md = md[m.end():]

    html = ("<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\">"
            "<title>%s</title><style>%s</style></head><body>%s%s</body></html>"
            % (inline(re.sub(r"[「」]", "", m.group(1)) if m else "매뉴얼"),
               CSS, head, md_to_html(body_md, figs)))

    src_html = os.path.join(tmpdir, "manual.html")
    io.open(src_html, "w", encoding="utf-8").write(html)
    subprocess.run([chrome(), "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                    "--print-to-pdf=" + pdf_path, "--virtual-time-budget=8000",
                    "file:///" + src_html.replace("\\", "/")], capture_output=True)
    if not os.path.exists(pdf_path):
        sys.exit("PDF 생성 실패")
    size = os.path.getsize(pdf_path)
    pages = ""
    try:
        import fitz
        d = fitz.open(pdf_path); pages = " · %d쪽" % d.page_count; d.close()
    except Exception:
        pass
    print("✓ 생성 완료: %s (%.1f KB%s)" % (os.path.relpath(pdf_path, ROOT), size / 1024, pages))


if __name__ == "__main__":
    main()
