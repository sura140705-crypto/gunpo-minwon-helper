#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
prep-bg.py — 서식 PDF 1쪽을 배경 이미지(base64 data URI)로 렌더링.
  사용: python tools/prep-bg.py <이름> <서식.pdf> [배율]
  출력: engine/assets/<이름>.b64   (build-form.js가 읽어 인라인)
  예:  python tools/prep-bg.py birth 서식원본/출생신고서.pdf
"""
import sys, os, base64, io

def main():
    if len(sys.argv) < 3:
        print("사용: python tools/prep-bg.py <이름> <서식.pdf> [배율]")
        sys.exit(1)
    name, pdf = sys.argv[1], sys.argv[2]
    scale = float(sys.argv[3]) if len(sys.argv) > 3 else 2.0
    import fitz  # PyMuPDF
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pdf_path = pdf if os.path.isabs(pdf) else os.path.join(root, pdf)
    d = fitz.open(pdf_path)
    pix = d[0].get_pixmap(matrix=fitz.Matrix(scale, scale))
    png = pix.tobytes("png")
    uri = "data:image/png;base64," + base64.b64encode(png).decode("ascii")
    out_dir = os.path.join(root, "engine", "assets")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, name + ".b64")
    io.open(out, "w", encoding="utf-8").write(uri)
    print("배경 생성: engine/assets/%s.b64  (%dx%d, %d bytes → %d chars)"
          % (name, pix.width, pix.height, len(png), len(uri)))

if __name__ == "__main__":
    main()
