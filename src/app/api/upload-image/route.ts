import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// POST — Upload an image (base64) and return a permanent server URL
export async function POST(request: Request) {
    try {
        const { base64, mimeType } = await request.json();

        if (!base64) {
            return NextResponse.json({ error: 'Missing base64 data' }, { status: 400 });
        }

        const ext = (mimeType || 'image/jpeg').includes('png') ? 'png' : 'jpg';
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const filename = `img_${timestamp}_${randomSuffix}.${ext}`;

        const uploadDir = path.join(process.cwd(), 'public', 'generated');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const buffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(path.join(uploadDir, filename), buffer);

        return NextResponse.json({ url: `/generated/${filename}` });
    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
