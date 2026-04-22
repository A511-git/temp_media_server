
const fs = require("fs");
const { TEMP, OUT } = require("../config");
const { log } = require("../utils/logger");
const { download } = require("../utils/downloader");
const { compressVideo } = require("../utils/ffmpeg");

function safeSize(file) {
    return fs.existsSync(file) ? fs.statSync(file).size : null;
}

async function processVideoTask(jobId, url) {
    const input = `${TEMP}/${jobId}_input.mp4`;
    const output = `${OUT}/${jobId}.mp4`;

    const t0 = Date.now();

    log(jobId, { stage: "start", type: "video", url });

    const tDownloadStart = Date.now();
    await download(url, input, jobId);
    const tDownloadEnd = Date.now();

    log(jobId, {
        stage: "downloaded",
        timeMs: tDownloadEnd - tDownloadStart
    });

    const tProcessStart = Date.now();
    await compressVideo(input, output, jobId);
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

async function processVideo(req, res) {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "url required" });

    const jobId = Date.now().toString();

    res.json({ jobId });

    processVideoTask(jobId, url)
        .catch(err => log(jobId, { error: err.message }));
}

module.exports = { processVideo };
