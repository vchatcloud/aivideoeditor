
"use client";

import { useEffect, useRef, useState } from 'react';
import { stretchAudio, shiftPitch } from '../utils/audioProcessing';

interface Scene {
    imageUrl: string;
    text: string;
    subtitle: string;
    title?: string;
    duration: number; // seconds
    transition: 'none' | 'fade' | 'scale_up' | 'pop_in' | 'blink' | 'slide_left' | 'slide_right' | 'slide_up' | 'slide_down' | 'wipe_left' | 'wipe_right' | 'wipe_up' | 'wipe_down' | 'drop_in' | 'shake' | 'panorama_left' | 'panorama_right' | 'panorama_up' | 'panorama_down' | 'zoom_blur' | 'glitch' | 'directional_wipe' | 'motion_wipe' | 'luma_fade' | 'slide' | 'zoom'; // slide/zoom are legacy aliases
    audioUrl?: string | null;
    audioDuration?: number; // New: For calculating strict padding
    narrationSettings?: {
        voice?: string;
        speed?: number;
        pitch?: number;
        volume?: number;
        prompt?: string;
    };
}

export interface MediaAsset {
    url: string;
    type: 'video' | 'image';
    duration: number;
    file?: File;
}

export interface CaptionConfig {
    enabled: boolean;
    mode: 'standard' | 'dynamic';
    dynamicStyle: {
        preset: string;
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
        animation: 'none' | 'pop' | 'shake' | 'elastic' | 'mask_reveal' | 'typewriter' | 'karaoke_v2' | 'kinetic_stacking';
        layout: {
            wordsPerLine: number;
            safeZonePadding: boolean;
            verticalPosition?: 'top' | 'middle' | 'bottom';
        };
    };
}

export interface OverlayConfig {
    lightLeak: { enabled: boolean; intensity: number; colorTheme: 'warm' | 'cool' };
    filmGrain: { enabled: boolean; intensity: number; coarseness: number };
    dustParticles: { enabled: boolean; density: number; speed: number };
    vignette: { enabled: boolean; intensity: number; radius: number };
    colorGrading?: {
        enabled: boolean;
        brightness: number; // 1.0 = neutral
        contrast: number;   // 1.0 = neutral
        saturation: number; // 1.0 = neutral
        sepia?: number;     // 0.0 - 1.0
    };
    bloom?: {
        enabled: boolean;
        strength: number;   // 0.0 - 1.0 (Opacity of the bloom layer)
        radius: number;     // Blur radius (px)
        threshold: number;  // 0.0 - 1.0 (Luminance threshold)
    };
}

interface WebGPURendererProps {
    scenes: Scene[];
    audioSrc?: string;
    audioVolume?: number;
    introMedia?: MediaAsset | null;
    outroMedia?: MediaAsset | null;
    introScale?: number;
    outroScale?: number;
    narrationEnabled?: boolean;
    voiceStyle?: string;
    narrationTone?: string;
    narrationSpeed?: number; // New Prop
    narrationPitch?: number; // New Prop
    tickerSpeed?: number; // New Prop for Ticker Speed
    subtitleSpeed?: number; // Legacy, can still be used if needed or ignored
    aiDisclosureEnabled?: boolean;
    watermarkUrl?: string | null;    // legacy — kept for compat
    watermarkConfig?: import('@/types').WatermarkConfig; // new — takes priority
    canvasWidth?: number;
    canvasHeight?: number;
    subtitleFontSize?: number;
    narrationFontSize?: number;
    previewMode?: boolean;
    showSubtitles?: boolean;
    showNarrationText?: boolean;
    subtitleColor?: string;
    narrationColor?: string;
    subtitleFont?: string;
    narrationFont?: string;
    subtitleBackgroundColor?: string;
    subtitleBackgroundOpacity?: number;
    narrationBackgroundColor?: string;
    narrationBackgroundOpacity?: number;
    backgroundColor?: string;
    backgroundUrl?: string | null;
    qrCodeUrl?: string | null;
    qrCodeSize?: number;
    qrCodePosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    subtitleEffectStyle?: 'none' | 'outline' | 'shadow' | 'neon' | 'glitch' | 'hollow' | 'splice' | 'lift' | 'echo';
    subtitleEntranceAnimation?: 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'pop';
    subtitleExitAnimation?: 'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'pop';
    subtitleEffectColor?: string;
    subtitleEffectParam?: number;
    subtitleOpacity?: number;
    subtitleStrokeColor?: string;
    subtitleStrokeWidth?: number;
    subtitleSyncShift?: number; // New Prop for Timing Offset
    overlayConfig?: OverlayConfig; // New Prop for VFX Offset
    overlaySettings?: {
        grain?: boolean;
        grainIntensity?: number;
        vignette?: boolean;
        vignetteIntensity?: number;
        particles?: boolean;
        particleDensity?: number;
        lightLeak?: boolean;
        lightLeakIntensity?: number;
    };
    onComplete: (videoBlob: Blob) => void;
    onLog?: (message: string) => void;
    scaleMode?: 'cover' | 'contain';
    captionConfig?: CaptionConfig;
    seekToTime?: number | null;
    onProgress?: (current: number, total: number) => void;
    overlayMediaUrl?: string | null; // NEW: External Overlay Media
    quality?: 'high' | 'low'; // NEW: Quality Control
    isScrubbing?: boolean; // NEW: Pause during scrubbing
}

// Helper to load a single bitmap
const loadBitmap = async (url: string): Promise<ImageBitmap> => {
    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        return await createImageBitmap(blob);
    } catch (e) {
        console.warn(`Direct load failed for ${url}, trying proxy...`, e);
        // Fallback to proxy
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        const resp = await fetch(proxyUrl);
        if (!resp.ok) throw new Error(`Proxy HTTP ${resp.status}`);
        const blob = await resp.blob();
        return await createImageBitmap(blob);
    }
};

