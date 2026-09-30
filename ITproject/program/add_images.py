"""
add_images.py
=============
เพิ่มรูปสินค้าใหม่เข้า index ที่มีอยู่แล้ว โดย**ไม่ต้อง build ใหม่ทั้งหมด**
สคริปต์จะ:
  1. เช็คว่า barcode ไหนมีอยู่ใน index แล้วบ้าง (ข้ามอัตโนมัติ ไม่ embed ซ้ำ)
  2. embed เฉพาะรูปใหม่ที่ยังไม่เคยมี
  3. เติมเข้า FAISS index เดิมด้วย index.add() (เร็วมาก, ไม่ต้องคำนวณ vector เดิมใหม่)
  4. เซฟทับไฟล์ index/labels/embeddings เดิม

ใช้งาน:
    python add_images.py --images_dir ./images_ใหม่ --index_dir ./index_data

หมายเหตุ: ต้องใช้โมเดลเดียวกับตอน build ครั้งแรกเสมอ (สคริปต์จะโหลดให้อัตโนมัติจาก meta.json)
ถ้าต้องการ "อัปเดต" รูปของ barcode ที่มีอยู่แล้ว (เปลี่ยนรูปสินค้าเดิม) ให้ใช้ --overwrite
"""

import argparse
import json
import os
import sys
import time

import faiss
import numpy as np
from PIL import Image
from tqdm import tqdm

from models import load_model

BATCH_SIZE = 32
IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def list_images(images_dir):
    paths = []
    for root, _, files in os.walk(images_dir):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in IMG_EXTS:
                paths.append(os.path.join(root, f))
    return sorted(paths)


def barcode_from_path(path):
    return os.path.splitext(os.path.basename(path))[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images_dir", required=True, help="โฟลเดอร์รูปสินค้าใหม่ที่จะเพิ่ม")
    ap.add_argument("--index_dir", default="./index_data", help="โฟลเดอร์ index เดิมที่จะอัปเดต")
    ap.add_argument("--overwrite", action="store_true",
                     help="ถ้า barcode ซ้ำกับที่มีอยู่แล้ว ให้แทนที่ vector เดิมด้วยรูปใหม่ (ค่า default คือข้าม)")
    args = ap.parse_args()

    meta_path = os.path.join(args.index_dir, "meta.json")
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    labels_path = os.path.join(args.index_dir, "product_labels.json")
    with open(labels_path, "r", encoding="utf-8") as f:
        labels = json.load(f)
    existing_barcodes = set(labels)

    index_path = os.path.join(args.index_dir, "product_index.faiss")
    index = faiss.read_index(index_path)

    emb_path = os.path.join(args.index_dir, "product_embeddings.npy")
    old_embeddings = np.load(emb_path) if os.path.exists(emb_path) else None

    print(f"Index เดิมมี {index.ntotal} รายการ (model={meta['model']}, remove_bg={meta.get('remove_bg', False)})")

    new_paths = list_images(args.images_dir)
    print(f"พบรูปในโฟลเดอร์ใหม่ {len(new_paths)} รูป")

    to_add, to_add_barcodes = [], []
    overwrite_indices = {}  # barcode -> position ใน labels (สำหรับ --overwrite)
    skipped = 0

    for p in new_paths:
        bc = barcode_from_path(p)
        if bc in existing_barcodes:
            if args.overwrite:
                overwrite_indices[bc] = labels.index(bc)
                to_add.append(p)
                to_add_barcodes.append(bc)
            else:
                skipped += 1
            continue
        to_add.append(p)
        to_add_barcodes.append(bc)

    if skipped:
        print(f"ข้าม {skipped} รูปที่มี barcode ซ้ำกับของเดิมอยู่แล้ว (ใช้ --overwrite ถ้าต้องการแทนที่)")

    if not to_add:
        print("ไม่มีรูปใหม่ให้เพิ่ม")
        return

    print(f"กำลัง embed รูปใหม่ {len(to_add)} รูป (ใช้เวลาตามจำนวนนี้เท่านั้น ไม่แตะรูปเดิม 11,000 รูป)")
    bundle = load_model(meta["model"])
    remove_bg = meta.get("remove_bg", False)
    if remove_bg:
        from preprocess_utils import remove_background

    t0 = time.time()
    new_embeds, kept_barcodes = [], []
    for i in tqdm(range(0, len(to_add), BATCH_SIZE), desc="Embedding new"):
        batch_paths = to_add[i:i + BATCH_SIZE]
        batch_bcs = to_add_barcodes[i:i + BATCH_SIZE]
        imgs, kept_bcs = [], []
        for p, bc in zip(batch_paths, batch_bcs):
            try:
                img = Image.open(p).convert("RGB")
                if remove_bg:
                    img = remove_background(img)
                imgs.append(img)
                kept_bcs.append(bc)
            except Exception as e:
                print(f"[skip] {p}: {e}", file=sys.stderr)
        if not imgs:
            continue
        feats = bundle.embed_batch(imgs)
        new_embeds.append(feats)
        kept_barcodes.extend(kept_bcs)

    new_embeds = np.concatenate(new_embeds, axis=0)
    print(f"Embed เสร็จใน {time.time() - t0:.1f}s")

    # แยกกรณี overwrite (แทนที่ vector เดิม) กับกรณีเพิ่มใหม่ล้วนๆ
    pure_new_mask = [bc not in overwrite_indices for bc in kept_barcodes]
    pure_new_embeds = new_embeds[pure_new_mask]
    pure_new_barcodes = [bc for bc, m in zip(kept_barcodes, pure_new_mask) if m]

    if overwrite_indices and old_embeddings is not None:
        for bc, emb in zip(kept_barcodes, new_embeds):
            if bc in overwrite_indices:
                old_embeddings[overwrite_indices[bc]] = emb
        # FAISS IndexFlatIP ไม่รองรับแก้ vector ในตำแหน่งเดิมโดยตรง -> rebuild index จาก embeddings ที่แก้แล้ว
        # (เร็ว เพราะเป็นแค่การ add() ใหม่ทั้งชุด ไม่ต้อง embed ใหม่)
        index = faiss.IndexFlatIP(old_embeddings.shape[1])
        index.add(old_embeddings)
        print(f"อัปเดตรูปเดิม (overwrite) {len(overwrite_indices)} barcode")

    if len(pure_new_embeds) > 0:
        index.add(pure_new_embeds)
        labels.extend(pure_new_barcodes)
        if old_embeddings is not None:
            all_embeds = np.concatenate([old_embeddings, pure_new_embeds], axis=0)
        else:
            all_embeds = pure_new_embeds
    else:
        all_embeds = old_embeddings

    faiss.write_index(index, index_path)
    with open(labels_path, "w", encoding="utf-8") as f:
        json.dump(labels, f, ensure_ascii=False, indent=2)
    np.save(emb_path, all_embeds)

    print(f"เสร็จแล้ว! index ตอนนี้มี {index.ntotal} รายการ "
          f"(เพิ่มใหม่ {len(pure_new_barcodes)}, อัปเดตทับ {len(overwrite_indices)})")


if __name__ == "__main__":
    main()
