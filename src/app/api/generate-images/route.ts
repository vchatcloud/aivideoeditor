
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
    let originalPrompt = '';
    let optimizedPrompt = '';

    try {
        const body = await request.json();
        originalPrompt = body.prompt;
        const aspectRatio = body.aspectRatio || '16:9'; // Default to 16:9

        if (!originalPrompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
        }

        // --- 0. Prompt Optimization (Rewrite) ---
        try {
            console.log("Optimizing prompt...");
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

            const optimizationPrompt = `
                You are an expert AI Image Prompt Engineer. 
                Rewrite the following prompt to be optimized for Google's Gemini Image Generation model.
                
                Goal: Create a photorealistic or highly consistent illustration based on the user's request.
                
                Key Requirements:
                1. **STRICT KOREAN ONLY**: ALL text, labels, signs, and documents within the image MUST be in Korean (Hangul). Use phrases like: "A clear signage/poster displaying the Korean text '...text...' in bold, legible Hangul script." 
                2. **NO ENGLISH**: Explicitly forbid any English letters or non-Korean characters in the image. If the prompt contains English text intended for the image, translate it into natural Korean.
                3. **Detail & Style**: Add details about lighting, texture, and composition while strictly maintaining the "Korean content" rule.
                
                Original Prompt: "${originalPrompt}"
                
                Output ONLY the rewritten English prompt. Do not add explanations.
            `;

            const result = await model.generateContent(optimizationPrompt);
            optimizedPrompt = result.response.text();
            optimizedPrompt = optimizedPrompt.replace(/^\*\*Rewritten Prompt:\*\*\s*/i, '').trim();
        } catch (optError) {
            console.warn("Prompt optimization failed, using original:", optError);
            optimizedPrompt = originalPrompt;
        }

        const finalPrompt = optimizedPrompt || originalPrompt;
        let imageBuffer: Buffer | null = null;
        let fileExtension = 'png';
        let provider = 'Unknown';

        // --- Model Execution Logic ---
        // Strategy: Try Imagen 3 (via generateContent) first, then fallback to Gemini 2.0 Flash

        const tryGenerateImage = async (modelName: string, shouldUsePredict = false, imageBufferInput?: Buffer) => {
            console.log(`Attempting image generation with model: ${modelName} (Method: ${shouldUsePredict ? 'predict' : 'generateContent'}, Aspect Ratio: ${aspectRatio})...`);
            const method = shouldUsePredict ? 'predict' : 'generateContent';
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:${method}?key=${apiKey}`;

            let payload;
            if (shouldUsePredict) {
                payload = {
                    instances: [{ prompt: finalPrompt }],
                    parameters: { sampleCount: 1, aspectRatio: aspectRatio }
                };
            } else {
                // For generateContent
                const resolutionMap: Record<string, string> = {
                    '16:9': 'Wide landscape 16:9 aspect ratio (1920x1080 resolution)',
                    '9:16': 'Tall portrait 9:16 aspect ratio (1080x1920 resolution)',
                    '1:1': 'Square 1:1 aspect ratio (1080x1080 resolution)',
                    '4:3': 'Standard 4:3 aspect ratio (1440x1080 resolution)'
                };

                const resolutionInstruction = resolutionMap[aspectRatio] || `Aspect ratio ${aspectRatio}`;
                const aspectRatioPrompt = `${finalPrompt} [CRITICAL: Generate image with ${resolutionInstruction}]`;

                const parts: any[] = [{ text: aspectRatioPrompt }];

                // Add reference image if available
                if (imageBufferInput) {
                    console.log("Adding reference image to payload...");
                    parts.push({
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: imageBufferInput.toString('base64')
                        }
                    });
                }

                payload = {
                    contents: [{ parts: parts }],
                    generationConfig: {
                        responseModalities: ["image"]
                    }
                };
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || response.statusText);
            }

            const data = await response.json();

            // Extract Image Data based on method
            let buffer: Buffer | null = null;
            let ext = 'png';

            if (shouldUsePredict) {
                // Predict format (Imagen)
                if (data.predictions?.[0]?.bytesBase64Encoded) {
                    buffer = Buffer.from(data.predictions[0].bytesBase64Encoded, 'base64');
                    if (data.predictions[0].mimeType === 'image/jpeg') ext = 'jpg';
                }
            } else {
                // GenerateContent format (Gemini)
                if (data.candidates?.[0]?.content?.parts) {
                    for (const part of data.candidates[0].content.parts) {
                        if (part.inlineData?.data) {
                            buffer = Buffer.from(part.inlineData.data, 'base64');
                            if (part.inlineData.mimeType === 'image/jpeg') ext = 'jpg';
                            break;
                        }
                    }
                    // Special case: sometimes model returns text refusal
                    if (!buffer && data.candidates[0].content.parts[0]?.text) {
                        throw new Error("Model refused image generation: " + data.candidates[0].content.parts[0].text);
                    }
                }
            }

            if (!buffer) throw new Error("No valid image data found in response");
            return { buffer, ext };
        };

        const refImage = body.refImage;
        let refImageBuffer: Buffer | undefined;

        if (refImage) {
            try {
                const res = await fetch(refImage);
                if (res.ok) {
                    const arrayBuffer = await res.arrayBuffer();
                    refImageBuffer = Buffer.from(arrayBuffer);
                    console.log("Fetched reference image successfully");
                } else {
                    console.warn(`Failed to fetch refImage: ${res.status}`);
                }
            } catch (e) {
                console.warn("Error fetching refImage:", e);
            }
        }

        // 1. Try Gemini 3 Pro Image Preview (via generateContent)
        try {
            // Attempt 1: gemini-3-pro-image-preview
            provider = 'Gemini 3 Pro (generateContent)';
            try {
                const result = await tryGenerateImage('gemini-3-pro-image-preview', false, refImageBuffer);
                imageBuffer = result.buffer;
                fileExtension = result.ext;
            } catch (retryError: any) {
                // Retry once if overloaded
                if (retryError.message.includes('overloaded') || retryError.message.includes('503')) {
                    console.warn("Gemini 3 Pro overloaded, retrying in 2s...");
                    await new Promise(res => setTimeout(res, 2000));
                    const result = await tryGenerateImage('gemini-3-pro-image-preview', false, refImageBuffer);
                    imageBuffer = result.buffer;
                    fileExtension = result.ext;
                } else {
                    throw retryError;
                }
            }
        } catch (e1: any) {
            console.warn(`Gemini 3 Pro failed: ${e1.message}`);

            // 2. Fallback: Imagen 3.0 Standard
            try {
                console.log("Falling back to Imagen 3.0 Standard...");
                provider = 'Imagen 3.0';
                const result = await tryGenerateImage('imagen-3.0-generate-001', false, refImageBuffer);
                imageBuffer = result.buffer;
                fileExtension = result.ext;
            } catch (e2: any) {
                console.warn(`Imagen 3.0 failed: ${e2.message}`);

                // 3. Fallback: Gemini 2.0 Flash (Experimental)
                try {
                    console.log("Falling back to Gemini 2.0 Flash...");
                    provider = 'Gemini 2.0 Flash';
                    const result = await tryGenerateImage('gemini-2.0-flash-exp', false, refImageBuffer);
                    imageBuffer = result.buffer;
                    fileExtension = result.ext;
                } catch (e3: any) {
                    throw new Error(`All methods failed. Gemini 3 Pro: ${e1.message}, Imagen 3: ${e2.message}, Gemini Result: ${e3.message}`);
                }
            }
        }

        // --- 3. Save to Local File ---
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(7);
        const filename = `img_${timestamp}_${randomSuffix}.${fileExtension}`;
        const uploadDir = path.join(process.cwd(), 'public', 'generated');

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, imageBuffer!);

        console.log(`Saved generated image (${provider}) to: ${filePath}`);

        const localUrl = `/generated/${filename}`;

        return NextResponse.json({
            imageUrl: localUrl,
            optimizedPrompt: finalPrompt,
            provider
        });

    } catch (error: any) {
        console.error('Image generation fatal error:', error);
        return NextResponse.json({ error: 'Failed to generate image: ' + error.message }, { status: 500 });
    }
}
