# Build stage
FROM public.ecr.aws/docker/library/node:20-slim AS builder
WORKDIR /usr/src/app
COPY ./src/ ./src/
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install
RUN npm run build

# Runtime stage
FROM public.ecr.aws/docker/library/node:20-slim
WORKDIR /usr/src/app

# Install curl
RUN apt-get update && apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --production
COPY --from=builder /usr/src/app/dist ./dist
EXPOSE 80
ENV PORT=80
CMD ["node", "dist/server.js"]
