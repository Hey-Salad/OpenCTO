# Cheri-ML-1.3B Deployment Evaluation (Hugging Face + OpenVINO)

Model target:
- `https://huggingface.co/HeySalad/Cheri-ML-1.3B`

## 1) Objective

Decide the fastest reliable way to run `HeySalad/Cheri-ML-1.3B` for coding tasks:
- Baseline CPU inference (Transformers)
- OpenVINO-optimized inference
- Optional managed fallback (HF Inference Endpoint)

## 2) Prerequisites

On the server:
- Python 3.10+
- 12+ GB free RAM recommended
- Hugging Face token with access to the model (`HF_TOKEN`)

Set token:
```bash
export HF_TOKEN='hf_...'
```

## 3) Verify Model Access and Metadata

```bash
python3 - <<'PY'
import os
from huggingface_hub import HfApi

token = os.environ.get("HF_TOKEN")
api = HfApi(token=token)
info = api.model_info("HeySalad/Cheri-ML-1.3B")
print("modelId:", info.id)
print("private:", info.private)
print("sha:", info.sha)
print("library_name:", getattr(info, "library_name", None))
print("pipeline_tag:", getattr(info, "pipeline_tag", None))
print("tags:", info.tags[:20])
PY
```

If this fails, token access is not configured correctly.

## 4) Baseline Runtime (Transformers CPU)

```bash
python3 -m venv .venv-cheri
source .venv-cheri/bin/activate
pip install -U pip
pip install "torch>=2.3" "transformers>=4.50" "accelerate>=0.34" "huggingface_hub>=0.25"
```

Quick latency check:
```bash
python3 - <<'PY'
import os, time
from transformers import AutoTokenizer, AutoModelForCausalLM

model_id = "HeySalad/Cheri-ML-1.3B"
tok = AutoTokenizer.from_pretrained(model_id, token=os.environ["HF_TOKEN"])
model = AutoModelForCausalLM.from_pretrained(model_id, token=os.environ["HF_TOKEN"])
prompt = "Write a Python function that debounces a callback."
inputs = tok(prompt, return_tensors="pt")
t0 = time.time()
out = model.generate(**inputs, max_new_tokens=160)
dt = time.time() - t0
print(tok.decode(out[0], skip_special_tokens=True))
print(f"latency_s={dt:.2f}")
PY
```

## 5) OpenVINO Export + Runtime

Install:
```bash
source .venv-cheri/bin/activate
pip install -U "optimum-intel[openvino]" "openvino>=2024.4"
```

Export (try int8 first, then int4 if supported):
```bash
optimum-cli export openvino \
  --model HeySalad/Cheri-ML-1.3B \
  --task text-generation-with-past \
  --quant-mode int8 \
  ov_cheri_int8
```

If int8 fails or is too slow, try:
```bash
optimum-cli export openvino \
  --model HeySalad/Cheri-ML-1.3B \
  --task text-generation-with-past \
  --weight-format int4 \
  ov_cheri_int4
```

Run OpenVINO inference benchmark:
```bash
python3 - <<'PY'
import time
from transformers import AutoTokenizer
from optimum.intel import OVModelForCausalLM

model_dir = "ov_cheri_int8"  # or ov_cheri_int4
tok = AutoTokenizer.from_pretrained(model_dir)
model = OVModelForCausalLM.from_pretrained(model_dir, device="CPU")
prompt = "Generate a TypeScript function that retries failed HTTP calls with exponential backoff."
inputs = tok(prompt, return_tensors="pt")
t0 = time.time()
out = model.generate(**inputs, max_new_tokens=200)
dt = time.time() - t0
print(tok.decode(out[0], skip_special_tokens=True))
print(f"latency_s={dt:.2f}")
PY
```

## 6) Pass/Fail Criteria

Target for usable coding assistant on this server:
- Time to first token: <= 2.5s
- 160 token response: <= 10s
- No OOM or repeated throttling

If these are not met:
- Keep Cheri model for asynchronous/background jobs only
- Use hosted model for interactive responses (OpenAI/GitHub Models/HF Endpoint)

## 7) OpenVINO Fit on Current Host

Observed host:
- CPU: Intel i7-3720QM (older generation, 4 cores / 8 threads)
- RAM: 16 GB

Implication:
- OpenVINO may still reduce latency vs plain PyTorch CPU.
- Gains may be moderate on this older CPU.
- Quantized export (`int8`/`int4`) is strongly recommended.

## 8) Fastest Production Option

If local latency is insufficient:
- Deploy `HeySalad/Cheri-ML-1.3B` as protected Hugging Face Inference Endpoint.
- Keep local backend as orchestrator and route coding tasks to endpoint.
- Keep realtime voice loop on OpenAI/Google; do not block voice UX on local model performance.
