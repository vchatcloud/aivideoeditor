import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function POST(request: Request) {
    try {
        const { boards, description } = await request.json();

        if (!boards || !Array.isArray(boards) || boards.length === 0) {
            return NextResponse.json({ error: 'boards array is required' }, { status: 400 });
        }
        if (!description || typeof description !== 'string' || !description.trim()) {
            return NextResponse.json({ error: 'description is required' }, { status: 400 });
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
                                    index: { type: SchemaType.NUMBER },
                                    relevant: { type: SchemaType.BOOLEAN },
                                    score: { type: SchemaType.NUMBER },
                                    reason: { type: SchemaType.STRING }
                                },
                                required: ["index", "relevant", "score"]
                            }
                        }
                    },
                    required: ["results"]
                }
            }
        });

        const boardList = boards.map((b: { name: string; url: string }, i: number) =>
            `[${i}] "${b.name}" (${b.url})`
        ).join('\n');

        const prompt = `당신은 공공기관/정부 웹사이트의 게시판 분류 전문가입니다.

사용자가 원하는 게시판 성격: "${description}"

아래는 발견된 게시판 목록입니다:
${boardList}

각 게시판의 제목(이름)과 URL 패턴을 분석하여, 사용자가 원하는 성격에 해당하는 게시판인지 판별해주세요.

판별 기준:
- 게시판 이름이 사용자가 원하는 성격과 직접적으로 관련이 있는가
- URL 패턴에서 관련성을 유추할 수 있는가
- "공지사항", "알림", "소식" 등 일반적 게시판은 사용자 설명과 매칭될 때만 relevant로 표시

모든 게시판에 대해 아래 항목을 반환해주세요:
- relevant: true/false
- score: 관련도 점수 (0~100, 100이 가장 관련성 높음)
- reason: 간단한 사유 (한국어)

관련도 점수는 게시판 성격과의 직접적 관련성에 따라:
- 90-100: 완벽 일치
- 70-89: 높은 관련성
- 40-69: 중간 관련성
- 1-39: 낮은 관련성
- 0: 무관`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const parsed = JSON.parse(text);

        return NextResponse.json(parsed);
    } catch (error) {
        console.error('Board filter error:', error);
        return NextResponse.json({ error: 'Failed to filter boards' }, { status: 500 });
    }
}
