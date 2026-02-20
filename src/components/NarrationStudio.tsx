import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, RotateCw, Volume2, Mic, Settings, Layers, Wand2, RefreshCw, ChevronDown, ChevronUp, Clock, Timer, Download, Music } from 'lucide-react';


// Compatible interface with page.tsx SceneItem
export interface NarrationScene {
    text: string;
    imagePrompt: string;
    imageUrl: string | null;
    status: string;
    subtitle: string;
    duration: number;
    transition: string;
    audioUrl?: string | null;
    audioDuration?: number;
    isEnabled: boolean;
    isAudioGenerating?: boolean;
    narrationSettings?: {
        voice?: string;
        speed?: number;
        pitch?: number;
        volume?: number;
        prompt?: string;
    };
}

interface NarrationStudioProps {
    scenes: NarrationScene[];
    onUpdate: (updatedScenes: NarrationScene[]) => void;
    onGenerateAudio: (index: number, settings?: any) => Promise<void>;
    globalSettings: {
        voice: string;
        tone: string; // Add Tone
        speed: number;
        pitch: number;
        volume: number;
        customPrompt?: string; // Add Custom Prompt
    };
    onGlobalSettingsChange: (settings: any) => void;
    isPlaying: boolean;
    onPlayPause: () => void;
    onPreviewVoice?: (voiceId: string) => void;
    previewingVoiceId?: string | null;
}

export const VOICE_DATA = {
    gemini: [
        { id: "gemini_fem_01", label: "수아", api_model: "gemini-2.0-flash", params: { voice_name: "Zephyr" }, gender: "Female", style: "Bright", description: "산뜻하고 명랑함", genres: "브이로그, 광고, 인사말" },
        { id: "gemini_fem_02", label: "지은", api_model: "gemini-2.0-flash", params: { voice_name: "Aoede" }, gender: "Female", style: "Breezy", description: "부드럽고 감성적", genres: "에세이, 시 낭독, 힐링 콘텐츠" },
        { id: "gemini_fem_03", label: "민지", api_model: "gemini-2.0-flash", params: { voice_name: "Kore" }, gender: "Female", style: "Firm", description: "지적이고 단단함", genres: "뉴스, 교육, 프레젠테이션" },
        { id: "gemini_male_01", label: "현수", api_model: "gemini-2.0-flash", params: { voice_name: "Charon" }, gender: "Male", style: "Deep", description: "깊고 묵직함", genres: "다큐멘터리, 영화 리뷰" },
        { id: "gemini_male_02", label: "강우", api_model: "gemini-2.0-flash", params: { voice_name: "Fenrir" }, gender: "Male", style: "Excitable", description: "빠르고 힘참", genres: "쇼츠(Shorts), 게임 중계" },
        { id: "gemini_male_03", label: "준호", api_model: "gemini-2.0-flash", params: { voice_name: "Puck" }, gender: "Male", style: "Upbeat", description: "통통 튀는", genres: "예능, 아이들 동화" },
    ],
    neural2: [
        { id: "cloud_fem_01", label: "서연", api_model: "google-cloud-tts", params: { languageCode: "ko-KR", name: "ko-KR-Neural2-A" }, gender: "Female", style: "Standard", description: "가장 또렷하고 정석적인 뉴스 앵커 톤", genres: "뉴스, 안내방송" },
        { id: "cloud_fem_02", label: "다영", api_model: "google-cloud-tts", params: { languageCode: "ko-KR", name: "ko-KR-Neural2-B" }, gender: "Female", style: "Soft", description: "호흡이 편안하고 침착한 낭독 톤", genres: "오디오북, 나레이션" },
        { id: "cloud_male_01", label: "민준", api_model: "google-cloud-tts", params: { languageCode: "ko-KR", name: "ko-KR-Neural2-C" }, gender: "Male", style: "Low", description: "신뢰감을 주는 무게감 있는 목소리", genres: "다큐멘터리, 해설" },
        { id: "cloud_male_02", label: "지훈", api_model: "google-cloud-tts", params: { languageCode: "ko-KR", name: "ko-KR-WaveNet-D" }, gender: "Male", style: "Power", description: "소리에 힘이 있고 울림이 있는 톤", genres: "광고, 선언문" },
    ]
};

const TONE_OPTIONS = ["News", "Documentary", "Story", "Educational", "Promo", "Conversational"];

// Visualizer Helper
const drawVisualizer = (analyser: AnalyserNode, canvas: HTMLCanvasElement, color = '#a855f7') => {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => { };

    let animationId: number;

    const draw = () => {
        animationId = requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);

        ctx.fillStyle = '#0a0a0a'; // Match bg
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.beginPath();

        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
    };

    draw();
    return () => cancelAnimationFrame(animationId);
};

