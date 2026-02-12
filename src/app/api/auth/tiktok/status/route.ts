import { NextResponse } from 'next/server';
import { IntegrationManager } from '@/lib/integrationManager';

export async function GET() {
    const tokens = await IntegrationManager.getTokens('TikTok');

    if (!tokens) {
        return NextResponse.json({ connected: false });
    }

    // Check expiry
    if (tokens.expires_at && Date.now() > tokens.expires_at) {
        // Attempt refresh
        if (tokens.refresh_token && tokens.refresh_expires_at && Date.now() < tokens.refresh_expires_at) {
            try {
                const refreshRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        client_key: process.env.TIKTOK_CLIENT_KEY!,
                        client_secret: process.env.TIKTOK_CLIENT_SECRET!,
                        grant_type: 'refresh_token',
                        refresh_token: tokens.refresh_token
                    })
                });
                const refreshData = await refreshRes.json();

                if (refreshData.access_token) {
                    const updated = {
                        ...tokens,
                        access_token: refreshData.access_token,
                        refresh_token: refreshData.refresh_token || tokens.refresh_token,
                        expires_at: Date.now() + (refreshData.expires_in || 86400) * 1000
                    };
                    await IntegrationManager.saveTokens('TikTok', updated);
                    return NextResponse.json({
                        connected: true,
                        displayName: tokens.displayName || 'TikTok User',
                        avatarUrl: tokens.avatarUrl || ''
                    });
                }
            } catch (e) {
                console.error("TikTok token refresh failed:", e);
            }
        }

        return NextResponse.json({
            connected: false,
            error: 'Token expired. Please reconnect.'
        });
    }

    return NextResponse.json({
        connected: true,
        displayName: tokens.displayName || 'TikTok User',
        avatarUrl: tokens.avatarUrl || ''
    });
}

export async function DELETE() {
    await IntegrationManager.deleteTokens('TikTok');
    return NextResponse.json({ success: true });
}
