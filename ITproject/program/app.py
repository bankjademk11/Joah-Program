"""
AI Product Scan web application.
Supports camera capture and image-file upload.
"""

import argparse
import base64
import io
import mimetypes
import os
import time
from pathlib import Path

from flask import Flask, jsonify, render_template_string, request, send_file
from PIL import Image

from search_image import ProductSearcher

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
searcher = None
images_dir = None

PAGE = """
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AI Product Search</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         background:#f3f4f6; color:#172033; margin:0; padding:18px; }
  .wrap { max-width:620px; margin:0 auto; }
  h1 { text-align:center; font-size:1.45rem; margin:8px 0 4px; }
  .sub { text-align:center; color:#667085; font-size:.9rem; margin-bottom:16px; }
  .panel { background:#fff; border-radius:16px; padding:16px; box-shadow:0 3px 14px #10182812; }
  #video, #preview { width:100%; max-height:410px; object-fit:contain; border-radius:12px;
                     display:block; background:#111; }
  #preview { background:#f1f5f9; }
  .hidden { display:none !important; }
  .tabs { display:flex; gap:8px; margin-bottom:12px; }
  .tab { flex:1; padding:11px; border:1px solid #d0d5dd; border-radius:10px;
         background:#fff; color:#344054; cursor:pointer; font-size:1rem; }
  .tab.active { background:#175cd3; color:#fff; border-color:#175cd3; }
  input[type=file] { width:100%; padding:12px; border:1px dashed #98a2b3; border-radius:10px;
                     background:#f8fafc; margin:8px 0 12px; }
  button#searchBtn { width:100%; padding:14px; font-size:1.05rem; border:0; border-radius:10px;
                     background:#12b76a; color:#fff; cursor:pointer; font-weight:600; }
  button#searchBtn:disabled { background:#98a2b3; cursor:wait; }
  .option { display:flex; align-items:center; gap:8px; margin:12px 0 0; color:#667085; font-size:.9rem; }
  #status { text-align:center; color:#667085; margin:14px 0 4px; min-height:1.3em; }
  #results { margin-top:12px; }
  .result { display:flex; gap:12px; align-items:center; background:#fff; border-radius:12px;
            padding:10px; margin-bottom:9px; border:1px solid #eaecf0; }
  .result img { width:82px; height:82px; object-fit:contain; border-radius:8px; background:#f2f4f7; }
  .result-info { flex:1; min-width:0; }
  .rank { color:#98a2b3; margin-right:5px; }
  .barcode { font-weight:650; overflow-wrap:anywhere; }
  .score { color:#039855; font-weight:650; margin-top:6px; }
  .empty-image { display:flex; align-items:center; justify-content:center; color:#98a2b3; font-size:.75rem; }
</style>
</head>
<body>
<div class="wrap">
  <h1>AI Product Search</h1>
  <div class="sub">Choose an image file or use the camera to find a product barcode</div>
  <div class="panel">
    <div class="tabs">
      <button class="tab active" id="cameraTab" type="button">Camera</button>
      <button class="tab" id="fileTab" type="button">Upload Image</button>
    </div>
    <div id="cameraBox">
      <video id="video" autoplay playsinline></video>
      <canvas id="canvas" class="hidden"></canvas>
    </div>
    <div id="fileBox">
      <input id="fileInput" type="file" accept="image/*">
      <img id="preview" class="hidden" alt="Selected image">
    </div>
    <button id="searchBtn" type="button">Capture and Search</button>
    <label class="option"><input type="checkbox" id="ttaCheck"> High Accuracy Mode (TTA, slower)</label>
    <div id="status"></div>
  </div>
  <div id="results"></div>
</div>
<script>
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const cameraBox = document.getElementById('cameraBox');
const fileBox = document.getElementById('fileBox');
const cameraTab = document.getElementById('cameraTab');
const fileTab = document.getElementById('fileTab');
const searchBtn = document.getElementById('searchBtn');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
let mode = 'camera';
let stream = null;

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    video.srcObject = stream;
  } catch (err) {
    statusEl.textContent = 'Camera unavailable. You can upload an image instead.';
  }
}
function setMode(next) {
  mode = next;
  const camera = next === 'camera';
  cameraBox.classList.toggle('hidden', !camera);
  fileBox.classList.toggle('hidden', camera);
  cameraTab.classList.toggle('active', camera);
  fileTab.classList.toggle('active', !camera);
  searchBtn.textContent = camera ? 'Capture and Search' : 'Search Uploaded Image';
  if (!camera) statusEl.textContent = fileInput.files.length ? 'Ready to search' : 'Please select an image file first';
  else statusEl.textContent = '';
}
cameraTab.onclick = () => setMode('camera');
fileTab.onclick = () => setMode('file');
fileInput.onchange = () => {
  const file = fileInput.files[0];
  if (!file) return;
  preview.src = URL.createObjectURL(file);
  preview.classList.remove('hidden');
  statusEl.textContent = 'Image selected. Click Search to continue';
};

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
async function imageFromCamera() {
  if (!video.videoWidth) throw new Error('Camera is not ready yet. Please wait a moment');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.9);
}
function imageFromFile() {
  const file = fileInput.files[0];
  if (!file) throw new Error('Please select an image file first');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read the image file'));
    reader.readAsDataURL(file);
  });
}
searchBtn.onclick = async () => {
  try {
    searchBtn.disabled = true; resultsEl.innerHTML = ''; statusEl.textContent = 'Searching...';
    const t0 = performance.now();
    const image = mode === 'camera' ? await imageFromCamera() : await imageFromFile();
    const res = await fetch('/search', {method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({image:image, tta:document.getElementById('ttaCheck').checked})});
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Search failed');
    statusEl.textContent = `Results found in ${(performance.now()-t0).toFixed(0)} ms`;
    resultsEl.innerHTML = data.results.map((r,i) => `
      <div class="result">
        <img src="${r.image_url || ''}" alt="${escapeHtml(r.barcode)}"
             onerror="this.outerHTML='<div class=\"result img empty-image\">No image</div>'">
        <div class="result-info"><div class="barcode"><span class="rank">#${i+1}</span>${escapeHtml(r.barcode)}</div>
        <div class="score">Similarity ${(r.similarity*100).toFixed(1)}%</div></div>
      </div>`).join('');
  } catch (err) { statusEl.textContent = err.message; }
  finally { searchBtn.disabled = false; }
};
startCamera();
</script>
</body>
</html>
"""


