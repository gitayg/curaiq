FROM node:22

WORKDIR /app

# Server deps only (ws, node-pty, @xterm/*); dev-only @tauri-apps/cli is skipped.
COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN mkdir -p data

ENV PORT=8787
ENV DB_PATH=data/raiseme.db
ENV NODE_ENV=production

EXPOSE 8787
CMD ["node", "--no-warnings", "server/server.js"]
