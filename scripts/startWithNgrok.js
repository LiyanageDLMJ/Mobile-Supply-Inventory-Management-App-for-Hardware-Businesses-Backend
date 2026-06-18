/**
 * Dev startup script — starts ngrok, updates the frontend .env with the
 * tunnel URL, then starts the Express backend. Run with:
 *   npm run dev:ngrok
 *
 * Requires NGROK_AUTHTOKEN in .env (get it free at https://dashboard.ngrok.com/authtokens).
 */

const ngrok = require('@ngrok/ngrok');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();

// Resolve path to frontend .env regardless of working directory
const FRONTEND_ENV = path.resolve(
  __dirname, '..', '..', '..', 'Frontend',
  'mobile_supply_inventory_management_app_for_hardware_businesses_frontend',
  '.env'
);

const PORT = process.env.PORT || 5000;

function updateFrontendEnv(tunnelUrl) {
  if (!fs.existsSync(FRONTEND_ENV)) {
    console.warn('[ngrok] Frontend .env not found at:', FRONTEND_ENV);
    return;
  }
  let content = fs.readFileSync(FRONTEND_ENV, 'utf8');
  const newLine = `EXPO_PUBLIC_API_URL=${tunnelUrl}/api`;

  if (/^EXPO_PUBLIC_API_URL=/m.test(content)) {
    content = content.replace(/^EXPO_PUBLIC_API_URL=.*/m, newLine);
  } else {
    content += `\n${newLine}\n`;
  }

  fs.writeFileSync(FRONTEND_ENV, content);
  console.log(`[ngrok] Frontend .env updated → ${newLine}`);
  console.log('[ngrok] Restart Expo (npx expo start --clear) to pick up the new URL.');
}

async function main() {
  if (!process.env.NGROK_AUTHTOKEN) {
    console.error(
      '[ngrok] NGROK_AUTHTOKEN is missing.\n' +
      '  1. Sign up free at https://ngrok.com\n' +
      '  2. Copy your auth token from https://dashboard.ngrok.com/authtokens\n' +
      '  3. Add it to Backend/.env:  NGROK_AUTHTOKEN=your_token_here\n'
    );
    process.exit(1);
  }

  console.log(`[ngrok] Opening tunnel to localhost:${PORT} …`);

  let listener;
  try {
    listener = await ngrok.forward({
      addr: PORT,
      authtoken: process.env.NGROK_AUTHTOKEN,
    });
  } catch (err) {
    console.error('[ngrok] Failed to start tunnel:', err.message);
    process.exit(1);
  }

  const tunnelUrl = listener.url();
  console.log(`[ngrok] Tunnel ready: ${tunnelUrl}`);
  updateFrontendEnv(tunnelUrl);

  // Start the backend server as a child process
  console.log('[server] Starting Express backend …\n');
  const server = spawn('node', ['server.js'], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });

  const shutdown = async () => {
    console.log('\n[ngrok] Closing tunnel …');
    try { await listener.close(); } catch (_) {}
    server.kill();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.on('close', async (code) => {
    console.log(`[server] Exited with code ${code}`);
    try { await listener.close(); } catch (_) {}
    process.exit(code ?? 0);
  });
}

main();
