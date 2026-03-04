/**
 * Gmail OAuth2 Setup Script
 *
 * This script helps you get a Gmail API refresh token so the system can
 * send emails via Gmail API (HTTPS) instead of SMTP.
 *
 * Prerequisites:
 *   1. Go to console.cloud.google.com → same project as your service account
 *   2. Enable "Gmail API" in APIs & Services → Library
 *   3. Go to APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth 2.0 Client ID
 *      - Application type: Web application
 *      - Authorized redirect URIs: http://localhost:3456/callback
 *   4. Copy the Client ID and Client Secret
 *
 * Usage:
 *   GOOGLE_OAUTH_CLIENT_ID=xxx GOOGLE_OAUTH_CLIENT_SECRET=yyy npx tsx scripts/setup-gmail-oauth.ts
 */

import 'dotenv/config';
import { google } from 'googleapis';
import { createServer } from 'node:http';
import { URL } from 'node:url';

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3456/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('');
  console.error('ERROR: Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET');
  console.error('');
  console.error('Usage:');
  console.error('  GOOGLE_OAUTH_CLIENT_ID=xxx GOOGLE_OAUTH_CLIENT_SECRET=yyy npx tsx scripts/setup-gmail-oauth.ts');
  console.error('');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
});

console.log('');
console.log('=== Gmail OAuth2 Setup ===');
console.log('');
console.log('1. Open this URL in your browser (log in with sxbighal@gmail.com):');
console.log('');
console.log(`   ${authUrl}`);
console.log('');
console.log('2. Authorize the app. You will be redirected back here automatically.');
console.log('');
console.log('Waiting for authorization...');

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:3456`);

  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');

    if (!code) {
      res.writeHead(400, { 'Content-Type': 'text/html' });
      res.end('<h2>Error: No authorization code received</h2>');
      return;
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <h2 style="color: green;">Success! You can close this tab.</h2>
        <p>Check your terminal for the credentials to add to your dashboard.</p>
      `);

      console.log('');
      console.log('=== SUCCESS ===');
      console.log('');
      console.log('Add these values to your SBEK Dashboard → Settings → Google section:');
      console.log('');
      console.log(`  GOOGLE_OAUTH_CLIENT_ID:      ${CLIENT_ID}`);
      console.log(`  GOOGLE_OAUTH_CLIENT_SECRET:   ${CLIENT_SECRET}`);
      console.log(`  GOOGLE_OAUTH_REFRESH_TOKEN:   ${tokens.refresh_token}`);
      console.log('');
      console.log('Or add to Railway environment variables:');
      console.log('');
      console.log(`  GOOGLE_OAUTH_CLIENT_ID=${CLIENT_ID}`);
      console.log(`  GOOGLE_OAUTH_CLIENT_SECRET=${CLIENT_SECRET}`);
      console.log(`  GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('');

      setTimeout(() => process.exit(0), 1000);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<h2 style="color: red;">Error exchanging token</h2><pre>${err}</pre>`);
      console.error('Error:', err);
    }
  }
});

server.listen(3456, () => {
  console.log('(Local server listening on http://localhost:3456)');
});