export default function NarrationStudio({
    scenes,
    onUpdate,
    onGenerateAudio,
    globalSettings,
    onGlobalSettingsChange,
    isPlaying,
    onPlayPause,
    onPreviewVoice,
    previewingVoiceId = null
}: NarrationStudioProps) {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [voiceTab, setVoiceTab] = useState<'expressive' | 'professional'>('expressive');
    const textRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

    // Player & Visualizer State
    const [isPlayingAll, setIsPlayingAll] = useState(false);
    const [playingIndex, setPlayingIndex] = useState(-1); // Changed to State for UI reactivity

    // Refs for Audio Logic
    const sourceRef = useRef<AudioBufferSourceNode | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const requestCounterRef = useRef(0);
    const playingIndexRef = useRef<number>(-1); // Keep Ref for async logic consistency

    // Sync state helper
    const updatePlayingIndex = (idx: number) => {
        playingIndexRef.current = idx;
        setPlayingIndex(idx);
    };

    // Initialize Audio Context for Visualizer
    useEffect(() => {
        // init on user interaction usually, but let's try lazy init
    }, []);

    const initAudioContext = () => {
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContext();
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 2048;
            analyserRef.current.connect(audioContextRef.current.destination);
        }
        if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }
        return audioContextRef.current;
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (sourceRef.current) {
                try { sourceRef.current.stop(); } catch (e) { }
                sourceRef.current = null;
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
        };
    }, []);

    // Debug: Test Tone
    const playTestTone = async () => {
        const ctx = audioContextRef.current;
        if (!ctx) return;
        if (ctx.state === 'suspended') await ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 440; // A4
        gain.gain.value = 0.1; // Low volume

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 1); // 1 second beep
        alert("Playing 1s Test Tone (440Hz). If you don't hear this, your system audio or browser tab is muted.");
    };

    const playNext = (currentIndex: number) => {
        const nextIndex = currentIndex + 1;
        if (nextIndex < scenes.length) {
            playSceneAudio(nextIndex, true);
        } else {
            setIsPlayingAll(false);
            updatePlayingIndex(-1);
        }
    };

    const playSceneAudio = async (index: number, autoContinue = false) => {
        if (index >= scenes.length) {
            setIsPlayingAll(false);
            setPlayingIndex(-1);
            return;
        }

        const scene = scenes[index];
        if (!scene || !scene.audioUrl) {
            console.warn("Scene missing audio:", index);
            if (autoContinue) playNext(index);
            return;
        }

        const requestId = ++requestCounterRef.current;

        try {
            // Stop existing
            if (sourceRef.current) {
                try { sourceRef.current.stop(); } catch (e) { }
                sourceRef.current = null;
            }

            const ctx = initAudioContext();
            if (!ctx) return;

            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            console.log(`[Audio] Fetching scene ${index}:`, scene.audioUrl);
            const response = await fetch(scene.audioUrl);
            if (!response.ok) throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);

            const arrayBuffer = await response.arrayBuffer();
            console.log(`[Audio] Decoded length: ${arrayBuffer.byteLength}`);

            if (requestId !== requestCounterRef.current) return;
            if (!isPlayingAll && autoContinue && index !== 0) return;

            const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
            console.log(`[Audio] Buffer Duration: ${audioBuffer.duration}s`);

            if (requestId !== requestCounterRef.current) return;
            if (!isPlayingAll && autoContinue && index !== 0) return;

            // Setup Graph: Source -> Gain -> Analyser (-> Dest)
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;


            const gain = ctx.createGain();
            const vol = scene.narrationSettings?.volume ?? globalSettings.volume ?? 1.0;
            console.log(`[Audio] Volume: ${vol}`);
            gain.gain.value = vol;

            source.connect(gain);
            if (analyserRef.current) {
                // Ensure analyser is connected to output
                try {
                    analyserRef.current.disconnect(); // Clear potential stale connections
                    analyserRef.current.connect(ctx.destination);
                } catch (e) { console.warn("Analyser reconnect failed", e); }

                gain.connect(analyserRef.current);
            } else {
                // Fallback direct connection if analyser failed
                gain.connect(ctx.destination);
            }

            // alert(`Debug: Playing... Vol: ${vol}`);

            setPlayingIndex(index);
            sourceRef.current = source;

            // Start Visualizer
            let cleanupVisualizer = () => { };
            if (canvasRef.current && analyserRef.current) {
                cleanupVisualizer = drawVisualizer(analyserRef.current, canvasRef.current);
            }

            source.onended = () => {
                cleanupVisualizer();
                source.disconnect();
                gain.disconnect();

                if (sourceRef.current === source) { // Only clear if this is the currently playing source
                    sourceRef.current = null;
                    if (autoContinue && playingIndex !== -1) {
                        playNext(index);
                    } else {
                        // End of sequence
                        if (!autoContinue) { // If it was a single play, reset state
                            setIsPlayingAll(false);
                            setPlayingIndex(-1);
                        }
                    }
                }
            };

            source.start(0);

        } catch (e) {
            console.error("Playback failed:", e);
            if (requestId === requestCounterRef.current) { // Only show error if it's for the current request
                alert('Playback Error: ' + (e instanceof Error ? e.message : String(e)));
                setIsPlayingAll(false);
                setPlayingIndex(-1);
            }
        }
    };

    const handleTogglePlayAll = () => {
        if (isPlayingAll) {
            // Stop
            if (sourceRef.current) {
                try { sourceRef.current.stop(); } catch (e) { }
                sourceRef.current = null;
            }
            setIsPlayingAll(false);
            setPlayingIndex(-1);
        } else {
            // Start
            setIsPlayingAll(true);
            playSceneAudio(0, true);
        }
    };


    const handleInsertPause = (index: number) => {
        const textarea = textRefs.current[index];
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = scenes[index].text;
        const newText = text.substring(0, start) + " [pause:0.5s] " + text.substring(end);

        const newScenes = [...scenes];
        newScenes[index].text = newText;
        onUpdate(newScenes);

        // Restore focus and cursor position (approximate)
        setTimeout(() => {
            textarea.focus();
            const newCursor = start + " [pause:0.5s] ".length;
            textarea.setSelectionRange(newCursor, newCursor);
        }, 0);
    };

    const handleSceneSettingChange = (index: number, key: string, value: any) => {
        const newScenes = [...scenes];
        if (!newScenes[index].narrationSettings) {
            newScenes[index].narrationSettings = {};
        }
        // @ts-ignore
        newScenes[index].narrationSettings[key] = value;
        onUpdate(newScenes);
    };

    const toggleOverride = (index: number) => {
        const newScenes = [...scenes];
        if (newScenes[index].narrationSettings) {
            // Toggle OFF: Set to undefined to ensure spread overrides
            newScenes[index].narrationSettings = undefined;
        } else {
            // Toggle ON: Initialize with global defaults
            newScenes[index].narrationSettings = { ...globalSettings, prompt: "" };
        }
        onUpdate(newScenes);

        // Only expand if enabling
        if (newScenes[index].narrationSettings) {
            setExpandedIndex(index);
        }
    };

    // Helper to get voice list based on tab
    const currentVoiceList = voiceTab === 'expressive' ? VOICE_DATA.gemini : VOICE_DATA.neural2;

    return (
        <div className="flex flex-col bg-[#111] text-white min-h-full border border-gray-800 rounded-lg border-none text-left">

            <div className="flex-1 flex flex-row overflow-hidden">
                {/* Left Sidebar: Global Controls */}
                <div className="w-64 flex-shrink-0 bg-[#0a0a0a] p-4 border-r border-gray-800 flex flex-col gap-6 overflow-y-auto custom-scrollbar text-left sticky top-0 max-h-[calc(100vh-3.5rem)] self-start">
                    <div>
                        <h3 className="text-sm font-bold text-gray-400 mb-3 uppercase tracking-wider">Global Voice</h3>

                        {/* Tab Switcher */}
                        <div className="flex bg-gray-900 rounded-lg p-1 mb-3">
                            <button
                                onClick={() => setVoiceTab('expressive')}
                                className={`flex-1 text-[10px] py-1.5 rounded-md font-medium transition-all ${voiceTab === 'expressive' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                🎭 Expressive
                            </button>
                            <button
                                onClick={() => setVoiceTab('professional')}
                                className={`flex-1 text-[10px] py-1.5 rounded-md font-medium transition-all ${voiceTab === 'professional' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                🎙️ Professional
                            </button>
                        </div>

                        <div className="grid gap-2 pr-1">
                            {currentVoiceList.map(opt => (
                                <div
                                    key={opt.id}
                                    onClick={() => onGlobalSettingsChange({
                                        ...globalSettings,
                                        voice: opt.id,
                                    })}
                                    role="button"
                                    tabIndex={0}
                                    className={`text-left px-3 py-3 rounded-md text-sm border flex flex-col gap-1 transition-all cursor-pointer ${globalSettings.voice === opt.id
                                        ? voiceTab === 'expressive' ? 'bg-blue-900/30 border-blue-500 text-blue-100' : 'bg-green-900/30 border-green-500 text-green-100'
                                        : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600 hover:bg-gray-800'
                                        }`}
                                >
                                    <div className="flex justify-between items-start w-full gap-2">
                                        <div className="flex items-center gap-2 flex-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onPreviewVoice && onPreviewVoice(opt.id);
                                                }}
                                                className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
                                                title="Preview Voice"
                                            >
                                                {previewingVoiceId === opt.id ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                                            </button>
                                            <span className="font-bold text-sm tracking-wide leading-tight">
                                                {opt.label} <span className="font-normal opacity-80 text-xs">({(opt as any).description})</span>
                                            </span>
                                        </div>
                                        <span className="text-[10px] uppercase opacity-70 border border-current px-1 rounded flex-shrink-0 mt-0.5">{opt.gender === 'Female' ? 'F' : 'M'}</span>
                                    </div>

                                    {(opt as any).genres && (
                                        <div className="text-[11px] opacity-60 mt-0.5">
                                            {(opt as any).genres}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>



                    {voiceTab === 'expressive' && (
                        <div className="animate-in fade-in duration-300 space-y-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider">Style Presets</h3>
                                <div className="flex flex-wrap gap-2">
                                    {TONE_OPTIONS.map(opt => (
                                        <button
                                            key={opt}
                                            onClick={() => onGlobalSettingsChange({
                                                ...globalSettings,
                                                tone: globalSettings.tone === opt ? '' : opt // Toggle off if clicked again
                                            })}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${globalSettings.tone === opt
                                                ? 'bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-900/50'
                                                : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-200 hover:bg-gray-700'
                                                }`}
                                        >
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <h3 className="text-sm font-bold text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                                    <Mic className="w-3 h-3" /> Custom Prompt
                                </h3>
                                <textarea
                                    value={globalSettings.customPrompt || ''}
                                    onChange={(e) => onGlobalSettingsChange({ ...globalSettings, customPrompt: e.target.value })}
                                    placeholder="E.g. Read like a bedtime story, urgent news report..."
                                    className="w-full bg-gray-900 border border-gray-800 rounded-md p-3 text-sm text-gray-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder-gray-600 resize-none h-20"
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Global Mix</h3>

                        {/* Speed Slider */}
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Speed</span>
                                <span className="text-blue-400">{globalSettings.speed}x</span>
                            </div>
                            <input
                                type="range" min="0.5" max="2.0" step="0.1"
                                value={globalSettings.speed}
                                onChange={(e) => onGlobalSettingsChange({ ...globalSettings, speed: parseFloat(e.target.value) })}
                                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>

                        {/* Pitch Slider */}
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Pitch</span>
                                <span className={`text-blue-400`}>{globalSettings.pitch > 0 ? '+' : ''}{globalSettings.pitch}st</span>
                            </div>
                            <input
                                type="range" min="-12" max="12" step="1"
                                value={globalSettings.pitch}
                                onChange={(e) => onGlobalSettingsChange({ ...globalSettings, pitch: parseInt(e.target.value) })}
                                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                        </div>

                        {/* Volume Slider */}
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-400">Volume</span>
                                <span className="text-blue-400">{(globalSettings.volume * 100).toFixed(0)}%</span>
                            </div>
                            <input
                                type="range" min="0" max="2" step="0.1"
                                value={globalSettings.volume}
                                onChange={(e) => onGlobalSettingsChange({ ...globalSettings, volume: parseFloat(e.target.value) })}
                                className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Main Content: Scene List */}
                <div className="flex-1 flex flex-col bg-[#111] overflow-hidden text-left">
                    {/* Header */}
                    <div className="h-14 border-b border-gray-800 flex items-center justify-between px-6 bg-[#161616] shrink-0">
                        <h2 className="font-semibold flex items-center gap-2">
                            <Layers className="w-4 h-4 text-gray-400" />
                            Narration Blocks
                            <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-400">{scenes.length}</span>
                        </h2>
                        <div className="flex items-center gap-2">
                            {/* Generate All Button */}
                            <button
                                onClick={async () => {
                                    if (confirm(`Generate audio for all ${scenes.length} blocks? This may take time.`)) {
                                        for (let i = 0; i < scenes.length; i++) {
                                            const settings = scenes[i].narrationSettings;
                                            await onGenerateAudio(i, settings);
                                        }
                                        alert("All audio generated!");
                                    }
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow-sm transition-colors"
                            >
                                <Wand2 className="w-3.5 h-3.5" />
                                Generate All
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 p-4 space-y-3 pb-10">
                        {scenes.map((scene, idx) => {
                            const settings = scene.narrationSettings || {};
                            const hasOverrides = scene.narrationSettings && Object.keys(scene.narrationSettings).length > 0;

                            return (
                                <div key={idx} className={`relative bg-[#1a1a1a] border rounded-lg transition-all overflow-hidden ${scene.isAudioGenerating
                                        ? 'border-cyan-500/60 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30'
                                        : expandedIndex === idx
                                            ? 'border-gray-800 ring-1 ring-blue-500/50'
                                            : 'border-gray-800 hover:border-gray-700'
                                    }`}>

                                    {/* Audio Generating Overlay */}
                                    {scene.isAudioGenerating && (
                                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] gap-2">
                                            {/* Sound Wave Bars */}
                                            <div className="flex items-end gap-1 h-8">
                                                {[0.4, 0.7, 1.0, 0.8, 0.5, 0.9, 0.6, 1.0, 0.7, 0.4].map((h, i) => (
                                                    <div
                                                        key={i}
                                                        className="w-1 rounded-full bg-cyan-400"
                                                        style={{
                                                            height: `${h * 100}%`,
                                                            animation: `narration-bar 0.8s ease-in-out ${i * 0.08}s infinite alternate`,
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <span className="text-xs font-bold text-cyan-300 tracking-widest uppercase animate-pulse">음성 생성 중...</span>
                                        </div>
                                    )}

                                    {/* Summary Row */}
                                    <div className="p-3 flex items-center gap-4 cursor-pointer" onClick={() => toggleOverride(idx)}>
                                        <div className="w-8 h-8 rounded bg-gray-800 flex items-center justify-center text-xs font-mono text-gray-500">
                                            {idx + 1}
                                        </div>

                                        {/* Thumbnail */}
                                        <div className="w-16 h-16 bg-gray-800 rounded overflow-hidden flex-shrink-0">
                                            {scene.imageUrl ? (
                                                /* eslint-disable-next-line @next/next/no-img-element */
                                                <img src={scene.imageUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-600">
                                                    <Layers className="w-4 h-4" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Text Preview (Editable) */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onMouseDown={(e) => { e.preventDefault(); handleInsertPause(idx); }}
                                                    className="flex items-center gap-1 text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-0.5 rounded transition-colors"
                                                    title="Insert 0.5s Pause"
                                                >
                                                    <Timer className="w-3 h-3" />
                                                    Pause 0.5s
                                                </button>
                                            </div>
                                            <textarea
                                                ref={el => { textRefs.current[idx] = el; }}
                                                value={scene.text}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => {
                                                    const newScenes = [...scenes];
                                                    newScenes[idx].text = e.target.value;
                                                    // Reset audio if text changes? Maybe optional, but prudent.
                                                    // newScenes[idx].audioUrl = null; 
                                                    onUpdate(newScenes);
                                                }}
                                                className="w-full bg-transparent border border-transparent hover:border-gray-700 focus:border-blue-500 rounded p-1 text-sm text-gray-200 resize-none outline-none transition-colors"
                                                rows={2}
                                            />
                                            <div className="flex items-center gap-2 mt-1 px-1">
                                                {hasOverrides ? (
                                                    <span className="text-[10px] uppercase bg-blue-900/30 text-blue-400 px-1.5 rounded-sm">Custom</span>
                                                ) : (
                                                    <span className="text-[10px] uppercase bg-gray-800 text-gray-500 px-1.5 rounded-sm">Global</span>
                                                )}
                                                <span className="text-xs text-gray-500">{(scene.duration || 0).toFixed(1)}s</span>
                                                {settings.pitch && settings.pitch !== 0 && (
                                                    <span className="text-xs text-purple-400 flex items-center gap-0.5">
                                                        <Wand2 className="w-3 h-3" /> {settings.pitch > 0 ? '+' : ''}{settings.pitch}st
                                                    </span>
                                                )}
                                                {/* Individual Play Button */}
                                                {/* Individual Play Button */}
                                                {scene.audioUrl && (
                                                    <div className="flex items-center gap-1.5 ml-1">
                                                        {playingIndex === idx && isPlayingAll && (
                                                            <span className="text-[10px] text-green-400 font-mono animate-pulse">
                                                                {idx + 1}/{scenes.length}
                                                            </span>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // Toggle logic: If playing this one, stop. Else play.
                                                                if (playingIndex === idx && isPlayingAll) {
                                                                    setIsPlayingAll(false);
                                                                    setPlayingIndex(-1); // Stop
                                                                    if (sourceRef.current) {
                                                                        try { sourceRef.current.stop(); } catch (e) { }
                                                                        sourceRef.current = null;
                                                                    }
                                                                } else {
                                                                    setIsPlayingAll(true); // Treat as "playing all" logic but start here? Or separate mode?
                                                                    // User wants progress indicator, implies sequence. 
                                                                    // If we want just individual play, we should handle it.
                                                                    // Let's assume user wants to start sequence from here OR just play this one.
                                                                    // Let's force `isPlayingAll = true` for consistent UI.
                                                                    playSceneAudio(idx, false);
                                                                }
                                                            }}
                                                            className={`p-1 rounded-full transition-colors ${playingIndex === idx && isPlayingAll ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-gray-800 text-gray-400 hover:text-green-400'}`}
                                                            title={playingIndex === idx && isPlayingAll ? "Stop" : "Play this block"}
                                                        >
                                                            {playingIndex === idx && isPlayingAll ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col items-center gap-1">
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const btn = e.currentTarget;
                                                    btn.classList.add('animate-spin');
                                                    try {
                                                        await onGenerateAudio(idx, scene.narrationSettings);
                                                    } catch (err) {
                                                        alert("Generation failed");
                                                    } finally {
                                                        btn.classList.remove('animate-spin');
                                                    }
                                                }}
                                                className="p-1.5 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors"
                                                title="Regenerate Audio"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedIndex(expandedIndex === idx ? null : idx);
                                                }}
                                                className={`p-1.5 rounded-full transition-colors ${expandedIndex === idx || hasOverrides ? 'text-blue-400 bg-blue-900/20' : 'text-gray-600 hover:text-gray-400 hover:bg-gray-800'}`}
                                                title="Settings & Overrides"
                                            >
                                                <Settings className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Extended Settings Panel */}
                                    {expandedIndex === idx && (
                                        <div className="border-t border-gray-800 p-4 bg-[#151515] animate-in slide-in-from-top-2 duration-200">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wide">Scene Settings</h4>

                                                {/* Explicit Toggle Switch */}
                                                <div className="flex items-center gap-3">
                                                    <span className={`text-xs font-bold ${hasOverrides ? 'text-white' : 'text-gray-500'}`}>
                                                        {hasOverrides ? "Custom Enabled" : "Use Global Settings"}
                                                    </span>
                                                    <button
                                                        onClick={() => toggleOverride(idx)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#1a1a1a] ${hasOverrides ? 'bg-blue-600' : 'bg-gray-700'
                                                            }`}
                                                    >
                                                        <span
                                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hasOverrides ? 'translate-x-6' : 'translate-x-1'
                                                                }`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>

                                            {hasOverrides ? (
                                                <div className="grid grid-cols-2 gap-6">
                                                    {/* Left: Voice & Tone */}
                                                    <div className="space-y-4">
                                                        <div>
                                                            <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Voice Override</label>

                                                            {/* Mini Tabs for Override */}
                                                            <div className="flex bg-gray-900/50 rounded p-0.5 mb-2">
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setVoiceTab('expressive'); }}
                                                                    className={`flex-1 text-[9px] py-1 rounded font-medium ${voiceTab === 'expressive' ? 'bg-blue-600/80 text-white' : 'text-gray-500'}`}
                                                                >
                                                                    Expressive
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setVoiceTab('professional'); }}
                                                                    className={`flex-1 text-[9px] py-1 rounded font-medium ${voiceTab === 'professional' ? 'bg-green-600/80 text-white' : 'text-gray-500'}`}
                                                                >
                                                                    Professional
                                                                </button>
                                                            </div>

                                                            <select
                                                                className="w-full bg-[#111] border border-gray-700 rounded p-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
                                                                value={settings.voice || ""}
                                                                onChange={(e) => handleSceneSettingChange(idx, 'voice', e.target.value)}
                                                            >
                                                                <option value="">(Global Default)</option>
                                                                {currentVoiceList.map(opt => (
                                                                    <option key={opt.id} value={opt.id}>{opt.label} ({(opt as any).description})</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        {voiceTab === 'expressive' && (
                                                            <div className="animate-in fade-in duration-200">
                                                                <label className="text-xs font-semibold text-gray-500 uppercase mb-2 block">Acting Prompt</label>
                                                                <textarea
                                                                    className="w-full bg-[#111] border border-gray-700 rounded p-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500 h-20 resize-none"
                                                                    placeholder="Ex: Whisper significantly, pause for effect..."
                                                                    value={settings.prompt || ""}
                                                                    onChange={(e) => handleSceneSettingChange(idx, 'prompt', e.target.value)}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Right: Post-Process */}
                                                    <div className="space-y-4">
                                                        <div>
                                                            <div className="flex justify-between text-xs mb-1">
                                                                <span className="text-gray-500 uppercase font-semibold">Local Speed</span>
                                                                <span className="text-blue-400">{settings.speed || globalSettings.speed}x</span>
                                                            </div>
                                                            <input
                                                                type="range" min="0.5" max="2.0" step="0.1"
                                                                value={settings.speed !== undefined ? settings.speed : globalSettings.speed}
                                                                onChange={(e) => handleSceneSettingChange(idx, 'speed', parseFloat(e.target.value))}
                                                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="flex justify-between text-xs mb-1">
                                                                <span className="text-gray-500 uppercase font-semibold">Local Pitch</span>
                                                                <span className="text-purple-400">{(settings.pitch ?? 0) > 0 ? '+' : ''}{settings.pitch ?? 0}st</span>
                                                            </div>
                                                            <input
                                                                type="range" min="-12" max="12" step="1"
                                                                value={settings.pitch !== undefined ? settings.pitch : 0}
                                                                onChange={(e) => handleSceneSettingChange(idx, 'pitch', parseInt(e.target.value))}
                                                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-8 text-center text-gray-500 bg-[#111] rounded border border-gray-800 border-dashed">
                                                    <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                    <p className="text-sm">Using Global Settings</p>
                                                    <p className="text-xs text-gray-600 mt-1">Enable custom settings to override voice, speed, or pitch for this scene.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Bottom Panel: Timeline Player */}
            <div className="h-40 bg-[#0a0a0a] border-t border-gray-800 shrink-0 p-4 flex flex-col gap-2 z-10 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] sticky bottom-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">[C] TIMELINE PLAYER</div>
                        {isPlayingAll && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                    </div>
                    <div className="text-[10px] font-mono text-gray-500">
                        Total: {Math.floor(scenes.reduce((acc, s) => acc + (s.duration || 0), 0))}s
                    </div>
                </div>

                <div className="flex items-center gap-4 flex-1">
                    {/* Controls */}
                    <div className="flex items-center gap-2 bg-gray-900/50 p-1.5 rounded-lg border border-white/5">
                        <button
                            onClick={() => {
                                // Prev
                                if (playingIndex > 0) playSceneAudio(playingIndex - 1, true);
                            }}
                            className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                        >
                            <ChevronDown className="w-4 h-4 rotate-90" />
                        </button>
                        <button
                            onClick={handleTogglePlayAll}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded text-xs font-bold transition-all min-w-[100px] justify-center ${isPlayingAll
                                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                                : "bg-white/10 text-white hover:bg-white/20 border border-white/10"
                                }`}
                        >
                            {isPlayingAll ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-green-400" />}
                            {isPlayingAll ? "Stop" : "Play All"}
                        </button>
                        <button
                            onClick={() => {
                                // Next
                                if (playingIndex < scenes.length - 1) playSceneAudio(playingIndex + 1, true);
                            }}
                            className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                        >
                            <ChevronUp className="w-4 h-4 rotate-90" />
                        </button>
                    </div>

                    {/* Playback Status (Replaces Visualizer) */}
                    <div className="flex-1 h-full bg-[#111] rounded border-b border-white/10 relative overflow-hidden group">
                        <canvas
                            ref={canvasRef}
                            width={800}
                            height={80}
                            className="w-full h-full object-cover"
                        />
                        {!isPlayingAll && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-full h-px bg-gray-800" />
                            </div>
                        )}
                        {isPlayingAll && (
                            <div className="absolute top-2 right-2 text-[10px] font-mono text-green-500 bg-green-500/10 px-1 rounded animate-pulse">
                                LIVE INPUT {playingIndex >= 0 ? `#${playingIndex + 1}` : ''}
                            </div>
                        )}
                    </div>

                    {/* Debug Tone */}
                    <button
                        onClick={playTestTone}
                        className="px-2 py-1 bg-gray-800 text-[10px] text-gray-400 rounded hover:bg-gray-700"
                        title="Play Test Tone to verify speakers"
                    >
                        🔔 Tone
                    </button>

                    {/* Export Actions (Mini) */}
                    <div className="flex flex-col gap-1 justify-center border-l border-white/5 pl-4">
                        <button
                            onClick={async () => {
                                // Merge All Logic (Client-Side)
                                // Copy-paste existing merge logic
                                const audioScenes = scenes.filter(s => s.audioUrl);
                                if (audioScenes.length === 0) {
                                    alert("No audio generated to merge.");
                                    return;
                                }

                                try {
                                    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                                    const audioBuffers: AudioBuffer[] = [];

                                    // 1. Fetch and Decode all audio files
                                    for (const scene of audioScenes) {
                                        const response = await fetch(scene.audioUrl!);
                                        const arrayBuffer = await response.arrayBuffer();
                                        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                                        audioBuffers.push(audioBuffer);
                                    }

                                    // 2. Calculate total length
                                    const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.length, 0);
                                    const outputBuffer = audioContext.createBuffer(1, totalLength, audioBuffers[0].sampleRate);

                                    // 3. Merge
                                    let offset = 0;
                                    const outputData = outputBuffer.getChannelData(0);
                                    for (const buf of audioBuffers) {
                                        const inputData = buf.getChannelData(0);
                                        outputData.set(inputData, offset);
                                        offset += buf.length;
                                    }

                                    // 4. Encode to WAV (Simple implementation)
                                    // Function to convert AudioBuffer to WAV Blob
                                    const bufferToWav = (buffer: AudioBuffer) => {
                                        const numOfChan = buffer.numberOfChannels;
                                        const length = buffer.length * numOfChan * 2 + 44;
                                        const bufferArray = new ArrayBuffer(length);
                                        const view = new DataView(bufferArray);
                                        const channels = [];
                                        let i;
                                        let sample;
                                        let pos = 0;
                                        let offset = 0;

                                        // write WAVE header
                                        setUint32(0x46464952);                         // "RIFF"
                                        setUint32(length - 8);                         // file length - 8
                                        setUint32(0x45564157);                         // "WAVE"

                                        setUint32(0x20746d66);                         // "fmt " chunk
                                        setUint32(16);                                 // length = 16
                                        setUint16(1);                                  // PCM (uncompressed)
                                        setUint16(numOfChan);
                                        setUint32(buffer.sampleRate);
                                        setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
                                        setUint16(numOfChan * 2);                      // block-align
                                        setUint16(16);                                 // 16-bit (hardcoded)

                                        setUint32(0x61746164);                         // "data" - chunk
                                        setUint32(length - pos - 4);                   // chunk length

                                        // write interleaved data
                                        for (i = 0; i < buffer.numberOfChannels; i++)
                                            channels.push(buffer.getChannelData(i));

                                        while (pos < buffer.length) {
                                            for (i = 0; i < numOfChan; i++) {             // interleave channels
                                                sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
                                                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
                                                view.setInt16(44 + offset, sample, true);          // write 16-bit sample
                                                offset += 2;
                                            }
                                            pos++;
                                        }

                                        return new Blob([view], { type: 'audio/wav' });

                                        function setUint16(data: any) {
                                            view.setUint16(pos, data, true);
                                            pos += 2;
                                        }

                                        function setUint32(data: any) {
                                            view.setUint32(pos, data, true);
                                            pos += 4;
                                        }
                                    };

                                    const wavBlob = bufferToWav(outputBuffer);
                                    const url = window.URL.createObjectURL(wavBlob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = "full_narration_merged.wav";
                                    a.click();

                                } catch (e) {
                                    console.error("Merge error:", e);
                                    alert("Failed to merge audio. See console for details.");
                                }
                            }}
                            className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1.5 hover:bg-white/5 px-2 py-1 rounded transition-colors"
                        >
                            <Music className="w-3 h-3" /> Merge WAV
                        </button>
                        <button
                            onClick={async () => {
                                // Split Export (Server Zip)
                                const files = scenes
                                    .filter(s => s.audioUrl)
                                    .map((s, i) => ({ url: s.audioUrl!, name: `scene_${i + 1}_${s.text.slice(0, 10).replace(/\s/g, '_')}.wav` }));

                                if (files.length === 0) {
                                    alert("No audio generated to export.");
                                    return;
                                }

                                try {
                                    const res = await fetch('/api/export-audio/zip', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ files })
                                    });

                                    if (res.ok) {
                                        const blob = await res.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = "narration_assets.zip";
                                        a.click();
                                    } else {
                                        alert("Export failed");
                                    }
                                } catch (e) {
                                    console.error(e);
                                    alert("Export error");
                                }
                            }}
                            className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1.5 hover:bg-white/5 px-2 py-1 rounded transition-colors"
                        >
                            <Download className="w-3 h-3" /> Export ZIP
                        </button>
                    </div>
                </div>

            </div >
        </div >
    );
}
