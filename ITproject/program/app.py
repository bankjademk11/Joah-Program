import os
import uvicorn
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

from main import app as fastapi_app, run_search_inference

# 1. ZeroGPU Inference Handler attached to Gradio
@spaces.GPU(duration=60)
def predict_gpu(image):
    return "ZeroGPU Online & Ready"

# 2. Gradio Blocks with visible input/output component (strictly required by ZeroGPU startup scan)
with gr.Blocks(title="Joah AI Lens Search API") as demo:
    gr.Markdown("# 🔍 Joah AI Lens Search API")
    gr.Markdown("ZeroGPU Backend Active ✓")
    img_in = gr.Image(type="pil", label="Input Image")
    btn = gr.Button("Test Prediction")
    txt_out = gr.Textbox(label="Status")
    btn.click(fn=predict_gpu, inputs=img_in, outputs=txt_out)

# 3. Mount Gradio to FastAPI at /gradio so root /search and / remain purely FastAPI
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
