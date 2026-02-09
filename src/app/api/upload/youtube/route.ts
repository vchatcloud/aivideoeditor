import { NextResponse } from 'next/server';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { IntegrationManager } from '@/lib/integrationManager';

export async function POST(req: Request) {
    try {
        const { videoPath, title, description, tags, privacyStatus } = await req.json();

        if (!videoPath) {
            return NextResponse.json({ error: "No video path provided" }, { status: 400 });
        }

        // Resolve Video Path
        // videoPath usually comes as "/projects/..." or "projects/..." from the frontend
        // We assume it serves from the public directory.
        // Remove leading slash if present for path joining
        const cleanPath = videoPath.startsWith('/') ? videoPath.slice(1) : videoPath;
        let absolutePath = path.join(process.cwd(), 'public', cleanPath);

        // If file doesn't exist in public, check if it's already an absolute path or relative to root (unlikely for web usage but possible in local app)
        if (!fs.existsSync(absolutePath)) {
            // Try relative to project root
            const rootPath = path.join(process.cwd(), cleanPath);
            if (fs.existsSync(rootPath)) {
                absolutePath = rootPath;
            } else {
                // Try assuming it's a raw absolute path (if user provided it somehow, though less likely from web context)
                if (fs.existsSync(cleanPath)) {
                    absolutePath = cleanPath;
                } else {
                    return NextResponse.json({ error: `Video file not found at: ${absolutePath}` }, { status: 404 });
                }
            }
        }

        // Load Tokens
        // Load Tokens
        const tokens = await IntegrationManager.getTokens('YouTube');
        if (!tokens) {
            return NextResponse.json({ error: "YouTube account not connected. Please connect in settings." }, { status: 401 });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.YOUTUBE_CLIENT_ID,
            process.env.YOUTUBE_CLIENT_SECRET
        );
        oauth2Client.setCredentials(tokens);

        // Auto-save refreshed tokens
        oauth2Client.on('tokens', (newTokens) => {
            const merged = { ...tokens, ...newTokens };
            IntegrationManager.saveTokens('YouTube', merged);
        });

        const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

        // Upload
        // Get file size for better upload handling
        const fileSize = fs.statSync(absolutePath).size;

        const res = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title: title ? title.substring(0, 100) : "Untitled Video",
                    description: description ? description.substring(0, 5000) : "",
                    tags: tags,
                },
                status: {
                    privacyStatus: privacyStatus || 'private'
                }
            },
            media: {
                body: fs.createReadStream(absolutePath)
            }
        });

        const videoId = res.data.id;
        if (!videoId) {
            throw new Error("Upload succeeded but no Video ID returned.");
        }

        return NextResponse.json({
            success: true,
            url: `https://youtu.be/${videoId}`,
            videoId: videoId
        });

    } catch (err: any) {
        console.error("YouTube Upload Failed:", err);
        return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
    }
}
