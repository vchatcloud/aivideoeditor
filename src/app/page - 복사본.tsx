"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import WebGPURenderer, { MediaAsset, CaptionConfig } from "../components/WebGPURenderer";
import NarrationStudio, { NarrationScene, VOICE_DATA } from "../components/NarrationStudio";
import SNSUploadModal from "../components/SNSUploadModal";
import {
  Layout, Type, Video, Music, Settings, Download, Upload,
  Share2, Save, FolderOpen, RefreshCw, Wand2, Layers,
  MonitorPlay, Mic, Image as ImageIcon, Plus, Trash2,
  ChevronRight, ChevronLeft, ChevronDown, ChevronUp
} from "lucide-react";
import { Toaster, toast } from "react-hot-toast";

// --- Interfaces ---

interface ProjectRecord {
  id: string;
  title: string;
  description: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  updatedAt: string;
  settings?: any;
  masterRecordId?: string; // Versioning
}

interface AnalysisResult {
  title: string;
  scenes: NarrationScene[];
  audioSrc?: string; // BGM
}

// --- Constants ---

const ASPECT_RATIOS = {
  "16:9": { width: 1920, height: 1080, label: "YouTube (Horizontal)" },
  "9:16": { width: 1080, height: 1920, label: "Shorts/Reels (Vertical)" },
  "1:1": { width: 1080, height: 1080, label: "Instagram (Square)" }
};

