
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const GEMINI_MODEL = "gemini-2.5-pro-preview-tts";

export async function POST(req: Request) {
    try {
        const { text, voiceStyle, narrationTone, languageCode = 'ko-KR', apiModel, voiceParams, actingPrompt } = await req.json();

        if (!text) {
            return NextResponse.json({ error: "Text is required" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        const gcloudKey = process.env.GOOGLE_CLOUD_API_KEY || apiKey; // Fallback to Gemini Key

        if (!apiKey) {
            return NextResponse.json({ error: "API Key missing" }, { status: 500 });
        }

        // --- BRANCH 1: GOOGLE CLOUD TTS (Neural2 / WaveNet) ---
        if (apiModel === 'google-cloud-tts') {
            const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${gcloudKey}`;

            const requestBody = {
                input: { text: text },
                voice: {
                    languageCode: voiceParams?.languageCode || languageCode,
                    name: voiceParams?.name, // e.g. ko-KR-Neural2-A
                },
                audioConfig: {
                    audioEncoding: "LINEAR16", // WAV compatible
                    speakingRate: 1.0, // We handle speed client side
                    pitch: 0.0,      // We handle pitch client side
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
                return await saveAndRespond(data.audioContent, "LINEAR16");
            } else {
                return NextResponse.json({ error: "No Audio Content from Google Cloud" }, { status: 500 });
            }
        }

        // --- BRANCH 2: GEMINI (Generative AI) ---
        // Defaults to Gemini logic if not Cloud TTS

        // Gemini API URL
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

        // Prompt Construction for Tone/Style
        // Prompt Construction for Tone/Style
        let stylePrompt = `
    Please narrate the following text.
    Tone: ${narrationTone || 'Neutral'}.
    Style: ${voiceStyle || 'Professional'}.
    ${actingPrompt ? `Acting Direction: ${actingPrompt}` : ''}
    Language: ${languageCode}.
    `;

        // Prompt Engineering for Mix (Speed/Pitch/Volume)
        // Note: Volume is mostly post-process, but we can ask for 'Loud' or 'Soft' voice.
        if (voiceParams) {
            if (voiceParams.rate) {
                if (voiceParams.rate > 1.1) stylePrompt += "Speaking Rate: Fast, energetic, quick pace.\n";
                else if (voiceParams.rate < 0.9) stylePrompt += "Speaking Rate: Slow, deliberate, calm pace.\n";
            }
            if (voiceParams.pitch) {
                if (voiceParams.pitch > 1) stylePrompt += "Pitch: Slightly higher, brighter tone.\n";
                else if (voiceParams.pitch < -1) stylePrompt += "Pitch: Slightly lower, deeper, weightier tone.\n";
            }
            if (voiceParams.volume) {
                if (voiceParams.volume > 1.2) stylePrompt += "Volume: Loud, projecting voice.\n";
                else if (voiceParams.volume < 0.8) stylePrompt += "Volume: Soft, quiet, whispery.\n";
            }
        }

        const promptText = `
    ${stylePrompt}
    
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

        // Extract Audio
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.find((p: any) => p.inlineData);

        if (part && part.inlineData) {
            // Convert base64 to buffer
            const audioBuffer = Buffer.from(part.inlineData.data, 'base64');

            // Generate filename
            const timestamp = Date.now();
            const filename = `narration_${timestamp}.wav`; // Assuming we convert to WAV or it is WAV
            // Gemini returns raw PCM for this model usually. We need to wrap it if we want it playable.

            let finalBuffer = audioBuffer;
            if (data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType === 'audio/pcm' || true) {
                // Force assume PCM 24kHz Mono 16-bit for Gemini 2.5 Preview defaults
                // Construct WAV Header
                const wavHeader = Buffer.alloc(44);
                const dataLen = audioBuffer.length;

                wavHeader.write("RIFF", 0);
                wavHeader.writeUInt32LE(36 + dataLen, 4);
                wavHeader.write("WAVE", 8);
                wavHeader.write("fmt ", 12);
                wavHeader.writeUInt32LE(16, 16); // PCM Chunk Size
                wavHeader.writeUInt16LE(1, 20); // PCM
                wavHeader.writeUInt16LE(1, 22); // Mono
                wavHeader.writeUInt32LE(24000, 24); // Sample Rate
                wavHeader.writeUInt32LE(24000 * 2, 28); // Byte Rate
                wavHeader.writeUInt16LE(2, 32); // Block Align
                wavHeader.writeUInt16LE(16, 34); // Bits per Sample
                wavHeader.write("data", 36);
                wavHeader.writeUInt32LE(dataLen, 40);

                finalBuffer = Buffer.concat([wavHeader, audioBuffer]);
            }

            // Ensure directory exists
            const saveDir = path.join(process.cwd(), 'public', 'generated', 'audio');
            if (!fs.existsSync(saveDir)) {
                fs.mkdirSync(saveDir, { recursive: true });
            }

            const filePath = path.join(saveDir, filename);
            fs.writeFileSync(filePath, finalBuffer);

            const publicUrl = `/generated/audio/${filename}`;
            const duration = finalBuffer.length / 48000; // 24000Hz * 1 Channel * 2 Bytes

            return NextResponse.json({
                audioContent: part.inlineData.data,
                audioEncoding: "PCM",
                audioUrl: publicUrl,
                duration: duration
            });
        } else {
            console.error("No audio data in Gemini response", JSON.stringify(data, null, 2));
            return NextResponse.json({ error: "No Audio Generated" }, { status: 500 });
        }

    } catch (error) {
        console.error("Server TTS Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

async function saveAndRespond(audioContentBase64: string, encoding: "LINEAR16" | "MP3" | "PCM") {
    const audioBuffer = Buffer.from(audioContentBase64, 'base64');
    let finalBuffer = audioBuffer;

    if (encoding === "LINEAR16" || encoding === "PCM") {
        // Construct WAV Header for 24kHz Mono 16-bit
        // Neural2 defaults to 24kHz.
        const wavHeader = Buffer.alloc(44);
        const dataLen = audioBuffer.length;
        const sampleRate = 24000;

        wavHeader.write("RIFF", 0);
        wavHeader.writeUInt32LE(36 + dataLen, 4);
        wavHeader.write("WAVE", 8);
        wavHeader.write("fmt ", 12);
        wavHeader.writeUInt32LE(16, 16); // Chunk Size
        wavHeader.writeUInt16LE(1, 20); // PCM
        wavHeader.writeUInt16LE(1, 22); // Mono
        wavHeader.writeUInt32LE(sampleRate, 24); // Sample Rate
        wavHeader.writeUInt32LE(sampleRate * 2, 28); // Byte Rate
        wavHeader.writeUInt16LE(2, 32); // Block Align
        wavHeader.writeUInt16LE(16, 34); // Bits per Sample
        wavHeader.write("data", 36);
        wavHeader.writeUInt32LE(dataLen, 40);

        finalBuffer = Buffer.concat([wavHeader, audioBuffer]);
    }

    // Ensure directory exists
    const saveDir = path.join(process.cwd(), 'public', 'generated', 'audio');
    if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
    }

    // Generate filename
    const timestamp = Date.now();
    const ext = encoding === "MP3" ? "mp3" : "wav";
    const filename = `narration_${timestamp}.${ext}`;
    const filePath = path.join(saveDir, filename);

    fs.writeFileSync(filePath, finalBuffer);

    const publicUrl = `/generated/audio/${filename}`;

    // Approx Duration
    let duration = 0;
    if (encoding === "MP3") {
        duration = (finalBuffer.length * 8) / 32000; // Very rough
    } else {
        duration = audioBuffer.length / 48000; // 24000 * 2 bytes
    }

    return NextResponse.json({
        audioContent: audioContentBase64,
        audioUrl: publicUrl,
        duration: duration
    });
}
