#!/usr/bin/env bash
# «المعلم المحلي» — an open model running on the GitHub Actions runner itself: no key, no account, no paid service.
# It teaches «مدرسة شاهين» (scripts/shaheen-school/run.mts) the questions Shaheen cannot answer by himself yet.
#   - llama.cpp's server (a pinned release, checked by its SHA-256) — OpenAI-compatible at http://127.0.0.1:8080/v1;
#   - an open-weights model in GGUF (default Qwen2.5-7B-Instruct, Apache-2.0: commercial use allowed), checked by
#     its SHA-256 when TEACHER_MODEL_SHA256 is set.
# Outputs (step outputs, never global env, so the regression tests never see a model server): base_url, model.
# Any failure leaves the outputs empty: the school then studies with the AI keys, or waits — it never fakes answers.
set -uo pipefail

LLAMA_BUILD="${LLAMA_BUILD:?}"
LLAMA_SHA256="${LLAMA_SHA256:?}"
MODEL_URL="${TEACHER_MODEL_URL:?}"
MODEL_SHA256="${TEACHER_MODEL_SHA256:-}"
MODEL_NAME="${TEACHER_MODEL_NAME:-qwen2.5-7b-instruct}"
DIR="${RUNNER_TEMP:-/tmp}/teacher"
OUT="${GITHUB_OUTPUT:-/dev/null}"
mkdir -p "$DIR"

fail() { echo "::warning title=المعلم المحلي::$1 — المدرسة هتذاكر بالمفاتيح لو شغالة، أو تستنى المرة الجاية."; exit 0; }

echo "::group::llama.cpp ${LLAMA_BUILD}"
curl -fsSL --retry 3 -o "$DIR/llama.tgz" \
  "https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_BUILD}/llama-${LLAMA_BUILD}-bin-ubuntu-x64.tar.gz" || fail "تحميل llama.cpp فشل"
echo "${LLAMA_SHA256}  $DIR/llama.tgz" | sha256sum -c - || fail "بصمة llama.cpp مش مطابقة"
tar -xzf "$DIR/llama.tgz" -C "$DIR" || fail "فك llama.cpp فشل"
SERVER="$(find "$DIR" -type f -name llama-server | head -n 1)"
[ -n "$SERVER" ] || fail "llama-server مش موجود في الحزمة"
chmod +x "$SERVER"
export LD_LIBRARY_PATH="$(dirname "$SERVER")${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
"$SERVER" --version 2>&1 | head -n 3 || true
echo "::endgroup::"

echo "::group::Model ${MODEL_NAME}"
started=$(date +%s)
curl -fSL --retry 3 --retry-delay 5 -o "$DIR/model.gguf" "$MODEL_URL" 2>&1 | tail -n 2 || fail "تحميل النموذج فشل"
actual="$(sha256sum "$DIR/model.gguf" | cut -d' ' -f1)"
if [ -n "$MODEL_SHA256" ]; then
  [ "$actual" = "$MODEL_SHA256" ] || fail "بصمة النموذج مش مطابقة (${actual})"
else
  echo "::notice title=المعلم المحلي::بصمة النموذج ${actual} — ثبّتها في TEACHER_MODEL_SHA256"
fi
echo "Downloaded $(du -h "$DIR/model.gguf" | cut -f1) in $(( $(date +%s) - started ))s"
echo "::endgroup::"

THREADS="$(nproc)"
nohup "$SERVER" -m "$DIR/model.gguf" --host 127.0.0.1 --port 8080 -c "${TEACHER_CONTEXT:-6144}" -t "$THREADS" -np 1 \
  > "$DIR/server.log" 2>&1 &
echo $! > "$DIR/server.pid"
for _ in $(seq 1 120); do
  if curl -fs http://127.0.0.1:8080/health >/dev/null 2>&1; then
    echo "::notice title=المعلم المحلي::جاهز — ${MODEL_NAME} على ${THREADS} أنوية، من غير مفتاح ولا حساب"
    { echo "base_url=http://127.0.0.1:8080/v1"; echo "model=${MODEL_NAME}"; } >> "$OUT"
    exit 0
  fi
  if ! kill -0 "$(cat "$DIR/server.pid")" 2>/dev/null; then tail -n 20 "$DIR/server.log"; fail "السيرفر وقف وهو بيبدأ"; fi
  sleep 3
done
tail -n 20 "$DIR/server.log"
fail "السيرفر ما بقاش جاهز خلال 6 دقايق"
