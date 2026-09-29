const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

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

function getRedirectUri(req) {
    const host = req.get('host');
    const protocol = host.includes('localhost') ? 'http' : 'https';
    return `${protocol}://${host}/auth/discord/callback`;
}

app.get('/', (req, res) => {
    if (!req.session.user) {
        return res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Roxy RPC Pro</title>
                <style>
                    body { background: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; }
                    .hero { padding: 40px 30px; background: #0a0a0a; border: 1px solid #222; border-radius: 20px; box-shadow: 0 10px 40px rgba(0,0,0,0.9); max-width: 420px; width: 90%; }
                    h1 { font-size: 32px; font-weight: 800; margin-bottom: 8px; }
                    p { color: #888; font-size: 15px; margin-bottom: 30px; }
                    .btn-login { background: #ffffff; color: #000000; padding: 14px 28px; border-radius: 12px; text-decoration: none; font-weight: 700; display: inline-block; width: 100%; box-sizing: border-box; }
                </style>
            </head>
            <body>
                <div class="hero">
                    <h1>ROXY RPC PRO</h1>
                    <p>The ultimate Discord Rich Presence engine.</p>
                    <a class="btn-login" href="/auth/discord">Login with Discord</a>
                </div>
            </body>
            </html>
        `);
    }

    const user = req.session.user;
    const isRpcActive = activeRpcs[user.id] ? true : false;
    const cfg = req.session.rpcConfig || {
        activity_type: "0",
        app_id: CLIENT_ID,
        name: "Fast Client",
        state: "Competitive Match",
        details: "Playing Minecraft"
    };

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Dashboard - Roxy RPC Pro</title>
            <style>
                body { background: #050505; color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; margin: 0; }
                .container { max-width: 500px; margin: auto; background: #0f0f11; padding: 20px; border-radius: 16px; border: 1px solid #222; box-shadow: 0 10px 30px rgba(0,0,0,0.8); }
                .user-box { display: flex; align-items: center; background: #18181b; padding: 12px 16px; border-radius: 12px; margin-bottom: 20px; border: 1px solid #27272a; }
                .user-box img { width: 45px; height: 45px; border-radius: 50%; margin-right: 12px; }
                .user-info h3 { margin: 0; font-size: 15px; color: #fff; }
                .user-info span { font-size: 12px; font-weight: 700; color: ${isRpcActive ? '#22c55e' : '#ef4444'}; }
                h2 { font-size: 14px; margin: 15px 0 10px 0; color: #fff; text-transform: uppercase; letter-spacing: 0.5px; }
                label { display: block; margin-top: 8px; font-size: 10px; color: #a1a1aa; font-weight: 700; text-transform: uppercase; }
                input, select { width: 100%; padding: 10px; margin-top: 4px; background: #09090b; border: 1px solid #27272a; color: white; border-radius: 8px; box-sizing: border-box; font-size: 13px; }
                .row { display: flex; gap: 8px; }
                .row > div { flex: 1; }
                .btn-update { background: #6366f1; color: white; border: none; padding: 12px; width: 100%; border-radius: 8px; font-weight: 700; cursor: pointer; margin-top: 15px; font-size: 13px; }
                .btn-toggle { background: ${isRpcActive ? '#ef4444' : '#22c55e'}; color: white; border: none; padding: 12px; width: 100%; border-radius: 8px; font-weight: 700; cursor: pointer; margin-top: 8px; font-size: 13px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="user-box">
                    <img src="https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png" alt="Avatar">
                    <div class="user-info">
                        <h3>${user.username}</h3>
                        <span>${isRpcActive ? '● ONLINE (RPC ACTIVE)' : '○ OFFLINE (RPC STOPPED)'}</span>
                    </div>
                </div>

                <form action="/update-rpc" method="POST">
                    <h2>Rich Presence Engine</h2>
                    
                    <div class="row">
                        <div>
                            <label>Details</label>
                            <input type="text" name="details" value="${cfg.details}">
                        </div>
                        <div>
                            <label>State</label>
                            <input type="text" name="state" value="${cfg.state}">
                        </div>
                    </div>

                    <label>Application ID</label>
                    <input type="text" name="app_id" value="${cfg.app_id || CLIENT_ID}" required>

                    <button type="submit" class="btn-update">UPDATE & ENABLE RPC</button>
                </form>

                <form action="/toggle-rpc" method="POST">
                    <button type="submit" class="btn-toggle">${isRpcActive ? 'STOP RPC' : 'START RPC'}</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

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

app.post('/update-rpc', (req, res) => {
    const user = req.session.user;
    if (!user) return res.redirect('/');
    
    req.session.rpcConfig = req.body;
    
    if (activeRpcs[user.id]) {
        startOrUpdateRpc(user, req.session.accessToken, req.body);
    }
    
    res.redirect('/');
});

app.post('/toggle-rpc', (req, res) => {
    const user = req.session.user;
    if (!user || !req.session.accessToken) return res.redirect('/');

    if (activeRpcs[user.id]) {
        activeRpcs[user.id].close();
        delete activeRpcs[user.id];
    } else {
        const config = req.session.rpcConfig || {
            activity_type: "0",
            app_id: CLIENT_ID,
            name: "Fast Client",
            state: "Competitive Match",
            details: "Playing Minecraft"
        };
        startOrUpdateRpc(user, req.session.accessToken, config);
    }

    res.redirect('/');
});

function startOrUpdateRpc(user, token, config) {
    if (activeRpcs[user.id]) {
        try { activeRpcs[user.id].close(); } catch(e) {}
    }

    const ws = new WebSocket('wss://gateway.discord.gg/?v=9&encoding=json');
    activeRpcs[user.id] = ws;

    let heartbeatTimer = null;

    ws.on('message', (data) => {
        try {
            const packet = JSON.parse(data);
            if (packet.op === 10) {
                const interval = packet.d.heartbeat_interval;
                
                if (heartbeatTimer) clearInterval(heartbeatTimer);
                heartbeatTimer = setInterval(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.send(JSON.stringify({ op: 1, d: null }));
                    }
                }, interval);

                ws.send(JSON.stringify({
                    op: 2,
                    d: {
                        token: token,
                        capabilities: 16381,
                        properties: { os: "Windows", browser: "Chrome", device: "" },
                        presence: {
                            status: "online",
                            since: 0,
                            activities: [{
                                name: config.name || "Fast Client",
                                type: parseInt(config.activity_type) || 0,
                                details: config.details || "",
                                state: config.state || "",
                                application_id: config.app_id || CLIENT_ID,
                                timestamps: { start: Math.floor(Date.now() / 1000) }
                            }],
                            afk: false
                        }
                    }
                }));
            }
        } catch (err) {
            console.error('[RPC Error]', err);
        }
    });

    ws.on('close', () => {
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        delete activeRpcs[user.id];
    });
}

app.listen(PORT, () => {
    console.log(`Roxy Pro Engine running on port ${PORT}`);
});
