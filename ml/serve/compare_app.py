#!/usr/bin/env python3
"""
Local drag-and-drop model comparison tool.

A single self-contained app: open the page, drag in a leaf photo, and see your
trained model and the pretrained SigLIP2 model predict side-by-side. Both models
load once at startup, so predictions are fast. No terminal commands per test, no
folders.

Run:
    .conda-py311/bin/python -m ml.serve.compare_app
Then open http://localhost:8050

SigLIP2 is rice-only; for other crops only your model is shown.
"""
import io
import os
import sys
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402
from flask import Flask, request, jsonify, Response  # noqa: E402

from ml.config import CROPS, CONFIDENCE_THRESHOLD  # noqa: E402

SIGLIP_DIR = ROOT / "ml" / "models_pretrained" / "rice_siglip2"
SIGLIP_TO_OURS = {
    "Bacterialblight": "Bacterial Leaf Blight",
    "Blast": "Rice Blast",
    "Brownspot": "Brown Spot",
    "Healthy": "Healthy",
    "Tungro": "Tungro (not in our catalog)",
}

app = Flask(__name__)

# ── lazy model caches (loaded once, reused) ───────────────────────────────
_our_models = {}
_siglip = {}


def get_our_model(crop: str):
    if crop not in _our_models:
        from ml.inference.keras_predictor import KerasPredictor
        _our_models[crop] = KerasPredictor(crop)
    return _our_models[crop]


def get_siglip():
    if "model" not in _siglip:
        import torch
        from transformers import AutoImageProcessor, AutoModelForImageClassification
        _siglip["proc"] = AutoImageProcessor.from_pretrained(str(SIGLIP_DIR))
        _siglip["model"] = AutoModelForImageClassification.from_pretrained(str(SIGLIP_DIR))
        _siglip["model"].eval()
        _siglip["torch"] = torch
    return _siglip


def predict_ours(crop: str, image: Image.Image):
    p = get_our_model(crop)
    res = p.predict(image)
    preds = sorted(res["all_predictions"], key=lambda d: -d["confidence"])
    return {
        "model": "Your model (EfficientNetB0, 8.8MB)",
        "top": res["disease"],
        "confidence": round(res["confidence"] * 100, 1),
        "meets_threshold": bool(res["meets_threshold"]),
        "predictions": [{"label": d["disease"], "pct": round(d["confidence"] * 100, 1)} for d in preds],
    }


def predict_siglip(image: Image.Image):
    s = get_siglip()
    torch = s["torch"]
    inp = s["proc"](images=image.convert("RGB"), return_tensors="pt")
    with torch.no_grad():
        logits = s["model"](**inp).logits[0]
        probs = torch.softmax(logits, dim=-1).tolist()
    id2label = s["model"].config.id2label
    rows = sorted(
        ({"label": SIGLIP_TO_OURS.get(id2label[i], id2label[i]), "pct": round(p * 100, 1)}
         for i, p in enumerate(probs)),
        key=lambda d: -d["pct"],
    )
    return {
        "model": "SigLIP2 (pretrained, 370MB)",
        "top": rows[0]["label"],
        "confidence": rows[0]["pct"],
        "meets_threshold": rows[0]["pct"] >= CONFIDENCE_THRESHOLD * 100,
        "predictions": rows,
    }


@app.route("/compare", methods=["POST"])
def compare():
    crop = request.form.get("crop", "rice")
    if crop not in CROPS:
        return jsonify({"error": f"unknown crop {crop}"}), 400
    file = request.files.get("image")
    if not file:
        return jsonify({"error": "no image uploaded"}), 400
    try:
        image = Image.open(io.BytesIO(file.read())).convert("RGB")
    except Exception as e:
        return jsonify({"error": f"could not read image: {e}"}), 400

    out = {"crop": crop, "ours": predict_ours(crop, image)}
    if crop == "rice" and SIGLIP_DIR.is_dir():
        try:
            out["siglip2"] = predict_siglip(image)
        except Exception as e:
            out["siglip2"] = {"error": str(e)}
    else:
        out["siglip2"] = None  # SigLIP2 is rice-only
    return jsonify(out)


