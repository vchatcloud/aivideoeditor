import PptxGenJS from 'pptxgenjs';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SRC_DIR = join(process.env.USERPROFILE, 'Desktop', 'feature_proposal');
const MD_FILE = join(SRC_DIR, 'feature_proposal.md');
const OUT_FILE = join(SRC_DIR, 'feature_proposal.pptx');

// --- Color Palette (dark professional theme) ---
const COLORS = {
    bg: '0D0D1A',
    bgCard: '1A1A2E',
    accent: '7C3AED',    // purple
    accentLight: 'A78BFA',
    text: 'FFFFFF',
    textSub: 'B0B0C0',
    tableBg: '16213E',
    tableHeader: '4A3ACD',
    tableAlt: '1A1A3E',
    border: '333355',
};

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
pptx.layout = 'WIDE';

// Master slide background
pptx.defineSlideMaster({
    title: 'DARK_MASTER',
    background: { fill: COLORS.bg },
});

// Helper: add a new slide
function addSlide() {
    return pptx.addSlide({ masterName: 'DARK_MASTER' });
}

// Helper: resolve image path
function resolveImg(src) {
    const imgName = src.replace(/^\.\//, '');
    const fullPath = join(SRC_DIR, imgName);
    return existsSync(fullPath) ? fullPath : null;
}

// =============================================
// SLIDE 1: Title Slide
// =============================================
{
    const slide = addSlide();
    // Gradient accent bar at top
    slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: COLORS.accent } });
    // Title
    slide.addText('AI 영상 자동 제작 시스템', {
        x: 1, y: 2.0, w: 11.33, h: 1.2,
        fontSize: 44, fontFace: 'Malgun Gothic', color: COLORS.text, bold: true, align: 'center',
    });
    // Subtitle
    slide.addText('기능 소개 제안서', {
        x: 1, y: 3.2, w: 11.33, h: 0.8,
        fontSize: 28, fontFace: 'Malgun Gothic', color: COLORS.accentLight, align: 'center',
    });
    // Info
    slide.addText('KT 자동 영상 제작 솔루션  |  2026년 2월 10일', {
        x: 1, y: 4.5, w: 11.33, h: 0.5,
        fontSize: 16, fontFace: 'Malgun Gothic', color: COLORS.textSub, align: 'center',
    });
    // Bottom accent bar
    slide.addShape(pptx.shapes.RECTANGLE, { x: 4, y: 5.5, w: 5.33, h: 0.04, fill: { color: COLORS.accent } });
}

// =============================================
// SLIDE 2: System Overview
// =============================================
{
    const slide = addSlide();
    slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: COLORS.accent } });
    slide.addText('1. 시스템 개요', {
        x: 0.5, y: 0.3, w: 12, h: 0.7,
        fontSize: 30, fontFace: 'Malgun Gothic', color: COLORS.text, bold: true,
    });
    slide.addText(
        '본 시스템은 웹 콘텐츠를 AI가 분석하여 고품질 영상을 자동으로 제작하는\n엔드투엔드 솔루션입니다.',
        { x: 0.8, y: 1.2, w: 11.5, h: 0.8, fontSize: 18, fontFace: 'Malgun Gothic', color: COLORS.textSub }
    );

    // Workflow steps
    const steps = ['콘텐츠\nURL 입력', 'AI 분석', '시나리오\n씬 생성', '이미지\n생성', '내레이션\n생성', '실시간\n프리뷰', '영상\n내보내기', 'SNS\n업로드'];
    const stepW = 1.25;
    const startX = (13.33 - steps.length * stepW - (steps.length - 1) * 0.2) / 2;
    steps.forEach((s, i) => {
        const x = startX + i * (stepW + 0.2);
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x, y: 2.5, w: stepW, h: 1.0, rectRadius: 0.1,
            fill: { color: i === 0 ? COLORS.accent : COLORS.bgCard },
            line: { color: COLORS.accent, width: 1.5 },
        });
        slide.addText(s, {
            x, y: 2.55, w: stepW, h: 0.9,
            fontSize: 11, fontFace: 'Malgun Gothic', color: COLORS.text, align: 'center', valign: 'middle',
        });
        if (i < steps.length - 1) {
            slide.addText('→', {
                x: x + stepW, y: 2.7, w: 0.2, h: 0.5,
                fontSize: 18, color: COLORS.accentLight, align: 'center', valign: 'middle',
            });
        }
    });

    // Dashboard screenshot
    const dashImg = resolveImg('ui_01_content_input.png');
    if (dashImg) {
        slide.addImage({ path: dashImg, x: 1.5, y: 4.0, w: 10, h: 3.2, rounding: true });
    }
}

