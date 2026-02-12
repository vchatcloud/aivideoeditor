import { create } from 'zustand';
import type { CaptionConfig } from '@/types';
import { MediaAsset } from '@/components/WebGPURenderer';

// ============================================================
// Settings Store — Visual, Audio, Platform, and Rendering Configuration
// ============================================================

export interface OverlayConfig {
    lightLeak: { enabled: boolean; intensity: number; colorTheme: string };
    filmGrain: { enabled: boolean; intensity: number; coarseness: number };
    dustParticles: { enabled: boolean; density: number; speed: number };
    vignette: { enabled: boolean; intensity: number; radius: number };
    colorGrading: { enabled: boolean; brightness: number; contrast: number; saturation: number; sepia: number };
    bloom: { enabled: boolean; strength: number; radius: number; threshold: number };
}

interface SettingsState {
    // Visual Style
    visualStyle: string;
    imageComposition: string;
    imageMood: string;
    imageInterpretation: string;
    dominantColors: string[];

    // Voice & Narration
    voiceStyle: string;
    narrationTone: string;
    customVoicePrompt: string;
    narrationEnabled: boolean;
    narrationSpeed: number;
    narrationPitch: number;
    narrationVolume: number;
    narrationLength: 'Short' | 'Medium' | 'Long';

    // Analysis
    analysisMode: 'detail' | 'summary' | 'promo' | 'infographic' | 'album';
    videoPurpose: 'PR' | 'Education' | 'Notice' | 'Event';
    sceneCount: number | 'AUTO';
    customAiPrompt: string;

    // Subtitle / Typography
    subtitleFont: string;
    narrationFont: string;
    subtitleFontSize: number;
    narrationFontSize: number;
    showSubtitles: boolean;
    showNarrationText: boolean;
    subtitleColor: string;
    debouncedSubtitleColor: string;
    narrationColor: string;
    debouncedNarrationColor: string;
    subtitleEffectStyle: 'none' | 'outline' | 'shadow' | 'neon' | 'glitch' | 'hollow' | 'splice' | 'lift' | 'echo';
    subtitleEntranceAnimation: 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'pop';
    subtitleExitAnimation: 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'pop';
    subtitleEffectColor: string;
    subtitleEffectParam: number;
    subtitlePreset: string;
    subtitleOpacity: number;
    subtitleBackgroundColor: string;
    debouncedSubtitleBackgroundColor: string;
    subtitleBackgroundOpacity: number;
    debouncedSubtitleBackgroundOpacity: number;
    subtitleStrokeColor: string;
    subtitleStrokeWidth: number;
    subtitleSyncShift: number;

    // Narration Styling
    narrationBackgroundColor: string;
    debouncedNarrationBackgroundColor: string;
    narrationBackgroundOpacity: number;
    debouncedNarrationBackgroundOpacity: number;
    tickerSpeed: number;

    // Dynamic Captions
    captionConfig: CaptionConfig;

    // Audio / BGM
    audioEnabled: boolean;
    audioFile: File | null;
    audioVolume: number;
    bgmFadeIn: number;
    bgmFadeOut: number;
    bgmDucking: number;

    // Platform / Output
    selectedPlatform: 'youtube' | 'youtube4k' | 'instagram' | 'tiktok' | 'facebook' | 'custom';
    selectedAspectRatio: string;
    customWidth: number;
    customHeight: number;
    imageAspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
    previewQuality: 'high' | 'low';

    // Background
    backgroundColor: string;
    backgroundUrl: string | null;

    // QR Code
    showQrCode: boolean;
    qrUrl: string;
    qrCodeImage: string | null;
    qrCodeSize: number;
    qrCodePosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

    // AI Disclosure & Branding
    aiDisclosureEnabled: boolean;
    watermarkUrl: string | null;

    // VFX Overlays
    overlayConfig: OverlayConfig;

    // Visual / Audio Simulation
    isVisualSimulation: boolean;
    allowImageVariation: boolean;
    isAudioSimulation: boolean;

    // Intro/Outro
    introMedia: MediaAsset | null;
    outroMedia: MediaAsset | null;

    // Actions
    set: (partial: Partial<SettingsState>) => void;
    setCaptionConfig: (config: CaptionConfig) => void;
    updateCaptionDynamicStyle: (partial: Partial<CaptionConfig['dynamicStyle']>) => void;
    updateOverlayConfig: (partial: Partial<OverlayConfig>) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
    // Visual Style
    visualStyle: "Photorealistic",
    imageComposition: "Wide",
    imageMood: "Trustworthy",
    imageInterpretation: "Literal",
    dominantColors: [],

