#!/usr/bin/env python3
"""
«مختبر عقل شاهين» — trains Shaheen's own small brain on a free GPU (Kaggle or Google Colab).

What it does, start to end (one command, see SHAHEEN_BRAIN.md):
  1. downloads the training files the weekly robot published (GitHub release «shaheen-brain-data») and checks
     their SHA-256 against the data card;
  2. fine-tunes an open model with LoRA (PyTorch + Transformers + PEFT) — only a small set of extra weights is
     trained, so one free GPU (T4 / P100, 16 GB) is enough. The loss is on Shaheen's answers only;
  3. merges the LoRA weights, converts the model to GGUF and quantises it (llama.cpp, pinned release, checked by
     SHA-256) — the format the robots already run on a plain CPU;
  4. uploads it to YOUR Hugging Face repo with latest.json (name, link, SHA-256). The robot «امتحان عقل شاهين»
     (.github/workflows/shaheen-brain.yml) then examines it against the current brain; it replaces the current one
     only if it is honest and at least as good.

Keys: the Hugging Face token comes from the environment (HF_TOKEN — a Kaggle/Colab secret). It is never printed,
never written to a file, and never belongs in the repository or in a chat.

Base models: only open licences that allow commercial use (Apache-2.0). Qwen2.5-3B/72B are NOT allowed (their
licence is not Apache-2.0).

    python scripts/shaheen-brain/train_lora.py --hf-repo YOUR_NAME/shaheen-brain
    python scripts/shaheen-brain/train_lora.py --dry-run          # checks the data only, no GPU, no download of models
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request
from pathlib import Path

RELEASE = "https://github.com/spculculat-oss/Sham-Perfume/releases/download/shaheen-brain-data"
ALLOWED_BASES = {
    # model id: licence
    "Qwen/Qwen2.5-0.5B-Instruct": "apache-2.0",
    "Qwen/Qwen2.5-1.5B-Instruct": "apache-2.0",
    "Qwen/Qwen2.5-7B-Instruct": "apache-2.0",
}
LLAMA_BUILD = "b11790"
LLAMA_SHA256 = "0e2b856ca192699fdb5c8dfe591b7896d658760bcdd48f133322236cd311c455"
LORA_TARGETS = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]


def say(text: str) -> None:
    print(f"[عقل شاهين] {text}", flush=True)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as r, dest.open("wb") as f:
        shutil.copyfileobj(r, f)
    return dest


# ───── data ─────

def load_data(work: Path, local: str | None) -> tuple[list[dict], list[dict], dict]:
    """Training rows, exam rows (for the eval loss only) and the data card, fingerprints checked."""
    src = Path(local) if local else work / "data"
    if not local:
        for name in ("shaheen-card.json", "shaheen-train.jsonl", "shaheen-eval.jsonl"):
            say(f"تحميل {name}")
            download(f"{RELEASE}/{name}", src / name)
    card = json.loads((src / "shaheen-card.json").read_text(encoding="utf-8"))
    for part in ("train", "eval"):
        got = hashlib.sha256((src / f"shaheen-{part}.jsonl").read_bytes()).hexdigest()
        if got != card["sha256"][part]:
            sys.exit(f"بصمة ملف {part} مش مطابقة لبطاقة البيانات — وقفت عشان مانتدربش على بيانات غلط")
    read = lambda p: [json.loads(line) for line in p.read_text(encoding="utf-8").splitlines() if line.strip()]
    return read(src / "shaheen-train.jsonl"), read(src / "shaheen-eval.jsonl"), card


def check_rows(rows: list[dict]) -> None:
    """Every example: one system message, then user/assistant turns alternating, ending with Shaheen's answer."""
    for r in rows:
        roles = [m["role"] for m in r["messages"]]
        if roles[0] != "system" or roles[-1] != "assistant" or len(roles) < 3:
            sys.exit(f"مثال {r.get('id')} شكله غلط: {roles}")
        for i, role in enumerate(roles[1:]):
            if role != ("user" if i % 2 == 0 else "assistant"):
                sys.exit(f"مثال {r.get('id')}: الأدوار مش متبادلة: {roles}")
        if any(not m["content"].strip() for m in r["messages"]):
            sys.exit(f"مثال {r.get('id')} فيه رسالة فاضية")


