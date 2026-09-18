#!/usr/bin/env python3
"""Convert Pascal VOC XML labels (as exported by make-sense.ai) to YOLO .txt format.

Usage:
    .venv/bin/python scripts/voc_to_yolo.py <voc_xml_dir> <out_dir> --classes data/datasets/exams/data.yaml

Class indices come from data.yaml's `names` mapping, so they stay consistent
with whatever the rest of the pipeline (split_dataset.py, train_yolo.py)
expects. Any object whose class isn't in that mapping is skipped with a
warning rather than silently mis-indexed or crashing the whole batch.
"""

import argparse
import xml.etree.ElementTree as ET
from pathlib import Path

import yaml


def load_class_map(data_yaml: Path) -> dict[str, int]:
    data = yaml.safe_load(data_yaml.read_text())
    return {name: idx for idx, name in data["names"].items()}


def convert_file(xml_path: Path, class_map: dict[str, int]) -> tuple[list[str], list[str]]:
    """Returns (yolo_lines, skipped_class_names)."""
    tree = ET.parse(xml_path)
    root = tree.getroot()
    size = root.find("size")
    img_w = float(size.find("width").text)
    img_h = float(size.find("height").text)

    lines = []
    skipped = []
    for obj in root.findall("object"):
        name = obj.find("name").text
        if name not in class_map:
            skipped.append(name)
            continue
        box = obj.find("bndbox")
        xmin = float(box.find("xmin").text)
        ymin = float(box.find("ymin").text)
        xmax = float(box.find("xmax").text)
        ymax = float(box.find("ymax").text)

        cx = ((xmin + xmax) / 2) / img_w
        cy = ((ymin + ymax) / 2) / img_h
        w = (xmax - xmin) / img_w
        h = (ymax - ymin) / img_h

        lines.append(f"{class_map[name]} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}")

    return lines, skipped


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("voc_dir", type=Path, help="Directory of VOC .xml label files")
    parser.add_argument("out_dir", type=Path, help="Directory to write YOLO .txt files into")
    parser.add_argument("--classes", type=Path, required=True, help="data.yaml providing the class name->index mapping")
    args = parser.parse_args()

    class_map = load_class_map(args.classes)
    args.out_dir.mkdir(parents=True, exist_ok=True)

    xml_files = sorted(args.voc_dir.glob("*.xml"))
    total_boxes = 0
    all_skipped = set()
    for xml_path in xml_files:
        lines, skipped = convert_file(xml_path, class_map)
        out_path = args.out_dir / f"{xml_path.stem}.txt"
        out_path.write_text("\n".join(lines) + ("\n" if lines else ""))
        total_boxes += len(lines)
        all_skipped.update(skipped)

    print(f"Converted {len(xml_files)} file(s), {total_boxes} box(es) -> {args.out_dir}")
    if all_skipped:
        print(f"WARNING: skipped unknown class name(s) not in data.yaml: {sorted(all_skipped)}")


if __name__ == "__main__":
    main()