// =============================================
// Helper: Feature table slide 
// =============================================
function addFeatureSlide(title, subtitle, features, imgSrc) {
    const slide = addSlide();
    slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: COLORS.accent } });

    slide.addText(title, {
        x: 0.5, y: 0.3, w: 12, h: 0.6,
        fontSize: 28, fontFace: 'Malgun Gothic', color: COLORS.text, bold: true,
    });

    if (subtitle) {
        slide.addText(subtitle, {
            x: 0.5, y: 0.85, w: 12, h: 0.4,
            fontSize: 14, fontFace: 'Malgun Gothic', color: COLORS.textSub,
        });
    }

    const hasImg = imgSrc && resolveImg(imgSrc);
    const tableW = hasImg ? 6.0 : 12.0;
    const tableX = 0.5;

    // Feature table
    const tableRows = [];
    // Header
    tableRows.push([
        { text: '기능', options: { bold: true, fontSize: 12, fontFace: 'Malgun Gothic', color: 'FFFFFF', fill: { color: COLORS.tableHeader }, align: 'center', valign: 'middle' } },
        { text: '설명', options: { bold: true, fontSize: 12, fontFace: 'Malgun Gothic', color: 'FFFFFF', fill: { color: COLORS.tableHeader }, align: 'center', valign: 'middle' } },
    ]);
    features.forEach((f, i) => {
        const bg = i % 2 === 0 ? COLORS.tableBg : COLORS.tableAlt;
        tableRows.push([
            { text: f[0], options: { fontSize: 11, fontFace: 'Malgun Gothic', color: COLORS.accentLight, bold: true, fill: { color: bg }, valign: 'middle' } },
            { text: f[1], options: { fontSize: 11, fontFace: 'Malgun Gothic', color: COLORS.textSub, fill: { color: bg }, valign: 'middle' } },
        ]);
    });

    slide.addTable(tableRows, {
        x: tableX, y: 1.4, w: tableW,
        colW: hasImg ? [1.8, 4.2] : [2.5, 9.5],
        border: { type: 'solid', pt: 0.5, color: COLORS.border },
        autoPage: false,
        rowH: 0.38,
    });

    // Image on the right
    if (hasImg) {
        const imgPath = resolveImg(imgSrc);
        slide.addImage({
            path: imgPath, x: 7.0, y: 1.4, w: 5.8, h: 5.5,
            rounding: true,
        });
    }
}

// =============================================
// SLIDE 3: 콘텐츠 수집 & 스크래핑
// =============================================
addFeatureSlide(
    '2.1 콘텐츠 수집 & 스크래핑', null,
    [
        ['다중 사이트 관리', '여러 콘텐츠 소스 사이트를 등록 · 편집 · 삭제'],
        ['자동 스크래핑', '등록된 사이트에서 게시물 목록 자동 수집'],
        ['신규 게시물 감지', '신규 · 기존 게시물을 시각적으로 구분 (배경색 하이라이트)'],
        ['첨부파일 인식', '게시물 내 이미지, 파일 첨부 여부 표시'],
        ['페이징 지원', '"더 보기" 기능으로 이전 게시물 추가 로드'],
    ],
    'ui_02_scraped_posts.png'
);

// =============================================
// SLIDE 4: AI 콘텐츠 분석
// =============================================
addFeatureSlide(
    '2.2 AI 콘텐츠 분석 (Gemini)', null,
    [
        ['텍스트 · 이미지 통합 분석', 'Gemini API로 게시물 본문 + 첨부 이미지를 동시 분석'],
        ['영상 목적 최적화', '영상 용도(홍보, 교육, 안내 등) 기반 분석 방향 설정'],
        ['분석 모드', 'Standard / Photo Album 모드 선택'],
        ['씬 카운트 제어', '생성할 씬 수를 사용자가 직접 지정 가능'],
        ['자동 시나리오 생성', '분석 결과 기반 씬별 본문, 자막, 이미지 프롬프트 자동 생성'],
        ['비용 추정', '씬 수 기반 API 호출 비용 실시간 표시 (USD/KRW)'],
        ['재분석', '스타일 설정 변경 후 재분석 지원'],
    ],
    null
);

