"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import clsx from "clsx";
import { Play, Pause, RotateCw, RotateCcw, X, FileVideo, Wand2, Upload, Loader2, CheckCircle, AlertCircle, Image as ImageIcon, Sparkles, Video as VideoIcon, ThumbsUp, Pencil, Film, Clock, Globe, Calendar, FileText, Music, Settings, MessageSquare, Heart, RefreshCw, Save, Trash2, FolderOpen, ChevronRight, ChevronDown, Info, Palette, LayoutTemplate, QrCode, List, Plus, Copy, ShieldCheck, Square, History as HistoryIcon, ArrowUp, ArrowDown } from 'lucide-react';
import WebGPURenderer, { MediaAsset } from "@/components/WebGPURenderer";
import NarrationStudio, { VOICE_DATA } from "@/components/NarrationStudio";
import SNSUploadModal from "@/components/SNSUploadModal";
import SNSManagerModal from "@/components/SNSManagerModal";
import ImageCropModal from "@/components/ImageCropModal";
import QRCode from 'qrcode';

const NO_OP = () => { };

interface Scene {
  imageUrl: string;
  text: string;
  audioUrl?: string | null;
}

interface ProjectHistoryItem {
  id: string;
  name: string;
  createdAt: string;
  timestamp?: string;
  thumbnailUrl?: string;
  // Add other fields as needed based on usage
}

interface ScrapedPost {
  title: string;
  link: string;
  date: string;
  content: string;
  images: string[];
  files?: { name: string; url: string }[];
}


interface AnalysisResult {
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

interface SceneItem {
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

const ASPECT_RATIOS = [
  { label: "16:9", width: 1920, height: 1080, description: "YouTube / TV" },
  { label: "9:16", width: 1080, height: 1920, description: "Shorts / TikTok" },
  { label: "1:1", width: 1080, height: 1080, description: "Instagram Feed" },
  { label: "4:5", width: 1080, height: 1350, description: "Facebook / Insta Portrait" },
] as const;

const VISUAL_STYLES = [
  { id: "Photorealistic", label: "Photorealistic", image: "/images/styles/photorealistic.png", description: "Real world photo style" },
  { id: "3D Isometric", label: "3D Isometric", image: "/images/styles/3d_render.png", description: "Cute & Clean 3D" },
  { id: "Flat Vector", label: "Flat Vector", image: "/images/styles/vector_art.png", description: "Clean Graphic Style" },
  { id: "Hand-Drawn", label: "Hand-Drawn", image: "/images/styles/watercolor.png", description: "Artistic Sketch Style" },
] as const;

const COMPOSITION_STYLES = [
  { id: "Wide", label: "Wide / Text Space", description: "Subject on right, empty space on left" },
  { id: "Center", label: "Center Focus", description: "Subject in center, symmetrical" },
  { id: "Knolling", label: "Knolling", description: "Objects arranged neatly at 90 degrees" },
  { id: "Macro", label: "Macro / Detail", description: "Extreme close-up, depth of field" },
] as const;

const MOOD_STYLES = [
  { id: "Trustworthy", label: "Trustworthy", description: "Blue tones, professional, bright" },
  { id: "Urgent", label: "Urgent / Alert", description: "High contrast, red/yellow accents" },
  { id: "Eco", label: "Eco & Healthy", description: "Greenery, soft sunlight, organic" },
  { id: "Energetic", label: "Energetic", description: "Vibrant colors, dynamic motion" },
] as const;

const INTERPRETATION_STYLES = [
  { id: "Literal", label: "Literal", description: "Describe text as-is" },
  { id: "Metaphorical", label: "Metaphorical", description: "Visual metaphors & symbols" },
  { id: "Abstract", label: "Abstract", description: "Flows, patterns, and shapes" },
] as const;

const CAPTION_PRESETS = [
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
      animation: 'none', // Grain effect is video filter, text is clean but sepia
      layout: { wordsPerLine: 0, safeZonePadding: true, verticalPosition: 'bottom' }
    }
  },
  {
    id: 'high_contrast_bw',
    label: '⚫ High Contrast B&W',
    style: {
      fontSize: 95,
      colors: { activeFill: '#FFFFFF', baseFill: '#000000', stroke: '#FFFFFF', strokeThickness: 2 }, // Inverted for impact? Or White Text on Black Stroke
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
      colors: { activeFill: '#000000', baseFill: '#FFFFFF', stroke: '#E5E5E5', strokeThickness: 2 }, // Clean look
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
      colors: { activeFill: '#3E2723', baseFill: '#FFF3E0', stroke: '#5D4037', strokeThickness: 3 }, // Dark Brown on Cream
      animation: 'none',
      layout: { wordsPerLine: 0, safeZonePadding: true, verticalPosition: 'bottom' }
    }
  },
  {
    id: 'glassmorphism',
    label: '🧊 Glassmorphism',
    style: {
      fontSize: 80,
      colors: { activeFill: '#FFFFFF', baseFill: 'rgba(255,255,255,0.7)', stroke: '#FFFFFF', strokeThickness: 1 }, // Semi-transparent base simulated
      animation: 'none',
      layout: { wordsPerLine: 0, safeZonePadding: true, verticalPosition: 'middle' }
    }
  },
  {
    id: 'pop_art',
    label: '💥 Pop Art',
    style: {
      fontSize: 100,
      colors: { activeFill: '#FFFF00', baseFill: '#FF0000', stroke: '#000000', strokeThickness: 8 }, // Comic book style
      animation: 'pop',
      layout: { wordsPerLine: 1, safeZonePadding: true, verticalPosition: 'middle' }
    }
  }
] as const;

