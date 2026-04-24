
const fs = require("fs");
const { TEMP } = require("../config");
const { log } = require("../utils/logger");
const { download } = require("../utils/downloader");
const { extract } = require("../utils/archive");
const { listFiles, downloadFile } = require("../utils/gofile");

async function processArchiveTask(jobId, url, password, matchText) {
    const t0 = Date.now();

    log(jobId, { stage: "start", type: "archive", url });

    const files = await listFiles(url, password);

    const filtered = matchText
        ? files.filter(f => f.name.trim() === matchText.trim())
        : files;

    for (let f of filtered) {
        const safeName = f.name.replace(/[^\w.-]/g, "_");
        const filePath = `${TEMP}/${jobId}_${safeName}`;

        // 🔥 DOWNLOAD FIRST (this fixes your ENOENT crash)
        await downloadFile(f, filePath);

        // 🔥 CHECK FILE EXISTS
        if (!fs.existsSync(filePath)) {
            throw new Error(`Download failed (missing file): ${filePath}`);
        }

        const stats = fs.statSync(filePath);

        // 🔥 SIZE VALIDATION (avoid fake downloads)
        if (stats.size < 50000) {
            throw new Error(`Invalid archive (too small): ${filePath}`);
        }

        // 🔥 FORMAT VALIDATION (RAR / ZIP only)
        const fd = fs.openSync(filePath, "r");
        const header = Buffer.alloc(8);
        fs.readSync(fd, header, 0, 8, 0);
        fs.closeSync(fd);

        const isRAR = header.toString("ascii", 0, 4) === "Rar!";
        const isZIP = header[0] === 0x50 && header[1] === 0x4B;

        if (!isRAR && !isZIP) {
            throw new Error(`Invalid archive format: ${filePath}`);
        }

        if (f.name.endsWith(".zip") || f.name.endsWith(".rar")) {
            const outDir = `${TEMP}/${jobId}_${safeName}_extract`;
            await extract(filePath, outDir, password, jobId);
        }
    }

    log(jobId, { stage: "done" });
}

async function processArchive(req, res) {
    const { url, password, match } = req.query;
    if (!url) return res.status(400).json({ error: "url required" });

    const jobId = Date.now().toString();
    res.json({ jobId });

    // Pass password and match through — previously both were silently dropped
    processArchiveTask(jobId, url, password || null, match || null)
        .catch(err => log(jobId, { stage: "error", error: err.message }));
}

module.exports = { processArchive };