// =============================================
// SLIDE 5: AI 이미지 생성
// =============================================
addFeatureSlide(
    '2.3 AI 이미지 생성', null,
    [
        ['다중 모델 자동 폴백', 'Gemini 3 Pro → Imagen 3.0 → Gemini 2.0 Flash 순차 시도'],
        ['프롬프트 자동 최적화', '원본 프롬프트를 AI가 이미지 생성에 최적화된 형태로 재작성'],
        ['한국어 텍스트 강제', '이미지 내 텍스트가 자동으로 한국어(한글)로 생성'],
        ['비주얼 스타일', 'Photorealistic, Cinematic, Watercolor, Knolling 등 8종'],
        ['종횡비 지원', '16:9, 9:16, 1:1, 4:3 자동 적용'],
        ['개별 · 일괄 생성', '씬별 개별 생성 또는 전체 일괄 생성'],
        ['이미지 업로드 + 크롭', '직접 이미지 업로드 시 종횡비 자동 감지 및 크롭 모달 제공'],
    ],
    'ui_scene_editor.png'
);

// =============================================
// SLIDE 6: 내레이션 스튜디오
// =============================================
addFeatureSlide(
    '2.4 내레이션 스튜디오', null,
    [
        ['50+ 음성 라이브러리', 'Neural2 + Gemini Hybrid 음성, 남/녀 · 다국어 지원'],
        ['음성 미리듣기', '서버 캐싱 기반 빠른 음성 프리뷰'],
        ['씬별 개별 설정', '씬마다 음성 · 속도 · 피치 · 볼륨 · 연기 지시문 개별 설정'],
        ['전역 설정 + 오버라이드', '전역 음성 설정에 씬별 오버라이드 적용 가능'],
        ['타임라인 시각화', '오디오 파형 시각화 + 순차 재생'],
        ['내레이션 일괄 생성', '미생성 씬 오디오 전체 일괄 생성'],
        ['오디오 내보내기', '개별 씬 또는 전체 ZIP 파일로 오디오 내보내기'],
    ],
    'ui_narration_studio.png'
);

// =============================================
// SLIDE 7: 영상 렌더링 엔진
// =============================================
addFeatureSlide(
    '2.5 영상 렌더링 엔진 (WebGPU Renderer)', null,
    [
        ['실시간 프리뷰', '브라우저 내 실시간 Canvas 기반 영상 미리보기'],
        ['SNS 플랫폼 최적화', 'YouTube, TikTok/Shorts, Instagram 등 해상도 자동 설정'],
        ['이미지 입장 애니메이션', 'Fade, Scale, Pop, Slide, Wipe, Physics 등 10+ 종'],
        ['동적 자막', '단어별 하이라이트 애니메이션과 8종 스타일 프리셋'],
        ['컬러 그레이딩', 'Brightness, Contrast, Saturation, Exposure 실시간 조절'],
        ['블룸 효과', 'Threshold, Strength, Radius 파라미터로 영상 블룸 적용'],
        ['인트로/아웃트로', '이미지 또는 영상 인트로/아웃트로 삽입'],
        ['QR코드 오버레이', '다중 코너 배치, CTA 라벨 포함'],
    ],
    'ui_preview_renderer.png'
);

// =============================================
// SLIDE 8: 프로젝트 관리
// =============================================
addFeatureSlide(
    '2.6 프로젝트 관리', null,
    [
        ['AirTable 클라우드 저장', '프로젝트 데이터를 AirTable에 영구 저장'],
        ['프로젝트 갤러리', '프로젝트 목록 조회, 제목별 그룹핑'],
        ['버전 히스토리', '최대 50개 버전 자동 보관, 버전별 복원/삭제'],
        ['스냅샷 저장', '버전 메모 포함 스냅샷 수동 저장'],
        ['자동 저장', '변경사항 자동 감지 및 저장'],
        ['씬 템플릿', '씬 구성을 AirTable에 템플릿으로 저장/불러오기/삭제'],
        ['템플릿 이미지 포함', '저장 시 모든 씬 이미지를 서버에 업로드하여 영구 보존'],
    ],
    'ui_04_project_gallery.png'
);

