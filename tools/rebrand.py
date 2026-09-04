#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
rebrand.py — 다른 지방자치단체용으로 지역 고유값을 일괄 교체.

서식 좌표맵·엔진·코치 흐름은 전국 공통이라 그대로 쓰고, 기관명·부서·연락처·서비스
이름만 바꾼다.

  python tools/rebrand.py --city 안양시 --dry-run          # 무엇이 바뀌는지 미리보기
  python tools/rebrand.py --city 안양시 --province 경기도 \
         --dept 민원지원과 --tel 031-000-0000 --slug anyang \
         --logo ~/anyang-ci.png

바꾸는 것
  · 기관 표기      경기도 군포시 → <시·도> <시·군·구>
  · 창구 이름      군포시청 민원실 / 민원여권과 → <시>청 …
  · 담당 부서·연락처(운영문서 머리글·문의줄)
  · 서비스 이름    「군포시 민원 서식 작성 도우미」, Electron 앱 이름·패키지명
  · 작성예시 주소  경기도 군포시 산본로 … → 시 이름만 교체(도로명은 손으로 고쳐야 한다·경고함)
  · 로고           --logo 로 준 이미지를 assets/logo.png 로 복사

바꾸지 않는 것(기능 이름이라 그대로 둔다)
  `<!--GUNPO-LOGO-->` 마커, CSS 클래스 `.gunpo-logo`, base64 이미지 데이터.

