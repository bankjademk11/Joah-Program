import base64
import io
import mimetypes
import os
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse, JSONResponse
from pydantic import BaseModel
from PIL import Image

from search_image import ProductSearcher

INDEX_DIR = os.getenv("INDEX_DIR", "./index_data")
IMAGES_DIR = Path(os.getenv("IMAGES_DIR", "./images")).resolve()

app = FastAPI(title="AI Product Search API")

# อนุญาตให้เว็บ Joah ยิง API ข้ามโดเมนมาได้ (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

searcher = None
startup_error = None

def get_searcher():
    global searcher, startup_error
    if searcher is not None:
        return searcher
    print("Initializing ProductSearcher...")
    try:
        searcher = ProductSearcher(INDEX_DIR)
        startup_error = None
        return searcher
    except Exception as e:
        import traceback
        startup_error = traceback.format_exc()
        print(f"Failed to load searcher: {startup_error}")
        raise e

@app.on_event("startup")
def startup_event():
    print("Startup: loading model and index...")
    t0 = time.time()
    try:
        s = get_searcher()
        print(f"Ready in {time.time() - t0:.1f}s (model={s.meta['model']}, products={s.index.ntotal})")
    except Exception as e:
        print(f"Startup model load deferred or failed: {e}")

class SearchRequest(BaseModel):
    image: str
    topk: int = 5
    tta: bool = False

def find_product_image(barcode):
    if not IMAGES_DIR.exists():
        return None
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp"):
        candidate = IMAGES_DIR / f"{barcode}{ext}"
        if candidate.is_file():
            return candidate
    return None

# ── Gradio health-check stubs (HF Spaces probes these; 404 → shutdown) ──────
@app.get("/settings.json")
def gradio_settings():
    return JSONResponse({"version": "4.44.0", "is_colab": False, "enable_queue": True})

@app.get("/app/config.json")
def gradio_config():
    return JSONResponse({"version": "4.44.0", "mode": "blocks", "components": [], "layout": {}, "dependencies": []})
# ─────────────────────────────────────────────────────────────────────────────

