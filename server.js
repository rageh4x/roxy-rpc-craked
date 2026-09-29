const express = require('express');
const session = require('express-session');
const axios = require('axios');

const app =express();

// Apni Discord Developer Portal ki details yahan daal
const CLIENT_ID = '1552641681617326110';
const CLIENT_SECRET = 'PDotjlme3LUOoc0H6ZG9zDCRQ8y_dqRY';
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'roxy-clone-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Global log array taaki dashboard par dikha sakein
let globalLogs = [];

function addLog(type, message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    globalLogs.unshift(logEntry); // Naya log upar dikhega
    if (globalLogs.maxLength > 50) globalLogs.pop();
    console.log(logEntry);
}

// 1. Home Page / Dashboard UI
app.get('/', (req, res) => {
    const user = req.session.user;
    
    let logsHtml = globalLogs.map(log => `<div>${log}</div>`).join('');

    if (!user) {
        res.send(`
            <html>
            <head><title>Login - Roxy Clone</title></head>
            <body style="background: #111; color: #fff; font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h1>Login with Discord</h1>
                <p>RPC test karne ke liye pehle authorize karein.</p>
                <a href="/auth/discord" style="background: #5865F2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">Login with Discord</a>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <html>
            <head>
                <title>Dashboard - Roxy Clone</title>
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
                    <p>Status: <span id="status-text" style="color: yellow;">Disconnected</span></p>
                    
                    <h3>RPC Settings</h3>
                    <input type="text" id="gameName" placeholder="Game Name (e.g. Minecraft)" value="Minecraft">
                    <input type="text" id="details" placeholder="Details (e.g. Playing Solo)" value="Testing RPC">
                    <input type="text" id="state" placeholder="State (e.g. In Menu)" value="Online">
                    
                    <button onclick="toggleRPC(true)">Turn RPC ON</button>
                    <button class="off" onclick="toggleRPC(false)">Turn RPC OFF</button>

                    <h3>Live Error & Activity Logs:</h3>
                    <div class="logs" id="log-box">${logsHtml || 'No logs yet...'}</div>
                </div>

                <script>
                    async function toggleRPC(enable) {
                        const gameName = document.getElementById('gameName').value;
                        const details = document.getElementById('details').value;
                        const state = document.getElementById('state').value;

                        const res = await fetch('/api/rpc', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ enable, gameName, details, state })
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

        // User profile fetch karo
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        req.session.user = userResponse.data;
        req.session.accessToken = accessToken;

        res.redirect('/');
    } catch (error) {
        addLog('error', `OAuth Error: ${error.response?.data ? JSON.stringify(error.response.data) : error.message}`);
        res.send(`Authentication Error! Check console logs. <a href="/">Go Back</a>`);
    }
});

// 4. RPC Control API (Yahan error capture hoga)
app.post('/api/rpc', async (req, res) => {
    const { enable, gameName, details, state } = req.body;
    const accessToken = req.session.accessToken;

    if (!accessToken) {
        return res.json({ success: false, message: 'Unauthorized! Please login again.' });
    }

    if (!enable) {
        addLog('info', 'RPC turned OFF by user.');
        return res.json({ success: true, message: 'RPC Turned Off' });
    }

    addLog('info', `Attempting to push activity: ${gameName} - ${details}`);

    try {
        // Discord API endpoint check (OAuth token ke through activity update test)
        // Note: Standard OAuth Access token se direct Gateway connect nahi hota, 
        // yahan hum API response check karenge ki Discord kya error deta hai.
        const response = await axios.put(`https://discord.com/api/v10/users/@me/settings`, {
            // Testing payload structure
        }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        addLog('success', 'RPC Response received successfully!');
        res.json({ success: true, message: 'RPC Command executed!' });
    } catch (error) {
        const errDetails = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        addLog('error', `Discord API Error: ${errDetails}`);
        res.json({ success: false, message: `Failed! Check dashboard logs for reason.` });
    }
});

app.listen(3000, () => {
    console.log('Server is running on http://localhost:3000');
});
