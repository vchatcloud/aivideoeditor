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
