
import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Helper to parse date strings
const parseDate = (dateStr: string) => {
    // Try to find YYYY-MM-DD or YYYY.MM.DD
    const match = dateStr.match(/(\d{4})[-.](\d{2})[-.](\d{2})/);
    if (match) {
        return new Date(`${match[1]}-${match[2]}-${match[3]}`);
    }
    // Check for HH:mm or HH:mm:ss (indicating today)
    // Matches "10:28", "10:28:04" strictly to avoid matching random text
    const timeMatch = dateStr.trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (timeMatch) {
        const now = new Date();
        // Construct date object for "today" with the parsed time
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(),
            parseInt(timeMatch[1]), parseInt(timeMatch[2]), parseInt(timeMatch[3] || '0'));
    }
    return null;
};

export async function POST(request: Request) {
    try {
        const { url, date } = await request.json();
        if (!url || !date) {
            return NextResponse.json({ error: 'URL and Date are required' }, { status: 400 });
        }

        const targetDate = new Date(date);
        const origin = new URL(url).origin;

        // 1. Fetch the list page
        const response = await fetch(url);
        const html = await response.text();
        const $ = cheerio.load(html);

        const posts: { title: string; link: string; date: string }[] = [];

        // Generic scraper logic: Look for table rows or list items that might contain posts
        // This is a heuristic approach. Adjust selectors for specific board types (Gnuboard, KBoard, etc.)

        // Strategy: Look for elements containing dates
        $('*').each((_, element) => {
            const text = $(element).text().trim();
            const elementDate = parseDate(text);
            if (elementDate) {
                console.log(`[DEBUG] Found date text: "${text}"`);
                // If this element contains a date, look for a link nearby (siblings or parent's siblings)
                // Common pattern: <tr> <td>Title(Link)</td> <td>Date</td> </tr>

                let parentRow = $(element).closest('tr, li, div.list-item, div.cont_box, dl');
                if (parentRow.length > 0) {
                    const rowTag = parentRow.prop('tagName') || 'UNKNOWN';
                    console.log(`[DEBUG]   -> Parent row found: <${rowTag}>`);

                    // Find the best link in this row
                    let bestLink: string | null = null;
                    let bestTitle = "";
                    let fallbackLink: string | null = null;

                    let links = parentRow.find('a');

                    // Fallback: If strict parent is DL/cont_box, search parent (e.g. LI) to find sibling links (thumbnails)
                    // We do this even if 'links.length > 0' because existing links might be social buttons.
                    if (links.length === 0 || ['dl', 'dd', 'dt'].includes(rowTag.toLowerCase()) || parentRow.hasClass('cont_box')) {
                        console.log(`[DEBUG]   -> Container ${rowTag} might be too narrow, checking parent...`);
                        links = parentRow.parent().find('a');
                    }

                    console.log(`[DEBUG]   -> Links in row: ${links.length}`);
                    links.each((_, l) => {
                        const lEl = $(l);
                        const href = lEl.attr('href');
                        const txt = lEl.text().trim();

                        if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;

                        // Capture first valid link as fallback
                        if (!fallbackLink) fallbackLink = href;

                        // Priority 1: Link with significant text
                        if (txt.length > 1 && !/^[-.\s]+$/.test(txt)) {
                            if (!bestTitle || bestTitle.length < txt.length) {
                                bestLink = href;
                                bestTitle = txt;
                                console.log(`[DEBUG]      -> Set Title (Text Link): "${bestTitle}"`);
                            }
                        }
                        // Priority 2: Image link with alt/title (fallback if no text link found yet)
                        else if (!bestTitle) {
                            const img = lEl.find('img');
                            const alt = img.attr('alt') || lEl.attr('title');
                            // Ignore garbage titles like "-" or "."
                            if (alt && alt.trim().length > 1 && !/^[-.\s]+$/.test(alt.trim())) {
                                bestLink = href;
                                bestTitle = alt.trim();
                                console.log(`[DEBUG]      -> Set Title (Img Alt): "${bestTitle}"`);
                            }
                        }
                    });

                    // Regex to catch metadata and DATES (YYYY-MM-DD, YYYY.MM.DD)
                    // Also excluding specific author names like '오규태', '오태규' and badge text '새로운글'
                    const garbageRegex = /^([-.\s]+|작성날짜|작성자|조회수|공유|페이스북|트위터|카카오스토리|네이버밴드|오규태|오태규|새로운글|새글|\d{4}[-.]\d{2}[-.]\d{2})$/;

                    // Fallback: If no title found (or title is garbage), look for separate title element
                    if ((!bestTitle || bestTitle.length <= 1 || garbageRegex.test(bestTitle)) && fallbackLink) {
                        console.log(`[DEBUG]   -> Title "${bestTitle}" weak/missing, trying separate title search...`);
                        // Select all potential title containers, then filter
                        // Added .tit, .txt, .bo_tit, span, b to catch more patterns
                        const candidates = parentRow.find('dt, .subject, .title, strong, h4, h5, dd, .tit, .txt, .bo_tit, b, span');

                        candidates.each((_, el) => {
                            const text = $(el).text().trim();
                            console.log(`[DEBUG]      -> Candidate check (<${el.tagName}>): "${text.substring(0, 30)}..."`);

                            // Use first valid text that isn't garbage/metadata
                            if (text.length > 1 && !garbageRegex.test(text) && !text.includes('작성날짜') && !text.includes('작성자')) {
                                console.log(`[DEBUG]   -> Found separate title candidate: "${text}"`);
                                bestTitle = text;
                                bestLink = fallbackLink;
                                return false; // Stop loop
                            }
                        });
                    }

                    // Last Resort: If STILL no title, grab strict text from parent row
                    if ((!bestTitle || bestTitle.length <= 1) && fallbackLink) {
                        const rawText = parentRow.text().replace(/\s+/g, ' ').trim();
                        // Remove known garbage strings (dates, metadata)
                        const cleanedText = rawText
                            .replace(/작성날짜\s*[\d-.]+/g, '') // Remove date field
                            .replace(/작성자\s*\S+/g, '') // Remove author field
                            .replace(/조회수\s*\d+/g, '') // Remove view count
                            .replace(/(공유|페이스북|트위터|카카오스토리|네이버밴드|새로운글|새글)/g, '')
                            .trim();

                        // If what remains is valid, use it
                        if (cleanedText.length > 1 && !garbageRegex.test(cleanedText)) {
                            console.log(`[DEBUG]   -> Last Resort Title: "${cleanedText.substring(0, 50)}..."`);
                            bestTitle = cleanedText;
                            bestLink = fallbackLink;
                        }
                    }

                    console.log(`[DEBUG]   -> Best Candidate: Title="${bestTitle}", Link="${bestLink}"`);

                    if (bestLink && bestTitle && elementDate >= targetDate) {
                        // Resolve relative URLs first
                        const fullLink = (bestLink as string).startsWith('http') ? (bestLink as string) : new URL(bestLink as string, url).toString();

                        // Check if already added (by Link OR Title)
                        if (!posts.find(p => p.link === fullLink || p.title === bestTitle)) {
                            // Store clean date string (YYYY-MM-DD) instead of raw text
                            const dateString = elementDate.toISOString().split('T')[0];
                            console.log(`[DEBUG]   -> ADDING POST: ${bestTitle} (${dateString})`);
                            posts.push({ title: bestTitle, link: fullLink, date: dateString });
                        } else {
                            console.log(`[DEBUG]   -> Skipped (Duplicate)`);
                        }
                    } else {
                        console.log(`[DEBUG]   -> Skipped: DateMatch=${elementDate >= targetDate} (Target: ${targetDate.toISOString().split('T')[0]}), Link=${!!bestLink}, Title=${!!bestTitle}`);
                    }
                } else {
                    console.log(`[DEBUG]   -> No parent row matched.`);
                }
            }
        });

        // 2. Scrape details for each post
        const detailedPosts = [];

        // Limit to likely posts (prevent scraping navigation/footer links that happen to have dates)
        // Increased limit to cover full list pages (usually 10-20 items)
        const postsToScrape = posts.slice(0, 30);

        // --- Pagination Logic ---
        let nextPageUrl: string | null = null;
        try {
            const paginationSelector = '.pagination, .paging, .pages, .page-list';
            const $pager = $(paginationSelector).first();
            if ($pager.length > 0) {
                // Find current page
                let currentPage = 1;
                const $current = $pager.find('strong, .on, .active, .current');
                if ($current.length > 0) {
                    const txt = $current.text().trim().replace(/[^0-9]/g, '');
                    if (txt) currentPage = parseInt(txt, 10);
                } else {
                    // Fallback: check query param 'pageIndex' or 'page' inside the input url
                    const urlObj = new URL(url);
                    const p = urlObj.searchParams.get('pageIndex') || urlObj.searchParams.get('page');
                    if (p) currentPage = parseInt(p, 10);
                }

                const targetPage = currentPage + 1;
                let $nextLink = $pager.find('a').filter((_, el) => {
                    const t = $(el).text().trim().replace(/[^0-9]/g, '');
                    return t === String(targetPage);
                }).first();

                // If explicit number link not found, try "Next" button if available
                if ($nextLink.length === 0) {
                    // Look for distinct "Next" classes or text
                    $nextLink = $pager.find('a.next, a.btn_next, a.btn-next').first();
                    if ($nextLink.length === 0) {
                        $nextLink = $pager.find('a').filter((_, el) => {
                            const t = $(el).text().trim();
                            return t.includes('다음') || t.includes('Next') || t.includes('>');
                        }).first();
                    }
                }

                if ($nextLink.length > 0) {
                    const href = $nextLink.attr('href');
                    if (href && !href.startsWith('javascript:')) {
                        // Construct absolute URL
                        // Handle strict query merging because relative href "?page=2" drops "cbIdx=57"
                        const baseUrlObj = new URL(url);
                        let finalUrl = new URL(href, url); // Standard resolve first

                        // If the href was just a query string, we need to carefully merge
                        if (href.startsWith('?')) {
                            // finalUrl has only the new params. We should re-add the old ones if missing?
                            // No, standard browser behavior replaces query string. 
                            // BUT for these Korean boards, usually 'cbIdx' is persistent.
                            // If the href strictly says "?pageIndex=2", theoretically "cbIdx" is lost.
                            // Let's assume we need to KEEP existing params not present in the new link.

                            const newParams = new URLSearchParams(finalUrl.search);
                            // Iterate over original params
                            baseUrlObj.searchParams.forEach((value, key) => {
                                if (!newParams.has(key)) {
                                    newParams.set(key, value);
                                }
                            });
                            finalUrl.search = newParams.toString();
                        }

                        nextPageUrl = finalUrl.toString();
                    }
                }
            }
        } catch (e) {
            console.error('Pagination detection failed:', e);
        }

        for (const post of postsToScrape) {
            try {
                const detailRes = await fetch(post.link);
                const detailHtml = await detailRes.text();
                const $$ = cheerio.load(detailHtml);

                // Heuristic for content: text inside generic content containers
                // Common K-board/Gnuboard/eGovFrame selectors:
                // Heuristic for content: text inside generic content containers
                // Common K-board/Gnuboard/eGovFrame selectors:
                const containerSelector = '.bv_cont, .bv_contents, .bbs_view01, #bo_v_con, .view-content, .post_content, article, .content, #content, .view_cont, .bbs_view, .p-table__content, .db_data, .view_contents, .txt-area, .board_view_con, .con-area, .view_text, .bbs_content, .board-text, .board_view, .open_inner';
                let container = $$(containerSelector).first();

                if (container.length === 0) {
                    // Try finding any div with significant text if no container match
                    let maxLen = 0;
                    $$('div').each((_, el) => {
                        const text = $$(el).text();
                        const len = text.length;

                        // Heuristic: Penalize containers that look like headers/menus
                        const isMenu = /모바일메뉴|통합검색|로그인|회원가입|사이트맵|Language|패밀리사이트|관련사이트/.test(text);
                        // Only consider if not a menu dominating the text, or if it's really the only content
                        if (isMenu && len > 500) return; // Skip big menu wrappers

                        if (len > maxLen && len > 50) {
                            maxLen = len;
                            container = $$(el);
                        }
                    });
                }

                let content = "";

                if (container.length > 0) {
                    // 1. Cleaning: Remove unwanted elements (scripts, styles, UI, headers, footers)
                    const cleanContainer = container.clone();

                    // Basic structural elements to remove
                    cleanContainer.find('script, style, noscript, iframe, button, input, select, textarea, form').remove();
                    cleanContainer.find('header, footer, nav, aside, menu, dialog').remove(); // Semantic HMTL5

                    // Common Navigation & Layout garbage
                    cleanContainer.find('.gnb, .lnb, .snb, .tnb, .header, .footer, .sidebar, .aside, .menu, .top-menu, .left-menu, .right-menu').remove();
                    cleanContainer.find('.breadcrumb, .location, .path, .navi, .pg-nav, .page-navi').remove(); // Breadcrumbs

                    // Search & Utilities
                    cleanContainer.find('.search, .search_area, .search-box, .sch, .srch, .util, .utility').remove();

                    // Board specific garbage
                    cleanContainer.find('.btn_area, .board-btm, .list_btn, .file_area, .view_file, .bo_v_file, .view_link').remove();
                    cleanContainer.find('.view_info, .bo_v_info, .sub_info, .info_area, .writer, .date, .hit, .ip, .view-info, .board-info').remove();
                    cleanContainer.find('.bo_v_sns, .sns_area, .share_area, .bo_v_com, .bo_v_nb, .prev-next, .page-move').remove();
                    cleanContainer.find('.kogl, .copyright, .license, .signature, .profile, .admin, .ctt_admin').remove();
                    cleanContainer.find('.img_desc, .caption').remove();
                    cleanContainer.find('.blind, .screen_out, .skip, .sr-only, .accessibility, .hidden, .hide').remove();

                    // Remove explicit attachment rows/sections within the content area
                    cleanContainer.find('tr, li, div, p, dt, dd').filter((_, el) => {
                        const text = $$(el).text().trim();
                        // Remove rows that start with "File" or "Attachment" label
                        return text.startsWith('첨부파일') || text.startsWith('첨부') || text.startsWith('Attachment') || text === '파일';
                    }).remove();

                    // Replace <br> and blocks with newlines to preserve formatting
                    cleanContainer.find('br').replaceWith('\n');
                    cleanContainer.find('p, div, tr, li').each((_, el) => {
                        $$(el).after('\n');
                    });

                    // Capture FULL content (previously only captured text after the last image)
                    content = cleanContainer.text();
                }

                // Final string cleanup
                content = content
                    .replace(/\$\(function\(\)\s*\{[\s\S]*?\}\);\s*}\);?/, '') // Remove jQuery blocks
                    .replace(/var\s+\w+\s*=\s*[\s\S]*?;/g, '') // Remove basic var declarations leaking
                    .replace(/window\.\w+\s*=\s*[\s\S]*?;/g, '') // Remove window assignments
                    .replace(/console\.log\([\s\S]*?\);?/g, '')
                    .replace(/[a-zA-Z_$][0-9a-zA-Z_$]*\s*\([^)]*\)\s*\{[\s\S]*?\}/g, '') // Aggressive function removal check? No, risky for English text.
                    // Safer JS cleanup targeting common patterns in scraped text
                    .replace(/function\s*\w*\s*\(.*?\)\s*\{[\s\S]*?\}/g, '')
                    .replace(/document\.write\(.*?\);?/g, '')
                    .replace(/alert\(.*?\);?/g, '')
                    .replace(/사진 확대보기/g, '')
                    .replace(/\/\/<!\[CDATA\[[\s\S]*?\/\/\]\]>/g, '')
                    // User Request: Remove specific headers/footers
                    .replace(/새소식 상세보기[\s\S]*?정보 제공/g, '') // Accessibility summary
                    .replace(/콘텐츠 만족도 조사[\s\S]*?(확인|등록|평가)/g, '') // Satisfaction survey
                    .replace(/이 페이지에서 제공하는 정보에 대하여[\s\S]*?$/g, '') // Satisfaction footer
                    .replace(/만족도 조사[\s\S]*?$/g, '')
                    .replace(/이 누리집은 대한민국 공식 전자정부 누리집입니다[\s\S]*?$/gm, '') // E-Gov Banner
                    .replace(/열린시정[\s\S]*?공지사항/g, '') // Common Breadcrumb pattern
                    .replace(/표시옵션열기[\s\S]*?닫기/g, '') // Display Options Utility
                    .replace(/공유하기열기[\s\S]*?닫기/g, '') // Share Utility
                    .replace(/출력 및 다운로드열기[\s\S]*?닫기/g, '') // Print/Download Utility
                    .replace(/QR코드열기[\s\S]*?닫기/g, '') // QR Code Utility
                    .replace(/즐겨찾기열기[\s\S]*?닫기/g, '') // Favorites Utility
                    .replace(/담당자 정보[\s\S]*?$/g, '') // Manager info at bottom
                    .replace(/담당부서 :[\s\S]*?최종수정일.*$/g, '') // Manager info variant
                    .replace(/최종수정일\s*[\d.]+/g, '')
                    .replace(/조회수\s*\d+/g, '')
                    .replace(/작성일\s*[\d.]+/g, '')
                    .replace(/목록[\s\S]*?다음글[\s\S]*?$/g, '') // Navigation block (List/Next)
                    .replace(/본 저작물은 "공공누리"[\s\S]*?이용 할 수 있습니다./g, '') // Public License
                    .replace(/이 페이지에서 제공하는 정보에 만족하십니까[\s\S]*?$/g, '') // Footer Survey
                    .replace(/TOP$/g, '') // 'TOP' button text
                    .replace(/^열린시정.*$/gm, '') // Specific breadcrumb/menu line removal

                    // Specific MFDS (식약처) Cleanup
                    .replace(/모바일메뉴[\s\S]*?통합검색/g, '')
                    .replace(/블로그\s*페이스북\s*트위터\s*인스타그램\s*유투브\s*카카오채널/g, '')
                    .replace(/홈으로[\s\S]*?대전지방청/g, '')
                    .replace(/English\s*전자우편구독\s*이용안내/g, '')
                    .replace(/식의약 데이터 누리집/g, '')
                    .replace(/지방식약청[\s\S]*?대전청/g, '')
                    .replace(/정보공개[\s\S]*?사전정보 공개/g, '')
                    .replace(/현재 페이지의 내용에 만족하십니까[\s\S]*?(\(\d+건\)\s*)+/g, '') // Satisfaction Survey Block
                    .replace(/현재 페이지의 내용에 만족하십니까\?/g, '') // Simple Line Removal if block fails

                    .replace(/^\s*[\r\n]/gm, '') // Remove empty lines
                    .replace(/\n{3,}/g, '\n\n') // Limit max newlines to 2
                    .trim();

                // Image extraction
                const uniqueImages = new Set<string>();
                // Added .slide_img img and .bv_cont img for MFDS support
                $$('.slide_img img, .bv_cont img, #bo_v_con img, .view-content img, article img, .view_cont img, .bbs_view img, .p-table__content img, .view_contents img, .txt-area img, .board_view_con img, .con-area img, .view_text img, .bbs_content img, .board-text img, .board_view img, #content img, .open_inner img, .file_viewbox img').each((_, el) => {
                    let src = $$(el).attr('src');
                    if (src) {
                        // Resolve image relative to the specific post URL
                        if (!src.startsWith('http')) src = new URL(src, post.link).toString();

                        // Strict Filtering for Junk Images
                        const lowerSrc = src.toLowerCase();
                        if (lowerSrc.includes('logo') || lowerSrc.includes('icon') || lowerSrc.includes('btn') ||
                            lowerSrc.includes('mark') || lowerSrc.includes('banner') || lowerSrc.includes('opentype') ||
                            lowerSrc.includes('qr') || lowerSrc.includes('screen_qr') || lowerSrc.includes('common')) {
                            return;
                        }

                        uniqueImages.add(src);
                    }
                });
                // const images = Array.from(uniqueImages); // Moved to end

                // File extraction
                const files: { name: string; url: string }[] = [];
                // Common selectors for file attachments in Korean boards
                const fileSelectors = [
                    '.file_area a',
                    '.view_file a',
                    '.bo_v_file a',
                    'a.view_file_download',
                    'ul.file-list a',
                    '.add-file a',
                    '.attach-file a',
                    '.bbs_file_cont a', // MFDS
                    '.bv_file_box a'   // MFDS
                ];

                $$(fileSelectors.join(', ')).each((_, el) => {
                    const $el = $$(el);
                    let href = $el.attr('href');
                    let name = $el.text().trim();

                    if (href && name) {
                        // Filter out javascript links or non-file links
                        if (href.startsWith('javascript:')) return;

                        // Resolve relative URLs
                        if (!href.startsWith('http')) href = new URL(href, post.link).toString();

                        // NEW FILTERS
                        if (name.includes('미리보기') || name.includes('Preview') || name.includes('바로보기') || name.includes('바로듣기')) return;
                        if (name.includes('이미지 다운로드') || name.includes('파일 다운로드')) return; // Filter generic button labels
                        if ($el.hasClass('view-direct')) return;
                        if (href.includes('preImageFromDoc.do')) return;
                        if (name.includes('사진 확대보기')) return;

                        // Fix for "Download" or "파일" generic names
                        // MFDS case: The link text might be "다운로드" or empty, or "다운받기"
                        if (name === 'Download' || name === '다운로드' || name === '파일' || name === '다운받기') {
                            const titleAttr = $el.attr('title');
                            if (titleAttr) {
                                name = titleAttr.replace(/다운로드|파일|받기/g, '').trim();
                            } else {
                                // Try finding previous sibling text (common in lists: "Filename.pdf [Download]")
                                // Robust extraction: Get parent text but remove all child links/buttons (e.g. "Preview", "Download")
                                const $parent = $el.parent();
                                const $clone = $parent.clone();
                                $clone.find('a, button, span.btn, span.label').remove();
                                const prevText = $clone.text().trim();

                                if (prevText && prevText.length > 3) {
                                    name = prevText;
                                }
                            }
                        }

                        files.push({ name, url: href });
                    }
                });

                // Heuristic: Check ALL links in the ENTIRE document for common document extensions
                // This is necessary because sometimes files are in headers/footers/sidebars outside the main content div
                $$('a').each((_, el) => {
                    const $el = $$(el);
                    let href = $el.attr('href');
                    const name = $el.text().trim();

                    if (href) {
                        if (href.startsWith('javascript:')) return;
                        // Skip anchor links
                        if (href.startsWith('#')) return;

                        if (!href.startsWith('http')) {
                            try {
                                href = new URL(href, post.link).toString();
                            } catch (e) { return; }
                        }

                        const lowerHref = href.toLowerCase();
                        // Expanded extension list
                        const extensions = [
                            '.pdf', '.xlsx', '.xls', '.doc', '.docx',
                            '.hwp', '.hwpx', '.ppt', '.pptx', '.zip',
                            '.txt', '.csv', '.jpg', '.png', '.jpeg' // Images as files if linked directly
                        ];

                        // Check if href ends with extension OR contains extension query param (common in download.do?file=xxx.pdf)
                        if (extensions.some(ext => lowerHref.endsWith(ext) || lowerHref.includes(ext + '?') || lowerHref.includes(ext + '&'))) {
                            // Avoid duplicates
                            if (!files.find(f => f.url === href)) {
                                // Filter out utility links like "Preview" or "View large photo"
                                if (name.includes('미리보기') || name.includes('Preview') || name.includes('바로보기') || name.includes('바로듣기')) return;
                                if (name.includes('이미지 다운로드') || name.includes('파일 다운로드')) return; // Filter generic button labels
                                if ($el.hasClass('view-direct')) return;
                                if (href.includes('preImageFromDoc.do')) return;
                                if (name.includes('사진 확대보기')) return;

                                const fileName = name || "Attached File";
                                files.push({ name: fileName, url: href });
                            }
                        }
                    }
                });

                // Targeted Heuristic: Look for "첨부파일" (Attachment) label in tables or lists
                // This handles cases where the link itself doesn't have an extension (e.g., masked download link)
                // but is explicitly in the attachment section.
                const attachmentLabels = $$('th, dt, .label, strong, b, span').filter((_, el) => $$(el).text().includes('첨부파일'));
                attachmentLabels.each((_, el) => {
                    // Find the associated value container (td, dd, or sibling)
                    let valueContainer = $$(el).next('td, dd, div');
                    if (valueContainer.length === 0) {
                        valueContainer = $$(el).parent().find('td, dd, div').not(el);
                    }

                    if (valueContainer.length > 0) {
                        valueContainer.find('a').each((_, aEl) => {
                            const $a = $$(aEl);
                            let href = $a.attr('href');
                            const name = $a.text().trim();

                            if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
                                if (!href.startsWith('http')) {
                                    try {
                                        href = new URL(href, post.link).toString();
                                    } catch (e) { return; }
                                }

                                // Avoid duplicates
                                if (!files.find(f => f.url === href)) {
                                    // Filter out utility links like "Preview" if possible
                                    if (name.includes('미리보기') || name.includes('Preview') || name.includes('바로보기') || name.includes('바로듣기')) return;
                                    if (name.includes('이미지 다운로드') || name.includes('파일 다운로드')) return; // Filter generic button labels
                                    if ($a.hasClass('view-direct')) return;
                                    if (href.includes('preImageFromDoc.do')) return;

                                    const fileName = name || "Attached File";
                                    files.push({ name: fileName, url: href });
                                }
                            }
                        });
                    }
                });

                // Merge images from files
                files.forEach(file => {
                    const lowerUrl = file.url.toLowerCase();
                    if (lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/) || lowerUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)\?/)) {

                        // Apply same filters to file images
                        if (lowerUrl.includes('logo') || lowerUrl.includes('icon') || lowerUrl.includes('btn') ||
                            lowerUrl.includes('mark') || lowerUrl.includes('banner') || lowerUrl.includes('opentype') ||
                            lowerUrl.includes('qr') || lowerUrl.includes('screen_qr') || lowerUrl.includes('common')) {
                            return;
                        }

                        // Robust Deduplication: Check if this URL is already in uniqueImages
                        // Also check if any existing image URL contains this file's filename or ID logic to avoid "view" vs "download" duplicates
                        let isDuplicate = false;
                        if (uniqueImages.has(file.url)) isDuplicate = true;

                        if (!isDuplicate) {
                            // Advanced check: if file is ".../file/download?id=123" and image is ".../file/view?id=123"
                            // K-board logic often uses 'idx=' or 'fileNo='
                            const fileIdMatch = lowerUrl.match(/(idx|fileno|file_cn)=([0-9]+)/);
                            if (fileIdMatch) {
                                const idSignature = fileIdMatch[0]; // e.g. "idx=123"
                                for (const existingUrl of uniqueImages) {
                                    if (existingUrl.toLowerCase().includes(idSignature)) {
                                        isDuplicate = true;
                                        break;
                                    }
                                }
                            }
                        }

                        if (!isDuplicate) {
                            uniqueImages.add(file.url);
                        }
                    }
                });

                const images = Array.from(uniqueImages);

                detailedPosts.push({
                    title: post.title,
                    link: post.link,
                    date: post.date,
                    content: content.substring(0, 5000), // Limit text length
                    images,
                    files
                });

            } catch (e) {
                console.error(`Failed to scrape details for ${post.link}`, e);
            }
        }

        return NextResponse.json({
            posts: detailedPosts,
            nextPageUrl
        });

    } catch (error) {
        console.error('Scraping error:', error);
        return NextResponse.json({ error: 'Failed to scrape' }, { status: 500 });
    }
}
