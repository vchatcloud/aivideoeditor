import { NextResponse } from 'next/server';
import Airtable from 'airtable';
import fs from 'fs';
import path from 'path';

const getAirtableBase = () => {
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!apiKey || !baseId) {
        throw new Error('Airtable configuration missing. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID to your .env.local file.');
    }

    return new Airtable({ apiKey }).base(baseId);
};

// Helper to copy generated images to project folder
const saveProjectImages = (projectId: string, sceneItems: any[]) => {
    try {
        const projectDir = path.join(process.cwd(), 'public', 'projects', projectId, 'images');
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
        }

        let hasChanges = false;
        const updatedSceneItems = sceneItems.map(scene => {
            if (scene.imageUrl && typeof scene.imageUrl === 'string' && scene.imageUrl.startsWith('/generated/')) {
                const oldValue = scene.imageUrl;
                const filename = path.basename(oldValue);
                const sourcePath = path.join(process.cwd(), 'public', oldValue);
                const destPath = path.join(projectDir, filename);

                // Only copy if source exists (it might be missing if server restarted and tmp cleaned)
                if (fs.existsSync(sourcePath)) {
                    // Copy file (don't move, to keep cache valid for current session)
                    try {
                        fs.copyFileSync(sourcePath, destPath);
                        hasChanges = true;
                        // Update URL to permanent path
                        return { ...scene, imageUrl: `/projects/${projectId}/images/${filename}` };
                    } catch (err) {
                        console.error(`Failed to copy image ${filename}:`, err);
                        return scene;
                    }
                }
            }
            return scene;
        });

        return { updatedSceneItems, hasChanges };
    } catch (e) {
        console.error("Error in saveProjectImages:", e);
        return { updatedSceneItems: sceneItems, hasChanges: false };
    }
};

export async function POST(request: Request) {
    try {
        const base = getAirtableBase();
        const { id, name, sceneItems, settings } = await request.json();

        // Check if ID is a valid Airtable ID (starts with 'rec')
        // If it's a UUID (from local FS), we should create a new record in Airtable instead of updating
        if (id && id.startsWith('rec')) {
            // --- UPDATE EXISTING PROJECT ---

            // 1. Save images first to get permanent URLs
            const { updatedSceneItems } = saveProjectImages(id, sceneItems);

            // Get current record to archive it to History
            const currentRecord = await base('Projects').find(id);
            const currentHistoryStr = (currentRecord.get('History') as string) || '[]';
            let history = [];
            try {
                history = JSON.parse(currentHistoryStr);
            } catch (e) {
                history = [];
            }

            // Inject lastModified timestamp
            settings.lastModified = new Date().toISOString();

            // Capture current (pre-update) state as a history entry
            const historyEntry = {
                timestamp: new Date().toISOString(),
                name: currentRecord.get('Name'),
                sceneItems: JSON.parse(currentRecord.get('SceneItems') as string || '[]'),
                settings: JSON.parse(currentRecord.get('Settings') as string || '{}')
            };

            history.unshift(historyEntry);
            const limitedHistory = history.slice(0, 10); // Keep last 10 versions

            // Update existing record
            const record = await base('Projects').update(id, {
                "Name": name || "Untitled Project",
                "SceneItems": JSON.stringify(updatedSceneItems),
                "Settings": JSON.stringify(settings),
                "History": JSON.stringify(limitedHistory)
            });
            return NextResponse.json({ success: true, id: record.id });
        } else {
            // --- CREATE NEW PROJECT ---

            // Inject lastModified timestamp
            settings.lastModified = new Date().toISOString();

            // Create new record first (to get the ID)
            const record = await base('Projects').create({
                "Name": name || "Untitled Project",
                "SceneItems": JSON.stringify(sceneItems), // Temp save
                "Settings": JSON.stringify(settings),
                "History": "[]"
            });
            const newId = record.id;

            // Now save images using the new ID
            const { updatedSceneItems, hasChanges } = saveProjectImages(newId, sceneItems);

            // If images were saved, update the record with new URLs
            if (hasChanges) {
                await base('Projects').update(newId, {
                    "SceneItems": JSON.stringify(updatedSceneItems)
                });
            }

            return NextResponse.json({ success: true, id: newId });
        }
    } catch (error: any) {
        console.error('Airtable Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const base = getAirtableBase();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (id) {
            // Get single project with history
            const record = await base('Projects').find(id);
            let history = [];
            try {
                history = JSON.parse(record.get('History') as string || '[]');
            } catch (e) { }

            const settings = JSON.parse(record.get('Settings') as string || '{}');

            return NextResponse.json({
                id: record.id,
                name: record.get('Name'),
                sceneItems: JSON.parse(record.get('SceneItems') as string || '[]'),
                settings: settings,
                history: history,
                createdAt: (record as any).createdTime,
                updatedAt: settings.lastModified || (record as any).createdTime
            });
        } else {
            // List all projects with creation time
            const records = await base('Projects').select({
                maxRecords: 50, // Increased limit
                sort: [{ field: "Name", direction: "desc" }], // Or any sort
                view: "Grid view",
            }).firstPage();

            const projects = records.map(record => {
                const settingsStr = record.get('Settings') as string;
                let lastModified = null;
                let deleted = false;
                let saveMemo = ""; // New field
                try {
                    const s = JSON.parse(settingsStr || '{}');
                    lastModified = s.lastModified;
                    deleted = s.deleted || false;
                    saveMemo = s.saveMemo || ""; // Extract memo
                } catch (e) { }

                return {
                    id: record.id,
                    name: record.get('Name'),
                    createdAt: (record as any)._rawJson?.createdTime || new Date().toISOString(),
                    updatedAt: lastModified || (record as any)._rawJson?.createdTime || new Date().toISOString(),
                    saveMemo, // Return memo
                    deleted: deleted
                };
            });
            // Sort by createdAt descending (assuming ID or createdTime roughly corresponds)
            // Airtable sort is handy but doing it in memory for custom fields is safer
            const sortedProjects = projects
                .filter(p => !p.deleted) // Soft Delete Filter
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return NextResponse.json(sortedProjects);
        }
    } catch (error: any) {
        console.error('Airtable Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const base = getAirtableBase();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        // Soft Delete: Fetch, Update Settings, Save
        const record = await base('Projects').find(id);
        const settingsStr = record.get('Settings') as string || '{}';
        let settings = {};
        try {
            settings = JSON.parse(settingsStr);
        } catch (e) { }

        // Mark as deleted
        (settings as any).deleted = true;
        (settings as any).deletedAt = new Date().toISOString();

        await base('Projects').update(id, {
            "Settings": JSON.stringify(settings)
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Airtable Delete Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
