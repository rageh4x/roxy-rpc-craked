const express = require('express');
const WebSocket = require('ws');

const app = express();
const PORT = process.env.PORT || 3000;

// Render ko zinda rakhne ke liye web server
app.get('/', (req, res) => {
  res.send('Discord RPC Token 24/7 is running successfully!');
});

app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// --- TERA TOKEN AUR DETAILS YAHAN SET HAIN ---
const TOKEN = 'MTM3Njk1Mzc2ODYxNjEzMjY0MA.Gi8OvX.ThbvfKW_Cv_z9b2NJRNeUylA7M9UXjIhHkwn90';
const CLIENT_ID = '1552641681617326110';
const DIRECT_IMAGE_URL = 'https://i.imgur.com/TERA_IMAGE_LINK.png'; // Yahan apni image ka direct link dal dena (jiske end me .png ya .jpg ho)

function startRPC() {
  const ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');

  ws.on('open', () => {
    console.log('Connected to Discord Gateway...');
  });

  ws.on('message', (data) => {
    const packet = JSON.parse(data);
    const { t, op, d } = packet;

    if (op === 10) {
      const interval = d.heartbeat_interval;
      setInterval(() => {
        ws.send(JSON.stringify({ op: 1, d: null }));
      }, interval);

      // Windows OS Desktop Client Spoofing
      ws.send(JSON.stringify({
        op: 2,
        d: {
          token: TOKEN,
          intents: 0,
          properties: {
            os: "Windows",
            browser: "Discord Client",
            device: "desktop",
            system_locale: "en-US",
            browser_user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Discord/1.0.9015 Chrome/108.0.5359.215 Electron/22.3.26 Safari/537.36",
            browser_version: "22.3.26",
            os_version: "10.0.19043"
          }
        }
      }));
    }

    if (t === 'READY') {
      console.log(`Logged in successfully as ${d.user.username}!`);
      
      setTimeout(() => {
        // External URL format convert karna
        const cleanUrl = DIRECT_IMAGE_URL.replace('https://', '').replace('http://', '');
        
        ws.send(JSON.stringify({
          op: 3,
          d: {
            since: null,
            activities: [{
              name: 'Fast Client',
              type: 0,
              application_id: CLIENT_ID,
              details: 'Playing Minecraft 1.21.11',
              state: 'In Game',
              timestamps: { start: Math.floor(Date.now() / 1000) },
              assets: {
                large_image: `mp:external/${cleanUrl}`
              }
            }],
            status: 'dnd',
            afk: false
          }
        }));
        console.log('Rich Presence Status Activated with Token & Direct Image URL!');
      }, 4000);
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`Connection closed: ${code} - ${reason}. Reconnecting in 5 seconds...`);
    setTimeout(startRPC, 5000); // Auto reconnect agar connection tute
  });

  ws.on('error', (err) => {
    console.log('WebSocket error: ', err);
  });
}

startRPC();
