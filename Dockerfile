# docs.vmnodes.com: static docs and a dependency-free node server.
# The site is built BEFORE this image (node build.mjs), so the image holds
# only what was guarded and link-checked: dist/, server.js, package.json.
FROM node:22-alpine@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
WORKDIR /app

# Nothing is installed at run time, so the package managers go: they are
# where a node image's known security findings live.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
      /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*

ARG BUILD_COMMIT
RUN case "$BUILD_COMMIT" in \
      "") echo "BUILD_COMMIT is empty: add --build-arg BUILD_COMMIT=\$(git rev-parse HEAD)" >&2; exit 1 ;; \
      *[!0-9a-f]*) echo "BUILD_COMMIT must be a lowercase git commit id, got: $BUILD_COMMIT" >&2; exit 1 ;; \
    esac; \
    if [ "${#BUILD_COMMIT}" != 40 ]; then echo "BUILD_COMMIT must be the full 40 characters, got ${#BUILD_COMMIT}" >&2; exit 1; fi
ENV BUILD_COMMIT=$BUILD_COMMIT

COPY package.json server.js ./
COPY dist ./dist

EXPOSE 3000
USER node
CMD ["node", "server.js"]
