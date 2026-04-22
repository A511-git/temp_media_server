
const fs = require("fs");
const path = require("path");
const { LOG } = require("../config");
const { ensureDir } = require("./fsSafe");

function log(jobId, data) {
    ensureDir(LOG);

    let logs = {};

    try {
        if (fs.existsSync(LOG)) {
            logs = JSON.parse(fs.readFileSync(LOG));
        }
    } catch {
        logs = {};
    }

    logs[jobId] = logs[jobId] || [];
    logs[jobId].push({ time: new Date().toISOString(), ...data });

    fs.writeFileSync(LOG, JSON.stringify(logs, null, 2));
}

module.exports = { log };