def tokens(tokenizer, messages: list[dict], open_turn: bool) -> list[int]:
    """Chat template as text, then token ids (works the same on every Transformers version)."""
    text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=open_turn)
    return list(tokenizer(text, add_special_tokens=False)["input_ids"])


def encode(tokenizer, messages: list[dict], max_len: int) -> dict | None:
    """Token ids with labels on Shaheen's answers only (prompt and user turns are masked with -100)."""
    ids: list[int] = []
    labels: list[int] = []
    for i, m in enumerate(messages):
        if m["role"] != "assistant":
            continue
        prefix = tokens(tokenizer, messages[:i], True)
        full = tokens(tokenizer, messages[: i + 1], False)
        if full[: len(prefix)] != prefix:  # the template must grow by appending; otherwise skip the example
            return None
        start = len(ids)
        ids = list(full)
        labels = labels + [-100] * (len(prefix) - start) + list(full[len(prefix):])
        labels = labels[: len(ids)]
    if not ids or all(l == -100 for l in labels):
        return None
    if len(ids) > max_len:
        ids, labels = ids[:max_len], labels[:max_len]
        if all(l == -100 for l in labels):
            return None
    return {"input_ids": ids, "labels": labels, "attention_mask": [1] * len(ids)}


# ───── training ─────

