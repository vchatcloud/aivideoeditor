import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const tokenPath = path.join(process.cwd(), 'youtube-tokens.json');

    if (!fs.existsSync(tokenPath)) {
        return NextResponse.json({ connected: false });
    }

    try {
        const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));

        // Validate tokens (optional: check expiry)
        // For now, simpler check
        if (!tokens.access_token && !tokens.refresh_token) {
            return NextResponse.json({ connected: false });
        }

        // Try to get channel info to be sure (and get name)
        const oauth2Client = new google.auth.OAuth2(
            process.env.YOUTUBE_CLIENT_ID,
            process.env.YOUTUBE_CLIENT_SECRET
        );
        oauth2Client.setCredentials(tokens);

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        const me = await youtube.channels.list({ part: ['snippet'], mine: true });

        const channelName = me.data.items?.[0]?.snippet?.title || "Unknown Channel";
        const channelIcon = me.data.items?.[0]?.snippet?.thumbnails?.default?.url || "";

        return NextResponse.json({
            connected: true,
            channelName,
            channelIcon
        });

    } catch (error) {
        console.error("Status Check Error:", error);
        // If token invalid, maybe return false?
        return NextResponse.json({ connected: false, error: "Invalid token" });
    }
}

export async function DELETE() {
    // Disconnect
    const tokenPath = path.join(process.cwd(), 'youtube-tokens.json');
    if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
    }
    return NextResponse.json({ success: true });
}