PAGE = """<!DOCTYPE html>
<html lang="lo" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
<title>Joah AI Lens · Smart Product Search</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Noto+Sans+Lao:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --bg-base: #090d16;
    --bg-card: rgba(18, 24, 38, 0.75);
    --bg-card-hover: rgba(26, 35, 56, 0.85);
    --border-subtle: rgba(255, 255, 255, 0.08);
    --border-glow: rgba(99, 102, 241, 0.4);
    --primary: #6366f1;
    --primary-light: #818cf8;
    --primary-glow: rgba(99, 102, 241, 0.35);
    --accent: #06b6d4;
    --accent-emerald: #10b981;
    --text-main: #f8fafc;
    --text-muted: #94a3b8;
    --text-dim: #64748b;
  }

  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

  body {
    font-family: 'Plus Jakarta Sans', 'Noto Sans Lao', -apple-system, sans-serif;
    background: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #090d16 55%, #05070c 100%);
    color: var(--text-main);
    margin: 0;
    padding: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    overflow-x: hidden;
  }

  /* Glass Container */
  .app-shell {
    width: 100%;
    max-width: 900px;
    margin: 0 auto;
    padding: 16px 20px 48px;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  /* Header Bar */
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0 20px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 24px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .brand-icon {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: linear-gradient(135deg, #6366f1 0%, #4338ca 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px var(--primary-glow);
    border: 1px solid rgba(255,255,255,0.15);
  }
  .brand-icon svg { width: 22px; height: 22px; fill: none; stroke: #fff; stroke-width: 2.2; }
  .brand-text h1 {
    font-size: 1.15rem;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.01em;
    background: linear-gradient(to right, #fff, #cbd5e1);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .brand-text p {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin: 2px 0 0;
  }
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    box-shadow: 0 0 10px #10b981;
    animation: pulse 2s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }

  /* Main Interactive Grid */
  .workspace {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }
  @media (min-width: 768px) {
    .workspace {
      grid-template-columns: 1.1fr 1fr;
      align-items: start;
    }
  }

  /* Glass Card Component */
  .glass-card {
    background: var(--bg-card);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border-subtle);
    border-radius: 24px;
    padding: 20px;
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.35);
  }

  /* Tabs Switcher */
  .tab-capsule {
    display: flex;
    background: rgba(10, 14, 23, 0.6);
    border-radius: 14px;
    padding: 4px;
    border: 1px solid var(--border-subtle);
    margin-bottom: 16px;
    gap: 4px;
  }
  .tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }
  .tab-btn.active {
    background: linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(99,102,241,0.1) 100%);
    color: #fff;
    border: 1px solid rgba(99,102,241,0.3);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }
  .tab-btn svg { width: 16px; height: 16px; }

  /* Viewfinder / Preview Box */
  .viewport-box {
    position: relative;
    width: 100%;
    aspect-ratio: 4 / 3;
    max-height: 380px;
    background: #020617;
    border-radius: 18px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  #video, #preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  #preview { object-fit: contain; }

  /* Futuristic Viewfinder HUD */
  .reticle {
    position: absolute;
    inset: 18%;
    border: 2px dashed rgba(99, 102, 241, 0.6);
    border-radius: 18px;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
  }
  .reticle::before, .reticle::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    border-color: #818cf8;
  }
  .reticle-corner-tl { position: absolute; top: -2px; left: -2px; width: 16px; height: 16px; border-top: 3px solid #818cf8; border-left: 3px solid #818cf8; border-top-left-radius: 8px; }
  .reticle-corner-tr { position: absolute; top: -2px; right: -2px; width: 16px; height: 16px; border-top: 3px solid #818cf8; border-right: 3px solid #818cf8; border-top-right-radius: 8px; }
  .reticle-corner-bl { position: absolute; bottom: -2px; left: -2px; width: 16px; height: 16px; border-bottom: 3px solid #818cf8; border-left: 3px solid #818cf8; border-bottom-left-radius: 8px; }
  .reticle-corner-br { position: absolute; bottom: -2px; right: -2px; width: 16px; height: 16px; border-bottom: 3px solid #818cf8; border-right: 3px solid #818cf8; border-bottom-right-radius: 8px; }

  .scan-bar {
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent 0%, #38bdf8 50%, transparent 100%);
    box-shadow: 0 0 14px #38bdf8;
    animation: scanAnim 2.4s infinite ease-in-out;
  }
  @keyframes scanAnim {
    0% { top: 5%; opacity: 0.2; }
    50% { top: 90%; opacity: 1; }
    100% { top: 5%; opacity: 0.2; }
  }

  /* File Dropzone Style */
  .drop-zone {
    border: 2px dashed rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    padding: 30px 16px;
    text-align: center;
    cursor: pointer;
    background: rgba(15, 23, 42, 0.4);
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }
  .drop-zone:hover {
    border-color: var(--primary-light);
    background: rgba(99, 102, 241, 0.06);
  }
  .drop-zone-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(99, 102, 241, 0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--primary-light);
  }
  .drop-zone p { margin: 0; font-size: 0.88rem; color: var(--text-main); font-weight: 600; }
  .drop-zone span { font-size: 0.75rem; color: var(--text-dim); }

  /* Camera Controls Float inside Viewport */
  .camera-actions {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    margin-top: 14px;
  }
  .camera-switch-btn {
    padding: 10px 14px;
    border-radius: 12px;
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s;
  }
  .camera-switch-btn:hover {
    background: rgba(255,255,255,0.12);
    color: #fff;
  }

  /* Search Trigger Button */
  .action-btn {
    width: 100%;
    margin-top: 16px;
    padding: 14px 20px;
    border-radius: 14px;
    border: none;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
    color: #ffffff;
    box-shadow: 0 10px 24px -4px var(--primary-glow);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .action-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 14px 30px -4px rgba(99, 102, 241, 0.55);
  }
  .action-btn:active:not(:disabled) {
    transform: translateY(0);
  }
  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: #334155;
    box-shadow: none;
  }

  /* Toggle Settings */
  .options-row {
    margin-top: 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.78rem;
    color: var(--text-muted);
  }
  .toggle-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    user-select: none;
  }
  .toggle-wrap input { display: none; }
  .switch {
    width: 34px;
    height: 18px;
    background: rgba(255, 255, 255, 0.15);
    border-radius: 20px;
    position: relative;
    transition: background 0.25s;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    background: #fff;
    border-radius: 50%;
    transition: transform 0.25s;
  }
  .toggle-wrap input:checked + .switch {
    background: #6366f1;
  }
  .toggle-wrap input:checked + .switch::after {
    transform: translateX(16px);
  }

  /* Results Column */
  .results-card {
    display: flex;
    flex-direction: column;
    min-height: 420px;
  }
  .results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 16px;
  }
  .results-title {
    font-size: 0.95rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
    color: #fff;
  }
  .match-count {
    background: rgba(99,102,241,0.2);
    color: #a5b4fc;
    font-size: 0.75rem;
    padding: 3px 8px;
    border-radius: 8px;
    font-weight: 600;
  }

  /* Status Banner */
  #status {
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
    margin-bottom: 12px;
    display: none;
    align-items: center;
    gap: 8px;
  }
  #status.show { display: flex; }
  #status.loading {
    background: rgba(99, 102, 241, 0.12);
    border: 1px solid rgba(99, 102, 241, 0.25);
    color: #a5b4fc;
  }
  #status.success {
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #6ee7b7;
  }
  #status.error {
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #fca5a5;
  }

  /* Results List */
  #results {
    display: flex;
    flex-direction: column;
    gap: 10px;
    overflow-y: auto;
    max-height: 520px;
    padding-right: 4px;
  }
  #results::-webkit-scrollbar { width: 5px; }
  #results::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 999px; }

  .result-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(15, 23, 42, 0.45);
    border: 1px solid var(--border-subtle);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    overflow: hidden;
  }
  .result-item:hover {
    border-color: rgba(99, 102, 241, 0.4);
    background: rgba(25, 34, 55, 0.65);
    transform: translateX(3px);
  }
  .result-rank {
    width: 24px;
    height: 24px;
    border-radius: 7px;
    background: rgba(255,255,255,0.06);
    color: var(--text-muted);
    font-size: 0.72rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    shrink: 0;
  }
  .rank-1 { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); }
  .rank-2 { background: rgba(148, 163, 184, 0.2); color: #e2e8f0; }
  .rank-3 { background: rgba(180, 83, 9, 0.2); color: #fb923c; }

  .result-img-box {
    width: 60px;
    height: 60px;
    border-radius: 12px;
    background: #020617;
    border: 1px solid rgba(255,255,255,0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    shrink: 0;
  }
  .result-img-box img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .no-img {
    font-size: 0.65rem;
    color: var(--text-dim);
    text-align: center;
  }

  .result-meta {
    flex: 1;
    min-width: 0;
  }
  .barcode-tag {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.88rem;
    font-weight: 600;
    color: #fff;
    letter-spacing: 0.02em;
    word-break: break-all;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .copy-btn {
    background: none;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
    transition: color 0.2s;
  }
  .copy-btn:hover { color: #fff; }
  
  .score-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    margin-top: 5px;
  }
  .score-high { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25); }
  .score-med { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.25); }
  .score-low { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); }

  /* Empty Placeholder */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 40px 16px;
    color: var(--text-dim);
  }
  .empty-state svg { width: 44px; height: 44px; margin-bottom: 12px; stroke: rgba(255,255,255,0.15); }
  .empty-state p { margin: 0; font-size: 0.85rem; color: var(--text-muted); }
  .empty-state span { font-size: 0.72rem; color: var(--text-dim); margin-top: 4px; }

  /* Utility classes */
  .hidden { display: none !important; }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<div class="app-shell">
  <header>
    <div class="brand">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/></svg>
      </div>
      <div class="brand-text">
        <h1>Joah Lens · Visual Product AI</h1>
        <p>Powered by Meta DINOv2 Deep Feature Vectors & FAISS</p>
      </div>
    </div>
    <div class="status-pill">
      <div class="status-dot"></div>
      ZeroGPU Active
    </div>
  </header>

  <main class="workspace">
    <!-- Visual Input Panel -->
    <div class="glass-card">
      <div class="tab-capsule">
        <button class="tab-btn active" id="cameraTab" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          ກ້ອງຖ່າຍ (Camera)
        </button>
        <button class="tab-btn" id="fileTab" type="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          ອັບໂຫຼດຮູບ (Upload)
        </button>
      </div>

      <!-- Camera Viewport -->
      <div id="cameraBox">
        <div class="viewport-box">
          <video id="video" autoplay playsinline muted></video>
          <canvas id="canvas" class="hidden"></canvas>
          <div class="reticle">
            <div class="reticle-corner-tl"></div>
            <div class="reticle-corner-tr"></div>
            <div class="reticle-corner-bl"></div>
            <div class="reticle-corner-br"></div>
            <div class="scan-bar"></div>
          </div>
        </div>
        <div class="camera-actions">
          <button class="camera-switch-btn" id="flipCamBtn" type="button">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            ສະຫຼັບກ້ອງໜ້າ/ຫຼັງ
          </button>
        </div>
      </div>

      <!-- File Upload Dropzone -->
      <div id="fileBox" class="hidden">
        <div class="drop-zone" id="dropZone" onclick="document.getElementById('fileInput').click()">
          <div class="drop-zone-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <p>ກົດເພື່ອເລືອກຮູບ ຫຼື ລາກໄຟລ໌ມາໃສ່</p>
          <span>ຮອງຮັບໄຟລ໌ JPG, PNG, WEBP ສູງສຸດ 10MB</span>
        </div>
        <input id="fileInput" type="file" accept="image/*" class="hidden">
        
        <div id="previewWrap" class="viewport-box hidden" style="margin-top:12px;">
          <img id="preview" alt="Selected Preview">
        </div>
      </div>

      <!-- Trigger Action -->
      <button id="searchBtn" class="action-btn" type="button">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span id="btnText">ຖ່າຍຮູບ ແລະ ຄົ້ນຫາສິນຄ້າ</span>
      </button>

      <!-- Search Settings -->
      <div class="options-row">
        <label class="toggle-wrap">
          <input type="checkbox" id="ttaCheck">
          <div class="switch"></div>
          <span>ໂໝດລະອຽດສູງ (TTA Mode)</span>
        </label>
        <span style="color:var(--text-dim);">Top 5 Matches</span>
      </div>
    </div>

    <!-- Match Results Panel -->
    <div class="glass-card results-card">
      <div class="results-header">
        <div class="results-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          ຜົນການຄົ້ນຫາ (AI Matches)
        </div>
        <div class="match-count" id="matchBadge" style="display:none;">0 ລາຍການ</div>
      </div>

      <div id="status"></div>

      <div id="results">
        <div class="empty-state" id="emptyPlaceholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M20.4 14.5L16 10 4 20"/></svg>
          <p>ພ້ອມຄົ້ນຫາສິນຄ້າຈາກຮູບພາບ</p>
          <span>ຖ່າຍຮູບສິນຄ້າ ຫຼື ເລືອກຮູບຈາກອຸປະກອນເພື່ອເລີ່ມຕົ້ນ</span>
        </div>
      </div>
    </div>
  </main>
</div>

<script>
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const fileInput = document.getElementById('fileInput');
const preview = document.getElementById('preview');
const previewWrap = document.getElementById('previewWrap');
const dropZone = document.getElementById('dropZone');
const cameraBox = document.getElementById('cameraBox');
const fileBox = document.getElementById('fileBox');
const cameraTab = document.getElementById('cameraTab');
const fileTab = document.getElementById('fileTab');
const searchBtn = document.getElementById('searchBtn');
const btnText = document.getElementById('btnText');
const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const emptyPlaceholder = document.getElementById('emptyPlaceholder');
const matchBadge = document.getElementById('matchBadge');
const flipCamBtn = document.getElementById('flipCamBtn');

let mode = 'camera';
let stream = null;
let currentFacingMode = 'environment';

async function startCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: currentFacingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    });
    video.srcObject = stream;
  } catch (err) {
    showStatus('ກ້ອງຖ່າຍບໍ່ພ້ອມໃຊ້ງານ — ກະລຸນາເລືອກອັບໂຫຼດຮູບແທນ', 'error');
  }
}

flipCamBtn.onclick = () => {
  currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
  startCamera();
};

function setMode(next) {
  mode = next;
  const isCam = next === 'camera';
  cameraBox.classList.toggle('hidden', !isCam);
  fileBox.classList.toggle('hidden', isCam);
  cameraTab.classList.toggle('active', isCam);
  fileTab.classList.toggle('active', !isCam);
  btnText.textContent = isCam ? 'ຖ່າຍຮູບ ແລະ ຄົ້ນຫາສິນຄ້າ' : 'ຄົ້ນຫາຈາກຮູບທີ່ເລືອກ';
  
  if (isCam && !stream) {
    startCamera();
  }
}

cameraTab.onclick = () => setMode('camera');
fileTab.onclick = () => setMode('file');

fileInput.onchange = () => {
  const file = fileInput.files[0];
  if (!file) return;
  preview.src = URL.createObjectURL(file);
  previewWrap.classList.remove('hidden');
  dropZone.classList.add('hidden');
  showStatus('ເລືອກຮູບສຳເລັດແລ້ວ — ກົດປຸ່ມຄົ້ນຫາໄດ້ເລີຍ', 'loading');
};

function showStatus(text, type = 'loading') {
  statusEl.className = `show ${type}`;
  statusEl.innerHTML = (type === 'loading' ? '<div class="spinner"></div>' : '') + `<span>${text}</span>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

async function imageFromCamera() {
  if (!video.videoWidth) throw new Error('ກ້ອງຍັງບໍ່ພ້ອມໃຊ້ງານ ກະລຸນາລໍຖ້າຈັກໜ່ອຍ');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.88);
}

function imageFromFile() {
  const file = fileInput.files[0];
  if (!file) throw new Error('ກະລຸນາເລືອກໄຟລ໌ຮູບພາບກ່ອນ');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('ອ່ານໄຟລ໌ຮູບບໍ່ສຳເລັດ'));
    reader.readAsDataURL(file);
  });
}

function copyBarcode(barcode) {
  navigator.clipboard?.writeText(barcode);
  showStatus(`ຄັດລອກ Barcode ${barcode} ແລ້ວ!`, 'success');
}

searchBtn.onclick = async () => {
  try {
    searchBtn.disabled = true;
    showStatus('DINOv2 AI ກຳລັງວິເຄາະຮູບພາບ...', 'loading');
    const t0 = performance.now();
    const image = mode === 'camera' ? await imageFromCamera() : await imageFromFile();
    
    const res = await fetch('/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: image,
        tta: document.getElementById('ttaCheck').checked,
        topk: 6
      })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error || 'ການຄົ້ນຫາລົ້ມເຫຼວ');
    
    const elapsed = Math.round(performance.now() - t0);
    showStatus(`ພົບ ${data.results.length} ລາຍການພາຍໃນ ${elapsed} ms`, 'success');
    
    if (emptyPlaceholder) emptyPlaceholder.classList.add('hidden');
    matchBadge.style.display = 'block';
    matchBadge.textContent = `${data.results.length} ລາຍການ`;
    
    resultsEl.innerHTML = data.results.map((r, i) => {
      const pct = (r.similarity * 100).toFixed(1);
      const scoreClass = r.similarity >= 0.75 ? 'score-high' : (r.similarity >= 0.5 ? 'score-med' : 'score-low');
      const rankClass = i === 0 ? 'rank-1' : (i === 1 ? 'rank-2' : (i === 2 ? 'rank-3' : ''));
      const safeBarcode = escapeHtml(r.barcode);
      const imgHtml = r.image_url 
        ? `<img src="${r.image_url}" alt="${safeBarcode}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
           <div class="no-img" style="display:none; width:100%; height:100%; align-items:center; justify-content:center;">No Image</div>`
        : `<div class="no-img" style="display:flex; width:100%; height:100%; align-items:center; justify-content:center;">No Image</div>`;

      return `
        <div class="result-item">
          <div class="result-rank ${rankClass}">#${i+1}</div>
          <div class="result-img-box">
            ${imgHtml}
          </div>
          <div class="result-meta">
            <div class="barcode-tag">
              <span>${safeBarcode}</span>
              <button class="copy-btn" onclick="copyBarcode('${safeBarcode}')" title="Copy Barcode">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            </div>
            <div class="score-badge ${scoreClass}">
              <span>AI Similarity:</span> <strong>${pct}%</strong>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
  } catch (err) {
    showStatus(err.message, 'error');
  } finally {
    searchBtn.disabled = false;
  }
};

startCamera();
</script>
</body>
</html>
"""

