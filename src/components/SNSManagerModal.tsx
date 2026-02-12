"use client";
import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

interface SNSManagerModalProps {
    onClose: () => void;
}

interface PlatformConfig {
    id: string;
    name: string;
    icon: string;
    color: string;
    gradient: string;
    loginUrl: string;
    statusUrl: string;
    messageType: string;
    description: string;
    envKeys: string[];
}

const PLATFORMS: PlatformConfig[] = [
    {
        id: 'youtube',
        name: 'YouTube',
        icon: 'YT',
        color: 'bg-red-600',
        gradient: 'from-red-600 to-red-700',
        loginUrl: '/api/auth/youtube/login',
        statusUrl: '/api/auth/youtube/status',
        messageType: 'youtube-connected',
        description: 'Upload directly to your channel',
        envKeys: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET']
    },
    {
        id: 'instagram',
        name: 'Instagram',
        icon: 'IG',
        color: 'bg-gradient-to-br from-pink-500 to-purple-600',
        gradient: 'from-pink-500 to-purple-600',
        loginUrl: '/api/auth/instagram/login',
        statusUrl: '/api/auth/instagram/status',
        messageType: 'instagram-connected',
        description: 'Post Reels to your Business account',
        envKeys: ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET']
    },
    {
        id: 'tiktok',
        name: 'TikTok',
        icon: 'TT',
        color: 'bg-black',
        gradient: 'from-[#00f2ea] to-[#ff0050]',
        loginUrl: '/api/auth/tiktok/login',
        statusUrl: '/api/auth/tiktok/status',
        messageType: 'tiktok-connected',
        description: 'Publish videos to your TikTok',
        envKeys: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET']
    }
];

interface PlatformStatus {
    connected: boolean;
    displayName?: string;
    channelName?: string;
    channelIcon?: string;
    username?: string;
    avatarUrl?: string;
    error?: string;
}

export default function SNSManagerModal({ onClose }: SNSManagerModalProps) {
    const [statuses, setStatuses] = useState<Record<string, PlatformStatus>>({});
    const [loading, setLoading] = useState<Record<string, boolean>>({});

    const checkStatus = async (platform: PlatformConfig) => {
        setLoading(prev => ({ ...prev, [platform.id]: true }));
        try {
            const res = await fetch(platform.statusUrl);
            const data = await res.json();
            setStatuses(prev => ({ ...prev, [platform.id]: data }));
        } catch (e) {
            console.error(`Status check failed for ${platform.name}:`, e);
            setStatuses(prev => ({ ...prev, [platform.id]: { connected: false, error: 'Check failed' } }));
        } finally {
            setLoading(prev => ({ ...prev, [platform.id]: false }));
        }
    };

    useEffect(() => {
        PLATFORMS.forEach(p => checkStatus(p));

        const handleMessage = (event: MessageEvent) => {
            const platform = PLATFORMS.find(p => p.messageType === event.data?.type);
            if (platform) {
                checkStatus(platform);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleConnect = (platform: PlatformConfig) => {
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;
        window.open(platform.loginUrl, `${platform.name} Connect`, `width=${width},height=${height},top=${top},left=${left}`);
    };

    const handleDisconnect = async (platform: PlatformConfig) => {
        if (!confirm(`Are you sure you want to disconnect ${platform.name}?`)) return;

        setLoading(prev => ({ ...prev, [platform.id]: true }));
        try {
            await fetch('/api/auth/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform: platform.name })
            });
            setStatuses(prev => ({ ...prev, [platform.id]: { connected: false } }));
        } catch (e) {
            alert(`Disconnect failed for ${platform.name}`);
        } finally {
            setLoading(prev => ({ ...prev, [platform.id]: false }));
        }
    };

    const getDisplayName = (platform: PlatformConfig, status: PlatformStatus) => {
        if (platform.id === 'youtube') return status.channelName;
        if (platform.id === 'instagram') return status.username ? `@${status.username}` : undefined;
        if (platform.id === 'tiktok') return status.displayName;
        return undefined;
    };

    const getIcon = (platform: PlatformConfig, status: PlatformStatus) => {
        if (platform.id === 'youtube') return status.channelIcon;
        if (platform.id === 'tiktok') return status.avatarUrl;
        return undefined;
    };

    return (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#1a1a1a] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        🔗 Manage Integrations
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {PLATFORMS.map(platform => {
                        const status = statuses[platform.id];
                        const isLoading = loading[platform.id];
                        const connected = status?.connected;
                        const name = status ? getDisplayName(platform, status) : undefined;
                        const icon = status ? getIcon(platform, status) : undefined;

                        return (
                            <div key={platform.id} className="bg-white/5 border border-white/5 rounded-xl p-4 transition-all hover:border-white/10">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg",
                                            platform.id === 'instagram' ? 'bg-gradient-to-br from-pink-500 to-purple-600' :
                                                platform.id === 'tiktok' ? 'bg-black border border-white/20' :
                                                    platform.color
                                        )}>
                                            {platform.id === 'tiktok' ? (
                                                <span className="bg-gradient-to-r from-[#00f2ea] to-[#ff0050] bg-clip-text text-transparent font-black">{platform.icon}</span>
                                            ) : platform.icon}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-white">{platform.name}</h4>
                                            <p className="text-xs text-gray-400">{platform.description}</p>
                                        </div>
                                    </div>
                                    {isLoading ? (
                                        <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
                                    ) : connected ? (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                                            <CheckCircle className="w-3 h-3" /> CONNECTED
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-500/10 px-2 py-1 rounded-full">
                                            Not Connected
                                        </span>
                                    )}
                                </div>

                                {connected ? (
                                    <div className="space-y-3">
                                        {name && (
                                            <div className="bg-black/40 rounded-lg p-3 flex items-center gap-3 border border-white/5">
                                                {icon && (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={icon} alt={platform.name} className="w-8 h-8 rounded-full" />
                                                )}
                                                <div className="overflow-hidden">
                                                    <div className="text-xs text-gray-500">Connected Account</div>
                                                    <div className="font-bold text-sm text-white truncate">{name}</div>
                                                </div>
                                            </div>
                                        )}
                                        <button
                                            onClick={() => handleDisconnect(platform)}
                                            className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg transition-colors border border-red-500/20 flex items-center justify-center gap-2"
                                        >
                                            <Trash2 className="w-3 h-3" /> Disconnect
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => handleConnect(platform)}
                                        className={clsx(
                                            "w-full py-2 text-white text-xs font-bold rounded-lg transition-all shadow-lg flex items-center justify-center gap-2",
                                            platform.id === 'youtube' ? "bg-red-600 hover:bg-red-500 shadow-red-900/20" :
                                                platform.id === 'instagram' ? "bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 shadow-purple-900/20" :
                                                    "bg-gradient-to-r from-[#00f2ea] to-[#ff0050] hover:opacity-90 shadow-black/20"
                                        )}
                                    >
                                        <ExternalLink className="w-3 h-3" /> Connect {platform.name}
                                    </button>
                                )}

                                {status?.error && (
                                    <div className="mt-2 flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 px-3 py-2 rounded-lg">
                                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                        {status.error}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-white/10 bg-black/20 text-center">
                    <p className="text-[10px] text-gray-500">
                        Tokens are securely synced via Airtable.
                    </p>
                </div>
            </div>
        </div>
    );
}
