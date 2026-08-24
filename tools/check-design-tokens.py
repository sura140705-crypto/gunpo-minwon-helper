# -*- coding: utf-8 -*-
"""디자인 토큰 블록(DESIGN-TOKENS)이 9개 화면에서 같은지 본다.

`engine/base.html` 의 `<!--DESIGN-TOKENS v1-->` … `<!--/DESIGN-TOKENS-->` 블록이 **원본**이고,
엔진 5종은 재빌드로, 손작성 3종과 허브는 이 도구가 넣어 준다.

`check-site-block.py` 와 같은 방식이다. 그쪽이 **기관별 설정**(색을 주입하는 스크립트)을
지키고, 이쪽이 **디자인 값**(색·반경·간격·글자 크기)을 지킨다. 둘 다 「9개 화면에 글자까지
똑같이」가 조건이라 어긋나면 그 서식만 다르게 생긴 채로 배포된다 — 조용히 어긋난다.

    python tools/check-design-tokens.py           # 다르면 exit 1
    python tools/check-design-tokens.py --fix     # base.html 내용으로 손작성 3종·허브를 맞춘다
                                                  # (엔진 5종은 `node tools/build-form.js` 로 재빌드)

블록이 아직 없는 파일에는 **첫 `<style>` 바로 앞에** 새로 심는다. 그 자리여야
파일이 원래 갖고 있던 `:root` 가 뒤에 와서 이긴다 — 토큰을 새로 넣는 것만으로는
화면이 바뀌지 않는다는 뜻이고, 그게 이 단계의 합격 조건이었다.
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
SRC = os.path.join(ROOT, 'engine', 'base.html')

# 손으로 맞춰야 하는 것들 — 엔진 5종은 재빌드로 자동 반영된다
HAND = ['passport-helper-v1.html', 'marriage-helper-v1.html',
        'divorce-helper-v1.html', 'index.html']
BUILT = ['birth-helper-v1.html', 'death-helper-v1.html', 'naming-helper-v1.html',
         'cert-helper-v1.html', 'realestate-helper-v1.html']

PAT = re.compile(r'<!--DESIGN-TOKENS v1-->.*?<!--/DESIGN-TOKENS-->', re.S)


def block_of(path):
    s = io.open(path, encoding='utf-8').read()
    m = PAT.search(s)
    return (m.group(0) if m else None), s


def put(path, s, want):
    """블록을 갈아 끼우거나, 없으면 첫 `<style>` 앞에 새로 심는다."""
    if PAT.search(s):
        out = PAT.sub(lambda _m: want, s, count=1)
    else:
        i = s.find('<style>')
        if i < 0:
            return False
        out = s[:i] + want + '\n' + s[i:]
    io.open(path, 'w', encoding='utf-8', newline='').write(out)
    return True


def main():
    fix = '--fix' in sys.argv
    want, _ = block_of(SRC)
    if not want:
        print('X engine/base.html 에 DESIGN-TOKENS 블록이 없습니다')
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
        why = '블록 없음' if got is None else '내용 다름'
        if fix and name in HAND:
            if put(p, s, want):
                print('  %-28s %s → 맞췄습니다' % (name, why))
            else:
                print('X %-28s %s → <style> 를 못 찾아 넣지 못했습니다' % (name, why))
                bad += 1
            continue
        print('X %-28s %s' % (name, why))
        bad += 1

    if bad:
        print('\n%d개가 다릅니다.' % bad)
        if not fix:
            print('  손작성 3종·허브 : python tools/check-design-tokens.py --fix')
        print('  엔진 5종        : node tools/build-form.js <이름>  (birth·death·naming·cert·realestate)')
        return 1
    print('\n전부 같습니다 — 9개 화면')
    return 0


if __name__ == '__main__':
    sys.exit(main())
