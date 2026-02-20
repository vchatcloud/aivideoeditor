import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "");

// Detects AI refusal/apology messages so we don't use them as post content
const isRefusalMessage = (text: string): boolean => {
    const lower = text.toLowerCase();
    const refusalPhrases = [
        'i am unable', 'i cannot', 'i could not', 'i was unable',
        'unable to find', 'unable to retrieve', 'unable to access',
        'no results found', 'no relevant', 'do not have access',
        'cannot access', 'cannot retrieve', 'cannot provide',
        'search results do not', 'search did not return',
        'i apologize', 'unfortunately', 'regret to inform',
        'i\'m sorry', "i'm unable", 'does not contain',
    ];
    return refusalPhrases.some(p => lower.includes(p));
};

export async function POST(request: Request) {
    try {
        const { url, prompt, topN } = await request.json();

        if (!url || !prompt) {
            return NextResponse.json({ error: 'URL and Prompt are required' }, { status: 400 });
        }

        const requestedCount = Math.min(topN || 10, 20);
        const today = new Date().toISOString().split('T')[0];

        // ─────────────────────────────────────────────────────────────────────
        // Google Search Grounding — 도메인 한정 검색 + topic 검색 두 쿼리 병렬 시도
        // Temperature = 0 for maximum determinism / consistency
        // ─────────────────────────────────────────────────────────────────────
        const searchModel = genAI.getGenerativeModel({
            model: "gemini-2.0-flash",
            // @ts-ignore
            tools: [{ googleSearch: {} }],
            generationConfig: {
                temperature: 0,
                maxOutputTokens: 8192,
            },
        });

        // Strategy: Try domain-scoped query first, fall back to broader query if needed
        const domainHostname = (() => {
            try { return new URL(url).hostname; } catch { return url; }
        })();

        const searchQuery = `
오늘 날짜: ${today}

다음 지시사항을 따르세요:
1. Google에서 다음 두 가지 검색어로 검색하세요:
   - 검색어 A: site:${domainHostname} ${prompt}
   - 검색어 B: ${domainHostname} ${prompt} (site: 없이)
2. 검색 결과에서 ${url} 도메인의 실제 게시물·공고·행사·정보 최대 ${requestedCount}개를 찾으세요.
3. 검색 결과가 부족하면, 해당 도메인과 관련된 유사 주제 게시물을 추가로 포함해도 됩니다.
4. 결과가 하나도 없을 경우에만 "결과 없음"을 출력하세요.

출력 규칙:
- 모든 텍스트(TITLE, CONTENT)는 반드시 한국어(한글)로 작성하세요. 영어 사용 금지.
- 출력은 아래 포맷만 사용하세요. 각 항목은 "<<<ITEM>>>"으로 구분하세요.
- 설명, 사과, 안내 문구는 절대 포함하지 마세요. 포맷대로만 출력하세요.

TITLE 규칙:
- 실제 게시물 제목만 적으세요.
- "| 사이트명", "- 메뉴명" 같은 suffix는 제거하세요.
- 틀린 예: "2025년 일자리사업 공모 | 고시·공고 - 경기도청"
- 올바른 예: "2025년 일자리사업 공모"

CONTENT 규칙 (해당 항목만 포함, 없으면 생략):
[일정] 신청기간, 행사일시, 모집기간 등 날짜·일정
[대상] 신청 대상, 자격 조건 (거주지, 나이, 소득, 직종 등)
[내용] 사업·행사의 핵심 내용, 제공 프로그램, 지원 내용
[혜택] 지원 금액, 무료 서비스, 할인율, 보조금 등
[신청방법] 신청 방법·접수처 (온라인/방문, URL, 연락처)

---출력 포맷---
TITLE: [실제 게시물 제목만]
LINK: [전체 URL]
DATE: [YYYY-MM-DD 또는 공란]
CONTENT: [위 항목 형식으로 한국어 상세 내용]
<<<ITEM>>>
TITLE: [실제 게시물 제목만]
LINK: [전체 URL]
DATE: [YYYY-MM-DD 또는 공란]
CONTENT: [위 항목 형식으로 한국어 상세 내용]
<<<ITEM>>>`;

        const searchResult = await searchModel.generateContent({
            contents: [{ role: "user", parts: [{ text: searchQuery }] }],
        });

        const rawText = searchResult.response.text().trim();

        console.log("=== GEMINI SEARCH AI RAW OUTPUT ===");
        console.log(rawText.substring(0, 2000));
        console.log("===================================");

        // ─────────────────────────────────────────────────────────────────────
        // Detect refusal — return empty list rather than showing apology as post
        // ─────────────────────────────────────────────────────────────────────
        if (isRefusalMessage(rawText) && !rawText.includes('TITLE:')) {
            console.log("=== REFUSAL DETECTED: returning empty posts ===");
            return NextResponse.json({ posts: [] });
        }

        // ─────────────────────────────────────────────────────────────────────
        // Parse output — try primary separator first, fallback to others
        // ─────────────────────────────────────────────────────────────────────
        const posts: { title: string; link: string; date: string; content: string }[] = [];

        const separators = [
            /<<<ITEM>>>/,
            /---+/,
            /===+/,
            /\*\*\*+/,
            /\n\n(?=TITLE\s*:)/i,
        ];

        let blocks: string[] = [];
        for (const sep of separators) {
            const candidate = rawText.split(sep);
            if (candidate.length > 1) {
                blocks = candidate;
                break;
            }
        }

        if (blocks.length === 0) {
            blocks = [rawText];
        }

        const cleanBrackets = (s: string) =>
            s.trim().replace(/^\[|\]$/g, '').replace(/^\*\*|\*\*$/g, '').trim();

        const badDateValues = new Set(['null', 'empty', '[empty]', 'none', 'n/a', '-', '없음', '미상', 'unknown', 'not available']);

        const cleanTitle = (raw: string): string => {
            let t = raw.trim();
            t = t.replace(/\s*\|.*$/, '').trim();
            t = t.replace(/\s+-\s+[^-]{1,20}$/, '').trim();
            t = t.replace(/^\[|\]$/g, '').replace(/^\*\*|\*\*$/g, '').trim();
            return t;
        };

        for (const block of blocks) {
            const trimmed = block.trim();
            if (!trimmed || trimmed.length < 10) continue;

            // Skip blocks that look like refusal messages
            if (isRefusalMessage(trimmed) && !trimmed.includes('TITLE:')) continue;

            const titleMatch = trimmed.match(/TITLE\s*:\s*([^\n]+)/i);
            const linkMatch = trimmed.match(/LINK\s*:\s*(https?[^\s\n]+)/i);
            const dateMatch = trimmed.match(/DATE\s*:\s*([^\n]*)/i);
            const contentMatch = trimmed.match(/CONTENT\s*:\s*([\s\S]+)/i);

            if (!titleMatch) continue;

            const title = cleanTitle(titleMatch[1]);
            if (!title || title.length < 2) continue;

            // Skip if title looks like a refusal message
            if (isRefusalMessage(title)) continue;

            const linkRaw = linkMatch ? cleanBrackets(linkMatch[1]) : url;
            const link = linkRaw || url;

            let date = dateMatch ? cleanBrackets(dateMatch[1]) : '';
            if (badDateValues.has(date.toLowerCase())) date = '';
            const dateOnly = date.match(/\d{4}-\d{2}-\d{2}/);
            if (dateOnly) date = dateOnly[0];

            const content = contentMatch ? contentMatch[1].trim() : '';

            posts.push({ title, link, date, content });

            if (posts.length >= requestedCount) break;
        }

        console.log(`=== PARSED POSTS: ${posts.length} ===`);

        return NextResponse.json({ posts: posts.slice(0, requestedCount) });

    } catch (error: any) {
        console.error('AI Search error:', error);
        return NextResponse.json({ error: 'Failed to search posts via AI: ' + error.message }, { status: 500 });
    }
}
