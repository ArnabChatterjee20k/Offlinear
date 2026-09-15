# Offlinear as one deployable unit: build the web app, then a Bun server serves
# the static build AND the gh-CLI API (/api/gh). GitHub access via GH_TOKEN or a
# mounted, signed-in gh CLI.
#
#   docker build \
#     --build-arg VITE_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1 \
#     --build-arg VITE_APPWRITE_PROJECT_ID=... \
#     --build-arg VITE_APPWRITE_DATABASE_ID=... \
#     -t offlinear .
#   docker run --rm -p 8788:8788 -e GH_TOKEN=ghp_xxx offlinear

# --- build the web app ---
FROM node:20-slim AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
ARG VITE_APPWRITE_ENDPOINT=""
ARG VITE_APPWRITE_PROJECT_ID=""
ARG VITE_APPWRITE_DATABASE_ID="offlinear"
ARG VITE_GH_BRIDGE_URL="/api/gh"
ENV VITE_APPWRITE_ENDPOINT=$VITE_APPWRITE_ENDPOINT \
    VITE_APPWRITE_PROJECT_ID=$VITE_APPWRITE_PROJECT_ID \
    VITE_APPWRITE_DATABASE_ID=$VITE_APPWRITE_DATABASE_ID \
    VITE_GH_BRIDGE_URL=$VITE_GH_BRIDGE_URL
RUN pnpm --filter @offlinear/web build

# --- runtime: Bun + gh CLI serving dist + api ---
FROM oven/bun:1
RUN apt-get update && apt-get install -y --no-install-recommends curl gpg ca-certificates \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
     | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
     > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y --no-install-recommends gh \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/server/server.ts ./server.ts
COPY --from=build /repo/apps/web/dist ./dist
ENV WEB_DIST=/app/dist PORT=8788
EXPOSE 8788
CMD ["bun", "run", "server.ts"]
