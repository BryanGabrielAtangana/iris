---
name: dockerfile-author
description: Write small, secure, well-layered Dockerfiles and multi-stage builds.
when_to_use: Use when writing or optimizing a Dockerfile or container image build.
when_not_to_use: Use docker-compose tooling for multi-service orchestration instead.
examples:
  - write a dockerfile for a node app
  - make my docker image smaller
  - add a multi-stage build to this dockerfile
  - containerize this python service
tags: [docker, containers, devops, build, image]
version: 1.0.0
license: Apache-2.0
requires:
  code_execution: true
---

# dockerfile-author

Produce a Dockerfile that builds a small, reproducible, non-root image.

## Steps

1. Pick a minimal, pinned base image (e.g. `node:20-slim`, `python:3.12-slim`).
2. Use multi-stage builds: compile/install in a builder, copy only artifacts
   into the runtime stage.
3. Order layers from least to most frequently changing to maximize cache hits;
   copy dependency manifests before source.
4. Run as a non-root user and set a sensible `CMD`/`ENTRYPOINT`.
5. Add a `.dockerignore` to keep build context small.

## Example

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER node
CMD ["node", "dist/index.js"]
```
