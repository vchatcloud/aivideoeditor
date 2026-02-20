import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
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
    throw new Error(`ffmpeg binary not found. Searched: ${candidates.join(', ')}`);
}

export async function POST(req: Request) {
    const tmpDir = os.tmpdir();
    const timestamp = Date.now();
    const inputPath = path.join(tmpDir, `convert_input_${timestamp}.webm`);
    const outputPath = path.join(tmpDir, `convert_output_${timestamp}.mp4`);

    try {
        const formData = await req.formData();
        const file = formData.get('video') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
        }

        // Write uploaded WebM to temp file
        const arrayBuffer = await file.arrayBuffer();
        fs.writeFileSync(inputPath, Buffer.from(arrayBuffer));
        console.log(`[Convert] Input saved: ${inputPath} (${fs.statSync(inputPath).size} bytes)`);

        // Convert WebM → MP4 using ffmpeg
        const ffmpegPath = getFfmpegPath();
        const cmd = `"${ffmpegPath}" -y -i "${inputPath}" -c:v libx264 -preset fast -r 30 -pix_fmt yuv420p -c:a aac -b:a 128k -movflags +faststart "${outputPath}"`;

        console.log(`[Convert] Running ffmpeg...`);
        execSync(cmd, { stdio: 'pipe', timeout: 300000 }); // 5 min timeout
        console.log(`[Convert] Output: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);

        // Read converted file and return as response
        const mp4Buffer = fs.readFileSync(outputPath);

        // Cleanup temp files
        try { fs.unlinkSync(inputPath); } catch (_) { }
        try { fs.unlinkSync(outputPath); } catch (_) { }

        return new Response(mp4Buffer, {
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': 'attachment; filename="video.mp4"',
                'Content-Length': mp4Buffer.length.toString(),
            },
        });

    } catch (error: any) {
        console.error('[Convert] Error:', error.message);

        // Cleanup on error
        try { fs.unlinkSync(inputPath); } catch (_) { }
        try { fs.unlinkSync(outputPath); } catch (_) { }

        return NextResponse.json(
            { error: error.message || 'Video conversion failed' },
            { status: 500 }
        );
    }
}

// App Router route segment config (max 5 min for video conversion)
export const maxDuration = 300;
