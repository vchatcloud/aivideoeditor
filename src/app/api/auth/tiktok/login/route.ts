import { NextResponse } from 'next/server';
import crypto from 'crypto';

// Store PKCE values temporarily (in-memory for dev)
let storedCodeVerifier = '';
let storedRedirectUri = '';

export function getCodeVerifier() {
    return storedCodeVerifier;
}

export function getRedirectUri() {
    return storedRedirectUri;
}

export async function GET(request: Request) {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    if (!clientKey || !clientSecret) {
        return NextResponse.json({ error: "TikTok Client Key/Secret not configured. Please add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET to .env.local" }, { status: 500 });
    }

    // Use explicit env var, or fall back to request-based detection
    const redirectUri = process.env.TIKTOK_REDIRECT_URI
        || `${new URL(request.url).origin}/api/auth/tiktok/callback`;

    const scope = 'user.info.basic,video.publish,video.upload';
    const state = crypto.randomBytes(16).toString('hex');

    // Generate PKCE code_verifier and code_challenge
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
        .createHash('sha256')
        .update(codeVerifier)
        .digest('base64url');

    // Store for the callback to use
    storedCodeVerifier = codeVerifier;
    storedRedirectUri = redirectUri;

    console.log('[TikTok Login] Redirect URI:', redirectUri);

    const params = new URLSearchParams({
        client_key: clientKey,
        scope,
        response_type: 'code',
        redirect_uri: redirectUri,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
    });

    const url = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;

    return NextResponse.redirect(url);
}
