import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function POST(request: Request) {
    try {
        const { posts, filters } = await request.json();

        if (!posts || !Array.isArray(posts) || posts.length === 0) {
            return NextResponse.json({ error: 'Posts array is required' }, { status: 400 });
        }
        if (!filters || !Array.isArray(filters) || filters.length === 0) {
            return NextResponse.json({ error: 'Filters array is required' }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({
            model: "gemini-flash-latest",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        results: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    postIndex: { type: SchemaType.NUMBER, description: "0-indexed position of the post in the input array" },
                                    matchedFilterIds: {
                                        type: SchemaType.ARRAY,
                                        items: { type: SchemaType.STRING },
                                        description: "Array of filter IDs that match this post"
                                    },
                                    matchedPhrases: {
                                        type: SchemaType.ARRAY,
                                        items: {
                                            type: SchemaType.OBJECT,
                                            properties: {
                                                filterId: { type: SchemaType.STRING, description: "The filter ID this phrase matched" },
                                                phrases: {
                                                    type: SchemaType.ARRAY,
                                                    items: { type: SchemaType.STRING },
                                                    description: "Exact phrases from the post title or content that triggered this filter match"
                                                }
                                            },
                                            required: ["filterId", "phrases"]
                                        },
                                        description: "For each matched filter, the exact phrases that triggered the match"
                                    }
                                },
                                required: ["postIndex", "matchedFilterIds", "matchedPhrases"]
                            }
                        }
                    },
                    required: ["results"]
                }
            }
        });

        // Build filter descriptions for the prompt
        const filterDescriptions = filters.map((f: any) =>
            `- Filter ID: "${f.id}" | Type: ${f.type} | Name: "${f.name}" | Criteria: "${f.description}"`
        ).join('\n');

        // Build post summaries for the prompt
        const postSummaries = posts.map((p: any, i: number) => {
            const parts = [`[Post ${i}] Title: "${p.title}" | Date: "${p.date}"`];
            if (p.content && p.content.trim()) {
                parts.push(`Content: "${p.content.substring(0, 500)}"`);
            }
            return parts.join(' | ');
        }).join('\n');

        const prompt = `
You are an expert content classifier for Korean government/public institution bulletin boards.
Your task: classify each post below against ALL provided filters.

**FILTERS:**
${filterDescriptions}

**POSTS:**
${postSummaries}

**INSTRUCTIONS:**
- Classify PRIMARILY based on the post TITLE. The title alone is usually sufficient to determine the post's category.
- If content is provided, use it as additional context.
- A filter matches if the post's title/content semantically fits the filter's criteria.
- For date-based filters (e.g., "행사 시작일 15일 이내"), use today's date: ${new Date().toISOString().split('T')[0]}. If the title mentions an event/행사 but you cannot determine exact dates from the title alone, still match the filter if the post seems event-related.
- Be INCLUSIVE in matching: if a post title reasonably suggests it fits a filter, match it.
- Examples of matching logic:
  - "채용공고" (recruitment) → matches "단순 정책홍보" exclude filter
  - "축제 안내" (festival guide) → matches "축제" include filter
  - "지원사업 모집 알림" → matches "혜택,정보" include filter
- For EACH matched filter, extract the EXACT phrases (words or short sentences) from the post's title or content that caused the match. These phrases must be EXACT substrings from the original text.
- Return matched filter IDs and matched phrases for EVERY post. If no filters match, return empty arrays.
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        const responseData = JSON.parse(responseText);

        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error('Post classification error:', error);
        return NextResponse.json({ error: 'Failed to classify posts: ' + error.message }, { status: 500 });
    }
}
