# -*- coding: utf-8 -*-
"""선 아이콘이 9개 화면에서 **같은 이름이면 같은 그림**인지 본다.

    python tools/check-icons.py        # 다르면 exit 1
    python tools/check-icons.py -v     # 이름별로 어느 파일에 있는지까지 본다

`check-design-tokens.py`(디자인 값) · `check-site-block.py`(기관별 설정)와 같은 자리의
도구다. 그 둘이 **글자까지 똑같은 블록**을 지킨다면, 이쪽은 **그림**을 지킨다.

⚠️ 왜 필요한가 — 2026.08.31 이전에는 여권과 엔진 7종이 `check`·`checklist`·`document`·
   `idcard`·`lock`·`pay`·`photo` **일곱 개 모두**를 이름만 같게 두고 서로 다르게 그리고
   있었다. 같은 키오스크에서 「준비하셨나요」·「안심하고 작성하세요」·「신분증」이
   화면마다 다른 그림이었는데, **어떤 검증도 이것을 보지 않았다** — 인쇄물은 그대로고
   화면 구조값도 그대로라 `verify-print.py` 도 `measure-screen.py` 도 조용했다.

무엇을 대조하는가

  ① **UI 아이콘 세트** — `engine/engine.js` 의 `/*ICON-SET v1*/` 블록 · 여권 `ICONS` ·
     허브 `ICONS`+`ICON_FALLBACK`(= `document`). 같은 이름이면 같은 그림이어야 한다.
     ⛔ **한쪽에만 있는 이름은 문제가 아니다.** 화면마다 쓰는 그림이 다르므로,
        안 쓰는 아이콘을 억지로 채우면 죽은 코드가 는다.
  ② **손으로 적은 SVG** — 인쇄 안내·인쇄 완료 모달(`PRINTER_SVG`)과 미리보기의
     [N장 인쇄하기] 단추는 인라인 스타일·정적 HTML 이라 `svgIcon()` 을 쓸 수 없다.
     그 세 곳이 `ICONS.printer` 와 같은 선인지 본다.
  ③ **빌드 드리프트** — 배포 7종에 인라인된 블록이 `engine/engine.js` 의 것과 같은지.

📌 허브의 **서식 상징**(passport·birth·marriage·death·naming·divorce·realestate)은
   목록에서 민원 하나하나를 가리키는 다른 세트지만, 이름이 겹치는 것(`passport`·`cert`)은
   ①의 규칙을 그대로 따른다 — 같은 이름이 화면마다 다른 그림이면 그게 곧 문제다.
"""
import argparse
import io
import os
import re
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FORMS = ["birth", "marriage", "divorce", "death", "naming", "cert", "realestate"]

# 그림을 이루는 요소와, 그 **모양을 정하는** 속성만 본다.
# ⛔ stroke·fill·class 는 비교에서 뺀다 — 자리마다 다른 것이 정상이다(색은 currentColor).
DRAW = re.compile(r"<(path|rect|circle|line|polyline|polygon)\b([^>]*?)/?>")
GEOM = ("d", "x", "y", "width", "height", "rx", "ry",
        "cx", "cy", "r", "x1", "y1", "x2", "y2", "points")


def shape(frag):
    """JS 문자열이든 인라인 SVG 마크업이든 **같은 모양이면 같은 문자열**로 만든다."""
    frag = re.sub(r"'\s*\+\s*'", "", frag)          # JS 문자열 이어붙이기
    frag = re.sub(r"\s+", " ", frag.replace("\n", " "))
    out = []
    for m in DRAW.finditer(frag):
        attrs = dict(re.findall(r'([a-zA-Z-]+)="([^"]*)"', m.group(2)))
        g = ["%s=%s" % (k, re.sub(r"\s+", " ", attrs[k].strip()))
             for k in GEOM if k in attrs]
        out.append("%s(%s)" % (m.group(1), ",".join(g)))
    return "|".join(out)


def read(path):
    return io.open(os.path.join(ROOT, path), encoding="utf-8").read()