def train(args, train_rows, eval_rows, work: Path) -> Path:
    import torch
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments

    if not torch.cuda.is_available():
        sys.exit("مفيش كارت شاشة (GPU). في Kaggle: Settings ← Accelerator ← GPU. في Colab: Runtime ← Change runtime type ← GPU.")
    tok = AutoTokenizer.from_pretrained(args.base)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token

    enc = lambda rows: [e for e in (encode(tok, r["messages"], args.max_len) for r in rows) if e]
    train_set, eval_set = enc(train_rows), enc(eval_rows)
    say(f"أمثلة التدريب بعد التجهيز: {len(train_set)} — الامتحان: {len(eval_set)}")

    bf16 = torch.cuda.is_bf16_supported()
    dtype = torch.bfloat16 if bf16 else torch.float16
    kwargs = {"torch_dtype": dtype}
    if args.qlora:
        from transformers import BitsAndBytesConfig
        kwargs["quantization_config"] = BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=dtype, bnb_4bit_use_double_quant=True)
        kwargs["device_map"] = {"": 0}
    model = AutoModelForCausalLM.from_pretrained(args.base, **kwargs)
    if args.qlora:
        model = prepare_model_for_kbit_training(model)
    else:
        model = model.to("cuda")
    model.gradient_checkpointing_enable()
    model.config.use_cache = False
    model = get_peft_model(model, LoraConfig(r=args.lora_r, lora_alpha=args.lora_r * 2, lora_dropout=0.05, target_modules=LORA_TARGETS, task_type="CAUSAL_LM"))
    model.print_trainable_parameters()

    def collate(batch):
        width = max(len(b["input_ids"]) for b in batch)
        pad = lambda seq, value: seq + [value] * (width - len(seq))
        return {
            "input_ids": torch.tensor([pad(b["input_ids"], tok.pad_token_id) for b in batch]),
            "labels": torch.tensor([pad(b["labels"], -100) for b in batch]),
            "attention_mask": torch.tensor([pad(b["attention_mask"], 0) for b in batch]),
        }

    targs = TrainingArguments(
        output_dir=str(work / "checkpoints"), num_train_epochs=args.epochs, learning_rate=args.lr,
        per_device_train_batch_size=args.batch, per_device_eval_batch_size=args.batch,
        gradient_accumulation_steps=max(1, 16 // args.batch), warmup_ratio=0.03, lr_scheduler_type="cosine",
        logging_steps=20, eval_strategy="epoch", save_strategy="no", report_to=[],
        bf16=bf16, fp16=not bf16, gradient_checkpointing=True, remove_unused_columns=False, seed=7,
    )
    trainer = Trainer(model=model, args=targs, train_dataset=train_set, eval_dataset=eval_set, data_collator=collate)
    started = time.time()
    trainer.train()
    metrics = trainer.evaluate()
    say(f"خلص التدريب في {int((time.time() - started) / 60)} دقيقة — خسارة الامتحان {metrics.get('eval_loss', 0):.3f}")
    adapter = work / "adapter"
    model.save_pretrained(adapter)
    tok.save_pretrained(adapter)

    # Merge on the GPU in half precision (a 4-bit model cannot be merged: reload the base in full half precision).
    del model, trainer
    torch.cuda.empty_cache()
    from peft import PeftModel
    base = AutoModelForCausalLM.from_pretrained(args.base, torch_dtype=torch.float16)
    merged = PeftModel.from_pretrained(base, adapter).merge_and_unload()
    out = work / "merged"
    merged.save_pretrained(out, safe_serialization=True)
    tok.save_pretrained(out)
    (work / "metrics.json").write_text(json.dumps(metrics, indent=1), encoding="utf-8")
    return out


# ───── GGUF ─────

def to_gguf(merged: Path, work: Path, quant: str) -> Path:
    llama = work / "llama.cpp"
    if not llama.exists():
        subprocess.run(["git", "clone", "--depth", "1", "--branch", LLAMA_BUILD, "https://github.com/ggml-org/llama.cpp", str(llama)], check=True)
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "-r", str(llama / "requirements" / "requirements-convert_hf_to_gguf.txt")], check=True)
    f16 = work / "shaheen-f16.gguf"
    subprocess.run([sys.executable, str(llama / "convert_hf_to_gguf.py"), str(merged), "--outtype", "f16", "--outfile", str(f16)], check=True)

    tgz = download(f"https://github.com/ggml-org/llama.cpp/releases/download/{LLAMA_BUILD}/llama-{LLAMA_BUILD}-bin-ubuntu-x64.tar.gz", work / "llama-bin.tgz")
    if sha256_file(tgz) != LLAMA_SHA256:
        sys.exit("بصمة llama.cpp مش مطابقة — وقفت")
    bins = work / "llama-bin"
    with tarfile.open(tgz) as t:
        t.extractall(bins)
    quantize = next(bins.rglob("llama-quantize"))
    quantize.chmod(0o755)
    env = dict(os.environ, LD_LIBRARY_PATH=f"{quantize.parent}:{os.environ.get('LD_LIBRARY_PATH', '')}")
    stamp = time.strftime("%Y%m%d-%H%M")
    out = work / f"shaheen-brain-{stamp}-{quant.lower()}.gguf"
    subprocess.run([str(quantize), str(f16), str(out), quant.upper()], check=True, env=env)
    f16.unlink(missing_ok=True)
    return out


# ───── publish ─────

