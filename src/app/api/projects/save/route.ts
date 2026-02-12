import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// App Router handles bodyParser automatically or via request.formData()
// No need for 'export const config' here.

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const videoFile = formData.get('video') as Blob;
        const metadataStr = formData.get('metadata') as string;

        // Video is optional for "Draft" saves
        // if (!videoFile) {
        //     return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
        // }

        const metadata = JSON.parse(metadataStr || '{}');
        // Check if ID is provided for overwrite/update
        const existingId = formData.get('id') as string;
        const projectId = existingId || uuidv4();
        const projectDir = path.join(process.cwd(), 'public', 'projects', projectId);

        // Create directory
        if (!fs.existsSync(projectDir)) {
            fs.mkdirSync(projectDir, { recursive: true });
        }

        // Read existing metadata if overwriting (to preserve videoPath, thumbnailPath, createdAt)
        let existingMeta: any = {};
        const existingMetaPath = path.join(projectDir, 'meta.json');
        if (fs.existsSync(existingMetaPath)) {
            try {
                existingMeta = JSON.parse(fs.readFileSync(existingMetaPath, 'utf-8'));
            } catch (e) {
                console.warn('Failed to read existing meta.json, starting fresh');
            }
        }

        // Save Video if provided
        const timestamp = Date.now();
        let videoFileName = "";
        if (videoFile && videoFile.size > 0) {
            const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
            const videoExtension = videoFile.type.split('/')[1] || 'webm';
            videoFileName = `video_${timestamp}.${videoExtension}`;
            const videoPath = path.join(projectDir, videoFileName);
            fs.writeFileSync(videoPath, videoBuffer);
        }

        // Save Thumbnail
        const thumbnailFile = formData.get('thumbnail') as Blob;
        let thumbnailPathStr = "";
        if (thumbnailFile) {
            const thumbBuffer = Buffer.from(await thumbnailFile.arrayBuffer());
            const thumbName = `thumbnail_${timestamp}.jpg`;
            const thumbPath = path.join(projectDir, thumbName);
            fs.writeFileSync(thumbPath, thumbBuffer);
            thumbnailPathStr = `/projects/${projectId}/${thumbName}`;
        }

        // Save Metadata — preserve existing videoPath/thumbnailPath/createdAt when not uploading new files
        const savedMetadata = {
            ...metadata,
            id: projectId,
            title: metadata.title || 'Untitled Project',
            createdAt: existingMeta.createdAt || metadata.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            videoPath: videoFileName ? `/projects/${projectId}/${videoFileName}` : (metadata.videoPath || existingMeta.videoPath || null),
            thumbnailPath: thumbnailPathStr || (metadata.thumbnailPath || existingMeta.thumbnailPath || ""),
            duration: metadata.duration || existingMeta.duration || 0,
            scenes: metadata.scenes || existingMeta.scenes || [],
            usage: metadata.usage || existingMeta.usage
        };

        fs.writeFileSync(path.join(projectDir, 'meta.json'), JSON.stringify(savedMetadata, null, 2));

        return NextResponse.json({ success: true, project: savedMetadata });
    } catch (error) {
        console.error('Error saving project:', error);
        return NextResponse.json({ error: 'Failed to save project' }, { status: 500 });
    }
}
