"use client";
import { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, RefreshCw, Trash2, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

interface SNSManagerModalProps {
    onClose: () => void;
}

export default function SNSManagerModal({ onClose }: SNSManagerModalProps) {
    const [status, setStatus] = useState<{ connected: boolean, channelName?: string, channelIcon?: string } | null>(null);
    const [loading, setLoading] = useState(true);

    const checkStatus = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/youtube/status');
            const data = await res.json();
            setStatus(data);
        } catch (e) {
            console.error("Status check failed", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();

        // Listen for message from popup
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'youtube-connected') {
                checkStatus();
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const handleConnect = () => {
        const width = 600;
        const height = 700;
        const left = (window.innerWidth - width) / 2;
        const top = (window.innerHeight - height) / 2;

        window.open(
            '/api/auth/youtube/login',
            'YouTube Connect',
            `width=${width},height=${height},top=${top},left=${left}`
        );
    };

    const handleDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect? This will remove the saved tokens.")) return;

        setLoading(true);
        try {
            await fetch('/api/auth/disconnect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ platform: 'YouTube' })
            });
            setStatus({ connected: false });
        } catch (e) {
            alert("Disconnect failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#1a1a1a] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                        Manage Integrations
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* YouTube Section */}
                    <div className="bg-white/5 border border-white/5 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-lg">
                                    YT
                                </div>
                                <div>
                                    <h4 className="font-bold text-white">YouTube</h4>
                                    <p className="text-xs text-gray-400">Upload directly to your channel</p>
                                </div>
                            </div>
                            {loading ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
                            ) : status?.connected ? (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                                    <CheckCircle className="w-3 h-3" /> CONNECTED
                                </span>
                            ) : (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-500/10 px-2 py-1 rounded-full">
                                    Not Connected
                                </span>
                            )}
                        </div>

                        {status?.connected ? (
                            <div className="space-y-3">
                                <div className="bg-black/40 rounded-lg p-3 flex items-center gap-3 border border-white/5">
                                    {status.channelIcon && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={status.channelIcon} alt="Channel" className="w-8 h-8 rounded-full" />
                                    )}
                                    <div className="overflow-hidden">
                                        <div className="text-xs text-gray-500">Connected Channel</div>
                                        <div className="font-bold text-sm text-white truncate">{status.channelName}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={handleDisconnect}
                                    className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg transition-colors border border-red-500/20 flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-3 h-3" /> Disconnect Account
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={handleConnect}
                                className="w-full py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-red-900/20 flex items-center justify-center gap-2"
                            >
                                <ExternalLink className="w-3 h-3" /> Connect YouTube Account
                            </button>
                        )}
                    </div>


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
