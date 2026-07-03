FROM node:20-slim
WORKDIR /app
COPY web/package.json web/package-lock.json* ./
RUN npm install
COPY web/ ./
EXPOSE 3000
ENV NEXT_TELEMETRY_DISABLED=1
# dev 模式提供 AudioWorklet 熱更新 (production build 在受限容器可能受 worker spawn 影響)。
CMD ["npx", "next", "dev", "-p", "3000"]
