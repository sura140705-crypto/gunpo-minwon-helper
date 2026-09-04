#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
embed-logo.py — 군포시 로고를 허브·서식 도우미에 박아 넣는다.

  사용: python tools/embed-logo.py            # assets/ 의 로고를 모든 페이지에 삽입
        python tools/embed-logo.py --remove   # 삽입한 로고를 전부 제거(원상복구)

로고 원본 : assets/gunpo-logo.png  (군포시 CI 'BS01 브랜드마크', 투명 배경)
  - .svg → .png → .jpg 순으로 찾는다. 원본 색(민트) 그대로 두면 된다.

삽입 위치
  1) index.html (허브)  — 상단바 제목 '군포시 민원 서식 작성 도우미' 왼쪽. 원본 색(민트) 그대로.
  2) 서식 도우미 8종    — 두 군데에 넣는다.
       ㄱ. 상단바 제목 왼쪽 — 허브와 **같은 자리·같은 크기·원본 색**.
           세부 페이지에 들어가도 로고가 그대로 보이게 해 달라는 요청(2026.08.08).
       ㄴ. 입력 패널 파란 머리(.phone-head) 우측 상단에 흰색(반전)으로.
     engine/base-product.html 을 고친 뒤 엔진 서식은 다시 빌드해야 반영된다(아래 안내 출력).

⚠️ 흰색 버전을 CSS `filter:invert()` 로 만들면 안 된다. 이 로고는 민트 띠 위에
   흰 글자('YOU')가 얹힌 구조라, 전체를 희게 칠하면 'YOU'가 같이 희어져 사라진다.
   그래서 **민트→흰색 / 흰색→투명**으로 다시 칠한 반전본을 만들어 쓴다
   (투명해진 'YOU' 자리로 파란 배경이 비쳐 글자가 그대로 읽힌다).
   경계의 안티에일리어싱은 빨강 채널값에 비례해 부드럽게 처리된다.

앱은 오프라인 자체완결이 원칙이므로 로고는 외부 파일이 아니라 base64 data URI로 인라인한다.
삽입 구간을 <!--GUNPO-LOGO--> … <!--/GUNPO-LOGO--> 로 감싸므로 몇 번을 돌려도 안전하다.
"""
import base64, io, os, re, sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BEG, END = "<!--GUNPO-LOGO-->", "<!--/GUNPO-LOGO-->"

# 손작성(여권)은 껍데기를 쓰지 않으므로 여기서 직접 고쳐야 한다.
# 엔진 7종은 껍데기만 고치고 재빌드한다 — 여기에 넣으면 재빌드에 덮여 헛일이 된다.
# (birth 2026.08.08 · marriage·divorce 2026.08.29 에 손작성에서 엔진으로 옮겨졌다.)
# 껍데기는 `base-product.html` **하나**다(옛 `base.html` 은 2026.09.04 에 지웠다).
HAND_WRITTEN = ["passport-helper-v1.html"]
ENGINE_FORMS = ["birth", "marriage", "divorce", "death", "naming", "cert", "realestate"]

MIME = {".svg": "image/svg+xml", ".png": "image/png",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg"}


def find_logo():
    d = os.path.join(ROOT, "assets")
    # assets/logo.* 가 기본. 예전 이름(gunpo-logo.*)도 계속 받는다.
    for stem in ("logo", "gunpo-logo"):
        for ext in (".svg", ".png", ".jpg", ".jpeg"):
            p = os.path.join(d, stem + ext)
            if os.path.exists(p):
                return p
    return None


def data_uri(path):
    raw = io.open(path, "rb").read()
    return "data:%s;base64,%s" % (MIME[os.path.splitext(path)[1].lower()],
                                  base64.b64encode(raw).decode("ascii"))


def white_data_uri(path):
    """민트→흰색, 흰색→투명으로 다시 칠한 반전본(파란 배경용) data URI."""
    if path.lower().endswith(".svg"):
        sys.exit("SVG 반전본 자동 생성은 지원하지 않습니다. PNG 원본을 쓰거나 "
                 "흰색 버전을 직접 넣어 주세요.")
    try:
        from PIL import Image, ImageChops
    except ImportError:
        sys.exit("반전본 생성에 Pillow가 필요합니다:  pip install pillow")
    im = Image.open(path).convert("RGBA")
    r, _, _, a = im.split()
    # 민트는 R=0, 흰색은 R=255 → R을 뒤집어 알파에 곱하면
    # 민트=불투명 / 흰색=투명 / 원래 투명한 곳=그대로 투명
    out = Image.new("RGBA", im.size, (255, 255, 255, 0))
    out.putalpha(ImageChops.multiply(a, ImageChops.invert(r)))
    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def strip(s):
    """이전에 삽입한 구간 제거.

    삽입 시 앞에 붙인 들여쓰기와 뒤의 개행까지 함께 지워야 원래 문서로 정확히
    돌아간다(빈 줄이 남으면 다음 실행에서 삽입 지점을 못 찾는다)."""
    return re.sub(r"[ \t]*" + re.escape(BEG) + r".*?" + re.escape(END) + r"\n?",
                  "", s, flags=re.S)


def wrap(inner):
    return BEG + inner + END


# ── 상단바(허브·서식 공통): 제목 왼쪽, 원본 색 ────────────────────────
# 허브와 서식이 **같은 규칙**을 쓴다 — 세부 페이지에 들어가도 로고 위치·크기가
# 달라지지 않아야 한다는 요청(2026.08.08). 값을 바꿀 때는 양쪽이 함께 바뀐다.
TOPBAR_CSS = """
<style>
  .topbar .gunpo-logo{height:38px;width:auto;flex:0 0 auto;display:block;}
  @media (max-width:640px){ .topbar .gunpo-logo{height:30px;} }
  @media print{ .topbar .gunpo-logo{display:none;} }
