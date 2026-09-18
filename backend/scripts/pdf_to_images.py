#!/usr/bin/env python3
"""Batch-render PDF exam files to PNG pages for the annotation dataset.

200 DPI matches the resolution document_pipeline.py already renders PDFs at
in production, so PDF-sourced training images match what the app will see.

Usage:
    .venv/bin/python scripts/pdf_to_images.py <pdf_or_dir> [--dpi 200] [--out data/raw/exams]
"""

import argparse
import sys
from pathlib import Path

import pymupdf


def render_pdf(pdf_path: Path, out_dir: Path, dpi: int) -> list[Path]:
    doc = pymupdf.open(pdf_path)
    written = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=dpi)
        out_path = out_dir / f"{pdf_path.stem}_p{i + 1}.png"
        pix.save(out_path)
        written.append(out_path)
    doc.close()
    return written


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input", type=Path, help="A PDF file or a directory of PDFs")
    parser.add_argument("--dpi", type=int, default=200, help="Render resolution (default: 200)")
    parser.add_argument("--out", type=Path, default=Path("data/raw/exams"), help="Output directory for PNGs")
    args = parser.parse_args()

    args.out.mkdir(parents=True, exist_ok=True)

    pdfs = [args.input] if args.input.is_file() else sorted(args.input.glob("*.pdf"))
    if not pdfs:
        print(f"No PDFs found at {args.input}", file=sys.stderr)
        sys.exit(1)

    total = 0
    for pdf in pdfs:
        written = render_pdf(pdf, args.out, args.dpi)
        print(f"{pdf.name}: {len(written)} page(s) -> {args.out}")
        total += len(written)

    print(f"\nDone: {total} image(s) written to {args.out}")


if __name__ == "__main__":
    main()
