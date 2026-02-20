import { NextResponse } from 'next/server';
import Airtable from 'airtable';

const getAirtableBase = () => {
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!apiKey || !baseId) {
        throw new Error('Airtable configuration missing.');
    }

    return new Airtable({ apiKey }).base(baseId);
};

export async function GET() {
    try {
        const base = getAirtableBase();
        const records = await base('Sites').select({
            sort: [{ field: "Created", direction: "desc" }]
        }).all();

        // Build flat list first
        const allSites = records.map(record => ({
            id: record.id,
            name: record.get('Name') as string || '',
            url: record.get('Url') as string || '',
            type: (record.get('Type') as string || 'single').toLowerCase(),
            parentId: record.get('ParentId') as string || '',
            enabled: record.get('Enabled') !== false, // default true
            prompt: record._rawJson?.fields?.Prompt as string || undefined,
            topN: record._rawJson?.fields?.TopN as number || undefined,
        }));

        // Build tree: group parents with their children
        const parentSites = allSites.filter(s => !s.parentId);
        const childSites = allSites.filter(s => !!s.parentId);

        const sites = parentSites.map(parent => {
            if (parent.type === 'group') {
                const boards = childSites
                    .filter(c => c.parentId === parent.id)
                    .map(c => ({ id: c.id, name: c.name, url: c.url, enabled: c.enabled }));
                return { ...parent, boards };
            }
            return { ...parent, boards: [] };
        });

        return NextResponse.json(sites);
    } catch (error: any) {
        console.error('Airtable Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const base = getAirtableBase();
        const { name, url, type, boards, prompt, topN } = await request.json();

        if (type === 'group' && boards && Array.isArray(boards)) {
            // Create parent site
            const parentRecord = await base('Sites').create({
                "Name": name,
                "Url": url,
                "Type": "group"
            });

            // Create child boards
            const childRecords = [];
            for (const board of boards) {
                const child = await base('Sites').create({
                    "Name": board.name,
                    "Url": board.url,
                    "Type": "board",
                    "ParentId": parentRecord.id,
                    "Enabled": true
                });
                childRecords.push({
                    id: child.id,
                    name: child.get('Name'),
                    url: child.get('Url'),
                    enabled: true
                });
            }

            return NextResponse.json({
                success: true,
                id: parentRecord.id,
                name: parentRecord.get('Name'),
                url: parentRecord.get('Url'),
                type: 'group',
                boards: childRecords
            });
        } else if (type === 'ai') {
            const payload = {
                "Name": name,
                "Url": url,
                "Type": "ai",
            } as any;
            if (prompt) payload["Prompt"] = prompt;
            if (topN) payload["TopN"] = topN;

            try {
                const records = await base('Sites').create([
                    { fields: payload }
                ]);
                const record = records[0];
                return NextResponse.json({
                    success: true,
                    id: record.id,
                    name: record.get('Name'),
                    url: record.get('Url'),
                    type: 'ai',
                    prompt: record._rawJson?.fields?.Prompt,
                    topN: record._rawJson?.fields?.TopN
                });
            } catch (err: any) {
                if (err.message?.includes('Unknown field name: "Prompt"')) {
                    return NextResponse.json({ error: 'Airtable에 "Prompt" 와 "TopN" 필드를 먼저 생성해주세요.' }, { status: 422 });
                }
                throw err;
            }
        } else {
            // Single site (existing behavior)
            const record = await base('Sites').create({
                "Name": name,
                "Url": url,
                "Type": "single"
            });

            return NextResponse.json({
                success: true,
                id: record.id,
                name: record.get('Name'),
                url: record.get('Url'),
                type: 'single',
                boards: []
            });
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
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        // Check if this is a group site — if so, delete all children first
        const records = await base('Sites').select({
            filterByFormula: `{ParentId} = "${id}"`
        }).all();

        if (records.length > 0) {
            // Delete children in batches of 10 (AirTable limit)
            const childIds = records.map(r => r.id);
            for (let i = 0; i < childIds.length; i += 10) {
                const batch = childIds.slice(i, i + 10);
                await base('Sites').destroy(batch);
            }
        }

        // Delete the parent/single site
        await base('Sites').destroy(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Airtable Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const base = getAirtableBase();
        const { id, name, url, enabled, prompt, topN } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const fields: Record<string, any> = {};
        if (name !== undefined) fields["Name"] = name;
        if (url !== undefined) fields["Url"] = url;
        if (enabled !== undefined) fields["Enabled"] = enabled;
        if (prompt !== undefined) fields["Prompt"] = prompt;
        if (topN !== undefined) fields["TopN"] = topN;

        try {
            const record = await base('Sites').update(id, fields);
            return NextResponse.json({
                success: true,
                id: record.id,
                name: record.get('Name'),
                url: record.get('Url'),
                type: (record.get('Type') as string || 'single').toLowerCase(),
                enabled: record.get('Enabled') !== false,
                prompt: record._rawJson?.fields?.Prompt,
                topN: record._rawJson?.fields?.TopN
            });
        } catch (err: any) {
            if (err.message?.includes('Unknown field name: "Prompt"')) {
                return NextResponse.json({ error: 'Airtable에 "Prompt" 필드가 없습니다.' }, { status: 422 });
            }
            throw err;
        }
    } catch (error: any) {
        console.error('Airtable Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Add a board to an existing group
export async function PATCH(request: Request) {
    try {
        const base = getAirtableBase();
        const { action, parentId, boards } = await request.json();

        if (action === 'add-boards' && parentId && boards && Array.isArray(boards)) {
            const created = [];
            for (const board of boards) {
                const child = await base('Sites').create({
                    "Name": board.name,
                    "Url": board.url,
                    "Type": "board",
                    "ParentId": parentId,
                    "Enabled": true
                });
                created.push({
                    id: child.id,
                    name: child.get('Name'),
                    url: child.get('Url'),
                    enabled: true
                });
            }
            return NextResponse.json({ success: true, boards: created });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error: any) {
        console.error('Airtable Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
