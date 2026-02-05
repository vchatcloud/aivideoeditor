
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const bgmDir = path.join(process.cwd(), 'public', 'bgm');

        if (!fs.existsSync(bgmDir)) {
            // Create if it doesn't exist, though user said files are there.
            // Just return empty if not found.
            return NextResponse.json([]);
        }

        const files = fs.readdirSync(bgmDir)
            .filter(file => file.toLowerCase().endsWith('.mp3'))
            .map(file => ({
                name: file,
                url: `/bgm/${file}`
            }));

        return NextResponse.json(files);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
