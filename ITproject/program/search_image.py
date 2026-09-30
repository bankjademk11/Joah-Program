"""
search_image.py
================
ค้นหาสินค้าที่ใกล้เคียงที่สุดจากรูปที่ถ่ายมา โดยใช้ index ที่สร้างจาก build_index.py
โหลดโมเดล "เดียวกับที่ใช้ตอน build" อัตโนมัติ (อ่านจาก meta.json)

ใช้งาน:
    python search_image.py --query my_photo.jpg --index_dir ./index_data --topk 5 --tta
"""

import argparse
import json
import os
import time

import faiss
import numpy as np
from PIL import Image

from models import load_model


class ProductSearcher:
    """โหลดโมเดล + index ครั้งเดียว แล้ว query ซ้ำได้เร็ว (เหมาะกับใช้ในแอป/เว็บ)"""

    def __init__(self, index_dir):
        with open(os.path.join(index_dir, "meta.json"), "r", encoding="utf-8") as f:
            self.meta = json.load(f)

        self.bundle = load_model(self.meta["model"])
        self.remove_bg = self.meta.get("remove_bg", False)

        self.index = faiss.read_index(os.path.join(index_dir, "product_index.faiss"))
        with open(os.path.join(index_dir, "product_labels.json"), "r", encoding="utf-8") as f:
            self.labels = json.load(f)

    def _maybe_remove_bg(self, pil_image):
        if not self.remove_bg:
            return pil_image
        from preprocess_utils import remove_background
        return remove_background(pil_image)

    def embed(self, pil_image, tta=False):
        """tta=True: เฉลี่ย embedding จากหลายมุม/เวอร์ชันของภาพ -> ทนต่อมุมกล้อง/แสงมากขึ้น"""
        img = self._maybe_remove_bg(pil_image)
        if tta:
            from preprocess_utils import augmented_views
            views = augmented_views(img)
            feats = self.bundle.embed_batch(views)   # [num_views, dim]
            feat = feats.mean(axis=0, keepdims=True)
            feat = feat / np.linalg.norm(feat, axis=-1, keepdims=True)
            return feat
        return self.bundle.embed_batch([img])

    def search(self, pil_image, topk=5, tta=False):
        t0 = time.time()
        query_vec = self.embed(pil_image, tta=tta)
        scores, idxs = self.index.search(query_vec, topk)
        elapsed_ms = (time.time() - t0) * 1000
        results = []
        for score, idx in zip(scores[0], idxs[0]):
            if idx == -1:
                continue
            results.append({"barcode": self.labels[idx], "similarity": float(score)})
        return results, elapsed_ms


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--query", required=True)
    ap.add_argument("--index_dir", default="./index_data")
    ap.add_argument("--topk", type=int, default=5)
    ap.add_argument("--tta", action="store_true", help="เปิด test-time augmentation (แม่นขึ้น, ช้าลงเล็กน้อย)")
    args = ap.parse_args()

    searcher = ProductSearcher(args.index_dir)
    img = Image.open(args.query)
    results, elapsed_ms = searcher.search(img, topk=args.topk, tta=args.tta)

    print(f"\nโมเดล: {searcher.meta['model']}  |  remove_bg: {searcher.remove_bg}  |  TTA: {args.tta}")
    print(f"ค้นหาเสร็จใน {elapsed_ms:.1f} ms\n")
    print(f"{'อันดับ':<6}{'Barcode':<30}{'ความคล้าย':<10}")
    for i, r in enumerate(results, 1):
        print(f"{i:<6}{r['barcode']:<30}{r['similarity']*100:.1f}%")


if __name__ == "__main__":
    main()
