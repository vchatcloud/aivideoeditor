
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

export async function POST(req: Request) {
    try {
        const { files } = await req.json(); // Expecting array of { url: string, name: string }

        if (!files || !Array.isArray(files) || files.length === 0) {
            return NextResponse.json({ error: "No files provided" }, { status: 400 });
        }

        const zip = new AdmZip();

        for (const file of files) {
            // Extract filename from URL (remove query params)
            // URL likely starts with /, so we need to map to public dir
            let relativePath = file.url;
            if (relativePath.startsWith('http')) {
                const urlObj = new URL(relativePath);
                relativePath = urlObj.pathname;
            }

            // Remove leading slash for path.join
            if (relativePath.startsWith('/')) {
                relativePath = relativePath.substring(1);
            }

            const filePath = path.join(process.cwd(), 'public', relativePath);

            if (fs.existsSync(filePath)) {
                zip.addLocalFile(filePath, "", file.name); // Add file to root of zip with specified name
            } else {
                console.warn(`File not found for zip: ${filePath}`);
            }
        }

        const zipBuffer = zip.toBuffer();

        // Return zip file
        return new NextResponse(zipBuffer as any, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': 'attachment; filename="narration_files.zip"'
            }
        });

    } catch (error) {
        console.error("Zip Export Error:", error);
        return NextResponse.json({ error: "Failed to create zip" }, { status: 500 });
    }
}
