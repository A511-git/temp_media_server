# -------- BASE --------
FROM node:20-slim

# -------- INSTALL FFMPEG + UNRAR --------
# unrar (non-free) requires the non-free repo on Debian
# -------- INSTALL FFMPEG + UNRAR --------
RUN echo "deb http://deb.debian.org/debian bookworm non-free non-free-firmware" \
        >> /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        unrar && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# -------- WORKDIR --------
WORKDIR /app

# -------- DEPS LAYER (cached unless package.json changes) --------
COPY package*.json ./
RUN npm ci --omit=dev

# -------- SOURCE --------
COPY . .

# -------- DATA DIRS --------
RUN mkdir -p data/temp data/output

# -------- NON-ROOT USER (security) --------
RUN chown -R node:node /app
USER node

# -------- EXPOSE --------
EXPOSE 3000

# -------- START --------
CMD ["node", "app.js"]