export default function WebGPURenderer({
    scenes,
    audioSrc,
    audioVolume = 0.5,
    introMedia,
    outroMedia,
    narrationEnabled = false,
    voiceStyle = "Female - Calm",
    narrationTone = "News",
    narrationSpeed = 1.0, // Default to 1.0 (No stretch) to respect baked audio
    narrationPitch = 0,   // Default to 0 (No shift) to respect baked audio
    tickerSpeed = 1.0,
    subtitleSpeed = 1.0,

    scaleMode = 'cover',
    captionConfig,
    overlayConfig, // VFX Config
    overlayMediaUrl, // NEW: External Overlay Media
    quality = 'high', // Default to High
    introScale = 100,
    outroScale = 100,
    seekToTime = null,
    onProgress,
    isScrubbing = false,

    aiDisclosureEnabled = false,
    watermarkUrl = null,
    watermarkConfig,
    canvasWidth = 1280,
    canvasHeight = 720,
    subtitleFontSize = 50,
    narrationFontSize = 40,
    previewMode = false,
    showSubtitles = true,
    showNarrationText = true,
    subtitleColor = "#ffffff",
    narrationColor = "#e0e0e0",
    subtitleFont = "Pretendard",
    narrationFont = "Pretendard",
    subtitleBackgroundColor = '#000000',
    subtitleBackgroundOpacity,
    narrationBackgroundColor = '#000000',
    narrationBackgroundOpacity,
    backgroundColor = "#000000",
    backgroundUrl = null,
    qrCodeUrl = null,
    qrCodeSize = 120,
    qrCodePosition = 'top-right',
    subtitleEffectStyle = 'none',
    subtitleEntranceAnimation = 'none',
    subtitleExitAnimation = 'none',
    subtitleEffectColor = '#000000',
    subtitleEffectParam = 2,
    subtitleOpacity = 1.0,
    subtitleStrokeColor = '#000000',
    subtitleStrokeWidth = 0,
    subtitleSyncShift = 0,
    onComplete,
    onLog,
    overlaySettings = {}
}: WebGPURendererProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const vizCanvasRef = useRef<HTMLCanvasElement>(null); // New visualizer canvas
    const [logHistory, setLogHistory] = useState<string[]>(["Initializing..."]);
    const setStatus = (msg: string) => setLogHistory(prev => {
        // Create new log entry and keep last 5
        return [...prev.slice(-4), msg];
    });
    const [error, setError] = useState("");
    const [progress, setProgress] = useState(0);

    // Control States
    const [renderId, setRenderId] = useState(0); // To force restart
    const [isPaused, setIsPaused] = useState(false);

    // Refs for Pause Logic
    const isPausedRef = useRef(false);
    const totalPausedTimeRef = useRef(0);
    const pauseStartTimeRef = useRef(0);
    const wasPlayingRef = useRef(false); // Track play state before scrubbing

    // Refs for Overlays
    const particlesRef = useRef<{ x: number, y: number, vx: number, vy: number, alpha: number, size: number }[]>([]);
    const overlayMediaRef = useRef<{ media: ImageBitmap | HTMLVideoElement, type: 'image' | 'video' } | null>(null); // NEW: Overlay Media Ref

    // Keep track of animation loop to cancel it on unmount or re-run
    const reqIdRef = useRef<number | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null); // Store ref to control suspend/resume
    const seekRequestRef = useRef<number | null>(null); // New Ref for Seek
    const overlaySettingsRef = useRef(overlaySettings);

    // Sync Ref
    const startTimeRef = useRef(0);
    useEffect(() => {
        overlaySettingsRef.current = overlaySettings;
    }, [overlaySettings]);

    // Handle External Seek
    useEffect(() => {
        if (typeof seekToTime === 'number') {
            seekRequestRef.current = seekToTime;
        }
    }, [seekToTime]);

    // Handle Scrubbing Pause
    useEffect(() => {
        const handlePause = async () => {
            if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
                await audioCtxRef.current.suspend();
            }
            pauseStartTimeRef.current = performance.now();
            setIsPaused(true);
            isPausedRef.current = true;
        };

        const handleResume = async () => {
            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                await audioCtxRef.current.resume();
            }
            // Update System Clock Paused Duration
            if (pauseStartTimeRef.current > 0) {
                const diff = performance.now() - pauseStartTimeRef.current;
                totalPausedTimeRef.current += diff;
                pauseStartTimeRef.current = 0;
            }
            setIsPaused(false);
            isPausedRef.current = false;
        };

        if (isScrubbing) {
            // Start Scrubbing: Save state and Force Pause
            wasPlayingRef.current = !isPausedRef.current;
            if (wasPlayingRef.current) {
                handlePause();
            }
        } else {
            // End Scrubbing: Restore state
            if (wasPlayingRef.current) {
                // If it was playing, resume
                // But only if we are currently paused (which we should be if we forced it)
                if (isPausedRef.current) {
                    handleResume();
                }
            }
            // If it was paused, do nothing (stay paused)
        }
    }, [isScrubbing]);

    // NEW: Load Overlay Media
    useEffect(() => {
        if (!overlayMediaUrl) {
            overlayMediaRef.current = null;
            return;
        }

        const loadOverlay = async () => {
            try {
                // Determine type by extension (rough check)
                const isVideo = overlayMediaUrl.match(/\.(mp4|webm|mov)$/i);
                if (isVideo) {
                    const video = document.createElement('video');
                    video.src = overlayMediaUrl;
                    video.crossOrigin = "anonymous";
                    video.loop = true; // Overlays usually loop
                    video.muted = true;
                    video.playsInline = true;
                    await video.play().then(() => video.pause()); // Pre-buffer
                    overlayMediaRef.current = { media: video, type: 'video' };
                } else {
                    const img = new Image();
                    img.src = overlayMediaUrl;
                    img.crossOrigin = "anonymous";
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });
                    const bitmap = await createImageBitmap(img);
                    overlayMediaRef.current = { media: bitmap, type: 'image' };
                }
                if (onLog) onLog(`Loaded Overlay Media: ${overlayMediaUrl.split('/').pop()}`);
            } catch (e) {
                console.error("Failed to load overlay media:", e);
                if (onLog) onLog(`Error loading overlay: ${e}`);
            }
        };
        loadOverlay();
    }, [overlayMediaUrl, onLog]);


    // Control Handlers
    const handleTogglePause = async () => {
        if (isPaused) {
            // RESUME
            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                await audioCtxRef.current.resume();
            }
            // Update System Clock Paused Duration
            if (pauseStartTimeRef.current > 0) {
                const diff = performance.now() - pauseStartTimeRef.current;
                totalPausedTimeRef.current += diff;
                pauseStartTimeRef.current = 0;
            }
            setIsPaused(false);
            isPausedRef.current = false;
        } else {
            // PAUSE
            if (audioCtxRef.current && audioCtxRef.current.state === 'running') {
                await audioCtxRef.current.suspend();
            }
            pauseStartTimeRef.current = performance.now();
            setIsPaused(true);
            isPausedRef.current = true;
        }
    };

    const handleRestart = () => {
        // Reset everything
        setIsPaused(false);
        isPausedRef.current = false;
        totalPausedTimeRef.current = 0;
        pauseStartTimeRef.current = 0;
        setProgress(0);
        setLogHistory(["Restarting..."]);
        setRenderId(prev => prev + 1); // Trigger useEffect re-run
    };

    const handleStop = () => {
        // Stop Loop
        if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
        // Stop Audio
        if (audioCtxRef.current) {
            try { audioCtxRef.current.close(); } catch (e) { }
        }
        // Stop Recorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        // Notify Parent (Maybe pass null or error?)
        // For now, we'll just show a "Stopped" message or close. 
        // If the user wants to "Stop", they effectively cancel the render.
        // We can just define a "Stopped" state visually and let them close the modal.
        setStatus("Rendering Stopped by User.");
        setIsPaused(true); // Freeze UI
        isPausedRef.current = true; // Stop loop advancement
    };

    // Helper types for optimization
    type TextLayout = {
        lines: string[];
        fontSize: number;
        lineHeight: number;
        totalHeight: number;
    };

    // 1. Calculate Layout (Expensive - Run once per scene)
    const calculateTextLayout = (
        ctx: CanvasRenderingContext2D,
        text: string,
        w: number,
        h: number,
        maxFontSize: number,
        padding: number,
        fontFamily: string = "Pretendard"
    ): TextLayout | null => {
        if (!text) return null;

        const safeW = w - (padding * 2);
        const safeH = h - (padding * 2);

        let fontSize = maxFontSize;
        let lines: string[] = [];
        let lineHeight = fontSize * 1.3;

        // Iteratively find fit
        for (; fontSize >= 14; fontSize -= 2) {
            ctx.font = `bold ${fontSize}px '${fontFamily}', sans-serif`;
            lineHeight = fontSize * 1.3;

            const words = text.split(' ');
            let currentLine = words[0];
            lines = [];

            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;
                if (width < safeW) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);

            if ((lines.length * lineHeight) <= safeH) {
                break; // Fits!
            }
        }

        return {
            lines,
            fontSize,
            lineHeight,
            totalHeight: lines.length * lineHeight
        };
    };

    // 2. Draw Cached Layout (Cheap - Run every frame)
    const drawTextLayout = (
        ctx: CanvasRenderingContext2D,
        layout: TextLayout,
        x: number,
        y: number,
        w: number,
        h: number,
        color: string,
        fontFamily: string = "Pretendard",
        effectStyle: 'none' | 'outline' | 'shadow' | 'neon' | 'glitch' | 'hollow' | 'splice' | 'lift' | 'echo' = 'none',
        effectColor: string = '#000000',
        effectParam: number = 2,
        opacity: number = 1.0,
        strokeColor: string = '#000000',
        strokeWidth: number = 0
    ) => {
        if (!layout) return;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${layout.fontSize}px '${fontFamily}', sans-serif`;

        const startY = y + (h - layout.totalHeight) / 2 + (layout.lineHeight / 2);

        layout.lines.forEach((line, idx) => {
            const lineY = startY + (idx * layout.lineHeight) - (layout.lineHeight * 0.1);
            const lineX = x + (w / 2);

            // Save context to restore after effects
            ctx.save();
            ctx.globalAlpha = ctx.globalAlpha * opacity;

            // 1. Explicit Stroke (Priority over effects)
            if (strokeWidth > 0) {
                ctx.lineJoin = 'round';
                ctx.miterLimit = 2;
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = strokeWidth;
                ctx.strokeText(line, lineX, lineY);
            }

            if (effectStyle === 'shadow') {
                ctx.shadowColor = effectColor;
                ctx.shadowBlur = effectParam;
                ctx.shadowOffsetX = effectParam / 3;
                ctx.shadowOffsetY = effectParam / 3;
                ctx.fillStyle = color;
                ctx.fillText(line, lineX, lineY);
            }
            else if (effectStyle === 'lift') {
                // "Lift": Intense blurred shadow directly behind to pop from background
                ctx.shadowColor = effectColor; // Usually black
                ctx.shadowBlur = effectParam * 2;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = effectParam / 2;
                ctx.fillStyle = color;
                ctx.fillText(line, lineX, lineY);
            }
            else if (effectStyle === 'hollow') {
                // "Hollow": Stroke only, transparent fill
                ctx.strokeStyle = color; // Use the main color for the stroke
                ctx.lineWidth = effectParam;
                ctx.lineJoin = 'round';
                ctx.strokeText(line, lineX, lineY);
            }
            else if (effectStyle === 'splice') {
                // "Splice": Offset stroke (like a shadow but hard outline) + Main Text
                ctx.strokeStyle = effectColor;
                ctx.lineWidth = effectParam;
                ctx.lineJoin = 'round';
                // Draw offset stroke
                ctx.strokeText(line, lineX - (effectParam / 2), lineY + (effectParam / 2));

                // Draw main text
                ctx.fillStyle = color;
                ctx.fillText(line, lineX, lineY);
            }
            else if (effectStyle === 'echo') {
                // "Echo": Sequential copies
                ctx.fillStyle = effectColor;
                const originalAlpha = ctx.globalAlpha;
                ctx.globalAlpha = originalAlpha * 0.3;
                ctx.fillText(line, lineX - (effectParam * 2), lineY);
                ctx.globalAlpha = originalAlpha * 0.6;
                ctx.fillText(line, lineX - effectParam, lineY);
                ctx.globalAlpha = originalAlpha;
                ctx.fillStyle = color;
                ctx.fillText(line, lineX, lineY);
            }
            else if (effectStyle === 'outline') {
                if (strokeWidth === 0) {
                    ctx.strokeStyle = effectColor;
                    ctx.lineWidth = effectParam;
                    ctx.lineJoin = 'round';
                    ctx.strokeText(line, lineX, lineY);
                }
                ctx.fillStyle = color;
                ctx.fillText(line, lineX, lineY);
            }
            else if (effectStyle === 'neon') {
                ctx.shadowColor = effectColor;
                ctx.shadowBlur = effectParam * 1.5;
                ctx.strokeStyle = effectColor;
                ctx.lineWidth = 3;
                ctx.strokeText(line, lineX, lineY);
                ctx.fillStyle = "#ffffff";
                ctx.fillText(line, lineX, lineY);
            }
            else if (effectStyle === 'glitch') {
                // Red/Pink Channel - Top Left
                ctx.fillStyle = 'rgba(255, 0, 85, 0.8)';
                ctx.fillText(line, lineX - effectParam, lineY - (effectParam / 2));
                // Cyan/Blue Channel - Bottom Right
                ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
                ctx.fillText(line, lineX + effectParam, lineY + (effectParam / 2));
                // Main Text
                ctx.fillStyle = color;
                ctx.fillText(line, lineX, lineY);
            }
            else {
                ctx.fillStyle = color;
                ctx.fillText(line, lineX, lineY);
            }

            ctx.restore();
        });
    };

    useEffect(() => {
        if (!scenes.length) return;

        let activeSpeechSource: AudioBufferSourceNode | null = null;
        let isMounted = true;
        let audioCtx: AudioContext | null = null;
        // Reset ref for controls
        audioCtxRef.current = null;

        let audioSource: AudioBufferSourceNode | null = null;
        let recorder: MediaRecorder | null = null;
        let lastSceneIndex = -1; // Keep track of the last spoken scene
        let analyser: AnalyserNode | null = null; // Visualizer
        const audioSources: AudioBufferSourceNode[] = []; // Speech sources

        const run = async () => {
            // Ensure no previous speech is playing
            window.speechSynthesis.cancel(); // Keep original line
            // if (activeSpeechSourceEnv) { try { activeSpeechSourceEnv.stop(); } catch (e) { } } // This line was in the provided snippet but not in original, and activeSpeechSourceEnv is not defined. Keeping original.

            // 3. Audio Visualizer Helper
            const drawAudioVisualizer = (ctx: CanvasRenderingContext2D, analyser: AnalyserNode, w: number, h: number) => {
                if (previewMode || !analyser) return; // Only show during encoding

                const bufferLength = analyser.frequencyBinCount;
                const dataArray = new Uint8Array(bufferLength);
                analyser.getByteFrequencyData(dataArray);

                // Draw simpler bars filling the canvas
                const vizW = w;
                const vizH = h;

                // Background (Optional, or rely on container bg)
                // ctx.clearRect(0, 0, w, h); // Already cleared by caller

                // Dim background
                ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
                ctx.fillRect(0, 0, vizW, vizH);

                const barWidth = (vizW / bufferLength) * 2.5;
                let barX = 0;

                for (let i = 0; i < bufferLength; i++) {
                    const value = dataArray[i];
                    const percent = value / 255;
                    const barHeight = percent * vizH;

                    // Green Matrix-like Color
                    const g = 150 + (105 * percent);
                    ctx.fillStyle = `rgba(0, ${g}, 50, 0.9)`;

                    ctx.fillRect(barX, vizH - barHeight, barWidth, barHeight);

                    barX += barWidth + 1;
                    if (barX > vizW) break;
                }
            };
            try {
                if (!canvasRef.current || !isMounted) return;
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (!ctx) throw new Error("Could not get 2D context");

                setStatus("Loading assets...");

                // Helper to load a single bitmap
                const loadBitmap = async (url: string): Promise<ImageBitmap> => {
                    if (!url || url === 'undefined' || url === 'null') {
                        throw new Error(`Invalid URL: ${url}`);
                    }
                    try {
                        const resp = await fetch(url);
                        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                        const blob = await resp.blob();
                        return await createImageBitmap(blob);
                    } catch (e) {
                        console.warn(`Direct load failed for ${url}, trying proxy...`, e);
                        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
                        const resp = await fetch(proxyUrl);
                        if (!resp.ok) throw new Error(`Proxy HTTP ${resp.status}`);
                        const blob = await resp.blob();
                        return await createImageBitmap(blob);
                    }
                };

                // Load images
                const bitmaps = await Promise.all(scenes.map(async (scene) => {
                    try {
                        return await loadBitmap(scene.imageUrl);
                    } catch (err) {
                        console.warn(`Failed: ${scene.text}`, err);
                        // Fallback
                        const fb = document.createElement('canvas');
                        fb.width = 1024; fb.height = 576;
                        const fctx = fb.getContext('2d')!;
                        fctx.fillStyle = '#111'; fctx.fillRect(0, 0, 1024, 576);
                        fctx.fillStyle = '#666'; fctx.font = '30px sans-serif';
                        fctx.fillText("Image Missing", 50, 280);
                        return await createImageBitmap(fb);
                    }
                }));

                // Load Watermark
                let watermarkBitmap: ImageBitmap | null = null;
                // Resolve effective watermark URL from config or legacy prop
                const effectiveWatermarkUrl = watermarkConfig?.url ?? watermarkUrl;
                if (effectiveWatermarkUrl) {
                    try {
                        watermarkBitmap = await loadBitmap(effectiveWatermarkUrl);
                    } catch (e) {
                        console.warn("Failed to load watermark", e);
                    }
                }

                // Load Background Image if present
                let backgroundBitmap: ImageBitmap | null = null;
                if (backgroundUrl) {
                    try {
                        backgroundBitmap = await loadBitmap(backgroundUrl);
                    } catch (e) { console.warn("Background load failed", e); }
                }

                // Load QR Code if present
                let qrBitmap: ImageBitmap | null = null;
                if (qrCodeUrl) {
                    try {
                        qrBitmap = await loadBitmap(qrCodeUrl);
                    } catch (e) { console.warn("QR Code load failed", e); }
                }

                if (!isMounted) return; // Cleanup check after async loads

                // 2. Load Audio if present
                let audioDest: MediaStreamAudioDestinationNode | null = null;
                const speechBuffers: (AudioBuffer | null)[] = new Array(scenes.length).fill(null);

                // SKIP AUDIO SETUP IN PREVIEW MODE
                if (!previewMode) {
                    // --- NEW TTS LOGIC (Pre-generated) ---

                    // Initialize AudioContext if narration is enabled
                    if (narrationEnabled && !audioCtx) {
                        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                        audioCtxRef.current = audioCtx;
                    }

                    if (narrationEnabled && audioCtx) {
                        setStatus("Loading narration...");
                        if (onLog) onLog("Starting narration load...");

                        const loadAudioWithTimeout = async (url: string, idx: number) => {
                            return new Promise<AudioBuffer | null>(async (resolve, reject) => {
                                const timer = setTimeout(() => reject(new Error("Timeout loading audio")), 15000);
                                try {
                                    setStatus(`Loading audio ${idx + 1}/${scenes.length}...`);
                                    const res = await fetch(url);
                                    if (!res.ok) throw new Error(`Fetch error: ${res.status}`);
                                    const arrayBuffer = await res.arrayBuffer();
                                    // decodeAudioData also needs to be safe? usually it's fast.
                                    const buffer = await audioCtx!.decodeAudioData(arrayBuffer);
                                    clearTimeout(timer);
                                    resolve(buffer);
                                } catch (e) {
                                    clearTimeout(timer);
                                    reject(e);
                                }
                            });
                        };

                        await Promise.all(scenes.map(async (scene, idx) => {
                            if (!scene.audioUrl) return;
                            try {
                                const buffer = await loadAudioWithTimeout(scene.audioUrl, idx);
                                if (buffer) {
                                    // Apply Pitch & Speed
                                    const settings = scene.narrationSettings || {};
                                    const finalSpeed = settings.speed !== undefined ? settings.speed : narrationSpeed;
                                    const finalPitch = settings.pitch !== undefined ? settings.pitch : narrationPitch;

                                    let processed = buffer;

                                    // 1. Pitch Shift (if needed)
                                    if (finalPitch !== 0) {
                                        if (onLog) onLog(`Pitch-shifting scene ${idx + 1} audio (${finalPitch}st)...`);
                                        processed = await shiftPitch(audioCtx!, processed, finalPitch);
                                    }

                                    // 2. Time Stretch (if needed)
                                    if (Math.abs(finalSpeed - 1.0) > 0.05) {
                                        if (onLog) onLog(`Time-stretching scene ${idx + 1} audio (${finalSpeed}x)...`);
                                        processed = await stretchAudio(audioCtx!, processed, finalSpeed);
                                    }

                                    speechBuffers[idx] = processed;
                                }
                            } catch (e) {
                                console.warn(`Failed to load audio for scene ${idx}:`, e);
                                if (onLog) onLog(`Failed to load audio for scene ${idx}: ${e}`);
                            }
                        }));
                        if (onLog) onLog("Narration Audio Loaded & Processed.");
                    }
                    // --- END TTS LOGIC ---
                }

                if (!isMounted) return; // Cleanup check after async audio loads

                // --- AUDIO GRAPH SETUP (Restored) ---
                if (audioSrc || speechBuffers.some(b => b !== null)) {
                    try {
                        if (onLog) onLog("Initializing Audio Graph...");
                        // Ensure Context exists
                        if (!audioCtx) {
                            audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                            audioCtxRef.current = audioCtx;
                        }

                        if (audioCtx.state === 'suspended') {
                            await audioCtx.resume();
                            if (onLog) onLog("Audio Context Resumed.");
                        }

                        // Create Mix Node
                        const gainNode = audioCtx.createGain();
                        gainNode.gain.value = audioVolume;

                        // Create Analyser
                        analyser = audioCtx.createAnalyser();
                        analyser.fftSize = 256;
                        gainNode.connect(analyser);

                        // Create Stream Destination (For Recorder)
                        audioDest = audioCtx.createMediaStreamDestination();
                        analyser.connect(audioDest);

                        // Load BGM
                        if (audioSrc) {
                            if (onLog) onLog("Loading Background Music...");
                            const audioRes = await fetch(audioSrc);
                            const audioArrayBuffer = await audioRes.arrayBuffer();
                            const audioBuffer = await audioCtx.decodeAudioData(audioArrayBuffer);

                            audioSource = audioCtx.createBufferSource();
                            audioSource.buffer = audioBuffer;
                            audioSource.loop = true;
                            audioSource.connect(gainNode);
                            if (onLog) onLog("BGM Loaded.");
                        }
                    } catch (e) {
                        console.error("Failed to load audio graph", e);
                        if (onLog) onLog(`Error loading audio graph: ${e}`);
                    }
                }
                // --- END AUDIO GRAPH SETUP ---

                // Load Intro/Outro Assets
                let introElement: HTMLImageElement | HTMLVideoElement | null = null;
                let outroElement: HTMLImageElement | HTMLVideoElement | null = null;

                const loadMediaElement = async (m: MediaAsset) => {
                    if (m.type === 'image') {
                        const img = new Image();
                        img.src = m.url;
                        await new Promise(r => img.onload = r);
                        return img;
                    } else {
                        const v = document.createElement('video');
                        v.src = m.url;
                        v.crossOrigin = "anonymous";
                        v.muted = true;
                        v.preload = "auto";
                        await new Promise((resolve) => {
                            v.onloadeddata = () => resolve(true);
                            v.onerror = () => resolve(false);
                            setTimeout(() => resolve(true), 5000);
                        });
                        return v;
                    }
                };

                if (introMedia) {
                    setStatus("Loading Intro...");
                    // @ts-ignore
                    introElement = await loadMediaElement(introMedia);
                }
                if (outroMedia) {
                    setStatus("Loading Outro...");
                    // @ts-ignore
                    outroElement = await loadMediaElement(outroMedia);
                }

                if (!isMounted) return;

                // 3. Prepare Canvas & Recorder
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;

                // Calculate timeline
                const canvasW = canvasWidth;
                const canvasH = canvasHeight;
                const canvasAspect = canvasW / canvasH;

                let activeAudioTime = 0;
                const timeline = scenes.map((scene, idx) => {
                    // Enforce minimum padding: 1s Pre + Audio + 2s Post = 3s overhead
                    const audioDur = scene.audioDuration || 0;
                    const minDur = audioDur > 0 ? audioDur + 3.0 : 4;

                    let duration = Math.max(scene.duration, minDur);

                    // Apply Subtitle Speed scaling to Duration (Slower speed = Longer duration)
                    // We only extend duration for slow speed (< 1.0). 
                    // For faster speed (> 1.0), we are limited by audio/minDur anyway.
                    // Apply Narration Speed to Duration (Faster speed = Shorter duration)
                    if (narrationSpeed && narrationSpeed !== 1.0) {
                        duration = duration / narrationSpeed;
                    }
                    // Legacy Subtitle Speed logic (optional, maybe deprecate or keep for text-only duration scaling?)
                    else if (subtitleSpeed && subtitleSpeed < 1.0) {
                        duration = duration / subtitleSpeed;
                    }

                    // Audio Timing (Strictly Sequential)
                    const audioStart = activeAudioTime;
                    activeAudioTime += duration;

                    // Transition Visual Logic
                    const isCut = scene.transition === 'none';
                    const overlap = (idx === 0 || isCut) ? 0 : 1.0;

                    // Visual Timing
                    // If overlapping, start earlier.
                    // If first scene, start at 0.
                    const visualStart = Math.max(0, audioStart - overlap);

                    // Visual End:
                    // It should stay visible until the audio ends.
                    // (The next scene will start drawing on top of this one during the overlap anyway).
                    const visualEnd = audioStart + duration;

                    // Audio should start 1.0s AFTER Visual Start (User Request)
                    const triggerTime = visualStart + 1.0;

                    // --- PRE-CALCULATE TEXT LAYOUT (Optimization) ---
                    // Determine layout area matches the drawing logic
                    const imgW = bitmaps[idx].width;
                    const imgH = bitmaps[idx].height;
                    const imgAspect = imgW / imgH;

                    let targetW, targetH;
                    if (imgAspect > canvasAspect) {
                        targetW = canvasW;
                        targetH = canvasW / imgAspect;
                    } else {
                        targetH = canvasH;
                        targetW = canvasH * imgAspect;
                    }
                    const baseY = (canvasH - targetH) / 2; // This is the renderY before transitions

                    const isSplitLayout = (canvasAspect < 1) && (imgAspect > 1);

                    let subLayout: TextLayout | null = null;
                    let narrationLayout: TextLayout | null = null;

                    if (showSubtitles && scene.subtitle) {
                        let subW = canvasW;
                        let subH = 0;
                        if (isSplitLayout) {
                            subH = baseY; // Height of top bar
                            if (subH < 50) subH = 100; // Fallback if bar is too small
                        } else {
                            subH = 100 + (subtitleFontSize - 50); // Overlay Mode
                        }
                        if (subH > 20) { // Only calculate if there's meaningful space
                            subLayout = calculateTextLayout(ctx, scene.subtitle, subW, subH, subtitleFontSize, 20, subtitleFont);
                        }
                    }

                    if (showNarrationText && scene.text) {
                        if (isSplitLayout) {
                            const bottomBarY = baseY + targetH;
                            const bottomBarH = canvasH - bottomBarY;
                            if (bottomBarH > 50) {
                                narrationLayout = calculateTextLayout(ctx, scene.text, canvasW, bottomBarH, narrationFontSize, 20, narrationFont);
                            }
                        } else {
                            // For overlay mode (ticker), the text is not "fitted" in the same way.
                            // It's either a single line or scrolls. If we want to use layout for centering
                            // or single-line wrapping, we could calculate it for a fixed height.
                            // For now, we'll skip pre-calculating for the ticker mode as it has custom rendering.
                        }
                    }
                    // --- END PRE-CALCULATE TEXT LAYOUT ---

                    return {
                        start: visualStart,
                        end: visualEnd,
                        logStart: audioStart, // Sequential start time for logs
                        triggerTime: Math.max(0, triggerTime),
                        duration,
                        bitmap: bitmaps[idx],
                        subtitle: scene.subtitle,
                        transition: scene.transition,
                        text: (scene as any).text,
                        title: scene.title,
                        subLayout,      // <--- NEW
                        narrationLayout // <--- NEW
                    };
                });

                // Final total time matches the total audio duration
                // (Visuals might end exactly at total audio time)
                // Final total time matches the total audio duration + intro/outro
                const introDur = introMedia?.duration || 0;
                const outroDur = outroMedia?.duration || 0;
                const totalAnimationTime = introDur + activeAudioTime + outroDur;

                console.log("[WebGPURenderer] Timeline with Intro/Outro:", timeline);
                console.log("[WebGPURenderer] Total Duration:", totalAnimationTime);
                if (onLog) onLog(`Total Duration: ${totalAnimationTime.toFixed(2)}s (Intro: ${introDur}s, Outro: ${outroDur}s)`);
                console.log("[WebGPURenderer] Input Scenes:", scenes.length);

                if (!previewMode) {
                    const canvasStream = canvas.captureStream(30); // 30 FPS

                    // Combine Tracks
                    let finalStream = canvasStream;
                    if (audioDest) {
                        const audioTracks = audioDest.stream.getAudioTracks();
                        finalStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
                    }

                    recorder = new MediaRecorder(finalStream, {
                        mimeType: 'video/webm; codecs=vp9'
                    });
                    mediaRecorderRef.current = recorder; // Update ref

                    const chunks: Blob[] = [];
                    recorder.ondataavailable = (e) => {
                        if (e.data.size > 0) chunks.push(e.data);
                    };

                    recorder.onstop = () => {
                        const blob = new Blob(chunks, { type: 'video/webm' });
                        if (isMounted && onComplete) onComplete(blob);
                        if (audioCtx && audioCtx.state !== 'closed') {
                            audioCtx.close().catch(e => console.log("Audio close error", e));
                        }
                    };

                    recorder.start();
                    if (audioSource) audioSource.start(0); // Start BGM (Immediately? Or after Intro?)
                    // If BGM should play DURING intro, start(0) is fine. 
                    // If BGM is background for everything, 0 is fine.
                }

                // 4. Animation Loop
                const useAudioClock = !previewMode && audioCtx && audioCtx.state === 'running';
                let startTimeSystem = performance.now();
                const startTimeAudio = audioCtx ? audioCtx.currentTime : 0;

                if (onLog) onLog(`Starting Animation Loop. Clock Mode: ${useAudioClock ? "AUDIO (Strict Sync)" : "SYSTEM (Loose Sync)"}`);

                // Schedule Audio Triggers (Strictly aligned to Audio Context)
                if (useAudioClock) {
                    scenes.forEach((scene, idx) => {
                        // Speech
                        const speechSource = speechBuffers[idx];
                        if (scene.audioUrl && speechSource && audioCtx) {
                            const source = audioCtx.createBufferSource();
                            source.buffer = speechSource;
                            if (analyser) source.connect(analyser);
                            else if (audioDest) source.connect(audioDest);
                            else source.connect(audioCtx.destination);

                            // Apply Playback Speed
                            // if (narrationSpeed) {
                            //    source.playbackRate.value = narrationSpeed;
                            // }
                            // NOTE: We now pre-process the buffer with stretchAudio, so we play at 1.0 rate 
                            // to preserve the PITCH-CORRECTED result.
                            source.playbackRate.value = 1.0;

                            // Shift by start time AND intro duration
                            const triggerTime = startTimeAudio + introDur + timeline[idx].triggerTime;
                            source.start(triggerTime);
                        }
                    });
                }

                let lastLogTime = 0;
                let lastProgressTime = 0; // Throttle progress updates
                let lastReportedProgress = 0;

                let previouslyActiveIndices: number[] = [];
                let previouslyLogActiveIndices: number[] = []; // Separate tracker for logs

                // Loop
                let frameCount = 0; // DEBUG
                const drawFrame = () => {
                    frameCount++;
                    if (!isMounted) return;
                    const canvasW = canvas.width;
                    const canvasH = canvas.height;

                    // DEBUG LOGGING (First frame only to avoid spam)
                    if (frameCount === 1) {
                        console.log("[WebGPU] DrawFrame Started. Scenes:", scenes.length, "Bitmaps:", bitmaps.length);
                        console.log("[WebGPU] Timeline:", timeline);
                    }
                    // log every 120 frames (approx 2 sec)
                    if (frameCount % 120 === 0) {
                        console.log("[WebGPU] DrawFrame Running. Elapsed:", (performance.now() - startTimeSystem - totalPausedTimeRef.current) / 1000);
                    }

                    // CHECK FOR SEEK REQUEST
                    if (seekRequestRef.current !== null) {
                        const seekT = seekRequestRef.current;
                        const now = performance.now();
                        startTimeSystem = now - (seekT * 1000);
                        totalPausedTimeRef.current = 0;
                        if (isPausedRef.current) {
                            pauseStartTimeRef.current = now;
                        }
                        seekRequestRef.current = null;
                    } else if (isPausedRef.current) {
                        reqIdRef.current = requestAnimationFrame(drawFrame);
                        return;
                    }

                    try {
                        // Reset Transform to prevent bleed from previous frame errors
                        ctx.setTransform(1, 0, 0, 1, 0, 0);

                        if (backgroundBitmap) {
                            drawImageCover(ctx, backgroundBitmap, canvas.width, canvas.height);
                        } else {
                            ctx.fillStyle = backgroundColor;
                            ctx.fillRect(0, 0, canvas.width, canvas.height);
                        }

                        let elapsed = 0;
                        if (useAudioClock && audioCtx) {
                            elapsed = audioCtx.currentTime - startTimeAudio;
                        } else {
                            const now = isPausedRef.current ? pauseStartTimeRef.current : performance.now();
                            elapsed = (now - startTimeSystem - totalPausedTimeRef.current) / 1000;
                        }


                        // LOOP LOGIC: Wrap time for Preview Mode
                        if (previewMode && totalAnimationTime > 0) {
                            elapsed = elapsed % totalAnimationTime;
                        }

                        // Report Progress (Throttled ~30fps or 30ms to prevent React overload, but smooth enough for slider)
                        // Actually 100ms (10fps) is safer for React State
                        if (onProgress && Math.abs(elapsed - lastProgressTime) > 0.05) {
                            lastProgressTime = elapsed;
                            onProgress(elapsed, totalAnimationTime);
                        }

                        // Throttle logs
                        if (elapsed - lastLogTime > 1.0) {
                            lastLogTime = elapsed;
                            const p = ((elapsed / totalAnimationTime) * 100).toFixed(0);
                            console.log(`[Render] Elapsed: ${elapsed.toFixed(2)}, Progress: ${p}%`);
                            if (parseInt(p) > 0 && parseInt(p) % 10 === 0) {
                                setStatus(`Rendering: ${p}%`);
                            }
                        }

                        // Preview Mode: Loop
                        if (previewMode) {
                            // Already handled loopElapsed above for display
                        } else {
                            // Update Progress
                            setProgress(Math.min(100, (elapsed / totalAnimationTime) * 100));

                            if (elapsed >= totalAnimationTime) {
                                if (onLog) onLog("Animation Completed. Stopping Recorder.");
                                recorder?.stop();
                                try { audioSource?.stop(); } catch (e) { } // Stop BGM
                                return;
                            }
                        }

                        // 1. PHASE CHECK
                        let activePhase = 'scene';
                        let localElapsed = elapsed;

                        if (introDur > 0 && elapsed < introDur) {
                            activePhase = 'intro';
                            localElapsed = elapsed;
                        } else if (outroDur > 0 && elapsed > (introDur + activeAudioTime)) {
                            activePhase = 'outro';
                            localElapsed = elapsed - (introDur + activeAudioTime);
                        } else {
                            activePhase = 'scene';
                            localElapsed = Math.max(0, elapsed - introDur);
                        }


                        if (activePhase === 'intro') {
                            const scale = (introScale ?? 100) / 100; // Convert 0-100 to 0.0-1.0
                            if (introElement instanceof HTMLVideoElement) {
                                introElement.currentTime = localElapsed;
                                drawImageContain(ctx, introElement, canvas.width, canvas.height);
                            } else if (introElement) {
                                drawImageContain(ctx, introElement, canvas.width, canvas.height);
                            }
                        } else if (activePhase === 'outro') {
                            const scale = (outroScale ?? 100) / 100;
                            if (outroElement instanceof HTMLVideoElement) {
                                outroElement.currentTime = localElapsed;
                                drawImageContain(ctx, outroElement, canvas.width, canvas.height);
                            } else if (outroElement) {
                                drawImageContain(ctx, outroElement, canvas.width, canvas.height);
                            }
                        } else {
                            // SCENE DRAWING
                            const activeScenes = timeline.filter(t => localElapsed >= t.start && localElapsed <= t.end);

                            // Log new scenes (Start/End) - STRICTLY SEQUENTIAL LOGIC
                            if (!previewMode) {
                                // Calculate "Log Active" based on sequential logStart
                                const logActiveScenes = timeline.filter(t => localElapsed >= t.logStart && localElapsed <= t.end);
                                const currentLogIndices = logActiveScenes.map(s => timeline.indexOf(s));

                                // 1. Check for Ends FIRST (so "End 1" happens before "Start 2")
                                previouslyLogActiveIndices.forEach(idx => {
                                    if (!currentLogIndices.includes(idx)) {
                                        const title = timeline[idx].title || "Untitled";
                                        const msg = `${idx + 1}th (${title}) Scene End`;
                                        if (onLog) onLog(msg);
                                        setStatus(msg);
                                    }
                                });

                                // 2. Check for Starts SECOND
                                currentLogIndices.forEach(idx => {
                                    if (!previouslyLogActiveIndices.includes(idx)) {
                                        const title = timeline[idx].title || "Untitled";
                                        const msg = `${idx + 1}th (${title}) Scene Start`;
                                        if (onLog) onLog(msg);
                                        setStatus(msg);
                                    }
                                });

                                previouslyLogActiveIndices = currentLogIndices;
                            }

                            // Draw Scenes (Painter's Algorithm - Latest on top)
                            // We sort by start time to ensure earlier scenes are drawn first (background)
                            // But usually activeScenes is just 1 or 2 overlapper.
                            activeScenes.sort((a, b) => a.start - b.start).forEach((scene, i) => {
                                // i=0: Bottom layer (outgoing)
                                // i=1: Top layer (incoming)

                                // 1. Calculate Base Fit (Letterbox/Center)
                                // 1. Calculate Base Fit (Cover / Fill Screen)
                                if (!scene.bitmap) return; // Prevent crash if bitmap is missing
                                const imgW = scene.bitmap.width;
                                const imgH = scene.bitmap.height;
                                const canvasW = canvas.width;
                                const canvasH = canvas.height;
                                const imgAspect = imgW / imgH;
                                const canvasAspect = canvasW / canvasH;

                                // Scale Logic based on scaleMode prop
                                let scale: number;
                                if (scaleMode === 'contain') {
                                    scale = Math.min(canvasW / imgW, canvasH / imgH);
                                } else {
                                    // Default to COVER
                                    scale = Math.max(canvasW / imgW, canvasH / imgH);
                                }

                                const targetW = imgW * scale;
                                const targetH = imgH * scale;

                                // Centered Position
                                let baseX = (canvasW - targetW) / 2;
                                let baseY = (canvasH - targetH) / 2;

                                // 2. Apply Transitions
                                let renderX = baseX;
                                let renderY = baseY;
                                let renderW = targetW;
                                let renderH = targetH;
                                let alpha = 1.0;

                                // Determine if this is an incoming transition
                                const isFirstScene = scene === timeline[0];
                                const isIncoming = i > 0 || isFirstScene; // "Incoming" means it's the layer appearing on top
                                const timeIn = localElapsed - scene.start;
                                const transDur = 1.0;
                                const totalDur = scene.end - scene.start;
                                let shouldRestore = false;

                                // Progress variables
                                const pTrans = Math.min(1, Math.max(0, timeIn / transDur));
                                const pFull = Math.min(1, Math.max(0, timeIn / totalDur));
                                const ease = 1 - Math.pow(1 - pTrans, 3); // Cubic ease out for transitions

                                const effect = scene.transition;

                                // Logic:
                                // 1. Entry Transitions (Fade, Wipe, Slide, Pop, ZoomIn) - Run for 'transDur' then freeze at settled state
                                // 2. Continuous Effects (Panorama, Shake) - Run for 'totalDur'

                                const isEntryEffect = !effect.startsWith('panorama') && effect !== 'shake' && effect !== 'none';
                                const isContinuous = effect.startsWith('panorama') || effect === 'shake';

                                // APPLY ENTRY TRANSITIONS
                                if (isEntryEffect && (isIncoming || isFirstScene) && timeIn < transDur) {
                                    if (effect === 'fade') {
                                        alpha = ease;
                                    }
                                    else if (effect === 'scale_up' || effect === 'zoom') {
                                        const scale = 0.5 + (0.5 * ease);
                                        alpha = ease;
                                        renderW = targetW * scale;
                                        renderH = targetH * scale;
                                        renderX = baseX + (targetW - renderW) / 2;
                                        renderY = baseY + (targetH - renderH) / 2;
                                    }
                                    else if (effect === 'pop_in') {
                                        let scale = 1;
                                        if (pTrans < 0.7) {
                                            scale = (pTrans / 0.7) * 1.1;
                                        } else {
                                            scale = 1.1 - ((pTrans - 0.7) / 0.3) * 0.1;
                                        }
                                        renderW = targetW * scale;
                                        renderH = targetH * scale;
                                        renderX = baseX + (targetW - renderW) / 2;
                                        renderY = baseY + (targetH - renderH) / 2;
                                        alpha = Math.min(1, ease * 2);
                                    }
                                    else if (effect === 'blink') {
                                        const cycles = 3;
                                        const val = Math.sin(pTrans * Math.PI * cycles);
                                        alpha = Math.abs(val);
                                    }
                                    else if (effect === 'slide_left' || effect === 'slide') {
                                        const offset = canvasW * (1 - ease);
                                        renderX = baseX + offset;
                                    }
                                    else if (effect === 'slide_right') {
                                        const offset = -canvasW * (1 - ease);
                                        renderX = baseX + offset;
                                    }
                                    else if (effect === 'slide_up') {
                                        const offset = canvasH * (1 - ease);
                                        renderY = baseY + offset;
                                    }
                                    else if (effect === 'slide_down') {
                                        const offset = -canvasH * (1 - ease);
                                        renderY = baseY + offset;
                                    }
                                    else if (effect === 'wipe_left') {
                                        renderX = baseX;
                                        alpha = 1.0;
                                        ctx.save();
                                        shouldRestore = true;
                                        ctx.beginPath();
                                        ctx.rect(baseX + targetW * (1 - ease), baseY, targetW * ease, targetH);
                                        ctx.clip();
                                    }
                                    else if (effect === 'wipe_right') {
                                        renderX = baseX;
                                        alpha = 1.0;
                                        ctx.save();
                                        shouldRestore = true;
                                        ctx.beginPath();
                                        ctx.rect(baseX, baseY, targetW * ease, targetH);
                                        ctx.clip();
                                    }
                                    else if (effect === 'drop_in') {
                                        const p = ease;
                                        let yOff = -canvasH * (1 - p);
                                        if (pTrans > 0.6) {
                                            const bounceP = (pTrans - 0.6) / 0.4;
                                            yOff = -50 * Math.sin(bounceP * Math.PI);
                                            if (pTrans > 0.9) yOff = 0;
                                        }
                                        renderY = baseY + yOff;
                                    }
                                    else if (effect === 'wipe_up' || effect === 'wipe_down') {
                                        alpha = ease; // Fallback
                                    }

                                    // --- CINEMATIC TRANSITIONS ---
                                    // --- CINEMATIC TRANSITIONS ---
                                    else if (effect === 'zoom_blur') {
                                        // "Zoom Blur": Multi-pass scaling with 'lighter' blend for light streaks
                                        const p = ease;
                                        // Main Image (Fading Out inverted for incoming? No, Incoming SCENE fades IN)
                                        // logic: This block runs for INCOMING scenes or Transition effects.
                                        // Usually 'ease' goes 0->1.
                                        // For Zoom Blur In: Start big and transparent, end normal opaque?
                                        // Or Start normal, zoom in?
                                        // Assuming "Zoom Blur Transition" = Incoming image zooms IN from center.

                                        const iterations = 8;
                                        const maxScale = 1.3;

                                        ctx.save();
                                        shouldRestore = true;
                                        ctx.globalCompositeOperation = 'screen'; // Lighter blend

                                        for (let i = 0; i < iterations; i++) {
                                            const subP = i / (iterations - 1); // 0 to 1
                                            // Scale: From maxScale down to 1 (if ease=1)
                                            // Actuall logic: Current Scale depends on 'ease'.
                                            // Let's make it zoom OUT from close up: scale 1.5 -> 1.0
                                            const currentProgScale = 1.5 - (0.5 * ease);
                                            // Blur trail: slightly largfer copies
                                            const scale = currentProgScale + (0.1 * subP * (1 - ease));

                                            const opacity = (1 / iterations) * ease * (1 - subP * 0.5);

                                            ctx.globalAlpha = opacity;

                                            const sW = targetW * scale;
                                            const sH = targetH * scale;
                                            const sX = baseX + (targetW - sW) / 2;
                                            const sY = baseY + (targetH - sH) / 2;

                                            ctx.drawImage(scene.bitmap, sX, sY, sW, sH);
                                        }
                                        alpha = 0; // Handled drawing
                                        ctx.restore();
                                        shouldRestore = false;
                                    }
                                    else if (effect === 'motion_wipe') {
                                        // "Motion Blur Wipe": Incoming Slides in from Right with trails
                                        const p = ease; // 0 -> 1
                                        const iterations = 10;
                                        const trailLag = 50; // pixels

                                        const mainOffset = canvasW * (1 - p); // Starts at canvasW, ends at 0

                                        ctx.save();
                                        shouldRestore = true;

                                        // Draw Trails
                                        for (let i = iterations; i >= 0; i--) {
                                            const lag = i * (trailLag * (1 - p)); // Trails tighten as it settles
                                            const currentX = baseX + mainOffset + lag;

                                            // Alpha fade for trails
                                            const trailAlpha = 1 - (i / iterations);

                                            // Skip if offscreen
                                            if (currentX >= canvasW) continue;

                                            ctx.globalAlpha = (i === 0) ? 1.0 : (trailAlpha * 0.3);
                                            ctx.drawImage(scene.bitmap, currentX, baseY, targetW, targetH);
                                        }
                                        alpha = 0; // Handled
                                        ctx.restore();
                                        shouldRestore = false;
                                    }
                                    else if (effect === 'luma_fade') {
                                        // "Pixel Dissolve" (Simulating Luma/Tech fade)
                                        // Divide into blocks and randomly appear based on Ease
                                        const p = ease;
                                        const cols = 20;
                                        const rows = 12;
                                        const cellW = Math.ceil(canvasW / cols);
                                        const cellH = Math.ceil(canvasH / rows);

                                        ctx.save();
                                        shouldRestore = true;

                                        // We draw the image clipped to active cells
                                        ctx.beginPath();

                                        for (let r = 0; r < rows; r++) {
                                            for (let c = 0; c < cols; c++) {
                                                // Deterministic Random: Hash r,c
                                                const noise = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
                                                const randomVal = noise - Math.floor(noise); // 0 to 1

                                                // If ease > randomVal, show this block
                                                // Add edge softness: p * 1.5 to ensure all finished
                                                if ((p * 1.5) > randomVal || p === 1) {
                                                    ctx.rect(c * cellW, r * cellH, cellW, cellH);
                                                }
                                            }
                                        }
                                        ctx.clip();
                                        alpha = 1.0;
                                        // Main draw code below will execute with this clip
                                    }
                                    else if (effect === 'glitch') {
                                        // "Glitch": RGB Split + Slice Jitter
                                        const p = ease;
                                        const intensity = 1 - p; // High glitch at start, settles to 0

                                        if (intensity > 0.01) {
                                            ctx.save();
                                            shouldRestore = true;

                                            const shakeX = (Math.random() - 0.5) * 50 * intensity;
                                            const shakeY = (Math.random() - 0.5) * 10 * intensity;

                                            // 1. RGB Split (Simulated with Color Blending)
                                            // Draw Red
                                            ctx.globalCompositeOperation = 'screen';
                                            ctx.fillStyle = '#ff0000';
                                            ctx.globalAlpha = 0.8;
                                            // Note: 'screen' with colored rect requires distinct drawing or 'multiply' approach.
                                            // Easier 2D Glitch: Draw Image 3 times with different offsets

                                            // Channel 1 (Red-ish) - Left Offset
                                            ctx.globalAlpha = 0.7 * p; // Fade in
                                            ctx.drawImage(scene.bitmap, baseX + shakeX - (10 * intensity), baseY + shakeY, targetW, targetH);

                                            // Channel 2 (Blue-ish) - Right Offset
                                            ctx.globalCompositeOperation = 'screen';
                                            ctx.drawImage(scene.bitmap, baseX + shakeX + (10 * intensity), baseY + shakeY, targetW, targetH);

                                            // 2. Slice Jitter
                                            // Draw random strips displaced
                                            const sliceCount = 5;
                                            for (let i = 0; i < sliceCount; i++) {
                                                if (Math.random() < intensity) {
                                                    const sliceY = Math.random() * targetH;
                                                    const sliceH = Math.random() * (targetH / 5);
                                                    const sliceOffset = (Math.random() - 0.5) * 100 * intensity;

                                                    ctx.save();
                                                    ctx.beginPath();
                                                    ctx.rect(baseX, baseY + sliceY, targetW, sliceH);
                                                    ctx.clip();
                                                    // Draw displaced slice
                                                    ctx.drawImage(scene.bitmap, baseX + sliceOffset, baseY, targetW, targetH);
                                                    ctx.restore();
                                                }
                                            }

                                            alpha = 0; // Handled
                                            ctx.restore();
                                            shouldRestore = false;
                                        } else {
                                            alpha = ease;
                                        }
                                    }
                                    else if (effect === 'directional_wipe') {
                                        // "Directional Blur Wipe": Wipe with motion trails
                                        renderX = baseX;
                                        const p = ease;
                                        const wipeX = baseX + targetW * (1 - p); // Left motion

                                        ctx.save();
                                        shouldRestore = true;

                                        // Draw "Trails" behind the wipe line
                                        const trails = 10;
                                        ctx.globalAlpha = 0.3;
                                        for (let i = 1; i <= trails; i++) {
                                            const trailOff = i * (targetW * 0.05 * p); // Trail stretches as speed increases? Or constant?
                                            // Actually trail should be BEHIND the movement.
                                            // If moving Left (<--), trails are to the Right.
                                            // Wipe rect is from wipeX to RightEdge.
                                            // We clip the main image?

                                            // Simplified: Slide Left with Blur
                                            // Just doing standard Slide Left for now but adding blur loop

                                            // We want "Wipe" logic:
                                            // Clip rect 
                                            ctx.beginPath();
                                            ctx.rect(baseX, baseY, targetW * p, targetH);
                                            ctx.clip();
                                            // Draw blurred copies ? 
                                        }

                                        // Revert to Standard Wipe but add a "Glow" line at the edge
                                        ctx.beginPath();
                                        ctx.rect(baseX, baseY, targetW * p, targetH);
                                        ctx.clip();

                                        // Draw Edge Glow
                                        ctx.fillStyle = 'rgba(255,255,255,0.5)';
                                        ctx.fillRect(baseX + targetW * p - 20, baseY, 40, targetH);

                                        alpha = 1.0;
                                        // ctx restore handled by main block
                                    }
                                }

                                // APPLY CONTINUOUS EFFECTS (Always runs if active)
                                if (isContinuous) {
                                    // Ensure we fade in if it's an incoming layer (standard cross-dissolve)
                                    if (isIncoming && timeIn < transDur) {
                                        alpha = ease;
                                    }

                                    if (effect === 'shake') {
                                        const intensity = 10; // Constant low shake
                                        renderX = baseX + (Math.random() - 0.5) * intensity;
                                        renderY = baseY + (Math.random() - 0.5) * intensity;
                                    }
                                    else if (effect.startsWith('panorama')) {
                                        // Continuous Ken Burns
                                        // Scale: Start at 1.15, End at 1.0 (Zoom Out) or vice versa
                                        // Panning: Move heavily in opposite direction of bias

                                        const zoomOut = effect.includes('down') || effect.includes('right'); // Variety
                                        const startScale = zoomOut ? 1.15 : 1.0;
                                        const endScale = zoomOut ? 1.0 : 1.15;
                                        const currentScale = startScale + (endScale - startScale) * pFull;

                                        let xFactor = 0;
                                        let yFactor = 0;

                                        if (effect === 'panorama_left') xFactor = 1; // Move Left (Image moves Right to Left?) No, Pan Left usually means View moves Left (Image moves Right)
                                        // Let's stick to "Pan To [Direction]" logic
                                        // Pan Left: Show Right side -> Show Left side (Image moves Right)
                                        if (effect === 'panorama_left') xFactor = -0.05; // Start shifted Right, End shifted Left?
                                        if (effect === 'panorama_right') xFactor = 0.05;
                                        if (effect === 'panorama_up') yFactor = -0.05;
                                        if (effect === 'panorama_down') yFactor = 0.05;

                                        // Move from -Factor to +Factor
                                        const moveP = (pFull - 0.5) * 2; // -1 to 1
                                        const offX = targetW * xFactor * moveP;
                                        const offY = targetH * yFactor * moveP;

                                        renderW = targetW * currentScale;
                                        renderH = targetH * currentScale;
                                        renderX = baseX + (targetW - renderW) / 2 + offX;
                                        renderY = baseY + (targetH - renderH) / 2 + offY;
                                    }
                                }

                                // --- 4.1 Color Grading & Effects (Before Draw) ---
                                const colorGrading = overlayConfig?.colorGrading;
                                let baseFilter = 'none';
                                if (colorGrading && colorGrading.enabled) {
                                    const { brightness = 1.0, contrast = 1.0, saturation = 1.0, sepia = 0 } = colorGrading;
                                    baseFilter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturation}) sepia(${sepia})`;
                                    ctx.filter = baseFilter;
                                } else {
                                    ctx.filter = 'none';
                                }

                                // Draw Image (Main Pass)
                                ctx.globalAlpha = alpha;
                                ctx.drawImage(scene.bitmap, renderX, renderY, renderW, renderH);

                                // --- 4.2 Bloom Effect (Post-Draw / Overlay) ---
                                const bloom = overlayConfig?.bloom;
                                if (bloom && bloom.enabled && bloom.strength > 0) {
                                    const { strength, radius, threshold } = bloom;

                                    ctx.globalCompositeOperation = 'screen';

                                    // Bloom Pass:
                                    // Recalculate filter: Base Grading + Blur + Threshold Simulation
                                    // Threshold simulation: High Contrast + Reduced Brightness (to kill darks) then Boost?
                                    // Or just Blur + Boost.
                                    // Let's just do Blur + slight brightness boost for "Glow"
                                    const bloomFilter = baseFilter !== 'none' ? baseFilter : '';
                                    ctx.filter = `${bloomFilter} blur(${radius}px) brightness(1.2)`;

                                    ctx.globalAlpha = strength * alpha; // Fade bloom with image
                                    ctx.drawImage(scene.bitmap, renderX, renderY, renderW, renderH);

                                    // Reset
                                    ctx.globalCompositeOperation = 'source-over';
                                }

                                ctx.filter = 'none';
                                ctx.globalAlpha = 1.0;
                                if (shouldRestore) ctx.restore();



                                // --- Text Rendering ---
                                const isVerticalCanvas = canvasAspect < 1;
                                const isHorizontalImage = imgAspect > 1;
                                const isSplitLayout = isVerticalCanvas; // Enable Box Layout for all vertical videos for consistency

                                // Strict Text Visibility:
                                // If multiple scenes are active (transition overlap), 
                                // FORCE HIDE text for the bottom/outgoing scene (index 0).
                                // This ensures previous text disappears before next text appears.
                                const isOutgoingOverlap = activeScenes.length > 1 && i === 0;

                                if (captionConfig?.enabled && captionConfig?.mode === 'dynamic' && !isOutgoingOverlap) {
                                    // --- DYNAMIC MODE RENDERING ---
                                    const textToRender = (showNarrationText ? (scene.text || "") : "") || (showSubtitles ? (scene.subtitle || "") : "") || "";
                                    const words = textToRender.trim().split(/\s+/);

                                    if (words.length > 0) {
                                        // 1. Calculate Timing (With Sync Shift)
                                        // Shift > 0: Delays the highlight (Subtract from timeInScene)
                                        // Shift < 0: Advances the highlight (Add to timeInScene) -> effectively subtract negative
                                        const timeInScene = localElapsed - scene.start - (subtitleSyncShift || 0);
                                        const wordDur = Math.max(0.2, scene.duration / words.length); // Min 0.2s duration
                                        const currentWordIndex = Math.min(words.length - 1, Math.max(0, Math.floor(timeInScene / wordDur)));

                                        // 2. Determine Chunk
                                        const wordsPerLine = captionConfig.dynamicStyle.layout.wordsPerLine || 1; // Default 1 if 0/undefined
                                        const chunkIndex = Math.floor(currentWordIndex / wordsPerLine);
                                        const chunkStart = chunkIndex * wordsPerLine;
                                        const chunkEnd = Math.min(chunkStart + wordsPerLine, words.length);
                                        const chunkWords = words.slice(chunkStart, chunkEnd);

                                        // 3. Setup Font
                                        const { fontFamily, fontSize, colors, animation, opacity = 1.0, intensity = 1.0 } = captionConfig.dynamicStyle;
                                        ctx.font = `900 ${fontSize}px "${fontFamily}", sans-serif`;
                                        ctx.textAlign = 'center';
                                        ctx.textBaseline = 'middle';
                                        ctx.lineJoin = 'round';
                                        ctx.miterLimit = 2;

                                        const centerX = canvasW / 2;
                                        let centerY = canvasH / 2;

                                        const vPos = captionConfig.dynamicStyle.layout.verticalPosition || 'middle';
                                        if (vPos === 'top') centerY = canvasH * 0.2;
                                        else if (vPos === 'bottom') centerY = canvasH * 0.8;

                                        // 4. Draw Chunk
                                        // Simple layout: Draw words in a row with spacing
                                        // For multi-word lines, we need to measure widths effectively.
                                        // Quick approach: Join with space and draw? But we need partial highlighting.
                                        // So we calculate x-offsets.

                                        const wordMetrics = chunkWords.map((w: string) => ctx.measureText(w + " "));
                                        const totalWidth = wordMetrics.reduce((sum: number, m: TextMetrics) => sum + m.width, 0) - (wordMetrics.length > 0 ? ctx.measureText(" ").width : 0); // Subtract last space
                                        let currentX = centerX - (totalWidth / 2);

                                        chunkWords.forEach((word: string, idx: number) => {
                                            const globalIndex = chunkStart + idx;
                                            const isActive = globalIndex === currentWordIndex;
                                            const wWidth = wordMetrics[idx].width;
                                            const wX = currentX + (wWidth / 2); // Center of this word
                                            const wH = fontSize * 1.5; // Approx height

                                            const wordTime = timeInScene - (currentWordIndex * wordDur);
                                            const animProgress = isActive ? Math.min(1, Math.max(0, wordTime / wordDur)) : (globalIndex < currentWordIndex ? 1 : 0);
                                            const entranceProgress = Math.min(1, Math.max(0, wordTime / 0.3));

                                            ctx.save();
                                            ctx.globalAlpha = opacity;

                                            let drawX = wX;
                                            let drawY = centerY;

                                            // --- ANIMATION IMPLEMENTATIONS ---

                                            if (animation === 'kinetic_stacking') {
                                                // Words fly in from bottom with staggered delay
                                                // Only animate if it's the current/active word or recent
                                                const stackProgress = globalIndex === currentWordIndex ? entranceProgress : (globalIndex < currentWordIndex ? 1 : 0);

                                                if (stackProgress < 1) {
                                                    const easeOut = 1 - Math.pow(1 - stackProgress, 3); // Cubic ease out
                                                    const yOffset = 100 * (1 - easeOut); // Fly up 100px
                                                    drawY += yOffset;
                                                    ctx.globalAlpha = opacity * stackProgress;
                                                }

                                                // Standard Draw
                                                if (colors.strokeThickness > 0) {
                                                    ctx.strokeStyle = colors.stroke;
                                                    ctx.lineWidth = colors.strokeThickness;
                                                    ctx.strokeText(word, drawX, drawY);
                                                }
                                                ctx.fillStyle = isActive ? colors.activeFill : colors.baseFill;
                                                ctx.fillText(word, drawX, drawY);

                                            } else if (animation === 'mask_reveal') {
                                                // Text rises from invisible line
                                                const revealProgress = globalIndex === currentWordIndex ? entranceProgress : (globalIndex < currentWordIndex ? 1 : 0);

                                                // Create clipping mask at the baseline
                                                // Create clipping mask at the baseline
                                                // We want to clip everything BELOW the baseline initially? No, reveal is rising UP.
                                                // So we clip to the target area (where text SHOULD be).
                                                ctx.beginPath();
                                                // Clip Area: From top of text (centerY - wH) down to baseline (centerY + wH/2)
                                                // Expanding width to be safe
                                                ctx.rect(drawX - wWidth * 1.5, centerY - wH, wWidth * 3, wH * 2);
                                                // ACTUALLY, for "Mask Reveal", we usually want it to look like it's coming out of a slot.
                                                // So we need to define a "slot" line. Let's say the slot is at centerY + wH/2.
                                                // But usually standard mask reveal is just a container clip.
                                                // The issue "50% cut" implies the rect height/y-pos is wrong.
                                                // Previous: centerY - wH, height: wH. -> This goes from Top to Center. 
                                                // If text is centered at centerY, it clips the bottom half.
                                                // FIX: Height should be wH * 2 to cover bottom half too.

                                                if (revealProgress < 1) {
                                                    const easeOut = 1 - Math.pow(1 - revealProgress, 3);
                                                    const yOffset = 30 * (1 - easeOut);
                                                    drawY += yOffset;
                                                    ctx.globalAlpha = opacity * revealProgress;
                                                }

                                                // Standard Draw
                                                if (colors.strokeThickness > 0) {
                                                    ctx.strokeStyle = colors.stroke;
                                                    ctx.lineWidth = colors.strokeThickness;
                                                    ctx.strokeText(word, drawX, drawY);
                                                }
                                                ctx.fillStyle = isActive ? colors.activeFill : colors.baseFill;
                                                ctx.fillText(word, drawX, drawY);

                                            } else if (animation === 'typewriter') {
                                                // Typewriter: Character-by-character (syllable-by-syllable)
                                                if (animProgress > 0) {
                                                    let textToDraw = word;
                                                    let currentWWidth = wWidth;

                                                    if (isActive && animProgress < 1) {
                                                        const charCount = Math.floor(word.length * animProgress);
                                                        // Ensure at least 1 char if started
                                                        textToDraw = word.substring(0, Math.max(1, charCount));
                                                        currentWWidth = ctx.measureText(textToDraw).width;
                                                    }

                                                    // Alignment Stability:
                                                    // Since text is drawn centered at drawX, a growing substring would jitter left/right.
                                                    // We offset drawX so the LEFT edge of the substring matches the LEFT edge of the full word.
                                                    // Left of Full = drawX - wWidth/2
                                                    // Left of Sub = (drawX + offset) - currentWWidth/2
                                                    // => offset = (currentWWidth - wWidth) / 2
                                                    const alignOffset = (currentWWidth - wWidth) / 2;
                                                    const alignedX = drawX + alignOffset;

                                                    if (colors.strokeThickness > 0) {
                                                        ctx.strokeStyle = colors.stroke;
                                                        ctx.lineWidth = colors.strokeThickness;
                                                        ctx.strokeText(textToDraw, alignedX, drawY);
                                                    }
                                                    ctx.fillStyle = isActive ? colors.activeFill : colors.baseFill;
                                                    ctx.fillText(textToDraw, alignedX, drawY);

                                                    // Optional Cursor
                                                    if (isActive && animProgress < 1) {
                                                        ctx.fillStyle = colors.activeFill;
                                                        ctx.fillRect(alignedX + currentWWidth / 2 + 2, drawY - wH / 2, 2, wH);
                                                    }
                                                }

                                            } else if (animation === 'karaoke_v2') {
                                                // 1. Draw Base (Inactive) Layer First
                                                if (colors.strokeThickness > 0) {
                                                    ctx.strokeStyle = colors.stroke;
                                                    ctx.lineWidth = colors.strokeThickness;
                                                    ctx.strokeText(word, drawX, drawY);
                                                }
                                                ctx.fillStyle = colors.baseFill;
                                                ctx.fillText(word, drawX, drawY);

                                                // 2. Draw Active Fill with Clip
                                                if (animProgress > 0) {
                                                    ctx.save();
                                                    ctx.beginPath();
                                                    // Clip from Left to Right based on progress
                                                    const clipW = wWidth * animProgress;
                                                    ctx.rect(drawX - (wWidth / 2), drawY - wH / 2, clipW, wH);
                                                    ctx.clip();

                                                    // Re-draw stroke/fill with Active Color
                                                    if (colors.strokeThickness > 0) {
                                                        ctx.strokeStyle = colors.stroke; // Or distinct active stroke?
                                                        ctx.lineWidth = colors.strokeThickness;
                                                        ctx.strokeText(word, drawX, drawY);
                                                    }
                                                    ctx.fillStyle = colors.activeFill;
                                                    ctx.fillText(word, drawX, drawY);
                                                    ctx.restore();
                                                }

                                            } else {
                                                // --- EXISTING ANIMATIONS (Pop, Shake, Elastic, None) ---
                                                if (isActive && animation !== 'none') {
                                                    // ... (Existing logic reused via copy or just kept)
                                                    // We can't easily "copy" inside replace tool, so we explicitly restore logic:

                                                    const p = entranceProgress; // Alias for consistency

                                                    // Transform around the text position (drawX, drawY)
                                                    ctx.translate(drawX, drawY);

                                                    if (animation === 'pop') {
                                                        const scale = 1 + Math.sin(p * Math.PI) * (0.2 * intensity);
                                                        ctx.scale(scale, scale);
                                                    } else if (animation === 'shake') {
                                                        const shake = Math.sin(wordTime * 20) * (10 * intensity) * (1 - p);
                                                        ctx.rotate(shake * Math.PI / 180);
                                                    } else if (animation === 'elastic') {
                                                        const scale = 1 + (Math.sin(p * Math.PI * 2) * (1 - p)) * (0.5 * intensity);
                                                        ctx.scale(scale, scale);
                                                    }
                                                    ctx.translate(-drawX, -drawY);
                                                }

                                                // Standard Draw
                                                if (colors.strokeThickness > 0) {
                                                    ctx.strokeStyle = colors.stroke;
                                                    ctx.lineWidth = colors.strokeThickness;
                                                    ctx.strokeText(word, drawX, drawY);
                                                }
                                                ctx.fillStyle = isActive ? colors.activeFill : colors.baseFill;
                                                ctx.fillText(word, drawX, drawY);
                                            }

                                            ctx.restore();
                                            currentX += wWidth;
                                        });
                                    }

                                    // Draw Safe Zone Overlay (Debugging/UI) - REMOVED
                                    /* 
                                    if (captionConfig.dynamicStyle.layout.safeZonePadding) {
                                        ctx.save();
                                        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
                                        ctx.lineWidth = 2;
                                        ctx.setLineDash([10, 10]);
                                        // TikTok safe zone approx: Side 16px, Bottom 140px, Top 100px
                                        const safeW = canvasW * 0.85;
                                        const safeH = canvasH * 0.7; // Exclude top/bottom UI
                                        ctx.strokeRect((canvasW - safeW) / 2, (canvasH - safeH) / 2, safeW, safeH);
                                        ctx.restore();
                                    }
                                    */

                                }
                                if (!isOutgoingOverlap || subtitleExitAnimation !== 'none') {
                                    // 1. TOP SUBTITLE (Cached)
                                    if (showSubtitles && scene.subtitle && scene.subLayout) {
                                        let drawY = 0;
                                        let drawH = 0;
                                        let showBg = false;

                                        if (isSplitLayout) {
                                            drawY = 0;
                                            drawH = renderY;
                                            if (drawH < 50) { drawH = 100; showBg = true; }
                                        } else {
                                            drawY = 40; // Push down by 40px
                                            drawH = 100 + (subtitleFontSize - 50);
                                            showBg = false; // Remove background
                                        }

                                        if (drawH > 20) {
                                            // Animation Logic
                                            let animAlpha = 1;
                                            ctx.save();

                                            // Determine which animation to use
                                            // Determine which animation to use
                                            // Scale animation duration by narration speed to match pacing
                                            const animDur = (0.5 / (narrationSpeed || 1.0));

                                            // Finish Exit Animation BEFORE transition starts (1.0s overlap)
                                            const isLastScene = scene === timeline[timeline.length - 1];
                                            const transOverlap = isLastScene ? 0 : 1.0;

                                            // Start Entrance Animation AFTER transition has settled (0.5s delay)
                                            // This prevents overlap with the previous scene's exit animation
                                            const isFirstGlobalScene = scene === timeline[0];
                                            const entranceDelay = isFirstGlobalScene ? 0 : 0.5;

                                            const timeIn = localElapsed - scene.start - entranceDelay;
                                            const timeOut = (scene.start + scene.duration - transOverlap) - localElapsed;

                                            let currentAnimType = 'none';
                                            let progress = 1;
                                            let isEntrance = false;

                                            if (timeIn < 0) {
                                                // Waiting for Entrance Delay
                                                currentAnimType = 'waiting';
                                            } else if (timeIn < animDur) {
                                                progress = timeIn / animDur;
                                                isEntrance = true;
                                                currentAnimType = subtitleEntranceAnimation;
                                            } else if (timeOut < animDur) {
                                                progress = timeOut / animDur;
                                                isEntrance = false;
                                                currentAnimType = subtitleExitAnimation;
                                            }

                                            // Handling "Waiting" or "Negative Progress" (Ghosting Fix)
                                            if (currentAnimType === 'waiting' || progress < 0) {
                                                animAlpha = 0;
                                            }
                                            else if (currentAnimType !== 'none' && progress < 1) {
                                                const ease = 1 - Math.pow(1 - progress, 3); // Cubic Out

                                                // Center Point
                                                const centerX = canvasW / 2;
                                                const centerY = drawY + (drawH / 2);

                                                const dir = isEntrance ? 1 : -1;

                                                if (currentAnimType === 'fade') {
                                                    animAlpha = Math.max(0, progress);
                                                }
                                                else if (currentAnimType === 'slide-up') {
                                                    // Enter: +50 -> 0 (Up). Exit: 0 -> -50 (Up)
                                                    const offset = 50 * (1 - ease) * dir;
                                                    ctx.translate(0, offset);
                                                    animAlpha = Math.max(0, progress);
                                                }
                                                else if (currentAnimType === 'slide-down') {
                                                    // Enter: -50 -> 0 (Down). Exit: 0 -> +50 (Down)
                                                    const offset = -50 * (1 - ease) * dir;
                                                    ctx.translate(0, offset);
                                                    animAlpha = Math.max(0, progress);
                                                }
                                                else if (currentAnimType === 'slide-left') {
                                                    // Enter: +50 -> 0 (Left). Exit: 0 -> -50 (Left)
                                                    const offset = 50 * (1 - ease) * dir;
                                                    ctx.translate(offset, 0);
                                                    animAlpha = Math.max(0, progress);
                                                }
                                                else if (currentAnimType === 'slide-right') {
                                                    // Enter: -50 -> 0 (Right). Exit: 0 -> +50 (Right)
                                                    const offset = -50 * (1 - ease) * dir;
                                                    ctx.translate(offset, 0);
                                                    animAlpha = Math.max(0, progress);
                                                }
                                                else if (currentAnimType === 'zoom-in') {
                                                    const scale = Math.max(0, progress);
                                                    ctx.translate(centerX, centerY);
                                                    ctx.scale(scale, scale);
                                                    ctx.translate(-centerX, -centerY);
                                                    animAlpha = Math.max(0, progress);
                                                }
                                                else if (currentAnimType === 'zoom-out') {
                                                    const scale = 1.5 - (0.5 * ease);
                                                    ctx.translate(centerX, centerY);
                                                    ctx.scale(scale, scale);
                                                    ctx.translate(-centerX, -centerY);
                                                    animAlpha = Math.max(0, progress);
                                                }
                                                else if (currentAnimType === 'pop') {
                                                    let scale = 1;
                                                    if (isEntrance) {
                                                        scale = progress < 0.8 ? (progress / 0.8) * 1.1 : 1.1 - ((progress - 0.8) / 0.2) * 0.1;
                                                    } else {
                                                        // Exit Pop: Anticipate (1.0 -> 1.1) then Shrink (1.1 -> 0)
                                                        if (progress > 0.8) {
                                                            const p = (1 - progress) / 0.2; // 0 -> 1
                                                            scale = 1.0 + (p * 0.1);
                                                        } else {
                                                            scale = (progress / 0.8) * 1.1;
                                                        }
                                                    }

                                                    ctx.translate(centerX, centerY);
                                                    ctx.scale(scale, scale);
                                                    ctx.translate(-centerX, -centerY);
                                                    animAlpha = Math.max(0, progress);
                                                }
                                            }

                                            // Draw Background (Custom or Auto)
                                            const bgOpacity = subtitleBackgroundOpacity ?? 1.0;
                                            if ((showBg || bgOpacity > 0) && scene.subLayout) {
                                                ctx.save();
                                                ctx.globalAlpha = showBg ? (0.6 * animAlpha) : (bgOpacity * animAlpha);
                                                ctx.fillStyle = subtitleBackgroundColor || "#000000";

                                                const layout = scene.subLayout;
                                                const font = `bold ${layout.fontSize}px '${subtitleFont}', sans - serif`;
                                                ctx.font = font;

                                                // Match drawTextLayout positioning
                                                // y passed to drawTextLayout is 'drawY'
                                                // h passed is 'drawH'
                                                const startY = drawY + (drawH - layout.totalHeight) / 2 + (layout.lineHeight / 2);

                                                layout.lines.forEach((line, idx) => {
                                                    const metrics = ctx.measureText(line);
                                                    const textWidth = metrics.width;
                                                    const paddingX = 20;
                                                    const bgW = textWidth + (paddingX * 2);
                                                    const bgH = layout.lineHeight;
                                                    const bgX = (canvasW / 2) - (bgW / 2);

                                                    // lineY is the middle baseline of the text
                                                    const lineY = startY + (idx * layout.lineHeight) - (layout.lineHeight * 0.1);
                                                    const bgY = lineY - (bgH / 2);

                                                    ctx.fillRect(bgX, bgY, bgW, bgH);
                                                });

                                                ctx.restore();
                                            }

                                            ctx.globalAlpha = animAlpha;
                                            drawTextLayout(ctx, scene.subLayout, 0, drawY, canvasW, drawH, subtitleColor, subtitleFont, subtitleEffectStyle, subtitleEffectColor, subtitleEffectParam, subtitleOpacity, subtitleStrokeColor, subtitleStrokeWidth);
                                            ctx.globalAlpha = 1.0;
                                            ctx.restore();
                                        }
                                    }

                                    // 2. BOTTOM NARRATION (Cached or Ticker)
                                    // Strictly hide outgoing narration to prevent overlap
                                    const isDynamicOn = captionConfig?.enabled && captionConfig?.mode === 'dynamic';
                                    if (showNarrationText && scene.text && !isOutgoingOverlap && !isDynamicOn) {
                                        if (isSplitLayout && scene.narrationLayout) {
                                            let bottomBarY = renderY + renderH;
                                            let bottomBarH = canvasH - bottomBarY;

                                            // [Layout Fix] For full-height vertical images (9:16), renderY+renderH equals canvasH, leaving no space.
                                            // In this case, we FORCE a bottom overlay zone to mimic the "Split Layout" box style.
                                            if (bottomBarH < 100) {
                                                const optimalHeight = scene.narrationLayout.totalHeight + 80; // Text height + Padding
                                                bottomBarH = Math.max(250, optimalHeight);
                                                bottomBarY = canvasH - bottomBarH;
                                            }

                                            if (bottomBarH > 50) {
                                                // Draw Background for Split Layout Narration
                                                const nBgOpacity = narrationBackgroundOpacity ?? 0;
                                                if (nBgOpacity > 0) {
                                                    ctx.save();
                                                    ctx.globalAlpha = nBgOpacity;
                                                    ctx.fillStyle = narrationBackgroundColor || "#000000";
                                                    ctx.font = `bold ${narrationFontSize}px '${narrationFont}', sans-serif`;

                                                    // Calculate vertical centering for the text block within the bottom bar
                                                    // matches drawTextLayout logic: startY = y + (h - totalHeight) / 2 + (lineHeight / 2)
                                                    const totalH = scene.narrationLayout!.totalHeight;
                                                    const startY = bottomBarY + (bottomBarH - totalH) / 2 + (scene.narrationLayout!.lineHeight / 2);

                                                    scene.narrationLayout!.lines.forEach((line, idx) => {
                                                        const metrics = ctx.measureText(line);
                                                        const padding = 20;
                                                        const bgW = metrics.width + (padding * 2);
                                                        const bgH = scene.narrationLayout!.lineHeight;
                                                        const bgX = (canvasW / 2) - (bgW / 2);
                                                        // lineY is the middle baseline
                                                        const lineY = startY + (idx * scene.narrationLayout!.lineHeight) - (scene.narrationLayout!.lineHeight * 0.1);
                                                        const bgY = lineY - (bgH / 2);

                                                        ctx.fillRect(bgX, bgY, bgW, bgH);
                                                    });
                                                    ctx.restore();
                                                }

                                                drawTextLayout(ctx, scene.narrationLayout, 0, bottomBarY, canvasW, bottomBarH, narrationColor, narrationFont);
                                            }
                                        } else {
                                            // Ticker Mode
                                            const textBgH = narrationFontSize * 2.0;
                                            const navBgOpacity = narrationBackgroundOpacity ?? 0.6;

                                            if (navBgOpacity > 0) {
                                                ctx.save();
                                                ctx.globalAlpha = navBgOpacity;
                                                ctx.fillStyle = narrationBackgroundColor || "#000000";
                                                ctx.fillRect(0, canvas.height - textBgH, canvas.width, textBgH);
                                                ctx.restore();
                                            }

                                            ctx.fillStyle = narrationColor;
                                            ctx.font = `bold ${narrationFontSize}px '${narrationFont}', sans-serif`;

                                            const textMetrics = ctx.measureText(scene.text);
                                            const textWidth = textMetrics.width;
                                            const safeWidth = canvas.width - 100; // safe area

                                            if (textWidth > safeWidth) {
                                                const totalDistance = canvas.width + textWidth + 100;
                                                // Speed is determined by duration (which is now scaled by subtitleSpeed)
                                                // So we just need to finish covering the distance within the duration.
                                                // [Fix] For horizontal videos (wide screen), the distance is huge, making it too fast.
                                                // We increase the minDuration denominator to slow it down, even if it means not fully exiting.
                                                const minDuration = canvas.width > 1200 ? 8 : 3;
                                                const baseSpeed = totalDistance / Math.max(scene.duration, minDuration);
                                                const speed = baseSpeed * (tickerSpeed || 1.0);

                                                const timeInScene = elapsed - scene.start;
                                                let xPos = canvas.width + 50 - (speed * timeInScene);

                                                ctx.textAlign = "left";
                                                ctx.textBaseline = "middle";
                                                ctx.fillText(scene.text, xPos, canvas.height - (textBgH / 2));
                                            } else {
                                                ctx.textAlign = "center";
                                                ctx.textBaseline = "middle";
                                                ctx.fillText(scene.text, canvas.width / 2, canvas.height - (textBgH / 2));
                                            }
                                        }
                                    }
                                }
                            });


                            // --- LAYER 3: GLOBAL PROCEDURAL VFX ---
                            // Interactive Preview Optimization: Throttling
                            // If quality is 'low', pass a throttle flag to reduce particle count / complexity
                            const throttleVFX = quality === 'low';
                            drawProceduralVFXLayer(ctx, canvas.width, canvas.height, elapsed, overlayConfig || undefined, throttleVFX);

                            // --- LAYER 4: EXTERNAL OVERLAY MEDIA (NEW) ---
                            if (overlayMediaRef.current) {
                                const { media, type } = overlayMediaRef.current;
                                ctx.save();
                                ctx.globalCompositeOperation = 'screen'; // Default to screen for overlays like lens flares
                                ctx.globalAlpha = 0.8; // Default opacity

                                // Ensure video plays
                                if (type === 'video') {
                                    const v = media as HTMLVideoElement;
                                    if (v.paused && !isPausedRef.current) v.play().catch(() => { });
                                    if (!v.paused && isPausedRef.current) v.pause();
                                }

                                drawImageCover(ctx, media, canvasW, canvasH);
                                ctx.restore();
                            }


                            // 3. AUDIO VISUALIZER (On Overlay Canvas)
                            if (analyser && vizCanvasRef.current) {
                                const vCtx = vizCanvasRef.current.getContext('2d');
                                if (vCtx) {
                                    vCtx.clearRect(0, 0, vizCanvasRef.current.width, vizCanvasRef.current.height);
                                    drawAudioVisualizer(vCtx, analyser, vizCanvasRef.current.width, vizCanvasRef.current.height);
                                }
                            }

                            // Draw AI Disclosure if enabled
                            if (aiDisclosureEnabled) {
                                ctx.globalAlpha = 0.8;
                                ctx.fillStyle = "rgba(0,0,0,0.5)"; // Darker bg for better contrast
                                const disclosureText = "본 영상은 AI 기술로 생성되었습니다.";
                                ctx.font = "bold 24px 'Pretendard', sans-serif"; // Increased from 14px to 24px
                                const metrics = ctx.measureText(disclosureText);
                                const padding = 12; // Increased padding
                                ctx.fillRect(30, 30, metrics.width + padding * 2, 40); // Adjusted rect
                                ctx.fillStyle = "white";
                                ctx.textAlign = "left";
                                ctx.textBaseline = "middle";
                                ctx.fillText(disclosureText, 30 + padding, 30 + 20); // Centered in rect
                                ctx.globalAlpha = 1.0;
                            }



                            // ... (rest of effects)

                            // ... inside drawFrame ...

                            // Draw Watermark — dynamic position/size/opacity
                            if (watermarkBitmap) {
                                // Compute target dimensions
                                const cfg = watermarkConfig;
                                const fraction = cfg?.size ?? 0.15;
                                const opacity = cfg?.opacity ?? 0.8;
                                const position = cfg?.position ?? 'top-right';

                                const wW = canvasW * fraction;
                                const aspect = watermarkBitmap.width / watermarkBitmap.height;
                                const wH = wW / aspect;
                                const margin = canvasW * 0.02;

                                let wx: number;
                                let wy: number;

                                if (position === 'custom' && cfg) {
                                    // Centre the logo on the proportional coord
                                    wx = cfg.x * canvasW - wW / 2;
                                    wy = cfg.y * canvasH - wH / 2;
                                } else {
                                    const PRESETS: Record<string, [number, number]> = {
                                        'top-left': [margin, margin],
                                        'top-right': [canvasW - wW - margin, margin],
                                        'bottom-left': [margin, canvasH - wH - margin],
                                        'bottom-right': [canvasW - wW - margin, canvasH - wH - margin],
                                        'center': [(canvasW - wW) / 2, (canvasH - wH) / 2],
                                    };
                                    [wx, wy] = PRESETS[position] ?? PRESETS['top-right'];
                                }

                                ctx.save();
                                ctx.globalAlpha = opacity;
                                ctx.drawImage(watermarkBitmap, wx, wy, wW, wH);
                                ctx.restore();
                            }


                            // Draw QR Code if loaded (Below Watermark or Top Right if no Watermark)
                            // Draw QR Code if loaded
                            // Draw QR Code if loaded
                            if (qrBitmap) {
                                const size = qrCodeSize; // QR Code Image Size
                                const border = 5;

                                // Dynamic Label Sizing
                                // Base: 120px size -> 30px label, 14px font
                                // Ratio: Label = Size * 0.25, Font = Size * 0.12 (approx)
                                const labelHeight = Math.max(30, Math.round(size * 0.25));
                                const fontSize = Math.max(14, Math.round(size * 0.12));

                                const totalW = size + (border * 2);
                                const totalH = size + (border * 2) + labelHeight;

                                const padding = 20;
                                let qrX = canvas.width - totalW - padding; // Default Top-Right
                                let qrY = padding;

                                // Position Logic
                                if (qrCodePosition === 'top-left') {
                                    qrX = padding;
                                    qrY = padding;
                                } else if (qrCodePosition === 'bottom-left') {
                                    qrX = padding;
                                    qrY = canvas.height - totalH - padding;
                                } else if (qrCodePosition === 'bottom-right') {
                                    qrX = canvas.width - totalW - padding;
                                    qrY = canvas.height - totalH - padding;
                                } else {
                                    // Top-Right (Default)
                                    qrX = canvas.width - totalW - padding;
                                    qrY = padding;

                                    // Only offset for watermark if we are in Top-Right
                                    if (watermarkBitmap) {
                                        qrY += 80; // approximate watermark height + padding
                                    }
                                }

                                // 1. Draw White Background for QR
                                ctx.fillStyle = "white";
                                ctx.fillRect(qrX, qrY, totalW, size + border * 2);

                                // 2. Draw QR Image
                                ctx.drawImage(qrBitmap, qrX + border, qrY + border, size, size);

                                // 3. Draw Label Background (Light Green)
                                ctx.fillStyle = "#d1fae5"; // Tailwind green-100/200 looks good
                                ctx.fillRect(qrX, qrY + size + border * 2, totalW, labelHeight);

                                // 4. Draw Label Text
                                ctx.fillStyle = "#064e3b"; // Dark green text
                                ctx.font = `bold ${fontSize}px 'Pretendard', sans - serif`;
                                ctx.textAlign = "center";
                                ctx.textBaseline = "middle";
                                ctx.fillText("자세히보기", qrX + totalW / 2, qrY + size + border * 2 + labelHeight / 2);
                            }

                            // Trigger Narration (REAL AUDIO)
                            // Trigger Narration (REAL AUDIO) - Only if NOT using strict Audio Clock
                            if (narrationEnabled && audioDest && !useAudioClock) {
                                let currentIdx = -1;
                                for (let i = 0; i < timeline.length; i++) {
                                    // Check against strict audio trigger time + Intro Duration (Global Time)
                                    if (elapsed >= ((timeline[i] as any).triggerTime + introDur)) {
                                        currentIdx = i;
                                    }
                                }

                                if (currentIdx > lastSceneIndex) {
                                    lastSceneIndex = currentIdx;

                                    // Stop previous narration if overlap
                                    if (activeSpeechSource) {
                                        try { activeSpeechSource.stop(); } catch (e) { }
                                        activeSpeechSource = null;
                                    }

                                    // Play pre-loaded buffer
                                    const buffer = speechBuffers[currentIdx];
                                    if (buffer && audioCtx) {
                                        const source = audioCtx.createBufferSource();
                                        source.buffer = buffer;
                                        if (analyser) source.connect(analyser);
                                        else source.connect(audioDest);
                                        source.start(0);
                                        activeSpeechSource = source;
                                    }
                                }
                            }
                        }

                        if (isMounted) {
                            reqIdRef.current = requestAnimationFrame(drawFrame);
                        }
                    } catch (err: any) {
                        console.error("Rendering error:", err);
                        if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
                    }
                };

                // Start Loop
                startTimeRef.current = performance.now();
                reqIdRef.current = requestAnimationFrame(drawFrame);

            } catch (e: any) {
                console.error("Run error:", e);
                setError(`Setup Failed: ${e.message} `);
                setStatus("Setup Failed");
            }
        };

        run();

        return () => {
            isMounted = false;
            if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
            if (recorder?.state === 'recording') recorder.stop();
            if (audioCtx && audioCtx.state !== 'closed') {
                audioCtx.close().catch(e => console.log("Cleanup close error", e));
            }
            if (activeSpeechSource) {
                try { activeSpeechSource.stop(); } catch (e) { }
            }
            window.speechSynthesis.cancel();
        }



    }, [scenes, audioSrc, audioVolume, onComplete, aiDisclosureEnabled, watermarkUrl, watermarkConfig, subtitleFontSize, narrationFontSize, previewMode, subtitleColor, narrationColor, subtitleFont, narrationFont, qrCodeUrl, qrCodeSize, qrCodePosition, subtitleEffectStyle, subtitleEffectColor, subtitleEffectParam, subtitleEntranceAnimation, subtitleExitAnimation, narrationSpeed, tickerSpeed, renderId, introMedia, outroMedia, introScale, outroScale, backgroundColor, backgroundUrl, subtitleBackgroundColor, subtitleBackgroundOpacity, narrationBackgroundColor, narrationBackgroundOpacity, captionConfig, subtitleSyncShift, canvasWidth, canvasHeight, narrationEnabled, subtitleOpacity, subtitleStrokeColor, subtitleStrokeWidth, scaleMode, overlayConfig, overlayMediaUrl, onLog, quality]);

    // Handle Seek (New Effect)
    useEffect(() => {
        if (seekToTime !== null && seekToTime >= 0) {
            // Formula: elapsed = now - start - paused
            // seekTime * 1000 = now - start - paused
            // start = now - (seekTime * 1000) - paused
            startTimeRef.current = performance.now() - (seekToTime * 1000) - totalPausedTimeRef.current;

            // Optional: If paused, we might need to force a single frame draw? 
            // The loop might be paused.
            if (isPausedRef.current) {
                // We can't easily force a draw without exposing drawFrame outside. 
                // But if we toggle pause off/on or rely on the fact that user usually drags while playing...
                // Actually user often scrubs while paused.
                // We should probably allow the loop to run ONCE if paused? 
                // Or simpler: Just update the ref. If paused, it won't update visually until resume OR if we have a separate mechanism.
                // For now, let's assume scrubbing happens while playing or we accept resume-to-see.
            }
        }
    }, [seekToTime]);

    if (error) return <div className="text-red-500">{error}</div>;

    return (
        <div className="relative rounded-lg overflow-hidden bg-black w-full h-full flex items-center justify-center">
            <canvas
                ref={canvasRef}
                // Interactive Preview Optimization: Use scaled internal resolution if quality is 'low'
                width={quality === 'low' ? Math.min(canvasWidth, 1280) : canvasWidth}
                height={quality === 'low' ? Math.min(canvasHeight, (1280 / canvasWidth) * canvasHeight) : canvasHeight}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                }}
                className="w-full h-full object-contain"
            />

            {/* Separate Visualizer Canvas (Overlay, Fixed Position) */}
            <canvas
                ref={vizCanvasRef}
                width={300}
                height={80}
                className="absolute bottom-6 right-6 w-[300px] h-[80px] pointer-events-none z-[50] rounded border border-white/10 bg-black/20"
            />

            {!previewMode && (
                <>
                    <div className="absolute top-4 right-4 bg-black/70 px-3 py-1 rounded text-white text-xs font-mono border border-white/20 z-10">
                        Generating: {Math.round(progress)}%
                    </div>

                    {/* CONTROL OVERLAY */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex gap-4 z-20">
                        {/* PAUSE / RESUME */}
                        <button
                            onClick={handleTogglePause}
                            className="bg-black/80 hover:bg-black text-white p-4 rounded-full border border-white/20 shadow-lg backdrop-blur-md transition-all hover:scale-110 active:scale-95 group"
                            title={isPaused ? "무개 (Resume)" : "일시정지 (Pause)"}
                        >
                            {isPaused ? (
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                            )}
                        </button>

                        {/* RESTART */}
                        <button
                            onClick={handleRestart}
                            className="bg-black/80 hover:bg-black text-white p-4 rounded-full border border-white/20 shadow-lg backdrop-blur-md transition-all hover:scale-110 active:scale-95"
                            title="처음부터 다시 (Restart)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6" /><path d="M2.5 22v-6h6" /><path d="M2 11.5a10 10 0 0 1 18.8-4.3" /><path d="M22 12.5a10 10 0 0 1-18.8 4.2" /></svg>
                        </button>

                        {/* STOP */}
                        <button
                            onClick={handleStop}
                            className="bg-red-900/80 hover:bg-red-900 text-white p-4 rounded-full border border-red-500/20 shadow-lg backdrop-blur-md transition-all hover:scale-110 active:scale-95"
                            title="중지 (Stop)"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
                        </button>
                    </div>

                    {/* Status Log Overlay */}
                    <div className="absolute bottom-4 left-4 right-auto max-w-[80vw] text-white/90 font-mono text-xs z-10 flex flex-col justify-end items-start pointer-events-none gap-1">
                        {logHistory.map((log, i) => (
                            <div key={i} className="bg-black/60 px-2 py-1 rounded backdrop-blur-sm border border-white/10 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 break-words whitespace-pre-wrap max-w-full">
                                {log}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// --- LAYER FUNCTIONS (Refactored) ---

function drawProceduralVFXLayer(ctx: CanvasRenderingContext2D, width: number, height: number, time: number, config?: OverlayConfig, throttle: boolean = false) {
    if (!config) return;

    // Ensure 1:1 scale for overlays (ignore zoom effects)
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // A. Light Leaks
    if (config.lightLeak?.enabled) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = (config.lightLeak.intensity || 0.5) * 0.5;

        // Throttling: Reduce light leak complexity if needed (currently cheap, so maybe just 1 leak?)
        const leakCount = throttle ? 1 : 2;

        // Moving gradients
        const leaks = [
            { x: Math.sin(time * 0.5) * width, y: Math.cos(time * 0.3) * height, r: width * 0.8, c: config.lightLeak.colorTheme === 'warm' ? ['#ff9966', '#ff5e62'] : ['#4facfe', '#00f2fe'] },
            { x: Math.cos(time * 0.4) * width, y: Math.sin(time * 0.6) * height, r: width * 0.6, c: config.lightLeak.colorTheme === 'warm' ? ['#f2994a', '#f2c94c'] : ['#43e97b', '#38f9d7'] }
        ];

        leaks.slice(0, leakCount).forEach(leak => {
            const g = ctx.createRadialGradient(Math.abs(leak.x), Math.abs(leak.y), 0, Math.abs(leak.x), Math.abs(leak.y), leak.r);
            g.addColorStop(0, leak.c[0]);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, width, height);
        });
        ctx.restore();
    }

    // B. Film Grain
    if (config.filmGrain?.enabled) {
        const intensity = config.filmGrain.intensity || 0.3;
        if (intensity > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.globalAlpha = intensity * 0.4;

            const coarseness = config.filmGrain.coarseness || 2;

            // Throttling: Reduce grain count by 50%
            const grainCount = throttle ? 150 : 300;

            // 1. Black Grains
            ctx.fillStyle = '#000000';
            for (let n = 0; n < grainCount; n++) {
                const nx = Math.random() * width;
                const ny = Math.random() * height;
                const ns = (Math.random() + 0.5) * coarseness;
                ctx.fillRect(nx, ny, ns, ns);
            }

            // 2. White Grains
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = intensity * 0.3;
            for (let n = 0; n < grainCount; n++) {
                const nx = Math.random() * width;
                const ny = Math.random() * height;
                const ns = (Math.random() + 0.5) * coarseness;
                ctx.fillRect(nx, ny, ns, ns);
            }
            ctx.restore();
        }
    }

    // C. Dust Particles
    if (config.dustParticles?.enabled) {
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.shadowColor = 'white';
        ctx.shadowBlur = 4;
        ctx.globalAlpha = 0.8;

        // Throttling: Reduce particle density
        const baseDensity = config.dustParticles.density || 0.5;
        const effectiveDensity = throttle ? baseDensity * 0.5 : baseDensity;

        const count = Math.floor(effectiveDensity * 400);
        for (let i = 0; i < count; i++) {
            const speed = (config.dustParticles.speed || 0.5) * 80;
            const x = ((Math.sin(i * 13.3 + time * 0.2) + 1.2) * width * 0.5 + (Math.cos(time * 0.15 + i) * speed * 2)) % width;
            const y = ((i * 123.4 + time * speed) % (height + 50)) - 25;
            const size = (i % 3 === 0) ? 2.5 : ((i % 2 === 0) ? 1.5 : 0.8);

            ctx.beginPath();
            const safeX = x < 0 ? x + width : x;
            ctx.arc(safeX, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // D. Vignette
    if (config.vignette?.enabled) {
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        const vInt = config.vignette.intensity || 0.7;
        const maxDim = Math.max(width, height);
        const rInner = maxDim * (0.6 - (vInt * 0.6));
        const rOuter = maxDim * (1.2 - (vInt * 0.7));

        const g = ctx.createRadialGradient(width / 2, height / 2, Math.max(0, rInner), width / 2, height / 2, Math.max(0, rOuter));
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.5, `rgba(0,0,0,${vInt * 0.5})`);
        g.addColorStop(1, `rgba(0,0,0,${Math.min(1, vInt * 2.0)})`);

        ctx.fillStyle = g;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
    }
}

// Helper: Cover Fit Draw
// Helper: Cover Fit Draw
function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLVideoElement | ImageBitmap, w: number, h: number) {
    if (!img) return;
    let imgW = 0;
    let imgH = 0;

    if (img instanceof HTMLVideoElement) {
        imgW = img.videoWidth;
        imgH = img.videoHeight;
    } else {
        imgW = img.width;
        imgH = img.height;
    }

    if (!imgW || !imgH) return;

    const imgAspect = imgW / imgH;
    const canvasAspect = w / h;

    let renderW, renderH, renderX, renderY;

    if (imgAspect > canvasAspect) {
        renderH = h;
        renderW = h * imgAspect;
        renderX = (w - renderW) / 2;
        renderY = 0;
    } else {
        renderW = w;
        renderH = w / imgAspect;
        renderX = 0;
        renderY = (h - renderH) / 2;
    }

    ctx.drawImage(img, renderX, renderY, renderW, renderH);
}

function drawImageScaled(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLVideoElement | ImageBitmap, w: number, h: number, scale: number) {
    if (!img) return;
    let imgW = 0;
    let imgH = 0;

    if (img instanceof HTMLVideoElement) {
        imgW = img.videoWidth;
        imgH = img.videoHeight;
    } else {
        imgW = img.width;
        imgH = img.height;
    }

    if (!imgW || !imgH) return;

    // 1. Calculate Standard "Cover" Dimensions First (Base Full Screen)
    const imgAspect = imgW / imgH;
    const canvasAspect = w / h;
    let baseW, baseH;

    if (imgAspect > canvasAspect) {
        baseH = h;
        baseW = h * imgAspect;
    } else {
        baseW = w;
        baseH = w / imgAspect;
    }

    // 2. Apply Scale
    const targetW = baseW * scale;
    const targetH = baseH * scale;

    // 3. Center
    const x = (w - targetW) / 2;
    const y = (h - targetH) / 2;

    ctx.drawImage(img, x, y, targetW, targetH);
}

function drawImageContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLVideoElement | ImageBitmap, w: number, h: number) {
    if (!img) return;
    let imgW = 0;
    let imgH = 0;

    if (img instanceof HTMLVideoElement) {
        imgW = img.videoWidth;
        imgH = img.videoHeight;
    } else {
        imgW = img.width;
        imgH = img.height;
    }

    if (!imgW || !imgH) return;

    // Scale to fit
    const scale = Math.min(w / imgW, h / imgH);
    const targetW = imgW * scale;
    const targetH = imgH * scale;

    const x = (w - targetW) / 2;
    const y = (h - targetH) / 2;

    ctx.drawImage(img, x, y, targetW, targetH);
}
