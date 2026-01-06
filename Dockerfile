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



RUN export $(cat .env.example) && \
    export DOCKER=true && \
    pnpm run build

# Result image
FROM node:lts-alpine AS runtime

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --no-frozen-lockfile

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Create data directory for JSON database
RUN mkdir -p /app/data
VOLUME ["/app/data"]

ENV HOST=0.0.0.0
ENV PORT=4321
ENV DB_PATH=/app/data/posts.json
EXPOSE 4321
CMD node ./dist/server/entry.mjs