PAGE = """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CropIntel — Model Compare</title>
<style>
  :root{--g:#16a34a;--bg:#f8fafc;--bd:#e2e8f0;--mut:#64748b}
  *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
  body{margin:0;background:var(--bg);color:#0f172a}
  .wrap{max-width:960px;margin:0 auto;padding:24px}
  h1{font-size:22px;margin:0 0 4px} .sub{color:var(--mut);font-size:14px;margin:0 0 20px}
  .bar{display:flex;gap:12px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
  select{padding:9px 12px;border:1px solid var(--bd);border-radius:10px;font-size:15px;background:#fff}
  #drop{border:2px dashed #cbd5e1;border-radius:16px;padding:38px;text-align:center;
    background:#fff;cursor:pointer;transition:.15s;color:var(--mut)}
  #drop.hov{border-color:var(--g);background:#f0fdf4;color:var(--g)}
  #drop b{color:#0f172a}
  .preview{margin-top:16px;text-align:center}
  .preview img{max-height:240px;border-radius:12px;border:1px solid var(--bd)}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:20px}
  @media(max-width:720px){.grid{grid-template-columns:1fr}}
  .card{background:#fff;border:1px solid var(--bd);border-radius:16px;padding:18px}
  .card h3{margin:0 0 2px;font-size:13px;color:var(--mut);text-transform:uppercase;letter-spacing:.04em}
  .top{font-size:24px;font-weight:700;margin:6px 0 2px}
  .conf{font-size:15px;color:var(--g);font-weight:600}
  .badge{display:inline-block;margin-top:8px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}
  .ok{background:#dcfce7;color:#166534}.low{background:#fef3c7;color:#92400e}
  .row{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:14px}
  .row .lab{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .barwrap{flex:1.2;height:8px;background:#eef2f7;border-radius:999px;overflow:hidden}
  .fill{height:100%;background:linear-gradient(90deg,#16a34a,#2563eb);border-radius:999px}
  .pct{width:52px;text-align:right;font-variant-numeric:tabular-nums;color:#334155}
  .na{color:var(--mut);font-size:14px;padding:8px 0}
  .spin{display:none;margin-top:18px;color:var(--mut)}
  .err{color:#b91c1c;margin-top:12px}
</style></head><body><div class="wrap">
<h1>🌱 CropIntel — Model Compare</h1>
<p class="sub">Drag in a leaf photo. See your model vs the pretrained SigLIP2 model side by side. (SigLIP2 is rice-only.)</p>
<div class="bar">
  <label>Crop:&nbsp;</label>
  <select id="crop">__CROP_OPTS__</select>
</div>
<div id="drop"><b>Drop a leaf photo here</b><br>or click to choose &nbsp;·&nbsp; JPG / PNG</div>
<input id="file" type="file" accept="image/*" style="display:none">
<div class="spin" id="spin">⏳ Running models…</div>
<div class="err" id="err"></div>
<div class="preview" id="preview"></div>
<div class="grid" id="grid"></div>
</div>
<script>
const drop=document.getElementById('drop'),file=document.getElementById('file'),
  grid=document.getElementById('grid'),spin=document.getElementById('spin'),
  err=document.getElementById('err'),preview=document.getElementById('preview'),
  cropSel=document.getElementById('crop');
drop.onclick=()=>file.click();
['dragover','dragenter'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('hov')}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('hov')}));
drop.addEventListener('drop',ev=>{if(ev.dataTransfer.files[0])send(ev.dataTransfer.files[0])});
file.addEventListener('change',()=>{if(file.files[0])send(file.files[0])});
function esc(v){
  return String(v ?? '').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function card(r){
  if(!r) return `<div class="card"><h3>SigLIP2 (pretrained)</h3><div class="na">Only available for rice.</div></div>`;
  if(r.error) return `<div class="card"><h3>Model</h3><div class="err">${esc(r.error)}</div></div>`;
  const rows=r.predictions.map(p=>{
    const pct=Math.max(0,Math.min(100,Number(p.pct)||0)).toFixed(1);
    return `<div class="row"><div class="lab">${esc(p.label)}</div>
    <div class="barwrap"><div class="fill" style="width:${pct}%"></div></div>
    <div class="pct">${pct}%</div></div>`;
  }).join('');
  const badge=r.meets_threshold?`<span class="badge ok">confident</span>`:`<span class="badge low">low confidence</span>`;
  return `<div class="card"><h3>${esc(r.model)}</h3>
    <div class="top">${esc(r.top)}</div><div class="conf">${esc(r.confidence)}%</div> ${badge}${rows}</div>`;
}
function send(f){
  err.textContent='';grid.innerHTML='';spin.style.display='block';
  preview.textContent='';
  const img=document.createElement('img');img.src=URL.createObjectURL(f);preview.appendChild(img);
  const fd=new FormData();fd.append('image',f);fd.append('crop',cropSel.value);
  fetch('/compare',{method:'POST',body:fd}).then(r=>r.json()).then(d=>{
    spin.style.display='none';
    if(d.error){err.textContent=d.error;return;}
    grid.innerHTML=card(d.ours)+card(d.siglip2);
  }).catch(e=>{spin.style.display='none';err.textContent=e});
}
</script></body></html>"""


@app.route("/")
def index():
    opts = "".join(
        f'<option value="{c}"{" selected" if c=="rice" else ""}>{c.capitalize()}</option>'
        for c in CROPS
    )
    return Response(PAGE.replace("__CROP_OPTS__", opts), mimetype="text/html")


if __name__ == "__main__":
    port = int(os.environ.get("COMPARE_PORT", "8050"))
    print(f"\n  CropIntel model-compare running:  http://localhost:{port}")
    print(f"  (phone on same Wi-Fi:             http://<your-ip>:{port})\n")
    app.run(host="0.0.0.0", port=port, debug=False)
