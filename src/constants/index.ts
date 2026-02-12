// ============================================================
// Shared Constants for AI Video Editor
// ============================================================

export const ASPECT_RATIOS = [
    { label: "16:9", width: 1920, height: 1080, description: "YouTube / TV" },
    { label: "9:16", width: 1080, height: 1920, description: "Shorts / TikTok" },
    { label: "1:1", width: 1080, height: 1080, description: "Instagram Feed" },
    { label: "4:5", width: 1080, height: 1350, description: "Facebook / Insta Portrait" },
] as const;

export const VISUAL_STYLES = [
    { id: "Photorealistic", label: "Photorealistic", image: "/images/styles/photorealistic.png", description: "Real world photo style" },
    { id: "3D Isometric", label: "3D Isometric", image: "/images/styles/3d_render.png", description: "Cute & Clean 3D" },
    { id: "Flat Vector", label: "Flat Vector", image: "/images/styles/vector_art.png", description: "Clean Graphic Style" },
    { id: "Hand-Drawn", label: "Hand-Drawn", image: "/images/styles/watercolor.png", description: "Artistic Sketch Style" },
] as const;

export const COMPOSITION_STYLES = [
    { id: "Wide", label: "Wide / Text Space", description: "Subject on right, empty space on left" },
    { id: "Center", label: "Center Focus", description: "Subject in center, symmetrical" },
    { id: "Knolling", label: "Knolling", description: "Objects arranged neatly at 90 degrees" },
    { id: "Macro", label: "Macro / Detail", description: "Extreme close-up, depth of field" },
] as const;

export const MOOD_STYLES = [
    { id: "Trustworthy", label: "Trustworthy", description: "Blue tones, professional, bright" },
    { id: "Urgent", label: "Urgent / Alert", description: "High contrast, red/yellow accents" },
    { id: "Eco", label: "Eco & Healthy", description: "Greenery, soft sunlight, organic" },
    { id: "Energetic", label: "Energetic", description: "Vibrant colors, dynamic motion" },
] as const;

export const INTERPRETATION_STYLES = [
    { id: "Literal", label: "Literal", description: "Describe text as-is" },
    { id: "Metaphorical", label: "Metaphorical", description: "Visual metaphors & symbols" },
    { id: "Abstract", label: "Abstract", description: "Flows, patterns, and shapes" },
] as const;

export const CAPTION_PRESETS = [
    {
        id: 'yellow_punch',
        label: '🟡 Yellow Punch (Popular)',
        style: {
            fontSize: 90,
            colors: { activeFill: '#FFD700', baseFill: '#FFFFFF', stroke: '#000000', strokeThickness: 8 },
            animation: 'pop',
            layout: { wordsPerLine: 2, safeZonePadding: true, verticalPosition: 'middle' }
        }
    },
    {
        id: 'cinematic_teal_orange',
        label: '🎬 Cinematic Teal & Orange',
        style: {
            fontSize: 85,
            colors: { activeFill: '#FF8C00', baseFill: '#E0F7FA', stroke: '#004D40', strokeThickness: 6 },
            animation: 'none',
            layout: { wordsPerLine: 0, safeZonePadding: true, verticalPosition: 'bottom' }
        }
    },
    {
        id: 'nostalgic_film',
        label: '📼 Nostalgic Film',
        style: {
            fontSize: 80,
            colors: { activeFill: '#F4E1D2', baseFill: '#D7CCC8', stroke: '#5D4037', strokeThickness: 4 },
            animation: 'none',
            layout: { wordsPerLine: 0, safeZonePadding: true, verticalPosition: 'bottom' }
        }
    },
    {
        id: 'high_contrast_bw',
        label: '⚫ High Contrast B&W',
        style: {
            fontSize: 95,
            colors: { activeFill: '#FFFFFF', baseFill: '#000000', stroke: '#FFFFFF', strokeThickness: 2 },
            animation: 'pop',
            layout: { wordsPerLine: 1, safeZonePadding: true, verticalPosition: 'middle' }
        }
    },
    {
        id: 'muted_pastel',
        label: '🌸 Muted Pastel',
        style: {
            fontSize: 85,
            colors: { activeFill: '#FFB7B2', baseFill: '#E2F0CB', stroke: '#9E9E9E', strokeThickness: 4 },
            animation: 'elastic',
            layout: { wordsPerLine: 0, safeZonePadding: true, verticalPosition: 'middle' }
        }
    },
    {
        id: 'dark_mood_cyber',
        label: '👾 Dark Mood / Cyber',
        style: {
            fontSize: 90,
            colors: { activeFill: '#00FFFF', baseFill: '#1A1A1A', stroke: '#9D00FF', strokeThickness: 6 },
            animation: 'shake',
            layout: { wordsPerLine: 2, safeZonePadding: true, verticalPosition: 'middle' }
        }
    },
    {
        id: 'minimal_white',
        label: '⚪ Minimal White',
        style: {
            fontSize: 70,
            colors: { activeFill: '#000000', baseFill: '#FFFFFF', stroke: '#E5E5E5', strokeThickness: 2 },
            animation: 'none',
            layout: { wordsPerLine: 0, safeZonePadding: true, verticalPosition: 'bottom' }
        }
    },
    {
        id: 'neon_glow',
        label: '🟢 Neon Glow',
        style: {
            fontSize: 90,
            colors: { activeFill: '#39ff14', baseFill: '#000000', stroke: '#39ff14', strokeThickness: 4 },
            animation: 'shake',
            layout: { wordsPerLine: 2, safeZonePadding: true, verticalPosition: 'middle' }
        }
    },
    {
        id: 'paper_texture',
        label: '📜 Paper Texture',
        style: {
            fontSize: 80,
            colors: { activeFill: '#3E2723', baseFill: '#FFF3E0', stroke: '#5D4037', strokeThickness: 3 },
            animation: 'none',
            layout: { wordsPerLine: 0, safeZonePadding: true, verticalPosition: 'bottom' }
        }
    },
    {
        id: 'glassmorphism',
        label: '🧊 Glassmorphism',
        style: {
            fontSize: 80,
            colors: { activeFill: '#FFFFFF', baseFill: 'rgba(255,255,255,0.7)', stroke: '#FFFFFF', strokeThickness: 1 },
            animation: 'none',
            layout: { wordsPerLine: 0, safeZonePadding: true, verticalPosition: 'middle' }
        }
    },
    {
        id: 'pop_art',
        label: '💥 Pop Art',
        style: {
            fontSize: 100,
            colors: { activeFill: '#FFFF00', baseFill: '#FF0000', stroke: '#000000', strokeThickness: 8 },
            animation: 'pop',
            layout: { wordsPerLine: 1, safeZonePadding: true, verticalPosition: 'middle' }
        }
    }
] as const;

export const FONT_DISPLAY_MAP: Record<string, string> = {
    "Pretendard": "Pretendard (기본)",
    "Nanum Gothic": "나눔고딕",
    "Nanum Myeongjo": "나눔명조",
    "Jua": "주아",
    "Do Hyeon": "도현",
    "Gothic A1": "고딕 A1",
    "Noto Sans KR": "본고딕",
    "Black Han Sans": "검은고딕",
    "Sunflower": "해바라기",
    "Stylish": "스타일리시",
    "Gowun Dodum": "고운돋움",
    "Sans-serif": "Sans-serif",
    "Serif": "Serif",
    "Monospace": "Monospace",
    "Fantasy": "Fantasy",
    "Cursive": "Cursive"
};

export const FONT_OPTIONS = Object.keys(FONT_DISPLAY_MAP);
