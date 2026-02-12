import { create } from 'zustand';
import type { SceneItem, AnalysisResult, ScrapedPost } from '@/types';

// ============================================================
// Scene Store — Scene Items, Analysis, Scraping, and Templates
// ============================================================

interface SceneState {
    // Scene Items
    sceneItems: SceneItem[];
    analysisResult: AnalysisResult | null;

    // Scraping
    scrapedPost: ScrapedPost | null;
    postList: ScrapedPost[];
    nextPageUrl: string | null;

    // Filter
    filterStartDate: string;
    filterEndDate: string;
    filterTitle: string;
    filterHideExisting: boolean;

    // Rendering
    videoBlobUrl: string | null;
    showRenderer: boolean;
    isRendering: boolean;
    totalDuration: number;

    // Templates
    savedTemplates: { id: string; name: string; scenes: SceneItem[] }[];
    showTemplateMenu: boolean;
    templateLoadDialog: { idx: number } | null;
    isTemplateSaving: boolean;

    // Bulk Upload
    bulkUploadDialog: { files: File[] } | null;

    // Drag & Drop
    dragIdx: number | null;
    dropIdx: number | null;

    // Scene Actions
    setSceneItems: (items: SceneItem[] | ((prev: SceneItem[]) => SceneItem[])) => void;
    updateScene: (idx: number, partial: Partial<SceneItem>) => void;
    addScene: (scene: SceneItem) => void;
    deleteScene: (idx: number) => void;
    duplicateScene: (idx: number) => void;
    moveScene: (idx: number, direction: -1 | 1) => void;
    set: (partial: Partial<SceneState>) => void;
}

export const useSceneStore = create<SceneState>((set, get) => ({
    // Scene Items
    sceneItems: [],
    analysisResult: null,

    // Scraping
    scrapedPost: null,
    postList: [],
    nextPageUrl: null,

    // Filter
    filterStartDate: "",
    filterEndDate: "",
    filterTitle: "",
    filterHideExisting: false,

    // Rendering
    videoBlobUrl: null,
    showRenderer: false,
    isRendering: false,
    totalDuration: 0,

    // Templates
    savedTemplates: [],
    showTemplateMenu: false,
    templateLoadDialog: null,
    isTemplateSaving: false,

    // Bulk Upload
    bulkUploadDialog: null,

    // Drag & Drop
    dragIdx: null,
    dropIdx: null,

    // Scene Actions
    setSceneItems: (itemsOrUpdater) => set((state) => ({
        sceneItems: typeof itemsOrUpdater === 'function'
            ? itemsOrUpdater(state.sceneItems)
            : itemsOrUpdater
    })),

    updateScene: (idx, partial) => set((state) => ({
        sceneItems: state.sceneItems.map((s, i) => i === idx ? { ...s, ...partial } : s)
    })),

    addScene: (scene) => set((state) => ({
        sceneItems: [...state.sceneItems, scene]
    })),

    deleteScene: (idx) => set((state) => ({
        sceneItems: state.sceneItems.filter((_, i) => i !== idx)
    })),

    duplicateScene: (idx) => set((state) => {
        const items = [...state.sceneItems];
        const dup = {
            ...items[idx],
            status: 'pending' as const,
            audioUrl: null,
            audioDuration: undefined,
        };
        items.splice(idx + 1, 0, dup);
        return { sceneItems: items };
    }),

    moveScene: (idx, direction) => set((state) => {
        const items = [...state.sceneItems];
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= items.length) return state;
        [items[idx], items[newIdx]] = [items[newIdx], items[idx]];
        return { sceneItems: items };
    }),

    set: (partial) => set(partial),
}));
