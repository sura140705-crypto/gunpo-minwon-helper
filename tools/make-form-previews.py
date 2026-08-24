# -*- coding: utf-8 -*-
"""허브(Main)의 서식 미리보기 그림을 만든다 — `index.html` 의 FORM-IMAGES 블록.

    python tools/make-form-previews.py            # 다시 만든다
    python tools/make-form-previews.py --check    # 블록이 있고 8종이 다 있는지만 본다

허브는 서식을 고르면 오른쪽에 **그 서식의 실제 1쪽**을 띄운다. 그런데 각 서식이
품고 있는 배경은 **인쇄 해상도**(1191×1684 안팎, base64 로 300~400KB)라 8종을 그대로
싣으면 허브가 2.8MB 가 된다. 미리보기는 화면에서 700px 안팎으로만 보이므로 그 크기로
줄여 싣는다 — 8종 합쳐 600KB 안팎이다.

⛔ **인쇄물과 무관하다.** 여기서 만드는 그림은 허브 화면에만 쓰인다. 각 서식이 인쇄에
   쓰는 배경(`engine/assets/*.b64` · 손작성 3종의 `FORM_IMG`)은 건드리지 않는다.
⚠️ WEBP 를 쓴다. 배포본이 Electron(Chromium)이고 웹 배포도 크롬 기준이라 안전하다.
   같은 화질에서 JPEG 의 절반, PNG 의 1/4 이다(선으로 된 서식 스캔이라 차이가 크다).
"""
import argparse
import base64
import io
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WIDTH = 760          # 미리보기 가로 픽셀 (1920 화면에서 실제로 보이는 폭은 ~670)
QUALITY = 80

# 엔진 5종은 배경 파일이 따로 있고, 손작성 3종은 HTML 안에 박혀 있다
ENGINE = ["birth", "death", "naming", "cert", "realestate"]
HAND = ["passport", "marriage", "divorce"]
KEYS = ["passport", "birth", "marriage", "death", "naming", "divorce", "cert", "realestate"]

PAT = re.compile(r"<!--FORM-IMAGES v1-->.*?<!--/FORM-IMAGES-->", re.S)


def source_b64(key):
    """그 서식이 쓰는 1쪽 배경을 base64 문자열로."""
    p = os.path.join(ROOT, "engine", "assets", key + ".b64")
    if os.path.exists(p):
        s = io.open(p, encoding="utf-8").read().strip()
        return s.split(",", 1)[1] if s.startswith("data:") else s
    p = os.path.join(ROOT, key + "-helper-v1.html")
    s = io.open(p, encoding="utf-8").read()
    m = re.search(r'FORM_IMG\s*=\s*"data:image/[a-z]+;base64,([^"]+)"', s)
    if not m:
        sys.exit("X %s 의 배경(FORM_IMG)을 찾지 못했습니다" % key)
    return m.group(1)


def shrink(b64):
    im = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
    h = round(WIDTH * im.height / im.width)
    im = im.resize((WIDTH, h), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=QUALITY)
    return base64.b64encode(buf.getvalue()).decode("ascii"), (WIDTH, h)


def build():
    lines, total = [], 0
    for k in KEYS:
        b64, size = shrink(source_b64(k))
        total += len(b64)
        print("  %-11s %d×%d  %5.0f KB" % (k, size[0], size[1], len(b64) / 1024.0))
        lines.append('  %s:"data:image/webp;base64,%s"' % (k, b64))
    print("  %-11s %19.0f KB" % ("합계", total / 1024.0))
    return ("<!--FORM-IMAGES v1-->\n<script>\n"
            '"use strict";\n'
            "/* 허브 미리보기용 서식 1쪽 그림 — `python tools/make-form-previews.py` 가 만든다.\n"
            "   ⛔ **인쇄물과 무관하다.** 각 서식이 인쇄에 쓰는 배경은 따로 있고 손대지 않는다.\n"
            "   ⚠️ 손으로 고치지 마라. 서식 배경이 바뀌면 위 도구를 다시 돌려라.\n"
            "   ⚠️ 인쇄 해상도 원본(8종 합쳐 2.8MB)을 그대로 실으면 허브가 무거워진다.\n"
            "      화면에서 700px 안팎으로만 보이므로 %dpx WEBP 로 줄였다. */\n"
            "var FORM_IMAGES = {\n%s\n};\n</script>\n<!--/FORM-IMAGES-->"
            % (WIDTH, ",\n".join(lines)))


def main():
    ap = argparse.ArgumentParser(description="허브 서식 미리보기 그림")
    ap.add_argument("--check", action="store_true", help="블록이 있고 8종이 다 있는지만 본다")
    a = ap.parse_args()

    p = os.path.join(ROOT, "index.html")
    s = io.open(p, encoding="utf-8", newline="").read()

    if a.check:
        m = PAT.search(s)
        if not m:
            print("X index.html 에 FORM-IMAGES 블록이 없습니다")
            return 1
        miss = [k for k in KEYS if ('%s:"data:image/webp' % k) not in m.group(0)]
        if miss:
            print("X 빠진 서식: %s" % " ".join(miss))
            return 1
        print("✓ 미리보기 8종 모두 있습니다 (%.0f KB)" % (len(m.group(0)) / 1024.0))
        return 0

    print("미리보기 그림 만드는 중 (%dpx WEBP q%d)\n" % (WIDTH, QUALITY))
    blk = build()
    if PAT.search(s):
        s = PAT.sub(lambda _m: blk, s, count=1)
    else:
        i = s.index("<!--FORM-CATALOG v1-->")
        s = s[:i] + blk + "\n" + s[i:]
    io.open(p, "w", encoding="utf-8", newline="").write(s)
    print("\n→ index.html (%.1f MB)" % (len(s) / 1048576.0))
    print("⚠️ `bash tools/sync-kiosk.sh` 로 키오스크에도 옮기세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
