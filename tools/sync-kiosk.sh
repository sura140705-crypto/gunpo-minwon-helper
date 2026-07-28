#!/usr/bin/env bash
# 배포 HTML 3곳 동기화 도구
#
# 루트(원본) → 키오스크배포/ , kiosk-app/app/ 로 배포 파일(서식 helper + index.html)을 복사한다.
# 서식을 수정하면 루트 파일만 고치고 이 스크립트를 돌리면 두 배포 위치가 맞춰진다.
#
# 사용법:
#   bash tools/sync-kiosk.sh          # 루트 → 두 배포 위치로 복사(동기화)
#   bash tools/sync-kiosk.sh --check  # 복사하지 않고 3곳이 동일한지 검증만(다르면 exit 1)
#
# --check 는 커밋 전 드리프트 확인용. CI/pre-commit 훅에 넣어도 된다.

set -euo pipefail

# 리포 루트로 이동(스크립트 위치 기준)
cd "$(dirname "$0")/.."

# 배포 대상 8개 파일(루트가 원본)
FILES=(
  birth-helper-v1.html
  cert-helper-v1.html
  death-helper-v1.html
  divorce-helper-v1.html
  marriage-helper-v1.html
  naming-helper-v1.html
  passport-helper-v1.html
  realestate-helper-v1.html
  index.html
)

# 동기화 대상 배포 디렉터리
DESTS=(
  "키오스크배포"
  "kiosk-app/app"
)

CHECK=0
[ "${1:-}" = "--check" ] && CHECK=1

drift=0
copied=0

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "✗ 원본 없음: $f" >&2
    drift=1
    continue
  fi
  for d in "${DESTS[@]}"; do
    dest="$d/$f"
    if cmp -s "$f" "$dest" 2>/dev/null; then
      continue  # 이미 동일
    fi
    if [ "$CHECK" -eq 1 ]; then
      if [ -f "$dest" ]; then
        echo "★ 다름: $dest (루트와 불일치)"
      else
        echo "★ 없음: $dest"
      fi
      drift=1
    else
      mkdir -p "$d"
      cp "$f" "$dest"
      echo "→ 복사: $f → $dest"
      copied=$((copied + 1))
    fi
  done
done

if [ "$CHECK" -eq 1 ]; then
  if [ "$drift" -eq 0 ]; then
    echo "✓ 3곳 모두 동기화됨 (${#FILES[@]}개 파일)"
    exit 0
  else
    echo "" >&2
    echo "✗ 드리프트 발견 — 'bash tools/sync-kiosk.sh' 로 맞추세요." >&2
    exit 1
  fi
else
  if [ "$copied" -eq 0 ]; then
    echo "✓ 이미 동기화됨 — 복사할 파일 없음"
  else
    echo "✓ 동기화 완료 — ${copied}개 파일 복사"
  fi
fi
