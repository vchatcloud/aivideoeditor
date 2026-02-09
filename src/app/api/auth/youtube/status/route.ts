import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import { IntegrationManager } from '@/lib/integrationManager';

export async function GET() {
    const tokens = await IntegrationManager.getTokens('YouTube');

    if (!tokens) {
        return NextResponse.json({ connected: false });
    }

    // Default to "Connected" using cached metadata if available
    const cachedStatus = {
        connected: true,
        channelName: tokens.channelName || "Connected (Verifying...)",
        channelIcon: tokens.channelIcon || ""
    };

    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.YOUTUBE_CLIENT_ID,
            process.env.YOUTUBE_CLIENT_SECRET
        );

        // Listen for token updates (refresh)
        oauth2Client.on('tokens', async (newTokens) => {
            console.log("YouTube Token Refreshed automatically");
            // Note: This might fire async, but we also save after the call
        });

        oauth2Client.setCredentials(tokens);

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
        // Minimal quota cost check
        const me = await youtube.channels.list({ part: ['snippet'], mine: true });

        const channelName = me.data.items?.[0]?.snippet?.title || tokens.channelName || "Unknown Channel";
        const channelIcon = me.data.items?.[0]?.snippet?.thumbnails?.default?.url || tokens.channelIcon || "";

        // Success! Update storage with potentially refreshed tokens AND latest metadata
        // oauth2Client.credentials will contain the latest used tokens (including refreshed ones)
        const activeTokens = oauth2Client.credentials;

        await IntegrationManager.saveTokens('YouTube', {
            ...tokens, // Keep existing fields
            ...activeTokens, // Update auth fields
            channelName,
            channelIcon
        });

        return NextResponse.json({
            connected: true,
            channelName,
            channelIcon
        });

    } catch (error) {
        console.error("Status Check Failed (Using Cached):", error);

        // IMPORTANT: On error (e.g. timeout, quota, or even 401 if refresh failed), 
        // we STILL return connected=true if we have the tokens.
        // We only disconnect if the user explicitly asks (DELETE route).

        // Optional: If we know the token is DEFINITIVELY dead (e.g. invalid_grant), 
        // we could potentially update status to "Error" but keep it "Connected" so user can retry.
        // For now, fulfilling request "keep connected".
        return NextResponse.json(cachedStatus);
    }
}


export async function DELETE() {
    await IntegrationManager.deleteTokens('YouTube');
    return NextResponse.json({ success: true });
}
