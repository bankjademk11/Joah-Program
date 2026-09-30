"""
models.py
=========
เลือกโมเดลสำหรับสร้าง embedding ได้หลายระดับ (เร็ว <-> แม่นยำ)

Presets:
  clip-fast      : CLIP ViT-B/32   (เร็วสุด, แม่นยำพอใช้)   <- ค่าเดิมที่ใช้ตอนแรก
  clip-accurate  : CLIP ViT-L/14   (แม่นยำขึ้นชัดเจน, ช้าลง ~3-4 เท่า)
  dinov2         : DINOv2 ViT-B/14 (เก่งเรื่องจับรูปทรง/พื้นผิวสินค้า มากกว่า CLIP)
  dinov2-large   : DINOv2 ViT-L/14 (แม่นยำสุดในกลุ่มนี้, ช้าสุด, ต้องมี RAM/VRAM พอ)

ทุก preset คืนค่า (model, preprocess_fn, embed_fn, dim) ที่หน้าตาเหมือนกัน
เพื่อให้ build_index.py / search_image.py เรียกใช้แบบเดียวกันได้หมด
"""

import os
import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms


def get_device():
    # If explicitly forced to CPU via environment variable
    if os.getenv("FORCE_CPU", "").lower() in ("1", "true", "yes"):
        return "cpu"
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


class ModelBundle:
    def __init__(self, name, model, preprocess, dim, device):
        self.name = name
        self.model = model
        self.preprocess = preprocess
        self.dim = dim
        self.device = device

    @torch.no_grad()
    def embed_batch(self, pil_images):
        """pil_images: list[PIL.Image] -> np.ndarray [N, dim], L2-normalized"""
        # Determine current available device dynamically
        dev = self.device
        if torch.cuda.is_available():
            try:
                # If CUDA is genuinely ready in this thread/context (e.g. inside @spaces.GPU)
                dev = torch.device("cuda")
                self.model.to(dev)
            except Exception:
                dev = torch.device("cpu")
                self.model.to(dev)
        else:
            dev = torch.device("cpu")
            self.model.to(dev)

        tensors = torch.stack([self.preprocess(im.convert("RGB")) for im in pil_images]).to(dev)
        if self.name.startswith("clip"):
            feats = self.model.encode_image(tensors)
        else:  # dinov2
            feats = self.model(tensors)  # CLS token pooled output
        feats = F.normalize(feats, dim=-1)
        return feats.cpu().numpy().astype("float32")


def load_model(preset="clip-fast"):
    device = get_device()

    if preset == "clip-fast":
        import open_clip
        model, _, preprocess = open_clip.create_model_and_transforms(
            "ViT-B-32", pretrained="laion2b_s34b_b79k"
        )
        dim = model.visual.output_dim

    elif preset == "clip-accurate":
        import open_clip
        model, _, preprocess = open_clip.create_model_and_transforms(
            "ViT-L-14", pretrained="laion2b_s32b_b82k"
        )
        dim = model.visual.output_dim

    elif preset in ("dinov2", "dinov2-large"):
        hub_name = "dinov2_vitb14" if preset == "dinov2" else "dinov2_vitl14"
        model = torch.hub.load("facebookresearch/dinov2", hub_name)
        dim = model.embed_dim
        preprocess = transforms.Compose([
            transforms.Resize(256, interpolation=transforms.InterpolationMode.BICUBIC),
            transforms.CenterCrop(224),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])

    model.eval()
    try:
        # If running in regular GPU environment, move to device; if on ZeroGPU, stay on CPU until request
        if device == "cuda" and not os.getenv("SPACES_ZERO_GPU"):
            model.to(device)
        else:
            model.to("cpu")
    except Exception:
        model.to("cpu")

    return ModelBundle(preset, model, preprocess, dim, device)
