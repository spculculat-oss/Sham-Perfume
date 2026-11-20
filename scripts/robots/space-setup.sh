#!/usr/bin/env bash
# «سيرفر الروبوتات» on a free Hugging Face Space (no card) — what scripts/robots/huggingface/Dockerfile runs while the
# Space builds. The same tools as the root Dockerfile (Render): git, gh, Python for the doctor, the pinned Bun — then
# the start script, taken from GitHub (the site is public: no key is needed to read it).
# Nothing secret here: the keys are the Space's secrets (Settings → Variables and secrets), read only at run time.
set -eu
REPO="${ROBOTS_REPO:-spculculat-oss/Sham-Perfume}"
apt-get update
apt-get install -y --no-install-recommends git ca-certificates python3 python3-requests python3-pip gh curl unzip
rm -rf /var/lib/apt/lists/*
npm install -g bun@1.4.3
npm cache clean --force
curl -fsSL --retry 5 "https://raw.githubusercontent.com/${REPO}/main/scripts/robots/boot.sh" -o /boot.sh
chmod 755 /boot.sh
# A Space runs as the user 1000 («node» in this image): its copy of the site lives in its own home.
mkdir -p /home/node/work
chown -R node:node /home/node
