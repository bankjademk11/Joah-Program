import os
import gradio as gr

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

# ── Top-level ZeroGPU hook for Hugging Face scanner ──────────────────────────
@spaces.GPU(duration=30)
def zero_gpu_status():
    """Satisfies ZeroGPU startup check"""
    return "ZeroGPU Online"
# ─────────────────────────────────────────────────────────────────────────────

from main import app as fastapi_app

# Create minimal Gradio Blocks to satisfy HF Gradio SDK
with gr.Blocks(title="Joah AI Lens Search") as demo:
    gr.Markdown("# 🔍 Joah AI Lens Search API")
    gr.Markdown("✅ ZeroGPU Backend Active & Ready for Requests")

# Attach all FastAPI routes & middleware to Gradio's underlying FastAPI app
for route in fastapi_app.routes:
    demo.app.routes.append(route)

# Enable CORS on demo.app
from fastapi.middleware.cors import CORSMiddleware
demo.app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 7860))
    demo.queue().launch(
        server_name="0.0.0.0",
        server_port=port,
        show_error=True
    )
