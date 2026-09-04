# -*- coding: utf-8 -*-
"""기관별 설정 블록(SITE-CONFIG)이 9개 화면에서 같은지 본다.

`engine/base-product.html` 의 `<!--SITE-CONFIG v1-->` … `<!--/SITE-CONFIG-->` 블록이 **원본**이고,
엔진 7종은 재빌드로, 손작성(여권)과 허브는 손으로 같은 내용을 받는다(AGENTS.md §1).
손작성 쪽을 빠뜨리면 그 서식만 기관 설정을 못 읽는 채로 배포된다 — 화면에 군포시 이름이
남거나 대표색이 안 걸리는 식이라 **조용히 어긋난다.** `sync-kiosk.sh --check` 는 루트↔키오스크
드리프트만 보므로 이 어긋남을 잡지 못한다.

    python tools/check-site-block.py           # 다르면 exit 1
    python tools/check-site-block.py --fix     # base-product.html 내용으로 손작성(여권)·허브를 맞춘다
                                               # (엔진 7종은 `node tools/build-form.js` 로 재빌드)
"""
import io
import os
import re
import sys

# 콘솔이 cp949 면 한글·— 이 깨진다(다른 tools/*.py 와 같은 처리)
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'engine', 'base-product.html')

# 손으로 맞춰야 하는 것들 — 엔진 7종은 재빌드로 자동 반영된다.
# ⚠️ 혼인(2026.08.29)·이혼(2026.08.29)이 손작성에서 엔진으로 옮겨졌다. 목록을 옮기지 않으면
#    `--fix` 가 **재빌드에 덮일 파일**을 고쳐 놓고 고쳤다고 말한다.
HAND = ['passport-helper-v1.html', 'index.html']
BUILT = ['birth-helper-v1.html', 'marriage-helper-v1.html', 'divorce-helper-v1.html',
         'death-helper-v1.html', 'naming-helper-v1.html',
         'cert-helper-v1.html', 'realestate-helper-v1.html']

PAT = re.compile(r'<!--SITE-CONFIG v1-->.*?<!--/SITE-CONFIG-->', re.S)


def block_of(path):
    s = io.open(path, encoding='utf-8').read()
    m = PAT.search(s)
    return (m.group(0) if m else None), s


def main():
    fix = '--fix' in sys.argv
    want, _ = block_of(SRC)
    if not want:
        print('X engine/base-product.html 에 SITE-CONFIG 블록이 없습니다')
        return 1

    bad = 0
    for name in HAND + BUILT:
        p = os.path.join(ROOT, name)
        if not os.path.exists(p):
            print('X %-28s 파일 없음' % name)
            bad += 1
            continue
        got, s = block_of(p)
        if got == want:
            print('  %-28s 같음' % name)
            continue
        bad += 1
        if got is None:
            print('X %-28s 블록 없음' % name)
        else:
            print('X %-28s 내용이 다름' % name)
        if fix and name in HAND:
            s = PAT.sub(lambda _: want, s) if got is not None \
                else s.replace('</head>', want + '</head>', 1)
            io.open(p, 'w', encoding='utf-8', newline='').write(s)
            print('  %-28s → base-product.html 내용으로 맞췄습니다' % name)
            bad -= 1
        elif fix:
            print('  %-28s → `node tools/build-form.js` 로 재빌드하세요' % name)

    if bad:
        print('\n%d 곳이 어긋납니다. `--fix` 로 손작성(여권)·허브를 맞추고, 엔진 7종은 재빌드하세요.' % bad)
        return 1
    print('\n전부 같습니다 — 9개 화면')
    return 0


if __name__ == '__main__':
    sys.exit(main())
