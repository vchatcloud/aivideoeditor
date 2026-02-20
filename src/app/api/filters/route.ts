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

export async function GET() {
    try {
        const base = getAirtableBase();
        const records = await base('Filters').select({
            sort: [{ field: "Type", direction: "asc" }]
        }).all();

        const filters = records.map(record => ({
            id: record.id,
            name: record.get('Name') as string,
            description: record.get('Description') as string || '',
            type: (record.get('Type') as string || 'include').toLowerCase() as 'include' | 'exclude',
        }));

        return NextResponse.json(filters);
    } catch (error: any) {
        console.error('Airtable Filters Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const base = getAirtableBase();
        const { name, description, type } = await request.json();

        if (!name || !type) {
            return NextResponse.json({ error: 'Name and Type are required' }, { status: 400 });
        }

        const record = await base('Filters').create({
            "Name": name,
            "Description": description || '',
            "Type": type,
        });

        return NextResponse.json({
            success: true,
            id: record.id,
            name: record.get('Name'),
            description: record.get('Description') || '',
            type: (record.get('Type') as string || 'include').toLowerCase(),
        });
    } catch (error: any) {
        console.error('Airtable Filters Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const base = getAirtableBase();
        const { id, name, description, type } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400 });
        }

        const fields: Record<string, string> = {};
        if (name !== undefined) fields["Name"] = name;
        if (description !== undefined) fields["Description"] = description;
        if (type !== undefined) fields["Type"] = type;

        const record = await base('Filters').update(id, fields);

        return NextResponse.json({
            success: true,
            id: record.id,
            name: record.get('Name'),
            description: record.get('Description') || '',
            type: (record.get('Type') as string || 'include').toLowerCase(),
        });
    } catch (error: any) {
        console.error('Airtable Filters Error:', error);
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

        await base('Filters').destroy(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Airtable Filters Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
