import { create } from 'zustand';
import type { ProjectHistoryItem } from '@/types';

// ============================================================
// Project Store — Project Management, Gallery, History, Sites
// ============================================================

interface ProjectState {
    // Current Project
    currentProjectId: string | null;
    projectTitle: string;
    isSaving: boolean;

    // Project List (Load modal)
    savedProjects: { id: string; name: string }[];
    showProjectList: boolean;
    expandedProjectName: string | null;

    // Project History
    projectHistory: ProjectHistoryItem[];
    historyProjectId: string | null;

    // Gallery (Server)
    serverVideos: any[];
    showServerGallery: boolean;
    selectedProject: any | null;
    expandedProjectTitle: string | null;
    editingProjectId: string | null;
    editTitleValue: string;

    // Site Management
    sites: { id?: string; name: string; url: string }[];
    isSiteModalOpen: boolean;
    isAddingSite: boolean;
    newSiteName: string;
    newSiteUrl: string;
    editingSiteId: string | null;
    editSiteName: string;
    editSiteUrl: string;

    // URL & Input
    url: string;
    date: string;

    // UI State
    showSaveOptions: boolean;
    showSNSModal: boolean;
    showSNSManager: boolean;
    saveMemo: string;

    // Processing
    isProcessing: boolean;
    logs: { type: 'text' | 'image' | 'prompt'; content: string }[];
    error: string;

    // Actions
    set: (partial: Partial<ProjectState>) => void;
    addLog: (type: 'text' | 'image' | 'prompt', content: string) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
    // Current Project
    currentProjectId: null,
    projectTitle: "",
    isSaving: false,

    // Project List
    savedProjects: [],
    showProjectList: false,
    expandedProjectName: null,

    // Project History
    projectHistory: [],
    historyProjectId: null,

    // Gallery
    serverVideos: [],
    showServerGallery: false,
    selectedProject: null,
    expandedProjectTitle: null,
    editingProjectId: null,
    editTitleValue: "",

    // Site Management
    sites: [],
    isSiteModalOpen: false,
    isAddingSite: false,
    newSiteName: "",
    newSiteUrl: "",
    editingSiteId: null,
    editSiteName: "",
    editSiteUrl: "",

    // URL & Input
    url: "https://www.seocho.go.kr/site/seocho/ex/bbs/List.do?cbIdx=57",
    date: "",

    // UI State
    showSaveOptions: false,
    showSNSModal: false,
    showSNSManager: false,
    saveMemo: "",

    // Processing
    isProcessing: false,
    logs: [],
    error: "",

    // Actions
    set: (partial) => set(partial),
    addLog: (type, content) => set((state) => ({
        logs: [...state.logs, { type, content }]
    })),
}));
