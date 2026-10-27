import urllib.request
import json
import base64
import os
import sys

IMAGE_PATH = r"C:\Users\ideapad sl 3i\.gemini\antigravity-ide\brain\e836a686-a7e9-4cf7-9b14-04bd2f80277e\.tempmediaStorage\media_1793073960994.png"
API_URL = "https://respondent-poor-mae-charger.trycloudflare.com"

def check_status():
    try:
        res = urllib.request.urlopen("https://huggingface.co/api/spaces/bankjademk11/joah-lens-search", timeout=10)
        data = json.loads(res.read())
        rt = data.get("runtime", {})
        print(f"Status: {rt.get('stage')} | Hardware: {rt.get('hardware')} | Error: {rt.get('errorMessage')}")
        return rt.get("stage") == "RUNNING"
    except Exception as e:
        print(f"Check status error: {e}")
        return False

def test_search():
    if not os.path.exists(IMAGE_PATH):
        print(f"Image not found at {IMAGE_PATH}")
        return
    
    with open(IMAGE_PATH, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    
    payload = json.dumps({
        "image": f"data:image/png;base64,{b64}",
        "topk": 5,
        "tta": False,
        "remove_bg": True
    }).encode("utf-8")
    
    req = urllib.request.Request(
        f"{API_URL}/search",
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "Mozilla/5.0"}
    )
    
    print(f"Sending /search request with remove_bg=True to {API_URL}...")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
            print("=== SUCCESS ===")
            print(f"Server processing time: {data.get('server_ms')} ms")
            print(f"Background removed: {data.get('bg_removed')}")
            print(f"Processed image preview returned: {bool(data.get('processed_image'))}")
            print(f"Total results: {len(data.get('results', []))}")
            if data.get("results"):
                for idx, r in enumerate(data["results"][:3], 1):
                    print(f"  {idx}. Barcode: {r.get('barcode')} | Score: {r.get('score', 0):.4f}")
    except Exception as e:
        print(f"Search request failed: {e}")

if __name__ == "__main__":
    test_search()
