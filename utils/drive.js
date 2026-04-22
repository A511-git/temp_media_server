
function extractDriveId(url) {
    // /file/d/ID/
    let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    // ?id=ID
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];

    // fallback (last segment)
    const parts = url.split("/");
    return parts.pop();
}

function getDirectLink(url) {
    const id = extractDriveId(url);
    if (!id) throw new Error("Invalid Drive URL");

    return `https://drive.google.com/uc?export=download&id=${id}`;
}

module.exports = { getDirectLink };