export default function Home() {
  // --- State: Project ---
  const [projectTitle, setProjectTitle] = useState("Untitled Project");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [masterRecordId, setMasterRecordId] = useState<string | null>(null);
  const [saveMemo, setSaveMemo] = useState("");
  const [projectHistory, setProjectHistory] = useState<ProjectRecord[]>([]);

  // --- State: Content Generation ---
  const [inputUrl, setInputUrl] = useState("");
  const [scrapedContent, setScrapedContent] = useState<{ title: string; text: string; images: string[]; posts?: any[] } | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [videoPurpose, setVideoPurpose] = useState<"sns" | "info" | "promo">("sns");
  const [narrationLength, setNarrationLength] = useState<"short" | "medium" | "long">("medium");

  // --- State: Editor ---
  const [scenes, setScenes] = useState<NarrationScene[]>([]);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [activeTab, setActiveTab] = useState<"editor" | "narration" | "settings">("editor");

  // --- State: Rendering & Assets ---
  const [introMedia, setIntroMedia] = useState<MediaAsset | null>(null);
  const [outroMedia, setOutroMedia] = useState<MediaAsset | null>(null);
  const [introScale, setIntroScale] = useState(100);
  const [outroScale, setOutroScale] = useState(100);
  const [introDuration, setIntroDuration] = useState(3);
  const [outroDuration, setOutroDuration] = useState(3);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | undefined>(undefined); // BGM

  // --- State: Saved Sites & Date ---
  const [savedSites, setSavedSites] = useState<{ id: string; name: string; url: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // --- State: Settings ---
  const [globalSettings, setGlobalSettings] = useState({
    voice: "gemini_fem_01",
    tone: "News",
    speed: 1.0,
    pitch: 0,
    volume: 1.0,
    customPrompt: ""
  });

  // Visibility Toggles
  const [showSubtitles, setShowSubtitles] = useState(true); // Top Text
  const [showNarrationText, setShowNarrationText] = useState(true); // Bottom Text

  // Caption Config
  const [captionConfig, setCaptionConfig] = useState<CaptionConfig>({
    enabled: true,
    mode: 'dynamic',
    dynamicStyle: {
      preset: 'modern',
      fontFamily: 'Pretendard',
      fontSize: 50,
      colors: {
        activeFill: '#ffffff',
        baseFill: '#aaaaaa',
        stroke: '#000000',
        strokeThickness: 4
      },
      animation: 'pop',
      layout: {
        wordsPerLine: 5,
        safeZonePadding: true,
        verticalPosition: 'bottom'
      }
    }
  });

  // --- State: UI Modals ---
  const [selectedPostIndex, setSelectedPostIndex] = useState<number | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showSNSModal, setShowSNSModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false); // Can double as preview
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // --- Refs ---
  const rendererRef = useRef<any>(null); // To trigger render/preview methods if exposed

  // --- Effects ---

  // Load History on Mount
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      // API returns array directly now based on route.ts analysis
      if (Array.isArray(data)) {
        setProjectHistory(data.map((p: any) => ({
          ...p,
          title: p.name || "Untitled" // Map name to title
        })));
      }
    } catch (e) {
      console.error("Failed to load projects", e);
    }
  };

  const fetchSites = async () => {
    try {
      const res = await fetch('/api/sites');
      const data = await res.json();
      if (Array.isArray(data)) setSavedSites(data);
    } catch (e) {
      console.error("Failed to load sites", e);
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  // --- Handlers: Scraper ---

  const handleScrape = async () => {
    if (!inputUrl) return toast.error("Please enter a URL");
    setIsScraping(true);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl, date: selectedDate })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      if (data.posts && Array.isArray(data.posts)) {
        const combinedImages = data.posts.flatMap((p: any) => p.images || []);
        const combinedText = data.posts.map((p: any) => `Title: ${p.title}\n${p.content}`).join('\n\n');
        const title = data.posts.length > 0 ? (data.posts.length === 1 ? data.posts[0].title : `${data.posts.length} Posts from ${new URL(inputUrl).hostname}`) : "Scraped Content";

        setScrapedContent({
          title,
          text: combinedText,
          images: combinedImages,
          posts: data.posts
        });
        setProjectTitle(title);
        setSelectedPostIndex(null); // Reset selection
        toast.success(`Found ${data.posts.length} posts!`);
      } else {
        // Fallback for single object response if API changes
        setScrapedContent(data);
        setProjectTitle(data.title || "New Project");
        toast.success("Content scraped successfully!");
      }
    } catch (e: any) {
      toast.error(e.message || "Scraping failed");
    } finally {
      setIsScraping(false);
    }
  };

  const handleAnalyze = async () => {
    if (!scrapedContent && !inputUrl) return toast.error("No content to analyze");
    setIsAnalyzing(true);

    try {
      let textToAnalyze = inputUrl;
      let imagesToAnalyze: string[] = [];

      if (scrapedContent) {
        if (scrapedContent.posts && selectedPostIndex !== null) {
          // Specific Post
          const post = scrapedContent.posts[selectedPostIndex];
          textToAnalyze = `Title: ${post.title}\n\n${post.content}`;
          imagesToAnalyze = post.images || [];
        } else {
          // Full Scraped Content
          textToAnalyze = `Title: ${scrapedContent.title}\n\n${scrapedContent.text}`;
          imagesToAnalyze = scrapedContent.images || [];
        }
      }

      const payload = {
        text: textToAnalyze,
        videoPurpose: videoPurpose,
        narrationLength: narrationLength,
        selectedStyle: "Photorealistic",
        images: imagesToAnalyze
      };

      const generateRes = await fetch('/api/process-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!generateRes.ok) {
        // Fallback to update logic if specialized route missing
        const text = await generateRes.text();
        try {
          const data = JSON.parse(text);
          console.log("[Analyze] Fallback response:", data);
          if (data.scenes && Array.isArray(data.scenes)) {
            setScenes(data.scenes);
            if (data.scenes.length === 0) toast.error("Analysis returned 0 scenes.");
          }
          if (data.title) setProjectTitle(data.title);
          toast.success("Analysis complete!");
        } catch (e) {
          console.error("[Analyze] Fallback error:", e);
          throw new Error("Invalid response from AI");
        }
      } else {
        const data = await generateRes.json();
        console.log("[Analyze] Success response:", data);

        let validScenes = data.scenes || data.sceneItems || [];
        if (!Array.isArray(validScenes)) validScenes = [];

        setScenes(validScenes);
        if (data.title) setProjectTitle(data.title);

        if (validScenes.length === 0) {
          toast.error("Analysis returned 0 scenes. Please try again.");
        } else {
          toast.success(`Analysis complete! Generated ${validScenes.length} scenes.`);
          // Ensure we are in Edit Mode to see the result
          setIsPreviewMode(false);
        }
      }

    } catch (e: any) {
      console.error(e);
      toast.error("Analysis failed: " + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- Handlers: Audio Generation ---

  const handleGenerateAudio = async (index: number, settings: any = {}) => {
    const scene = scenes[index];
    const text = scene.text;
    const voice = settings.voice || globalSettings.voice;
    const speed = settings.speed || globalSettings.speed;
    const pitch = settings.pitch || globalSettings.pitch; // 0 default

    try {
      const res = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          voiceId: voice,
          speed,
          pitch
        })
      });

      if (!res.ok) throw new Error("TTS Failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Get duration
      const audio = new Audio(url);
      await new Promise(r => audio.onloadedmetadata = r);
      const duration = audio.duration;

      setScenes(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          audioUrl: url,
          audioDuration: duration,
          duration: Math.max(next[index].duration, duration + 1) // Auto-extend scene
        };
        return next;
      });

      toast.success(`Audio generated for scene ${index + 1}`);

    } catch (e) {
      console.error(e);
      toast.error("Audio generation failed");
    }
  };

  // --- Handlers: Project Management ---

  const handleSaveProject = async (overwrite: boolean = true) => {
    const payload = {
      id: overwrite ? projectId : null, // Null to force new
      masterRecordId: overwrite ? masterRecordId : null,
      name: projectTitle, // API expects 'name', not 'title' in destructuring? Check route.ts. route.ts uses { id, name, sceneItems, settings }
      sceneItems: scenes,
      settings: {
        global: globalSettings,
        aspectRatio: selectedAspectRatio,
        captionConfig,
        saveMemo
      },
      thumbnailUrl: scenes[0]?.imageUrl
    };

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.id) {
        setProjectId(data.id);
        setMasterRecordId(data.masterRecordId);
        toast.success(overwrite ? "Project Saved" : "Saved as New Version");
        fetchProjects(); // Refresh history
      }
    } catch (e) {
      toast.error("Save failed");
    }
  };

  const handleLoadProject = (project: ProjectRecord) => {
    setProjectId(project.id);
    setMasterRecordId(project.masterRecordId || null);
    setProjectTitle(project.title);
    // Load settings deep merge...
    if (project.settings) {
      if (project.settings.global) setGlobalSettings(project.settings.global);
      if (project.settings.aspectRatio) setSelectedAspectRatio(project.settings.aspectRatio);
      // ... load other settings
    }
    // Load scenes? Ideally API returns full scenes for the project.
    // Assuming we need to fetch full project details
    fetch(`/api/projects?id=${project.id}`).then(r => r.json()).then(data => {
      if (data.sceneItems) setScenes(data.sceneItems);
    });

    setShowHistoryModal(false);
    setIsPreviewMode(false); // Force Edit Mode (which is previewMode=true in Renderer)
    toast.success("Project loaded");
  };

  // --- Render ---

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden">
      <Head>
        <title>AI Video Editor</title>
      </Head>
      <Toaster position="bottom-right" toastOptions={{ style: { background: '#333', color: '#fff' } }} />

      {/* --- Left Sidebar --- */}
      <div className="w-80 border-r border-white/10 flex flex-col bg-[#111]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            <Video className="w-6 h-6 text-blue-400" />
            AI Studio
          </div>
          <div className="flex items-center gap-2 text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            <Video className="w-6 h-6 text-blue-400" />
            AI Studio
          </div>
          <button onClick={() => setShowHistoryModal(true)} className="p-2 hover:bg-white/10 rounded-full">
            <FolderOpen className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Scraper / Input Section */}
        <div className="p-4 space-y-4 border-b border-white/10">
          <h3 className="text-xs font-bold text-gray-500 uppercase">Content Source</h3>

          {/* Saved Sites Dropdown */}
          <div className="flex flex-col gap-1">
            <select
              onChange={(e) => {
                const site = savedSites.find(s => s.url === e.target.value);
                if (site) setInputUrl(site.url);
              }}
              className="w-full bg-black/30 border border-white/10 rounded p-1 text-xs text-gray-300 outline-none focus:border-blue-500"
            >
              <option value="">Select a Saved Site...</option>
              {savedSites.map(site => (
                <option key={site.id} value={site.url}>{site.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Paste URL to transform..."
              className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1.5 text-sm focus:border-blue-500 outline-none"
            />
            <button
              onClick={handleScrape}
              disabled={isScraping}
              className="p-2 bg-blue-600 rounded hover:bg-blue-500 disabled:opacity-50"
            >
              {isScraping ? <RefreshCw className="animate-spin w-4 h-4" /> : <Download className="w-4 h-4" />}
            </button>
          </div>

          {/* Date Input */}
          <div>
            <label className="text-[10px] text-gray-500 uppercase block mb-1">Reference Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded p-1 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>

          {scrapedContent && (
            <div className="space-y-2">
              <div className="bg-green-900/20 border border-green-500/30 p-2 rounded text-xs text-green-400 flex items-center gap-2">
                <ImageIcon className="w-3 h-3" />
                Content Scraped: {scrapedContent.images?.length || 0} images
              </div>

              {/* Scraped Posts List */}
              {scrapedContent.posts && scrapedContent.posts.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                  {scrapedContent.posts.map((post: any, i: number) => (
                    <div
                      key={i}
                      onClick={() => {
                        setSelectedPostIndex(i);
                        setProjectTitle(post.title);
                        toast.success("Post selected for generation");
                      }}
                      className={`p-2 rounded border cursor-pointer text-xs transition-colors ${selectedPostIndex === i ? 'bg-blue-600/30 border-blue-500 text-white' : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-300'}`}
                    >
                      <div className="font-bold line-clamp-1">{post.title}</div>
                      <div className="flex justify-between mt-1 text-gray-500 text-[10px]">
                        <span>{post.date || "No Date"}</span>
                        {post.images?.length > 0 && <span className="flex items-center gap-1"><ImageIcon className="w-2 h-2" /> {post.images.length}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Analysis Settings */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Purpose</label>
              <select
                value={videoPurpose}
                onChange={(e: any) => setVideoPurpose(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded p-1 text-xs"
              >
                <option value="sns">SNS / Viral</option>
                <option value="info">Informational</option>
                <option value="promo">Promotional</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-500 uppercase block mb-1">Length</label>
              <select
                value={narrationLength}
                onChange={(e: any) => setNarrationLength(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded p-1 text-xs"
              >
                <option value="short">Short (~30s)</option>
                <option value="medium">Medium (~1m)</option>
                <option value="long">Long (~3m)</option>
              </select>
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="w-full py-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded font-bold text-sm shadow-lg hover:shadow-blue-500/20 transition-all flex justify-center items-center gap-2"
          >
            {isAnalyzing ? <RefreshCw className="animate-spin w-4 h-4" /> : <Wand2 className="w-4 h-4" />}
            {isAnalyzing ? "Analyzing..." : "Generate Project"}
          </button>
        </div>

        {/* Save/Version Control */}
        <div className="p-4 space-y-2 border-b border-white/10">
          <h3 className="text-xs font-bold text-gray-500 uppercase">Input Project Title</h3>
          <input
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="w-full bg-transparent border-b border-gray-700 focus:border-blue-500 outline-none text-sm py-1 font-bold"
          />
          <input
            value={saveMemo}
            onChange={(e) => setSaveMemo(e.target.value)}
            placeholder="Version memo (e.g. Added Intro)"
            className="w-full bg-transparent border-b border-gray-700 focus:border-blue-500 outline-none text-xs py-1 text-gray-400"
          />
          <div className="flex gap-2 pt-2">
            <button onClick={() => handleSaveProject(true)} className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs">Save</button>
            <button onClick={() => handleSaveProject(false)} className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs">Save New Ver.</button>
          </div>
        </div>

        <div className="flex-1" />
      </div>

      {/* --- Main Content --- */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Toolbar */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#161616]">
          <div className="flex items-center gap-4">
            {/* Aspect Ratio */}
            <div className="flex bg-black/30 rounded p-1 border border-white/5">
              {Object.keys(ASPECT_RATIOS).map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setSelectedAspectRatio(ratio as any)}
                  className={`px-3 py-1 rounded text-xs font-bold transition-all ${selectedAspectRatio === ratio ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Toggles */}
            <button
              onClick={() => setShowSubtitles(!showSubtitles)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border transition-colors ${showSubtitles ? 'bg-blue-900/30 border-blue-500 text-blue-200' : 'bg-transparent border-gray-700 text-gray-500'}`}
            >
              <Type className="w-3.5 h-3.5" /> Subtitles
            </button>
            <button
              onClick={() => setShowNarrationText(!showNarrationText)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold border transition-colors ${showNarrationText ? 'bg-blue-900/30 border-blue-500 text-blue-200' : 'bg-transparent border-gray-700 text-gray-500'}`}
            >
              <Type className="w-3.5 h-3.5" /> Captions
            </button>

            <div className="h-6 w-px bg-white/10 mx-1" />

            <button
              onClick={() => setShowSNSModal(true)}
              className="flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded text-xs font-bold"
            >
              <Upload className="w-3.5 h-3.5" /> Upload to YouTube
            </button>
            <button
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold"
            >
              <MonitorPlay className="w-3.5 h-3.5" /> {isPreviewMode ? "Edit Mode" : "Preview"}
            </button>
          </div>
        </div>

        {/* Editor Surface */}
        <div className="flex-1 relative bg-[#050505] flex items-center justify-center p-8">

          <div className="relative shadow-2xl shadow-black" style={{
            aspectRatio: selectedAspectRatio === '16:9' ? '16/9' : selectedAspectRatio === '9:16' ? '9/16' : '1/1',
            height: '100%',
            maxHeight: '100%'
          }}>
            <WebGPURenderer
              scenes={scenes as any[]}
              audioSrc={audioSrc}

              // Dimensions
              canvasWidth={ASPECT_RATIOS[selectedAspectRatio].width}
              canvasHeight={ASPECT_RATIOS[selectedAspectRatio].height}

              // Visibility
              showSubtitles={showSubtitles}
              showNarrationText={showNarrationText}

              // Narration
              narrationEnabled={true}
              narrationSpeed={globalSettings.speed}
              narrationPitch={globalSettings.pitch}

              // Assets
              introMedia={introMedia}
              outroMedia={outroMedia}
              introScale={introScale}
              outroScale={outroScale}
              backgroundUrl={backgroundUrl}

              // Captions
              captionConfig={captionConfig}

              // Callbacks
              onComplete={(blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${projectTitle}.webm`;
                a.click();
              }}
              previewMode={!isPreviewMode} // If false, high quality render? Or logic inverse? 
              // Assuming previewMode=true means "fast render/edit", false means "final"
              // The prop name in WebGPURenderer is `previewMode`. 
              // Usually we want previewMode=true in Editor.

              seekToTime={null}
            />
          </div>
        </div>

        {/* Bottom Panel: Narration Studio */}
        <div className="h-80 border-t border-white/10 bg-[#111] flex flex-col">
          {/* DEBUG: Verify Narration Studio Render */}
          {/* {console.log("[Render] Passing scenes to Studio:", scenes?.length)} */}
          <NarrationStudio
            scenes={scenes}
            onUpdate={setScenes}
            onGenerateAudio={handleGenerateAudio}
            globalSettings={globalSettings}
            onGlobalSettingsChange={setGlobalSettings}
            isPlaying={false}       // Managed internally by Studio or lifted to page if needed
            onPlayPause={() => { }} // 
          />
        </div>

      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl w-[600px] max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-400" />
                Open Project
              </h2>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 hover:bg-white/10 rounded-full"
              >
                <ChevronDown className="w-5 h-5 rotate-180" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
              {projectHistory.map(p => (
                <div
                  key={p.id}
                  onClick={() => handleLoadProject(p)}
                  className="bg-black/30 border border-white/5 hover:border-blue-500/50 hover:bg-white/5 p-4 rounded-lg cursor-pointer transition-all group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-gray-200 group-hover:text-white">{p.title}</h3>
                    <span className="text-xs text-gray-500">{new Date(p.updatedAt).toLocaleDateString()}</span>
                  </div>
                  {p.description && <p className="text-xs text-gray-400 line-clamp-2 mb-2">{p.description}</p>}
                  {p.settings?.saveMemo && (
                    <div className="inline-block px-2 py-0.5 bg-blue-900/30 text-blue-400 text-[10px] rounded border border-blue-500/20">
                      {p.settings.saveMemo}
                    </div>
                  )}
                </div>
              ))}

              {projectHistory.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No saved projects found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showSNSModal && projectId && (
        <SNSUploadModal
          project={{
            id: projectId,
            title: projectTitle,
            videoPath: "", // Logic to get path needed
          }}
          onClose={() => setShowSNSModal(false)}
          onUploadSuccess={(url) => {
            // Update local state or history
          }}
        />
      )}
    </div>
  );
}