def publish(gguf: Path, repo: str, base: str, card: dict, work: Path) -> dict:
    from huggingface_hub import HfApi

    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        sys.exit("مفتاح Hugging Face مش موجود: ضيفه كـ Secret باسم HF_TOKEN في Kaggle أو Colab (ماتكتبوش في الكود ولا في الشات)")
    api = HfApi(token=token)
    api.create_repo(repo, repo_type="model", exist_ok=True, private=False)
    digest = sha256_file(gguf)
    name = gguf.stem.replace("_", "-")[:80]
    url = f"https://huggingface.co/{repo}/resolve/main/{gguf.name}"
    latest = {"name": name, "url": url, "sha256": digest, "base": base, "license": ALLOWED_BASES[base],
              "dataset": card["sha256"], "trainedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    readme = (
        f"---\nlicense: {ALLOWED_BASES[base]}\nbase_model: {base}\nlanguage: [ar, en]\ntags: [gguf, lora, sham-perfume]\n---\n"
        f"# Shaheen brain ({name})\n\nLoRA fine-tune of `{base}` on the Sham Perfumes assistant's reviewed knowledge "
        f"({card['train']} examples; no personal data, no prices). Quantised GGUF for llama.cpp.\n\nSHA-256: `{digest}`\n"
    )
    say(f"رفع {gguf.name} ({gguf.stat().st_size // (1 << 20)} ميجا) على {repo}")
    api.upload_file(path_or_fileobj=str(gguf), path_in_repo=gguf.name, repo_id=repo)
    api.upload_file(path_or_fileobj=json.dumps(latest, indent=1).encode(), path_in_repo="latest.json", repo_id=repo)
    api.upload_file(path_or_fileobj=readme.encode(), path_in_repo="README.md", repo_id=repo)
    (work / "latest.json").write_text(json.dumps(latest, indent=1), encoding="utf-8")
    return latest


def main() -> None:
    p = argparse.ArgumentParser(description="Train Shaheen's own brain (LoRA → GGUF → Hugging Face)")
    p.add_argument("--base", default="Qwen/Qwen2.5-1.5B-Instruct", choices=sorted(ALLOWED_BASES))
    p.add_argument("--hf-repo", default=os.environ.get("HF_REPO", ""), help="YOUR_NAME/shaheen-brain")
    p.add_argument("--data", default=None, help="a local folder with shaheen-train.jsonl, shaheen-eval.jsonl, shaheen-card.json")
    p.add_argument("--work", default="./shaheen-brain-work")
    p.add_argument("--epochs", type=float, default=2.0)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--batch", type=int, default=2)
    p.add_argument("--max-len", type=int, default=1024)
    p.add_argument("--lora-r", type=int, default=16)
    p.add_argument("--qlora", action="store_true", help="4-bit base (needed for the 7B model on a 16 GB GPU)")
    p.add_argument("--quant", default="Q4_K_M")
    p.add_argument("--dry-run", action="store_true", help="check the data only")
    args = p.parse_args()
    # Kaggle gives two T4 cards: LoRA with gradient checkpointing is simpler and safer on one (no DataParallel).
    os.environ.setdefault("CUDA_VISIBLE_DEVICES", "0")

    if args.base.endswith("7B-Instruct") and not args.qlora:
        args.qlora = True
        say("نموذج 7B: هشغّل التدريب بنسخة 4-بت (QLoRA) عشان يكفيه كارت 16 جيجا")
    work = Path(args.work).resolve()
    work.mkdir(parents=True, exist_ok=True)
    train_rows, eval_rows, card = load_data(work, args.data)
    check_rows(train_rows)
    check_rows(eval_rows)
    say(f"البيانات سليمة: {len(train_rows)} مثال للتدريب و{len(eval_rows)} للامتحان (البصمة مطابقة)")
    if args.dry_run:
        return
    if not args.hf_repo or "/" not in args.hf_repo:
        sys.exit("اكتب اسم المستودع على Hugging Face: --hf-repo YOUR_NAME/shaheen-brain")
    merged = train(args, train_rows, eval_rows, work)
    gguf = to_gguf(merged, work, args.quant)
    latest = publish(gguf, args.hf_repo, args.base, card, work)
    say("خلاص! العقل الجديد اترفع. روبوت «امتحان عقل شاهين» هيمتحنه، ولو نجح يبقى المعلم الجديد.")
    say(f"الاسم: {latest['name']}")
    say(f"الرابط: {latest['url']}")
    say(f"البصمة: {latest['sha256']}")


if __name__ == "__main__":
    main()
