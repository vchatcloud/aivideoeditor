import { NextResponse } from 'next/server';
import { IntegrationManager } from '@/lib/integrationManager';

export async function GET() {
    const tokens = await IntegrationManager.getTokens('Instagram');

    if (!tokens) {
        return NextResponse.json({ connected: false });
    }

    // Check if token might be expired
    if (tokens.expires_at && Date.now() > tokens.expires_at) {
        return NextResponse.json({
            connected: false,
            error: 'Token expired. Please reconnect.'
        });
    }

    // Return cached status (avoid API call to save quota)
    return NextResponse.json({
        connected: true,
        username: tokens.username || 'Instagram Business',
        igAccountId: tokens.ig_account_id
    });
}

export async function DELETE() {
    await IntegrationManager.deleteTokens('Instagram');
    return NextResponse.json({ success: true });
}
