/**
 * Migration Script: Existing meta.json files → Airtable Gallery table
 * 
 * Usage: node scripts/migrate-gallery.js
 * 
 * Prerequisites:
 * 1. Create the 'Gallery' table in Airtable with the required fields
 * 2. Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables
 */

const fs = require('fs');
const path = require('path');

// Manually load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
                const key = trimmed.substring(0, eqIdx).trim();
                const val = trimmed.substring(eqIdx + 1).trim();
                process.env[key] = val;
            }
        }
    });
}

const Airtable = require('airtable');

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!API_KEY || !BASE_ID) {
    console.error('Error: Please set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env.local');
    process.exit(1);
}

const base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);
const TABLE = 'Gallery';

const projectsDir = path.join(__dirname, '..', 'public', 'projects');

async function migrate() {
    console.log('Starting migration...');
    console.log('Projects directory:', projectsDir);

    if (!fs.existsSync(projectsDir)) {
        console.error('Projects directory not found:', projectsDir);
        process.exit(1);
    }

    const folders = fs.readdirSync(projectsDir).filter(f => {
        const metaPath = path.join(projectsDir, f, 'meta.json');
        return fs.existsSync(metaPath);
    });

    console.log(`Found ${folders.length} projects to migrate.`);

    let success = 0;
    let failed = 0;

    // Process in batches of 10 (Airtable rate limit)
    const batchSize = 10;
    for (let i = 0; i < folders.length; i += batchSize) {
        const batch = folders.slice(i, i + batchSize);
        const records = [];

        for (const folder of batch) {
            try {
                const metaPath = path.join(projectsDir, folder, 'meta.json');
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));

                const usage = meta.usage || {};
                records.push({
                    fields: {
                        "Title": (meta.title || "Untitled Project").substring(0, 200),
                        "GroupTitle": (meta.groupTitle || meta.title || "Untitled").substring(0, 200),
                        "ProjectId": folder, // filesystem folder name = project ID
                        "VideoPath": meta.videoPath || "",
                        "ThumbnailPath": meta.thumbnailPath || "",
                        "Duration": meta.duration || 0,
                        "ScriptCost": Math.round(usage.scriptCost || 0),
                        "ImageCost": Math.round(usage.imageCost || 0),
                        "AudioCost": Math.round(usage.audioCost || 0),
                        "TotalCost": Math.round(usage.totalCost || 0),
                        "SceneCount": (meta.scenes || []).length,
                        "Status": "active",
                    }
                });
            } catch (e) {
                console.warn(`Failed to parse ${folder}:`, e.message);
                failed++;
            }
        }

        if (records.length > 0) {
            try {
                await base(TABLE).create(records);
                success += records.length;
                console.log(`  Migrated batch ${i / batchSize + 1}: ${records.length} records (${success}/${folders.length})`);
            } catch (e) {
                console.error(`  Batch ${i / batchSize + 1} failed:`, e.message);
                failed += records.length;
            }
        }

        // Rate limit: wait 200ms between batches
        if (i + batchSize < folders.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    console.log(`\nMigration complete! Success: ${success}, Failed: ${failed}`);
}

migrate().catch(console.error);
