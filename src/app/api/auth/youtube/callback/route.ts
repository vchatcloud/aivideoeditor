import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { IntegrationManager } from '@/lib/integrationManager';

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

    // Also fetch channel info to confirm
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const me = await youtube.channels.list({ part: ['snippet'], mine: true });

    const channelName = me.data.items?.[0]?.snippet?.title || "Unknown Channel";
    const channelIcon = me.data.items?.[0]?.snippet?.thumbnails?.default?.url || "";

    // Save tokens AND metadata via Manager
    await IntegrationManager.saveTokens('YouTube', {
      ...tokens,
      channelName,
      channelIcon
    });

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
