
require("dotenv").config();
const express = require("express");
const { processImage } = require("./controllers/imageController");
const { processVideo } = require("./controllers/videoController");
const { processArchive } = require("./controllers/archiveController");
const { system } = require("./controllers/systemController");
const fs = require("fs");
const path = require("path");
const { LOG, TEMP, OUT, CONSOLE } = require("./config");

const app = express();

[TEMP, OUT].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

app.use(express.json());

app.post("/process/image", processImage);
app.post("/process/video", processVideo);
app.post("/process/archive", processArchive);

app.get("/logs", (req, res) => {
    if (!fs.existsSync(LOG)) return res.json({});
    res.sendFile(path.resolve(LOG));
});

app.get("/console", (req, res) => {
    if (!fs.existsSync(CONSOLE)) return res.json({});
    res.sendFile(path.resolve(CONSOLE));
});

app.get("/logs/:jobId", (req, res) => {
    const logs = fs.existsSync(LOG) ? JSON.parse(fs.readFileSync(LOG)) : {};
    res.json(logs[req.params.jobId] || []);
});

app.get("/system", system);
app.get("/health", (_, res) => res.json({ status: "ok" }));

app.get("/cleanup", async (req, res) => {
    const dataDir = path.resolve("./data");

    try {
        if (fs.existsSync(dataDir)) {
            await fs.promises.rm(dataDir, {
                recursive: true,
                force: true
            });
        }

        fs.mkdirSync(path.join(dataDir, "temp"), { recursive: true });
        fs.mkdirSync(path.join(dataDir, "output"), { recursive: true });

        res.json({
            status: "cleanup complete",
            deleted: dataDir
        });

    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});
app.use("/output", express.static(OUT));

app.listen(3000, () => console.log("Running on 3000"));