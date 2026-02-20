import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse-fork');

export async function POST(request: Request) {
    try {
        const { text, images, imageUrls, pdfUrls, analysisMode, allowImageVariation, selectedStyle, sceneCount, videoPurpose, imageComposition, imageMood, imageInterpretation, narrationLength, customPrompt, isMultiPost, multiPostCount } = await request.json();

        // Map analysisMode to purpose for internal logic compatibility
        const structureMode = analysisMode || 'detail'; // Renamed variable to avoid confusion with videoPurpose
        const imagesToProcess = images || imageUrls; // Handle both keys

        // Style Keyword Mapping
        const styleKeywords: Record<string, string> = {
            "Photorealistic": "4k, hyper-realistic, cinematic lighting, professional photography, depth of field",
            "3D Isometric": "3D isometric render, blender style, cute 3D character, soft clay texture, clean composition",
            "Flat Vector": "Flat design, vector illustration, corporate Memphis style, minimal, clean lines, solid colors",
            "Hand-Drawn": "Watercolor painting, pencil sketch, warm atmosphere, soft edges, artistic, storybook style"
        };

        const compKeywords: Record<string, string> = {
            "Wide": "Wide shot, subject on the right, wide negative space on the left for text overlay, minimalist background",
            "Center": "Symmetrical composition, centered subject, portrait mode, blurred background",
            "Knolling": "Knolling photography, flat lay, objects arranged neatly at 90 degrees, top-down view",
            "Macro": "Macro shot, extreme close-up, depth of field, bokeh effect"
        };

        const moodKeywords: Record<string, string> = {
            "Trustworthy": "Cool blue tones, bright office lighting, clean, professional",
            "Urgent": "High contrast, red/yellow accents, dramatic shadows, bold",
            "Eco": "Greenery, soft sunlight, organic shapes, fresh air visualization",
            "Energetic": "Vibrant colors, neon lights, dynamic angle, motion blur"
        };

        const interpretKeywords: Record<string, string> = {
            "Literal": "Depict exactly what is described in the text.",
            "Metaphorical": "Use visual metaphors (e.g., shield for safety, scale for balance) instead of literal depiction.",
            "Abstract": "Use abstract shapes, flows, and patterns to represent the concept."
        };

        // Construct Composite Style Prompt
        let imageStylePrompt = "";
        if (selectedStyle && styleKeywords[selectedStyle]) imageStylePrompt += `Art Style: ${styleKeywords[selectedStyle]}. `;
        if (imageComposition && compKeywords[imageComposition]) imageStylePrompt += `Composition: ${compKeywords[imageComposition]}. `;
        if (imageMood && moodKeywords[imageMood]) imageStylePrompt += `Mood/Lighting: ${moodKeywords[imageMood]}. `;
        if (imageInterpretation && interpretKeywords[imageInterpretation]) imageStylePrompt += `Concept: ${interpretKeywords[imageInterpretation]}`;

        // Default fallback if nothing selected
        if (!imageStylePrompt) imageStylePrompt = "Style: High quality, professional.";

        const fileUrls = pdfUrls;
        let extractedFileContent = "";

        if (fileUrls && Array.isArray(fileUrls) && fileUrls.length > 0) {
            console.log("Processing Files:", fileUrls.length);
            // Dynamic imports for parsers
            const mammoth = require('mammoth');
            const XLSX = require('xlsx');
            const fs = require('fs');
            const path = require('path');
            const AdmZip = require('adm-zip');

            for (const url of fileUrls) {
                try {
                    let buffer: Buffer | null = null;
                    const lowerUrl = url.toLowerCase();

                    // Handle local uploads (relative paths)
                    if (url.startsWith('/uploads/')) {
                        const filePath = path.join(process.cwd(), 'public', url);
                        if (fs.existsSync(filePath)) {
                            buffer = fs.readFileSync(filePath);
                        }
                    } else {
                        // Remote URLs
                        const res = await fetch(url);
                        if (res.ok) {
                            buffer = Buffer.from(await res.arrayBuffer());
                        }
                    }

                    if (buffer) {
                        let extracted = "";

                        if (lowerUrl.includes('.pdf')) {
                            const data = await pdfParse(buffer);
                            extracted = data.text;
                        } else if (lowerUrl.includes('.docx')) {
                            const result = await mammoth.extractRawText({ buffer });
                            extracted = result.value;
                        } else if (lowerUrl.includes('.xlsx') || lowerUrl.includes('.xls')) {
                            const workbook = XLSX.read(buffer, { type: 'buffer' });
                            // Read all sheets
                            workbook.SheetNames.forEach((sheetName: string) => {
                                const sheet = workbook.Sheets[sheetName];
                                extracted += `\n[Sheet: ${sheetName}]\n` + XLSX.utils.sheet_to_csv(sheet);
                            });
                        } else if (lowerUrl.includes('.hwpx')) {
                            // Handle HWPX (Zip-based XML)
                            try {
                                const zip = new AdmZip(buffer);
                                const entries = zip.getEntries();
                                // Typically text is in Contents/section0.xml
                                // We'll look for any section XMLs just in case
                                const sectionEntries = entries.filter((entry: any) =>
                                    entry.entryName.includes('Contents/section') && entry.entryName.endsWith('.xml')
                                );

                                if (sectionEntries.length > 0) {
                                    sectionEntries.forEach((entry: any) => {
                                        const xmlContent = zip.readAsText(entry);
                                        // Simple regex to extract text from <hp:t> tags
                                        // <hp:t ...>TEXT</hp:t>
                                        const textMatches = xmlContent.match(/<hp:t[^>]*>(.*?)<\/hp:t>/g);
                                        if (textMatches) {
                                            const sectionText = textMatches.map((tag: string) => {
                                                return tag.replace(/<\/?hp:t[^>]*>/g, '')
                                                    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                                                    .replace(/&amp;/g, '&').replace(/&quot;/g, '"');
                                            }).join(' ');
                                            extracted += sectionText + "\n";
                                        }
                                    });
                                } else {
                                    extracted = "[HWPX File found but no text sections detected]";
                                }
                            } catch (hwpErr) {
                                console.error("HWPX Processing error", hwpErr);
                                extracted = "[Failed to parse HWPX file structure]";
                            }
                        } else if (lowerUrl.includes('.hwp')) {
                            extracted = "[HWP (Binary) File content extraction is not supported. Please convert to HWPX or PDF]";
                        }

                        if (extracted) {
                            extractedFileContent += `\n\n--- Attached File Content (${url.split('/').pop()}) ---\n${extracted.substring(0, 20000)}\n`;
                        }
                    }
                } catch (e) {
                    console.error("Failed to parse file:", url, e);
                }
            }
        }

        // Combine text and extracted content
        const finalContent = (text || "") + extractedFileContent;

        if (!finalContent.trim() && (!imagesToProcess || imagesToProcess.length === 0)) {
            return NextResponse.json({ error: 'No content to analyze (Text is empty and no valid files/images provided)' }, { status: 400 });
        }

        // --- SIMULATION MODE START ---
        // If API key is missing or for testing, return simulation data
        if (!process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY === 'simulation') {
            console.log("Simulation Mode: Returning mock data");
            return NextResponse.json({
                summary: "성동구 취약계층 펫위탁소 운영안내",
                imageAnalysis: {
                    summary: "A professional and warm community service announcement.",
                    visualStyle: "Modern & Informative",
                    dominantColors: ["#4A90E2", "#50E3C2", "#F5A623"]
                },
                suggestedStyles: [
                    { name: "Warm & Friendly", description: "Soft colors and high key lighting", colors: ["#FDF5E6", "#FFEFD5", "#FFE4E1"] },
                    { name: "Clean Corporate", description: "Blue tones and professional layout", colors: ["#E1F5FE", "#B3E5FC", "#81D4FA"] },
                    { name: "Vibrant Modern", description: "High contrast and energetic colors", colors: ["#FF4081", "#7C4DFF", "#00E5FF"] }
                ],
                consistency: {
                    character: "A 30s Korean female social worker wearing a professional beige blazer and glasses with a friendly smile.",
                    theme: "A bright, modern Seoul community center with clean wooden furniture and large windows."
                },
                scenes: [
                    {
                        title: "Introduction",
                        text: "성동구에서는 사회적 약자를 위한 2026년 우리동네 펫위탁소를 운영합니다.",
                        subtitle: "우리동네 펫위탁소 운영안내",
                        imagePrompt: "A 30s Korean female social worker wearing a professional beige blazer and glasses with a friendly smile, standing in a bright modern Seoul community center, a golden retriever dog sitting calmly next to her."
                    },
                    {
                        title: "Operation Period",
                        text: "운영 기간은 2026년 1월 21일부터 12월 31일까지이며, 예산 소진 시 조기 종료될 수 있습니다.",
                        subtitle: "2026.01.21 ~ 12.31 운영",
                        imagePrompt: "The 30s Korean female social worker pointing to a clean digital calendar showng January to December 2026 on a wall in the bright community center."
                    },
                    {
                        title: "Target Audience",
                        text: "신청 대상은 성동구에 주민등록을 둔 취약계층, 범죄피해자 및 1인가구입니다.",
                        subtitle: "취약계층 및 1인가구 대상",
                        imagePrompt: "The 30s Korean female social worker charing with an elderly Korean person holding a small dog in the sunny office, high-tech screen in background."
                    },
                    {
                        title: "Contact Information",
                        text: "더 궁금한 사항은 지정 업체 또는 성동구청 복지정책과 02-2286-5033으로 문의하십시오.",
                        subtitle: "문의: 02-2286-5033",
                        imagePrompt: "A close-up of a modern desk with a phone and a clean signage showing the phone number 02-2286-5033 in clear Korean Hangul font."
                    }
                ],
                thumbnailSuggestions: {
                    catchyTitle: "우리동네 펫위탁소 펫캉스!",
                    impactfulSceneIndex: 0
                }
            });
        }
        // --- SIMULATION MODE END ---

        const imageParts: any[] = [];
        const imageLimit = analysisMode === 'album' ? 20 : 3; // Increase limit for album mode

        // Ensure modules are available
        const fs = require('fs');
        const path = require('path');

        if (imagesToProcess && Array.isArray(imagesToProcess)) {
            for (const imgUrl of imagesToProcess.slice(0, imageLimit)) {
                try {
                    let buffer: Buffer | null = null;
                    let mimeType = 'image/jpeg';

                    if (imgUrl.startsWith('/uploads/')) {
                        const filePath = path.join(process.cwd(), 'public', imgUrl);
                        if (fs.existsSync(filePath)) {
                            buffer = fs.readFileSync(filePath);
                            const ext = path.extname(filePath).toLowerCase();
                            if (ext === '.png') mimeType = 'image/png';
                            else if (ext === '.gif') mimeType = 'image/gif';
                            else if (ext === '.webp') mimeType = 'image/webp';
                        } else {
                            console.warn(`Local file not found: ${filePath}`);
                        }
                    } else {
                        const imgRes = await fetch(imgUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                            }
                        });
                        if (imgRes.ok) {
                            buffer = Buffer.from(await imgRes.arrayBuffer());
                            mimeType = imgRes.headers.get('content-type') || mimeType;
                        }
                    }

                    if (buffer) {
                        const base64 = buffer.toString('base64');
                        imageParts.push({
                            inlineData: {
                                data: base64,
                                mimeType: mimeType
                            }
                        });
                    }
                } catch (e) {
                    console.warn(`Failed to fetch image for analysis: ${imgUrl}`, e);
                }
            }
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        imageAnalysis: {
                            type: SchemaType.OBJECT,
                            properties: {
                                summary: { type: SchemaType.STRING },
                                visualStyle: { type: SchemaType.STRING },
                                dominantColors: {
                                    type: SchemaType.ARRAY,
                                    items: { type: SchemaType.STRING }
                                }
                            },
                            required: ["summary", "visualStyle", "dominantColors"]
                        },
                        suggestedStyles: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    name: { type: SchemaType.STRING },
                                    description: { type: SchemaType.STRING },
                                    colors: {
                                        type: SchemaType.ARRAY,
                                        items: { type: SchemaType.STRING }
                                    }
                                },
                                required: ["name", "description", "colors"]
                            }
                        },
                        consistency: {
                            type: SchemaType.OBJECT,
                            properties: {
                                character: { type: SchemaType.STRING },
                                theme: { type: SchemaType.STRING }
                            },
                            required: ["character", "theme"]
                        },
                        summary: { type: SchemaType.STRING },
                        description: { type: SchemaType.STRING, description: "A social media optimized description for the video (YouTube/Instagram). Include emojis and 3-5 relevant hashtags." },
                        scenes: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    text: { type: SchemaType.STRING },
                                    title: { type: SchemaType.STRING },
                                    subtitle: { type: SchemaType.STRING },
                                    imagePrompt: { type: SchemaType.STRING },
                                    isDocumentScene: { type: SchemaType.BOOLEAN, description: "True if this scene is based on attached document text, False if based on a specific image." }
                                },
                                required: ["text", "title", "subtitle", "imagePrompt"]
                            }
                        },
                        thumbnailSuggestions: {
                            type: SchemaType.OBJECT,
                            properties: {
                                catchyTitle: { type: SchemaType.STRING, description: "A punchy, 3-5 word title for the thumbnail in Korean (Hangul), MUST include 1 relevant emoji (e.g. 🔥, ✨, ⚠️)" },
                                impactfulSceneIndex: { type: SchemaType.NUMBER, description: "The index of the scene (0-indexed) most suitable for a thumbnail background. Usually the most visually representative scene." }
                            },
                            required: ["catchyTitle", "impactfulSceneIndex"]
                        },
                        extractedText: { type: SchemaType.STRING }
                    },
                    required: ["summary", "description", "scenes", "imageAnalysis", "consistency", "suggestedStyles", "thumbnailSuggestions"]
                }
            }
        });


        const prompt = `
You are an expert content creator and visual director.
Analyze the following text and attached images (if any) from a bulletin board post.
If the provided 'text' is empty or minimal, you MUST rely PRIMARILY on the visual content and text extracted from the images to understand the topic and details.

**Target Visual Style Directive**:
${imageStylePrompt}

- **CRITICAL**: ALL generated image prompts MUST strictly adhere to the Visual Style Directive above.

**Content Purpose (Tone & Style)**: ${videoPurpose || 'PR'}
**Content Structure (Layout)**: ${structureMode}

**Tone & Style Guidelines (Based on '${videoPurpose || 'PR'}'):**
- **PR (Policy/Vision)**:
  - **Script Tone**: Emotional, Inspiring, Trust-building. Use polite & hopeful language (e.g., "We promise a better future").
  - **Visual Style**: Cinematic, Wide Shot, Warm Light, Hopeful atmosphere. Keywords: Clean city, Happy family, Futuristic.
- **Education (Guide/Manual)**:
  - **Script Tone**: Friendly, Clear, Step-by-step. Use instructional language (e.g., "Follow these steps").
  - **Visual Style**: 3D Isometric, Minimal, Soft colors, Instructional. Keywords: 3D render, Cute, Soft colors.
- **Notice (Official/Info)**:
  - **Script Tone**: Dry, Fact-based, Strict. Focus on deadlines and obligations.
  - **Visual Style**: Knolling, Flat Lay, Professional, Neat. Keywords: Calendar, Checklist, Cool Blue Tone.
- **Event (Promo/Fun)**:
  - **Script Tone**: Energetic, Exciting, Persuasive. "Sell" the idea!
  - **Visual Style**: Vibrant, Dynamic, Pop Art, Neon. Keywords: Confetti, Crowd, Colorful, High contrast.

**Structure Guidelines (Based on '${structureMode}'):**
- **detailed**: Focus on factual accuracy and high information density. 
   - **Layout**: "Infographic Chart", "Split Screen Comparison", or "Step-by-Step Flow".
   - **CRITICAL**: Image prompts MUST describe a structured graphic layout embedding key Korean text.
- **infographic**: Focus on "Visual structured data".
   - **Layout**: "Vector Art", "Charts", "Timelines".
   - **CRITICAL**: Image prompts MUST describe a structured graphic layout (charts, timelines) embedding key Korean text.
- **key**: Focus on brevity (3-5 takeaways). Direct response.
- **event**: (See 'Event' tone above - prioritize visual attractiveness).

**User Specific Instructions (HIGHEST PRIORITY)**:
${customPrompt ? `- ${customPrompt}` : "None"}
${isMultiPost && multiPostCount ? `
**MULTI-POST CONTEXT (CRITICAL)**:
- The content below is a combination of ${multiPostCount} separate posts, each separated by "---".
- You MUST distribute the scene count roughly equally among the posts (e.g., ${Math.round((sceneCount || 8) / multiPostCount)} scenes per post if ${sceneCount || 8} total scenes).
- Each post's story must flow naturally into the next. Create a cohesive single video, not a series of disconnected segments.
- Begin the video with an intro scene that introduces the combined topic.
` : ""}

Task:
1. [Image Text Extraction] (CRITICAL):
   - Thoroughly read and extract ALL text visible within the provided images (e.g., posters, infograpics, documents).
   - Return this text in the 'extractedText' field.
   - USE this extracted info to supplement the main text analysis.

2. [Image Analysis]:
   - Analyze the visual style, extract top 3-5 hex colors, and summarize.

3. [Style Recommendations] (MANDATORY): recommend 3 matching styles with name, description, and hex colors.

4. [Consistency Definition]: 
   - Define a Main Korean Character (gender, age, clothing).
   - Define a Consistent Visual Theme (location, lighting).


5. [Content Summary & Description]: 
   - Summarize text in Korean for the 'summary' field.
   - Create a 'description' for social media (YouTube/Instagram) in Korean. It should be engaging, include emojis, and end with 3-5 relevant hashtags.


6. [Scene Creation]:
   - ${!sceneCount || sceneCount === 'AUTO' ? "Create 4-8 scenes" : `Create EXACTLY ${sceneCount} scenes`} based on BOTH the main text AND the text extracted from images.
   - For each scene: 
     - text (narrative Korean): ${narrationLength === 'Short' ? "Strictly 1-2 concise sentences. Maximum 80 characters. Core facts only." : narrationLength === 'Long' ? "5+ detailed sentences with storytelling." : "3-4 balanced sentences. ~150 characters."} Title (short), subtitle (tight display text), and imagePrompt (detailed English). **CRITICAL**: ALL visible text in images (signage, labels, UI) MUST be strictly in Korean (Hangul).
     - **IF PURPOSE IS 'detailed' OR 'infographic'**: Mandate a structured infographic layout. Describe embedding the 'subtitle' and key data as bold graphic text strictly in Korean (Hangul).
     - **IF PURPOSE IS NOT 'detailed' AND NOT 'infographic'**: Focus on visual metaphors. If text appears, keep it to 1-3 words in signage, strictly in Korean (Hangul).
     - Ensure character and theme consistency.
     - **INTEGRATION**: If the images contain specific dates, phone numbers, or locations not in the main text, MAKE SURE to include them in the relevant scene's narrative or subtitle.

7. [Thumbnail Suggestion] (CRITICAL):
   - Generate a catchy, click-worthy title for a YouTube/SNS thumbnail in Korean (3-5 words).
   - Pick the most visually interesting scene to be used as the background.

Text to analyze:
${text}

${extractedFileContent ? `\n*** ATTACHED FILE CONTENT ***\n${extractedFileContent}` : ""}
`;

        // --- ALBUM MODE PROMPT OVERRIDE ---
        let finalPrompt = prompt;
        if (structureMode === 'album') {
            const imageCount = imageParts.length;
            const hasDocumentContent = !!extractedFileContent;

            finalPrompt = `
You are an expert photo essay curator.
Analyze the following text${hasDocumentContent ? ", attached document content," : ""} and the ${imageCount} attached images.

**Mode**: Photo Album (Image-Centric${hasDocumentContent ? " + Document Context" : ""})
**Task PRE-REQUISITE**: 
${hasDocumentContent ? `1. First, create 1-3 introductory scenes summarizing the KEY CONTENT from the attached documents/files. Set 'isDocumentScene' to true for these.` : ""}
2. Then, create exactly ${imageCount} scenes, one for each attached image, in the exact order they were provided. Set 'isDocumentScene' to false for these.

1. [Image Analysis]:
   - Analyze the visual style of the provided images.

2. [Scene Creation]:
   - **Phase 1: Document/Context Scenes** (Only if documents exist):
     - Summarize the core message of the documents.
     - imagePrompt: Creating a clean, relevant title slide or infographic style representation of the document's topic.

   - **Phase 2: Image Scenes**:
     - Create EXACTLY ${imageCount} scenes.
     - Scene [Next] MUST correspond to Image 1.
     - Scene [Next+1] MUST correspond to Image 2.
     - ...and so on.
     - For each scene:
       - **text**: ${narrationLength === 'Short' ? "Strictly 1-2 concise sentences (Max 80 chars)." : narrationLength === 'Long' ? "Detailed storytelling (5+ sentences)." : "A warm, engaging narration (3-4 sentences)."} **MUST BE IN KOREAN (Hangul)**.
       - **title**: A short caption for the photo. **MUST BE IN KOREAN (Hangul)**.
       - **subtitle**: Date or location context if available, or a short keyword. **MUST BE IN KOREAN (Hangul)**.
       - **imagePrompt**: ${allowImageVariation ? `Describes the content of the attached image EXACTLY as it is (maintain subject, pose, composition, background), but explicitly apply the visual style: '${selectedStyle || "High Quality Photo"}'. Do NOT change the content, only the specific artistic style.` : "Describe the content of the image in detail."}
       - **IMPORTANT**: If the user requested NO variation, the system will override the image with the original, but you must still provide a valid 'imagePrompt' that describes the image accurately for indexing.

Text to analyze:
${text}

${extractedFileContent ? `\n*** ATTACHED FILE CONTENT ***\n${extractedFileContent}` : ""}
`;
        }

        const result = await model.generateContent([finalPrompt, ...imageParts]);
        const responseText = result.response.text();
        const usage = result.response.usageMetadata;

        // Approximate Cost Calculation (Based on Gemini 1.5 Flash Pricing)
        // Input: $0.075 / 1M tokens
        // Output: $0.30 / 1M tokens
        let inputCost = 0;
        let outputCost = 0;

        if (usage) {
            inputCost = (usage.promptTokenCount / 1000000) * 0.075;
            outputCost = (usage.candidatesTokenCount / 1000000) * 0.30;
        }

        const totalCost = inputCost + outputCost;

        const responseData = JSON.parse(responseText);

        // --- ALBUM MODE POST-PROCESSING ---
        // If Album mode AND No Variation requested, override the generated image prompts/urls with originals.
        if (analysisMode === 'album' && !allowImageVariation && responseData.scenes) {
            let imageIndex = 0;
            responseData.scenes = responseData.scenes.map((scene: any) => {
                // Skip injection for document scenes
                if (scene.isDocumentScene) {
                    return scene;
                }

                // Inject original image if available
                if (imageIndex < (imagesToProcess?.length || 0)) {
                    // We inject the original URL directly. 
                    const originalUrl = imagesToProcess[imageIndex];
                    scene.imageUrl = originalUrl; // REQUIRED for frontend display
                    scene.originalImageUrl = originalUrl;
                    scene.imagePrompt = `[Original Photo Used] ${scene.imagePrompt}`;
                    imageIndex++;
                }
                return scene;
            });
        }


        responseData.usage = {
            inputTokens: usage?.promptTokenCount || 0,
            outputTokens: usage?.candidatesTokenCount || 0,
            totalCostUSD: totalCost,
            estimatedCostKRW: totalCost * 1450 // Approx exchage rate
        };

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error('Content processing error:', error);
        // Fallback to simulation if quota matched
        if (error.message && error.message.includes("429")) {
            return NextResponse.json({
                error: "Quota exceeded. Simulation mode activated.",
                isSimulation: true,
                summary: "성동구 취약계층 펫위탁소 운영안내 (시뮬레이션)",
                scenes: [
                    { title: "Intro", text: "성동구 펫위탁소 운영 안내입니다.", subtitle: "펫위탁소 안내", imagePrompt: "Korean social worker with dog" },
                    { title: "Info", text: "취약계층 및 1인가구를 대상으로 합니다.", subtitle: "대상자 안내", imagePrompt: "Elderly person with pet" }
                ],
                imageAnalysis: { summary: "Simulated analysis", visualStyle: "Friendly", dominantColors: ["#4A90E2"] },
                consistency: { character: "Social worker", theme: "City office" },
                suggestedStyles: [{ name: "Warm", description: "Soft", colors: ["#FFF"] }]
            });
        }
        return NextResponse.json({ error: 'Failed to process content' }, { status: 500 });
    }
}
