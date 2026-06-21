# Dockerfile for the Gunscape dedicated server (Fly.io / any container host).
# Builds from the repo root so the server can also serve the static client.
FROM node:24-alpine
WORKDIR /app

# install only the server's dependencies (ws), cached on package files
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# copy the rest of the repo (client + shared/ + server/), minus .dockerignore'd paths
COPY . .

ENV PORT=8787 HOST=0.0.0.0 ACCOUNTS_FILE=/data/accounts.json
EXPOSE 8787
CMD ["node", "server/server.js"]
