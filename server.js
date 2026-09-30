const express = require('express');
const session = require('express-session');
const axios = require('axios');
const WebSocket = require('ws');

const app = express();

const CLIENT_ID = '1552641681617326110';
const CLIENT_SECRET = 'PDotjlme3LUOoc0H6ZG9zDCRQ8y_dqRY';
const REDIRECT_URI = 'https://roxy-rpc-craked.onrender.com/auth/callback';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'roxy-clone-secret-key',
    resave: false,
    saveUninitialized: true
}));

let globalLogs = [];
let activeWsConnections = {};

function addLog(type, message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    globalLogs.unshift(logEntry);
    if (globalLogs.length > 50) globalLogs.pop();
    console.log(logEntry);
}

// 1. Dashboard UI with Image URL Input
app.get('/', (req, res) => {
    const user = req.session.user;
    let logsHtml = globalLogs.map(log => `<div>${log}</div>`).join('');

    if (!user) {
        res.send(`
            <html>
            <head><title>Login - Roxy RPC</title></head>
            <body style="background: #111; color: #fff; font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>Login with Discord</h1>
                <p>RPC start karne ke liye pehle authorize karein.</p>
                <a href="/auth/discord" style="background: #5865F2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login with Discord</a>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <html>
            <head>
                <title>Dashboard - Roxy RPC</title>
                <style>
                    body { background: #121212; color: #fff; font-family: sans-serif; padding: 20px; }
                    .container { max-width: 600px; margin: auto; background: #1e1e1e; padding: 20px; border-radius: 10px; }
                    input, button { width: 100%; padding: 10px; margin: 10px 0; background: #2b2b2b; border: 1px solid #444; color: #fff; border-radius: 5px; }
                    button { background: #5865F2; font-weight: bold; cursor: pointer; }
                    button.off { background: #ed4245; }
                    .logs { background: #000; color: #0f0; padding: 15px; height: 200px; overflow-y: auto; font-family: monospace; font-size: 13px; border-radius: 5px; text-align: left; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Welcome, ${user.username}</h2>
                    <p>Status: <span id="status-text" style="color: yellow;">Active Session</span></p>
                    
                    <h3>RPC Settings</h3>
                    <input type="text" id="gameName" placeholder="Game Name" value="Fast Client">
                    <input type="text" id="details" placeholder="Details" value="Playing Minecraft 1.21.11">
                    <input type="text" id="state" placeholder="State" value="In Game">
                    <input type="text" id="imageUrl" placeholder="Direct Image URL (e.g. https://i.imgur.com/...)" value="">
                    
                    <button onclick="toggleRPC(true)">Turn RPC ON (DND + URL Image)</button>
                    <button class="off" onclick="toggleRPC(false)">Turn RPC OFF</button>

                    <h3>Live Logs:</h3>
                    <div class="logs" id="log-box">${logsHtml || 'No logs yet...'}</div>
                </div>

                <script>
                    async function toggleRPC(enable) {
                        const gameName = document.getElementById('gameName').value;
                        const details = document.getElementById('details').value;
                        const state = document.getElementById('state').value;
                        const imageUrl = document.getElementById('imageUrl').value;

                        const res = await fetch('/api/rpc', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ enable, gameName, details, state, imageUrl })
                        });
                        const data = await res.json();
                        alert(data.message);
                        location.reload();
                    }
                </script>
            </body>
            </html>
        `);
    }
});

// 2. Discord OAuth Route
app.get('/auth/discord', (req, res) => {
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20rpc%20rpc.activities.write`;
    res.redirect(discordAuthUrl);
});

// 3. OAuth Callback Route
app.get('/auth/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('Authorization failed: No code provided.');

    try {
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: REDIRECT_URI,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const accessToken = tokenResponse.data.access_token;
        addLog('success', 'OAuth Token successfully acquired!');

        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        req.session.user = userResponse.data;
        req.session.accessToken = accessToken;

        res.redirect('/');
    } catch (error) {
        addLog('error', `OAuth Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
        res.send(`Authentication Error! Check logs. <a href="/">Go Back</a>`);
    }
});

// 4. RPC Control API with Direct URL Support & DND
app.post('/api/rpc', async (req, res) => {
    const { enable, gameName, details, state, imageUrl } = req.body;
    const user = req.session.user;
    const accessToken = req.session.accessToken;

    if (!accessToken || !user) {
        return res.json({ success: false, message: 'Unauthorized! Please login again.' });
    }

    if (activeWsConnections[user.id]) {
        try { activeWsConnections[user.id].terminate(); } catch(e) {}
        delete activeWsConnections[user.id];
    }

    if (!enable) {
        addLog('info', 'RPC turned OFF by user.');
        return res.json({ success: true, message: 'RPC Turned Off' });
    }

    addLog('info', `Initializing Desktop-Emulated Gateway connection for: ${gameName}`);

    try {
        const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Discord/1.0.9015 Chrome/108.0.5359.215 Electron/22.3.26 Safari/537.36',
                'Origin': 'https://discord.com'
            }
        });
        
        activeWsConnections[user.id] = ws;

        ws.on('open', () => {
            addLog('success', 'Connected to Gateway with Desktop Headers!');
        });

        ws.on('message', (data) => {
            const packet = JSON.parse(data);
            
            if (packet.op === 10) {
                // Activity object setup
                let activityData = {
                    name: gameName,
                    type: 0,
                    details: details,
                    state: state,
                    application_id: CLIENT_ID,
                    timestamps: { start: Math.floor(Date.now() / 1000) }
                };

                // Agar user ne Image URL diya hai toh use mp:external format me set karo
                if (imageUrl && imageUrl.trim() !== '') {
                    const cleanUrl = imageUrl.replace('https://', '').replace('http://', '');
                    activityData.assets = {
                        large_image: `mp:external/${cleanUrl}`
                    };
                    addLog('success', `Using Direct Image URL: ${imageUrl}`);
                }

                const identifyPayload = {
                    op: 2,
                    d: {
                        token: accessToken,
                        properties: {
                            os: "Windows",
                            browser: "Discord Client",
                            device: "desktop",
                            system_locale: "en-US",
                            browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Discord/1.0.9015 Chrome/108.0.5359.215 Electron/22.3.26 Safari/537.36",
                            browser_version: "22.3.26",
                            os_version: "10.0.19043",
                            referrer: "",
                            referring_domain: "",
                            referrer_current: "",
                            referring_domain_current: ""
                        },
                        presence: {
                            activities: [activityData],
                            status: "dnd",
                            since: 0,
                            afk: false
                        }
                    }
                };
                ws.send(JSON.stringify(identifyPayload));
                addLog('success', 'Dispatched Desktop Emulated Presence payload with DND & URL Image!');
            }
        });

        ws.on('error', (err) => {
            addLog('error', `Gateway Emulation Error: ${err.message}`);
        });

        ws.on('close', (code, reason) => {
            addLog('info', `Gateway connection closed. Code: ${code}, Reason: ${reason.toString()}`);
        });

        res.json({ success: true, message: 'Emulated RPC connection triggered with URL & DND!' });
    } catch (error) {
        addLog('error', `Failed to start connection: ${error.message}`);
        res.json({ success: false, message: 'Failed to start RPC.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
