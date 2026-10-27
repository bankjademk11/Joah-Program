import os
import uvicorn

# ── ZeroGPU: HF Spaces scanner checks for @spaces.GPU at top-level ───────────
try:
    import spaces
except ImportError:
    class MockSpaces:
        def GPU(self, *args, **kwargs):
            if args and callable(args[0]):
                return args[0]
            def dec(f):
                return f
            return dec
    spaces = MockSpaces()

@spaces.GPU
def zero_gpu_entrypoint():
    """Top-level ZeroGPU hook for Hugging Face startup scanner."""
    pass
# ─────────────────────────────────────────────────────────────────────────────

from main import app  # FastAPI app with CORS + /search + /settings.json stubs

if __name__ == "__main__":
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
