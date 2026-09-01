# Frontend as its own service.
#
# Deploy as a SECOND Railway service from the same repo, Root Directory
# `frontend`, with NEXT_PUBLIC_API_BASE set to the backend's public URL.
FROM node:20-slim

WORKDIR /app

# ALL dependencies, including dev. Next needs TypeScript, Tailwind and PostCSS
# to build — omitting devDependencies here produces a container that installs
# cleanly and then fails to build, which is exactly what happened.
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Next inlines NEXT_PUBLIC_* at build time, so it has to be present now, not
# just at runtime. Changing it later needs a rebuild, not a restart.
ARG NEXT_PUBLIC_API_BASE=""
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE

RUN npm run build

ENV PORT=3000
EXPOSE 3000

# Bind 0.0.0.0 or Railway's proxy can't reach it and every request times out
# with "Application failed to respond".
CMD ["sh", "-c", "npx next start --port ${PORT:-3000} --hostname 0.0.0.0"]
