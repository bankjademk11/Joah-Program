FROM python:3.10-slim

# ตั้งค่า working directory
WORKDIR /app

# ติดตั้ง package พื้นฐานของ Linux ที่จำเป็นสำหรับ AI/Image processing
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# ก็อปปี้ไฟล์ requirements และติดตั้ง
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ก็อปปี้ไฟล์ทั้งหมดในโฟลเดอร์นี้ลงไปใน Docker
COPY . .

# สร้างโฟลเดอร์สำหรับโหลดโมเดล DINOv2 (ให้สิทธิ์อ่านเขียนเต็มที่)
ENV TORCH_HOME=/app/.cache
RUN mkdir -p /app/.cache && chmod -R 777 /app/.cache

# Hugging Face Spaces บังคับใช้พอร์ต 7860
EXPOSE 7860

# สั่งรันเซิร์ฟเวอร์
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
