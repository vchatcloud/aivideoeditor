import { NextResponse } from 'next/server';
import { IntegrationManager } from '@/lib/integrationManager';
import { getCodeVerifier, getRedirectUri } from '../login/route';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
        return new NextResponse(`
            <html>
            <body style="background:#111; color:white; font-family:sans-serif; text-align:center; padding-top:50px;">
                <h1 style="color:#f87171">❌ TikTok Authorization Denied</h1>
                <p>${searchParams.get('error_description') || 'User denied access'}</p>
                <script>setTimeout(() => window.close(), 3000);</script>
            </body>
            </html>
        `, { headers: { 'Content-Type': 'text/html' } });
    }

    if (!code) {
        return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
    const redirectUri = getRedirectUri() || `https://${new URL(request.url).host}/api/auth/tiktok/callback`;

    try {
        // Exchange code for access token (with PKCE code_verifier)
        const codeVerifier = getCodeVerifier();
        const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_key: clientKey!,
                client_secret: clientSecret!,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
                code_verifier: codeVerifier
            })
        });

        const tokenData = await tokenRes.json();

        if (tokenData.error || !tokenData.access_token) {
            throw new Error(tokenData.error_description || tokenData.error || "Token exchange failed");
        }

        // Get user info
        let displayName = 'TikTok User';
        let avatarUrl = '';
        try {
            const userRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=display_name,avatar_url', {
                headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`
                }
            });
            const userData = await userRes.json();
            if (userData.data?.user) {
                displayName = userData.data.user.display_name || displayName;
                avatarUrl = userData.data.user.avatar_url || '';
            }
        } catch (e) {
            console.warn("Failed to fetch TikTok user info:", e);
        }

        // Save tokens
        await IntegrationManager.saveTokens('TikTok', {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            open_id: tokenData.open_id,
            expires_in: tokenData.expires_in,
            expires_at: Date.now() + (tokenData.expires_in || 86400) * 1000,
            refresh_expires_at: Date.now() + (tokenData.refresh_expires_in || 31536000) * 1000,
            displayName,
            avatarUrl
        });

        return new NextResponse(`
            <html>
            <body style="background:#111; color:white; font-family:sans-serif; text-align:center; padding-top:50px;">
                <h1 style="color:#4ade80">✅ Connected to TikTok</h1>
                <p>Account: <strong>${displayName}</strong></p>
                <p>You can close this window now.</p>
                <script>
                    if(window.opener) {
                        window.opener.postMessage({ type: 'tiktok-connected', displayName: '${displayName}' }, '*');
                    }
                    setTimeout(() => window.close(), 2000);
                </script>
            </body>
            </html>
        `, { headers: { 'Content-Type': 'text/html' } });

    } catch (error: any) {
        console.error("TikTok OAuth Error:", error);
        return new NextResponse(`
            <html>
            <body style="background:#111; color:white; font-family:sans-serif; text-align:center; padding-top:50px;">
                <h1 style="color:#f87171">❌ TikTok Authentication Failed</h1>
                <p>${error.message || 'Unknown error'}</p>
                <script>setTimeout(() => window.close(), 4000);</script>
            </body>
            </html>
        `, { headers: { 'Content-Type': 'text/html' } });
    }
}