def table(text, head):
    """`var ICONS={ … };` 같은 표를 {이름: 모양} 으로. 없으면 빈 표."""
    i = text.find(head)
    if i < 0:
        return {}
    j = text.find("\n};", i)
    blk = text[i:j]
    out = {}
    for m in re.finditer(r"^\s{2}([A-Za-z][A-Za-z0-9_]*)\s*:\s*'((?:[^']|'\s*\+\s*')*)'",
                         blk, re.M):
        out[m.group(1)] = shape(m.group(2))
    return out


def icon_set(text):
    """UI 아이콘 세트. 엔진은 `/*ICON-SET v1*/` 블록, 손작성은 `var ICONS`."""
    i = text.find("/*ICON-SET v1*/")
    if i >= 0:
        return table(text[i:], "var ICONS")
    return table(text, "var ICONS")


# 손으로 적은 프린터가 있어야 하는 자리와 그 개수.
# ⛔ **그림으로 찾지 마라.** 처음에는 「프린터처럼 생긴 SVG 를 모아서 대조」했는데,
#    그림을 바꾸면 **찾는 조건에서도 같이 빠져나가** 개수만 17 → 16 으로 줄고
#    검사는 그대로 통과했다(자체 시험에서 드러났다, 2026.08.31).
#    자리로 찾아야 「바뀌었다」와 「사라졌다」를 둘 다 잡는다.
PRINTER_SITES = {
    "engine/base-product.html": {"PRINTER_SVG": 1, "btnPrintModal": 1},
    "passport-helper-v1.html": {"PRINTER_SVG": 1},          # 미리보기 단추는 svgIcon() 이 그린다
    "index.html": {},                                        # 허브는 인쇄하지 않는다
}
for _f in FORMS:
    PRINTER_SITES["%s-helper-v1.html" % _f] = {"PRINTER_SVG": 1, "btnPrintModal": 1}

ANCHOR = {"PRINTER_SVG": r"function PRINTER_SVG\b", "btnPrintModal": r'id="btnPrintModal"'}


def handwritten_printers(text):
    """`ICONS.printer` 와 같아야 하는 **손으로 적은** SVG 들을 **자리로** 집는다."""
    found = []
    for site, pat in ANCHOR.items():
        for m in re.finditer(pat, text):
            seg = text[m.start():m.start() + 1800]
            s = re.search(r"<svg\b.*?</svg>", seg, re.S)
            found.append((site, shape(s.group(0)) if s else "(SVG 없음)"))
    return found


# 화면에 그리면 안 되는 활자.
# ⛔ `→`·`←` 는 넣지 마라 — 안내 **문장 안**의 화살표다("오후 2시 30분 → 14시 30분").
# ⛔ 여권·허브에는 적용하지 않는다. 여권 화면 데이터의 이모지(`icon:"👤"`)는 **일부러**
#    남겨 둔 것이고(`EMOJI_ICON` 이 그리는 자리에서 선 아이콘으로 바꿔 끼운다),
#    여권 인쇄물의 `☑`·`✔` 는 **종이에 찍히는 표기**라 건드리면 안 된다.
SCREEN_EMOJI = "☑☐💡🖨✅✍👉"
COMMENT = re.compile(r"/\*.*?\*/|//[^\n]*", re.S)


