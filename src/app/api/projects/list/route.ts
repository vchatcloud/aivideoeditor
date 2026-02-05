import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
    try {
        const projectsDir = path.join(process.cwd(), 'public', 'projects');

        if (!fs.existsSync(projectsDir)) {
            return NextResponse.json({ projects: [] });
        }

        const { searchParams } = new URL(req.url);
        const queryId = searchParams.get('id');

        const projectFolders = fs.readdirSync(projectsDir);
        const projects = [];

        for (const folder of projectFolders) {
            // Optimization: If ID is provided, skip non-matching folders if folder name is ID
            if (queryId && folder !== queryId) continue;

            const metaPath = path.join(projectsDir, folder, 'meta.json');
            if (fs.existsSync(metaPath)) {
                try {
                    const metaContent = fs.readFileSync(metaPath, 'utf-8');
                    const meta = JSON.parse(metaContent);
                    projects.push(meta);
                } catch (e) {
                    console.warn(`Failed to parse metadata for project ${folder}`, e);
                }
            }
        }

        // If queryId is provided, return single object instead of array (to match frontend expectation?)
        // Wait, standard REST usually returns object for /id.
        // Frontend expects: `const data = await res.json();` -> `data.id`, `data.settings` etc.
        // So I should return the first (and only) project object if ID matches.
        if (queryId) {
            if (projects.length > 0) return NextResponse.json(projects[0]);
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        // Sort by Date DESC
        projects.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ projects });
    } catch (error) {
        console.error('Error listing projects:', error);
        return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
    }
}
