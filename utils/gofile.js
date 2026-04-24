const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const BASE_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "*/*",
    "Origin": "https://gofile.io",
    "Referer": "https://gofile.io/"
};

// ── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry(fn, retries = 3, delayMs = 400) {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, delayMs * (i + 1)));
        }
    }
}

// ── Session ───────────────────────────────────────────────────────────────────

const session = axios.create({
    headers: BASE_HEADERS,
    timeout: 20000   // 20s — was 15s, and getToken had NO timeout
});

// ── Auth ──────────────────────────────────────────────────────────────────────

let cachedToken = null;

async function getToken() {
    if (cachedToken) return cachedToken;

    // Use session (has timeout) not bare axios
    const res = await withRetry(() =>
        session.post("https://api.gofile.io/accounts")
    );

    const token = res.data?.data?.token;
    if (!token) throw new Error(`GoFile token missing — response: ${JSON.stringify(res.data)}`);

    cachedToken = token;
    return token;
}

function buildWebsiteToken(userAgent, token) {
    const timeSlot = Math.floor(Date.now() / 1000 / 14400);
    const raw = `${userAgent}::en-US::${token}::${timeSlot}::5d4f7g8sd45fsd`;
    return crypto.createHash("sha256").update(raw).digest("hex");
}

// ── Folder tree walk ──────────────────────────────────────────────────────────

async function fetchFolder(cid, token, wt, password, basePath = "", files = []) {
    let url = `https://api.gofile.io/contents/${cid}?cache=true`;

    if (password) {
        const hashed = crypto.createHash("sha256").update(password).digest("hex");
        url += `&password=${hashed}`;
    }

    const res = await withRetry(() =>
        session.get(url, {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Cookie": `accountToken=${token}`,
                "X-Website-Token": wt,
                "X-BL": "en-US"
            }
        })
    );

    const data = res.data?.data;
    if (!data) {
        throw new Error(
            `GoFile API returned no data for ${cid}. ` +
            `Status: ${res.data?.status} — full: ${JSON.stringify(res.data)}`
        );
    }

    // Single file (not a folder)
    if (data.type !== "folder") {
        files.push({ name: data.name, link: data.link, path: basePath });
        return files;
    }

    const children = Object.values(data.children || {});
    for (const child of children) {
        if (child.type === "folder") {
            await fetchFolder(
                child.id, token, wt, password,
                path.join(basePath, child.name),
                files
            );
        } else {
            files.push({
                name: child.name,
                link: child.link,
                path: basePath
            });
        }
    }

    return files;
}

// ── Public API ────────────────────────────────────────────────────────────────

async function listFiles(url, password = null) {
    const cid = url.split("/").pop();
    const token = await getToken();
    const wt = buildWebsiteToken(BASE_HEADERS["User-Agent"], token);
    return fetchFolder(cid, token, wt, password);
}

async function downloadFile(file, dest) {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const token = await getToken();
    const wt = buildWebsiteToken(BASE_HEADERS["User-Agent"], token);

    await withRetry(async () => {
        const res = await session.get(file.link, {
            responseType: "stream",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Cookie": `accountToken=${token}`,
                "X-Website-Token": wt
            }
        });

        const contentType = res.headers["content-type"] || "";
        if (contentType.includes("text/html")) {
            throw new Error(`Invalid download for ${file.name}: HTML received`);
        }

        const writer = fs.createWriteStream(dest);

        await new Promise((resolve, reject) => {
            res.data.pipe(writer);
            writer.on("finish", resolve);
            writer.on("error", reject);
            res.data.on("error", reject);
        });
    });

    const stats = fs.existsSync(dest) ? fs.statSync(dest) : null;

    if (!stats || stats.size === 0) {
        throw new Error(`Download failed or empty: ${dest}`);
    }
}

async function downloadAll(files, baseDir, concurrency = 3) {
    const queue = [...files];
    const workers = Array.from({ length: concurrency }, async () => {
        while (queue.length) {
            const file = queue.shift();
            const dest = path.join(baseDir, file.path, file.name);
            await downloadFile(file, dest);
        }
    });
    await Promise.all(workers);
}

module.exports = { listFiles, downloadFile, downloadAll };