    // Voice & Narration
    voiceStyle: "Female - Calm",
    narrationTone: "News",
    customVoicePrompt: "",
    narrationEnabled: true,
    narrationSpeed: 1.0,
    narrationPitch: 0,
    narrationVolume: 1.0,
    narrationLength: 'Medium',

    // Analysis
    analysisMode: 'detail',
    videoPurpose: 'PR',
    sceneCount: 'AUTO',
    customAiPrompt: "",

    // Subtitle / Typography
    subtitleFont: "Pretendard",
    narrationFont: "Pretendard",
    subtitleFontSize: 50,
    narrationFontSize: 40,
    showSubtitles: true,
    showNarrationText: true,
    subtitleColor: "#ffffff",
    debouncedSubtitleColor: "#ffffff",
    narrationColor: "#e0e0e0",
    debouncedNarrationColor: "#e0e0e0",
    subtitleEffectStyle: 'none',
    subtitleEntranceAnimation: 'none',
    subtitleExitAnimation: 'none',
    subtitleEffectColor: '#000000',
    subtitleEffectParam: 2,
    subtitlePreset: 'custom',
    subtitleOpacity: 1.0,
    subtitleBackgroundColor: "#000000",
    debouncedSubtitleBackgroundColor: "#000000",
    subtitleBackgroundOpacity: 0.0,
    debouncedSubtitleBackgroundOpacity: 0.0,
    subtitleStrokeColor: '#000000',
    subtitleStrokeWidth: 0,
    subtitleSyncShift: 0,

    // Narration Styling
    narrationBackgroundColor: "#000000",
    debouncedNarrationBackgroundColor: "#000000",
    narrationBackgroundOpacity: 0.6,
    debouncedNarrationBackgroundOpacity: 0.6,
    tickerSpeed: 1.0,

    // Dynamic Captions
    captionConfig: {
        enabled: true,
        mode: 'standard',
        dynamicStyle: {
            preset: 'yellow_punch',
            fontFamily: 'Pretendard',
            fontSize: 90,
            opacity: 1.0,
            intensity: 1.0,
            colors: { activeFill: '#FFD700', baseFill: '#FFFFFF', stroke: '#000000', strokeThickness: 8 },
            animation: 'pop',
            layout: { wordsPerLine: 2, safeZonePadding: true, verticalPosition: 'middle' },
        }
    },

    // Audio / BGM
    audioEnabled: false,
    audioFile: null,
    audioVolume: 0.5,
    bgmFadeIn: 2,
    bgmFadeOut: 3,
    bgmDucking: 0.3,

    // Platform / Output
    selectedPlatform: 'youtube',
    selectedAspectRatio: '16:9',
    customWidth: 1280,
    customHeight: 720,
    imageAspectRatio: '16:9',
    previewQuality: 'low',

    // Background
    backgroundColor: "#000000",
    backgroundUrl: null,

    // QR Code
    showQrCode: false,
    qrUrl: "",
    qrCodeImage: null,
    qrCodeSize: 120,
    qrCodePosition: 'top-right',

    // AI Disclosure & Branding
    aiDisclosureEnabled: true,
    watermarkUrl: null,

    // VFX Overlays
    overlayConfig: {
        lightLeak: { enabled: false, intensity: 0.5, colorTheme: 'warm' },
        filmGrain: { enabled: false, intensity: 0.3, coarseness: 2 },
        dustParticles: { enabled: false, density: 0.4, speed: 0.5 },
        vignette: { enabled: false, intensity: 0.6, radius: 0.8 },
        colorGrading: { enabled: false, brightness: 1.0, contrast: 1.0, saturation: 1.0, sepia: 0 },
        bloom: { enabled: false, strength: 0.0, radius: 10, threshold: 0.8 },
    },

    // Visual / Audio Simulation
    isVisualSimulation: false,
    allowImageVariation: false,
    isAudioSimulation: false,

    // Intro/Outro
    introMedia: null,
    outroMedia: null,

    // Actions
    set: (partial) => set(partial),
    setCaptionConfig: (config) => set({ captionConfig: config }),
    updateCaptionDynamicStyle: (partial) => set((state) => ({
        captionConfig: {
            ...state.captionConfig,
            dynamicStyle: { ...state.captionConfig.dynamicStyle, ...partial }
        }
    })),
    updateOverlayConfig: (partial) => set((state) => ({
        overlayConfig: { ...state.overlayConfig, ...partial }
    })),
}));
