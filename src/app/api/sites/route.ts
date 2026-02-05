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

        const sites = records.map(record => ({
            id: record.id,
            name: record.get('Name') as string,
            url: record.get('Url') as string
        }));

        return NextResponse.json(sites);
    } catch (error: any) {
        console.error('Airtable Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const base = getAirtableBase();
        const { name, url } = await request.json();

        const record = await base('Sites').create({
            "Name": name,
            "Url": url
        });

        return NextResponse.json({ success: true, id: record.id, name: record.get('Name'), url: record.get('Url') });
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
        const { id, name, url } = await request.json();

        if (!id || !name || !url) {
            return NextResponse.json({ error: 'ID, Name, and URL are required' }, { status: 400 });
        }

        const record = await base('Sites').update(id, {
            "Name": name,
            "Url": url
        });

        return NextResponse.json({
            success: true,
            id: record.id,
            name: record.get('Name'),
            url: record.get('Url')
        });
    } catch (error: any) {
        console.error('Airtable Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
