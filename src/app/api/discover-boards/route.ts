import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Helper: Use Puppeteer to render a JavaScript-heavy page
async function renderWithPuppeteer(pageUrl: string): Promise<string> {
    let puppeteer;
    try {
        puppeteer = await import('puppeteer');
    } catch {
        console.error('[DiscoverBoards] Puppeteer not available');
        return '';
    }
    const browser = await puppeteer.default.launch({ headless: 'new' as unknown as boolean });
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));
        return await page.content();
    } finally {
        await browser.close();
    }
}

// Board URL pattern keywords — LISTING pages only
const BOARD_PATH_PATTERNS = [
    '/bbs/', '/board/', '/notice', '/community/', '/news/',
    '/press/', '/data/', '/pds/', '/gallery/', '/photo/',
    '/recruit/', '/bid/', '/info/',
    '/announce/', '/disclosure/', '/welfare/',
    'bbsId=', 'boardId=', 'menuId=',
    'List.do', 'list.do', 'List.jsp', 'list.jsp',
    'list.php', 'List.php',
];

// Patterns to exclude (not board listing pages)
const EXCLUDE_PATTERNS = [
    '/login', '/member/', '/join/', '/sitemap', '/rss',
    '/eng/', '/en/', '/jp/', '/cn/', '/chi/',
    'javascript:', 'tel:', 'mailto:', '#',
    '.pdf', '.hwp', '.xlsx', '.zip', '.jpg', '.png',
    '/api/', '/admin/', '/manage/',
];

// Patterns indicating individual post detail pages
const DETAIL_PAGE_PATTERNS = [
    'view.do', 'View.do', 'view.jsp', 'View.jsp', 'view.php',
    'detail.do', 'Detail.do', 'detail.jsp', 'detail.php',
    'read.do', 'Read.do', 'read.jsp', 'read.php',
    'content.do', 'Content.do',
    'nttId=', 'ntt_id=', 'articleId=', 'article_id=',
    'seq=', 'idx=', 'sn=', 'bIdx=', 'contentId=',
    'mode=view', 'mode=read', 'mode=detail',
    'act=view', 'act=read', 'act=detail',
    '/view/', '/detail/', '/read/',
];

// Boards to EXCLUDE: user inquiry/suggestion/participation boards
// These are boards where citizens submit content, not where operators post info
const INQUIRY_BOARD_KEYWORDS = [
    '민원', '문의', '제안', '신청', '신고', '건의',
    '질문', 'Q&A', 'QnA', 'q&a', 'FAQ', 'faq',
    '의견', '소통', '참여', '설문', '투표', '여론',
    '불편', '고충', '청원', '토론', '댓글',
    '1:1', '1대1', '상담', '묻고답',
    '자유게시판', '열린게시판', '시민게시판',
    '/qna/', '/faq/', '/civil/', '/complaint/',
    '/petition/', '/suggest/', '/ask/',
];

// Korean board NAME keywords for matching (informational boards only)
const BOARD_TEXT_KEYWORDS = [
    '공지', '알림', '소식', '뉴스', '공고', '채용', '입찰',
    '게시판', '자료실', '갤러리', '사진', '동영상', '보도',
    '행사', '이벤트', '축제', '교육', '강좌', '프로그램',
    '정보', '안내', '복지', '지원', '혜택', '정책',
    '고시', '공시', '입법예고', '계약', '낙찰', '발주',
    '보도자료', '언론', '홍보', '새소식',
];

// Priority scoring: higher = more useful to operators sharing info to citizens
// Boards where operators post information for citizens should rank highest
const BOARD_PRIORITY: Record<string, number> = {
    '공지사항': 100, '공지': 100, '알림': 95, '새소식': 95,
    '소식': 90, '뉴스': 90, '보도자료': 90, '보도': 85,
    '공고': 85, '고시': 85, '공시': 80,
    '채용': 80, '입찰': 80, '계약': 75, '낙찰': 75,
    '행사': 70, '교육': 70, '프로그램': 70,
    '복지': 65, '지원': 65, '혜택': 65,
    '안내': 60, '정보': 60, '정책': 60,
    '자료실': 50, '자료': 50,
    '갤러리': 40, '사진': 40, '동영상': 40,
    '게시판': 30,
};

