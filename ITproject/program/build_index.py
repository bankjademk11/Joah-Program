"""
build_index.py
================
สแกนโฟลเดอร์รูปสินค้าทั้งหมด (ชื่อไฟล์ = barcode) แล้วสร้าง:
  - product_index.faiss   -> FAISS index สำหรับค้นหาแบบเร็ว
  - product_labels.json   -> mapping ตำแหน่งใน index -> barcode/ชื่อไฟล์
  - meta.json             -> จำโมเดล/ตั้งค่าที่ใช้ตอน build (search_image.py จะโหลดโมเดลเดียวกันอัตโนมัติ)

ใช้งาน:
    python build_index.py --images_dir /path/to/11000_images --out_dir ./index_data --model clip-accurate

--model เลือกได้: clip-fast (เร็วสุด) | clip-accurate | dinov2 | dinov2-large (แม่นสุด)
--remove_bg เปิด background removal (ต้อง: pip install rembg onnxruntime, จะช้าลงตอน build)
"""

import argparse
import json
import os
import sys
import time

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


def embed_images(bundle, paths, remove_bg=False):
    from preprocess_utils import remove_background

    all_embeds = []
    good_paths = []
    for i in tqdm(range(0, len(paths), BATCH_SIZE), desc="Embedding"):
        batch_paths = paths[i:i + BATCH_SIZE]
        imgs, kept = [], []
        for p in batch_paths:
            try:
                img = Image.open(p).convert("RGB")
                if remove_bg:
                    img = remove_background(img)
                imgs.append(img)
                kept.append(p)
            except Exception as e:
                print(f"[skip] {p}: {e}", file=sys.stderr)
        if not imgs:
            continue
        feats = bundle.embed_batch(imgs)
        all_embeds.append(feats)
        good_paths.extend(kept)
    if not all_embeds:
        return np.zeros((0, bundle.dim), dtype="float32"), []
    return np.concatenate(all_embeds, axis=0), good_paths


def build_faiss_index(embeddings):
    import faiss
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)  # cosine sim ผ่าน inner product (vector normalize แล้ว)
    index.add(embeddings)
    return index


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--images_dir", required=True)
    ap.add_argument("--out_dir", default="./index_data")
    ap.add_argument("--model", default="clip-fast",
                     choices=["clip-fast", "clip-accurate", "dinov2", "dinov2-large"])
    ap.add_argument("--remove_bg", action="store_true",
                     help="ตัดพื้นหลังก่อน embed (ต้องติดตั้ง rembg)")
    args = ap.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)

    print(f"Loading model preset: {args.model}")
    bundle = load_model(args.model)
    print(f"Device: {bundle.device}, embedding dim: {bundle.dim}")

    print("Listing images...")
    paths = list_images(args.images_dir)
    print(f"Found {len(paths)} images")
    if not paths:
        print("ไม่พบรูปภาพในโฟลเดอร์ที่ระบุ")
        return

    t0 = time.time()
    embeddings, good_paths = embed_images(bundle, paths, remove_bg=args.remove_bg)
    print(f"Embedded {len(good_paths)} images in {time.time() - t0:.1f}s")

    labels = [barcode_from_path(p) for p in good_paths]

    print("Building FAISS index...")
    index = build_faiss_index(embeddings)

    import faiss
    faiss.write_index(index, os.path.join(args.out_dir, "product_index.faiss"))
    with open(os.path.join(args.out_dir, "product_labels.json"), "w", encoding="utf-8") as f:
        json.dump(labels, f, ensure_ascii=False, indent=2)
    with open(os.path.join(args.out_dir, "meta.json"), "w", encoding="utf-8") as f:
        json.dump({"model": args.model, "remove_bg": args.remove_bg, "dim": bundle.dim}, f, indent=2)
    np.save(os.path.join(args.out_dir, "product_embeddings.npy"), embeddings)

    print(f"เสร็จแล้ว! index มี {index.ntotal} รายการ (model={args.model}, remove_bg={args.remove_bg})")
    print(f"ไฟล์ถูกบันทึกที่: {args.out_dir}")


if __name__ == "__main__":
    main()
