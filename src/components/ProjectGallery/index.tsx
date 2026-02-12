"use client";
import React, { useState } from 'react';
import {
    Play, X, Film, FileVideo, VideoIcon, Calendar, Clock,
    FileText, Image as ImageIcon, Music, Pencil, Trash2,
    Upload, RotateCcw, CheckCircle, ChevronRight
} from 'lucide-react';

// ============================================================
// ProjectGallery — Server Project Gallery + Video Player Modals
// ============================================================

interface ProjectGalleryProps {
    // Gallery state
    showServerGallery: boolean;
    setShowServerGallery: (v: boolean) => void;
    serverVideos: any[];
    expandedProjectTitle: string | null;
    setExpandedProjectTitle: (v: string | null) => void;

    // Selected project player
    selectedProject: any | null;
    setSelectedProject: (v: any | null) => void;

    // Editing
    editingProjectId: string | null;
    setEditingProjectId: (v: string | null) => void;
    editTitleValue: string;
    setEditTitleValue: (v: string) => void;

    // Handlers
    handleUpdateProjectTitle: (id: string, title: string) => void;
    handleDeleteProject: (id: string, e: React.MouseEvent) => void;

    // Actions from player modal
    setShowSNSModal: (v: boolean) => void;
    setPreviewImage: (v: string | null) => void;

    // Load for editing
    onLoadForEditing: (project: any) => void;
}

