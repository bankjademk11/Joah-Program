"""
preprocess_utils.py
====================
ตัวช่วยเพิ่มความแม่นยำ:

1. remove_background(img) -> ตัดพื้นหลังออก (ใช้ rembg) เพื่อลด noise ระหว่าง
   รูปสินค้าทางการ (พื้นขาว) กับรูปที่ผู้ใช้ถ่ายเอง (พื้นหลังจริง/มือถือ)

2. augmented_views(img) -> คืนภาพหลายเวอร์ชัน (original, flip, 2 crop) สำหรับ
   Test-Time Augmentation (TTA): embed ทุกเวอร์ชันแล้วเฉลี่ย vector รวม
   ช่วยให้ทนต่อมุมกล้อง/แสงที่ต่างจากรูปตั้งต้นได้ดีขึ้น
"""

from PIL import Image, ImageOps


def remove_background(pil_img):
    """ต้องติดตั้ง: pip install rembg onnxruntime"""
    from rembg import remove
    result = remove(pil_img.convert("RGBA"))
    # วางบนพื้นขาวเพื่อให้ตัดขอบเรียบ ไม่มี transparency artifact
    bg = Image.new("RGBA", result.size, (255, 255, 255, 255))
    bg.paste(result, mask=result.split()[3])
    return bg.convert("RGB")


def augmented_views(pil_img):
    """คืน list ของภาพที่ผ่าน augmentation เบาๆ สำหรับ TTA ตอน query"""
    img = pil_img.convert("RGB")
    w, h = img.size
    views = [img, ImageOps.mirror(img)]

    # center-ish crop ที่ตัดขอบออก 10% (ช่วยกรณีถ่ายรูปติดขอบ/พื้นหลังเยอะ)
    crop_margin = 0.1
    left, top = int(w * crop_margin), int(h * crop_margin)
    right, bottom = int(w * (1 - crop_margin)), int(h * (1 - crop_margin))
    views.append(img.crop((left, top, right, bottom)))

    return views
