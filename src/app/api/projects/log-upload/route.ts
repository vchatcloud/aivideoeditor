import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: Request) {
    try {
        const { projectId, uploadRecord } = await req.json();

        if (!projectId || !uploadRecord) {
            return NextResponse.json({ error: "Missing projectId or uploadRecord" }, { status: 400 });
        }

        // Projects directory
        const projectsDir = path.join(process.cwd(), 'public', 'projects');
        const projectPath = path.join(projectsDir, projectId, 'project.json');
        const metaPath = path.join(projectsDir, projectId, 'meta.json');

        // For Airtable-only projects, local files may not exist — skip the check
        const hasLocalFiles = fs.existsSync(projectPath) || fs.existsSync(metaPath);
        const isAirtableProject = projectId.startsWith('rec');

        if (!hasLocalFiles && !isAirtableProject) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

        let updatedUploads = [];

        // 1. Update project.json if exists
        if (fs.existsSync(projectPath)) {
            try {
                const fileContent = fs.readFileSync(projectPath, 'utf-8');
                const projectData = JSON.parse(fileContent);
                if (!projectData.uploads) projectData.uploads = [];

                const exists = projectData.uploads.some((u: any) => u.videoId === uploadRecord.videoId);
                if (!exists) {
                    projectData.uploads.push({
                        ...uploadRecord,
                        timestamp: new Date().toISOString()
                    });
                    fs.writeFileSync(projectPath, JSON.stringify(projectData, null, 2));
                }
                updatedUploads = projectData.uploads;
            } catch (e) {
                console.error("Error updating project.json", e);
            }
        }

        // 2. Update meta.json if exists (Critical for List View)
        if (fs.existsSync(metaPath)) {
            try {
                const metaContent = fs.readFileSync(metaPath, 'utf-8');
                const metaData = JSON.parse(metaContent);

                if (!metaData.uploads) metaData.uploads = [];

                // Check duplicates in meta
                const metaExists = metaData.uploads.some((u: any) => u.videoId === uploadRecord.videoId);
                if (!metaExists) {
                    metaData.uploads.push({
                        ...uploadRecord,
                        timestamp: new Date().toISOString()
                    });
                    fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 2));
                }
                if (updatedUploads.length === 0) updatedUploads = metaData.uploads;
            } catch (e) {
                console.error("Error updating meta.json", e);
            }
        }

        // 3. Sync to Airtable (If projectId is an Airtable Record ID)
        if (projectId.startsWith('rec')) {
            const Airtable = require('airtable');
            if (process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID) {
                try {
                    const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID);
                    const record = await base('Projects').find(projectId);

                    if (record) {
                        const settingsStr = record.get('Settings') as string || '{}';
                        let settings = JSON.parse(settingsStr);

                        if (!settings.uploads) settings.uploads = [];

                        // Check duplicates in Airtable
                        const atExists = settings.uploads.some((u: any) => u.videoId === uploadRecord.videoId);
                        if (!atExists) {
                            settings.uploads.push({
                                ...uploadRecord,
                                timestamp: new Date().toISOString()
                            });

                            await base('Projects').update(projectId, {
                                "Settings": JSON.stringify(settings)
                            });
                            console.log("Synced upload to Airtable for project", projectId);
                        }
                    }
                } catch (atError) {
                    console.error("Failed to sync upload to Airtable:", atError);
                    // Don't fail the request if Airtable sync fails, as local save succeeded
                }
            }
        }

        return NextResponse.json({ success: true, uploads: updatedUploads });

    } catch (error: any) {
        console.error("Log Upload Error:", error);
        return NextResponse.json({ error: error.message || "Failed to log upload" }, { status: 500 });
    }
}