@app.get("/", response_class=HTMLResponse)
def index():
    return PAGE

@app.get("/product-image/{barcode}")
def product_image(barcode: str):
    if not barcode or Path(barcode).name != barcode:
        raise HTTPException(status_code=400, detail="Invalid barcode")
    path = find_product_image(barcode)
    if path is None:
        raise HTTPException(status_code=404, detail="Image not found")
    
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return FileResponse(path, media_type=mime, headers={"Cache-Control": "max-age=3600"})

# ── ZeroGPU support for inference ───────────────────────────────────────────
try:
    import spaces
    has_spaces = True
except ImportError:
    has_spaces = False

def run_search_inference(img, topk, tta):
    s = get_searcher()
    return s.search(img, topk=topk, tta=tta)

if has_spaces:
    run_search_inference = spaces.GPU(duration=15)(run_search_inference)
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/search")
def search(req: SearchRequest):
    try:
        s = get_searcher()
    except Exception as e:
        detail_msg = f"Model load error: {e}"
        if startup_error:
            detail_msg += f" | Trace: {startup_error[-300:]}"
        raise HTTPException(status_code=503, detail=detail_msg)
    
    try:
        if "," in req.image:
            b64 = req.image.split(",", 1)[1]
        else:
            b64 = req.image
            
        img = Image.open(io.BytesIO(base64.b64decode(b64))).convert("RGB")
        
        results, elapsed_ms = run_search_inference(img, req.topk, req.tta)
        
        SUPABASE_STORAGE = "https://avqdpddpomlapxcqxnmk.supabase.co/storage/v1/object/public/product-images"
        for result in results:
            bc = result["barcode"]
            if find_product_image(bc):
                result["image_url"] = "/product-image/" + bc
            else:
                result["image_url"] = f"{SUPABASE_STORAGE}/{bc}.png"
                
        return {"results": results, "server_ms": elapsed_ms}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
