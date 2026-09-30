"""
Hugging Face Spaces entry point — ZeroGPU compatible.
Uses @spaces.GPU to satisfy HF's ZeroGPU requirement,
then runs FastAPI with uvicorn on port 7860.
"""
import os
import uvicorn

# ── ZeroGPU: HF Spaces kills apps without @spaces.GPU ────────────────────────
try:
    import spaces

    @spaces.GPU(duration=1)
    def _warmup():
        """Registered GPU function — satisfies ZeroGPU startup check."""
        pass

    _warmup()
    print("ZeroGPU: warmup complete ✓")
except Exception as e:
    print(f"ZeroGPU not active (CPU mode): {e}")
# ─────────────────────────────────────────────────────────────────────────────

from main import app  # FastAPI app with CORS + /search + /settings.json stubs

if __name__ == "__main__":
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
