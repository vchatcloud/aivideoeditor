import { NextResponse } from 'next/server';
import { IntegrationManager } from '@/lib/integrationManager';

export async function POST(request: Request) {
    try {
        const { platform } = await request.json();

        if (!platform) {
            return NextResponse.json({ error: "Platform is required" }, { status: 400 });
        }

        await IntegrationManager.deleteTokens(platform);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Disconnect Error:", error);
        return NextResponse.json({ error: "Failed to disconnect" }, { status: 500 });
    }
}
