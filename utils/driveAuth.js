
const { google } = require("googleapis");

const CLIENT_ID = process.env.GDRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GDRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GDRIVE_REFRESH_TOKEN;

const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET
);

// only refresh token needed
oauth2Client.setCredentials({
    refresh_token: REFRESH_TOKEN
});

// 🔥 helper to always return valid token
async function ensureAuth() {
    const { token } = await oauth2Client.getAccessToken();
    oauth2Client.setCredentials({ access_token: token });
    return oauth2Client;
}

function getDrive(auth) {
    return google.drive({
        version: "v3",
        auth
    });
}

module.exports = { ensureAuth, getDrive };