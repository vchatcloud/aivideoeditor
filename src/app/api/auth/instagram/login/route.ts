import { NextResponse } from 'next/server';

export async function GET() {
    const clientId = process.env.INSTAGRAM_APP_ID;
    const clientSecret = process.env.INSTAGRAM_APP_SECRET;

    if (!clientId || !clientSecret) {
        return NextResponse.json({ error: "Instagram App ID/Secret not configured. Please add INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET to .env.local" }, { status: 500 });
    }

    const redirectUri = 'http://localhost:3000/api/auth/instagram/callback';
    const scopes = [
        'instagram_basic',
        'instagram_content_publish',
        'pages_show_list',
        'pages_read_engagement',
        'business_management'
    ].join(',');

    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&response_type=code&auth_type=rerequest`;

    return NextResponse.redirect(url);
}
