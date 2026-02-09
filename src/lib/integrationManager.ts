import fs from 'fs';
import path from 'path';
import Airtable from 'airtable';

// Configure Airtable
const getAirtableBase = () => {
    const apiKey = process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;

    if (!apiKey || !baseId) {
        // Warn only once or rely on caller to check
        return null;
    }
    return new Airtable({ apiKey }).base(baseId);
};

const TABLE_NAME = 'Integrations';
const TOKEN_FILE_MAP: Record<string, string> = {
    'YouTube': 'youtube-tokens.json'
};

export const IntegrationManager = {
    async getTokens(platform: string) {
        const fileName = TOKEN_FILE_MAP[platform];
        if (!fileName) return null;

        const tokenPath = path.join(process.cwd(), fileName);

        // 1. Try Local File first
        if (fs.existsSync(tokenPath)) {
            try {
                return JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
            } catch (e) {
                console.error(`Failed to parse local tokens for ${platform}`, e);
            }
        }

        // 2. Fallback to Airtable
        const base = getAirtableBase();
        if (base) {
            try {
                const records = await base(TABLE_NAME).select({
                    filterByFormula: `{Platform} = '${platform}'`,
                    maxRecords: 1
                }).firstPage();

                if (records && records.length > 0) {
                    const tokenStr = records[0].get('Tokens') as string;
                    if (tokenStr) {
                        const tokens = JSON.parse(tokenStr);
                        // Restore to local file
                        fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
                        console.log(`Restored ${platform} tokens from Airtable`);
                        return tokens;
                    }
                }
            } catch (e) {
                console.error(`Failed to fetch ${platform} tokens from Airtable`, e);
            }
        }

        return null;
    },

    async saveTokens(platform: string, tokens: any) {
        const fileName = TOKEN_FILE_MAP[platform];
        if (!fileName) return;

        const tokenPath = path.join(process.cwd(), fileName);
        const tokenData = JSON.stringify(tokens, null, 2);

        // 1. Save Local
        fs.writeFileSync(tokenPath, tokenData);

        // 2. Save to Airtable
        const base = getAirtableBase();
        if (base) {
            try {
                const records = await base(TABLE_NAME).select({
                    filterByFormula: `{Platform} = '${platform}'`,
                    maxRecords: 1
                }).firstPage();

                if (records && records.length > 0) {
                    await base(TABLE_NAME).update(records[0].id, {
                        "Tokens": tokenData,
                        "Status": "Active",
                        "LastUpdated": new Date().toISOString()
                    });
                } else {
                    await base(TABLE_NAME).create({
                        "Platform": platform,
                        "Tokens": tokenData,
                        "Status": "Active",
                        "LastUpdated": new Date().toISOString()
                    });
                }
            } catch (e) {
                console.error(`Failed to save ${platform} tokens to Airtable`, e);
            }
        }
    },

    async deleteTokens(platform: string) {
        const fileName = TOKEN_FILE_MAP[platform];
        if (!fileName) return;

        const tokenPath = path.join(process.cwd(), fileName);

        // 1. Delete Local
        if (fs.existsSync(tokenPath)) {
            fs.unlinkSync(tokenPath);
        }

        // 2. Delete from Airtable
        const base = getAirtableBase();
        if (base) {
            try {
                const records = await base(TABLE_NAME).select({
                    filterByFormula: `{Platform} = '${platform}'`,
                    maxRecords: 1
                }).firstPage();

                if (records && records.length > 0) {
                    await base(TABLE_NAME).destroy(records[0].id);
                }
            } catch (e) {
                console.error(`Failed to delete ${platform} tokens from Airtable`, e);
            }
        }
    }
};