def find_product_image(barcode):
    if images_dir is None:
        return None
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp"):
        candidate = images_dir / f"{barcode}{ext}"
        if candidate.is_file():
            return candidate
    return None


@app.route("/")
def index():
    return render_template_string(PAGE)


@app.route("/product-image/<barcode>")
def product_image(barcode):
    # Barcode labels originate from filenames; only allow a plain filename stem.
    if not barcode or Path(barcode).name != barcode:
        return ("Invalid barcode", 400)
    path = find_product_image(barcode)
    if path is None:
        return ("Image not found", 404)
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return send_file(path, mimetype=mime, max_age=3600)


@app.route("/search", methods=["POST"])
def search():
    try:
        data = request.get_json(force=True)
        b64 = data["image"].split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
        topk = min(max(int(data.get("topk", 5)), 1), 20)
        results, elapsed_ms = searcher.search(img, topk=topk, tta=bool(data.get("tta", False)))
        for result in results:
            if find_product_image(result["barcode"]):
                result["image_url"] = "/product-image/" + result["barcode"]
        return jsonify({"results": results, "server_ms": elapsed_ms})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


def main():
    global searcher, images_dir
    ap = argparse.ArgumentParser()
    ap.add_argument("--index_dir", default="./index_data")
    ap.add_argument("--images_dir", default="./images")
    ap.add_argument("--port", type=int, default=5000)
    ap.add_argument("--host", default="0.0.0.0")
    args = ap.parse_args()
    images_dir = Path(args.images_dir).resolve()
    print("Loading model and index...")
    t0 = time.time()
    searcher = ProductSearcher(args.index_dir)
    print(f"Ready in {time.time() - t0:.1f}s (model={searcher.meta['model']}, "
          f"remove_bg={searcher.remove_bg}, products={searcher.index.ntotal})")
    app.run(host=args.host, port=args.port, debug=False)


if __name__ == "__main__":
    main()
