
const axios = require("axios");
const fs = require("fs");
const { ensureDir, ensureFile } = require("./fsSafe");
const { log } = require("./consoleLogger");
const { downloadFromDrive } = require("./driveDownload");

function isDrive(url) {
    return url.includes("drive.google.com");
}

async function download(url, dest, jobId) {
    ensureDir(dest);

    log(jobId, "download:start", { url, dest });

    // 🔥 Drive API path
    if (isDrive(url)) {
        await downloadFromDrive(url, dest, jobId);

        const stats = fs.statSync(dest);

        log(jobId, "download:done", {
            source: "drive-api",
            size: stats.size
        });

        if (stats.size < 50000) {
            throw new Error("Drive download too small (invalid file)");
        }

        return;
    }

    // 🌐 Normal HTTP
    const res = await axios({
        url,
        method: "GET",
        responseType: "stream"
    });

    if (res.headers["content-type"]?.includes("text/html")) {
        throw new Error("Invalid download: HTML received");
    }

    const writer = fs.createWriteStream(dest);

    let bytes = 0;
    res.data.on("data", chunk => (bytes += chunk.length));

    await new Promise((resolve, reject) => {
        res.data
            .on("end", resolve)
            .on("error", reject)
            .pipe(writer);

        writer.on("error", reject);
    });

    ensureFile(dest, "Downloaded file");

    log(jobId, "download:done", {
        source: "http",
        bytes
    });
}

module.exports = { download };