def emoji_in_code(path):
    """주석을 걷어낸 뒤 남은 **그리는 코드**에서 활자 아이콘을 찾는다."""
    src = COMMENT.sub(lambda m: "\n" * m.group(0).count("\n"), read(path))
    hits = []
    for i, line in enumerate(src.split("\n"), 1):
        ch = [c for c in SCREEN_EMOJI if c in line]
        if ch:
            hits.append((i, "".join(ch), line.strip()[:70]))
    return hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-v", "--verbose", action="store_true")
    a = ap.parse_args()

    # 대조할 곳 — 원본(엔진·여권·허브)과 배포 7종
    srcs = [("engine/engine.js", "엔진 원본"),
            ("passport-helper-v1.html", "여권(손작성)"),
            ("index.html", "허브")]
    srcs += [("%s-helper-v1.html" % f, "배포 %s" % f) for f in FORMS]

    sets, texts = {}, {}
    for path, label in srcs:
        t = read(path)
        texts[path] = t
        d = icon_set(t)
        if path == "index.html":
            m = re.search(r"var ICON_FALLBACK\s*=\s*((?:'[^']*'\s*\+?\s*)+)", t)
            if m:
                d["document"] = shape(m.group(1))   # 허브의 기본 서류 = `document`
        sets[path] = d
        if not d:
            print("  ✘ %-26s 아이콘 표를 찾지 못했습니다" % path)
            return 1

    bad = 0

    # ① 같은 이름이면 같은 그림
    names = set()
    for d in sets.values():
        names |= set(d)
    print("UI 아이콘 세트 — 같은 이름이면 같은 그림 (이름 %d개 · 대조 %d파일)"
          % (len(names), len(sets)))
    for n in sorted(names):
        have = [(p, d[n]) for p, d in sets.items() if n in d]
        vals = set(v for _, v in have)
        if len(vals) > 1:
            bad += 1
            print("  ✘ %-11s **그림이 갈렸습니다** — %d 가지" % (n, len(vals)))
            for p, v in have:
                print("       %-26s %s" % (p, v[:96]))
        elif a.verbose:
            print("  ✓ %-11s %d 파일" % (n, len(have)))

    # ② 손으로 적은 프린터 — **자리마다** 있는지 + 그림이 같은지
    want = sets["engine/engine.js"].get("printer", "")
    n_hand = 0
    for path, want_sites in PRINTER_SITES.items():
        if path not in texts:
            texts[path] = read(path)
        got = handwritten_printers(texts[path])
        seen = {}
        for site, s in got:
            seen[site] = seen.get(site, 0) + 1
            n_hand += 1
            if s != want:
                bad += 1
                print("  ✘ %-26s %s 의 프린터가 `ICONS.printer` 와 다릅니다" % (path, site))
                print("       적힌 것 %s" % s[:96])
                print("       있어야 %s" % want[:96])
        for site, n in want_sites.items():
            if seen.get(site, 0) != n:
                bad += 1
                print("  ✘ %-26s %s 가 %d곳 있어야 하는데 %d곳입니다 — 아이콘이 사라졌습니까?"
                      % (path, site, n, seen.get(site, 0)))
    print("손으로 적은 프린터 SVG %d곳 — 자리·그림 모두 `ICONS.printer` 와 대조" % n_hand)

    # ③ 빌드 드리프트 (배포 7종 ↔ 엔진 원본)
    base = sets["engine/engine.js"]
    drift = [p for p, _ in srcs if p.endswith("-helper-v1.html")
             and p != "passport-helper-v1.html" and sets[p] != base]
    if drift:
        bad += 1
        for p in drift:
            print("  ✘ %-26s 엔진 원본과 다릅니다 — `node tools/build-form.js` 로 재빌드하세요" % p)
    print("빌드 드리프트 — 배포 7종이 엔진 원본과 같은지: %s" % ("✘" if drift else "✓"))

    # ④ 엔진이 활자 아이콘을 다시 그리지 않는지
    #    ⚠️ 2026.08.31 이전 엔진은 `why-box` 에 `💡`, 켜고 끄는 선택에 `☑`/`☐` 를
    #       **활자 그대로** 찍고 있었다. 그림을 대조하는 위 ①~③ 으로는 못 본다 —
    #       아이콘 표에 없는 글자라 대조 대상에조차 들어오지 않기 때문이다.
    hits = emoji_in_code("engine/engine.js")
    for ln, ch, txt in hits:
        bad += 1
        print("  ✘ engine/engine.js:%d  화면에 활자 아이콘 `%s` — 선 아이콘(`svgIcon`)을 쓰세요"
              % (ln, ch))
        print("       %s" % txt)
    print("엔진이 활자 아이콘을 그리지 않는지: %s" % ("✘" if hits else "✓"))

    if bad:
        print("\n✗ 어긋난 곳 %d — 위를 맞추세요." % bad)
        return 1
    print("\n✓ 전부 같습니다 — 한 벌입니다")
    return 0


if __name__ == "__main__":
    sys.exit(main())