function getBoardPriority(name: string): number {
    // Check exact matches first, then partial matches
    for (const [keyword, priority] of Object.entries(BOARD_PRIORITY)) {
        if (name === keyword) return priority;
    }
    for (const [keyword, priority] of Object.entries(BOARD_PRIORITY)) {
        if (name.includes(keyword)) return priority;
    }
    return 10; // default low priority
}

// Check if a link text looks like an individual post title
function looksLikePostTitle(text: string): boolean {
    if (text.length > 30) return true;
    if (/20\d{2}[년.\-\/]/.test(text)) return true;
    if (/[제차호].*공고|결과|안내문|모집|시행/.test(text) && text.length > 15) return true;
    if (/\(.{4,}\)/.test(text) && text.length > 15) return true;
    return false;
}

// Check if this looks like an inquiry/suggestion/participation board
function isInquiryBoard(name: string, url: string): boolean {
    const lowerName = name.toLowerCase();
    const lowerUrl = url.toLowerCase();
    return INQUIRY_BOARD_KEYWORDS.some(k => {
        const lk = k.toLowerCase();
        return lowerName.includes(lk) || lowerUrl.includes(lk);
    });
}

export async function POST(request: Request) {
    try {
        const { url } = await request.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        const origin = new URL(url).origin;
        console.log(`[DiscoverBoards] Scanning: ${url}`);

        // Step 1: Fetch the main page
        let html = '';
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
            });
            html = await res.text();
        } catch (e) {
            console.error('[DiscoverBoards] Static fetch failed, trying Puppeteer');
        }

        if (html.length < 1000) {
            html = await renderWithPuppeteer(url);
        }

        if (!html) {
            return NextResponse.json({ error: 'Failed to fetch the page' }, { status: 500 });
        }

        const $ = cheerio.load(html);
        const discoveredBoards: { name: string; url: string; priority: number }[] = [];
        const seenUrls = new Set<string>();

        const processLink = (href: string | undefined, text: string) => {
            if (!href || !text || text.length < 2) return;

            let fullUrl = '';
            try {
                fullUrl = new URL(href, url).href;
            } catch {
                return;
            }

            if (!fullUrl.startsWith(origin)) return;

            const lowerUrl = fullUrl.toLowerCase();
            const lowerText = text.toLowerCase();

            // Exclusions
            if (EXCLUDE_PATTERNS.some(p => lowerUrl.includes(p.toLowerCase()) || lowerText.includes(p.toLowerCase()))) return;
            if (DETAIL_PAGE_PATTERNS.some(p => lowerUrl.includes(p.toLowerCase()))) return;
            if (looksLikePostTitle(text)) return;

            // Check board patterns
            const isUrlMatch = BOARD_PATH_PATTERNS.some(p => lowerUrl.includes(p.toLowerCase()));
            const isTextMatch = BOARD_TEXT_KEYWORDS.some(k => text.includes(k));

            if (!isUrlMatch && !isTextMatch) return;

            // Normalize URL
            let normalizedUrl = fullUrl
                .replace(/[?&](page|pageIndex|pageNo|currentPage)=[^&]*/gi, '')
                .replace(/[?&]$/, '')
                .replace(/\?$/, '')
                .replace(/\/+$/, '');

            if (seenUrls.has(normalizedUrl)) return;
            seenUrls.add(normalizedUrl);

            // Clean name
            let cleanName = text
                .replace(/[\r\n\t]+/g, ' ')
                .replace(/^\d+[\s.]+/, '')
                .replace(/\(\d+\)$/, '')
                .replace(/NEW|new|N/, '')
                .trim();

            if (cleanName.length < 2 || cleanName.length > 50) return;

            // Exclude inquiry/suggestion boards
            if (isInquiryBoard(cleanName, normalizedUrl)) {
                console.log(`[DiscoverBoards] Excluded inquiry board: ${cleanName}`);
                return;
            }

            discoveredBoards.push({
                name: cleanName,
                url: normalizedUrl,
                priority: getBoardPriority(cleanName)
            });
        };

        // Step 2: Extract all links
        $('a[href]').each((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim().replace(/\s+/g, ' ').substring(0, 100);
            processLink(href, text);
        });

        // Step 3: Navigation menus
        $('nav a[href], .lnb a[href], .snb a[href], .sub_menu a[href], .sub-menu a[href], .gnb a[href], #lnb a[href]').each((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim().replace(/\s+/g, ' ').substring(0, 100);
            processLink(href, text);
        });

        // Deduplicate by URL, keep highest priority
        const boardMap = new Map<string, { name: string; url: string; priority: number }>();
        for (const b of discoveredBoards) {
            const existing = boardMap.get(b.url);
            if (!existing || b.priority > existing.priority) {
                boardMap.set(b.url, b);
            }
        }

        // Sort by priority descending (informational boards first)
        const sortedBoards = Array.from(boardMap.values())
            .sort((a, b) => b.priority - a.priority)
            .map(({ name, url }) => ({ name, url }));

        console.log(`[DiscoverBoards] Found ${sortedBoards.length} candidate boards, validating...`);

        // Step 4: Validate each candidate — fetch the page and verify it has actual post listings
        // A valid board must have: post rows/cards + pagination or search + dates
        const validatedBoards: { name: string; url: string }[] = [];
        const BATCH_SIZE = 5;

        for (let i = 0; i < sortedBoards.length; i += BATCH_SIZE) {
            const batch = sortedBoards.slice(i, i + BATCH_SIZE);
            const results = await Promise.allSettled(
                batch.map(async (board) => {
                    try {
                        const res = await fetch(board.url, {
                            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                            signal: AbortSignal.timeout(8000),
                        });
                        const html = await res.text();
                        const page$ = cheerio.load(html);
                        const bodyText = page$('body').text();

                        let score = 0;
                        const signals: string[] = [];

                        // === Strong signals (20-30 pts each) ===

                        // 1. Table with structured data rows (번호/제목/작성자/등록일 columns)
                        const tableRows = page$('table tbody tr, table tr').length;
                        const hasTableHeaders = page$('th, thead').length > 0;
                        if (tableRows >= 5 && hasTableHeaders) {
                            score += 30; signals.push(`table(${tableRows}rows+headers)`);
                        } else if (tableRows >= 3 && hasTableHeaders) {
                            score += 20; signals.push(`table(${tableRows}rows+headers)`);
                        }

                        // 2. Board column headers (번호, 제목, 작성자, 등록일, 조회수)
                        const headerText = page$('th, .board_header, .list_header, thead').text();
                        const boardColumns = ['번호', '제목', '작성자', '등록일', '조회수', '조회', '날짜', '작성일', '파일', '첨부'];
                        const matchedColumns = boardColumns.filter(c => headerText.includes(c) || bodyText.includes(c));
                        if (matchedColumns.length >= 3) {
                            score += 25; signals.push(`columns(${matchedColumns.join(',')})`);
                        } else if (matchedColumns.length >= 2) {
                            score += 15; signals.push(`columns(${matchedColumns.join(',')})`);
                        }

                        // 3. Board list CSS classes
                        const boardListSelectors = [
                            '.board_list', '.bbs_list', '.boardList', '.notice_list',
                            '.list_table', '.tb_list', '.tbl_list', '.bbsList',
                            '.board-list', '.post-list', '.article-list',
                            '[class*="board"][class*="list"]',
                            '[class*="bbs"][class*="list"]',
                        ];
                        for (const sel of boardListSelectors) {
                            if (page$(sel).length > 0) { score += 20; signals.push('boardCSS'); break; }
                        }

                        // 4. Pagination (very strong signal for boards)
                        const paginationSelectors = [
                            '.pagination', '.paging', '.page_num', '.page_nav',
                            '.pageNav', '.paginate', '.page_wrap', '.board_paging',
                            '[class*="paging"]', '[class*="pagina"]',
                        ];
                        let hasPagination = false;
                        for (const sel of paginationSelectors) {
                            if (page$(sel).length > 0) { hasPagination = true; break; }
                        }
                        if (!hasPagination) {
                            // Also check for page number links
                            const pageLinks = page$('a[href*="page="], a[href*="pageIndex="], a[href*="pageNo="]').length;
                            if (pageLinks >= 2) hasPagination = true;
                        }
                        if (hasPagination) {
                            score += 25; signals.push('pagination');
                        }

                        // 5. Gallery / card layout (for photo/video boards)
                        const gallerySelectors = [
                            '.gallery_list', '.photo_list', '.movie_list', '.video_list',
                            '.card_list', '.thumb_list', '.img_list',
                            '[class*="gallery"]', '[class*="thumb"][class*="list"]',
                        ];
                        for (const sel of gallerySelectors) {
                            if (page$(sel).length > 0) { score += 30; signals.push('gallery'); break; }
                        }
                        // Also check thumbnail grid pattern (multiple image links in a grid)
                        const thumbnailItems = page$('.thumb_item, .gallery_item, .movie_item, .photo_item, .card_item').length;
                        if (thumbnailItems >= 3) {
                            score += 25; signals.push(`thumbItems(${thumbnailItems})`);
                        }

                        // === Medium signals (10-20 pts each) ===

                        // 6. Date cells (YYYY-MM-DD formatted dates in multiple places)
                        const dateElements = page$('td, span, em, div').filter((_, el) => {
                            const t = page$(el).text().trim();
                            return /^\d{4}[\.\-\/]\d{2}[\.\-\/]\d{2}$/.test(t);
                        }).length;
                        if (dateElements >= 3) {
                            score += 20; signals.push(`dates(${dateElements})`);
                        } else if (dateElements >= 1) {
                            score += 5; signals.push(`dates(${dateElements})`);
                        }

                        // 7. Links to detail/view pages (the clickable post titles)
                        const viewLinks = page$('a[href*="view"], a[href*="View"], a[href*="nttId"], a[href*="seq="], a[href*="idx="], a[href*="detail"], a[href*="Detail"]').length;
                        if (viewLinks >= 5) {
                            score += 20; signals.push(`viewLinks(${viewLinks})`);
                        } else if (viewLinks >= 2) {
                            score += 10; signals.push(`viewLinks(${viewLinks})`);
                        }

                        // 8. Post count display ("총 N건", "전체 N", "총 게시물 N")
                        if (/총\s*(게시물\s*)?\d+\s*건|전체\s*\d+|Total\s*:?\s*\d+|페이지\s*\d+\s*\/\s*\d+/i.test(bodyText)) {
                            score += 15; signals.push('postCount');
                        }

                        // 9. Search form (boards typically have a search box)
                        const hasSearchForm = page$('input[type="search"], input[name*="search"], input[name*="keyword"], input[placeholder*="검색"], input[placeholder*="입력"], .search_box, .board_search, [class*="search"]').length > 0;
                        if (hasSearchForm) {
                            score += 10; signals.push('searchForm');
                        }

                        console.log(`[DiscoverBoards]   ${board.name}: score=${score} [${signals.join(', ')}]`);

                        // Threshold: needs at least 2 strong signals (40+ points)
                        if (score >= 40) {
                            return board;
                        }
                        return null;
                    } catch (e) {
                        console.error(`[DiscoverBoards]   Failed to validate ${board.name}: ${e}`);
                        return null; // Don't include if we can't verify
                    }
                })
            );

            for (const r of results) {
                if (r.status === 'fulfilled' && r.value) {
                    validatedBoards.push(r.value);
                }
            }
        }

        console.log(`[DiscoverBoards] Validated ${validatedBoards.length}/${sortedBoards.length} boards`);

        return NextResponse.json({ boards: validatedBoards });

    } catch (error: any) {
        console.error('[DiscoverBoards] Error:', error);
        return NextResponse.json({ error: 'Failed to discover boards: ' + error.message }, { status: 500 });
    }
}