// =============================================
// SLIDE 9: 씬 편집 도구
// =============================================
{
    const slide = addSlide();
    slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: COLORS.accent } });
    slide.addText('2.7 씬 편집 도구', {
        x: 0.5, y: 0.3, w: 12, h: 0.6,
        fontSize: 28, fontFace: 'Malgun Gothic', color: COLORS.text, bold: true,
    });

    const features = [
        ['씬 순서 변경', '드래그 앤 드롭 또는 버튼으로 씬 순서 변경'],
        ['씬 추가/삭제', '빈 씬 추가, 기존 씬 삭제'],
        ['텍스트 인라인 편집', '씬 본문, 자막, 이미지 프롬프트 직접 수정'],
        ['씬별 전환 효과', '씬마다 개별 전환 애니메이션 설정'],
        ['씬별 재생시간', '이미지 표시 시간 개별 설정'],
        ['승인/반려 상태', '이미지 승인 여부 표시, 미승인 이미지 일괄 재생성'],
    ];

    const tableRows = [];
    tableRows.push([
        { text: '기능', options: { bold: true, fontSize: 12, fontFace: 'Malgun Gothic', color: 'FFFFFF', fill: { color: COLORS.tableHeader }, align: 'center' } },
        { text: '설명', options: { bold: true, fontSize: 12, fontFace: 'Malgun Gothic', color: 'FFFFFF', fill: { color: COLORS.tableHeader }, align: 'center' } },
    ]);
    features.forEach((f, i) => {
        const bg = i % 2 === 0 ? COLORS.tableBg : COLORS.tableAlt;
        tableRows.push([
            { text: f[0], options: { fontSize: 12, fontFace: 'Malgun Gothic', color: COLORS.accentLight, bold: true, fill: { color: bg } } },
            { text: f[1], options: { fontSize: 12, fontFace: 'Malgun Gothic', color: COLORS.textSub, fill: { color: bg } } },
        ]);
    });

    slide.addTable(tableRows, {
        x: 0.5, y: 1.2, w: 12.0, colW: [3.0, 9.0],
        border: { type: 'solid', pt: 0.5, color: COLORS.border },
        rowH: 0.42,
    });
}

// =============================================
// SLIDE 10: 기술 아키텍처
// =============================================
{
    const slide = addSlide();
    slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: COLORS.accent } });
    slide.addText('3. 기술 아키텍처', {
        x: 0.5, y: 0.3, w: 12, h: 0.6,
        fontSize: 28, fontFace: 'Malgun Gothic', color: COLORS.text, bold: true,
    });

    // Three columns: Frontend, API, External
    const cols = [
        { title: '프론트엔드 (Next.js)', items: ['React UI · page.tsx', 'WebGPU Canvas Renderer', 'Narration Studio', 'Image Crop Modal'], x: 0.5 },
        { title: 'API Routes (Server-Side)', items: ['Scrape API', 'Process Content API', 'Generate Images API', 'Generate Speech API', 'Upload Image API', 'Templates API', 'Projects API', 'YouTube Auth API'], x: 4.7 },
        { title: '외부 서비스', items: ['Google Gemini API', 'Imagen 3.0 API', 'Google Cloud TTS', 'AirTable Database', 'YouTube Data API'], x: 8.9 },
    ];

    cols.forEach(col => {
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x: col.x, y: 1.2, w: 3.8, h: 0.5 + col.items.length * 0.42, rectRadius: 0.1,
            fill: { color: COLORS.bgCard }, line: { color: COLORS.accent, width: 1 },
        });
        slide.addText(col.title, {
            x: col.x + 0.1, y: 1.25, w: 3.6, h: 0.45,
            fontSize: 13, fontFace: 'Malgun Gothic', color: COLORS.accentLight, bold: true, align: 'center',
        });
        col.items.forEach((item, i) => {
            slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
                x: col.x + 0.2, y: 1.8 + i * 0.42, w: 3.4, h: 0.35, rectRadius: 0.05,
                fill: { color: COLORS.tableBg },
            });
            slide.addText(item, {
                x: col.x + 0.3, y: 1.8 + i * 0.42, w: 3.2, h: 0.35,
                fontSize: 11, fontFace: 'Malgun Gothic', color: COLORS.textSub, valign: 'middle',
            });
        });
    });

    // Arrows between columns
    slide.addText('→', { x: 4.3, y: 2.5, w: 0.4, h: 0.5, fontSize: 24, color: COLORS.accent, align: 'center' });
    slide.addText('→', { x: 8.5, y: 2.5, w: 0.4, h: 0.5, fontSize: 24, color: COLORS.accent, align: 'center' });
}

