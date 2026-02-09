"use client";
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Check, Image as ImageIcon, Move } from 'lucide-react';

interface ImageCropModalProps {
    imageUrl: string;
    targetWidth: number;
    targetHeight: number;
    onConfirm: (croppedDataUrl: string) => void;
    onUseOriginal: () => void;
    onClose: () => void;
}

export default function ImageCropModal({
    imageUrl,
    targetWidth,
    targetHeight,
    onConfirm,
    onUseOriginal,
    onClose,
}: ImageCropModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);

    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgNaturalW, setImgNaturalW] = useState(0);
    const [imgNaturalH, setImgNaturalH] = useState(0);

    // Crop region in image-space coordinates
    const [cropX, setCropX] = useState(0);
    const [cropY, setCropY] = useState(0);
    const [cropW, setCropW] = useState(0);
    const [cropH, setCropH] = useState(0);

    // Drag state
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, cropX: 0, cropY: 0 });

    const targetAspect = targetWidth / targetHeight;

    // Load image
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            imgRef.current = img;
            setImgNaturalW(img.naturalWidth);
            setImgNaturalH(img.naturalHeight);

            // Initialize crop region: largest rect with target aspect ratio centered in image
            const imgAspect = img.naturalWidth / img.naturalHeight;
            let cw: number, ch: number;
            if (imgAspect > targetAspect) {
                // Image is wider → constrain by height
                ch = img.naturalHeight;
                cw = ch * targetAspect;
            } else {
                // Image is taller → constrain by width
                cw = img.naturalWidth;
                ch = cw / targetAspect;
            }
            setCropW(Math.round(cw));
            setCropH(Math.round(ch));
            setCropX(Math.round((img.naturalWidth - cw) / 2));
            setCropY(Math.round((img.naturalHeight - ch) / 2));
            setImgLoaded(true);
        };
        img.src = imageUrl;
    }, [imageUrl, targetAspect]);

    // Display scale factor (fit image into ~500px preview)
    const getDisplayScale = useCallback(() => {
        if (!imgNaturalW || !imgNaturalH) return 1;
        const maxW = 600;
        const maxH = 450;
        return Math.min(maxW / imgNaturalW, maxH / imgNaturalH, 1);
    }, [imgNaturalW, imgNaturalH]);

    // Draw canvas
    useEffect(() => {
        if (!imgLoaded || !canvasRef.current || !imgRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const scale = getDisplayScale();
        const cw = Math.round(imgNaturalW * scale);
        const ch = Math.round(imgNaturalH * scale);
        canvasRef.current.width = cw;
        canvasRef.current.height = ch;

        // Draw image
        ctx.drawImage(imgRef.current, 0, 0, cw, ch);

        // Dark overlay outside crop
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, cw, ch);

        // Draw bright crop region
        const sx = cropX * scale;
        const sy = cropY * scale;
        const sw = cropW * scale;
        const sh = cropH * scale;

        ctx.drawImage(
            imgRef.current,
            cropX, cropY, cropW, cropH,
            sx, sy, sw, sh
        );

        // Crop border
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.strokeRect(sx, sy, sw, sh);

        // Corner handles
        const handleSize = 8;
        ctx.fillStyle = '#a855f7';
        const corners = [
            [sx, sy], [sx + sw, sy],
            [sx, sy + sh], [sx + sw, sy + sh]
        ];
        corners.forEach(([cx, cy]) => {
            ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
        });

        // Grid lines (rule of thirds)
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(sx + (sw * i) / 3, sy);
            ctx.lineTo(sx + (sw * i) / 3, sy + sh);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(sx, sy + (sh * i) / 3);
            ctx.lineTo(sx + sw, sy + (sh * i) / 3);
            ctx.stroke();
        }
    }, [imgLoaded, imgNaturalW, imgNaturalH, cropX, cropY, cropW, cropH, getDisplayScale]);

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const scale = getDisplayScale();
        const rect = canvasRef.current!.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / scale;
        const my = (e.clientY - rect.top) / scale;

        // Check if inside crop region
        if (mx >= cropX && mx <= cropX + cropW && my >= cropY && my <= cropY + cropH) {
            setIsDragging(true);
            dragStart.current = { x: mx, y: my, cropX, cropY };
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDragging) return;
        const scale = getDisplayScale();
        const rect = canvasRef.current!.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / scale;
        const my = (e.clientY - rect.top) / scale;

        let newX = dragStart.current.cropX + (mx - dragStart.current.x);
        let newY = dragStart.current.cropY + (my - dragStart.current.y);

        // Clamp
        newX = Math.max(0, Math.min(newX, imgNaturalW - cropW));
        newY = Math.max(0, Math.min(newY, imgNaturalH - cropH));

        setCropX(Math.round(newX));
        setCropY(Math.round(newY));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Scroll to resize crop (maintain aspect ratio)
    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        const newW = Math.max(100, Math.min(imgNaturalW, cropW * (1 + delta)));
        const newH = newW / targetAspect;

        if (newH > imgNaturalH || newW > imgNaturalW) return;

        // Keep centered
        const cx = cropX + cropW / 2;
        const cy = cropY + cropH / 2;
        let nx = cx - newW / 2;
        let ny = cy - newH / 2;

        nx = Math.max(0, Math.min(nx, imgNaturalW - newW));
        ny = Math.max(0, Math.min(ny, imgNaturalH - newH));

        setCropX(Math.round(nx));
        setCropY(Math.round(ny));
        setCropW(Math.round(newW));
        setCropH(Math.round(newH));
    };

    const handleApplyCrop = () => {
        if (!imgRef.current) return;

        // Create offscreen canvas at target resolution
        const offCanvas = document.createElement('canvas');
        offCanvas.width = targetWidth;
        offCanvas.height = targetHeight;
        const ctx = offCanvas.getContext('2d')!;
        ctx.drawImage(
            imgRef.current,
            cropX, cropY, cropW, cropH,
            0, 0, targetWidth, targetHeight
        );
        const dataUrl = offCanvas.toDataURL('image/jpeg', 0.92);
        onConfirm(dataUrl);
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl max-w-[700px] w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <ImageIcon className="w-5 h-5 text-purple-400" /> 이미지 자르기
                        </h3>
                        <p className="text-xs text-gray-400 mt-0.5">
                            타겟: {targetWidth}×{targetHeight} ({targetAspect.toFixed(2)}:1)
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Canvas Area */}
                <div className="p-4 flex flex-col items-center">
                    {!imgLoaded ? (
                        <div className="w-full h-64 flex items-center justify-center text-gray-500">
                            Loading image...
                        </div>
                    ) : (
                        <>
                            <div className="text-[10px] text-gray-500 mb-2 flex items-center gap-1">
                                <Move className="w-3 h-3" /> 드래그하여 이동 · 스크롤하여 크기 조절
                            </div>
                            <canvas
                                ref={canvasRef}
                                className="rounded-lg cursor-move border border-white/10"
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                onMouseLeave={handleMouseUp}
                                onWheel={handleWheel}
                            />
                            <div className="mt-2 text-xs text-gray-500 font-mono">
                                Crop: {cropW}×{cropH} @ ({cropX}, {cropY})
                            </div>
                        </>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 p-4 border-t border-white/10">
                    <button
                        onClick={onUseOriginal}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-bold text-gray-300 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                        <ImageIcon className="w-4 h-4" /> 원본 사용
                    </button>
                    <button
                        onClick={handleApplyCrop}
                        disabled={!imgLoaded}
                        className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-900/30 disabled:opacity-50"
                    >
                        <Check className="w-4 h-4" /> 자르기 적용
                    </button>
                </div>
            </div>
        </div>
    );
}