export default function Home() {
  const [url, setUrl] = useState("https://www.seocho.go.kr/site/seocho/ex/bbs/List.do?cbIdx=57");
  const [date, setDate] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<{ type: 'text' | 'image' | 'prompt', content: string }[]>([]);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const [scrapedPost, setScrapedPost] = useState<ScrapedPost | null>(null);
  const [narrationLength, setNarrationLength] = useState<'Short' | 'Medium' | 'Long'>('Medium'); // New State
  const [postList, setPostList] = useState<ScrapedPost[]>([]);
  const [nextPageUrl, setNextPageUrl] = useState<string | null>(null);



  // Site Management State
  // Site Management State
  const [sites, setSites] = useState<{ id?: string, name: string, url: string }[]>([]);


  // Filtering State
  const [subtitleSyncShift, setSubtitleSyncShift] = useState<number>(0);

  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterTitle, setFilterTitle] = useState("");
  const [filterHideExisting, setFilterHideExisting] = useState(false);

  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [sceneItems, setSceneItems] = useState<SceneItem[]>([]);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [showRenderer, setShowRenderer] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<'detail' | 'summary' | 'promo' | 'infographic' | 'album'>('detail');
  const [videoPurpose, setVideoPurpose] = useState<'PR' | 'Education' | 'Notice' | 'Event'>('PR');
  const [sceneCount, setSceneCount] = useState<number | 'AUTO'>('AUTO');

  // Consistency & Style State
  const [voiceStyle, setVoiceStyle] = useState("Female - Calm");
  const [narrationTone, setNarrationTone] = useState("News");
  const [customVoicePrompt, setCustomVoicePrompt] = useState(""); // Custom Prompt State
  const [visualStyle, setVisualStyle] = useState("Photorealistic");
  const [imageComposition, setImageComposition] = useState("Wide");
  const [imageMood, setImageMood] = useState("Trustworthy");
  const [imageInterpretation, setImageInterpretation] = useState("Literal");
  const [dominantColors, setDominantColors] = useState<string[]>([]);

  // Video Configuration State
  const [totalDuration, setTotalDuration] = useState(0);
  const [isRendering, setIsRendering] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 1 });
  const exportStartTimeRef = useRef<number>(0);

  // Audio State
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioVolume, setAudioVolume] = useState(0.5); // Default 50%
  const [bgmFadeIn, setBgmFadeIn] = useState(2); // seconds
  const [bgmFadeOut, setBgmFadeOut] = useState(3); // seconds
  const [bgmDucking, setBgmDucking] = useState(0.3); // reduce to 30% during narration
  const [isPreviewingBGM, setIsPreviewingBGM] = useState(false);
  const bgmPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Scene Template state
  const [savedTemplates, setSavedTemplates] = useState<{ name: string; scenes: SceneItem[] }[]>([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);

  // Load templates from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('scene-templates');
      if (stored) setSavedTemplates(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  const handleSaveTemplate = () => {
    const name = prompt('템플릿 이름을 입력하세요:');
    if (!name || !name.trim()) return;
    const template = {
      name: name.trim(),
      scenes: sceneItems.map(s => ({
        ...s,
        imageUrl: null, // Don't store blob URLs
        status: 'pending' as const,
        audioUrl: null,
        audioDuration: undefined,
      }))
    };
    const updated = [...savedTemplates.filter(t => t.name !== name.trim()), template];
    setSavedTemplates(updated);
    localStorage.setItem('scene-templates', JSON.stringify(updated));
  };

  const handleLoadTemplate = (idx: number) => {
    const template = savedTemplates[idx];
    if (!template) return;
    if (!confirm(`"${template.name}" 템플릿을 불러오시겠습니까? 현재 씬이 교체됩니다.`)) return;
    setSceneItems(template.scenes.map(s => ({ ...s })));
    setShowTemplateMenu(false);
  };

  const handleDeleteTemplate = (idx: number) => {
    if (!confirm(`"${savedTemplates[idx].name}" 템플릿을 삭제하시겠습니까?`)) return;
    const updated = savedTemplates.filter((_, i) => i !== idx);
    setSavedTemplates(updated);
    localStorage.setItem('scene-templates', JSON.stringify(updated));
  };

  // Narration State
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [isNarrationReview, setIsNarrationReview] = useState(false);

  const [narrationSpeed, setNarrationSpeed] = useState(1.0); // Playback Speed (0.5 - 2.0)
  const [narrationPitch, setNarrationPitch] = useState(0); // Pitch Shift (-12 to +12)
  const [narrationVolume, setNarrationVolume] = useState(1.0); // Volume (0.0 - 2.0)
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewCacheRef = useRef<Map<string, string>>(new Map()); // Client-side cache for preview URLs

  const [subtitleSpeed, setSubtitleSpeed] = useState(1.0); // KEEPING FOR COMPATIBILITY IF NEEDED, BUT LIKELY NOT USED NOW
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<{ id: string; name: string }[]>([]);
  const [showProjectList, setShowProjectList] = useState(false);
  const [projectHistory, setProjectHistory] = useState<ProjectHistoryItem[]>([]);
  const [historyProjectId, setHistoryProjectId] = useState<string | null>(null);
  const [expandedProjectName, setExpandedProjectName] = useState<string | null>(null);

  // Visual Simulation Mode
  const [isVisualSimulation, setIsVisualSimulation] = useState(false);
  const [allowImageVariation, setAllowImageVariation] = useState(false);

  const [isSiteModalOpen, setIsSiteModalOpen] = useState(false);
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteUrl, setNewSiteUrl] = useState("");
  const [showSaveOptions, setShowSaveOptions] = useState(false);

  // Dynamic Caption Configuration
  const [captionConfig, setCaptionConfig] = useState<CaptionConfig>({
    enabled: true,
    mode: 'standard',
    dynamicStyle: {
      preset: 'yellow_punch',
      fontFamily: 'Pretendard', // Default valid font
      fontSize: 90,
      opacity: 1.0,
      intensity: 1.0,
      colors: {
        activeFill: '#FFD700', // Gold
        baseFill: '#FFFFFF',   // White
        stroke: '#000000',     // Black Stroke
        strokeThickness: 8
      },
      animation: 'pop',
      layout: {
        wordsPerLine: 2,
        safeZonePadding: true,
        verticalPosition: 'middle',
      }
    }
  });

  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editSiteName, setEditSiteName] = useState("");
  const [editSiteUrl, setEditSiteUrl] = useState("");


  const [selectedAspectRatio, setSelectedAspectRatio] = useState("16:9");
  const [showSNSModal, setShowSNSModal] = useState(false);
  const [saveMemo, setSaveMemo] = useState("");
  const [showSNSManager, setShowSNSManager] = useState(false);
  const selectedAspect = ASPECT_RATIOS.find(r => r.label === selectedAspectRatio) || ASPECT_RATIOS[0];


  // Load sites from Airtable on mount
  useEffect(() => {
    fetch('/api/sites')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSites(data);
        } else {
          console.error("Failed to load sites:", data.error);
          alert("사이트 목록을 불러오지 못했습니다: " + (data.error || "Unknown Error"));
        }
      })
      .catch(err => {
        console.error("Failed to load sites:", err);
        alert("사이트 API 연결 실패");
      });
  }, []);

  const handleAddSite = async () => {
    if (!newSiteName.trim() || !newSiteUrl.trim()) return;

    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSiteName.trim(), url: newSiteUrl.trim() })
      });
      const newSite = await res.json();
      if (newSite.error) throw new Error(newSite.error);

      setSites(prev => [newSite, ...prev]);
      setNewSiteName("");
      setNewSiteUrl("");
      setIsAddingSite(false);
    } catch (e: any) {
      console.error("Failed to add site", e);
      alert("사이트 등록 실패: " + e.message);
    }
  };

  const handleDeleteSite = async (id: string) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/sites?id=${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setSites(prev => prev.filter(s => s.id !== id));
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      console.error("Failed to delete site", e);
      alert("사이트 삭제 실패: " + e.message);
    }
  };

  const handleEditClick = (site: { id: string; name: string; url: string }) => {
    setEditingSiteId(site.id);
    setEditSiteName(site.name);
    setEditSiteUrl(site.url);
  };

  const handleUpdateSite = async () => {
    if (!editingSiteId || !editSiteName.trim() || !editSiteUrl.trim()) return;

    try {
      const res = await fetch('/api/sites', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingSiteId, name: editSiteName.trim(), url: editSiteUrl.trim() })
      });
      const updatedSite = await res.json();
      if (updatedSite.error) throw new Error(updatedSite.error);

      setSites(prev => prev.map(s => s.id === editingSiteId ? updatedSite : s));
      setEditingSiteId(null);
      setEditSiteName("");
      setEditSiteUrl("");
    } catch (e: any) {
      console.error("Failed to update site", e);
      alert("사이트 수정 실패: " + e.message);
    }
  };
  // Audio Simulation Mode
  const [isAudioSimulation, setIsAudioSimulation] = useState(false);
  // Image Preview Modal State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // AI Disclosure & Watermark State
  const [expandedSection, setExpandedSection] = useState<string | null>('format'); // Changed to single string for consistency, assuming 'format' is the default
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  // AI Disclosure & Watermark State (Restored)
  const [aiDisclosureEnabled, setAiDisclosureEnabled] = useState(true);
  const [watermarkUrl, setWatermarkUrl] = useState<string | null>(null);
  const [isUploadingWatermark, setIsUploadingWatermark] = useState(false);

  const [previewQuality, setPreviewQuality] = useState<'high' | 'low'>('low'); // Default to Performance mode for preview

  // SNS Platform Selection
  type SNSPlatform = 'youtube' | 'youtube4k' | 'instagram' | 'tiktok' | 'facebook' | 'custom';
  const [selectedPlatform, setSelectedPlatform] = useState<SNSPlatform>('youtube');

  // Platform configurations
  const platformConfigs = {
    youtube: { width: 1920, height: 1080, aspectRatio: '16:9', name: 'YouTube HD', icon: '📺' },
    youtube4k: { width: 3840, height: 2160, aspectRatio: '16:9', name: 'YouTube 4K', icon: '🎬' },
    instagram: { width: 1080, height: 1080, aspectRatio: '1:1', name: 'Instagram', icon: '📷' },
    tiktok: { width: 1080, height: 1920, aspectRatio: '9:16', name: 'TikTok', icon: '🎵' },
    facebook: { width: 1280, height: 720, aspectRatio: '16:9', name: 'Facebook', icon: '👥' },
    custom: { width: 1280, height: 720, aspectRatio: 'Custom', name: 'Custom', icon: '⚙️' }
  };

  const [customWidth, setCustomWidth] = useState(1280);
  const [customHeight, setCustomHeight] = useState(720);

  // Image Aspect Ratio Preference
  const [imageAspectRatio, setImageAspectRatio] = useState<'16:9' | '9:16' | '1:1' | '4:3'>('16:9');

  // Font Size Settings & Preview Modal
  const [subtitleFontSize, setSubtitleFontSize] = useState(50);
  const [narrationFontSize, setNarrationFontSize] = useState(40);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [showNarrationText, setShowNarrationText] = useState(true);
  const [subtitleColor, setSubtitleColor] = useState("#ffffff");
  const [debouncedSubtitleColor, setDebouncedSubtitleColor] = useState("#ffffff");
  const [narrationColor, setNarrationColor] = useState("#e0e0e0");
  const [debouncedNarrationColor, setDebouncedNarrationColor] = useState("#e0e0e0");

  // New: Custom AI Prompt Injection
  const [customAiPrompt, setCustomAiPrompt] = useState("");

  // New: VFX Overlays
  // New: VFX Overlays
  const [overlayConfig, setOverlayConfig] = useState<any>({
    lightLeak: { enabled: false, intensity: 0.5, colorTheme: 'warm' },
    filmGrain: { enabled: false, intensity: 0.3, coarseness: 2 },
    dustParticles: { enabled: false, density: 0.4, speed: 0.5 },
    vignette: { enabled: false, intensity: 0.6, radius: 0.8 },
    colorGrading: { enabled: false, brightness: 1.0, contrast: 1.0, saturation: 1.0, sepia: 0 },
    bloom: { enabled: false, strength: 0.0, radius: 10, threshold: 0.8 }
  });

  // Scene Image Upload / Crop Modal state
  const [cropModal, setCropModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    sceneIndex: number;
    targetW: number;
    targetH: number;
  } | null>(null);
  const sceneFileInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Drag & Drop reorder state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dropIdx, setDropIdx] = useState<number | null>(null);

  const [subtitleFont, setSubtitleFont] = useState("Pretendard");
  const [narrationFont, setNarrationFont] = useState("Pretendard");
  // Subtitle Effects
  const [subtitleEffectStyle, setSubtitleEffectStyle] = useState<'none' | 'outline' | 'shadow' | 'neon' | 'glitch' | 'hollow' | 'splice' | 'lift' | 'echo'>('none');
  const [subtitleEntranceAnimation, setSubtitleEntranceAnimation] = useState<'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'pop'>('none');
  const [subtitleExitAnimation, setSubtitleExitAnimation] = useState<'none' | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom-in' | 'zoom-out' | 'pop'>('none');
  const [subtitleEffectColor, setSubtitleEffectColor] = useState('#000000');
  const [subtitleEffectParam, setSubtitleEffectParam] = useState(2);

  // New Dynamic Subtitle Settings
  const [subtitlePreset, setSubtitlePreset] = useState<string>('custom');
  const [subtitleOpacity, setSubtitleOpacity] = useState(1.0);
  const [subtitleBackgroundColor, setSubtitleBackgroundColor] = useState("#000000");
  const [debouncedSubtitleBackgroundColor, setDebouncedSubtitleBackgroundColor] = useState("#000000");
  const [subtitleBackgroundOpacity, setSubtitleBackgroundOpacity] = useState(0.0);
  const [debouncedSubtitleBackgroundOpacity, setDebouncedSubtitleBackgroundOpacity] = useState(0.0);
  const [subtitleStrokeColor, setSubtitleStrokeColor] = useState('#000000');
  const [subtitleStrokeWidth, setSubtitleStrokeWidth] = useState(0);

  // New: Narration Styling
  const [narrationBackgroundColor, setNarrationBackgroundColor] = useState("#000000");
  const [debouncedNarrationBackgroundColor, setDebouncedNarrationBackgroundColor] = useState("#000000");
  const [narrationBackgroundOpacity, setNarrationBackgroundOpacity] = useState(0.6); // Default for ticker
  const [debouncedNarrationBackgroundOpacity, setDebouncedNarrationBackgroundOpacity] = useState(0.6);

  // New: Ticker Speed Control
  const [tickerSpeed, setTickerSpeed] = useState<number>(1.0);

  const [showRenderSettings, setShowRenderSettings] = useState(false);

  // Background Settings
  const [backgroundColor, setBackgroundColor] = useState("#000000");
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);

  // QR Code Settings
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrUrl, setQrUrl] = useState(scrapedPost?.link || url);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [qrCodeSize, setQrCodeSize] = useState(120);
  const [qrCodePosition, setQrCodePosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-right');

  // Update QR URL when post is scraped
  useEffect(() => {
    if (scrapedPost?.link) {
      setQrUrl(scrapedPost.link);
    }
  }, [scrapedPost]);

  // Generate QR Code
  useEffect(() => {
    if (showQrCode && qrUrl) {
      QRCode.toDataURL(qrUrl, { margin: 1, color: { dark: '#000000', light: '#ffffff' } })
        .then(setQrCodeImage)
        .catch(console.error);
    } else {
      setQrCodeImage(null);
    }
  }, [showQrCode, qrUrl]);



  // Intro/Outro State
  const [introMedia, setIntroMedia] = useState<MediaAsset | null>(null);
  const [outroMedia, setOutroMedia] = useState<MediaAsset | null>(null);

  const [renderLogs, setRenderLogs] = useState<string[]>([]);

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>, isIntro: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const type = file.type.startsWith('video') ? 'video' : 'image';

    if (type === 'video') {
      const v = document.createElement('video');
      v.src = url;
      v.onloadedmetadata = () => {
        const asset: MediaAsset = { url, type, duration: v.duration, file };
        if (isIntro) setIntroMedia(asset); else setOutroMedia(asset);
      };
    } else {
      const asset: MediaAsset = { url, type: 'image', duration: 3.0, file };
      if (isIntro) setIntroMedia(asset); else setOutroMedia(asset);
    }
  };

  // Timeline Scrubber State
  const [currentTime, setCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [seekRequest, setSeekRequest] = useState<number | null>(null);

  const handleProgress = useCallback((current: number, total: number) => {
    if (!isScrubbing) {
      setCurrentTime(current);
      setTotalDuration(total);
    }
  }, [isScrubbing]);

  const handleScrubStart = () => setIsScrubbing(true);
  const handleScrubEnd = () => {
    setSeekRequest(currentTime);
    // Delay resetting scrubbing state to prevent the slider from jumping back 
    // to the old time before the renderer has caught up with the seek.
    setTimeout(() => {
      setIsScrubbing(false);
      setSeekRequest(null);
    }, 500);
  };
  const handleScrubChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(parseFloat(e.target.value));
  };

  // Preview Sync: click scene → seek to that scene's start time
  const handleSeekToScene = useCallback((idx: number) => {
    // Calculate start time by summing durations of preceding enabled scenes
    // Use the same duration formula as the renderer/Scene Breakdown display
    let startTime = 0;
    const enabledScenes = sceneItems.filter(s => s.isEnabled !== false);
    for (let i = 0; i < idx && i < enabledScenes.length; i++) {
      const s = enabledScenes[i];
      const effectiveDuration = Math.max(
        s.duration,
        (s.audioDuration || 0) > 0 ? (s.audioDuration || 0) + 3.0 : 4
      ) / (narrationSpeed || 1.0);
      startTime += effectiveDuration;
    }
    setCurrentTime(startTime);
    setSeekRequest(startTime);
  }, [sceneItems, narrationSpeed]);

  const fontDisplayMap: Record<string, string> = {
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
  const fontOptions = Object.keys(fontDisplayMap);

  const handleRenderLog = useCallback((msg: string) => {
    setRenderLogs(prev => [...prev.slice(-10), msg]);
  }, []);

  // Debounce Color Updates to prevent Max Update Depth Error in WebGPURenderer
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSubtitleColor(subtitleColor);
    }, 200);
    return () => clearTimeout(timer);
  }, [subtitleColor]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNarrationColor(narrationColor);
    }, 200);
    return () => clearTimeout(timer);
  }, [narrationColor]);

  // Debounce Background Color Updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSubtitleBackgroundColor(subtitleBackgroundColor);
    }, 200);
    return () => clearTimeout(timer);
  }, [subtitleBackgroundColor]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSubtitleBackgroundOpacity(subtitleBackgroundOpacity);
    }, 200);
    return () => clearTimeout(timer);
  }, [subtitleBackgroundOpacity]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNarrationBackgroundColor(narrationBackgroundColor);
    }, 200);
    return () => clearTimeout(timer);
  }, [narrationBackgroundColor]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedNarrationBackgroundOpacity(narrationBackgroundOpacity);
    }, 200);
    return () => clearTimeout(timer);
  }, [narrationBackgroundOpacity]);




  // File Analysis State
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  // Background Music
  const [bgmFiles, setBgmFiles] = useState<{ name: string, url: string }[]>([]);
  const [selectedBgm, setSelectedBgm] = useState<string>("");

  // Server Save & Gallery State
  const [isSaving, setIsSaving] = useState(false);
  const [serverVideos, setServerVideos] = useState<any[]>([]);
  const [showServerGallery, setShowServerGallery] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any | null>(null); // For Gallery Player
  const [projectTitle, setProjectTitle] = useState("");
  const [expandedProjectTitle, setExpandedProjectTitle] = useState<string | null>(null); // For grouping
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  const fetchServerProjects = async () => {
    try {
      const res = await fetch('/api/projects/list');
      const data = await res.json();
      if (data.projects) setServerVideos(data.projects);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateProjectTitle = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch('/api/projects/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: newTitle })
      });
      if (res.ok) {
        setServerVideos(prev => prev.map(p => p.id === id ? { ...p, title: newTitle } : p));
        setEditingProjectId(null);
      } else {
        alert("Failed to update title");
      }
    } catch (e) {
      alert("Failed to update title");
    }
  };

  const handleDeleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      const res = await fetch('/api/projects/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setServerVideos(prev => prev.filter(p => p.id !== id));
        if (selectedProject?.id === id) setSelectedProject(null);
      } else {
        alert("Failed to delete project");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to delete project");
    }
  };

  // Unsaved Changes State
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const ignoreChangesRef = useRef(false);

  // Track Unsaved Changes
  useEffect(() => {
    // Skip if loading or saving programmatically
    if (ignoreChangesRef.current) return;

    // Mark as dirty when critical data changes
    if (sceneItems.length > 0 || projectTitle) {
      setHasUnsavedChanges(true);
    }
  }, [
    sceneItems,
    projectTitle,
    voiceStyle,
    narrationTone,
    visualStyle,
    dominantColors,
    narrationEnabled,
    subtitleSpeed,
    audioEnabled,
    aiDisclosureEnabled,
    watermarkUrl,
    selectedPlatform,
    customWidth,
    customHeight,
    imageAspectRatio,
    customWidth,
    customHeight,
    imageAspectRatio,
    analysisMode,
    videoPurpose
  ]);

  // Browser Close Protection
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (showServerGallery) {
      fetchServerProjects();
    }
  }, [showServerGallery]);

  useEffect(() => {
    fetchServerProjects();
  }, []);


  useEffect(() => {
    fetch('/api/bgm')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setBgmFiles(data);
      })
      .catch(err => console.error("Failed to load BGM list", err));
  }, []);


  const generateThumbnail = async (videoBlob: Blob): Promise<Blob | null> => {
    return new Promise((resolve) => {
      try {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = URL.createObjectURL(videoBlob);
        video.muted = true;
        video.playsInline = true;

        video.onloadedmetadata = () => {
          video.currentTime = Math.min(1.0, video.duration / 2);
        };

        video.onseeked = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = 360;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              resolve(blob);
              URL.revokeObjectURL(video.src);
            }, "image/jpeg", 0.8);
          } else {
            resolve(null);
          }
        };

        video.onerror = () => {
          resolve(null);
        };
      } catch (e) {
        console.error("Thumb gen error", e);
        resolve(null);
      }
    });
  };

  const addLog = (type: 'text' | 'image' | 'prompt', content: string) => {
    setLogs(prev => [...prev, { type, content }]);
  };

  const handleNavigationWithSaveCheck = async (callback: () => void) => {
    if (hasUnsavedChanges) {
      if (confirm("저장 되지 않은 변경 사항이 있습니다. 저장하시겠습니까? (Unsaved changes detected. Save now?)")) {
        await handleSaveProject(true);
        // After save, proceed
        callback();
      } else {
        // User cancelled save. Proceed anyway? 
        // Request says "저장하시겠습니까?" (Do you want to save?)
        // If Cancel -> Usually means "Don't Save".
        // But if I want to "Cancel Navigation", I would use a 3-option dialog which `confirm` isn't.
        // Assuming Cancel means "Proceed without saving" based on typical web flow for simple confirm, 
        // OR assuming Cancel means "Stay". 
        // Given user asked for a prompt to save, implies they might want to save.
        // If they don't, they probably want to discard.
        callback();
      }
    } else {
      callback();
    }
  };

  const handleScrape = async (isLoadMore = false) => {
    setIsProcessing(true);
    setError("");

    if (!isLoadMore) {
      setPostList([]);
      setScrapedPost(null);
      setNextPageUrl(null);
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const targetUrl = isLoadMore && nextPageUrl ? nextPageUrl : url;

      const res = await fetch('/api/scrape', {
        method: 'POST',
        body: JSON.stringify({ url: targetUrl, date: date || today })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const cleanedPosts = (data.posts || []).map((post: ScrapedPost) => {
        let cleanTitle = post.title.trim();

        // 1. Check for "Word Word" pattern
        const words = cleanTitle.split(/\s+/);
        if (words.length >= 2 && words.length % 2 === 0) {
          const half = words.length / 2;
          const firstHalf = words.slice(0, half).join(' ');
          const secondHalf = words.slice(half).join(' ');
          if (firstHalf === secondHalf) {
            cleanTitle = firstHalf;
          }
        }

        // 2. Check for exact string duplication without spaces
        const mid = Math.floor(cleanTitle.length / 2);
        if (cleanTitle.length > 4 && cleanTitle.slice(0, mid) === cleanTitle.slice(mid)) {
          cleanTitle = cleanTitle.slice(0, mid);
        }

        return { ...post, title: cleanTitle };
      });

      if (isLoadMore) {
        setPostList(prev => [...prev, ...cleanedPosts]);
      } else {
        setPostList(cleanedPosts);
      }

      setNextPageUrl(data.nextPageUrl || null);

      if (cleanedPosts.length === 0 && !isLoadMore) setError("No posts found.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveProject = async (overwrite: boolean, archiveType: 'pre' | 'snapshot' = 'pre') => {
    setIsSaving(true);
    setShowSaveOptions(false);

    try {
      let blob = videoBlobUrl ? await (await fetch(videoBlobUrl)).blob() : undefined;

      const scriptCost = analysisResult?.usage?.estimatedCostKRW || 0;
      const imageCount = sceneItems.filter(s => s.imageUrl && s.status !== 'pending').length;
      const imageCost = imageCount * 58;
      const audioCost = sceneItems.reduce((acc, s) => acc + (s.audioUrl ? (s.text?.length || 0) * 0.05 : 0), 0);
      const totalCost = scriptCost + imageCost + audioCost;

      // Logic for Project Name Grouping & Sequencing
      let finalTitle = projectTitle || scrapedPost?.title || "Untitled Project";
      let finalId = overwrite ? currentProjectId : null;

      if (!overwrite) {
        // "Save As New" -> Calculate Sequence
        const baseTitle = finalTitle.replace(/ - \d+$/, "").trim();
        const existingCount = serverVideos.filter(v => {
          const gTitle = v.groupTitle || "";
          const tTitle = v.title || "";
          return gTitle === baseTitle || tTitle === baseTitle || tTitle.startsWith(baseTitle + " - ");
        }).length;

        const nextSequence = existingCount + 1;
        finalTitle = `${baseTitle} - ${nextSequence}`;
        setProjectTitle(finalTitle); // Update UI context
      }

      const formData = new FormData();
      if (blob) {
        formData.append('video', blob, 'video.webm');
        try {
          const thumbBlob = await generateThumbnail(blob);
          if (thumbBlob) formData.append('thumbnail', thumbBlob, 'thumbnail.jpg');
        } catch (e) {
          console.warn("Skipping thumbnail", e);
        }
      }

      if (finalId) {
        formData.append('id', finalId);
      }

      formData.append('metadata', JSON.stringify({
        groupTitle: finalTitle.replace(/ - \d+$/, "").trim(),
        title: finalTitle,
        duration: totalDuration,
        usage: { scriptCost, imageCost, audioCost, totalCost },
        scenes: sceneItems
      }));

      const res = await fetch('/api/projects/save', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error("Failed to save to FS");
      const fsData = await res.json();

      // Update Current ID if we created a new one
      if (!overwrite && fsData.project?.id) {
        finalId = fsData.project.id;
        setCurrentProjectId(finalId);
      }

      // Parallel Save to Airtable (Metadata Sync for List View)
      try {
        const airtableRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: finalId,
            name: finalTitle,
            sceneItems,
            settings: {
              visualStyle, dominantColors, voiceStyle, narrationTone, narrationEnabled,
              subtitleSpeed, audioEnabled, aiDisclosureEnabled, watermarkUrl,
              selectedPlatform, customWidth, customHeight, imageAspectRatio,
              totalDuration, analysisMode, videoPurpose,
              videoPath: fsData.project?.videoPath,
              // New Additions
              saveMemo, narrationLength, scrapedPost
            },
            archiveType // Pass to API
          })
        });
        const airtableData = await airtableRes.json();
        if (airtableData.id && !finalId) {
          // Fallback for ID if FS didn't provide one (unlikely)
          setCurrentProjectId(airtableData.id);
        }
      } catch (e) {
        console.error("Airtable sync failed", e);
      }

      if (!blob) alert("Project saved successfully!");
      setHasUnsavedChanges(false);
      fetchServerProjects();
    } catch (e) {
      console.error(e);
      alert("Failed to save project.");
    } finally {
      setIsSaving(false);
    }
  };



  const handleSelectPost = (post: ScrapedPost) => {
    // 1. Fix common scraping duplication in title (e.g., "Title Title" or "TitleTitle")
    let cleanTitle = post.title.trim();

    // Check for "Word Word" pattern
    const words = cleanTitle.split(/\s+/);
    if (words.length >= 2 && words.length % 2 === 0) {
      const half = words.length / 2;
      const firstHalf = words.slice(0, half).join(' ');
      const secondHalf = words.slice(half).join(' ');
      if (firstHalf === secondHalf) {
        cleanTitle = firstHalf;
      }
    }

    // Check for exact string duplication without spaces
    const mid = Math.floor(cleanTitle.length / 2);
    if (cleanTitle.length > 4 && cleanTitle.slice(0, mid) === cleanTitle.slice(mid)) {
      cleanTitle = cleanTitle.slice(0, mid);
    }

    // 2. Fix content starting with title
    let cleanContent = post.content.trim();
    if (cleanContent.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
      cleanContent = cleanContent.substring(cleanTitle.length).trim();
      // Also strip any leading separator like ":" or "-"
      cleanContent = cleanContent.replace(/^[ :\-–—]+/, '').trim();
    }

    const cleanedPost = { ...post, title: cleanTitle, content: cleanContent };

    setScrapedPost(cleanedPost);
    setProjectTitle(cleanTitle);
    setAnalysisResult(null);
    setSceneItems([]);
    setError("");
    // Auto-select PDF files by default
    const initialFiles = new Set<string>();
    post.files?.forEach(f => {
      const lowerName = f.name.toLowerCase();
      if (lowerName.includes('pdf') || lowerName.includes('docx') || lowerName.includes('doc') || lowerName.includes('xlsx') || lowerName.includes('xls')) {
        initialFiles.add(f.url);
      }
    });
    setSelectedFiles(initialFiles);
    setCustomAiPrompt(""); // Reset custom prompt
  };



  const handleConfirmRender = () => {
    setShowRenderSettings(false);
    setShowRenderer(true);
  };

  const handleReAnalyze = async () => {
    if (!scrapedPost) {
      alert("Source content is missing. Cannot re-analyze this project.");
      return;
    }
    if (!confirm("This will regenerate all scene prompts based on the new style settings. Current prompts will be overwritten. Continue?")) return;
    await handleStartAnalysis();
  };

  const handleStartAnalysis = async () => {
    if (!scrapedPost) return;
    setIsProcessing(true);
    setError("");
    setAnalysisResult(null);

    try {
      // 1. Pre-process text/images for upload if they are local blobs (Manual Mode)
      let finalImageUrls = scrapedPost.images || [];
      let finalPdfUrls = Array.from(selectedFiles);

      const blobFilesToUpload: { blob: Blob, name: string, type: 'image' | 'pdf', originalUrl: string }[] = [];

      // Check Images
      for (const imgUrl of finalImageUrls) {
        if (imgUrl.startsWith('blob:')) {
          // We need to fetch the blob datum
          const blob = await fetch(imgUrl).then(r => r.blob());
          blobFilesToUpload.push({ blob, name: `image-${Date.now()}.jpg`, type: 'image', originalUrl: imgUrl });
        }
      }

      // Check PDFs/Files
      for (const fileUrl of finalPdfUrls) {
        if (fileUrl.startsWith('blob:')) {
          // Find original name if possible, or generic
          const originalFile = scrapedPost.files?.find(f => f.url === fileUrl);
          const name = originalFile?.name || `file-${Date.now()}.pdf`;
          const blob = await fetch(fileUrl).then(r => r.blob());
          blobFilesToUpload.push({ blob, name, type: 'pdf', originalUrl: fileUrl });
        }
      }

      // Upload if needed
      if (blobFilesToUpload.length > 0) {
        const formData = new FormData();
        blobFilesToUpload.forEach(item => {
          formData.append('files', item.blob, item.name);
        });

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        });

        if (uploadRes.ok) {
          const { urls } = await uploadRes.json();
          // Map back to replace blob urls
          // The order of 'files' in formData is preserved? Usually yes.
          if (urls && urls.length === blobFilesToUpload.length) {
            blobFilesToUpload.forEach((item, idx) => {
              const serverUrl = urls[idx];
              if (item.type === 'image') {
                finalImageUrls = finalImageUrls.map(u => u === item.originalUrl ? serverUrl : u);
              } else {
                finalPdfUrls = finalPdfUrls.map(u => u === item.originalUrl ? serverUrl : u);
              }
            });
          }
        } else {
          console.error("Failed to upload local files, proceeding with blobs (might fail analysis)");
        }
      }

      const res = await fetch('/api/process-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scrapedPost.content,
          imageUrls: finalImageUrls,
          pdfUrls: finalPdfUrls,
          analysisMode,
          videoPurpose, // Pass videoPurpose
          selectedStyle: visualStyle,
          imageComposition,
          imageMood,
          imageInterpretation,
          allowImageVariation, // Pass this new setting
          sceneCount,
          narrationLength, // Pass narrationLength
          customPrompt: customAiPrompt // Pass custom prompt
        })
      });
      const data = await res.json();

      // If error but also contains simulation data, show warning but proceed
      if (data.error && !data.scenes) {
        throw new Error(data.error);
      }

      if (data.isSimulation) {
        console.warn("Using simulation data due to quota limits");
        // Optional: set a non-blocking UI warning
      }

      setAnalysisResult(data);
      if (data.summary && !projectTitle && !scrapedPost?.title) {
        // Only auto-set title from summary if we don't have a title or a scraped post
        setProjectTitle(data.summary);
      }

      const newScenes = data.scenes.map((s: any) => ({
        text: s.text,
        title: s.title,
        imagePrompt: s.imagePrompt,
        imageUrl: s.imageUrl || null,
        status: s.status || 'pending',
        subtitle: s.subtitle,
        duration: 5,
        transition: 'fade',
        audioUrl: null,
        audioDuration: 0,
        isEnabled: true
      }));
      setSceneItems(newScenes);
      setTotalDuration(newScenes.length * 5);

      // Auto-set style if available
      const finalVisualStyle = data.imageAnalysis?.visualStyle || visualStyle;
      const finalDominantColors = data.imageAnalysis?.dominantColors || dominantColors;

      if (data.imageAnalysis?.visualStyle) setVisualStyle(data.imageAnalysis.visualStyle);
      if (data.imageAnalysis?.dominantColors) setDominantColors(data.imageAnalysis.dominantColors);

      // --- AUTO SAVE PROJECT INFO ---
      try {
        const autoSaveSettings = {
          visualStyle: finalVisualStyle,
          dominantColors: finalDominantColors,
          voiceStyle,
          narrationTone,
          narrationEnabled,
          subtitleSpeed,
          audioEnabled,
          aiDisclosureEnabled,
          watermarkUrl,
          selectedPlatform,
          customWidth,
          customHeight,
          imageAspectRatio,
          totalDuration: newScenes.length * 5,
          analysisMode,
          videoPurpose,
          allowImageVariation, // Save this setting
          sceneCount,
          narrationLength, // Save narrationLength
          customPrompt: customAiPrompt, // Save custom prompt
          scrapedPost: scrapedPost ? {
            title: scrapedPost.title,
            link: scrapedPost.link,
            files: scrapedPost.files || [],
          } : null
        };

        const autoSaveRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentProjectId,
            name: scrapedPost?.title || projectTitle || data.summary || "New Project",
            sceneItems: newScenes,
            settings: autoSaveSettings
          })
        });
        const autoSaveData = await autoSaveRes.json();
        if (autoSaveData.id && !currentProjectId) {
          setCurrentProjectId(autoSaveData.id);
          console.log("Auto-saved as new project:", autoSaveData.id);
        } else if (autoSaveData.id) {
          console.log("Auto-updated project:", autoSaveData.id);
        }
      } catch (saveErr) {
        console.warn("Auto-save failed", saveErr);
      }

    } catch (e: any) {
      setError(e.message);
      setIsProcessing(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateSceneImage = async (idx: number) => {
    setSceneItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], status: 'generating' };
      return updated;
    });

    if (isVisualSimulation) {
      // SIMULATION MODE
      await new Promise(resolve => setTimeout(resolve, 1500));
      const simIndex = (idx % 8) + 1;
      // Using relative path as requested
      const simUrl = `./generated/img_3_${simIndex}.jpg`;

      setSceneItems(prev => {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          imageUrl: simUrl,
          status: 'generated'
        };
        return updated;
      });
    } else {
      // REAL API MODE
      try {
        const res = await fetch('/api/generate-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: sceneItems[idx].imagePrompt,
            style: visualStyle,
            aspectRatio: imageAspectRatio,
            // Pass original image as reference for Album Mode + Variation
            refImage: (analysisMode === 'album' && allowImageVariation && sceneItems[idx].imageUrl)
              ? sceneItems[idx].imageUrl
              : undefined
          })
        });
        const data = await res.json();

        if (data.imageUrl) {
          setSceneItems(prev => {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              imageUrl: data.imageUrl,
              status: 'generated'
            };
            return updated;
          });
        } else {
          throw new Error("No image URL returned");
        }
      } catch (e) {
        console.error("Image generation failed, falling back to simulation?", e);
        // Optional: Alert user or fallback. For now, we denote failure but don't crash.
        alert("Real image generation failed. Check API key or quota. Using simulation fallback.");

        // Fallback to simulation
        const simIndex = (idx % 8) + 1;
        // Using relative path as requested
        const simUrl = `./generated/img_3_${simIndex}.jpg`;
        setSceneItems(prev => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], imageUrl: simUrl, status: 'generated' };
          return updated;
        });
      }
    }
  };

  const handleGenerateAllImages = async () => {
    setIsProcessing(true);
    // Use the latest sceneItems to avoid stale closures in sequential loops
    for (let i = 0; i < sceneItems.length; i++) {
      if (sceneItems[i].isEnabled === false) continue;
      // Protected: Don't overwrite existing images (Originals or already generated)
      if (sceneItems[i].imageUrl) continue;
      await handleGenerateSceneImage(i);
    }
    setIsProcessing(false);
  };

  const handleApproveScene = (idx: number) => {
    const updated = [...sceneItems];
    updated[idx].status = 'approved';
    setSceneItems(updated);
  };

  const handleGenerateAllMissingAudio = async () => {
    setIsProcessing(true);
    for (let i = 0; i < sceneItems.length; i++) {
      if (sceneItems[i].isEnabled === false) continue;
      if (!sceneItems[i].audioUrl && sceneItems[i].text) {
        await handleGenerateSceneAudio(i);
      }
    }
    setIsProcessing(false);
  };

  const handleGenerateSceneAudio = async (idx: number, overrideSettings?: any) => {
    // Set loading state for specific scene
    setSceneItems(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], isAudioGenerating: true };
      return updated;
    });

    // Resolve Overrides
    const scene = sceneItems[idx];
    const settings = overrideSettings || scene.narrationSettings || {};
    const finalVoice = settings.voice || voiceStyle;
    const finalPrompt = settings.prompt || customVoicePrompt || "";
    // Merge Global Mix with Overrides (Overrides take precedence)
    const finalSpeed = settings.speed ?? narrationSpeed;
    const finalPitch = settings.pitch ?? narrationPitch;
    const finalVolume = settings.volume ?? narrationVolume;

    if (isAudioSimulation) {
      // SIMULATION MODE
      await new Promise(resolve => setTimeout(resolve, 1500));
      const simIndex = (idx % 6) + 1;
      const simUrl = `/generated/audio/narration_2_${simIndex}.wav`;

      setSceneItems(prev => {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          audioUrl: simUrl,
          audioDuration: 5,
          duration: 7, // 5s + 2s padding
          isAudioGenerating: false
        };
        return updated;
      });
      return;
    }

    // Lookup Voice Params from Data
    const allVoices = [...VOICE_DATA.gemini, ...VOICE_DATA.neural2];
    const voiceDef = allVoices.find(v => v.id === finalVoice);
    const voiceSpecificParams = voiceDef?.params || {};

    try {
      const res = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sceneItems[idx].text,
          voiceStyle: voiceDef?.style || "Professional", // Send human readable style, not ID
          narrationTone,
          actingPrompt: finalPrompt,
          apiModel: voiceDef?.api_model, // Explicitly pass model (Gemini vs Neural2)
          // Pass Mix Settings + Voice Identity
          voiceParams: {
            ...voiceSpecificParams, // INJECT voice_name or name/languageCode
            rate: finalSpeed,
            pitch: finalPitch,
            volume: finalVolume
          }
        })
      });
      const data = await res.json();
      if (data.audioUrl) {
        setSceneItems(prev => {
          const updated = [...prev];
          updated[idx] = {
            ...updated[idx],
            audioUrl: data.audioUrl,
            audioDuration: data.duration,
            duration: Math.max(5, Math.ceil(data.duration + 2)), // Narration + 2s (min 5s)
            isAudioGenerating: false
          };
          return updated;
        });
      } else {
        throw new Error(data.error || "Generation failed");
      }
    } catch (e) {
      console.error(e);
      // Optional: Logic to fallback to simulation on error could be added here similar to images
      setSceneItems(prev => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], isAudioGenerating: false };
        return updated;
      });
      alert(`Audio generation failed for Scene ${idx + 1}. Check API/Quota.`);
    }
  };

  const handleMoveScene = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= sceneItems.length) return;

    const updated = [...sceneItems];
    const [moved] = updated.splice(index, 1);
    updated.splice(newIndex, 0, moved);
    setSceneItems(updated);
  };

  const handleDeleteScene = (index: number) => {
    if (sceneItems.length <= 1) return; // Keep at least 1 scene
    if (!confirm(`Scene ${index + 1}을 삭제하시겠습니까?`)) return;
    setSceneItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleDuplicateScene = (index: number) => {
    setSceneItems(prev => {
      const clone = JSON.parse(JSON.stringify(prev[index]));
      clone.status = 'pending';
      clone.imageUrl = prev[index].imageUrl; // Keep image URL (not deep-clonable)
      const updated = [...prev];
      updated.splice(index + 1, 0, clone);
      return updated;
    });
  };

  const handleAddEmptyScene = () => {
    setSceneItems(prev => [
      ...prev,
      {
        text: '',
        subtitle: '',
        title: `Scene ${prev.length + 1}`,
        imageUrl: '',
        imagePrompt: '',
        status: 'pending' as any,
        duration: 8,
        transition: 'fade' as any,
        audioUrl: null,
        audioDuration: 0,
        isEnabled: true,
        isAudioGenerating: false,
      }
    ]);
  };


  const handleSceneImageUpload = (idx: number, file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const platform = selectedPlatform;
      const tW = platform === 'custom' ? customWidth : platformConfigs[platform].width;
      const tH = platform === 'custom' ? customHeight : platformConfigs[platform].height;
      const imgAspect = (img.naturalWidth / img.naturalHeight).toFixed(2);
      const targetAspect = (tW / tH).toFixed(2);

      if (imgAspect === targetAspect) {
        // Aspect ratio matches → apply directly
        setSceneItems(prev => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], imageUrl: url, status: 'approved' as any };
          return updated;
        });
      } else {
        // Mismatch → show crop modal
        setCropModal({ isOpen: true, imageUrl: url, sceneIndex: idx, targetW: tW, targetH: tH });
      }
    };
    img.src = url;
  };

  const handlePreviewVoice = async (voiceId: string) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }

    if (previewingVoiceId === voiceId) {
      setPreviewingVoiceId(null);
      return;
    }

    setPreviewingVoiceId(voiceId);

    try {
      // 1. Check Client Cache
      if (previewCacheRef.current.has(voiceId)) {
        const cachedUrl = previewCacheRef.current.get(voiceId)!;
        const audio = new Audio(cachedUrl);
        previewAudioRef.current = audio;
        audio.onended = () => setPreviewingVoiceId(null);
        audio.play();
        return;
      }

      // Find voice details
      let voiceData: any = VOICE_DATA.gemini.find(v => v.id === voiceId);
      if (!voiceData) {
        voiceData = VOICE_DATA.neural2.find(v => v.id === voiceId);
      }

      if (!voiceData) throw new Error("Voice ID not found");

      const res = await fetch('/api/voice-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: "안녕하세요, 제 목소리 어때요? 영상에 잘 어울릴 것 같아요.",
          voiceStyle: voiceId,
          narrationTone: "Conversational",
          apiModel: voiceData.api_model,
          voiceParams: voiceData.params,
          voiceId: voiceId,
          actingPrompt: customVoicePrompt // Pass Acting Prompt
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");

      // 2. Save to Cache
      previewCacheRef.current.set(voiceId, data.audioUrl);

      const audio = new Audio(data.audioUrl);
      previewAudioRef.current = audio;
      audio.onended = () => setPreviewingVoiceId(null);
      audio.play();

    } catch (e: any) {
      console.error(e);
      setPreviewingVoiceId(null);
      alert("Preview failed: " + e.message);
    }
  };



  const handleRenderComplete = useCallback((blob: Blob) => {
    const url = URL.createObjectURL(blob);
    setVideoBlobUrl(url);
    setIsRendering(false);

    // Auto-Save Logic
    // If no project title exists, set one and try to save automatically
    let titleToSave = projectTitle;
    if (!titleToSave) {
      // Prioritize scraped post title, else fallback
      titleToSave = scrapedPost?.title || "Auto-Saved Project " + new Date().toLocaleTimeString();
      setProjectTitle(titleToSave);
    }

    // handleSaveToServer(blob); // Removed auto-save to prevent duplication. User can use the manual save button.
  }, [projectTitle, scrapedPost]);




  const handleOpenLoadModal = async () => {
    setIsProcessing(true);
    setHistoryProjectId(null);
    setExpandedProjectName(null);
    try {
      // Restore Airtable List Check
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSavedProjects(data.map((p: any) => ({
          ...p,
          createdAt: p.createdAt || new Date().toISOString()
        })));
        setShowProjectList(true);
      } else {
        throw new Error("Invalid project list data");
      }
    } catch (e: any) {
      alert("Failed to load project list: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFetchHistory = async (projId: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/projects?id=${projId}`);
      const data = await res.json();
      if (data.history) {
        setProjectHistory(data.history);
        setHistoryProjectId(projId);
      }
    } catch (e: any) {
      alert("Failed to load history: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteHistoryVersion = async (historyTimestamp: string) => {
    if (!historyProjectId) return;
    if (!confirm("Are you sure you want to delete this version history entry? This cannot be undone.")) return;

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/projects?id=${historyProjectId}&historyTimestamp=${encodeURIComponent(historyTimestamp)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        // Update local state to remove the item
        setProjectHistory(prev => prev.filter(h => h.timestamp !== historyTimestamp));
        alert("Version history deleted successfully.");
      } else {
        throw new Error(data.error || "Delete failed");
      }
    } catch (e: any) {
      alert("Failed to delete history: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreVersion = (version: any) => {
    if (!confirm("Are you sure you want to restore this version? Current unsaved changes will be lost.")) return;

    setSceneItems(version.sceneItems);

    const s = version.settings;
    if (s) {
      if (s.visualStyle) setVisualStyle(s.visualStyle);
      if (s.dominantColors) setDominantColors(s.dominantColors);
      if (s.voiceStyle) setVoiceStyle(s.voiceStyle);
      if (s.narrationTone) setNarrationTone(s.narrationTone);
      if (s.narrationEnabled !== undefined) setNarrationEnabled(s.narrationEnabled);
      if (s.subtitleSpeed) setSubtitleSpeed(s.subtitleSpeed);
      if (s.audioEnabled !== undefined) setAudioEnabled(s.audioEnabled);
      if (s.aiDisclosureEnabled !== undefined) setAiDisclosureEnabled(s.aiDisclosureEnabled);
      if (s.watermarkUrl !== undefined) setWatermarkUrl(s.watermarkUrl);
      if (s.selectedPlatform) setSelectedPlatform(s.selectedPlatform);
      if (s.customWidth) setCustomWidth(s.customWidth);
      if (s.customHeight) setCustomHeight(s.customHeight);
      if (s.imageAspectRatio) setImageAspectRatio(s.imageAspectRatio);
      if (s.totalDuration) setTotalDuration(s.totalDuration);
      if (s.analysisMode) setAnalysisMode(s.analysisMode);
      if (s.allowImageVariation !== undefined) setAllowImageVariation(s.allowImageVariation);
      if (s.sceneCount !== undefined) setSceneCount(s.sceneCount);
      if (s.videoPurpose !== undefined) setVideoPurpose(s.videoPurpose);
      // Restore Advanced Style Settings
      if (s.imageComposition) setImageComposition(s.imageComposition);
      if (s.imageMood) setImageMood(s.imageMood);
      if (s.imageInterpretation) setImageInterpretation(s.imageInterpretation);
    }

    setHistoryProjectId(null);
    setShowProjectList(false);
    alert("Version restored successfully!");
  };

  const handleLoadProject = async (projId: string) => {
    ignoreChangesRef.current = true;
    setIsProcessing(true);
    setShowProjectList(false);
    try {
      const res = await fetch(`/api/projects?id=${projId}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Restore Project
      setCurrentProjectId(data.id);
      setProjectTitle(data.name || "");
      setSceneItems(data.sceneItems);

      const s = data.settings;
      if (s.visualStyle) setVisualStyle(s.visualStyle);
      if (s.dominantColors) setDominantColors(s.dominantColors);
      if (s.voiceStyle) setVoiceStyle(s.voiceStyle);
      if (s.narrationTone) setNarrationTone(s.narrationTone);
      if (s.narrationEnabled !== undefined) setNarrationEnabled(s.narrationEnabled);
      if (s.subtitleSpeed) setSubtitleSpeed(s.subtitleSpeed);
      if (s.audioEnabled !== undefined) setAudioEnabled(s.audioEnabled);
      if (s.aiDisclosureEnabled !== undefined) setAiDisclosureEnabled(s.aiDisclosureEnabled);
      if (s.watermarkUrl !== undefined) setWatermarkUrl(s.watermarkUrl);
      if (s.selectedPlatform) setSelectedPlatform(s.selectedPlatform);
      if (s.customWidth) setCustomWidth(s.customWidth);
      if (s.customHeight) setCustomHeight(s.customHeight);
      if (s.imageAspectRatio) setImageAspectRatio(s.imageAspectRatio);
      if (s.totalDuration) setTotalDuration(s.totalDuration);
      if (s.analysisMode) setAnalysisMode(s.analysisMode);
      if (s.videoPurpose) setVideoPurpose(s.videoPurpose);
      if (s.allowImageVariation !== undefined) setAllowImageVariation(s.allowImageVariation);

      // Restore Scraped Data
      if (s.scrapedPost) {
        setScrapedPost({
          ...s.scrapedPost,
          content: "Loaded from project settings.", // Content might be missing, placeholder
          images: [], // Images are reconstructed from sceneItems
          date: new Date().toISOString()
        });

        // Restore File Selection
        if (s.scrapedPost.files) {
          const fileSet = new Set<string>();
          s.scrapedPost.files.forEach((f: any) => fileSet.add(f.url));
          setSelectedFiles(fileSet);
        }
      }

      // CRITICAL: Set a placeholder analysisResult to trigger the UI rendering
      // The UI checks {analysisResult && ...} to show the scene editor.
      setAnalysisResult({
        summary: data.name || "Loaded Project",
        scenes: [], // Not used for rendering the list (sceneItems is used)
        imageAnalysis: {
          summary: "Project loaded from save",
          visualStyle: s.visualStyle || "Auto",
          dominantColors: s.dominantColors || []
        },
        consistency: { character: "Loaded Character", theme: "Loaded Theme" },
        suggestedStyles: []
      });

      // Reset flow if needed
      setVideoBlobUrl(null);
      setShowRenderer(false);
      setHistoryProjectId(null); // Clear history view if loading new project
      setExpandedProjectName(null);
      setShowProjectList(false);

      alert("Project loaded successfully!");

      // Reset dirty state after successful load
      setTimeout(() => {
        setHasUnsavedChanges(false);
      }, 100);

    } catch (e: any) {
      alert("Load failed: " + e.message);
    } finally {
      setIsProcessing(false);
      // Resume tracking changes
      setTimeout(() => {
        ignoreChangesRef.current = false;
      }, 200);
    }
  };

  const handleSoftDeleteProject = async (projId: string) => {
    if (!confirm("Are you sure you want to delete this project? It will be moved to trash.")) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/projects?id=${projId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setSavedProjects(prev => prev.filter((p: any) => p.id !== projId));
        // Reset current project if we just deleted it
        if (currentProjectId === projId) {
          setCurrentProjectId(null);
          setProjectTitle("");
          setSceneItems([]);
          alert("Project deleted successfully (Soft Delete).");
        }
      } else {
        throw new Error(data.error || "Delete failed");
      }
    } catch (e: any) {
      alert("Delete failed: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateProjectName = async (projId: string, newName: string) => {
    if (!newName.trim()) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: projId,
          name: newName.trim(),
          sceneItems: [], // Not updating scenes
          settings: {}    // Not updating settings (preserve existing)
        })
      });
      const data = await res.json();
      if (data.success) {
        setSavedProjects(prev => prev.map((p: any) => p.id === projId ? { ...p, name: newName.trim() } : p));
        setEditingProjectId(null);
        alert("Project renamed successfully.");
      } else {
        throw new Error(data.error || "Update failed");
      }
    } catch (e: any) {
      alert("Rename failed: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleBGMPreview = () => {
    if (isPreviewingBGM) {
      bgmPreviewRef.current?.pause();
      setIsPreviewingBGM(false);
    } else {
      const src = audioFile ? URL.createObjectURL(audioFile) : selectedBgm;
      if (!src) {
        alert("Select source or upload file first.");
        return;
      }
      if (!bgmPreviewRef.current) {
        bgmPreviewRef.current = new Audio();
      }
      bgmPreviewRef.current.loop = false; // Disable loop
      bgmPreviewRef.current.onended = () => setIsPreviewingBGM(false); // Stop on end

      bgmPreviewRef.current.src = src;
      bgmPreviewRef.current.volume = audioVolume;
      bgmPreviewRef.current.play().catch(err => {
        console.error("Preview Play failed", err);
        alert("Playback failed. Check format.");
        setIsPreviewingBGM(false);
      });
      setIsPreviewingBGM(true);
    }
  };

  // Stop preview when modal closes
  useEffect(() => {
    if (!showRenderSettings && isPreviewingBGM) {
      bgmPreviewRef.current?.pause();
      setIsPreviewingBGM(false);
    }
  }, [showRenderSettings, isPreviewingBGM]);

  // Sync Volume during preview
  useEffect(() => {
    if (bgmPreviewRef.current) {
      bgmPreviewRef.current.volume = audioVolume;
    }
  }, [audioVolume]);

  // Cleanup Preview on Unmount or Change
  useEffect(() => {
    return () => {
      bgmPreviewRef.current?.pause();
      bgmPreviewRef.current = null;
    };
  }, []);

  const rendererScenes = useMemo(() => sceneItems.filter(s => s.isEnabled !== false).map(s => ({
    imageUrl: s.imageUrl || '',
    text: s.text,
    subtitle: s.subtitle,
    title: s.title,
    duration: s.duration, // Sync duration
    transition: s.transition,
    audioUrl: s.audioUrl,
    audioDuration: s.audioDuration,
    narrationSettings: s.narrationSettings
  })), [sceneItems]);

  const rendererAudioSrc = useMemo(() => {
    if (audioFile) return URL.createObjectURL(audioFile);
    if (selectedBgm) return selectedBgm;
    return undefined;
  }, [audioFile, selectedBgm]);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <link href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Do+Hyeon&family=Gothic+A1&family=Gowun+Dodum&family=Jua&family=Nanum+Gothic&family=Nanum+Myeongjo&family=Noto+Sans+KR&family=Stylish&family=Sunflower:wght@300&display=swap" rel="stylesheet" />
      {!showRenderer && !isNarrationReview && !videoBlobUrl && (
        <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom duration-500">

          {/* Header */}
          <div className="flex justify-between items-center text-white border-b border-white/10 pb-4">
            <h2 className="text-3xl font-bold flex items-center gap-3">
              <Film className="w-8 h-8 text-purple-400" /> Video Editor
            </h2>
            <div className="flex gap-3">
              <button
                onClick={() => handleNavigationWithSaveCheck(() => {
                  setSelectedProject(null);
                  setExpandedProjectTitle(null);
                  setEditingProjectId(null);
                  setShowServerGallery(true);
                })}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-900/20 transition-all flex items-center gap-2"
              >
                <Film className="w-3 h-3" /> Gallery
              </button>
              <button
                onClick={handleOpenLoadModal}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold transition-all flex items-center gap-2"
              >
                <Upload className="w-3 h-3" /> Load
              </button>



              <button
                onClick={() => setShowSNSManager(true)}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold transition-all flex items-center gap-2"
                title="Manage Integrations"
              >
                <Settings className="w-3 h-3" /> Settings
              </button>

              {currentProjectId && (
                <button
                  onClick={() => handleSaveProject(false)}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                >
                  <Copy className="w-3 h-3" /> Copy Project
                </button>
              )}

              <button
                onClick={() => {
                  if (currentProjectId) {
                    setShowSaveOptions(true);
                  } else {
                    // Manual Create project
                    setScrapedPost({
                      title: "",
                      link: "",
                      date: new Date().toISOString().split('T')[0],
                      content: "",
                      images: [],
                      files: []
                    });
                    setPostList([]); // Clear post list to focus on creation
                  }
                }}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-lg shadow-pink-900/20 transition-all flex items-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : currentProjectId ? <Save className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {currentProjectId ? 'Save' : 'Create Project'}
              </button>
            </div>
          </div>

          {/* Process Flow Indicators */}
          <div className="flex justify-between px-10 relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -z-10"></div>
            <div className="flex flex-col items-center gap-2 z-10">
              <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm", postList.length > 0 ? "bg-green-600 text-white" : "bg-purple-600 text-white")}>1</div>
              <span className="text-xs text-gray-400">Scrape</span>
            </div>
            <div className="flex flex-col items-center gap-2 z-10">
              <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors", analysisResult ? "bg-green-600 text-white" : "bg-gray-800 text-gray-500")}>2</div>
              <span className="text-xs text-gray-400">Analyze</span>
            </div>
            <div className="flex flex-col items-center gap-2 z-10">
              <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors", sceneItems.some(s => s.status === 'approved') ? "bg-green-600 text-white" : "bg-gray-800 text-gray-500")}>3</div>
              <span className="text-xs text-gray-400">Scenes</span>
            </div>
            <div className="flex flex-col items-center gap-2 z-10">
              <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors", isNarrationReview || isRendering ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-500")}>4</div>
              <span className="text-xs text-gray-400">Render</span>
            </div>
          </div>

          {/* Step 1: Input */}
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-lg">Target Content</h3>
              </div>
              <button
                onClick={() => setIsSiteModalOpen(true)}
                className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full transition-colors text-gray-300 hover:text-white flex items-center gap-1"
              >
                <List className="w-3 h-3" /> Saved Sites
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 p-4 pl-12 rounded-xl text-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                  placeholder="https://example.com/board/view/..."
                />
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5 pointer-events-none" />
              </div>
              <div className="w-full md:w-48 relative">
                <input
                  type="date"
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  onClick={(e) => {
                    try {
                      (e.target as HTMLInputElement).showPicker();
                    } catch (err) {
                      console.warn("showPicker not supported", err);
                    }
                  }}
                  className="w-full bg-black/40 border border-white/10 p-4 pl-12 rounded-xl text-white focus:border-purple-500 outline-none cursor-pointer"
                />
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5 pointer-events-none" />
              </div>
            </div>

            <div className="flex justify-between items-start pt-2">
              {/* Filter UI */}
              <div className="flex-1 mr-4 bg-black/20 p-3 rounded-xl border border-white/5">
                <div className="flex flex-wrap gap-3 items-end">
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Period</label>
                    <div className="flex items-center gap-2">
                      <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-purple-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
                      <span className="text-gray-500">~</span>
                      <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-purple-500 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Title Search</label>
                    <input type="text" value={filterTitle} onChange={e => setFilterTitle(e.target.value)} placeholder="Filter by title..." className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-purple-500 w-32" />
                  </div>
                  <div className="pb-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={filterHideExisting} onChange={e => setFilterHideExisting(e.target.checked)} className="w-3 h-3 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-offset-0" />
                      <span className="text-xs text-gray-300">Hide Existing Projects</span>
                    </label>
                  </div>

                  {/* Reset Filters Button */}
                  {(filterStartDate || filterEndDate || filterTitle || filterHideExisting) && (
                    <button
                      onClick={() => {
                        setFilterStartDate("");
                        setFilterEndDate("");
                        setFilterTitle("");
                        setFilterHideExisting(false);
                      }}
                      className="mb-1 p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                      title="Reset Filters"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleScrape(false)}
                disabled={isProcessing}
                className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-8 py-3 rounded-xl font-bold transition-all hover:scale-105 shadow-lg shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? <Loader2 className="animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                {isProcessing ? 'Processing...' : 'Analyze Content'}
              </button>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-lg text-sm mt-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}
          </div>

          {/* Step 2: Post List */}
          {postList.length > 0 && !scrapedPost && (
            <div className="grid gap-4">
              {postList.filter(post => {
                // 1. Title Filter
                if (filterTitle && !post.title.toLowerCase().includes(filterTitle.toLowerCase())) return false;

                // 2. Date Filter
                if (filterStartDate || filterEndDate) {
                  // NEW: Strict Regex matching for YYYY.MM.DD (ignoring IDs like 13481 at start)
                  const dateMatch = post.date.match(/(\d{4})[. -](\d{2})[. -](\d{2})/);
                  let postDateNum = 0;
                  if (dateMatch) {
                    // Construct YYYYMMDD from captured groups
                    const y = dateMatch[1];
                    const m = dateMatch[2];
                    const d = dateMatch[3];
                    postDateNum = parseInt(`${y}${m}${d}`, 10);
                  }



                  if (postDateNum > 0) {
                    if (filterStartDate) {
                      const startNum = parseInt(filterStartDate.replace(/-/g, ''), 10);
                      if (postDateNum < startNum) return false;
                    }

                    if (filterEndDate) {
                      const endNum = parseInt(filterEndDate.replace(/-/g, ''), 10);
                      if (postDateNum > endNum) return false;
                    }
                  }
                }

                // 3. Existing Project Filter
                if (filterHideExisting) {
                  // Helper to normalize strings for comparison (NFC, lowercase, remove all whitespace/punctuation)
                  const normalizeTitle = (s: string) => s.normalize("NFC").replace(/[^\w\uAC00-\uD7A3]/g, "").toLowerCase();

                  const exists = serverVideos.some(v => {
                    const t = normalizeTitle(v.title || "");
                    const g = normalizeTitle(v.groupTitle || "");
                    const pTitle = normalizeTitle(post.title);
                    return t === pTitle || g === pTitle || t.startsWith(pTitle);
                  });
                  if (exists) return false;
                }

                return true;
              }).map((post, idx) => {
                const today = new Date().toISOString().split('T')[0];
                const todayDot = today.replace(/-/g, '.');
                const isNew = post.date.includes(today) || post.date.includes(todayDot);

                // Calculate if existing (for UI indication)
                // Use same normalization logic as filter
                const normalizeTitle = (s: string) => s.normalize("NFC").replace(/[^\w\uAC00-\uD7A3]/g, "").toLowerCase();
                const exists = serverVideos.some(v => {
                  const t = normalizeTitle(v.title || "");
                  const g = normalizeTitle(v.groupTitle || "");
                  const pTitle = normalizeTitle(post.title);
                  return t === pTitle || g === pTitle || t.startsWith(pTitle);
                });

                return (
                  <div
                    key={idx}
                    className={clsx(
                      "p-5 rounded-2xl cursor-pointer border transition-all flex items-center justify-between group",
                      isNew
                        ? "bg-purple-600/10 border-purple-500/30 hover:bg-purple-600/20 shadow-lg shadow-purple-900/10"
                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/20"
                    )}
                    onClick={() => handleSelectPost(post)}
                  >
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-3 mb-2">
                        {isNew && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded-md animate-pulse">
                            <Sparkles className="w-3 h-3" /> NEW
                          </div>
                        )}
                        {exists && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-300 border border-green-500/30 text-[10px] font-bold rounded-md">
                            EXISTS
                          </div>
                        )}
                        <h3 className={clsx(
                          "font-bold text-xl truncate transition-colors",
                          isNew ? "text-purple-200" : "text-white group-hover:text-purple-300"
                        )}>
                          {post.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {post.date}
                        </span>
                      </div>
                    </div>

                    {post.files && post.files.length > 0 && (
                      <div className="flex items-center gap-2 text-blue-400 bg-blue-500/10 px-3 py-2 rounded-xl border border-blue-500/20 shadow-sm">
                        <FileText className="w-4 h-4" />
                        <span className="text-xs font-bold">{post.files.length}</span>
                      </div>
                    )}

                    <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Load More Button */}
          {nextPageUrl && !scrapedPost && (
            <div className="flex justify-center mt-4 pb-10">
              <button
                onClick={() => handleScrape(true)}
                disabled={isProcessing}
                className="px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-sm font-bold transition-all flex items-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronDown className="w-4 h-4" />}
                Load More
              </button>
            </div>
          )}

          {/* Step 2.5: Scraped Content Review */}
          {scrapedPost && !analysisResult && (
            <div
              className={clsx(
                "bg-white/5 p-6 rounded-2xl border transition-all shadow-xl space-y-6 animate-in fade-in relative",
                isDragging ? "border-purple-500 bg-purple-500/10 scale-[1.01]" : "border-white/10"
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  const incomingFiles = Array.from(e.dataTransfer.files);
                  const newImages: string[] = [];
                  const newFiles: { name: string, url: string }[] = [];

                  incomingFiles.forEach(f => {
                    const url = URL.createObjectURL(f);
                    const isImage = f.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name);

                    if (isImage) {
                      newImages.push(url);
                    }
                    // Add all files to the file list regardless of type (User Request)
                    newFiles.push({ name: f.name, url });
                  });

                  setScrapedPost(prev => prev ? ({
                    ...prev,
                    images: [...(prev.images || []), ...newImages],
                    files: [...(prev.files || []), ...newFiles]
                  }) : null);
                }
              }}
            >
              {isDragging && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
                  <div className="text-center animate-bounce">
                    <Upload className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-white">Drop files here</h3>
                  </div>
                </div>
              )}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                    <FileText className="w-5 h-5 text-blue-400" /> Content Review
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">Review the scraped content before generating the script.</p>
                </div>
              </div>

              <div className="bg-black/40 p-6 rounded-xl border border-white/5 space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Title</label>
                  <input
                    type="text"
                    value={scrapedPost.title}
                    onChange={(e) => setScrapedPost({ ...scrapedPost, title: e.target.value })}
                    className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white font-bold text-lg focus:border-purple-500 outline-none"
                    placeholder="Enter project title..."
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Analysis Mode</label>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {[
                      { id: 'detail', label: 'Detailed Info', desc: 'Graphic Art with Full Text', img: '/images/styles/mode_preview_detail.png', color: 'purple' },
                      { id: 'summary', label: 'Key Summary', desc: 'Focus on main takeaways', img: '/images/styles/mode_preview_summary.png', color: 'blue' },
                      { id: 'promo', label: 'Event Promo', desc: 'Energetic promotional style', img: '/images/styles/mode_preview_promo.png', color: 'pink' },
                      { id: 'infographic', label: 'Infographic', desc: 'Visual structured data & Charts', img: '/images/styles/mode_preview_infographic.png', color: 'teal' },
                      { id: 'album', label: 'Photo Album', desc: '1 Scene per Image', img: '/images/styles/mode_preview_album.png', color: 'orange' },
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => setAnalysisMode(mode.id as any)}
                        className={clsx(
                          "relative h-24 rounded-lg text-left transition-all overflow-hidden group shadow-lg ring-1",
                          analysisMode === mode.id
                            ? `ring-${mode.color}-500 ring-2 scale-[1.02]`
                            : "ring-white/10 hover:scale-[1.02] hover:ring-white/30"
                        )}
                      >
                        {/* Background Image */}
                        <div
                          className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                          style={{ backgroundImage: `url(${mode.img})` }}
                        />

                        {/* Dark Overlay */}
                        <div className={clsx(
                          "absolute inset-0 transition-colors duration-300",
                          analysisMode === mode.id ? "bg-black/50" : "bg-black/70 group-hover:bg-black/60"
                        )} />

                        {/* Content */}
                        <div className="relative z-10 p-3 h-full flex flex-col justify-between">
                          <div className="flex justify-between items-start">
                            <span className={clsx("font-bold text-sm leading-tight", analysisMode === mode.id ? "text-white" : "text-gray-200")}>
                              {mode.label}
                            </span>
                            {analysisMode === mode.id && <CheckCircle className={clsx("w-4 h-4", `text-${mode.color}-400`)} />}
                          </div>
                          <p className="text-[10px] text-gray-300 font-medium opacity-90 leading-tight">{mode.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Scene Count Selector */}
                  <div className="mt-4 flex flex-col md:flex-row gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Scene Count</label>
                      <div className="flex flex-wrap gap-2 items-center">
                        {['AUTO', 4, 6, 8, 10, 12].map((count) => (
                          <button
                            key={count}
                            onClick={() => setSceneCount(count as any)}
                            className={clsx(
                              "px-3 py-1.5 rounded text-xs font-bold border transition-all",
                              sceneCount === count
                                ? "bg-white text-black border-white"
                                : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white"
                            )}
                          >
                            {count === 'AUTO' ? 'Auto' : count}
                          </button>
                        ))}
                        <div className="flex items-center gap-2 border border-white/10 rounded px-3 py-1 bg-white/5">
                          <span className="text-[10px] text-gray-500 uppercase font-bold">Manual</span>
                          <input
                            type="number"
                            value={sceneCount === 'AUTO' || [4, 6, 8, 10, 12].includes(sceneCount as number) ? '' : sceneCount}
                            placeholder="#"
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              if (!isNaN(val) && val > 0) {
                                setSceneCount(val);
                              } else if (e.target.value === '') {
                                setSceneCount('AUTO');
                              }
                            }}
                            className="w-12 bg-transparent text-sm text-center text-white focus:outline-none focus:border-b border-white/20 font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Video Purpose Selector */}
                  <div className="mt-4">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Video Concept (Tone & Style)</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {[
                        { id: 'PR', label: 'Politics/PR', desc: 'Trust & Vision', icon: '🏛️' },
                        { id: 'Education', label: 'Education/Manual', desc: 'Friendly, Clear', icon: '📘' },
                        { id: 'Notice', label: 'Notice/Info', desc: 'Dry, Fact-based', icon: '📢' },
                        { id: 'Event', label: 'Event/Promo', desc: 'Energetic, Vivid', icon: '🎉' },
                      ].map((purpose) => (
                        <button
                          key={purpose.id}
                          onClick={() => setVideoPurpose(purpose.id as any)}
                          className={clsx(
                            "flex flex-col items-center justify-center p-2 rounded-lg border transition-all h-16",
                            videoPurpose === purpose.id
                              ? "bg-white text-black border-white"
                              : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <div className="text-lg mb-1">{purpose.icon}</div>
                          <div className="text-xs font-bold leading-none">{purpose.label}</div>
                          <div className="text-[9px] opacity-70 mt-1">{purpose.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Narration Length Selector */}
                  <div className="mt-4">
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Narration Length</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'Short', label: 'Short', desc: 'Fast (~2 sent.)' },
                        { id: 'Medium', label: 'Medium', desc: 'Balanced (~3-4 sent.)' },
                        { id: 'Long', label: 'Long', desc: 'Detailed (5+ sent.)' },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setNarrationLength(opt.id as any)}
                          className={clsx(
                            "flex flex-col items-center justify-center p-2 rounded-lg border transition-all h-14",
                            narrationLength === opt.id
                              ? "bg-white text-black border-white"
                              : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <div className="text-xs font-bold leading-none">{opt.label}</div>
                          <div className="text-[9px] opacity-70 mt-1">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Album Mode Options */}
                  {analysisMode === 'album' && (
                    <div className="mt-4 p-4 bg-pink-500/5 border border-pink-500/20 rounded-xl animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-pink-400" />
                          <span className="text-sm font-bold text-gray-200">Allow AI Image Variation</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input type="checkbox" checked={allowImageVariation} onChange={e => setAllowImageVariation(e.target.checked)} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                        </label>
                      </div>
                      <p className="text-xs text-gray-400 mt-2 pl-6">
                        {allowImageVariation
                          ? "AI will generate creative variations based on your photos."
                          : "Original photos will be used as-is. (No AI generation)"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Published Date</label>
                <p className="text-gray-300 text-sm">{scrapedPost.date}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Images ({scrapedPost.images?.length || 0})</label>
                {scrapedPost.images && scrapedPost.images.length > 0 ? (
                  <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                    {scrapedPost.images.map((img, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={img}
                        onClick={() => setPreviewImage(img)}
                        className="h-24 w-auto rounded-lg border border-white/10 object-cover cursor-pointer hover:opacity-80 hover:scale-105 transition-all"
                        alt="scraped content"
                      />
                    ))}
                  </div>
                ) : <span className="text-gray-500 text-xs italic">No images found</span>}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Full Content (Editable)</label>
                <textarea
                  value={scrapedPost.content}
                  onChange={(e) => setScrapedPost(prev => prev ? ({ ...prev, content: e.target.value }) : null)}
                  className="w-full text-gray-300 text-sm leading-relaxed whitespace-pre-wrap h-80 overflow-y-auto custom-scrollbar p-3 bg-white/5 rounded-lg border border-white/5 focus:border-purple-500 focus:bg-white/10 outline-none transition-all resize-y"
                  placeholder="Content text..."
                />
              </div>

              {/* New: Custom AI Prompt Injection */}
              <div>
                <label className="text-xs font-bold text-purple-400 uppercase mb-1 flex items-center gap-2">
                  <Sparkles className="w-3 h-3" /> Additional AI Instructions (Optional)
                </label>
                <textarea
                  value={customAiPrompt}
                  onChange={(e) => setCustomAiPrompt(e.target.value)}
                  className="w-full text-white text-sm h-24 p-3 bg-purple-900/10 rounded-lg border border-purple-500/30 focus:border-purple-500 focus:bg-purple-900/20 outline-none transition-all resize-y placeholder-gray-500"
                  placeholder="E.g., Make the tone very sarcastic, Mention the company name 'Acme' in every scene, Use a question for every scene title..."
                />
              </div>

              {/* File Selection Area */}
              <div className="pt-4 border-t border-white/5">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-gray-500 uppercase block">
                    Attached Files ({scrapedPost.files?.length || 0})
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 italic">or Drag & Drop</span>
                    <label className="cursor-pointer bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded text-[10px] flex items-center gap-1 transition-colors">
                      <Upload className="w-3 h-3" />
                      <span>Upload File</span>
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files) {
                            const incomingFiles = Array.from(e.target.files);
                            const newImages: string[] = [];
                            const newFiles: { name: string, url: string }[] = [];

                            incomingFiles.forEach(f => {
                              const url = URL.createObjectURL(f);
                              const isImage = f.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name);

                              if (isImage) {
                                newImages.push(url);
                              }
                              // Add all files to the file list regardless of type (User Request)
                              newFiles.push({ name: f.name, url });
                            });

                            setScrapedPost(prev => prev ? ({
                              ...prev,
                              images: [...(prev.images || []), ...newImages],
                              files: [...(prev.files || []), ...newFiles]
                            }) : null);
                          }
                        }}
                      />
                    </label>
                    <span className="text-xs font-normal text-yellow-500">* PDF recommended</span>
                  </div>
                </div>
                {(scrapedPost.files && scrapedPost.files.length > 0) && (
                  <div className="space-y-2">
                    {scrapedPost.files.map((file, idx) => (
                      <label key={idx} className={clsx(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        selectedFiles.has(file.url)
                          ? "bg-blue-500/10 border-blue-500/50"
                          : "bg-white/5 border-white/5 hover:bg-white/10"
                      )}>
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.url)}
                          onChange={(e) => {
                            const newSet = new Set(selectedFiles);
                            if (e.target.checked) newSet.add(file.url);
                            else newSet.delete(file.url);
                            setSelectedFiles(newSet);
                          }}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className={clsx(
                                "text-sm truncate font-medium hover:underline hover:text-blue-400 decoration-blue-400/50 underline-offset-4",
                                selectedFiles.has(file.url) ? "text-blue-200" : "text-gray-300"
                              )}>{file.name}</a>
                          </div>
                        </div>
                        {file.name.toLowerCase().endsWith('.pdf') && (
                          <div className="px-2 py-0.5 bg-red-500/20 text-red-300 text-[10px] rounded font-mono">PDF</div>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Estimated Cost Display */}
              <div className="flex-1 flex items-center justify-end px-4">
                <div className="text-right">
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Est. Budget Breakdown</div>
                  <div className="flex gap-4">
                    {/* Helper to calculate effective count */}
                    {(() => {
                      const effectiveCount = sceneCount === 'AUTO' ? 8 : (sceneCount as number);
                      return (
                        <>
                          <div className="text-right">
                            <span className="block text-[9px] text-gray-500">Scenario</span>
                            <span className="block text-xs text-gray-300 font-mono">~₩{Math.round((((scrapedPost?.content?.length || 0) * 1.5) / 1000000 * 0.075 + 0.002) * 1450).toLocaleString()}</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[9px] text-gray-500">Images (x{effectiveCount})</span>
                            <span className="block text-xs text-gray-300 font-mono">~₩{Math.round(effectiveCount * 58).toLocaleString()}</span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[9px] text-gray-500">Narration (x{effectiveCount})</span>
                            <span className="block text-xs text-gray-300 font-mono">~₩{Math.round(effectiveCount * 20).toLocaleString()}</span>
                          </div>
                          <div className="text-right pl-4 border-l border-white/10">
                            <span className="block text-[9px] text-purple-400 font-bold">TOTAL</span>
                            <span className="block text-xs text-purple-300 font-mono font-bold">~₩{Math.round(((((scrapedPost?.content?.length || 0) * 1.5) / 1000000 * 0.075 + 0.002) * 1450) + (effectiveCount * 58) + (effectiveCount * 20)).toLocaleString()}</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 justify-end pt-2 border-t border-white/5">
                <button
                  onClick={() => setScrapedPost(null)}
                  className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Back to List
                </button>
                <button
                  onClick={handleStartAnalysis}
                  disabled={isProcessing}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 px-8 py-3 rounded-xl font-bold text-white flex items-center gap-2 shadow-lg shadow-blue-900/20 hover:scale-105 transition-all"
                >
                  {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  Generate AI Script
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Analysis & Scenes */}
          {analysisResult && (
            <div className="space-y-6">
              <div className="bg-blue-900/20 p-6 rounded border border-blue-500/30">
                <h2 className="text-xl font-bold text-blue-400 flex items-center gap-2"><Sparkles className="w-5 h-5" /> AI Analysis</h2>
                <p className="text-sm mt-2">{analysisResult.summary}</p>
              </div>

              {/* Visual Analysis & Colors */}
              {/* AI Usage & Cost Estimation */}
              {analysisResult.usage && (
                <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl p-4 border border-white/10 mb-6 flex justify-between items-center shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-900/50 p-2 rounded-lg">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-200">AI Script Generation Cost</h4>
                      <div className="text-xs text-gray-400 flex gap-3 mt-1">
                        <span>Input: {(analysisResult.usage.inputTokens / 1000).toFixed(1)}k tokens</span>
                        <span>•</span>
                        <span>Output: {(analysisResult.usage.outputTokens / 1000).toFixed(1)}k tokens</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-green-400">
                      ₩{Math.round(analysisResult.usage.estimatedCostKRW).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                      Est. Budget (${analysisResult.usage.totalCostUSD.toFixed(5)})
                    </div>
                  </div>
                </div>
              )}

              {analysisResult.imageAnalysis && (
                <div className="space-y-3 pb-4 border-b border-white/10">
                  <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> Visual Analysis
                  </h4>
                  <div className="bg-white/5 p-3 rounded-lg space-y-2">
                    <div className="text-sm text-gray-300">
                      <span className="text-gray-500 font-bold uppercase text-xs block mb-1">Visual Style</span>
                      {analysisResult.imageAnalysis.visualStyle}
                    </div>
                    <div className="text-sm text-gray-300">
                      <span className="text-gray-500 font-bold uppercase text-xs block mb-1">Key Colors</span>
                      <div className="flex gap-2">
                        {dominantColors.map((color, i) => (
                          <div key={i} className="w-6 h-6 rounded-full border border-white/20 shadow-lg" style={{ backgroundColor: color }} title={color} />
                        ))}
                      </div>
                      <div className="text-xs text-gray-400 italic">"{analysisResult.imageAnalysis.summary}"</div>
                    </div>
                  </div>
                </div>
              )}


              {/* Custom Image Style Selection */}
              <div className="space-y-3 pb-6 border-b border-white/10">
                <h4 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Target Image Style
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {VISUAL_STYLES.map((style) => {
                    const isSelected = visualStyle === style.id;
                    return (
                      <button
                        key={style.id}
                        onClick={() => setVisualStyle(style.id)}
                        className={clsx(
                          "relative group overflow-hidden rounded-xl border transition-all aspect-[4/3] text-left",
                          isSelected
                            ? "border-pink-500 ring-2 ring-pink-500/50 shadow-lg shadow-pink-900/20"
                            : "border-white/10 hover:border-white/30"
                        )}
                      >
                        {/* Background Image */}
                        <div className="absolute inset-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={style.image}
                            alt={style.label}
                            className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-all group-hover:scale-105"
                          />
                          <div className={clsx(
                            "absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent transition-opacity",
                            isSelected ? "opacity-90" : "opacity-80 group-hover:opacity-60"
                          )} />
                        </div>

                        {/* Content */}
                        <div className="absolute inset-0 p-3 flex flex-col justify-end">
                          <div className="flex justify-between items-end mb-1">
                            <span className={clsx(
                              "font-bold text-sm transition-colors",
                              isSelected ? "text-white" : "text-gray-200"
                            )}>
                              {style.label}
                            </span>
                            {isSelected && <CheckCircle className="w-4 h-4 text-pink-500" />}
                          </div>
                          <p className="text-[10px] text-gray-400 line-clamp-1">{style.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Advanced Style Settings */}
              <div className="space-y-3 pb-6 border-b border-white/10">
                <h4 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                  <Settings className="w-4 h-4" /> Advanced Style Settings
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Composition */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase block">Composition</label>
                    <div className="relative">
                      <select
                        value={imageComposition}
                        onChange={(e) => setImageComposition(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-pink-500 outline-none appearance-none"
                      >
                        {COMPOSITION_STYLES.map(s => (
                          <option key={s.id} value={s.id} className="bg-gray-900 text-gray-200">{s.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-gray-500 min-h-[1.5em]">{COMPOSITION_STYLES.find(s => s.id === imageComposition)?.description}</p>
                  </div>

                  {/* Mood */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase block">Mood & Tone</label>
                    <div className="relative">
                      <select
                        value={imageMood}
                        onChange={(e) => setImageMood(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-pink-500 outline-none appearance-none"
                      >
                        {MOOD_STYLES.map(s => (
                          <option key={s.id} value={s.id} className="bg-gray-900 text-gray-200">{s.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-gray-500 min-h-[1.5em]">{MOOD_STYLES.find(s => s.id === imageMood)?.description}</p>
                  </div>

                  {/* Interpretation */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase block">Interpretation</label>
                    <div className="relative">
                      <select
                        value={imageInterpretation}
                        onChange={(e) => setImageInterpretation(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 focus:border-pink-500 outline-none appearance-none"
                      >
                        {INTERPRETATION_STYLES.map(s => (
                          <option key={s.id} value={s.id} className="bg-gray-900 text-gray-200">{s.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-gray-500 min-h-[1.5em]">{INTERPRETATION_STYLES.find(s => s.id === imageInterpretation)?.description}</p>
                  </div>
                </div>

                {/* Re-analyze Button */}
                {analysisResult && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={handleReAnalyze}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-pink-900/20 transition-all flex items-center gap-2"
                    >
                      {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Update Analysis & Prompts
                    </button>
                  </div>
                )}
              </div>

              {/* Audio & Voice Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-white/10">
                {/* Voice Style */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-gray-400 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" /> Narration Voice
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className={clsx("text-xs font-bold", narrationEnabled ? "text-green-400" : "text-gray-500")}>
                        {narrationEnabled ? "ON" : "OFF"}
                      </span>
                      <button
                        onClick={() => setNarrationEnabled(!narrationEnabled)}
                        className={clsx("w-10 h-5 rounded-full relative transition-colors", narrationEnabled ? "bg-green-600" : "bg-gray-700")}
                      >
                        <div className={clsx("w-3 h-3 rounded-full bg-white absolute top-1 transition-all", narrationEnabled ? "left-6" : "left-1")}></div>
                      </button>
                    </div>
                  </div>


                </div>




              </div>

              {/* SNS Platform Selection */}
              <div className="space-y-4 pb-6 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <VideoIcon className="w-4 h-4" /> Target Platform
                  </h4>
                  <div className="flex-1 h-px bg-white/5"></div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {(Object.keys(platformConfigs) as SNSPlatform[]).map((platform) => {
                    const config = platformConfigs[platform];
                    const isSelected = selectedPlatform === platform;

                    return (
                      <button
                        key={platform}
                        onClick={() => {
                          setSelectedPlatform(platform);
                          // Auto-sync image aspect ratio
                          if (platformConfigs[platform].aspectRatio !== 'Custom') {
                            setImageAspectRatio(platformConfigs[platform].aspectRatio as any);
                          }
                        }}
                        className={clsx(
                          "p-4 rounded-xl border transition-all text-center relative overflow-hidden group",
                          isSelected
                            ? "bg-gradient-to-br from-purple-600/20 to-blue-600/20 border-purple-500 ring-2 ring-purple-500/50 shadow-lg shadow-purple-900/20"
                            : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                        )}
                      >
                        <div className="text-3xl mb-2">{config.icon}</div>
                        <div className="text-xs font-bold text-white mb-1">{config.name}</div>
                        <div className={clsx(
                          "text-[10px] font-mono",
                          isSelected ? "text-purple-300" : "text-gray-500"
                        )}>
                          {config.aspectRatio}
                        </div>
                        <div className={clsx(
                          "text-[9px] font-mono mt-0.5",
                          isSelected ? "text-purple-400/70" : "text-gray-600"
                        )}>
                          {config.width}×{config.height}
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle className="w-4 h-4 text-purple-400" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Custom Size Input */}
                {selectedPlatform === 'custom' && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10 animate-in fade-in slide-in-from-top duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Width (px)</label>
                        <input
                          type="number"
                          value={customWidth}
                          onChange={(e) => setCustomWidth(parseInt(e.target.value) || 1280)}
                          min="480"
                          max="3840"
                          step="10"
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">Height (px)</label>
                        <input
                          type="number"
                          value={customHeight}
                          onChange={(e) => setCustomHeight(parseInt(e.target.value) || 720)}
                          min="480"
                          max="3840"
                          step="10"
                          className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-gray-500 text-center">
                      Aspect Ratio: {(customWidth / customHeight).toFixed(2)}:1
                    </div>
                  </div>
                )}
              </div>

              {/* Image Aspect Ratio Selection */}
              <div className="bg-white/5 p-4 rounded-xl border border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <ImageIcon className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-200">Image Aspect Ratio</h4>
                    <p className="text-[10px] text-gray-500">Choose aspect ratio for AI-generated images</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {['16:9', '9:16', '1:1', '4:3'].map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setImageAspectRatio(ratio as any)}
                      className={clsx(
                        "px-3 py-2 rounded-lg text-xs font-bold transition-all",
                        imageAspectRatio === ratio
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20"
                          : "bg-white/5 text-gray-400 hover:bg-white/10"
                      )}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>





              {/* Safety & Branding Settings */}


              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold text-gray-400 uppercase flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Scene List
                </h3>
                <div className="flex items-center gap-2">
                  {/* Template Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                      className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all"
                      title="Scene Templates"
                    >
                      <LayoutTemplate className="w-3 h-3" /> Templates
                    </button>
                    {showTemplateMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-2xl z-50 w-64 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-2 border-b border-white/10">
                          <button
                            onClick={handleSaveTemplate}
                            className="w-full text-left px-3 py-2 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 text-xs font-bold flex items-center gap-2 transition-colors"
                          >
                            <Save className="w-3 h-3" /> Save Current as Template
                          </button>
                        </div>
                        {savedTemplates.length === 0 ? (
                          <div className="p-4 text-center text-xs text-gray-500">No saved templates</div>
                        ) : (
                          <div className="max-h-48 overflow-y-auto custom-scrollbar">
                            {savedTemplates.map((t, i) => (
                              <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors group">
                                <button
                                  onClick={() => handleLoadTemplate(i)}
                                  className="flex-1 text-left text-xs text-gray-300 hover:text-white truncate"
                                >
                                  {t.name}
                                  <span className="ml-2 text-gray-600 text-[10px]">{t.scenes.length} scenes</span>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(i); }}
                                  className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right mr-2">
                    <span className="block text-[10px] text-gray-500 font-bold">EST. COST</span>
                    <span className="block text-xs text-purple-300 font-mono">₩{(sceneItems.filter(s => s.isEnabled !== false).length * 58).toLocaleString()}</span>
                  </div>
                  {/* Bulk Image Upload */}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    ref={el => { (window as any).__bulkUploadRef = el; }}
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length === 0) return;
                      files.forEach((file, i) => {
                        if (i < sceneItems.length) {
                          handleSceneImageUpload(i, file);
                        }
                      });
                      e.target.value = '';
                    }}
                  />
                  <button
                    onClick={() => (window as any).__bulkUploadRef?.click()}
                    className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all"
                    title="Upload multiple images to scenes in order"
                  >
                    <Upload className="w-3 h-3" /> Bulk Upload
                  </button>
                  <button
                    onClick={handleGenerateAllImages}
                    disabled={isProcessing}
                    className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-900/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Generate All Images
                  </button>
                </div>
                <div className="flex items-center gap-2 ml-4 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg">
                  <span className="text-xs text-gray-400 font-bold uppercase">Simulate Images</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isVisualSimulation}
                      onChange={(e) => setIsVisualSimulation(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                {sceneItems.map((item, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => {
                      setDragIdx(idx);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDropIdx(idx);
                    }}
                    onDragLeave={() => setDropIdx(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragIdx !== null && dragIdx !== idx) {
                        const updated = [...sceneItems];
                        const [moved] = updated.splice(dragIdx, 1);
                        updated.splice(idx, 0, moved);
                        setSceneItems(updated);
                      }
                      setDragIdx(null);
                      setDropIdx(null);
                    }}
                    onDragEnd={() => { setDragIdx(null); setDropIdx(null); }}
                    className={clsx(
                      "bg-white/5 p-4 rounded-xl border transition-all flex gap-4 cursor-grab active:cursor-grabbing",
                      item.isEnabled === false && "opacity-50 grayscale-[0.5]",
                      dragIdx === idx && "opacity-40 scale-95 border-purple-500/50",
                      dropIdx === idx && dragIdx !== idx && "border-purple-400 bg-purple-500/10 shadow-lg shadow-purple-900/20",
                      dropIdx !== idx && dragIdx !== idx && "border-white/5 hover:border-white/10"
                    )}>
                    {/* Thumbnail */}
                    <div className={clsx(
                      "w-40 h-28 bg-black rounded-lg flex items-center justify-center relative overflow-hidden shadow-lg group border transition-all",
                      item.status === 'generating' ? "border-purple-500/50 animate-pulse bg-purple-500/5" : "border-transparent"
                    )}>
                      {/* Hidden file input for image upload */}
                      <input
                        type="file"
                        accept="image/*"
                        ref={el => { sceneFileInputRefs.current[idx] = el; }}
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleSceneImageUpload(idx, file);
                          e.target.value = ''; // Reset
                        }}
                      />
                      {item.imageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.imageUrl}
                            className="w-full h-full object-cover transition-transform group-hover:scale-110 cursor-zoom-in"
                            alt={`Scene ${idx + 1}`}
                            onClick={() => setPreviewImage(item.imageUrl)}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setPreviewImage(item.imageUrl); }}
                              className="text-white text-xs font-bold flex items-center gap-1 bg-black/30 px-2 py-1 rounded hover:bg-black/50 transition-colors"
                            >
                              <Sparkles className="w-3 h-3" /> View
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); sceneFileInputRefs.current[idx]?.click(); }}
                              className="text-white text-xs font-bold flex items-center gap-1 bg-black/30 px-2 py-1 rounded hover:bg-black/50 transition-colors"
                            >
                              <Upload className="w-3 h-3" /> Replace
                            </button>
                          </div>
                        </>
                      ) : item.status === 'generating' ? (
                        <div className="flex flex-col items-center gap-2 text-purple-400">
                          <Loader2 className="w-6 h-6 animate-spin" />
                          <span className="text-xs font-bold animate-pulse">Generating...</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => sceneFileInputRefs.current[idx]?.click()}
                          className="flex flex-col items-center gap-1 text-gray-600 hover:text-gray-400 transition-colors cursor-pointer"
                        >
                          <Upload className="w-6 h-6" />
                          <span className="text-[10px] font-bold">Upload</span>
                        </button>
                      )}
                      {/* Status Badge */}
                      {item.status === 'approved' && <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow z-10">APPROVED</div>}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-gray-200 cursor-pointer hover:text-purple-300 transition-colors" onClick={() => handleSeekToScene(idx)} title="Click to preview">
                            Scene {idx + 1} {item.title && <span className="ml-2 text-pink-400 text-xs font-normal">[{item.title}]</span>}
                          </h4>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer bg-black/20 px-2 py-0.5 rounded border border-white/5 hover:border-white/20 transition-colors">
                              <input
                                type="checkbox"
                                checked={item.isEnabled !== false}
                                onChange={(e) => {
                                  const updated = [...sceneItems];
                                  updated[idx].isEnabled = e.target.checked;
                                  setSceneItems(updated);
                                }}
                                className="accent-green-500 w-3 h-3"
                              />
                              <span className={clsx("text-[10px] font-bold uppercase", item.isEnabled !== false ? "text-green-400" : "text-gray-500")}>
                                {item.isEnabled !== false ? "ON" : "OFF"}
                              </span>
                            </label>

                            {/* Move Buttons */}
                            <div className="flex bg-black/20 rounded border border-white/5">
                              <button
                                onClick={() => handleDeleteScene(idx)}
                                disabled={sceneItems.length <= 1}
                                className="px-1.5 py-0.5 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed border-r border-white/5 transition-colors"
                                title="Delete Scene"
                              >
                                <Trash2 className="w-3 h-3 text-gray-400" />
                              </button>
                              <button
                                onClick={() => handleDuplicateScene(idx)}
                                className="px-1.5 py-0.5 hover:bg-blue-500/20 hover:text-blue-400 border-r border-white/5 transition-colors"
                                title="Duplicate Scene"
                              >
                                <Copy className="w-3 h-3 text-gray-400" />
                              </button>
                              <button
                                onClick={() => handleMoveScene(idx, -1)}
                                disabled={idx === 0}
                                className="px-1.5 py-0.5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed border-r border-white/5 transition-colors"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3 h-3 text-gray-400" />
                              </button>
                              <button
                                onClick={() => handleMoveScene(idx, 1)}
                                disabled={idx === sceneItems.length - 1}
                                className="px-1.5 py-0.5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3 h-3 text-gray-400" />
                              </button>
                            </div>

                            <select
                              value={item.transition}
                              onChange={(e) => {
                                const updated = [...sceneItems];
                                updated[idx].transition = e.target.value as any;
                                setSceneItems(updated);
                              }}
                              className="bg-gray-900 text-[10px] text-gray-200 border border-white/10 rounded px-2 py-0.5 outline-none focus:border-purple-500 hover:bg-gray-800 cursor-pointer"
                            >
                              <option value="none">Basic: None</option>
                              <option value="fade">Basic: Fade In</option>
                              <option value="scale_up">Basic: Scale Up</option>
                              <option value="pop_in">Basic: Pop In</option>
                              <option value="blink">Basic: Blink</option>

                              <optgroup label="Directional">
                                <option value="slide_left">Slide Left</option>
                                <option value="slide_right">Slide Right</option>
                                <option value="slide_up">Slide Up</option>
                                <option value="slide_down">Slide Down</option>
                                <option value="wipe_left">Wipe Left</option>
                                <option value="wipe_right">Wipe Right</option>
                                <option value="drop_in">Drop In</option>
                                <option value="panorama_left">Panorama Left</option>
                                <option value="panorama_right">Panorama Right</option>
                              </optgroup>

                              <optgroup label="Style">
                                <option value="shake">Shake</option>
                              </optgroup>

                              <optgroup label="Cinematic">
                                <option value="zoom_blur">Zoom Blur (Speed w/ Glow)</option>
                                <option value="motion_wipe">Motion Wipe (w/ Trails)</option>
                                <option value="luma_fade">Luma Dissolve (Tech Fade)</option>
                                <option value="glitch">Glitch (RGB Split)</option>
                              </optgroup>
                            </select>
                            <input
                              type="number"
                              min={3}
                              max={60}
                              step={0.5}
                              value={item.duration}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 3 && val <= 60) {
                                  const updated = [...sceneItems];
                                  updated[idx].duration = val;
                                  setSceneItems(updated);
                                }
                              }}
                              className="w-14 bg-black/40 text-xs text-gray-300 font-mono border border-white/10 rounded px-1.5 py-0.5 outline-none focus:border-purple-500 text-center hover:border-white/20 transition-colors"
                              title="Scene duration (seconds)"
                            />
                          </div>
                        </div>

                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2 items-start">
                            <span className="bg-blue-500/10 text-blue-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 mt-0.5">Narration</span>
                            <textarea
                              value={item.text}
                              onChange={(e) => {
                                const updated = [...sceneItems];
                                updated[idx].text = e.target.value;
                                setSceneItems(updated);
                              }}
                              className="text-xs text-gray-300 leading-relaxed bg-black/20 border border-white/5 rounded px-2 py-1 w-full focus:border-blue-500 outline-none resize-none h-12"
                            />
                          </div>
                          <div className="flex gap-2 items-start">
                            <span className="bg-pink-500/20 text-pink-300 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 mt-0.5">Subtitle</span>
                            <textarea
                              value={item.subtitle}
                              onChange={(e) => {
                                const updated = [...sceneItems];
                                updated[idx].subtitle = e.target.value;
                                setSceneItems(updated);
                              }}
                              className="text-sm text-white font-medium bg-black/20 border border-white/5 rounded px-2 py-1 w-full focus:border-pink-500 outline-none resize-none h-8"
                            />
                          </div>
                        </div>

                        <div className="flex items-start gap-2 mt-3 text-[10px] text-gray-500 bg-black/30 p-2 rounded border border-white/5">
                          <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                            <span className="text-purple-400 font-bold uppercase">Prompt</span>
                            <button
                              onClick={() => handleGenerateSceneImage(idx)}
                              disabled={item.status === 'generating'}
                              className="p-1 rounded hover:bg-purple-500/20 text-gray-500 hover:text-purple-400 transition-colors disabled:opacity-30"
                              title="Regenerate image with this prompt"
                            >
                              <RefreshCw className={clsx("w-3 h-3", item.status === 'generating' && "animate-spin")} />
                            </button>
                          </div>
                          <textarea
                            value={item.imagePrompt}
                            onChange={(e) => {
                              const updated = [...sceneItems];
                              updated[idx].imagePrompt = e.target.value;
                              setSceneItems(updated);
                            }}
                            className="italic text-gray-400 bg-transparent border-none w-full focus:ring-0 outline-none resize-none h-12 leading-relaxed"
                          />
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3 justify-end">
                        {item.status === 'generated' || item.status === 'approved' ? (
                          <>
                            <button
                              onClick={() => handleGenerateSceneImage(idx)}
                              className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium flex items-center gap-2 transition-colors text-gray-300"
                            >
                              <RotateCcw className="w-3 h-3" /> Regenerate
                            </button>
                            <button
                              onClick={() => handleApproveScene(idx)}
                              disabled={item.status === 'approved'}
                              className={clsx(
                                "px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-transform active:scale-95",
                                item.status === 'approved' ? "bg-green-500/20 text-green-400 cursor-default" : "bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20"
                              )}
                            >
                              <ThumbsUp className="w-3 h-3" /> {item.status === 'approved' ? 'Approved' : 'Approve'}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleGenerateSceneImage(idx)}
                            disabled={item.status === 'generating'}
                            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium flex items-center gap-2 shadow-lg shadow-purple-900/20"
                          >
                            <Sparkles className="w-3 h-3" />
                            {item.status === 'generating' ? 'Generating...' : (
                              <span>Generate Image <span className="opacity-70 font-normal ml-0.5 text-[10px]">(~₩58)</span></span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Empty Scene Button */}
              <button
                onClick={handleAddEmptyScene}
                className="w-full py-3 border-2 border-dashed border-white/10 hover:border-purple-500/50 rounded-xl text-gray-400 hover:text-purple-300 flex items-center justify-center gap-2 transition-all hover:bg-purple-500/5"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-bold">Add Empty Scene</span>
              </button>

              <button
                onClick={() => {
                  const hasUnapproved = sceneItems.some(s => s.status === 'generated');
                  if (hasUnapproved) {
                    alert("승인 되지 않은 이미지가 있습니다. 승인 후 다음 단계로 진행하세요");
                    return;
                  }

                  if (narrationEnabled) {
                    setIsNarrationReview(true);
                  } else {
                    if (sceneItems.length === 0) {
                      alert("No scenes to render.");
                      return;
                    }
                    setShowRenderSettings(true);
                  }
                }}
                className="w-full bg-gradient-to-r from-orange-500 to-pink-500 py-4 rounded font-bold text-lg hover:scale-[1.01] transition-transform flex items-center justify-center gap-3"
              >
                {narrationEnabled ? (
                  <>
                    <MessageSquare className="w-6 h-6" /> Proceed to Narration Studio
                  </>
                ) : (
                  <>
                    <Sparkles className="w-6 h-6" /> Confirm & Render Video
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )
      }

      {/* Narration Studio Overlay */}
      {
        isNarrationReview && (
          <div className="fixed inset-0 z-50 bg-[#0a0a0a] overflow-y-auto animate-in fade-in duration-300 flex flex-col">
            <div className="container mx-auto px-4 py-6 max-w-6xl flex-1 flex flex-col">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-200">
                    Narration Studio
                  </h2>
                  <p className="text-gray-400 text-sm">Fine-tune voice, speed, and pitch for each scene.</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsNarrationReview(false)}
                    className="px-4 py-2 text-gray-400 hover:text-white font-bold transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      const hasUnapproved = sceneItems.some(s => s.status === 'generated');
                      if (hasUnapproved) {
                        if (!confirm("Warning: Some images are not approved. Proceed anyway?")) return;
                      }
                      if (sceneItems.length === 0) {
                        alert("No scenes to render.");
                        return;
                      }
                      setShowRenderSettings(true);
                    }}
                    className="px-6 py-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-400 hover:to-pink-400 text-white font-bold rounded-full shadow-lg transition-all hover:scale-105 flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> To Render
                  </button>
                </div>
              </div>

              {/* Studio Component */}
              <div className="flex-1 overflow-y-auto bg-[#0a0a0a] min-h-0">
                <NarrationStudio
                  scenes={sceneItems.map(s => ({
                    ...s,
                    status: s.status, // Ensure string type compatibility
                    text: s.text,
                    imagePrompt: s.imagePrompt,
                    imageUrl: s.imageUrl,
                    subtitle: s.subtitle,
                    duration: s.duration,
                    transition: s.transition,
                    audioUrl: s.audioUrl,
                    audioDuration: s.audioDuration,
                    isEnabled: s.isEnabled,
                    narrationSettings: s.narrationSettings
                  }))}
                  onUpdate={(updatedLines) => {
                    // Map back to SceneItems. 
                    // NarrationScene is subset/compatible, but we should be careful not to lose other props if any.
                    // Since we passed sceneItems mapped, we can merge back.
                    setSceneItems(prev => prev.map((item, i) => ({
                      ...item,
                      ...updatedLines[i],
                      transition: updatedLines[i].transition as any,
                      status: item.status // Preserve original status strict type
                    })));
                  }}
                  onGenerateAudio={handleGenerateSceneAudio}
                  globalSettings={{
                    voice: voiceStyle,
                    tone: narrationTone, // Pass Tone
                    speed: narrationSpeed,
                    pitch: narrationPitch,
                    volume: narrationVolume,
                    customPrompt: customVoicePrompt // Pass Custom Prompt
                  }}
                  onGlobalSettingsChange={(s) => {
                    setVoiceStyle(s.voice);
                    setNarrationTone(s.tone);
                    setNarrationSpeed(s.speed);
                    setNarrationPitch(s.pitch);
                    setNarrationVolume(s.volume);
                    setCustomVoicePrompt(s.customPrompt || ""); // Update Custom Prompt
                  }}
                  onPreviewVoice={handlePreviewVoice}
                  previewingVoiceId={previewingVoiceId}
                  isPlaying={false}
                  onPlayPause={() => { }}
                />
              </div>
            </div>
          </div>
        )
      }

      {/* MODE: RENDERING / RESULT */}
      {
        (isRendering || videoBlobUrl || showRenderer) && (
          <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center animate-in zoom-in duration-300">

            {/* Render Output Area */}
            <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-white/5">
              {!videoBlobUrl ? (
                <>
                  <div className="absolute top-4 left-4 bg-black/80 text-green-400 font-mono text-xs p-3 rounded border border-green-500/30 max-w-[80vw] overflow-y-auto max-h-[60vh] custom-scrollbar pointer-events-auto">
                    <div className="flex items-center gap-2 mb-2 border-b border-green-500/30 pb-1">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      RENDER LOGS (SYNC: AUDIO)
                    </div>
                    <div className="flex flex-col gap-1 opacity-90 whitespace-pre-wrap break-words">
                      {renderLogs.map((log, i) => (
                        <div key={i}>{`> ${log}`}</div>
                      ))}
                    </div>
                  </div>

                  <WebGPURenderer
                    scenes={rendererScenes}
                    audioSrc={rendererAudioSrc}
                    audioVolume={audioVolume}
                    introMedia={introMedia}
                    outroMedia={outroMedia}
                    narrationEnabled={narrationEnabled}
                    voiceStyle={voiceStyle}
                    narrationSpeed={1.0} // Baked via Prompt
                    narrationTone={narrationTone}
                    tickerSpeed={tickerSpeed} // Add Ticker Speed
                    subtitleSpeed={subtitleSpeed}
                    aiDisclosureEnabled={aiDisclosureEnabled}
                    watermarkUrl={watermarkUrl}
                    canvasWidth={selectedPlatform === 'custom' ? customWidth : platformConfigs[selectedPlatform].width}
                    canvasHeight={selectedPlatform === 'custom' ? customHeight : platformConfigs[selectedPlatform].height}
                    subtitleFontSize={subtitleFontSize}
                    narrationFontSize={narrationFontSize}
                    showSubtitles={showSubtitles}
                    showNarrationText={showNarrationText}
                    subtitleColor={subtitleColor}
                    narrationColor={narrationColor}
                    subtitleFont={subtitleFont}
                    narrationFont={narrationFont}
                    subtitleBackgroundColor={debouncedSubtitleBackgroundColor}
                    subtitleBackgroundOpacity={debouncedSubtitleBackgroundOpacity}
                    narrationBackgroundColor={debouncedNarrationBackgroundColor}
                    narrationBackgroundOpacity={debouncedNarrationBackgroundOpacity}
                    subtitleEffectStyle={subtitleEffectStyle}
                    subtitleEntranceAnimation={subtitleEntranceAnimation}
                    subtitleExitAnimation={subtitleExitAnimation}
                    subtitleEffectColor={subtitleEffectColor}
                    subtitleEffectParam={subtitleEffectParam}
                    subtitleOpacity={subtitleOpacity}
                    subtitleStrokeColor={subtitleStrokeColor}
                    subtitleStrokeWidth={subtitleStrokeWidth}
                    subtitleSyncShift={subtitleSyncShift}
                    backgroundColor={backgroundColor}
                    backgroundUrl={backgroundUrl}
                    qrCodeUrl={qrCodeImage}
                    qrCodeSize={qrCodeSize}
                    qrCodePosition={qrCodePosition}
                    scaleMode={imageAspectRatio === '16:9' ? 'contain' : 'cover'}
                    captionConfig={captionConfig}
                    overlayConfig={overlayConfig}
                    previewMode={false}
                    onComplete={handleRenderComplete}
                    onLog={handleRenderLog}
                    onProgress={(current, total) => {
                      setExportProgress({ current, total });
                      if (current < 0.1) exportStartTimeRef.current = Date.now();
                    }}
                  />
                  {/* Export Progress Bar */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Rendering... {Math.round((exportProgress.current / Math.max(exportProgress.total, 0.01)) * 100)}%</span>
                          <span>
                            {(() => {
                              const elapsed = (Date.now() - exportStartTimeRef.current) / 1000;
                              const pct = exportProgress.current / Math.max(exportProgress.total, 0.01);
                              if (pct < 0.05 || elapsed < 2) return 'Calculating...';
                              const remaining = (elapsed / pct) - elapsed;
                              if (remaining > 60) return `~${Math.round(remaining / 60)}m ${Math.round(remaining % 60)}s remaining`;
                              return `~${Math.round(remaining)}s remaining`;
                            })()}
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(100, (exportProgress.current / Math.max(exportProgress.total, 0.01)) * 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 font-mono shrink-0">
                        {new Date(exportProgress.current * 1000).toISOString().substr(14, 5)} / {new Date(exportProgress.total * 1000).toISOString().substr(14, 5)}
                      </span>
                    </div>
                  </div>
                  <div className="absolute top-8 right-8">
                    <div className="flex items-center gap-2 text-white/50 bg-black/50 px-3 py-1 rounded-full text-xs backdrop-blur-md">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Recording
                    </div>
                  </div>
                </>
              ) : (
                <video src={videoBlobUrl} controls className="w-full h-full" autoPlay />
              )}
            </div>

            {/* Result Actions */}
            {videoBlobUrl && (
              <div className="flex flex-col items-center gap-6 mt-8 animate-in slide-in-from-bottom duration-500">
                <h3 className="text-2xl font-bold text-white flex items-center gap-2">
                  <CheckCircle className="w-8 h-8 text-green-400" /> Video Ready!
                </h3>
                <div className="flex flex-col items-center gap-2 w-full max-w-xl">
                  <label className="text-xs font-medium text-gray-400 self-start">Project Name</label>
                  <input
                    type="text"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Enter project name..."
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => { setVideoBlobUrl(null); setIsRendering(false); setShowRenderer(false); setShowRenderSettings(true); }}
                    className="px-8 py-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-2 font-medium"
                  >
                    <Pencil className="w-4 h-4" /> Edit Settings
                  </button>
                  <a
                    href={videoBlobUrl}
                    download="auto-movie.webm"
                    className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-full transition-colors flex items-center gap-2"
                  >
                    <VideoIcon className="w-5 h-5" /> Download
                  </a>
                  <button
                    onClick={() => setShowSaveOptions(true)}
                    disabled={isSaving}
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold rounded-full shadow-lg shadow-blue-900/30 transition-transform hover:scale-105 flex items-center gap-2"
                  >
                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Save to Server
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      }

      {/* Server Project Gallery Modal */}
      {
        showServerGallery && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-3xl w-full max-w-6xl h-[85vh] shadow-2xl animate-in zoom-in duration-200 flex flex-col overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 className="text-2xl font-bold flex items-center gap-3 text-white">
                  <Film className="w-6 h-6 text-pink-400" /> Project Gallery
                </h3>
                <button
                  onClick={() => setShowServerGallery(false)}
                  className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Gallery Grid */}
              <div className="flex-1 overflow-y-auto p-8 bg-black/20">
                {serverVideos.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
                    <Film className="w-16 h-16 opacity-20" />
                    <p className="text-lg">No saved projects yet.</p>
                  </div>
                ) : (
                  <>
                    {/* Back Button for Hierarchy */}
                    {expandedProjectTitle && (
                      <button
                        onClick={() => setExpandedProjectTitle(null)}
                        className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                      >
                        <RotateCcw className="w-4 h-4" /> Back to Project List
                      </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {(() => {
                        // Grouping Logic
                        const grouped = serverVideos.reduce((acc, curr) => {
                          // Use groupTitle if available, otherwise try to extract base title from title, or fallback to title
                          let key = curr.groupTitle;
                          if (!key && curr.title) {
                            // Attempt to strip " - N" suffix to group variations
                            key = curr.title.replace(/ - \d+$/, "").trim();
                          }
                          key = key || "Untitled Project";

                          if (!acc[key]) acc[key] = [];
                          acc[key].push(curr);
                          return acc;
                        }, {} as Record<string, any[]>);

                        // If expanded, show only videos in that group
                        if (expandedProjectTitle) {
                          const videos = grouped[expandedProjectTitle] || [];
                          return videos.map((proj: any) => (
                            <div key={proj.id} className="group bg-white/5 border border-white/5 rounded-2xl overflow-hidden hover:border-pink-500/50 hover:shadow-2xl hover:shadow-pink-900/20 transition-all duration-300 flex flex-col">
                              {/* Video Preview */}
                              <div
                                className="aspect-video bg-black relative cursor-pointer"
                                onClick={() => setSelectedProject(proj)}
                              >
                                {proj.thumbnailPath ? (
                                  <img
                                    src={proj.thumbnailPath}
                                    className="w-full h-full object-cover"
                                    alt={proj.title}
                                  />
                                ) : (
                                  <video
                                    src={proj.videoPath}
                                    className="w-full h-full object-cover"
                                    controls={false}
                                    muted
                                  />
                                )}

                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                  <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                                </div>
                                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-white/70">
                                  ID: {proj.id.slice(0, 8)}
                                </div>
                              </div>


                              {/* Info */}
                              <div className="p-5 space-y-3 flex-1 flex flex-col">
                                {editingProjectId === proj.id ? (
                                  <div className="flex gap-2 items-center">
                                    <input
                                      type="text"
                                      value={editTitleValue}
                                      onChange={(e) => setEditTitleValue(e.target.value)}
                                      className="flex-1 bg-black/30 border border-blue-500 rounded px-2 py-1 text-sm text-white focus:outline-none"
                                      autoFocus
                                    />
                                    <button onClick={() => handleUpdateProjectTitle(proj.id, editTitleValue)} className="text-green-400 hover:text-green-300"><CheckCircle className="w-4 h-4" /></button>
                                    <button onClick={() => setEditingProjectId(null)} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
                                  </div>
                                ) : (
                                  <div className="flex justify-between items-start gap-2">
                                    <h4 className="font-bold text-lg text-white group-hover:text-pink-400 transition-colors line-clamp-1 break-all" title={proj.title}>
                                      {proj.title}
                                    </h4>
                                    <button
                                      onClick={() => { setEditingProjectId(proj.id); setEditTitleValue(proj.title); }}
                                      className="text-gray-500 hover:text-white transition-colors p-1"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}

                                <div className="space-y-1">
                                  <div className="flex items-center gap-4 text-xs text-gray-400">
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(proj.createdAt || 0).toLocaleDateString()} {new Date(proj.createdAt || 0).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {Math.round(proj.duration || 0)}s</span>
                                  </div>

                                  {proj.usage && (
                                    <div className="text-[10px] text-gray-500 bg-black/20 p-2 rounded mt-1 border border-white/5 space-y-0.5">
                                      <div className="flex justify-between font-mono text-green-400 font-bold border-b border-white/5 pb-0.5 mb-0.5">
                                        <span>TOTAL</span>
                                        <span>₩{Math.round(proj.usage.totalCost || 0).toLocaleString()}</span>
                                      </div>
                                      <div className="flex justify-between"><span>Script</span><span>₩{Math.round(proj.usage.scriptCost || 0)}</span></div>
                                      <div className="flex justify-between"><span>Image</span><span>₩{Math.round(proj.usage.imageCost || 0)}</span></div>
                                      <div className="flex justify-between"><span>Audio</span><span>₩{Math.round(proj.usage.audioCost || 0)}</span></div>
                                    </div>
                                  )}
                                </div>

                                <div className="pt-3 flex gap-2 mt-auto">
                                  <a
                                    href={proj.videoPath}
                                    download={`${proj.title || "project"}.webm`}
                                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-center text-xs font-bold text-white transition-colors flex items-center justify-center gap-1"
                                  >
                                    <VideoIcon className="w-3 h-3" /> Download
                                  </a>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedProject(proj); // Select the project
                                      setShowSNSModal(true); // Open Modal
                                    }}
                                    className="px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors border border-red-600/20 flex items-center justify-center"
                                    title="Upload to YouTube"
                                  >
                                    <Upload className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteProject(proj.id, e)}
                                    className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors border border-red-500/20 shadow-none hover:shadow-red-500/20"
                                    title="Delete Project"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ));
                        } else {
                          // Folder View (Grouped)
                          return Object.entries(grouped).map(([title, items]) => {
                            const itemList = items as any[];
                            return (
                              <div
                                key={title}
                                onClick={() => setExpandedProjectTitle(title)}
                                className="group bg-white/5 border border-white/5 rounded-2xl p-6 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-900/10 transition-all duration-300 cursor-pointer flex flex-col gap-4 relative overflow-hidden"
                              >
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                  <FileVideo className="w-32 h-32 text-blue-500" />
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                                    <Film className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors line-clamp-1" title={title}>
                                      {title}
                                    </h4>
                                    <p className="text-sm text-gray-500">{itemList.length} Video{itemList.length !== 1 && 's'}</p>
                                  </div>
                                </div>

                                <div className="mt-auto space-y-3">
                                  <div className="flex justify-between items-end">
                                    <div className="flex -space-x-2 overflow-hidden">
                                      {itemList.slice(0, 4).map((item, i) => (
                                        <div
                                          key={i}
                                          className="w-10 h-10 rounded-full border-2 border-[#1a1a1a] bg-gray-800 bg-cover bg-center shadow-lg"
                                          style={{ backgroundImage: item.thumbnailPath ? `url('${item.thumbnailPath}')` : `none` }}
                                        >
                                          {!item.thumbnailPath && (
                                            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
                                              {i + 1}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                      {itemList.length > 4 && (
                                        <div className="w-10 h-10 rounded-full border-2 border-[#1a1a1a] bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 shadow-lg">
                                          +{itemList.length - 4}
                                        </div>
                                      )}
                                    </div>
                                    <div className="text-right">
                                      <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Stats</div>
                                      <div className="text-xs text-green-400 font-mono font-bold">
                                        ₩{Math.round(itemList.reduce((sum, it) => sum + (it.usage?.totalCost || 0), 0)).toLocaleString()}
                                      </div>
                                      <div className="text-[10px] text-gray-400">
                                        {Math.round(itemList.reduce((sum, it) => sum + (it.duration || 0), 0))}s total
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-gray-600 border-t border-white/5 pt-2 flex justify-between items-center">
                                    <span>Active Project</span>
                                    <span>Last: {new Date(Math.max(...itemList.map(i => new Date(i.createdAt || 0).getTime()))).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        }
                      })()}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/5 bg-black/40 text-center">
                <p className="text-xs text-gray-600">Videos are stored locally in the 'public/projects' directory.</p>
              </div>
            </div>
          </div>
        )
      }

      {/* Gallery Video Player Modal */}
      {
        selectedProject && (
          <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300">
            <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-7xl h-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]">

              {/* Video Area */}
              <div className="flex-[2] bg-black relative flex items-center justify-center group/player">
                <video
                  src={selectedProject.videoPath}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                />
                <button
                  onClick={() => setSelectedProject(null)}
                  className="absolute top-6 left-6 z-50 p-3 bg-black/40 hover:bg-black/80 text-white rounded-full backdrop-blur-md transition-all border border-white/10 hover:scale-110 md:hidden"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Info Panel */}
              <div className="flex-1 border-l border-white/10 flex flex-col bg-[#161616]">
                <div className="p-8 flex-1 overflow-y-auto space-y-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mb-2 bg-pink-500/10 w-fit px-2 py-0.5 rounded">Project Details</div>
                      <h3 className="text-3xl font-bold text-white leading-tight">{selectedProject.title}</h3>
                      <p className="text-sm text-gray-500 mt-2 font-mono flex items-center gap-2">
                        <Clock className="w-4 h-4" /> {new Date(selectedProject.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedProject(null)}
                      className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors hidden md:block"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Duration</p>
                      <p className="text-xl font-bold text-white">{Math.round(selectedProject.duration || 0)}s</p>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Format</p>
                      <p className="text-xl font-bold text-white uppercase">{selectedProject.videoPath?.split('.').pop() || 'WEBM'}</p>
                    </div>
                  </div>

                  {selectedProject.usage && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cost Breakdown</h4>
                        <div className="flex-1 h-px bg-white/5"></div>
                      </div>
                      <div className="space-y-3 bg-black/20 p-5 rounded-2xl border border-white/5">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-400 flex items-center gap-2"><FileText className="w-4 h-4" /> Script / AI</span>
                          <span className="text-white font-mono font-bold">₩{Math.round(selectedProject.usage.scriptCost || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-400 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Visual Assets</span>
                          <span className="text-white font-mono font-bold">₩{Math.round(selectedProject.usage.imageCost || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-400 flex items-center gap-2"><Music className="w-4 h-4" /> Audio Narration</span>
                          <span className="text-white font-mono font-bold">₩{Math.round(selectedProject.usage.audioCost || 0).toLocaleString()}</span>
                        </div>
                        <div className="pt-3 mt-3 border-t border-white/10 flex justify-between items-center">
                          <span className="text-pink-400 font-bold">TOTAL ESTIMATED</span>
                          <span className="text-2xl font-bold text-green-400 font-mono">
                            ₩{Math.round(selectedProject.usage.totalCost || 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tags or Meta */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Storage Info</h4>
                      <div className="flex-1 h-px bg-white/5"></div>
                    </div>
                    <div className="text-[10px] text-gray-600 break-all font-mono bg-black/40 p-3 rounded-lg border border-white/5">
                      Path: {selectedProject.videoPath}
                    </div>
                  </div>

                  {/* Original Assets (Relocated) */}
                  {selectedProject.scenes && selectedProject.scenes.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Original Assets</h4>
                        <div className="flex-1 h-px bg-white/5"></div>
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                        {selectedProject.scenes.map((scene: any, idx: number) => {
                          if (!scene.imageUrl) return null;
                          return (
                            <div
                              key={idx}
                              className="group relative aspect-video bg-black/50 rounded-lg overflow-hidden border border-white/5 hover:border-pink-500/50 transition-all cursor-pointer hover:shadow-lg hover:shadow-pink-500/10"
                              onClick={() => setPreviewImage(scene.imageUrl)}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={scene.imageUrl}
                                alt={`Scene ${idx + 1}`}
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                              />
                              <div className="absolute top-1 left-1 bg-black/60 px-1 py-0.5 rounded text-[9px] font-bold text-white/90">
                                #{idx + 1}
                              </div>
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-white/10 transition-colors pointer-events-none" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-8 bg-black/20 border-t border-white/10">
                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <a
                      href={selectedProject.videoPath}
                      download={`${selectedProject.title || "video"}.webm`}
                      className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-center font-bold text-sm transition-all flex items-center justify-center gap-2 border border-white/5"
                    >
                      <VideoIcon className="w-4 h-4" /> Download Video
                    </a>
                    <button
                      onClick={() => setShowSNSModal(true)}
                      className="py-3 bg-red-600/80 hover:bg-red-600 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border border-white/5 shadow-lg shadow-red-900/20"
                    >
                      <Upload className="w-4 h-4" /> Upload to YouTube
                    </button>
                    <button
                      onClick={() => {
                        if (selectedProject.scenes) {
                          setSceneItems(selectedProject.scenes);
                          setProjectTitle(selectedProject.title || "");
                          setShowServerGallery(false);
                          setSelectedProject(null);
                          setAnalysisResult({
                            summary: selectedProject.title,
                            scenes: [],
                            imageAnalysis: { summary: "Loaded from gallery", visualStyle: "Auto", dominantColors: [] },
                            consistency: { character: "Loaded", theme: "Loaded" },
                            suggestedStyles: []
                          });
                          alert("Project items loaded for editing!");
                        } else {
                          alert("This project was saved without scene data and cannot be re-edited.");
                        }
                      }}
                      className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2"
                    >
                      <Pencil className="w-4 h-4" /> Re-edit
                    </button>
                  </div>

                  {/* Upload History */}
                  {selectedProject.uploads && selectedProject.uploads.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">YouTube Upload History</h4>
                        <div className="flex-1 h-px bg-white/5"></div>
                      </div>
                      <div className="bg-white/5 rounded-xl overflow-hidden border border-white/5 divide-y divide-white/5 max-h-60 overflow-y-auto custom-scrollbar">
                        {selectedProject.uploads.map((upload: any, idx: number) => (
                          <div key={idx} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-red-600/20 flex items-center justify-center text-red-500">
                                <VideoIcon className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="text-sm font-bold text-white">Uploaded to YouTube</div>
                                <div className="text-xs text-gray-500 flex items-center gap-2">
                                  <span>{new Date(upload.timestamp).toLocaleString()}</span>
                                  {upload.channelId && <span className="px-1.5 py-0.5 rounded bg-white/10 text-gray-400">{upload.channelId}</span>}
                                </div>
                              </div>
                            </div>
                            <a
                              href={`https://youtu.be/${upload.videoId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white transition-colors flex items-center gap-2"
                            >
                              Watch <ChevronRight className="w-3 h-3" />
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>


              </div>
            </div>
          </div>
        )
      }

      {/* Project List Modal */}
      {
        showProjectList && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[85vh]">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <FileVideo className="w-5 h-5 text-purple-400" />
                  {historyProjectId ? 'Project History' : 'Saved Projects'}
                </h3>
                <button
                  onClick={() => {
                    if (historyProjectId) setHistoryProjectId(null);
                    else setShowProjectList(false);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {historyProjectId ? <RotateCcw className="w-5 h-5" /> : <X className="w-6 h-6" />}
                </button>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-2 custom-scrollbar">
                {historyProjectId ? (
                  /* History View */
                  projectHistory.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">No history found.</div>
                  ) : (
                    projectHistory.map((hv, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/5 p-4 rounded-xl flex justify-between items-center group">
                        <div>
                          <div className="text-sm font-bold text-gray-200">
                            {hv.name || `Version ${projectHistory.length - idx}`}
                          </div>
                          <div className="text-[10px] text-gray-500 flex items-center gap-2 mt-1">
                            <Clock className="w-3 h-3" /> {new Date(hv.timestamp || 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDeleteHistoryVersion(hv.timestamp || "")}
                            className="px-2 py-1.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white text-[10px] font-bold rounded-lg transition-all"
                            title="Delete Version"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleRestoreVersion(hv)}
                            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white text-[10px] font-bold rounded-lg transition-all"
                          >
                            Restore
                          </button>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  /* Grouped Projects View */
                  /* Flat Projects View */
                  savedProjects.length === 0 ? (
                    <div className="text-center py-10 text-gray-500">
                      <p>No saved projects found.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {savedProjects
                        .sort((a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
                        .map((proj: any) => (
                          <div key={proj.id} className="bg-white/5 border border-white/5 p-4 rounded-xl flex justify-between items-center group hover:bg-white/10 transition-all">
                            <div className="flex-1 min-w-0 pr-4">
                              {editingProjectId === proj.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editTitleValue}
                                    onChange={(e) => setEditTitleValue(e.target.value)}
                                    className="bg-black/40 border border-blue-500 rounded px-2 py-1 text-sm text-white focus:outline-none w-full max-w-xs"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleUpdateProjectName(proj.id, editTitleValue);
                                      if (e.key === 'Escape') setEditingProjectId(null);
                                    }}
                                  />
                                  <button onClick={() => handleUpdateProjectName(proj.id, editTitleValue)} className="p-1 text-green-400 hover:text-green-300 bg-green-400/10 rounded"><CheckCircle className="w-4 h-4" /></button>
                                  <button onClick={() => setEditingProjectId(null)} className="p-1 text-red-400 hover:text-red-300 bg-red-400/10 rounded"><X className="w-4 h-4" /></button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group/title">
                                  <div className="text-sm font-bold text-gray-200 truncate" title={proj.name}>
                                    {proj.name || "Untitled Project"}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingProjectId(proj.id);
                                      setEditTitleValue(proj.name || "Untitled Project");
                                    }}
                                    className="opacity-0 group-hover/title:opacity-100 text-gray-500 hover:text-white transition-opacity"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                              <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> {new Date(proj.updatedAt || proj.createdAt).toLocaleString()}
                                </span>
                                <span className="font-mono text-gray-600">ID: {proj.id.slice(0, 8)}</span>
                              </div>
                            </div>

                            {/* Action Buttons Area */}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleFetchHistory(proj.id)}
                                className="p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-all border border-purple-500/20"
                                title="View History"
                              >
                                <HistoryIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleLoadProject(proj.id)}
                                className="p-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg transition-all border border-blue-500/20"
                                title="Load Project"
                              >
                                <Upload className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleSoftDeleteProject(proj.id)}
                                className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all border border-red-500/20"
                                title="Delete Project"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  ))}
              </div>

              <div className="p-4 bg-black/40 border-t border-white/5 text-center">
                <p className="text-xs text-gray-500 italic">
                  {historyProjectId ? 'Restoring a version will overwrite current scenes.' : 'Select a project or click the clock icon for history.'}
                </p>
              </div>
            </div>
          </div>
        )
      }
      {/* Render Settings / Preview Modal */}
      {
        showRenderSettings && (
          <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-400" /> Render Settings
                </h3>
                <button onClick={() => setShowRenderSettings(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">

                <div className="flex gap-6 flex-col md:flex-row">
                  {/* Quality Toggle Header */}


                  {/* Preview Area */}
                  <div className={clsx(
                    "flex-1 space-y-2 flex flex-col",
                    (selectedPlatform === 'custom' ? customHeight > customWidth : platformConfigs[selectedPlatform].height > platformConfigs[selectedPlatform].width) ? "items-center" : ""
                  )}>
                    {/* Quality Toggle Header (Moved) */}
                    <div className="w-full flex justify-center px-1 mb-1">
                      <div className="bg-black/40 p-1 rounded-lg border border-white/10 flex text-[10px] font-bold">
                        <button
                          onClick={() => setPreviewQuality('low')}
                          className={clsx("px-3 py-1.5 rounded transition-all", previewQuality === 'low' ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-200")}
                        >
                          🚀 Performance
                        </button>
                        <button
                          onClick={() => setPreviewQuality('high')}
                          className={clsx("px-3 py-1.5 rounded transition-all", previewQuality === 'high' ? "bg-green-600 text-white shadow-sm" : "text-gray-400 hover:text-gray-200")}
                        >
                          ✨ Quality
                        </button>
                      </div>
                    </div>
                    <div
                      className={clsx(
                        "bg-black rounded-xl overflow-hidden border border-white/10 shadow-lg relative transition-all duration-300",
                        (selectedPlatform === 'custom' ? customHeight > customWidth : platformConfigs[selectedPlatform].height > platformConfigs[selectedPlatform].width)
                          ? "aspect-[9/16] w-auto max-w-full h-[45vh]"
                          : "aspect-video w-full"
                      )}
                      style={
                        (selectedPlatform === 'custom' ? customHeight > customWidth : platformConfigs[selectedPlatform].height > platformConfigs[selectedPlatform].width)
                          ? { aspectRatio: `${selectedPlatform === 'custom' ? customWidth : platformConfigs[selectedPlatform].width}/${selectedPlatform === 'custom' ? customHeight : platformConfigs[selectedPlatform].height}` }
                          : {}
                      }
                    >
                      <WebGPURenderer
                        scenes={rendererScenes}
                        audioSrc={undefined}
                        audioVolume={0}
                        introMedia={introMedia}
                        outroMedia={outroMedia}
                        narrationEnabled={false}
                        narrationSpeed={1.0} // Baked via Prompt
                        tickerSpeed={tickerSpeed}
                        subtitleSpeed={subtitleSpeed}
                        aiDisclosureEnabled={aiDisclosureEnabled}
                        watermarkUrl={watermarkUrl}
                        canvasWidth={selectedPlatform === 'custom' ? customWidth : platformConfigs[selectedPlatform].width}
                        canvasHeight={selectedPlatform === 'custom' ? customHeight : platformConfigs[selectedPlatform].height}
                        subtitleFontSize={subtitleFontSize}
                        narrationFontSize={narrationFontSize}
                        showSubtitles={showSubtitles}
                        showNarrationText={showNarrationText}
                        subtitleColor={debouncedSubtitleColor}
                        narrationColor={debouncedNarrationColor}
                        subtitleBackgroundColor={debouncedSubtitleBackgroundColor}
                        subtitleBackgroundOpacity={debouncedSubtitleBackgroundOpacity}
                        narrationBackgroundColor={debouncedNarrationBackgroundColor}
                        narrationBackgroundOpacity={debouncedNarrationBackgroundOpacity}
                        subtitleFont={subtitleFont}
                        narrationFont={narrationFont}
                        subtitleEffectStyle={subtitleEffectStyle}
                        subtitleEntranceAnimation={subtitleEntranceAnimation}
                        subtitleExitAnimation={subtitleExitAnimation}
                        subtitleEffectColor={subtitleEffectColor}
                        subtitleEffectParam={subtitleEffectParam}
                        subtitleOpacity={subtitleOpacity}
                        subtitleStrokeColor={subtitleStrokeColor}
                        subtitleStrokeWidth={subtitleStrokeWidth}
                        subtitleSyncShift={subtitleSyncShift}
                        backgroundColor={backgroundColor}
                        backgroundUrl={backgroundUrl}
                        qrCodeUrl={qrCodeImage}
                        qrCodeSize={qrCodeSize}
                        qrCodePosition={qrCodePosition}
                        scaleMode={imageAspectRatio === '16:9' ? 'contain' : 'cover'}
                        captionConfig={captionConfig}
                        overlayConfig={overlayConfig}
                        overlayMediaUrl={null} // TODO: Add UI for Overlay Media Upload
                        quality={previewQuality} // Interactive Preview Optimization
                        previewMode={true}
                        onComplete={NO_OP}
                        onProgress={handleProgress}
                        seekToTime={seekRequest}
                        isScrubbing={isScrubbing}
                      />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <div className="bg-purple-600/80 px-2 py-1 rounded text-[10px] font-bold text-white backdrop-blur">
                          PREVIEW
                        </div>
                        <div className={clsx("px-2 py-1 rounded text-[10px] font-bold text-white backdrop-blur border border-white/10", previewQuality === 'high' ? "bg-green-600/80" : "bg-blue-600/80")}>
                          {previewQuality === 'high' ? "HQ" : "PERF"}
                        </div>
                      </div>
                    </div>

                    {/* Timeline Scrubber */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-3 flex items-center gap-3">
                      <div className="text-[10px] font-mono text-gray-400 w-12 text-right">
                        {new Date(currentTime * 1000).toISOString().substr(14, 5)}
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={totalDuration || 100}
                        step={0.1}
                        value={currentTime}
                        onMouseDown={handleScrubStart}
                        onTouchStart={handleScrubStart}
                        onMouseUp={handleScrubEnd}
                        onTouchEnd={handleScrubEnd}
                        onChange={handleScrubChange}
                        className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                      />
                      <div className="text-[10px] font-mono text-gray-500 w-12">
                        {new Date(totalDuration * 1000).toISOString().substr(14, 5)}
                      </div>
                    </div>


                    {/* INFO DASHBOARD (Requested) */}
                    <div className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2">
                        <Info className="w-3 h-3" /> Project Info
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500 text-xs block">Target Platform</span>
                          <span className="text-white font-bold">{platformConfigs[selectedPlatform].name}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs block">Image Ratio</span>
                          <span className="text-white font-bold">{imageAspectRatio}</span>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs block">Narration</span>
                          <span className={clsx("font-bold", narrationEnabled ? "text-green-400" : "text-gray-600")}>
                            {narrationEnabled ? `ON (${voiceStyle})` : "OFF"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs block">Total Duration</span>
                          <span className="text-blue-400 font-bold font-mono">
                            {Math.round(rendererScenes.length > 0 ? rendererScenes.reduce((acc, s) => {
                              const audioDur = s.audioDuration || 0;
                              const minDur = audioDur > 0 ? audioDur + 3.0 : 4;
                              // Apply Narration Speed to Duration
                              const finalDur = Math.max(s.duration, minDur) / (narrationSpeed || 1.0);
                              return acc + finalDur;
                            }, 0) : 0)}s
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-3">
                        <span className="text-gray-500 text-xs block mb-2">Scene Breakdown</span>
                        <div className="max-h-32 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                          {rendererScenes.map((s, i) => (
                            <div
                              key={i}
                              className="flex justify-between text-xs bg-white/5 px-2 py-1.5 rounded cursor-pointer hover:bg-white/10 hover:text-purple-300 transition-colors"
                              onClick={() => handleSeekToScene(i)}
                            >
                              <span className="text-gray-300 w-48 text-ellipsis overflow-hidden whitespace-nowrap">
                                #{i + 1} {s.subtitle || s.text || "Untitled"}
                              </span>
                              <span className="text-gray-500 font-mono">
                                {Math.round(Math.max(s.duration, (s.audioDuration || 0) > 0 ? (s.audioDuration || 0) + 3.0 : 4) / (narrationSpeed || 1.0))}s
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Settings Controls */}
                  <div className="w-full md:w-80 space-y-4">



                    {/* 2. Visual Effects (VFX) - NEW */}
                    <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedSection(expandedSection === 'vfx' ? null : 'vfx')}
                        className="w-full text-left p-4 flex justify-between items-center bg-black/20 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
                          <Sparkles className="w-4 h-4 text-yellow-400" /> Visual Effects (VFX)
                        </div>
                        <ChevronDown className={clsx("w-4 h-4 transition-transform text-gray-500", expandedSection === 'vfx' ? "rotate-180" : "")} />
                      </button>

                      {expandedSection === 'vfx' && (
                        <div className="p-4 space-y-6 animate-in slide-in-from-top-2 duration-200">

                          {/* Light Leaks */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                ☀️ Light Leaks
                              </label>
                              <input type="checkbox" checked={overlayConfig.lightLeak.enabled} onChange={e => setOverlayConfig((p: any) => ({ ...p, lightLeak: { ...p.lightLeak, enabled: e.target.checked } }))} className="accent-yellow-500" />
                            </div>
                            {overlayConfig.lightLeak.enabled && (
                              <div className="pl-2 border-l border-white/10 space-y-2">
                                <div className="flex gap-2 text-[10px]">
                                  <button onClick={() => setOverlayConfig((p: any) => ({ ...p, lightLeak: { ...p.lightLeak, colorTheme: 'warm' } }))} className={clsx("px-2 py-1 rounded border", overlayConfig.lightLeak.colorTheme === 'warm' ? "bg-orange-500/20 border-orange-500 text-orange-400" : "border-white/10 text-gray-500")}>Warm</button>
                                  <button onClick={() => setOverlayConfig((p: any) => ({ ...p, lightLeak: { ...p.lightLeak, colorTheme: 'cool' } }))} className={clsx("px-2 py-1 rounded border", overlayConfig.lightLeak.colorTheme === 'cool' ? "bg-blue-500/20 border-blue-500 text-blue-400" : "border-white/10 text-gray-500")}>Cool</button>
                                </div>
                                <div className="text-[10px] text-gray-500 flex justify-between"><span>Intensity</span><span>{Math.round(overlayConfig.lightLeak.intensity * 100)}%</span></div>
                                <input type="range" min="0" max="1" step="0.1" value={overlayConfig.lightLeak.intensity} onChange={e => setOverlayConfig((p: any) => ({ ...p, lightLeak: { ...p.lightLeak, intensity: parseFloat(e.target.value) } }))} className="w-full accent-yellow-500 h-1 bg-gray-700 rounded appearance-none" />
                              </div>
                            )}
                          </div>

                          {/* Film Grain */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                🎞️ Film Grain
                              </label>
                              <input type="checkbox" checked={overlayConfig.filmGrain.enabled} onChange={e => setOverlayConfig((p: any) => ({ ...p, filmGrain: { ...p.filmGrain, enabled: e.target.checked } }))} className="accent-gray-500" />
                            </div>
                            {overlayConfig.filmGrain.enabled && (
                              <div className="pl-2 border-l border-white/10 space-y-2">
                                <div className="text-[10px] text-gray-500 flex justify-between"><span>Intensity</span><span>{Math.round(overlayConfig.filmGrain.intensity * 100)}%</span></div>
                                <input type="range" min="0" max="1" step="0.05" value={overlayConfig.filmGrain.intensity} onChange={e => setOverlayConfig((p: any) => ({ ...p, filmGrain: { ...p.filmGrain, intensity: parseFloat(e.target.value) } }))} className="w-full accent-gray-500 h-1 bg-gray-700 rounded appearance-none" />
                              </div>
                            )}
                          </div>

                          {/* Dust Particles */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                ❄️ Dust Particles
                              </label>
                              <input type="checkbox" checked={overlayConfig.dustParticles.enabled} onChange={e => setOverlayConfig((p: any) => ({ ...p, dustParticles: { ...p.dustParticles, enabled: e.target.checked } }))} className="accent-white" />
                            </div>
                            {overlayConfig.dustParticles.enabled && (
                              <div className="pl-2 border-l border-white/10 space-y-2">
                                <div className="text-[10px] text-gray-500 flex justify-between"><span>Density</span><span>{Math.round(overlayConfig.dustParticles.density * 100)}%</span></div>
                                <input type="range" min="0.1" max="1" step="0.1" value={overlayConfig.dustParticles.density} onChange={e => setOverlayConfig((p: any) => ({ ...p, dustParticles: { ...p.dustParticles, density: parseFloat(e.target.value) } }))} className="w-full accent-white h-1 bg-gray-700 rounded appearance-none" />
                              </div>
                            )}
                          </div>

                          {/* Vignette */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                🌑 Vignette
                              </label>
                              <input type="checkbox" checked={overlayConfig.vignette.enabled} onChange={e => setOverlayConfig((p: any) => ({ ...p, vignette: { ...p.vignette, enabled: e.target.checked } }))} className="accent-black" />
                            </div>
                            {overlayConfig.vignette.enabled && (
                              <div className="pl-2 border-l border-white/10 space-y-2">
                                <div className="text-[10px] text-gray-500 flex justify-between"><span>Darkness</span><span>{Math.round(overlayConfig.vignette.intensity * 100)}%</span></div>
                                <input type="range" min="0" max="1" step="0.1" value={overlayConfig.vignette.intensity} onChange={e => setOverlayConfig((p: any) => ({ ...p, vignette: { ...p.vignette, intensity: parseFloat(e.target.value) } }))} className="w-full accent-black h-1 bg-gray-700 rounded appearance-none" />
                              </div>
                            )}
                          </div>

                          {/* Color Grading - NEW */}
                          <div className="space-y-2 pt-4 border-t border-white/5">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                🎨 Color Grading
                              </label>
                              <input type="checkbox" checked={overlayConfig.colorGrading?.enabled} onChange={e => setOverlayConfig((p: any) => ({ ...p, colorGrading: { ...p.colorGrading!, enabled: e.target.checked } }))} className="accent-blue-500" />
                            </div>
                            {overlayConfig.colorGrading?.enabled && (
                              <div className="pl-2 border-l border-white/10 space-y-3">
                                {/* Brightness */}
                                <div>
                                  <div className="text-[10px] text-gray-500 flex justify-between"><span>Brightness</span><span>{overlayConfig.colorGrading.brightness.toFixed(1)}</span></div>
                                  <input type="range" min="0.5" max="2.0" step="0.1" value={overlayConfig.colorGrading.brightness} onChange={e => setOverlayConfig((p: any) => ({ ...p, colorGrading: { ...p.colorGrading!, brightness: parseFloat(e.target.value) } }))} className="w-full accent-blue-500 h-1 bg-gray-700 rounded appearance-none" />
                                </div>
                                {/* Contrast */}
                                <div>
                                  <div className="text-[10px] text-gray-500 flex justify-between"><span>Contrast</span><span>{overlayConfig.colorGrading.contrast.toFixed(1)}</span></div>
                                  <input type="range" min="0.5" max="2.0" step="0.1" value={overlayConfig.colorGrading.contrast} onChange={e => setOverlayConfig((p: any) => ({ ...p, colorGrading: { ...p.colorGrading!, contrast: parseFloat(e.target.value) } }))} className="w-full accent-blue-500 h-1 bg-gray-700 rounded appearance-none" />
                                </div>
                                {/* Saturation */}
                                <div>
                                  <div className="text-[10px] text-gray-500 flex justify-between"><span>Saturation</span><span>{overlayConfig.colorGrading.saturation.toFixed(1)}</span></div>
                                  <input type="range" min="0.0" max="3.0" step="0.1" value={overlayConfig.colorGrading.saturation} onChange={e => setOverlayConfig((p: any) => ({ ...p, colorGrading: { ...p.colorGrading!, saturation: parseFloat(e.target.value) } }))} className="w-full accent-blue-500 h-1 bg-gray-700 rounded appearance-none" />
                                </div>
                                {/* Sepia */}
                                <div>
                                  <div className="text-[10px] text-gray-500 flex justify-between"><span>Sepia</span><span>{overlayConfig.colorGrading.sepia?.toFixed(1)}</span></div>
                                  <input type="range" min="0.0" max="1.0" step="0.1" value={overlayConfig.colorGrading.sepia || 0} onChange={e => setOverlayConfig((p: any) => ({ ...p, colorGrading: { ...p.colorGrading!, sepia: parseFloat(e.target.value) } }))} className="w-full accent-amber-600 h-1 bg-gray-700 rounded appearance-none" />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Bloom - NEW */}
                          <div className="space-y-2 pt-2">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-bold text-gray-300 flex items-center gap-2">
                                ✨ Bloom (Glow)
                              </label>
                              <input type="checkbox" checked={overlayConfig.bloom?.enabled} onChange={e => setOverlayConfig((p: any) => ({ ...p, bloom: { ...p.bloom!, enabled: e.target.checked } }))} className="accent-yellow-400" />
                            </div>
                            {overlayConfig.bloom?.enabled && (
                              <div className="pl-2 border-l border-white/10 space-y-3">
                                {/* Strength */}
                                <div>
                                  <div className="text-[10px] text-gray-500 flex justify-between"><span>Strength</span><span>{Math.round((overlayConfig.bloom.strength || 0) * 100)}%</span></div>
                                  <input type="range" min="0" max="1" step="0.1" value={overlayConfig.bloom.strength} onChange={e => setOverlayConfig((p: any) => ({ ...p, bloom: { ...p.bloom!, strength: parseFloat(e.target.value) } }))} className="w-full accent-yellow-400 h-1 bg-gray-700 rounded appearance-none" />
                                </div>
                                {/* Radius */}
                                <div>
                                  <div className="text-[10px] text-gray-500 flex justify-between"><span>Radius</span><span>{overlayConfig.bloom.radius}px</span></div>
                                  <input type="range" min="0" max="50" step="1" value={overlayConfig.bloom.radius} onChange={e => setOverlayConfig((p: any) => ({ ...p, bloom: { ...p.bloom!, radius: parseInt(e.target.value) } }))} className="w-full accent-yellow-400 h-1 bg-gray-700 rounded appearance-none" />
                                </div>
                              </div>
                            )}
                          </div>

                        </div>
                      )}
                    </div>

                    {/* 1. Background Settings (NEW) */}
                    <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedSection(expandedSection === 'background' ? null : 'background')}
                        className="w-full text-left p-4 flex justify-between items-center bg-black/20 hover:bg-white/5 transition-colors"
                      >
                        <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
                          <Palette className="w-4 h-4 text-orange-400" /> Background
                        </div>
                        <ChevronDown className={clsx("w-4 h-4 transition-transform text-gray-500", expandedSection === 'background' ? "rotate-180" : "")} />
                      </button>

                      {expandedSection === 'background' && (
                        <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                          {/* Background Color */}
                          <div className="flex justify-between items-center">
                            <label className="text-xs text-gray-400">Solid Color</label>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-gray-500">{backgroundColor}</span>
                              <input
                                type="color"
                                value={backgroundColor}
                                onChange={(e) => setBackgroundColor(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
                                title="Background Color"
                              />
                            </div>
                          </div>

                          {/* Background Image */}
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-xs text-gray-400">Background Image</label>
                              {backgroundUrl && (
                                <button onClick={() => setBackgroundUrl(null)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                                  <X className="w-3 h-3" /> Remove
                                </button>
                              )}
                            </div>
                            <label className="flex items-center gap-2 bg-black/40 border border-white/10 rounded px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors group">
                              <ImageIcon className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                              <span className="text-xs text-gray-400 group-hover:text-white transition-colors truncate flex-1">
                                {backgroundUrl ? "Change Image..." : "Upload Image..."}
                              </span>
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const url = URL.createObjectURL(file);
                                    setBackgroundUrl(url);
                                  }
                                }}
                              />
                            </label>
                            {backgroundUrl && (
                              <div className="mt-2 h-20 w-full bg-black rounded border border-white/10 overflow-hidden relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={backgroundUrl} className="w-full h-full object-cover opacity-50" alt="Background" />
                                <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/50 font-mono">PREVIEW</div>
                              </div>
                            )}
                          </div>

                          {/* Background Music (Moved here) */}
                          <div className="pt-4 border-t border-white/5 space-y-4">
                            <div className="flex justify-between items-center">
                              <label className="text-xs text-gray-400 font-bold flex items-center gap-2">
                                <Music className="w-3 h-3 text-pink-400" /> Background Music
                              </label>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={audioEnabled} onChange={(e) => setAudioEnabled(e.target.checked)} className="sr-only peer" />
                                <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-pink-500"></div>
                                <span className={clsx("ml-2 text-xs font-bold", audioEnabled ? "text-pink-400" : "text-gray-500")}>{audioEnabled ? "ON" : "OFF"}</span>
                              </label>
                            </div>

                            {audioEnabled && (
                              <div className="bg-black/30 p-3 rounded-lg border border-white/5 space-y-3 animate-in fade-in">
                                {/* BGM Selection */}
                                <div className="space-y-2">
                                  <label className="text-[10px] text-gray-500 uppercase block">Source</label>
                                  <div className="flex gap-2">
                                    <select
                                      value={selectedBgm}
                                      onChange={(e) => {
                                        setSelectedBgm(e.target.value);
                                        setAudioFile(null);
                                        // Stop preview if source changes
                                        if (isPreviewingBGM) {
                                          bgmPreviewRef.current?.pause();
                                          setIsPreviewingBGM(false);
                                        }
                                      }}
                                      className="flex-1 min-w-0 bg-black/40 border border-white/10 text-xs text-white rounded px-2 py-2 focus:border-pink-500 outline-none"
                                    >
                                      <option value="">None / Custom</option>
                                      {bgmFiles.map((bgm, idx) => (
                                        <option key={idx} value={bgm.url}>{bgm.name}</option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={handleToggleBGMPreview}
                                      className={clsx(
                                        "px-3 py-2 rounded-lg border transition-all flex items-center justify-center flex-shrink-0",
                                        isPreviewingBGM
                                          ? "bg-pink-500 text-white border-pink-500"
                                          : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                                      )}
                                      title={isPreviewingBGM ? "Stop Preview" : "Preview BGM"}
                                    >
                                      {isPreviewingBGM ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-0.5" />}
                                    </button>
                                  </div>
                                </div>

                                {/* Upload Custom */}
                                <div>
                                  <label className="cursor-pointer bg-white/5 border border-white/10 hover:bg-white/10 px-3 py-2 rounded-lg text-xs text-gray-300 flex items-center justify-center gap-2 transition-colors w-full">
                                    <Upload className="w-3 h-3" />
                                    {audioFile ? audioFile.name : (selectedBgm && selectedBgm !== "" ? "Use Preset (Click to Upload Custom)" : "Upload Custom MP3")}
                                    <input type="file" accept="audio/*" className="hidden" onChange={e => {
                                      setAudioFile(e.target.files?.[0] || null);
                                      setSelectedBgm("");
                                    }} />
                                  </label>
                                </div>

                                {/* Volume Slider */}
                                <div>
                                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                    <span>Volume</span>
                                    <span className="text-pink-400 font-mono">{Math.round(audioVolume * 100)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0" max="1" step="0.05"
                                    value={audioVolume}
                                    onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                                    className="w-full accent-pink-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>

                                {/* Fade In / Fade Out */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                      <span>Fade In</span>
                                      <span className="text-pink-400 font-mono">{bgmFadeIn}s</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0" max="10" step="0.5"
                                      value={bgmFadeIn}
                                      onChange={(e) => setBgmFadeIn(parseFloat(e.target.value))}
                                      className="w-full accent-pink-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                  </div>
                                  <div>
                                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                      <span>Fade Out</span>
                                      <span className="text-pink-400 font-mono">{bgmFadeOut}s</span>
                                    </div>
                                    <input
                                      type="range"
                                      min="0" max="10" step="0.5"
                                      value={bgmFadeOut}
                                      onChange={(e) => setBgmFadeOut(parseFloat(e.target.value))}
                                      className="w-full accent-pink-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                  </div>
                                </div>

                                {/* Ducking */}
                                <div>
                                  <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                    <span>Voice Ducking</span>
                                    <span className="text-pink-400 font-mono">{Math.round(bgmDucking * 100)}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0" max="1" step="0.05"
                                    value={bgmDucking}
                                    onChange={(e) => setBgmDucking(parseFloat(e.target.value))}
                                    className="w-full accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                  />
                                  <p className="text-[9px] text-gray-600 mt-0.5">BGM volume during narration playback</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 1.3 Narration Settings (Moved from Studio) */}
                      <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                        <button
                          onClick={() => setExpandedSection(expandedSection === 'narration' ? null : 'narration')}
                          className="w-full text-left p-4 flex justify-between items-center bg-black/20 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
                            <MessageSquare className="w-4 h-4 text-orange-400" /> Narration Settings
                          </div>
                          <ChevronDown className={clsx("w-4 h-4 transition-transform text-gray-500", expandedSection === 'narration' ? "rotate-180" : "")} />
                        </button>

                        {expandedSection === 'narration' && (
                          <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            {/* Volume */}
                            <div>
                              <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Narration Volume</span>
                                <span className="text-orange-400 font-mono">{Math.round(audioVolume * 100)}%</span>
                              </div>
                              <input
                                type="range" min="0" max="1" step="0.05"
                                value={audioVolume}
                                onChange={(e) => setAudioVolume(parseFloat(e.target.value))}
                                className="w-full accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>

                            {/* Speed */}
                            <div>
                              <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Playback Speed</span>
                                <span className="text-blue-400 font-mono">{narrationSpeed}x</span>
                              </div>
                              <input
                                type="range" min="0.5" max="2.0" step="0.1"
                                value={narrationSpeed}
                                onChange={(e) => setNarrationSpeed(parseFloat(e.target.value))}
                                className="w-full accent-blue-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                              />
                              <p className="text-[10px] text-gray-500 mt-1">* Adjusts audio playback speed and scene duration.</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 1.5 QR Code Overlay (NEW) */}
                      <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                        <button
                          onClick={() => setExpandedSection(expandedSection === 'qrcode' ? null : 'qrcode')}
                          className="w-full text-left p-4 flex justify-between items-center bg-black/20 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
                            <QrCode className="w-4 h-4 text-pink-400" /> QR Code Overlay
                          </div>
                          <div className="flex items-center gap-2">
                            {showQrCode && <span className="text-[10px] bg-pink-500/20 text-pink-400 px-1.5 py-0.5 rounded">ON</span>}
                            <ChevronDown className={clsx("w-4 h-4 transition-transform text-gray-500", expandedSection === 'qrcode' ? "rotate-180" : "")} />
                          </div>
                        </button>

                        {expandedSection === 'qrcode' && (
                          <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between">
                              <label className="text-xs text-gray-400">Enable QR Code</label>
                              <input
                                type="checkbox"
                                checked={showQrCode}
                                onChange={(e) => setShowQrCode(e.target.checked)}
                                className="w-4 h-4 accent-pink-500 rounded cursor-pointer"
                              />
                            </div>

                            {showQrCode && (
                              <div className="space-y-2">
                                <label className="text-xs text-gray-400 block">Link URL</label>
                                <input
                                  type="text"
                                  value={qrUrl}
                                  onChange={(e) => setQrUrl(e.target.value)}
                                  placeholder="https://..."
                                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-pink-500 transition-colors"
                                />

                                {/* QR Size Slider */}
                                <div className="mt-3">
                                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>Size</span>
                                    <span className="text-pink-400 font-mono">{qrCodeSize}px</span>
                                  </div>
                                  <input
                                    type="range" min="50" max="300" step="10"
                                    value={qrCodeSize}
                                    onChange={(e) => setQrCodeSize(parseInt(e.target.value))}
                                    className="w-full accent-pink-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>

                                {/* Position Selector */}
                                <div className="mt-3">
                                  <label className="text-xs text-gray-400 block mb-2">Position</label>
                                  <div className="grid grid-cols-2 gap-2">
                                    {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
                                      <button
                                        key={pos}
                                        onClick={() => setQrCodePosition(pos as any)}
                                        className={clsx(
                                          "px-2 py-2 rounded text-[10px] font-mono border transition-all",
                                          qrCodePosition === pos
                                            ? "bg-pink-500 text-white border-pink-500"
                                            : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                                        )}
                                      >
                                        {pos.replace('-', ' ').toUpperCase()}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div className="flex gap-2 items-center bg-white/5 p-2 rounded border border-white/5 mt-3">
                                  <div className="bg-white p-1 rounded">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    {qrCodeImage && <img src={qrCodeImage} className="w-12 h-12" alt="QR Preview" />}
                                  </div>
                                  <div className="text-[10px] text-gray-500">
                                    Generates a QR code linking to the above URL.
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>


                      {/* Safety & Branding Settings */}
                      <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                        <button
                          onClick={() => setExpandedSection(expandedSection === 'branding' ? null : 'branding')}
                          className="w-full text-left p-4 flex justify-between items-center bg-black/20 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
                            <ShieldCheck className="w-4 h-4 text-blue-400" /> Safety & Branding
                          </div>
                          <div className="flex items-center gap-2">
                            {aiDisclosureEnabled && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">AI INFO</span>}
                            {watermarkUrl && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded mr-1">LOGO</span>}
                            <ChevronDown className={clsx("w-4 h-4 transition-transform text-gray-500", expandedSection === 'branding' ? "rotate-180" : "")} />
                          </div>
                        </button>

                        {expandedSection === 'branding' && (
                          <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            {/* AI Disclosure Toggle */}
                            <div className="flex justify-between items-center">
                              <div>
                                <label className="text-xs text-gray-300 font-bold block">AI Disclosure Badge</label>
                                <p className="text-[10px] text-gray-500">Adds "AI Generated" warning</p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={aiDisclosureEnabled}
                                  onChange={(e) => setAiDisclosureEnabled(e.target.checked)}
                                  className="sr-only peer"
                                />
                                <div className="w-8 h-4 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                              </label>
                            </div>

                            <div className="h-px bg-white/5" />

                            {/* Watermark Upload */}
                            <div>
                              <div className="flex justify-between items-center mb-2">
                                <div>
                                  <label className="text-xs text-gray-300 font-bold block">Watermark / Logo</label>
                                  <p className="text-[10px] text-gray-500">Overlay your brand logo</p>
                                </div>
                                {watermarkUrl && (
                                  <button onClick={() => setWatermarkUrl(null)} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                                    <X className="w-3 h-3" /> Remove
                                  </button>
                                )}
                              </div>

                              <label className="flex items-center gap-2 bg-black/40 border border-white/10 rounded px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors group">
                                {isUploadingWatermark ? <Loader2 className="w-3 h-3 animate-spin text-gray-400" /> : <Upload className="w-3 h-3 text-gray-500 group-hover:text-white" />}
                                <span className="text-xs text-gray-400 group-hover:text-white transition-colors truncate flex-1">
                                  {watermarkUrl ? "Change Logo Image..." : "Upload Logo Image..."}
                                </span>
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setIsUploadingWatermark(true);
                                    try {
                                      const reader = new FileReader();
                                      reader.onload = (event) => {
                                        setWatermarkUrl(event.target?.result as string);
                                        setIsUploadingWatermark(false);
                                      };
                                      reader.readAsDataURL(file);
                                    } catch (err) {
                                      console.error("Failed to load watermark", err);
                                      setIsUploadingWatermark(false);
                                    }
                                  }}
                                />
                              </label>

                              {watermarkUrl && (
                                <div className="mt-2 h-16 w-full bg-black/50 rounded border border-white/10 flex items-center justify-center p-2 relative">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={watermarkUrl} className="max-h-full max-w-full object-contain" alt="Watermark Preview" />
                                  <span className="absolute bottom-1 right-2 text-[8px] text-gray-600 font-mono">PREVIEW</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Intro / Outro Settings */}
                      <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                        <button
                          onClick={() => setExpandedSection(expandedSection === 'intro' ? null : 'intro')}
                          className="w-full text-left p-4 flex justify-between items-center bg-black/20 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
                            <Film className="w-4 h-4 text-green-400" /> Intro / Outro
                          </div>
                          <ChevronDown className={clsx("w-4 h-4 transition-transform text-gray-500", expandedSection === 'intro' ? "rotate-180" : "")} />
                        </button>

                        {expandedSection === 'intro' && (
                          <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            {/* Intro */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-gray-400">Intro Media</span>
                                {introMedia ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-green-400">{introMedia.type} ({introMedia.duration.toFixed(1)}s)</span>
                                    <button onClick={() => setIntroMedia(null)} className="text-gray-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                                  </div>
                                ) : null}
                              </div>
                              <label className="flex items-center gap-2 bg-black/40 border border-white/10 rounded px-2 py-1.5 cursor-pointer hover:bg-white/5 transition-colors">
                                <Upload className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-300 truncate w-full">
                                  {introMedia ? "Change Intro..." : "Upload Video/Image"}
                                </span>
                                <input type="file" className="hidden" accept="video/*,image/*" onChange={e => handleMediaUpload(e, true)} />
                              </label>
                              {introMedia && introMedia.type === 'image' && (
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-gray-400 w-20">Duration (s)</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    step="0.5"
                                    value={introMedia.duration}
                                    onChange={(e) => setIntroMedia({ ...introMedia, duration: parseFloat(e.target.value) })}
                                    className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-green-500"
                                  />
                                </div>
                              )}
                            </div>

                            {/* Outro */}
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-gray-400">Outro Media</span>
                                {outroMedia ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-green-400">{outroMedia.type} ({outroMedia.duration.toFixed(1)}s)</span>
                                    <button onClick={() => setOutroMedia(null)} className="text-gray-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                                  </div>
                                ) : null}
                              </div>
                              <label className="flex items-center gap-2 bg-black/40 border border-white/10 rounded px-2 py-1.5 cursor-pointer hover:bg-white/5 transition-colors">
                                <Upload className="w-3 h-3 text-gray-400" />
                                <span className="text-xs text-gray-300 truncate w-full">
                                  {outroMedia ? "Change Outro..." : "Upload Video/Image"}
                                </span>
                                <input type="file" className="hidden" accept="video/*,image/*" onChange={e => handleMediaUpload(e, false)} />
                              </label>
                              {outroMedia && outroMedia.type === 'image' && (
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-gray-400 w-20">Duration (s)</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="60"
                                    step="0.5"
                                    value={outroMedia.duration}
                                    onChange={(e) => setOutroMedia({ ...outroMedia, duration: parseFloat(e.target.value) })}
                                    className="flex-1 bg-black/40 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none focus:border-green-500"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 3. Subtitle Settings */}
                      <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                        <button
                          onClick={() => setExpandedSection(expandedSection === 'subtitle' ? null : 'subtitle')}
                          className="w-full text-left p-4 flex justify-between items-center bg-black/20 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
                            <MessageSquare className="w-4 h-4 text-purple-400" /> Subtitle
                          </div>
                          <ChevronDown className={clsx("w-4 h-4 transition-transform text-gray-500", expandedSection === 'subtitle' ? "rotate-180" : "")} />
                        </button>

                        {expandedSection === 'subtitle' && (
                          <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            <div className="flex justify-between items-center">
                              <label className="text-xs text-gray-400">Color</label>
                              <input
                                type="color"
                                value={subtitleColor}
                                onChange={(e) => setSubtitleColor(e.target.value)}
                                className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                              />
                            </div>

                            {/* Size */}
                            <div>
                              <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Size</span>
                                <span className="text-purple-400 font-mono">{subtitleFontSize}px</span>
                              </div>
                              <input
                                type="range" min="20" max="200" step="1"
                                value={subtitleFontSize}
                                onChange={(e) => setSubtitleFontSize(parseInt(e.target.value))}
                                className="w-full accent-purple-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                              />
                            </div>

                            {/* Font Family */}
                            <div>
                              <label className="text-xs text-gray-400 block mb-1">Font Family</label>
                              <select
                                value={subtitleFont}
                                onChange={(e) => setSubtitleFont(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-purple-500 transition-colors"
                                style={{ fontFamily: subtitleFont }}
                              >
                                {fontOptions.map(f => (
                                  <option key={f} value={f} style={{ fontFamily: f }}>
                                    {fontDisplayMap[f] || f}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Animation Selectors */}
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div>
                                <label className="text-xs text-gray-400 block mb-1">Entrance Animation</label>
                                <select
                                  value={subtitleEntranceAnimation}
                                  onChange={(e) => setSubtitleEntranceAnimation(e.target.value as any)}
                                  className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                                >
                                  <option value="none">None</option>
                                  <option value="fade">Fade</option>
                                  <option value="slide-up">Slide Up</option>
                                  <option value="slide-down">Slide Down</option>
                                  <option value="slide-left">Slide Left</option>
                                  <option value="slide-right">Slide Right</option>
                                  <option value="zoom-in">Zoom In</option>
                                  <option value="zoom-out">Zoom Out</option>
                                  <option value="pop">Pop</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 block mb-1">Exit Animation</label>
                                <select
                                  value={subtitleExitAnimation}
                                  onChange={(e) => setSubtitleExitAnimation(e.target.value as any)}
                                  className="w-full bg-black/50 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                                >
                                  <option value="none">None</option>
                                  <option value="fade">Fade</option>
                                  <option value="slide-up">Slide Up</option>
                                  <option value="slide-down">Slide Down</option>
                                  <option value="slide-left">Slide Left</option>
                                  <option value="slide-right">Slide Right</option>
                                  <option value="zoom-in">Zoom In</option>
                                  <option value="zoom-out">Zoom Out</option>
                                  <option value="pop">Pop</option>
                                </select>
                              </div>
                            </div>

                            {/* Dynamic Style Settings */}
                            <div className="space-y-4 pt-4 border-t border-white/5">
                              {/* 1. Quick Style */}
                              <div>
                                <label className="text-xs font-bold text-gray-400 mb-2 block flex items-center gap-1"><Palette className="w-3 h-3" /> Quick Style</label>
                                <select
                                  value={subtitlePreset}
                                  onChange={(e) => {
                                    const preset = e.target.value;
                                    setSubtitlePreset(preset);
                                    const selectedPreset = CAPTION_PRESETS.find(p => p.id === preset);

                                    if (selectedPreset) {
                                      setSubtitleColor(selectedPreset.style.colors.baseFill);
                                      setSubtitleStrokeColor(selectedPreset.style.colors.stroke);
                                      setSubtitleStrokeWidth(selectedPreset.style.colors.strokeThickness);
                                      setSubtitleOpacity(1.0);
                                    }
                                  }}
                                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-2 text-xs text-white outline-none focus:border-purple-500"
                                >
                                  <option value="custom">Custom</option>
                                  {CAPTION_PRESETS.map((preset) => (
                                    <option key={preset.id} value={preset.id}>
                                      {preset.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* 2. Stroke Settings */}
                              <div className="space-y-2 p-3 bg-black/20 rounded-lg border border-white/5">
                                <div className="flex justify-between items-center">
                                  <label className="text-xs text-gray-400">Stroke Color</label>
                                  <div className="relative w-6 h-6 flex items-center justify-center">
                                    <div className="w-4 h-4 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: subtitleStrokeColor }}></div>
                                    <input
                                      type="color"
                                      value={subtitleStrokeColor}
                                      onChange={(e) => {
                                        setSubtitleStrokeColor(e.target.value);
                                        setSubtitlePreset('custom');
                                      }}
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 border-none"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>Stroke Width</span>
                                    <span className="text-purple-400 font-mono">{subtitleStrokeWidth}px</span>
                                  </div>
                                  <input
                                    type="range" min="0" max="20" step="1"
                                    value={subtitleStrokeWidth}
                                    onChange={(e) => {
                                      setSubtitleStrokeWidth(parseInt(e.target.value));
                                      setSubtitlePreset('custom');
                                    }}
                                    className="w-full accent-purple-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>
                              </div>

                              <div className="space-y-2 p-3 bg-black/20 rounded-lg border border-white/5">
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                  <span>Text Opacity</span>
                                  <span className="text-purple-400 font-mono">{Math.round(subtitleOpacity * 100)}%</span>
                                </div>
                                <input
                                  type="range" min="0" max="1" step="0.1"
                                  value={subtitleOpacity}
                                  onChange={(e) => {
                                    setSubtitleOpacity(parseFloat(e.target.value));
                                    setSubtitlePreset('custom');
                                  }}
                                  className="w-full accent-purple-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>

                              {/* 4. Background Settings */}
                              <div className="space-y-2 p-3 bg-black/20 rounded-lg border border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                  <label className="text-xs text-gray-400">Background Color</label>
                                  <div className="relative w-6 h-6 flex items-center justify-center">
                                    <div className="w-4 h-4 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: subtitleBackgroundColor }}></div>
                                    <input
                                      type="color"
                                      value={subtitleBackgroundColor}
                                      onChange={(e) => setSubtitleBackgroundColor(e.target.value)}
                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 border-none"
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-between text-xs text-gray-400 mb-1">
                                  <span>Background Opacity</span>
                                  <span className="text-purple-400 font-mono">{Math.round(subtitleBackgroundOpacity * 100)}%</span>
                                </div>
                                <input
                                  type="range" min="0" max="1" step="0.1"
                                  value={subtitleBackgroundOpacity}
                                  onChange={(e) => setSubtitleBackgroundOpacity(parseFloat(e.target.value))}
                                  className="w-full accent-purple-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>
                            </div>

                            {/* Toggle */}
                            <div className="flex items-center justify-between pt-2 border-t border-white/5">
                              <label className="text-xs font-bold text-gray-400">Show Subtitles</label>
                              <input
                                type="checkbox"
                                checked={showSubtitles}
                                onChange={(e) => setShowSubtitles(e.target.checked)}
                                className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 4. Narration Settings */}
                      <div className="bg-white/5 rounded-xl border border-white/5 overflow-hidden">
                        <button
                          onClick={() => setExpandedSection(expandedSection === 'narration' ? null : 'narration')}
                          className="w-full text-left p-4 flex justify-between items-center bg-black/20 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-2 text-sm font-bold text-gray-300">
                            <FileText className="w-4 h-4 text-blue-400" /> Narration Text
                          </div>
                          <ChevronDown className={clsx("w-4 h-4 transition-transform text-gray-500", expandedSection === 'narration' ? "rotate-180" : "")} />
                        </button>

                        {expandedSection === 'narration' && (
                          <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                            {/* Mode Switcher */}
                            <div className="flex bg-black/40 p-1 rounded-lg mb-4">
                              <button
                                onClick={() => setCaptionConfig(prev => ({ ...prev, mode: 'standard' }))}
                                className={clsx(
                                  "flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2",
                                  captionConfig.mode === 'standard' ? "bg-white/10 text-white shadow" : "text-gray-500 hover:text-gray-300"
                                )}
                              >
                                <FileText className="w-3 h-3" /> Standard
                              </button>
                              <button
                                onClick={() => setCaptionConfig(prev => ({ ...prev, mode: 'dynamic' }))}
                                className={clsx(
                                  "flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2",
                                  captionConfig.mode === 'dynamic' ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow" : "text-gray-500 hover:text-gray-300"
                                )}
                              >
                                <Sparkles className="w-3 h-3" /> Dynamic
                              </button>
                            </div>

                            {captionConfig.mode === 'standard' ? (
                              // STANDARD MODE (Existing Controls)
                              <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                                <div className="flex justify-between items-center">
                                  <label className="text-xs text-gray-400">Color</label>
                                  <input
                                    type="color"
                                    value={narrationColor}
                                    onChange={(e) => setNarrationColor(e.target.value)}
                                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
                                  />
                                </div>

                                {/* Size */}
                                <div>
                                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>Size</span>
                                    <span className="text-blue-400 font-mono">{narrationFontSize}px</span>
                                  </div>
                                  <input
                                    type="range" min="16" max="80" step="1"
                                    value={narrationFontSize}
                                    onChange={(e) => setNarrationFontSize(parseInt(e.target.value))}
                                    className="w-full accent-blue-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>

                                {/* Ticker Speed Slider */}
                                <div>
                                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>Ticker Speed</span>
                                    <span className="text-blue-400 font-mono">x{tickerSpeed.toFixed(1)}</span>
                                  </div>
                                  <input
                                    type="range" min="0.1" max="3.0" step="0.1"
                                    value={tickerSpeed}
                                    onChange={(e) => setTickerSpeed(parseFloat(e.target.value))}
                                    className="w-full accent-blue-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>



                                <select
                                  value={narrationFont}
                                  onChange={(e) => setNarrationFont(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-blue-500 transition-colors"
                                  style={{ fontFamily: narrationFont }}
                                >
                                  {fontOptions.map(f => (
                                    <option key={f} value={f} style={{ fontFamily: f }}>
                                      {fontDisplayMap[f] || f}
                                    </option>
                                  ))}
                                </select>

                                {/* Background Settings */}
                                <div className="space-y-2 p-3 bg-black/20 rounded-lg border border-white/5">
                                  <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs text-gray-400">Background Color</label>
                                    <div className="relative w-6 h-6 flex items-center justify-center">
                                      <div className="w-4 h-4 rounded-full border border-white/20 shadow-sm" style={{ backgroundColor: narrationBackgroundColor }}></div>
                                      <input
                                        type="color"
                                        value={narrationBackgroundColor}
                                        onChange={(e) => setNarrationBackgroundColor(e.target.value)}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer p-0 border-none"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                                    <span>Background Opacity</span>
                                    <span className="text-blue-400 font-mono">{Math.round(narrationBackgroundOpacity * 100)}%</span>
                                  </div>
                                  <input
                                    type="range" min="0" max="1" step="0.1"
                                    value={narrationBackgroundOpacity}
                                    onChange={(e) => setNarrationBackgroundOpacity(parseFloat(e.target.value))}
                                    className="w-full accent-blue-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                  />
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="space-y-5 animate-in fade-in slide-in-from-right-2 duration-300">

                                  {/* 2. Quick Style */}
                                  <div>
                                    <label className="text-xs font-bold text-gray-400 mb-2 block flex items-center gap-1"><Palette className="w-3 h-3" /> Quick Style</label>
                                    <select
                                      value={captionConfig.dynamicStyle.preset}
                                      onChange={(e) => {
                                        const preset = e.target.value;
                                        const selectedPreset = CAPTION_PRESETS.find(p => p.id === preset);

                                        if (selectedPreset) {
                                          setCaptionConfig(prev => ({
                                            ...prev,
                                            dynamicStyle: {
                                              ...prev.dynamicStyle,
                                              preset,
                                              ...selectedPreset.style
                                            }
                                          }));
                                        } else {
                                          // Custom or unknown
                                          setCaptionConfig(prev => ({
                                            ...prev,
                                            dynamicStyle: { ...prev.dynamicStyle, preset }
                                          }));
                                        }
                                      }}
                                      className="w-full bg-black/40 border border-white/10 rounded px-2 py-2 text-xs text-white outline-none focus:border-orange-500"
                                    >
                                      <option value="custom">Custom</option>
                                      {CAPTION_PRESETS.map((preset) => (
                                        <option key={preset.id} value={preset.id}>
                                          {preset.label}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* 2.5 Sync / Timing (New) */}
                                  <div>
                                    <div className="flex justify-between text-xs text-gray-400 mb-2">
                                      <label className="font-bold block flex items-center gap-1"><Clock className="w-3 h-3" /> Sync Offset (Timing)</label>
                                      <span className={clsx("font-mono font-bold", subtitleSyncShift > 0 ? "text-yellow-400" : subtitleSyncShift < 0 ? "text-blue-400" : "text-gray-500")}>
                                        {subtitleSyncShift > 0 ? "+" : ""}{subtitleSyncShift.toFixed(1)}s
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min="-2.0" max="2.0" step="0.1"
                                      value={subtitleSyncShift}
                                      onChange={(e) => setSubtitleSyncShift(parseFloat(e.target.value))}
                                      className="w-full accent-green-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">
                                      (+) Delay Highlight | (-) Advance Highlight
                                    </p>
                                  </div>

                                  {/* 3. Highlight Settings */}
                                  <div>
                                    <label className="text-xs font-bold text-gray-400 mb-2 block">Highlight Colors</label>


                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="bg-white/5 p-2 rounded border border-white/5">
                                        <div className="text-[10px] text-gray-500 mb-1">Active Word</div>
                                        <div className="flex items-center gap-2">
                                          <input type="color" value={captionConfig.dynamicStyle.colors.activeFill}
                                            onChange={(e) => setCaptionConfig(prev => ({ ...prev, dynamicStyle: { ...prev.dynamicStyle, colors: { ...prev.dynamicStyle.colors, activeFill: e.target.value } } }))}
                                            className="w-6 h-6 rounded bg-transparent border-none p-0 cursor-pointer" />
                                          <span className="text-xs font-mono text-gray-300">{captionConfig.dynamicStyle.colors.activeFill}</span>
                                        </div>
                                      </div>
                                      <div className="bg-white/5 p-2 rounded border border-white/5">
                                        <div className="text-[10px] text-gray-500 mb-1">Base Text</div>
                                        <div className="flex items-center gap-2">
                                          <input type="color" value={captionConfig.dynamicStyle.colors.baseFill}
                                            onChange={(e) => setCaptionConfig(prev => ({ ...prev, dynamicStyle: { ...prev.dynamicStyle, colors: { ...prev.dynamicStyle.colors, baseFill: e.target.value } } }))}
                                            className="w-6 h-6 rounded bg-transparent border-none p-0 cursor-pointer" />
                                          <span className="text-xs font-mono text-gray-300">{captionConfig.dynamicStyle.colors.baseFill}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 4. Typography */}
                                  <div>
                                    <label className="text-xs font-bold text-gray-400 mb-2 block flex items-center gap-1"><FileText className="w-3 h-3" /> Typography</label>
                                    <div className="space-y-2">
                                      {/* Font Size Slider */}
                                      <div>
                                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                                          <span>Size</span>
                                          <span className="text-orange-400 font-mono">{captionConfig.dynamicStyle.fontSize}px</span>
                                        </div>
                                        <input
                                          type="range" min="40" max="200" step="5"
                                          value={captionConfig.dynamicStyle.fontSize}
                                          onChange={(e) => setCaptionConfig(prev => ({ ...prev, dynamicStyle: { ...prev.dynamicStyle, fontSize: parseInt(e.target.value) } }))}
                                          className="w-full accent-orange-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                        />
                                      </div>

                                      <select
                                        value={captionConfig.dynamicStyle.fontFamily}
                                        onChange={(e) => setCaptionConfig(prev => ({ ...prev, dynamicStyle: { ...prev.dynamicStyle, fontFamily: e.target.value } }))}
                                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none focus:border-orange-500"
                                        style={{ fontFamily: captionConfig.dynamicStyle.fontFamily }}
                                      >
                                        {fontOptions.map(f => (
                                          <option key={f} value={f} style={{ fontFamily: f }}>{fontDisplayMap[f] || f}</option>
                                        ))}
                                      </select>

                                      <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-gray-500 w-12">Stroke</span>
                                        <input
                                          type="range" min="0" max="20" step="1"
                                          value={captionConfig.dynamicStyle.colors.strokeThickness}
                                          onChange={(e) => setCaptionConfig(prev => ({ ...prev, dynamicStyle: { ...prev.dynamicStyle, colors: { ...prev.dynamicStyle.colors, strokeThickness: parseInt(e.target.value) } } }))}
                                          className="flex-1 accent-orange-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <span className="text-[10px] text-orange-400 w-6 text-right">{captionConfig.dynamicStyle.colors.strokeThickness}px</span>
                                      </div>

                                      {/* Opacity & Intensity */}
                                      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
                                        <div className="flex-1">
                                          <div className="flex justify-between mb-1">
                                            <label className="text-[10px] text-gray-500">Opacity</label>
                                            <span className="text-[10px] text-gray-400">{Math.round((captionConfig.dynamicStyle.opacity ?? 1) * 100)}%</span>
                                          </div>
                                          <input
                                            type="range" min="0.1" max="1" step="0.1"
                                            value={captionConfig.dynamicStyle.opacity ?? 1}
                                            onChange={(e) => setCaptionConfig(prev => ({ ...prev, dynamicStyle: { ...prev.dynamicStyle, opacity: parseFloat(e.target.value) } }))}
                                            className="w-full accent-blue-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                          />
                                        </div>
                                        <div className="flex-1">
                                          <div className="flex justify-between mb-1">
                                            <label className="text-[10px] text-gray-500">Intensity</label>
                                            <span className="text-[10px] text-gray-400">x{captionConfig.dynamicStyle.intensity ?? 1}</span>
                                          </div>
                                          <input
                                            type="range" min="0" max="2" step="0.1"
                                            value={captionConfig.dynamicStyle.intensity ?? 1}
                                            onChange={(e) => setCaptionConfig(prev => ({ ...prev, dynamicStyle: { ...prev.dynamicStyle, intensity: parseFloat(e.target.value) } }))}
                                            className="w-full accent-red-500 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* 5. Animation & Layout */}
                                  <div>
                                    <label className="text-xs font-bold text-gray-400 mb-2 block flex items-center gap-1"><LayoutTemplate className="w-3 h-3" /> Animation & Layout</label>
                                    <div className="grid grid-cols-2 gap-3 mb-2">
                                      <select
                                        value={captionConfig.dynamicStyle.animation}
                                        onChange={(e) => setCaptionConfig(prev => ({ ...prev, dynamicStyle: { ...prev.dynamicStyle, animation: e.target.value as any } }))}
                                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-2 text-xs text-white outline-none focus:border-orange-500"
                                      >
                                        <option value="none">No Motion</option>
                                        <option value="pop">💥 Pop Up</option>
                                        <option value="shake">🫨 Shake</option>
                                        <option value="elastic">🎸 Elastic</option>
                                        <option value="mask_reveal">🎭 Mask Reveal</option>
                                        <option value="typewriter">⌨️ Typewriter</option>
                                        <option value="karaoke_v2">🎤 Karaoke (Fill)</option>
                                        <option value="kinetic_stacking">📚 Kinetic Stacking</option>
                                      </select>

                                      <select
                                        value={captionConfig.dynamicStyle.layout.wordsPerLine}
                                        onChange={(e) => setCaptionConfig(prev => ({ ...prev, dynamicStyle: { ...prev.dynamicStyle, layout: { ...prev.dynamicStyle.layout, wordsPerLine: parseInt(e.target.value) } } }))}
                                        className="w-full bg-black/40 border border-white/10 rounded px-2 py-2 text-xs text-white outline-none focus:border-orange-500"
                                      >
                                        <option value="1">1 Word / Line</option>
                                        <option value="2">2 Words / Line</option>
                                        <option value="3">3 Words / Line</option>
                                        <option value="0">Auto</option>
                                      </select>
                                    </div>

                                    {/* Vertical Position */}
                                    <div className="mb-2">
                                      <label className="text-xs text-gray-500 mb-1 block">Vertical Position</label>
                                      <div className="flex bg-black/40 rounded p-1 gap-1">
                                        {['top', 'middle', 'bottom'].map((pos) => (
                                          <button
                                            key={pos}
                                            onClick={() => setCaptionConfig(prev => ({ ...prev, dynamicStyle: { ...prev.dynamicStyle, layout: { ...prev.dynamicStyle.layout, verticalPosition: pos as any } } }))}
                                            className={clsx(
                                              "flex-1 py-1 text-[10px] uppercase font-bold rounded transition-colors",
                                              captionConfig.dynamicStyle.layout.verticalPosition === pos
                                                ? "bg-orange-500 text-white shadow"
                                                : "text-gray-400 hover:bg-white/5"
                                            )}
                                          >
                                            {pos}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <label className="flex items-center gap-2 cursor-pointer mt-2">
                                      <input
                                        type="checkbox"
                                        checked={captionConfig.dynamicStyle.layout.safeZonePadding}
                                        onChange={(e) => setCaptionConfig(prev => ({ ...prev, dynamicStyle: { ...prev.dynamicStyle, layout: { ...prev.dynamicStyle.layout, safeZonePadding: e.target.checked } } }))}
                                        className="w-3 h-3 accent-green-500 rounded"
                                      />
                                      <span className="text-[10px] text-gray-400">Show Safe Zone (Previews UI overlap)</span>
                                    </label>
                                  </div>
                                </div>

                              </>
                            )}

                            {/* Global Toggle (Applies to both) */}
                            <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-2">
                              <label className="text-xs font-bold text-gray-400">Show Narration Text</label>
                              <input
                                type="checkbox"
                                checked={showNarrationText}
                                onChange={(e) => {
                                  setShowNarrationText(e.target.checked);
                                  setCaptionConfig(prev => ({ ...prev, enabled: e.target.checked }));
                                }}
                                className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                        <h4 className="flex items-center gap-2 text-sm font-bold text-blue-300 mb-2">
                          <Info className="w-4 h-4" /> Layout Tip
                        </h4>
                        <p className="text-xs text-blue-200/70 leading-relaxed">
                          Split layout (Subtitle Top, Narration Bottom) activates ONLY when:
                          <br />• <strong>Canvas</strong> is Vertical (9:16)
                          <br />• <strong>Image</strong> is Horizontal (16:9)
                          <br /><br />
                          Otherwise, text appears as a ticker at the bottom.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-white/10 flex justify-end gap-4 bg-white/5">
                  <button
                    onClick={() => setShowRenderSettings(false)}
                    className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (currentProjectId) {
                        try {
                          // Auto-save settings before rendering using Update Mode
                          await handleSaveProject(true);
                        } catch (e) {
                          console.error("Auto-save failed before render", e);
                        }
                      }
                      setRenderLogs([]);
                      handleConfirmRender();
                    }}
                    className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold rounded-xl shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
                  >
                    <VideoIcon className="w-5 h-5" />
                    Start Rendering
                  </button>
                </div>
              </div>
            </div>
            )
      }

            {/* Site Manager Modal */}
            {
              isSiteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                  <div className="bg-[#1a1a1a] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[80vh]">

                    {/* Header */}
                    <div className="p-4 border-b border-white/10 flex items-center justify-between">
                      <h3 className="font-bold text-lg text-white">Saved Sites</h3>
                      <button onClick={() => setIsSiteModalOpen(false)} className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">

                      {/* Add New Site Toggle */}
                      {!isAddingSite ? (
                        <button
                          onClick={() => setIsAddingSite(true)}
                          className="w-full py-3 border border-dashed border-white/20 rounded-xl text-gray-400 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all text-sm flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Register New Site
                        </button>
                      ) : (
                        <div className="bg-white/5 p-4 rounded-xl border border-white/10 space-y-3 animate-in fade-in slide-in-from-top-2">
                          <input
                            value={newSiteName}
                            onChange={e => setNewSiteName(e.target.value)}
                            placeholder="Site Name (e.g. Seocho)"
                            className="w-full bg-black/40 border border-white/10 p-2 rounded-lg text-sm text-white focus:border-purple-500 outline-none"
                            autoFocus
                          />
                          <input
                            value={newSiteUrl}
                            onChange={e => setNewSiteUrl(e.target.value)}
                            placeholder="Target URL"
                            className="w-full bg-black/40 border border-white/10 p-2 rounded-lg text-sm text-white focus:border-purple-500 outline-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setIsAddingSite(false)}
                              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleAddSite}
                              className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium"
                            >
                              Save Site
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Site List */}
                      <div className="space-y-2">
                        {sites.length === 0 && !isAddingSite && (
                          <div className="text-center py-8 text-gray-500 text-sm">
                            No saved sites yet.
                          </div>
                        )}

                        {sites.map((site, idx) => (
                          <div key={site.id || idx} className={clsx(
                            "group relative border p-3 rounded-xl transition-all",
                            editingSiteId === site.id ? "bg-white/10 border-purple-500/50" : "bg-white/5 hover:bg-white/10 border-transparent hover:border-white/10 cursor-pointer"
                          )}
                            onClick={() => {
                              if (editingSiteId === site.id) return;
                              setUrl(site.url);
                              setIsSiteModalOpen(false);
                            }}
                          >
                            {editingSiteId === site.id ? (
                              <div className="space-y-2" onClick={e => e.stopPropagation()}>
                                <input
                                  value={editSiteName}
                                  onChange={e => setEditSiteName(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 p-1.5 rounded text-sm text-white focus:border-purple-500 outline-none"
                                  placeholder="Site Name"
                                  autoFocus
                                />
                                <input
                                  value={editSiteUrl}
                                  onChange={e => setEditSiteUrl(e.target.value)}
                                  className="w-full bg-black/40 border border-white/10 p-1.5 rounded text-xs text-gray-300 focus:border-purple-500 outline-none"
                                  placeholder="URL"
                                />
                                <div className="flex justify-end gap-2 pt-1">
                                  <button
                                    onClick={() => setEditingSiteId(null)}
                                    className="px-2 py-1 text-xs text-gray-400 hover:text-white rounded hover:bg-white/10"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={handleUpdateSite}
                                    className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="pr-16">
                                  <div className="font-medium text-white mb-0.5">{site.name}</div>
                                  <div className="text-xs text-gray-500 truncate">{site.url}</div>
                                </div>
                                {site.id && (
                                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all bg-[#2a2a2a] rounded-lg shadow-xl p-1 border border-white/5">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditClick(site as any);
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-white/5 rounded-md transition-colors"
                                      title="Edit Site"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSite(site.id as string);
                                      }}
                                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-md transition-colors"
                                      title="Remove Site"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        ))}
                      </div>

                    </div>

                  </div>
                </div>
              )
            }

            {/* Image Preview Modal */}
            {
              previewImage && (
                <div
                  className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in duration-200"
                  onClick={() => setPreviewImage(null)}
                >
                  <div className="relative max-w-5xl w-full max-h-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setPreviewImage(null)}
                      className="absolute -top-12 right-0 text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="w-8 h-8" />
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewImage}
                      alt="Preview"
                      className="w-auto h-auto max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-white/10"
                    />
                    <div className="mt-4 flex gap-4">
                      <button
                        onClick={() => setPreviewImage(null)}
                        className="px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
                      >
                        Close
                      </button>
                      <a
                        href={previewImage}
                        download={`scene_image_${Date.now()}.jpg`}
                        className="px-6 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Upload className="w-4 h-4 rotate-180" /> Download
                      </a>
                    </div>
                  </div>
                </div>
              )
            }
            {/* Save Options Modal */}
            {
              showSaveOptions && (
                <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                  <div className="bg-[#1a1a1a] w-full max-w-sm rounded-2xl border border-white/10 shadow-2xl p-6 space-y-4">
                    <h3 className="text-xl font-bold text-white mb-2">Save Project</h3>
                    <p className="text-gray-400 text-sm">
                      How would you like to save your changes?
                    </p>

                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="text-xs text-gray-400 block mb-1">Version Memo</label>
                        <input
                          value={saveMemo}
                          onChange={(e) => setSaveMemo(e.target.value)}
                          placeholder="e.g. Changed Intro Music"
                          className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-blue-500 outline-none"
                        />
                      </div>
                      <button
                        onClick={() => handleSaveProject(true, 'pre')}
                        disabled={isProcessing}
                        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                      >
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                      </button>

                      <button
                        onClick={() => {
                          if (!saveMemo || !saveMemo.trim()) {
                            alert("Please enter a Version Memo to save as a new version.");
                            return;
                          }
                          handleSaveProject(true, 'snapshot');
                        }}
                        disabled={isProcessing}
                        className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
                      >
                        <HistoryIcon className="w-4 h-4" />
                        Save as New Version
                      </button>
                    </div>

                    <button
                      onClick={() => setShowSaveOptions(false)}
                      className="w-full py-2 text-gray-500 hover:text-white text-sm transition-colors mt-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            }
            {
              showSNSModal && (currentProjectId || selectedProject) && (
                <SNSUploadModal
                  project={selectedProject ? {
                    id: selectedProject.id,
                    title: selectedProject.title,
                    videoPath: selectedProject.videoPath,
                    description: selectedProject.description
                  } : {
                    id: currentProjectId!,
                    title: projectTitle,
                    videoPath: "",
                  }}
                  onClose={() => setShowSNSModal(false)}
                  onUploadSuccess={async (url: string) => {
                    alert("Upload Successful: " + url);
                    setShowSNSModal(false);

                    // 1. Refresh global list (Grid View)
                    await fetchServerProjects();

                    // 2. If viewing details (Gallery), refresh that specific project to see new history
                    if (selectedProject) {
                      try {
                        const res = await fetch(`/api/projects?id=${selectedProject.id}`);
                        const data = await res.json();
                        // Ensure we preserve any local view state if needed, but data has the fresh uploads
                        setSelectedProject(data);
                      } catch (e) {
                        console.error("Failed to refresh project details", e);
                      }
                    }
                  }}
                />
              )
            }
            {
              showSNSManager && (
                <SNSManagerModal onClose={() => setShowSNSManager(false)} />
              )
            }
            {/* Image Crop Modal */}
            {cropModal?.isOpen && (
              <ImageCropModal
                imageUrl={cropModal.imageUrl}
                targetWidth={cropModal.targetW}
                targetHeight={cropModal.targetH}
                onConfirm={(croppedUrl) => {
                  setSceneItems(prev => {
                    const updated = [...prev];
                    updated[cropModal.sceneIndex] = { ...updated[cropModal.sceneIndex], imageUrl: croppedUrl, status: 'approved' as any };
                    return updated;
                  });
                  setCropModal(null);
                }}
                onUseOriginal={() => {
                  setSceneItems(prev => {
                    const updated = [...prev];
                    updated[cropModal.sceneIndex] = { ...updated[cropModal.sceneIndex], imageUrl: cropModal.imageUrl, status: 'approved' as any };
                    return updated;
                  });
                  setCropModal(null);
                }}
                onClose={() => setCropModal(null)}
              />
            )}
          </main>
        );
}