</style>
"""

TOPBAR_ANCHOR = '<header class="topbar">\n  <div class="brand">'


def patch_topbar(src, uri, label):
    """상단바 제목 왼쪽에 원본 색 로고를 넣는다(허브·서식 공통)."""
    if TOPBAR_ANCHOR not in src:
        sys.exit("%s: 상단바 구조를 찾지 못했습니다." % label)
    img = '<img class="gunpo-logo" src="%s" alt="군포시">' % uri
    return src.replace(TOPBAR_ANCHOR,
                       '<header class="topbar">\n  ' + wrap(img) + '\n  <div class="brand">', 1)


def patch_hub(src, uri):
    src = strip(src)
    src = src.replace("</head>", wrap(TOPBAR_CSS) + "</head>", 1)
    return patch_topbar(src, uri, "index.html")


# ── 서식 도우미: 파란 머리 우측 상단, 흰색(반전본) ────────────────────
FORM_CSS = """
<style>
  .phone-head{position:relative;}
  .phone-head .gunpo-logo{position:absolute;right:18px;top:15px;height:28px;width:auto;
    pointer-events:none;}
  /* 로고 자리를 비우면 제목 폭이 좁아진다. 긴 제목이 두 줄로 넘어가 패널이
     내려앉지 않도록 한 줄 고정 + 넘칠 때만 글자를 줄인다(아래 스크립트). */
  .phone-head .wiz-title{padding-right:56px;white-space:nowrap;}
  .phone-head .wiz-count{padding-right:56px;}
  @media (max-width:860px){
    .phone-head .gunpo-logo{height:24px;right:14px;top:14px;}
    .phone-head .wiz-title,.phone-head .wiz-count{padding-right:48px;}
  }
  @media print{ .phone-head .gunpo-logo{display:none;} }
