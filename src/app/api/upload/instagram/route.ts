import { NextResponse } from 'next/server';
import { IntegrationManager } from '@/lib/integrationManager';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Resolve ffmpeg binary path from node_modules
function getFfmpegPath(): string {
    const candidates = [
        path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
        path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error(`ffmpeg binary not found`);
}

// Convert video to Instagram-compatible MP4
function convertToMp4(inputPath: string): string {
    const dir = path.dirname(inputPath);
    const basename = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(dir, `${basename}_instagram.mp4`);

    if (fs.existsSync(outputPath)) {
        const inputMtime = fs.statSync(inputPath).mtimeMs;
        const outputMtime = fs.statSync(outputPath).mtimeMs;
        if (outputMtime > inputMtime) {
            console.log(`[Instagram Upload] Using cached MP4: ${outputPath}`);
            return outputPath;
        }
    }

    console.log(`[Instagram Upload] Converting to MP4...`);
    const cmd = `"${getFfmpegPath()}" -y -i "${inputPath}" -c:v libx264 -preset fast -r 30 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`;

    try {
        execSync(cmd, { stdio: 'pipe', timeout: 120000 });
        console.log(`[Instagram Upload] Conversion complete: ${fs.statSync(outputPath).size} bytes`);
        return outputPath;
    } catch (err: any) {
        console.error('[Instagram Upload] ffmpeg failed:', err.stderr?.toString() || err.message);
        throw new Error('Failed to convert video for Instagram');
    }
}

// Get ngrok public URL
async function getNgrokUrl(): Promise<string | null> {
    try {
        const res = await fetch('http://127.0.0.1:4040/api/tunnels');
        const data = await res.json();
        const tunnel = data.tunnels?.find((t: any) => t.proto === 'https') || data.tunnels?.[0];
        return tunnel?.public_url || null;
    } catch {
        return null;
    }
}

export async function POST(req: Request) {
    try {
        const { videoPath, caption } = await req.json();

        if (!videoPath) {
            return NextResponse.json({ error: "No video path provided" }, { status: 400 });
        }

        // Load tokens
        const tokens = await IntegrationManager.getTokens('Instagram');
        if (!tokens || !tokens.access_token || !tokens.ig_account_id) {
            return NextResponse.json({ error: "Instagram not connected. Please connect in Settings." }, { status: 401 });
        }

        // Resolve video file path
        const cleanPath = videoPath.startsWith('/') ? videoPath.slice(1) : videoPath;
        let absolutePath = path.join(process.cwd(), 'public', cleanPath);

        if (!fs.existsSync(absolutePath)) {
            const rootPath = path.join(process.cwd(), cleanPath);
            if (fs.existsSync(rootPath)) {
                absolutePath = rootPath;
            } else if (fs.existsSync(cleanPath)) {
                absolutePath = cleanPath;
            } else {
                return NextResponse.json({ error: `Video file not found at: ${absolutePath}` }, { status: 404 });
            }
        }

        // Convert to MP4 if needed
        let servePath = cleanPath;
        if (absolutePath.endsWith('.webm')) {
            const mp4Path = convertToMp4(absolutePath);
            // Update the serve path to point to the converted MP4
            const relativeMp4 = path.relative(path.join(process.cwd(), 'public'), mp4Path);
            servePath = relativeMp4.replace(/\\/g, '/');
        }

        // Instagram requires a PUBLIC URL - use ngrok
        const ngrokUrl = await getNgrokUrl();
        if (!ngrokUrl) {
            return NextResponse.json({
                error: "Instagram requires a public URL. Please start ngrok (share-app.bat) first."
            }, { status: 400 });
        }

        const publicUrl = `${ngrokUrl}/${servePath}`;
        console.log(`[Instagram Upload] Video URL: ${publicUrl}`);

        // Step 1: Create media container
        const containerRes = await fetch(
            `https://graph.facebook.com/v21.0/${tokens.ig_account_id}/media`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    media_type: 'REELS',
                    video_url: publicUrl,
                    caption: caption || '',
                    access_token: tokens.access_token
                })
            }
        );

        const containerData = await containerRes.json();
        console.log('[Instagram Upload] Container response:', JSON.stringify(containerData));

        if (containerData.error) {
            throw new Error(containerData.error.message || "Container creation failed");
        }

        const containerId = containerData.id;

        // Step 2: Wait for video processing (poll status)
        let publishReady = false;
        let attempts = 0;
        const maxAttempts = 60; // 5 min max

        while (!publishReady && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            attempts++;

            const statusRes = await fetch(
                `https://graph.facebook.com/v21.0/${containerId}?fields=status_code,status&access_token=${tokens.access_token}`
            );
            const statusData = await statusRes.json();
            console.log(`[Instagram Upload] Poll #${attempts}: ${statusData.status_code} - ${statusData.status || ''}`);

            if (statusData.status_code === 'FINISHED') {
                publishReady = true;
            } else if (statusData.status_code === 'ERROR') {
                throw new Error(`Instagram video processing failed: ${statusData.status || 'Unknown error'}`);
            }
        }

        if (!publishReady) {
            return NextResponse.json({ error: "Video processing timed out. Try again later." }, { status: 408 });
        }

        // Step 3: Publish
        const publishRes = await fetch(
            `https://graph.facebook.com/v21.0/${tokens.ig_account_id}/media_publish`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creation_id: containerId,
                    access_token: tokens.access_token
                })
            }
        );

        const publishData = await publishRes.json();
        console.log('[Instagram Upload] Publish response:', JSON.stringify(publishData));

        if (publishData.error) {
            throw new Error(publishData.error.message || "Publish failed");
        }

        return NextResponse.json({
            success: true,
            mediaId: publishData.id,
            url: `https://www.instagram.com/${tokens.username || ''}`
        });

    } catch (err: any) {
        console.error("Instagram Upload Failed:", err);
        return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
    }
}

