const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Tera Discord Client ID aur Secret
const CLIENT_ID = '1552641681617326110';
const CLIENT_SECRET = 'GWdbqnsdEMbtCjf2lej17EMYnjLmH6id';

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'roxy_pro_secure_key_2026',
    resave: false,
    saveUninitialized: true
}));

let activeRpcs = {};

// Helper function to get correct dynamic redirect URI based on environment
function getRedirectUri(req) {
    const host = req.get('host');
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}/auth/discord/callback`;
}

// Landing Page (Roxy Style UI)
app.get('/', (req, res) => {
    if (!req.session.user) {
        return res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Roxy RPC Pro - Absolute perfection</title>
                <style>
                    body { background: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
                    .hero { padding: 40px 30px; background: #0a0a0a; border: 1px solid #222; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.9); max-width: 420px; width: 90%; }
                    h1 { font-size: 32px; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.5px; }
                    p { color: #888; font-size: 15px; margin-bottom: 30px; }
                    .btn-login { background: #ffffff; color: #000000; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block; transition: 0.2s; width: 100%; box-sizing: border-box; }
                    .btn-login:hover { background: #e0e0e0; }
                </style>
            </head>
            <body>
                <div class="hero">
                    <h1>ROXY RPC PRO</h1>
                    <p>The ultimate Discord Rich Presence engine.<br>Absolute perfection.</p>
                    <a class="btn-login" href="/auth/discord">Login with Discord</a>
                </div>
            </body>
            </html>
        `);
    }

    const user = req.session.user;
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Dashboard - Roxy RPC Pro</title>
            <style>
                body { background: #050505; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; margin: 0; }
                .container { max-width: 500px; margin: auto; background: #0f0f11; padding: 25px; border-radius: 16px; border: 1px solid #222; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
                .user-box { display: flex; align-items: center; background: #18181b; padding: 14px; border-radius: 12px; margin-bottom: 25px; border: 1px solid #27272a; }
                .user-box img { width: 48px; height: 48px; border-radius: 50%; margin-right: 14px; }
                .user-info h3 { margin: 0; font-size: 16px; color: #fff; }
                .user-info small { color: #22c55e; font-weight: 600; }
                h2 { font-size: 18px; margin-bottom: 15px; color: #fff; border-bottom: 1px solid #222; padding-bottom: 10px; }
                label { display: block; margin-top: 12px; font-size: 12px; color: #a1a1aa; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
                input { width: 100%; padding: 12px; margin-top: 6px; background: #09090b; border: 1px solid #27272a; color: white; border-radius: 10px; box-sizing: border-box; font-size: 14px; }
                input:focus { border-color: #6366f1; outline: none; }
                .row { display: flex; gap: 10px; }
                .row > div { flex: 1; }
                .btn { background: #6366f1; color: white; border: none; padding: 14px; width: 100%; border-radius: 10px; font-weight: 700; cursor: pointer; margin-top: 25px; transition: 0.2s; font-size: 14px; }
                .btn:hover { background: #4f46e5; }
                .btn-stop { background: #ef4444; margin-top: 10px; }
                .btn-stop:hover { background: #dc2626; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="user-box">
                    <img src="https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png" alt="Avatar">
                    <div class="user-info">
                        <h3>${user.username}</h3>
                        <small>● ONLINE</small>
                    </div>
                </div>
                <h2>Rich Presence Engine</h2>
                <form action="/start-rpc" method="POST">
                    <div class="row">
                        <div>
                            <label>Details</label>
                            <input type="text" name="details" value="Playing Minecraft" required>
                        </div>
                        <div>
                            <label>State</label>
                            <input type="text" name="state" value="Competitive Match">
                        </div>
                    </div>
                    
                    <label>Application ID</label>
                    <input type="text" name="app_id" value="1552641681617326110" required>

                    <button type="submit" class="btn">UPDATE & ENABLE RPC</button>
                </form>
                <form action="/stop-rpc" method="POST">
                    <button type="submit" class="btn btn-stop">STOP RPC</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

// Discord Authentication with dynamic redirect URI
app.get('/auth/discord', (req, res) => {
    const redirectUri = getRedirectUri(req);
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify%20connections`;
    res.redirect(authUrl);
});

app.get('/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send('Login Failed!');

    const redirectUri = getRedirectUri(req);

    try {
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri,
            }),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const tokenData = await tokenResponse.json();
        if (!tokenData.access_token) return res.send('Token fetch failed.');

        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = await userResponse.json();

        req.session.user = userData;
        req.session.accessToken = tokenData.access_token;
        
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.send('Authentication Error occurred.');
    }
});

// Start RPC Gateway
app.post('/start-rpc', (req, res) => {
    const { details, state, app_id } = req.body;
    const user = req.session.user;
    const token = req.session.accessToken;

    if (!token || !user) return res.redirect('/');

    if (activeRpcs[user.id]) {
        activeRpcs[user.id].close();
    }

    const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
    activeRpcs[user.id] = ws;

    ws.on('message', (data) => {
        const packet = JSON.parse(data);
        if (packet.op === 10) {
            const heartbeatInterval = packet.d.heartbeat_interval;
            
            setInterval(() => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ op: 1, d: null }));
                }
            }, heartbeatInterval);

            ws.send(JSON.stringify({
                op: 2,
                d: {
                    token: token,
                    capabilities: 16381,
                    properties: { os: "Windows", browser: "Chrome", device: "" }
                }
            }));

            setTimeout(() => {
                ws.send(JSON.stringify({
                    op: 3,
                    d: {
                        since: 0,
                        activities: [{
                            name: details,
                            type: 0,
                            state: state,
                            application_id: app_id,
                            timestamps: { start: Math.floor(Date.now() / 1000) }
                        }],
                        status: "online",
                        afk: false
                    }
                }));
            }, 3000);
        }
    });

    res.redirect('/');
});

app.post('/stop-rpc', (req, res) => {
    const user = req.session.user;
    if (user && activeRpcs[user.id]) {
        activeRpcs[user.id].close();
        delete activeRpcs[user.id];
    }
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Roxy Pro Engine running on port ${PORT}`);
});