export default function ProjectGallery({
    showServerGallery, setShowServerGallery,
    serverVideos,
    expandedProjectTitle, setExpandedProjectTitle,
    selectedProject, setSelectedProject,
    editingProjectId, setEditingProjectId,
    editTitleValue, setEditTitleValue,
    handleUpdateProjectTitle, handleDeleteProject,
    setShowSNSModal, setPreviewImage,
    onLoadForEditing,
}: ProjectGalleryProps) {
    if (!showServerGallery && !selectedProject) return null;

    return (
        <>
            {/* Server Project Gallery Modal */}
            {showServerGallery && (
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

                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                                        {(() => {
                                            // Grouping Logic
                                            const grouped = serverVideos.reduce((acc, curr) => {
                                                let key = curr.groupTitle;
                                                if (!key && curr.title) {
                                                    key = curr.title.replace(/ - \d+$/, "").trim();
                                                }
                                                key = key || "Untitled Project";
                                                if (!acc[key]) acc[key] = [];
                                                acc[key].push(curr);
                                                return acc;
                                            }, {} as Record<string, any[]>);

                                            if (expandedProjectTitle) {
                                                const videos = grouped[expandedProjectTitle] || [];
                                                return videos.map((proj: any) => (
                                                    <VideoCard
                                                        key={proj.id}
                                                        proj={proj}
                                                        editingProjectId={editingProjectId}
                                                        editTitleValue={editTitleValue}
                                                        setEditTitleValue={setEditTitleValue}
                                                        setEditingProjectId={setEditingProjectId}
                                                        setSelectedProject={setSelectedProject}
                                                        handleUpdateProjectTitle={handleUpdateProjectTitle}
                                                        handleDeleteProject={handleDeleteProject}
                                                        setShowSNSModal={setShowSNSModal}
                                                    />
                                                ));
                                            } else {
                                                // Folder View (Grouped)
                                                return Object.entries(grouped).map(([title, items]) => {
                                                    const itemList = items as any[];
                                                    return (
                                                        <FolderCard
                                                            key={title}
                                                            title={title}
                                                            items={itemList}
                                                            onClick={() => setExpandedProjectTitle(title)}
                                                        />
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
                            <p className="text-xs text-gray-600">Videos are stored locally in the &apos;public/projects&apos; directory.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Gallery Video Player Modal */}
            {selectedProject && (
                <VideoPlayerModal
                    project={selectedProject}
                    onClose={() => setSelectedProject(null)}
                    setShowSNSModal={setShowSNSModal}
                    setPreviewImage={setPreviewImage}
                    onLoadForEditing={onLoadForEditing}
                />
            )}
        </>
    );
}

// ============================================================
// Sub-components
// ============================================================

function VideoCard({
    proj, editingProjectId, editTitleValue, setEditTitleValue,
    setEditingProjectId, setSelectedProject,
    handleUpdateProjectTitle, handleDeleteProject, setShowSNSModal,
}: {
    proj: any;
    editingProjectId: string | null;
    editTitleValue: string;
    setEditTitleValue: (v: string) => void;
    setEditingProjectId: (v: string | null) => void;
    setSelectedProject: (v: any) => void;
    handleUpdateProjectTitle: (id: string, title: string) => void;
    handleDeleteProject: (id: string, e: React.MouseEvent) => void;
    setShowSNSModal: (v: boolean) => void;
}) {
    return (
        <div className="group bg-white/5 border border-white/5 rounded-2xl overflow-hidden hover:border-pink-500/50 hover:shadow-2xl hover:shadow-pink-900/20 transition-all duration-300 flex flex-col">
            {/* Video Preview */}
            <div
                className="bg-black relative cursor-pointer overflow-hidden"
                onClick={async () => {
                    setSelectedProject(proj);
                    // Fetch full project data (scenes, uploads) from Projects table if linked
                    if (proj.projectId) {
                        try {
                            const res = await fetch(`/api/projects?id=${proj.projectId}`);
                            if (res.ok) {
                                const fullData = await res.json();
                                // Merge: keep gallery data (correct videoPath, thumbnails) + add API data (scenes, uploads, usage)
                                setSelectedProject((prev: any) => ({
                                    ...prev,
                                    scenes: fullData.scenes || prev?.scenes,
                                    uploads: fullData.uploads || prev?.uploads,
                                }));
                            }
                        } catch (e) {
                            console.error('Failed to fetch full project details:', e);
                        }
                    }
                }}
            >
                {proj.videoPath ? (
                    <video
                        src={proj.videoPath}
                        className="w-full h-auto block"
                        controls={false}
                        muted
                        poster={proj.thumbnailPath || undefined}
                    />
                ) : proj.thumbnailPath ? (
                    <img
                        src={proj.thumbnailPath}
                        className="w-full h-auto block"
                        alt={proj.title}
                    />
                ) : (
                    <div className="w-full aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                        <Film className="w-10 h-10 text-gray-600" />
                    </div>
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
                            setSelectedProject(proj);
                            setShowSNSModal(true);
                        }}
                        className="px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors border border-red-600/20 flex items-center justify-center"
                        title="Upload to SNS"
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
    );
}

function FolderCard({ title, items, onClick }: { title: string; items: any[]; onClick: () => void }) {
    return (
        <div
            onClick={onClick}
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
                    <p className="text-sm text-gray-500">{items.length} Video{items.length !== 1 && 's'}</p>
                </div>
            </div>

            <div className="mt-auto space-y-3">
                <div className="flex justify-between items-end">
                    <div className="flex -space-x-2 overflow-hidden">
                        {items.slice(0, 4).map((item, i) => (
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
                        {items.length > 4 && (
                            <div className="w-10 h-10 rounded-full border-2 border-[#1a1a1a] bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 shadow-lg">
                                +{items.length - 4}
                            </div>
                        )}
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">Total Stats</div>
                        <div className="text-xs text-green-400 font-mono font-bold">
                            ₩{Math.round(items.reduce((sum, it) => sum + (it.usage?.totalCost || 0), 0)).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-gray-400">
                            {Math.round(items.reduce((sum, it) => sum + (it.duration || 0), 0))}s total
                        </div>
                    </div>
                </div>
                <div className="text-[10px] text-gray-600 border-t border-white/5 pt-2 flex justify-between items-center">
                    <span>Active Project</span>
                    <span>Last: {new Date(Math.max(...items.map(i => new Date(i.createdAt || 0).getTime()))).toLocaleDateString()}</span>
                </div>
            </div>
        </div>
    );
}

function VideoPlayerModal({
    project, onClose, setShowSNSModal, setPreviewImage, onLoadForEditing,
}: {
    project: any;
    onClose: () => void;
    setShowSNSModal: (v: boolean) => void;
    setPreviewImage: (v: string | null) => void;
    onLoadForEditing: (project: any) => void;
}) {
    return (
        <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300">
            <div className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-7xl h-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]">

                {/* Video Area */}
                <div className="flex-[2] bg-black relative flex items-center justify-center group/player">
                    <video
                        src={project.videoPath}
                        className="w-full h-full object-contain"
                        controls
                        autoPlay
                    />
                    <button
                        onClick={onClose}
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
                                <h3 className="text-3xl font-bold text-white leading-tight">{project.title}</h3>
                                <p className="text-sm text-gray-500 mt-2 font-mono flex items-center gap-2">
                                    <Clock className="w-4 h-4" /> {new Date(project.createdAt).toLocaleString()}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors hidden md:block"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Duration</p>
                                <p className="text-xl font-bold text-white">{Math.round(project.duration || 0)}s</p>
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Format</p>
                                <p className="text-xl font-bold text-white uppercase">{project.videoPath?.split('.').pop() || 'WEBM'}</p>
                            </div>
                        </div>

                        {project.usage && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Cost Breakdown</h4>
                                    <div className="flex-1 h-px bg-white/5"></div>
                                </div>
                                <div className="space-y-3 bg-black/20 p-5 rounded-2xl border border-white/5">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400 flex items-center gap-2"><FileText className="w-4 h-4" /> Script / AI</span>
                                        <span className="text-white font-mono font-bold">₩{Math.round(project.usage.scriptCost || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400 flex items-center gap-2"><ImageIcon className="w-4 h-4" /> Visual Assets</span>
                                        <span className="text-white font-mono font-bold">₩{Math.round(project.usage.imageCost || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-400 flex items-center gap-2"><Music className="w-4 h-4" /> Audio Narration</span>
                                        <span className="text-white font-mono font-bold">₩{Math.round(project.usage.audioCost || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="pt-3 mt-3 border-t border-white/10 flex justify-between items-center">
                                        <span className="text-pink-400 font-bold">TOTAL COST</span>
                                        <span className="text-2xl font-bold text-green-400 font-mono">
                                            ₩{Math.round(project.usage.totalCost || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Storage Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Storage Info</h4>
                                <div className="flex-1 h-px bg-white/5"></div>
                            </div>
                            <div className="text-[10px] text-gray-600 break-all font-mono bg-black/40 p-3 rounded-lg border border-white/5">
                                Path: {project.videoPath}
                            </div>
                        </div>

                        {/* Original Assets */}
                        {project.scenes && project.scenes.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Original Assets</h4>
                                    <div className="flex-1 h-px bg-white/5"></div>
                                </div>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                    {project.scenes.map((scene: any, idx: number) => {
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
                                href={project.videoPath}
                                download={`${project.title || "video"}.webm`}
                                className="py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-center font-bold text-sm transition-all flex items-center justify-center gap-2 border border-white/5"
                            >
                                <VideoIcon className="w-4 h-4" /> Download Video
                            </a>
                            <button
                                onClick={() => setShowSNSModal(true)}
                                className="py-3 bg-gradient-to-r from-red-600/80 to-cyan-500/80 hover:from-red-600 hover:to-cyan-500 text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 border border-white/5 shadow-lg shadow-red-900/20"
                            >
                                <Upload className="w-4 h-4" /> Upload to SNS
                            </button>
                            <button
                                onClick={() => onLoadForEditing(project)}
                                className="py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-900/20 transition-all flex items-center justify-center gap-2"
                            >
                                <Pencil className="w-4 h-4" /> Re-edit
                            </button>
                        </div>

                        {/* Upload History */}
                        {project.uploads && project.uploads.length > 0 && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">SNS Upload History</h4>
                                    <div className="flex-1 h-px bg-white/5"></div>
                                </div>
                                <div className="bg-white/5 rounded-xl overflow-hidden border border-white/5 divide-y divide-white/5 max-h-60 overflow-y-auto custom-scrollbar">
                                    {project.uploads.map((upload: any, idx: number) => {
                                        const platform = (upload.platform || 'youtube').toLowerCase();
                                        const platformConfig: Record<string, { color: string; bg: string; label: string; getUrl: (u: any) => string }> = {
                                            youtube: { color: 'text-red-500', bg: 'bg-red-600/20', label: 'YouTube', getUrl: (u) => `https://youtu.be/${u.videoId}` },
                                            instagram: { color: 'text-pink-500', bg: 'bg-pink-600/20', label: 'Instagram', getUrl: (u) => u.url || '#' },
                                            tiktok: { color: 'text-cyan-400', bg: 'bg-cyan-600/20', label: 'TikTok', getUrl: (u) => u.url || '#' },
                                        };
                                        const config = platformConfig[platform] || platformConfig.youtube;
                                        return (
                                            <div key={idx} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full ${config.bg} flex items-center justify-center ${config.color}`}>
                                                        <Upload className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-white">Uploaded to {config.label}</div>
                                                        <div className="text-xs text-gray-500 flex items-center gap-2">
                                                            <span>{new Date(upload.timestamp).toLocaleString()}</span>
                                                            {upload.channelId && <span className="px-1.5 py-0.5 rounded bg-white/10 text-gray-400">{upload.channelId}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <a
                                                    href={config.getUrl(upload)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-white transition-colors flex items-center gap-2"
                                                >
                                                    Watch <ChevronRight className="w-3 h-3" />
                                                </a>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
