
const fs = require("fs");
const path = require("path");

const LOG_FILE = path.resolve("./data/console.log");

// ensure dir
if (!fs.existsSync(path.dirname(LOG_FILE))) {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
}

function write(line) {
    const entry = `[${new Date().toISOString()}] ${line}\n`;

    // console
    console.log(entry.trim());

    // file
    fs.appendFileSync(LOG_FILE, entry);
}

function log(jobId, stage, data = {}) {
    write(`[JOB ${jobId}] [${stage}] ${JSON.stringify(data)}`);
}

function raw(line) {
    write(line);
}

module.exports = { log, raw };