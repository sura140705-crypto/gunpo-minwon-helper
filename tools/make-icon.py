# -*- coding: utf-8 -*-
"""군포시 로고(assets/gunpo-logo.png) → 키오스크 앱 아이콘(kiosk-app/build/icon.ico)

electron-builder 는 `build/icon.ico` 를 자동으로 집어 설치본·실행파일·바로가기에 쓴다.
아이콘은 재생성 가능한 산출물이므로 이 스크립트를 원본으로 두고, 로고가 바뀌면 다시 돌린다.

    python tools/make-icon.py

로고 구조(assets/gunpo-logo.png, 631×481): 민트(#00AEBA) 프레임 + 민트 'GUNPO' /
우측 띠에 흰색 'YOU' / **안쪽 사각형은 투명**.
안쪽을 투명한 채로 두면 바탕화면 사진이 그대로 비쳐 민트 글자가 안 읽히므로
**흰색으로 메워 불투명 타일로 만든다**(로고 색은 그대로). 4:3 마크를 정사각 캔버스에
넣어야 하므로 위아래는 투명 여백으로 남긴다 — 민트로 메우면 프레임이 위아래만
두꺼워져 어색하다.
"""
import io
import struct
import sys
from pathlib import Path
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "gunpo-logo.png"
OUT = ROOT / "kiosk-app" / "build" / "icon.ico"

# ICO 에 담을 크기. 작은 크기는 여백 없이 꽉 채워 글자를 최대한 살린다.
SIZES = [16, 24, 32, 48, 64, 128, 256]
PAD_RATIO = {16: 0.0, 24: 0.0, 32: 0.0}  # 그 밖은 아래 DEFAULT_PAD
DEFAULT_PAD = 0.02


def opaque_tile():
    """투명한 안쪽을 흰색으로 메운 로고 타일(RGBA, 불투명)."""
    logo = Image.open(SRC).convert("RGBA")
    tile = Image.new("RGBA", logo.size, (255, 255, 255, 255))
    tile.alpha_composite(logo)
    return tile


def frame(size, tile):
    """정사각 투명 캔버스 가운데에 타일을 넣는다."""
    pad = PAD_RATIO.get(size, DEFAULT_PAD)
    w = max(1, round(size * (1 - 2 * pad)))
    h = max(1, round(w * tile.height / tile.width))
    small = tile.resize((w, h), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(small, ((size - w) // 2, (size - h) // 2))
    return canvas


def write_ico(path, layers):
    """다중 해상도 ICO 를 직접 조립한다(각 항목 PNG 압축, Windows Vista+ 지원).

    Pillow 의 ICO 저장은 이미지 하나를 각 크기로 줄여 담기 때문에
    '작은 크기는 여백 없이' 처럼 크기별로 다르게 만든 레이어를 넣을 수 없다.
    """
    blobs = []
    for img in layers:
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        blobs.append(buf.getvalue())

    header = struct.pack("<HHH", 0, 1, len(blobs))  # reserved, type=icon, count
    offset = len(header) + 16 * len(blobs)
    entries, data = b"", b""
    for img, blob in zip(layers, blobs):
        w = 0 if img.width >= 256 else img.width  # 256 은 0 으로 적는 규약
        h = 0 if img.height >= 256 else img.height
        entries += struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, len(blob), offset)
        data += blob
        offset += len(blob)
    path.write_bytes(header + entries + data)


def main():
    if not SRC.exists():
        sys.exit(f"로고를 찾을 수 없습니다: {SRC}")
    tile = opaque_tile()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    write_ico(OUT, [frame(s, tile) for s in SIZES])

    png = OUT.with_suffix(".png")  # 리눅스/맥 빌드·문서용 512px PNG
    frame(512, tile).save(png)

    print(f"✓ {OUT.relative_to(ROOT)}  ({OUT.stat().st_size:,} bytes, {len(SIZES)}개 해상도)")
    print(f"✓ {png.relative_to(ROOT)}  ({png.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
