FROM debian:bookworm-slim

# Install texlive-full + latexmk + node for the API server
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-full \
    latexmk \
    nodejs \
    npm \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy only package files first for layer caching
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.js .

RUN mkdir -p /tmp/latex && chmod 1777 /tmp/latex

EXPOSE 4000

CMD ["node", "server.js"]
