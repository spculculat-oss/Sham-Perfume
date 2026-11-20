FROM node:22-bookworm-slim
ADD https://raw.githubusercontent.com/spculculat-oss/Sham-Perfume/main/scripts/robots/space-setup.sh /space-setup.sh
RUN bash /space-setup.sh
USER node
ENV HOME=/home/node PORT=7860 ROBOTS_WORK_DIR=/home/node/work
CMD ["bash", "/boot.sh"]