// =============================================
// SLIDE 11: 워크플로우
// =============================================
{
    const slide = addSlide();
    slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: COLORS.accent } });
    slide.addText('4. 운영 워크플로우', {
        x: 0.5, y: 0.3, w: 12, h: 0.6,
        fontSize: 28, fontFace: 'Malgun Gothic', color: COLORS.text, bold: true,
    });

    const steps = [
        { num: '①', title: 'URL 입력', desc: '콘텐츠 사이트 URL을\n등록하고 스크래핑 실행' },
        { num: '②', title: '게시물 선택', desc: '스크래핑된 목록에서\n영상화할 게시물 선택' },
        { num: '③', title: 'AI 분석', desc: 'Gemini가 콘텐츠를 분석하여\n시나리오 · 씬 자동 생성' },
        { num: '④', title: '이미지 생성', desc: 'AI가 씬별 이미지를\n자동 생성 (수동 업로드 가능)' },
        { num: '⑤', title: '내레이션', desc: 'TTS 음성으로\n내레이션 자동 생성' },
        { num: '⑥', title: '미리보기 & 편집', desc: '실시간 프리뷰에서\nVFX · 자막 · 전환효과 설정' },
        { num: '⑦', title: '영상 내보내기', desc: 'MP4/WebM 렌더링 후\n다운로드 또는 SNS 업로드' },
    ];

    const cardW = 1.55;
    const gap = 0.15;
    const startX = (13.33 - steps.length * cardW - (steps.length - 1) * gap) / 2;

    steps.forEach((s, i) => {
        const x = startX + i * (cardW + gap);
        // Card
        slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
            x, y: 1.5, w: cardW, h: 3.2, rectRadius: 0.1,
            fill: { color: COLORS.bgCard }, line: { color: COLORS.border, width: 0.75 },
        });
        // Number circle
        slide.addShape(pptx.shapes.OVAL, {
            x: x + cardW / 2 - 0.3, y: 1.7, w: 0.6, h: 0.6,
            fill: { color: COLORS.accent },
        });
        slide.addText(s.num, {
            x: x + cardW / 2 - 0.3, y: 1.7, w: 0.6, h: 0.6,
            fontSize: 18, color: 'FFFFFF', align: 'center', valign: 'middle',
        });
        // Title
        slide.addText(s.title, {
            x: x + 0.05, y: 2.5, w: cardW - 0.1, h: 0.5,
            fontSize: 13, fontFace: 'Malgun Gothic', color: COLORS.text, bold: true, align: 'center',
        });
        // Description
        slide.addText(s.desc, {
            x: x + 0.05, y: 3.0, w: cardW - 0.1, h: 1.2,
            fontSize: 10, fontFace: 'Malgun Gothic', color: COLORS.textSub, align: 'center', valign: 'top',
        });

        // Arrow between cards
        if (i < steps.length - 1) {
            slide.addText('▸', {
                x: x + cardW, y: 2.7, w: gap, h: 0.5,
                fontSize: 16, color: COLORS.accentLight, align: 'center', valign: 'middle',
            });
        }
    });
}

// =============================================
// SLIDE 12: Thank You
// =============================================
{
    const slide = addSlide();
    slide.addShape(pptx.shapes.RECTANGLE, { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: COLORS.accent } });
    slide.addText('감사합니다', {
        x: 1, y: 2.3, w: 11.33, h: 1.2,
        fontSize: 48, fontFace: 'Malgun Gothic', color: COLORS.text, bold: true, align: 'center',
    });
    slide.addText('AI 영상 자동 제작 시스템\nKT 자동 영상 제작 솔루션', {
        x: 1, y: 3.8, w: 11.33, h: 1.0,
        fontSize: 20, fontFace: 'Malgun Gothic', color: COLORS.textSub, align: 'center',
    });
    slide.addShape(pptx.shapes.RECTANGLE, { x: 4, y: 5.3, w: 5.33, h: 0.04, fill: { color: COLORS.accent } });
}

// =============================================
// Generate
// =============================================
await pptx.writeFile({ fileName: OUT_FILE });
console.log(`✅ PowerPoint saved: ${OUT_FILE}`);
import { statSync } from 'fs';
const stat = statSync(OUT_FILE);
console.log(`   Size: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
console.log(`   Slides: 12`);
