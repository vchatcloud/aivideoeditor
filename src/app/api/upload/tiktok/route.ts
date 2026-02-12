import { NextResponse } from 'next/server';
import { IntegrationManager } from '@/lib/integrationManager';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Resolve ffmpeg binary path directly from node_modules
function getFfmpegPath(): string {
    // Try multiple possible locations
    const candidates = [
        path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe'),
        path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg'),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error(`ffmpeg binary not found. Searched: ${candidates.join(', ')}`);
}

/**
 * Convert video to TikTok-compatible MP4 (H.264, 30fps, AAC audio)
 * Returns the path to the converted file
 */
function convertToTikTokFormat(inputPath: string): string {
    const dir = path.dirname(inputPath);
    const basename = path.basename(inputPath, path.extname(inputPath));
    const outputPath = path.join(dir, `${basename}_tiktok.mp4`);

    // Skip conversion if already converted
    if (fs.existsSync(outputPath)) {
        const inputMtime = fs.statSync(inputPath).mtimeMs;
        const outputMtime = fs.statSync(outputPath).mtimeMs;
        if (outputMtime > inputMtime) {
            console.log(`[TikTok Upload] Using cached converted file: ${outputPath}`);
            return outputPath;
        }
    }

    console.log(`[TikTok Upload] Converting ${inputPath} → MP4 (H.264, 30fps)...`);

    const cmd = `"${getFfmpegPath()}" -y -i "${inputPath}" -c:v libx264 -preset fast -r 30 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`;

    try {
        execSync(cmd, { stdio: 'pipe', timeout: 120000 }); // 2 min timeout
        console.log(`[TikTok Upload] Conversion complete: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
        return outputPath;
    } catch (err: any) {
        console.error('[TikTok Upload] ffmpeg conversion failed:', err.stderr?.toString() || err.message);
        throw new Error('Failed to convert video for TikTok: ' + (err.stderr?.toString()?.slice(-200) || err.message));
    }
}

export async function POST(req: Request) {
    try {
        const { videoPath, title, description, privacyLevel } = await req.json();

        if (!videoPath) {
            return NextResponse.json({ error: "No video path provided" }, { status: 400 });
        }

        // Load tokens
        const tokens = await IntegrationManager.getTokens('TikTok');
        if (!tokens || !tokens.access_token) {
            return NextResponse.json({ error: "TikTok not connected. Please connect in Settings." }, { status: 401 });
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

        // Convert to TikTok-compatible MP4 format (H.264, 30fps)
        const mp4Path = convertToTikTokFormat(absolutePath);
        const fileSize = fs.statSync(mp4Path).size;
        const videoBuffer = fs.readFileSync(mp4Path);

        // Step 1: Initialize upload (FILE_UPLOAD method for direct upload)
        // Note: For unaudited/sandbox apps, privacy_level MUST be SELF_ONLY
        //       and the posting account MUST be private
        const initBody = {
            post_info: {
                title: (title || '').substring(0, 150),
                privacy_level: 'SELF_ONLY',
                disable_duet: false,
                disable_comment: false,
                disable_stitch: false,
            },
            source_info: {
                source: 'FILE_UPLOAD',
                video_size: fileSize,
                chunk_size: fileSize,
                total_chunk_count: 1
            }
        };

        console.log('[TikTok Upload] Init request body:', JSON.stringify(initBody, null, 2));

        const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${tokens.access_token}`,
                'Content-Type': 'application/json; charset=UTF-8'
            },
            body: JSON.stringify(initBody)
        });

        const initData = await initRes.json();
        console.log('[TikTok Upload] Init response:', JSON.stringify(initData, null, 2));

        if ((initData.error?.code && initData.error.code !== 'ok') || !initData.data?.upload_url) {
            throw new Error(initData.error?.message || JSON.stringify(initData.error) || "Failed to initialize TikTok upload");
        }

        const uploadUrl = initData.data.upload_url;
        const publishId = initData.data.publish_id;

        // Step 2: Upload video chunk
        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
                'Content-Length': String(fileSize)
            },
            body: videoBuffer
        });

        console.log(`[TikTok Upload] Chunk upload response: ${uploadRes.status} ${uploadRes.statusText}`);
        const uploadResText = await uploadRes.text();
        console.log(`[TikTok Upload] Chunk upload body: ${uploadResText}`);

        if (!uploadRes.ok) {
            throw new Error(`Video chunk upload failed: ${uploadRes.status} ${uploadRes.statusText} - ${uploadResText}`);
        }

        // Step 3: Check publish status (poll)
        // TikTok statuses: PROCESSING_UPLOAD, PROCESSING_DOWNLOAD, PROCESSING, PUBLISH_COMPLETE, FAILED
        console.log(`[TikTok Upload] Starting publish status polling for publishId: ${publishId}`);
        let publishStatus = 'PROCESSING_UPLOAD';
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes max (60 * 5s)
        let lastStatusData: any = null;

        const isProcessing = (status: string) =>
            status.startsWith('PROCESSING') || status === 'SENDING_TO_USER_INBOX';

        while (isProcessing(publishStatus) && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000)); // 5s intervals
            attempts++;

            const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokens.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ publish_id: publishId })
            });
            lastStatusData = await statusRes.json();
            publishStatus = lastStatusData.data?.status || 'PROCESSING';

            console.log(`[TikTok Upload] Poll #${attempts}: status=${publishStatus}, uploaded_bytes=${lastStatusData.data?.uploaded_bytes || 'N/A'}`);

            if (publishStatus === 'PUBLISH_COMPLETE') {
                console.log('[TikTok Upload] ✅ Publish complete!');
                return NextResponse.json({
                    success: true,
                    publishId,
                    url: `https://www.tiktok.com/@${tokens.displayName || 'user'}`
                });
            } else if (publishStatus === 'FAILED') {
                const failReason = lastStatusData.data?.fail_reason || "Unknown reason";
                console.error(`[TikTok Upload] ❌ Publish FAILED: ${failReason}`);
                throw new Error(`TikTok publish failed: ${failReason}`);
            }
        }

        // If still processing after max attempts
        console.warn(`[TikTok Upload] ⚠️ Still PROCESSING after ${maxAttempts} attempts. Last response:`, JSON.stringify(lastStatusData));
        return NextResponse.json({
            success: false,
            publishId,
            note: "Video is still processing on TikTok after 90 seconds. It may appear later, or may have failed silently.",
            lastStatus: lastStatusData
        });

    } catch (err: any) {
        console.error("TikTok Upload Failed:", err);
        return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
    }
}
