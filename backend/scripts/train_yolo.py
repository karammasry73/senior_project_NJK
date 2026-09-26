#!/usr/bin/env python3
"""Fine-tune YOLOv8 on the exam layout dataset (data/datasets/exams).

Usage:
    .venv/bin/python scripts/train_yolo.py [--epochs 100] [--imgsz 960] [--batch 4]

After training, best weights land at runs/detect/train/weights/best.pt.
Copy that to backend/models/yolov8n.pt (or point SME_YOLO_WEIGHTS_PATH at it)
so document_pipeline.py picks it up automatically.
"""

import argparse
from pathlib import Path

from ultralytics import YOLO

DATA_YAML = Path(__file__).resolve().parent.parent / "data" / "datasets" / "exams" / "data.yaml"


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", default="yolov8n.pt", help="Base weights to fine-tune from (default: stock YOLOv8n)")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--imgsz", type=int, default=960, help="Training resolution (higher than COCO's 640 default - document fields are small)")
    parser.add_argument("--batch", type=int, default=4, help="Small on purpose: this dataset only has ~20 train images")
    parser.add_argument("--patience", type=int, default=20, help="Stop early if val mAP doesn't improve for this many epochs")
    args = parser.parse_args()

    if not DATA_YAML.exists():
        raise SystemExit(f"{DATA_YAML} not found - run scripts/split_dataset.py first")

    model = YOLO(args.model)
    model.train(
        data=str(DATA_YAML),
        epochs=args.epochs,
        imgsz=args.imgsz,
        batch=args.batch,
        patience=args.patience,
        device="cpu",
    )


if __name__ == "__main__":
    main()
