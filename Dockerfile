# «سيرفر الروبوتات» on Render — Node 22 (.nvmrc), the pinned Bun (package.json), git, gh, Python for the doctor.
# At the repository root so Render finds it by itself (New → Web Service → Docker, no path to type).
# The site itself is not baked in: boot.sh takes a fresh copy from GitHub when the server starts, and
# .dockerignore sends Render nothing but boot.sh.
FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates python3 python3-requests python3-pip gh curl unzip \
 && rm -rf /var/lib/apt/lists/* \
 && npm install -g bun@1.4.3 \
 && npm cache clean --force
COPY scripts/robots/boot.sh /boot.sh
CMD ["bash", "/boot.sh"]
