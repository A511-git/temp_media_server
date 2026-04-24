
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
        ? files.filter(f => f.name.includes(matchText))
        : files;

    for (let f of filtered) {
        const filePath = `${TEMP}/${jobId}_${f.name}`;

        const stats = fs.statSync(filePath);
        if (stats.size < 10000) {
            throw new Error(`Invalid archive (too small): ${filePath}`);
        }
        await downloadFile(f, filePath);

        if (f.name.endsWith(".zip") || f.name.endsWith(".rar")) {
            const safeName = f.name.replace(/[^\w.-]/g, "_");
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