</style>
"""

# 제목이 로고 자리를 침범해 넘치면 글자 크기를 조금씩 줄여 한 줄에 맞춘다.
# 각 서식의 renderStep을 건드리지 않도록 #wizTitle 변화를 관찰해 자동 실행한다.
FORM_JS = """
<script>
(function(){
  var MIN=14;                                  // 이보다 작게는 줄이지 않는다
  // 글자 실제 폭은 Range로 잰다. scrollWidth/clientWidth 비교는 쓸 수 없다 —
  // 로고 자리로 준 padding-right가 clientWidth에 포함되어, 제목이 로고 아래로
  // 파고들어도 '넘치지 않음'으로 나온다.
  function textWidth(t, rng){ rng.selectNodeContents(t); return rng.getBoundingClientRect().width; }
  function fit(){
    var t=document.getElementById("wizTitle"); if(!t || !t.firstChild) return;
    t.style.fontSize="";                       // 원래(CSS) 크기에서 다시 계산
    var cs=getComputedStyle(t);
    var avail=t.clientWidth - parseFloat(cs.paddingLeft||0) - parseFloat(cs.paddingRight||0);
    if(!(avail>0)) return;
    var rng=document.createRange(), s=parseFloat(cs.fontSize)||20, guard=0;
    while(textWidth(t,rng)>avail && s>MIN && guard++<40){
      s-=0.5; t.style.fontSize=s+"px";
    }
    rng.detach && rng.detach();
  }
  function start(){
    var t=document.getElementById("wizTitle"); if(!t) return;
    fit();
    // 글자 크기는 style 속성이라 관찰 대상(childList·characterData)이 아니다 → 무한루프 없음
    new MutationObserver(fit).observe(t,{childList:true,characterData:true,subtree:true});
    window.addEventListener("resize", fit);
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",start);
  else start();
})();
</script>
"""

FORM_ANCHOR = ('      <div class="phone-head">\n'
               '        <div class="wiz-title" id="wizTitle"></div>')


def patch_form(src, uri, white, label):
    """서식 도우미: 상단바(원본 색) + 입력 패널 파란 머리(흰색 반전본) 두 군데."""
    src = strip(src)
    src = src.replace("</head>", wrap(TOPBAR_CSS) + wrap(FORM_CSS) + "</head>", 1)
    src = patch_topbar(src, uri, label)
    img = '<img class="gunpo-logo" src="%s" alt="군포시">' % white
    if FORM_ANCHOR not in src:
        sys.exit("%s: 입력 패널(.phone-head) 구조를 찾지 못했습니다." % label)
    src = src.replace(FORM_ANCHOR,
                      '      <div class="phone-head">\n        ' + wrap(img) + '\n'
                      '        <div class="wiz-title" id="wizTitle"></div>', 1)
    # 제목 한 줄 맞춤 스크립트는 앱 스크립트가 다 실행된 뒤(</body> 앞)에 둔다
    return src.replace("</body>", wrap(FORM_JS) + "</body>", 1)


def main():
    remove = "--remove" in sys.argv
    uri = white = ""
    if not remove:
        logo = find_logo()
        if not logo:
            sys.exit("로고 파일이 없습니다. assets/gunpo-logo.png (또는 .svg)로 넣어 주세요.\n"
                     "  - 배경이 투명한 원본, 색은 민트 그대로\n"
                     "  - 파란 배경용 흰색 반전본은 자동으로 만듭니다.")
        uri, white = data_uri(logo), white_data_uri(logo)
        print("로고: %s (%.1f KB) → 원본 %.1f KB · 흰색 반전본 %.1f KB (data URI)"
              % (os.path.relpath(logo, ROOT), os.path.getsize(logo) / 1024,
                 len(uri) / 1024, len(white) / 1024))

    targets = ["index.html",
               os.path.join("engine", "base-product.html")] + HAND_WRITTEN
    for rel in targets:
        p = os.path.join(ROOT, rel)
        s = io.open(p, encoding="utf-8").read()
        if remove:
            out = strip(s)
        elif rel == "index.html":
            out = patch_hub(s, uri)
        else:
            out = patch_form(s, uri, white, rel)
        io.open(p, "w", encoding="utf-8", newline="").write(out)
        print(("  제거: " if remove else "  삽입: ") + rel)

    print("\n다음 단계 — 엔진 서식 재빌드 후 배포 동기화:")
    print("  " + " && ".join("node tools/build-form.js " + f for f in ENGINE_FORMS))
    print("  bash tools/sync-kiosk.sh")


if __name__ == "__main__":
    main()
