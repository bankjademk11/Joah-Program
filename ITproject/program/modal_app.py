from pathlib import Path
import modal

APP_DIR = Path(__file__).resolve().parent

# Define Modal App
app = modal.App("joah-lens-search")

# Define Container Image with Debian Slim + System libs + Python packages
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("git", "ffmpeg", "libsm6", "libxext6")
    .pip_install(
        "fastapi[standard]>=0.112.0",
        "uvicorn>=0.23.0",
        "pydantic>=2.0.0",
        "torch>=2.0.0",
        "torchvision>=0.15.0",
        "open_clip_torch>=2.24.0",
        "faiss-cpu>=1.7.4",
        "Pillow>=10.0.0",
        "numpy>=1.24.0",
        "tqdm>=4.66.0",
        "rembg>=2.0.57",
        "onnxruntime>=1.17.0"
    )
    # Pre-cache AI weights during image build so cold-start doesn't redownload them
    .run_commands(
        'python3 -c "import torch; torch.hub.load(\'facebookresearch/dinov2\', \'dinov2_vitl14\')"',
        'python3 -c "from rembg import new_session; new_session(\'u2netp\')"'
    )
    # Bundle index files and backend code into the container
    .add_local_dir(str(APP_DIR / "index_data"), remote_path="/root/index_data")
    .add_local_file(str(APP_DIR / "models.py"), remote_path="/root/models.py")
    .add_local_file(str(APP_DIR / "preprocess_utils.py"), remote_path="/root/preprocess_utils.py")
    .add_local_file(str(APP_DIR / "search_image.py"), remote_path="/root/search_image.py")
    .add_local_file(str(APP_DIR / "main.py"), remote_path="/root/main.py")
)

@app.function(
    image=image,
    cpu=4.0,
    memory=8192,
    timeout=300,
    scaledown_window=180,
)
@modal.asgi_app()
def fastapi_app():
    import sys
    import os

    # Ensure python imports from /root where code and index_data reside
    if "/root" not in sys.path:
        sys.path.insert(0, "/root")
    os.chdir("/root")

    from main import app as web_app, get_searcher
    
    # Warm up searcher immediately so first HTTP request is instantaneous
    print("Warming up ProductSearcher inside container...")
    try:
        get_searcher()
        print("ProductSearcher pre-warmed successfully!")
    except Exception as e:
        print(f"Warning: Failed to pre-warm searcher: {e}")

    return web_app