⚠️ 실행 뒤에 반드시 할 일은 마지막에 체크리스트로 출력한다(재빌드·동기화·기준선 갱신).
"""
import io, os, re, shutil, sys

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 손댈 파일(생성물 사본·서식 원본·기준선·아카이브는 제외)
TARGETS = [
    "index.html", "AGENTS.md", "README.md",
    "birth-helper-v1.html", "cert-helper-v1.html", "death-helper-v1.html",
    "divorce-helper-v1.html", "marriage-helper-v1.html", "naming-helper-v1.html",
    "passport-helper-v1.html", "realestate-helper-v1.html",
    # ⚠️ 껍데기는 `base-product.html` **하나**다(옛 `base.html` 은 2026.09.04 에 지웠다).
    #    여기를 빠뜨리면 엔진 7종이 재빌드로 **군포 이름을 도로 물고 온다.**
    "engine/base-product.html", "engine/engine.js", "engine/README.md",
    # ⚠️ config 는 **7종 전부**다. 혼인·이혼이 빠져 있어 2026.09.04 에 보탰다 —
    #    둘 다 config 안에 기관명이 들어 있어 빠뜨리면 그 두 서식만 안 바뀐다.
    "forms/birth.config.js", "forms/cert.config.js", "forms/death.config.js",
    "forms/divorce.config.js", "forms/marriage.config.js",
    "forms/naming.config.js", "forms/realestate.config.js",
    "kiosk-app/main.js", "kiosk-app/preload.js", "kiosk-app/package.json",
    "운영문서/붙임1_시행계획서.md", "운영문서/붙임2_사용매뉴얼.md",
    "운영문서/붙임2-1_사용매뉴얼(상세).md", "운영문서/붙임3_키오스크_설치운영_안내.md",
    "tools/embed-logo.py", "tools/make-icon.py", "tools/make-manual.py",
]

# 치환 대상에서 지켜야 하는 토큰(기능 이름)
KEEP = ["<!--GUNPO-LOGO-->", "<!--/GUNPO-LOGO-->", "gunpo-logo",
        "gunpo-minwon-helper", "gunpo-passport-helper"]  # 리포 이름(URL)은 그대로 둔다

OLD_PROVINCE, OLD_CITY = "경기도", "군포시"
OLD_TEL = "031-390-0131"
# 도로명·법정동까지 군포 것인 작성예시 주소 — 시 이름만 바꿔선 실재하지 않는 주소가 된다
LOCAL_PLACES = ["산본로", "산본동", "금정동", "번영로", "당동", "당정동"]


def arg(name, default=None):
    a = sys.argv
    return a[a.index(name) + 1] if name in a and a.index(name) + 1 < len(a) else default


def main():
    city = arg("--city")
    if not city:
        sys.exit(__doc__.strip() + "\n\n오류: --city 는 필수입니다. 예) --city 안양시")
    province = arg("--province", OLD_PROVINCE)
    dept = arg("--dept")            # 담당 부서(예: 민원지원과)
    tel = arg("--tel")
    slug = arg("--slug")            # kiosk-app 패키지명(영문 소문자)
    logo = arg("--logo")
    dry = "--dry-run" in sys.argv
    bare = city[:-1] if city.endswith(("시", "군", "구")) else city

    # 긴 문구부터 (짧은 규칙이 먼저 먹으면 뒤 규칙이 매칭되지 않는다)
    rules = [
        ("군포시청 민원여권과", "%s청 민원여권과" % city),
        ("군포시청 민원봉사과", "%s청 %s" % (city, dept or "민원봉사과")),
        ("군포시청 민원실", "%s청 민원실" % city),
        ("군포시청", "%s청" % city),
        ("경기도 군포시", "%s %s" % (province, city)),
        ("군포민원서식도우미", "%s민원서식도우미" % bare),
        ("군포시 민원", "%s 민원" % city),
        ("군포시", city),
    ]
    if dept:
        rules.insert(0, ("민원봉사과", dept))
    if tel:
        rules.append((OLD_TEL, tel))

    total, touched, places = 0, [], {}
    for rel in TARGETS:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            print("  · 없음(건너뜀) %s" % rel)
            continue
        s = orig = io.open(path, encoding="utf-8").read()

        # 기능 토큰 보호 → 치환 → 복원
        for i, k in enumerate(KEEP):
            s = s.replace(k, "\x00%d\x00" % i)
        n = 0
        for old, new in rules:
            c = s.count(old)
            if c:
                s = s.replace(old, new)
                n += c
        for i, k in enumerate(KEEP):
            s = s.replace("\x00%d\x00" % i, k)

        if rel == "kiosk-app/package.json" and slug:
            c = s.count("gunpo-minwon-kiosk")
            s = s.replace("gunpo-minwon-kiosk", "%s-minwon-kiosk" % slug)
            n += c

        hit = [p for p in LOCAL_PLACES if p in s]
        if hit:
            places[rel] = hit

        if n and s != orig:
            total += n
            touched.append((rel, n))
            if not dry:
                io.open(path, "w", encoding="utf-8", newline="").write(s)

    for rel, n in touched:
        print("  %-44s %3d곳" % (rel, n))
    print("\n%s %d곳 / %d파일" % ("바뀔 예정:" if dry else "교체 완료:", total, len(touched)))

    if logo and not dry:
        dst = os.path.join(ROOT, "assets", "logo.png")
        shutil.copyfile(os.path.expanduser(logo), dst)
        print("로고 교체: %s → assets/logo.png" % logo)

    if places:
        print("\n⚠️ 작성예시 주소에 군포 지역의 도로명·법정동이 남아 있습니다(시 이름만 바뀌어")
        print("   실재하지 않는 주소가 됩니다). 그 지역 주소로 손수 고치십시오:")
        for rel, hit in places.items():
            print("   · %-42s %s" % (rel, ", ".join(hit)))

    print("""
다음 순서로 마무리하십시오
  1) python tools/embed-logo.py              # 새 로고를 화면에 다시 박는다(로고를 바꿨을 때)
  2) python tools/make-icon.py               # Electron 앱 아이콘 (kiosk-app 을 쓸 때)
  3) node tools/build-form.js birth ; death ; naming ; cert ; realestate
                                             # 엔진 5종 재빌드 (config 가 바뀌었으므로)
  4) bash tools/sync-kiosk.sh                # 배포 3곳 동기화
  5) python tools/verify-print.py            # 인쇄물 비교 → 작성예시 주소가 바뀌었으니 차이가 난다
     python tools/verify-print.py --update   #   내용을 확인한 뒤 기준선을 그 기관 기준으로 갱신
  6) 운영문서/*.md 의 부서·담당자·연락처를 확인하고 필요하면 PDF 재생성
     python tools/make-manual.py""")


if __name__ == "__main__":
    main()
