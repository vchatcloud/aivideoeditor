
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function DELETE(req: NextRequest) {
    try {
        const { id } = await req.json();
        if (!id) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const projectDir = path.join(process.cwd(), 'public', 'projects', id);

        if (!fs.existsSync(projectDir)) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Delete the directory recursively
        fs.rmSync(projectDir, { recursive: true, force: true });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting project:', error);
        return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
    }
}
