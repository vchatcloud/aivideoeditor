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

// GET — List all templates
export async function GET() {
    try {
        const base = getAirtableBase();
        const records = await base('Templates')
            .select({
                sort: [{ field: 'CreatedAt', direction: 'desc' }],
            })
            .all();

        const templates = records.map(record => ({
            id: record.id,
            name: record.get('Name') as string || 'Untitled',
            scenes: JSON.parse(record.get('SceneItems') as string || '[]'),
            createdAt: record.get('CreatedAt') as string || '',
        }));

        return NextResponse.json({ templates });
    } catch (error: any) {
        console.error('Templates GET Error:', error);
        return NextResponse.json({ error: error.message, templates: [] }, { status: 500 });
    }
}

// POST — Create or update a template
export async function POST(request: Request) {
    try {
        const base = getAirtableBase();
        const { id, name, scenes } = await request.json();

        if (id && id.startsWith('rec')) {
            // Update existing
            const record = await base('Templates').update(id, {
                "Name": name,
                "SceneItems": JSON.stringify(scenes),
            });
            return NextResponse.json({ success: true, id: record.id });
        } else {
            // Create new
            const record = await base('Templates').create({
                "Name": name,
                "SceneItems": JSON.stringify(scenes),
                "CreatedAt": new Date().toISOString(),
            });
            return NextResponse.json({ success: true, id: record.id });
        }
    } catch (error: any) {
        console.error('Templates POST Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE — Delete a template
export async function DELETE(request: Request) {
    try {
        const base = getAirtableBase();
        const { id } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Missing template id' }, { status: 400 });
        }

        await base('Templates').destroy(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Templates DELETE Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
