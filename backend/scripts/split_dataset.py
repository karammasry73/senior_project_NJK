#!/usr/bin/env python3
"""Split flat YOLO-annotated images (image.jpg + image.txt pairs, same stem)
into train/val/test under a YOLO dataset directory (images/<split>, labels/<split>).

Usage:
    .venv/bin/python scripts/split_dataset.py \\
        --images data/raw/exams --labels data/raw/exams_labels \\
        --out data/datasets/exams --ratios 0.7 0.15 0.15
"""

import argparse
import random
import shutil
from pathlib import Path

IMAGE_EXTS = {".jpg", ".jpeg", ".png"}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--images", type=Path, required=True, help="Folder of source images")
    parser.add_argument("--labels", type=Path, required=True, help="Folder of matching YOLO .txt labels")
    parser.add_argument("--out", type=Path, required=True, help="Output YOLO dataset root")
    parser.add_argument("--ratios", type=float, nargs=3, default=[0.7, 0.15, 0.15], metavar=("TRAIN", "VAL", "TEST"))
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    images = sorted(p for p in args.images.iterdir() if p.suffix.lower() in IMAGE_EXTS)
    labeled = [p for p in images if (args.labels / f"{p.stem}.txt").exists()]
    unlabeled = [p for p in images if p not in labeled]
    if unlabeled:
        names = [p.name for p in unlabeled[:5]]
        print(f"Skipping {len(unlabeled)} image(s) with no matching label: {names}{'...' if len(unlabeled) > 5 else ''}")

    random.Random(args.seed).shuffle(labeled)
    n = len(labeled)
    n_train = round(n * args.ratios[0])
    n_val = round(n * args.ratios[1])
    splits = {
        "train": labeled[:n_train],
        "val": labeled[n_train:n_train + n_val],
        "test": labeled[n_train + n_val:],
    }

    for split, files in splits.items():
        img_dir = args.out / "images" / split
        lbl_dir = args.out / "labels" / split
        img_dir.mkdir(parents=True, exist_ok=True)
        lbl_dir.mkdir(parents=True, exist_ok=True)
        for img_path in files:
            shutil.copy2(img_path, img_dir / img_path.name)
            shutil.copy2(args.labels / f"{img_path.stem}.txt", lbl_dir / f"{img_path.stem}.txt")
        print(f"{split}: {len(files)} image(s)")


if __name__ == "__main__":
    main()
