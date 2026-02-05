
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const { id, title } = await req.json();

        if (!id || !title) {
            return NextResponse.json({ error: 'ID and Title are required' }, { status: 400 });
        }

        const projectDir = path.join(process.cwd(), 'public', 'projects', id);
        const metaPath = path.join(projectDir, 'meta.json');

        if (!fs.existsSync(metaPath)) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const metaContent = fs.readFileSync(metaPath, 'utf-8');
        const meta = JSON.parse(metaContent);

        // If it's the first time renaming and groupTitle is missing,
        // pin the current title as the groupTitle so it stays in the same folder.
        if (!meta.groupTitle) {
            meta.groupTitle = meta.title || "Untitled Project";
        }

        // Update individual title
        meta.title = title;

        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

        return NextResponse.json({ success: true, project: meta });
    } catch (error) {
        console.error('Error updating project:', error);
        return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }
}
