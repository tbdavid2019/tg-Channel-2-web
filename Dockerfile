FROM node:lts-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml ./

FROM base AS build-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --no-frozen-lockfile

FROM build-deps AS build
COPY . .



RUN export $(grep -v '^#' .env.example | xargs) && \
    export DOCKER=true && \
    pnpm run build

# Result image
FROM node:lts-alpine AS runtime

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache su-exec && corepack enable

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --no-frozen-lockfile

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# Create data directory for JSON database and set permissions
RUN mkdir -p /app/data && chown -R node:node /app && chmod +x /usr/local/bin/docker-entrypoint.sh

VOLUME ["/app/data"]

ENV HOST=0.0.0.0
ENV PORT=4321
ENV DB_PATH=/app/data/posts.json
EXPOSE 4321

USER root
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "./dist/server/entry.mjs"]
