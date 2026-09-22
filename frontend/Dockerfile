# ==============================================================================
# Stage 1: Dependencies - Install node modules with package caching
# ==============================================================================
FROM node:22-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install


# ==============================================================================
# Stage 2: Builder - Compile TanStack Start SSR application via Nitro
# ==============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy cached dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables (injected into client bundles)
ARG VITE_API_URL=""
ARG VITE_AUTH0_DOMAIN=""
ARG VITE_AUTH0_CLIENT_ID=""
ARG VITE_AUTH0_AUDIENCE=""
ARG VITE_USE_SSL="false"

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_AUTH0_DOMAIN=${VITE_AUTH0_DOMAIN} \
    VITE_AUTH0_CLIENT_ID=${VITE_AUTH0_CLIENT_ID} \
    VITE_AUTH0_AUDIENCE=${VITE_AUTH0_AUDIENCE} \
    VITE_USE_SSL=${VITE_USE_SSL} \
    NODE_ENV=production \
    NITRO_PRESET=node-server

# Build the production server bundle (.output)
RUN npm run build


# ==============================================================================
# Stage 3: Runner - Minimal Node.js runtime container
# ==============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Create non-root system user and group
RUN addgroup -g 10001 -S opportune && \
    adduser -u 10001 -S opportune -G opportune

# Copy only the compiled output directory from builder stage
COPY --from=builder --chown=opportune:opportune /app/.output ./.output

USER opportune

EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Start the Nitro standalone server
CMD ["node", ".output/server/index.mjs"]
