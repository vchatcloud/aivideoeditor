import { NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

export async function POST(request: Request) {
    try {
        const { summary, sceneTitles, sceneTexts, videoPurpose } = await request.json();

        if (!summary && (!sceneTitles || sceneTitles.length === 0)) {
            return NextResponse.json({ error: 'summary or sceneTitles required' }, { status: 400 });
        }

        const model = genAI.getGenerativeModel({
            model: 'gemini-flash-latest',
            generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        titles: {
                            type: SchemaType.ARRAY,
                            items: { type: SchemaType.STRING },
                        },
                    },
                    required: ['titles'],
                },
            },
        });

        const context = [
            summary ? `영상 요약: ${summary}` : '',
            sceneTitles?.length ? `씬 제목들: ${sceneTitles.join(' / ')}` : '',
            sceneTexts?.length ? `씬 내용: ${sceneTexts.slice(0, 5).join(' | ')}` : '',
            videoPurpose ? `영상 목적: ${videoPurpose}` : '',
        ].filter(Boolean).join('\n');

        const prompt = `
당신은 SNS 바이럴 콘텐츠 전문가입니다.
다음 영상 정보를 바탕으로 SNS(유튜브, 인스타그램, 틱톡) 썸네일에 사용할 클릭을 유도하는 한국어 제목을 10개 생성하세요.

${context}

조건:
- 한국어(한글)로 작성
- 각 제목은 15자 이내 (짧고 강렬하게)
- 반드시 이모지 1개 포함 (🔥, ✨, ⚠️, 🚨, 💡, 🎯, 🏆, 💰, 📌, 🎁 등 적절한 것)
- 궁금증·감탄·긴박감 중 하나를 유발하는 스타일
- 10개 각각을 서로 다른 스타일로 (질문형, 강조형, 숫자형, 충격형 등 혼합)
- 중복 없이 정확히 10개
`;

        const result = await model.generateContent(prompt);
        const parsed = JSON.parse(result.response.text());

        return NextResponse.json({ titles: (parsed.titles as string[]).slice(0, 10) });
    } catch (e: any) {
        console.error('[generate-titles]', e);
        return NextResponse.json({ error: e.message || 'Failed' }, { status: 500 });
    }
}
