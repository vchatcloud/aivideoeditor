import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET,
      'http://localhost:3000/api/auth/youtube/callback'
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save tokens locally
    const tokenPath = path.join(process.cwd(), 'youtube-tokens.json');
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));

    // Airtable Sync (As requested)
    if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
      try {
        const Airtable = require('airtable');
        const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);

        // Check for existing record
        const records = await base('Integrations').select({
          filterByFormula: "{Platform} = 'YouTube'",
          maxRecords: 1
        }).firstPage();

        const tokenData = JSON.stringify(tokens);

        if (records && records.length > 0) {
          // Update
          await base('Integrations').update(records[0].id, {
            "Tokens": tokenData,
            "Status": "Active",
            "LastUpdated": new Date().toISOString()
          });
        } else {
          // Create
          await base('Integrations').create({
            "Platform": 'YouTube',
            "Tokens": tokenData,
            "Status": "Active",
            "LastUpdated": new Date().toISOString()
          });
        }
      } catch (atErr) {
        console.error("Airtable Sync Error:", atErr);
        // Do not fail the request, just log
      }
    }

    // Also fetch channel info to confirm
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const me = await youtube.channels.list({ part: ['snippet'], mine: true });
    const channelName = me.data.items?.[0]?.snippet?.title || "Unknown Channel";

    // Prepare success HTML
    return new NextResponse(`
      <html>
        <body style="background:#111; color:white; font-family:sans-serif; text-align:center; padding-top:50px;">
          <h1 style="color:#4ade80">✅ Connected to YouTube</h1>
          <p>Channel: <strong>${channelName}</strong></p>
          <p>You can close this window now.</p>
          <script>
            // Notify opener
            if(window.opener) {
                window.opener.postMessage({ type: 'youtube-connected', channel: '${channelName}' }, '*');
            }
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `, { headers: { 'Content-Type': 'text/html' } });

  } catch (error) {
    console.error("OAuth Error:", error);
    return NextResponse.json({ error: "Authentication failed. Check server logs." }, { status: 500 });
  }
}
