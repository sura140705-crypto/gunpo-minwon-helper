#!/usr/bin/env bash
# 키오스크 배포 압축본 생성 도구
#
# 키오스크배포/ 폴더를 그대로 키오스크배포.zip 으로 압축한다.
# 담당자에게 전달하거나 키오스크 PC에 옮길 때 쓰는 배포 산출물이며,
# 폴더에서 언제든 다시 만들 수 있어 리포에는 커밋하지 않는다(.gitignore).
#
# 사용법:
#   bash tools/sync-kiosk.sh          # 먼저 3곳 동기화(루트 원본 → 배포 폴더)
#   bash tools/pack-kiosk.sh          # 키오스크배포/ → 키오스크배포.zip
#
# 주의: 서식을 고친 뒤 sync 없이 pack 하면 구버전이 압축된다. 아래에서 자동 검증한다.

set -euo pipefail

cd "$(dirname "$0")/.."

SRC="키오스크배포"
OUT="키오스크배포.zip"

# 루트 원본과 배포 폴더가 어긋난 채로 압축되는 사고 방지
bash tools/sync-kiosk.sh --check

python - "$SRC" "$OUT" <<'PY'
import os, sys, zipfile

src, out = sys.argv[1], sys.argv[2]
files = sorted(os.listdir(src))
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(os.path.join(src, f), src + "/" + f)

# 압축본이 폴더와 일치하는지 재확인
with zipfile.ZipFile(out) as z:
    names = [i.filename for i in z.infolist()]
    assert len(names) == len(files), "압축 파일 수 불일치"
    for i in z.infolist():
        disk = os.path.join(src, os.path.basename(i.filename))
        assert i.file_size == os.path.getsize(disk), "크기 불일치: " + i.filename

print("OK %d %d" % (len(files), os.path.getsize(out)))
PY

echo "✓ 압축 완료 — $OUT ($(du -h "$OUT" | cut -f1))"
