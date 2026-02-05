
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const GEMINI_MODEL = "gemini-2.5-pro-preview-tts";

export async function POST(req: Request) {
    try {
        const { text, voiceStyle, narrationTone, languageCode = 'ko-KR', apiModel, voiceParams, actingPrompt, voiceId } = await req.json();

        if (!text) {
            return NextResponse.json({ error: "Text is required" }, { status: 400 });
        }

        // 1. Generate Cache Key (Filename)
        const cacheKey = crypto.createHash('md5').update(JSON.stringify({
            voiceId,
            text,
            voiceStyle,
            narrationTone,
            apiModel,
            voiceParams,
            actingPrompt
        })).digest('hex');

        const filename = `preview_${cacheKey}.wav`;
        const previewsDir = path.join(process.cwd(), 'public', 'previews');
        const filePath = path.join(previewsDir, filename);
        const publicUrl = `/previews/${filename}`;

        // 2. Check Cache
        if (fs.existsSync(filePath)) {
            // Return cached file URL
            // Get duration if possible? Or just return URL and client handles it.
            return NextResponse.json({
                audioUrl: publicUrl,
                cached: true
            });
        }

        // 3. Generate Audio (Cache Miss)
        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        const gcloudKey = process.env.GOOGLE_CLOUD_API_KEY || apiKey;

        if (!apiKey) {
            return NextResponse.json({ error: "API Key missing" }, { status: 500 });
        }

        let audioBuffer: Buffer | null = null;
        let audioEncoding = "LINEAR16"; // Default for WAV

        // --- BRANCH 1: GOOGLE CLOUD TTS (Neural2 / WaveNet) ---
        if (apiModel === 'google-cloud-tts') {
            const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${gcloudKey}`;

            const requestBody = {
                input: { text: text },
                voice: {
                    languageCode: voiceParams?.languageCode || languageCode,
                    name: voiceParams?.name,
                },
                audioConfig: {
                    audioEncoding: "LINEAR16",
                    speakingRate: 1.0,
                    pitch: 0.0,
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Google Cloud TTS Error:", JSON.stringify(data, null, 2));
                return NextResponse.json({ error: data.error?.message || "Google Cloud TTS Error" }, { status: response.status });
            }

            if (data.audioContent) {
                audioBuffer = Buffer.from(data.audioContent, 'base64');
            } else {
                return NextResponse.json({ error: "No Audio Content from Google Cloud" }, { status: 500 });
            }
        }
        // --- BRANCH 2: GEMINI (Generative AI) ---
        else {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

            const promptText = `
    Please narrate the following text.
    Tone: ${narrationTone || 'Neutral'}.
    Style: ${voiceStyle || 'Professional'}.
    ${actingPrompt ? `Acting Direction: ${actingPrompt}` : ''}
    Language: ${languageCode}.
    
    Text to read:
    "${text}"
    `;

            const simpleBody = {
                contents: [{ parts: [{ text: promptText }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voiceParams?.voice_name || (voiceStyle?.includes("Male") ? "Aoede" : "Fenrir")
                            }
                        }
                    }
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(simpleBody)
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Gemini TTS Error:", JSON.stringify(data, null, 2));
                return NextResponse.json({ error: data.error?.message || "Gemini API Error" }, { status: response.status });
            }

            const candidate = data.candidates?.[0];
            const part = candidate?.content?.parts?.find((p: any) => p.inlineData);

            if (part && part.inlineData) {
                const rawBuffer = Buffer.from(part.inlineData.data, 'base64');

                // Convert PCM to WAV if needed (Gemini often returns raw PCM)
                // Assuming 24kHz Mono 16-bit for Gemini 2.5 Preview
                const wavHeader = Buffer.alloc(44);
                const dataLen = rawBuffer.length;

                wavHeader.write("RIFF", 0);
                wavHeader.writeUInt32LE(36 + dataLen, 4);
                wavHeader.write("WAVE", 8);
                wavHeader.write("fmt ", 12);
                wavHeader.writeUInt32LE(16, 16);
                wavHeader.writeUInt16LE(1, 20);
                wavHeader.writeUInt16LE(1, 22);
                wavHeader.writeUInt32LE(24000, 24);
                wavHeader.writeUInt32LE(24000 * 2, 28);
                wavHeader.writeUInt16LE(2, 32);
                wavHeader.writeUInt16LE(16, 34);
                wavHeader.write("data", 36);
                wavHeader.writeUInt32LE(dataLen, 40);

                audioBuffer = Buffer.concat([wavHeader, rawBuffer]);
            } else {
                return NextResponse.json({ error: "No Audio Generated from Gemini" }, { status: 500 });
            }
        }

        // 4. Save to Disk
        if (audioBuffer) {
            if (!fs.existsSync(previewsDir)) {
                fs.mkdirSync(previewsDir, { recursive: true });
            }
            fs.writeFileSync(filePath, audioBuffer);

            return NextResponse.json({
                audioUrl: publicUrl,
                cached: false
            });
        }

        return NextResponse.json({ error: "Failed to generate audio buffer" }, { status: 500 });

    } catch (error) {
        console.error("Preview Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
