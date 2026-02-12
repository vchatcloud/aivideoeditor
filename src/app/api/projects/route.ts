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
        const { id, name, sceneItems, settings, archiveType = 'pre' } = await request.json();

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

            if (archiveType === 'pre' || archiveType === 'snapshot') {
                // Determine what to archive
                let historyEntry;

                if (archiveType === 'snapshot') {
                    // Snapshot: Archive the *New* State (Post-update)
                    // Use Version Memo as Name if present
                    historyEntry = {
                        timestamp: new Date().toISOString(),
                        name: settings.saveMemo || name || "Snapshot",
                        sceneItems: updatedSceneItems, // Use updated items
                        settings: settings
                    };
                } else {
                    // Pre: Archive the *Old* State (Pre-update) - Standard Safety
                    historyEntry = {
                        timestamp: new Date().toISOString(),
                        name: JSON.parse(currentRecord.get('Settings') as string || '{}').saveMemo || "Auto-Save",
                        sceneItems: JSON.parse(currentRecord.get('SceneItems') as string || '[]'),
                        settings: JSON.parse(currentRecord.get('Settings') as string || '{}')
                    };
                }

                history.unshift(historyEntry);
            }

            const limitedHistory = history.slice(0, 50); // Keep last 50 versions (increased)

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
                title: record.get('Name'), // Alias for UI compatibility
                sceneItems: JSON.parse(record.get('SceneItems') as string || '[]'),
                settings: settings,
                history: history,
                createdAt: (record as any)._rawJson?.createdTime || new Date().toISOString(),
                updatedAt: settings.lastModified || (record as any)._rawJson?.createdTime || new Date().toISOString(),
                uploads: settings.uploads || [],
                duration: settings.totalDuration || 0,
                saveMemo: settings.saveMemo || "",
                videoPath: `/projects/${record.id}/video.webm`,
                usage: settings.usage || {},
                scenes: JSON.parse(record.get('SceneItems') as string || '[]')
            });
        } else {
            // List all projects with creation time
            const records = await base('Projects').select({
                maxRecords: 200,
                sort: [{ field: "Name", direction: "desc" }],
                // Removed 'view' to prevent view-level filters from hiding records
            }).all();

            const projects = records.map(record => {
                const settingsStr = record.get('Settings') as string;
                let lastModified = null;
                let deleted = false;
                let saveMemo = ""; // New field
                let uploads = []; // New field
                try {
                    const s = JSON.parse(settingsStr || '{}');
                    lastModified = s.lastModified;
                    deleted = s.deleted || false;
                    saveMemo = s.saveMemo || ""; // Extract memo
                    uploads = s.uploads || []; // Extract uploads
                } catch (e) { }

                return {
                    id: record.id,
                    name: record.get('Name'),
                    title: record.get('Name'), // Alias for UI compatibility
                    createdAt: (record as any)._rawJson?.createdTime || new Date().toISOString(),
                    updatedAt: lastModified || (record as any)._rawJson?.createdTime || new Date().toISOString(),
                    saveMemo, // Return memo
                    uploads, // Return uploads
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
        const historyTimestamp = searchParams.get('historyTimestamp');

        if (!id) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
        }

        const record = await base('Projects').find(id);

        if (historyTimestamp) {
            // --- DELETE HISTORY ITEM ---
            const currentHistoryStr = (record.get('History') as string) || '[]';
            let history: any[] = [];
            try {
                history = JSON.parse(currentHistoryStr);
            } catch (e) {
                history = [];
            }

            // Filter out the item with matching timestamp
            const newHistory = history.filter((h: any) => h.timestamp !== historyTimestamp);

            await base('Projects').update(id, {
                "History": JSON.stringify(newHistory)
            });

            return NextResponse.json({ success: true, history: newHistory });

        } else {
            // --- SOFT DELETE PROJECT ---
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
        }

    } catch (error: any) {
        console.error('Airtable Delete Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
