# -*- coding: utf-8 -*-
"""디자인 자료를 밖에 넘길 묶음으로 만든다 — `docs/디자인검토/` → `_디자인검토/`.

디자인은 한 번에 끝나지 않는다. 현황을 밖에 넘기고 → 철학·시안을 받고 → 반영하고 →
다시 현황을 넘긴다. 그때마다 손으로 복사하면 **낡은 갈무리가 섞여 나간다**(2026.08.24 에
실제로 그럴 뻔했다 — 08.19 자 여권 갈무리가 08.21 개편 뒤에도 묶음에 남아 있었다).

    python tools/design-shots.py      # ① 갈무리·CSS 를 원본에서 다시 뽑고
    python tools/design-bundle.py     # ② 그것을 묶는다

만들어지는 것 :

    _디자인검토/디자인검토/          업로드용 폴더 (드래그해서 그대로 올린다)
    _디자인검토/디자인검토.zip       메일·메신저로 보낼 때

⚠️ `_` 로 시작하므로 `.gitignore` 대상이다 — 묶음 자체는 리포에 들어가지 않는다.
   원본은 언제나 `docs/디자인검토/` 이고, 묶음은 그것의 사본일 뿐이다.
⚠️ 개인정보 점검을 한 번 더 한다. 작성예시는 전부 가상 인물이어야 한다(리포 규칙).
   갈무리에 실명이 섞이면 여기서 걸러야 한다 — 밖으로 나가는 마지막 문이다.
"""
import io
import os
import re
import shutil
import sys
import zipfile

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "docs", "디자인검토")
OUT = os.path.join(ROOT, "_디자인검토")
NAME = "디자인검토"

# 묶음에 넣지 않는 것 (편집 중 임시파일·OS 부산물)
SKIP = re.compile(r"^(_|\.|~\$)|\.(tmp|bak|orig)$|^Thumbs\.db$|^desktop\.ini$")

# 밖으로 나가면 안 되는 낌새 — 걸리면 멈추고 사람에게 묻는다.
# ⚠️ 「가상 인물」로 정해 둔 이름은 통과시킨다(작성예시가 그것으로 되어 있다).
FICTIONAL = {"홍길동", "홍판서", "김민준", "김철수", "이영희"}
RISKY = [
    (re.compile(r"\b\d{6}\s*-\s*[1-4]\d{6}\b"), "주민등록번호 형태"),
    (re.compile(r"[A-Za-z0-9._%+-]+@(?!example\.)[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "이메일 주소"),
]


def scan_text(path, rel, warns):
    """텍스트 파일 안에 개인정보 낌새가 있는지 본다(갈무리 PNG 는 눈으로 봐야 한다)."""
    try:
        s = io.open(path, encoding="utf-8").read()
    except (OSError, UnicodeDecodeError):
        return
    for pat, what in RISKY:
        for m in pat.findall(s):
            warns.append("%s : %s — %s" % (rel, what, m))


def copy_tree(src, dst, warns):
    n = 0
    for name in sorted(os.listdir(src)):
        if SKIP.search(name):
            continue
        s, d = os.path.join(src, name), os.path.join(dst, name)
        if os.path.isdir(s):
            os.makedirs(d, exist_ok=True)
            n += copy_tree(s, d, warns)
        else:
            shutil.copy2(s, d)
            rel = os.path.relpath(d, os.path.dirname(dst)).replace("\\", "/")
            if name.lower().endswith((".md", ".css", ".txt")):
                scan_text(s, rel, warns)
            n += 1
    return n


def main():
    if not os.path.isdir(SRC):
        sys.exit("원본이 없습니다 : %s" % SRC)

    dest = os.path.join(OUT, NAME)
    if os.path.exists(dest):
        shutil.rmtree(dest)          # 낡은 파일이 섞이지 않게 통째로 비우고 다시 만든다
    os.makedirs(dest)

    warns = []
    n = copy_tree(SRC, dest, warns)

    zpath = os.path.join(OUT, NAME + ".zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for base, _dirs, files in os.walk(dest):
            for f in sorted(files):
                p = os.path.join(base, f)
                z.write(p, os.path.join(NAME, os.path.relpath(p, dest)))

    print("묶음 → %s" % os.path.relpath(dest, ROOT))
    for base, _dirs, files in os.walk(dest):
        rel = os.path.relpath(base, dest).replace("\\", "/")
        head = "  ." if rel == "." else "  " + rel + "/"
        print("%-22s %d개" % (head, len(files)))
    print("\n  zip  %s  (%.1f MB)"
          % (os.path.relpath(zpath, ROOT), os.path.getsize(zpath) / 1048576.0))
    print("  파일 %d개" % n)

    if warns:
        print("\n⚠️ 밖으로 나가기 전에 확인하세요 —")
        for w in warns:
            print("   " + w)
        print("   가상 인물·가상 번호가 맞으면 그대로 보내도 됩니다.")
        return 1
    print("\n✓ 텍스트 파일에서 개인정보 낌새를 찾지 못했습니다.")
    print("  ⚠️ 갈무리 PNG 안의 이름·번호는 자동으로 못 봅니다 — 가상 인물인지 눈으로 확인하세요")
    print("     (지금 쓰는 가상 인물 : %s)" % " · ".join(sorted(FICTIONAL)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
