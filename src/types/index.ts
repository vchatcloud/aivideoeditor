// ============================================================
// Shared Type Definitions for AI Video Editor
// ============================================================

export interface Scene {
    imageUrl: string;
    text: string;
    audioUrl?: string | null;
}

export interface ProjectHistoryItem {
    id: string;
    name: string;
    createdAt: string;
    timestamp?: string;
    thumbnailUrl?: string;
}

export interface ScrapedPost {
    title: string;
    link: string;
    date: string;
    content: string;
    images: string[];
    files?: { name: string; url: string }[];
    matchedFilters?: { id: string; name: string; type: 'include' | 'exclude'; matchedPhrases?: string[] }[];
    sourceBoard?: string;
    isMultiPost?: boolean;
    selectedSources?: { title: string; date: string; link: string }[];
}

export interface PostFilter {
    id: string;
    name: string;
    description: string;
    type: 'include' | 'exclude';
}

export interface AnalysisResult {
    imageAnalysis?: {
        summary: string;
        visualStyle: string;
        imageComposition?: string;
        imageMood?: string;
        imageInterpretation?: string;
        dominantColors: string[];
    };
    consistency?: {
        character: string;
        theme: string;
    };
    summary: string;
    scenes: { text: string; title?: string; subtitle: string; imagePrompt: string }[];
    suggestedStyles?: { name: string; description: string; colors: string[] }[];
    extractedText?: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
        totalCostUSD: number;
        estimatedCostKRW: number;
    };
}

export interface SceneItem {
    text: string; // Used for Narration
    title?: string; // Scene Title
    imagePrompt: string;
    imageUrl: string | null;
    status: 'pending' | 'generating' | 'generated' | 'approved';
    subtitle: string; // Used for Display
    duration: number; // Duration in seconds
    transition: 'none' | 'fade' | 'scale_up' | 'pop_in' | 'blink' | 'slide_left' | 'slide_right' | 'slide_up' | 'slide_down' | 'wipe_left' | 'wipe_right' | 'wipe_up' | 'wipe_down' | 'drop_in' | 'shake' | 'panorama_left' | 'panorama_right' | 'panorama_up' | 'panorama_down'; // Per-scene transition
    audioUrl?: string | null; // Pre-generated audio
    audioDuration?: number; // Audio length in seconds
    isAudioGenerating?: boolean;
    isEnabled: boolean;
    narrationSettings?: {
        voice?: string;      // Override global voice
        speed?: number;      // Override global speed (0.5 - 2.0)
        pitch?: number;      // Pitch shift in semitones (-12 to +12)
        volume?: number;     // Volume multiplier (0.0 - 2.0)
        prompt?: string;     // Custom acting instruction
    };
}

export interface CaptionConfig {
    enabled: boolean;
    mode: 'standard' | 'dynamic';
    dynamicStyle: {
        preset: string; // e.g., 'yellow_punch'
        fontFamily: string;
        fontSize: number;
        opacity?: number;
        intensity?: number;
        colors: {
            activeFill: string;
            baseFill: string;
            stroke: string;
            strokeThickness: number;
        };
        animation: 'none' | 'pop' | 'shake' | 'elastic';
        layout: {
            wordsPerLine: number; // 0 = Auto
            safeZonePadding: boolean;
            verticalPosition: 'top' | 'middle' | 'bottom';
        };
    };
}

export type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'custom';

export interface WatermarkConfig {
    url: string | null;
    position: WatermarkPosition; // preset or 'custom' for drag
    x: number;       // 0.0–1.0  canvas-relative center X (used when position='custom')
    y: number;       // 0.0–1.0  canvas-relative center Y (used when position='custom')
    size: number;    // 0.05–0.5 as fraction of canvas width (default 0.15)
    opacity: number; // 0.0–1.0  (default 0.8)
}

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
    url: null,
    position: 'bottom-right',
    x: 0.85,
    y: 0.85,
    size: 0.15,
    opacity: 0.8,
};

export type ThumbnailPlatformKey = 'youtube' | 'instagram_square' | 'instagram_story' | 'tiktok';

export const THUMBNAIL_PLATFORMS: Record<ThumbnailPlatformKey, { label: string; w: number; h: number }> = {
    youtube: { label: 'YouTube 16:9 FHD', w: 1920, h: 1080 },
    instagram_square: { label: 'Instagram 1:1', w: 1080, h: 1080 },
    instagram_story: { label: 'Instagram/TikTok Story 9:16', w: 1080, h: 1920 },
    tiktok: { label: 'TikTok 9:16', w: 1080, h: 1920 },
};

export type ThumbnailTitleStyle = 'bold_bottom' | 'gradient_top' | 'center_glow' | 'minimal';

export interface ThumbnailConfig {
    sceneIndex: number;           // which sceneItem to use as background
    platform: ThumbnailPlatformKey;
    title: string;                // overlay text
    titleStyle: ThumbnailTitleStyle;
    bgBlur: number;               // 0–20px
    textColor: string;            // default '#FFFFFF'
    strokeColor: string;          // default '#000000'
    overlayDarkness: number;      // 0.0–0.8
}
