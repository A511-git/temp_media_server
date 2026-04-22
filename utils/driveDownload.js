
const fs = require("fs");
const path = require("path");
const { ensureAuth, getDrive } = require("./driveAuth");
const { ensureDir, ensureFile } = require("./fsSafe");
const { log } = require("./consoleLogger");

// extract file id safely
function extractFileId(url) {
    const match = url.match(/[-\w]{25,}/);
    return match ? match[0] : null;
}

async function downloadFromDrive(url, dest, jobId) {
    const fileId = extractFileId(url);
    if (!fileId) throw new Error("Invalid Drive URL");

    ensureDir(dest);

    log(jobId, "drive:start", { fileId, dest });

    try {
        const auth = await ensureAuth();
        const drive = getDrive(auth);

        // 🔥 STEP 1: get file metadata (size)
        let total = 0;
        try {
            const meta = await drive.files.get({
                fileId,
                fields: "size,name,mimeType"
            });

            total = Number(meta.data.size || 0);

            log(jobId, "drive:meta", {
                name: meta.data.name,
                size: total,
                mime: meta.data.mimeType
            });

        } catch (e) {
            log(jobId, "drive:meta_failed", { message: e.message });
        }

        // 🔥 STEP 2: stream download
        const res = await drive.files.get(
            { fileId, alt: "media" },
            { responseType: "stream" }
        );

        const writer = fs.createWriteStream(dest);

        let downloaded = 0;
        let lastPercent = 0;
        let lastBytesLogged = 0;

        await new Promise((resolve, reject) => {

            res.data.on("data", chunk => {
                downloaded += chunk.length;

                // ✅ percentage logging (if size known)
                if (total > 0) {
                    const percent = Math.floor((downloaded / total) * 100);

                    if (percent >= lastPercent + 5) {
                        lastPercent = percent;

                        log(jobId, "drive:progress", {
                            percent,
                            downloaded,
                            total
                        });
                    }

                } else {
                    // ⚠️ fallback: every 5MB
                    if (downloaded - lastBytesLogged >= 5 * 1024 * 1024) {
                        lastBytesLogged = downloaded;

                        log(jobId, "drive:progress", {
                            downloadedMB: (downloaded / (1024 * 1024)).toFixed(2)
                        });
                    }
                }
            });

            res.data.on("error", err => {
                log(jobId, "drive:stream_error", { message: err.message });
                reject(err);
            });

            writer.on("error", err => {
                log(jobId, "drive:write_error", { message: err.message });
                reject(err);
            });

            writer.on("finish", resolve);

            res.data.pipe(writer);
        });

        // 🔥 FINAL VALIDATION
        ensureFile(dest, "Drive output");

        const stats = fs.statSync(dest);

        log(jobId, "drive:done", {
            bytes: stats.size
        });

        if (stats.size < 50000) {
            throw new Error("Drive file too small (invalid/corrupt)");
        }

    } catch (err) {
        log(jobId, "drive:failed", {
            message: err.message,
            stack: err.stack
        });

        throw err;
    }
}

module.exports = { downloadFromDrive };
