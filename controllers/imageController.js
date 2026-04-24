
const { TEMP, OUT } = require("../config");
const { log } = require("../utils/logger");
const { download } = require("../utils/downloader");
const { compressImage } = require("../utils/ffmpeg");
const { safeSize } = require("../utils/fsSafe");

async function processImageTask(jobId, url) {
    const input = `${TEMP}/${jobId}_input.jpg`;
    const output = `${OUT}/${jobId}.webp`;

    const t0 = Date.now();

    log(jobId, { stage: "start", type: "image", url });

    const tDownloadStart = Date.now();
    await download(url, input, jobId);
    const tDownloadEnd = Date.now();

    log(jobId, {
        stage: "downloaded",
        timeMs: tDownloadEnd - tDownloadStart
    });

    const tProcessStart = Date.now();
    compressImage(input, output, jobId);
    const tProcessEnd = Date.now();

    const t1 = Date.now();

    log(jobId, {
        stage: "done",
        inputSize: safeSize(input),
        outputSize: safeSize(output),
        timing: {
            downloadMs: tDownloadEnd - tDownloadStart,
            processMs: tProcessEnd - tProcessStart,
            totalTimeMs: t1 - t0
        }
    });
}

async function processImage(req, res) {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "url required" });

    const jobId = Date.now().toString();

    res.json({ jobId });

    processImageTask(jobId, url)
        .catch(err => log(jobId, { error: err.message }));
}

module.exports = { processImage };
