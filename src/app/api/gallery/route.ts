import { NextResponse } from 'next/server';
import Airtable from 'airtable';

const getAirtableBase = () => {
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!apiKey || !baseId) {
        throw new Error('Airtable configuration missing. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID to your .env.local file.');
    }

    return new Airtable({ apiKey }).base(baseId);
};

const TABLE_NAME = 'Gallery';

// --- CREATE or UPDATE gallery record ---
export async function POST(request: Request) {
    try {
        const base = getAirtableBase();
        const body = await request.json();
        const {
            id,           // existing Gallery record ID (for update)
            projectId,    // linked Projects table rec ID
            title,
            groupTitle,
            videoPath,
            thumbnailPath,
            duration,
            scriptCost,
            imageCost,
            audioCost,
            totalCost,
            sceneCount,
        } = body;

        const fields: Record<string, any> = {
            "Title": title || "Untitled Project",
            "GroupTitle": groupTitle || title || "Untitled",
            "VideoPath": videoPath || "",
            "ThumbnailPath": thumbnailPath || "",
            "Duration": duration || 0,
            "ScriptCost": Math.round(scriptCost || 0),
            "ImageCost": Math.round(imageCost || 0),
            "AudioCost": Math.round(audioCost || 0),
            "TotalCost": Math.round(totalCost || 0),
            "SceneCount": sceneCount || 0,
            "Status": "active",
        };

        if (projectId) {
            fields["ProjectId"] = projectId;
        }

        if (id && id.startsWith('rec')) {
            // --- UPDATE ---
            const record = await base(TABLE_NAME).update(id, fields);
            return NextResponse.json({ success: true, id: record.id });
        } else {
            // --- CREATE ---
            const record = await base(TABLE_NAME).create(fields);
            return NextResponse.json({ success: true, id: record.id });
        }
    } catch (error: any) {
        console.error('Gallery API POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// --- LIST or GET single gallery record ---
export async function GET(request: Request) {
    try {
        const base = getAirtableBase();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (id) {
            // Get single record
            const record = await base(TABLE_NAME).find(id);
            return NextResponse.json({
                id: record.id,
                title: record.get('Title'),
                groupTitle: record.get('GroupTitle'),
                projectId: record.get('ProjectId'),
                videoPath: record.get('VideoPath'),
                thumbnailPath: record.get('ThumbnailPath'),
                duration: record.get('Duration'),
                scriptCost: record.get('ScriptCost'),
                imageCost: record.get('AudioCost'),
                audioCost: record.get('AudioCost'),
                totalCost: record.get('TotalCost'),
                sceneCount: record.get('SceneCount'),
                status: record.get('Status'),
                createdAt: (record as any)._rawJson?.createdTime || new Date().toISOString(),
            });
        } else {
            // List all active gallery records
            const records = await base(TABLE_NAME).select({
                maxRecords: 500,
                sort: [{ field: "Title", direction: "desc" }],
            }).all();

            const items = records
                .map(record => ({
                    id: record.id,
                    title: record.get('Title') as string || "Untitled",
                    groupTitle: record.get('GroupTitle') as string || "Untitled",
                    projectId: record.get('ProjectId') as string || "",
                    videoPath: record.get('VideoPath') as string || "",
                    thumbnailPath: record.get('ThumbnailPath') as string || "",
                    duration: (record.get('Duration') as number) || 0,
                    usage: {
                        scriptCost: (record.get('ScriptCost') as number) || 0,
                        imageCost: (record.get('ImageCost') as number) || 0,
                        audioCost: (record.get('AudioCost') as number) || 0,
                        totalCost: (record.get('TotalCost') as number) || 0,
                    },
                    sceneCount: (record.get('SceneCount') as number) || 0,
                    status: record.get('Status') as string || "active",
                    createdAt: (record as any)._rawJson?.createdTime || new Date().toISOString(),
                }))
                .filter(item => item.status !== 'deleted')
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return NextResponse.json({ projects: items });
        }
    } catch (error: any) {
        console.error('Gallery API GET Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// --- DELETE (soft) gallery record ---
export async function DELETE(request: Request) {
    try {
        const base = getAirtableBase();
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Gallery record ID is required' }, { status: 400 });
        }

        // Soft delete by setting status
        await base(TABLE_NAME).update(id, {
            "Status": "deleted"
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Gallery API DELETE Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
