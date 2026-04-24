# -------- BASE --------
FROM node:20-slim

# -------- INSTALL FFMPEG --------
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg && \
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