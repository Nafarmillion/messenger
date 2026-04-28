'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n-provider';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

interface AvatarCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (croppedImage: string) => void;
  imageSrc: string | null;
}

export function AvatarCropModal({ isOpen, onClose, onSave, imageSrc }: AvatarCropModalProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  const CROP_SIZE = 200;

  const resetState = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setImageLoaded(false);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
  }, [isOpen, resetState]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    // Center the image initially
    if (imageRef.current && containerRef.current) {
      const img = imageRef.current;
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      // Scale to fit crop size
      const scale = Math.max(CROP_SIZE / imgWidth, CROP_SIZE / imgHeight);
      setZoom(scale);

      // Center position
      const xPos = (containerWidth - imgWidth * scale) / 2;
      const yPos = (containerHeight - imgHeight * scale) / 2;
      setPosition({ x: xPos, y: yPos });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.1, 5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.1, 0.1));
  };

  const handleSave = () => {
    if (!canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    const container = containerRef.current;
    if (!container) return;

    // Calculate the position of the image relative to the crop area
    const containerRect = container.getBoundingClientRect();
    const cropCenterX = containerRect.width / 2;
    const cropCenterY = containerRect.height / 2;

    // Calculate where the top-left of the crop area is relative to the image
    const imgX = (cropCenterX - CROP_SIZE / 2 - position.x) / zoom;
    const imgY = (cropCenterY - CROP_SIZE / 2 - position.y) / zoom;

    canvas.width = CROP_SIZE;
    canvas.height = CROP_SIZE;

    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
    ctx.drawImage(
      img,
      imgX,
      imgY,
      CROP_SIZE / zoom,
      CROP_SIZE / zoom,
      0,
      0,
      CROP_SIZE,
      CROP_SIZE
    );

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onSave(dataUrl);
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-lg">{t('profile.cropAvatarTitle')}</h3>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg">
            <Icons.X />
          </button>
        </div>

        {/* Crop Area */}
        <div
          ref={containerRef}
          className="relative w-full h-80 bg-black overflow-hidden cursor-move select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Avatar to crop"
            onLoad={handleImageLoad}
            className="absolute"
            style={{
              left: position.x,
              top: position.y,
              width: imageLoaded ? `${imageRef.current?.naturalWidth! * zoom}px` : 'auto',
              height: imageLoaded ? `${imageRef.current?.naturalHeight! * zoom}px` : 'auto',
              maxWidth: 'none',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
            draggable={false}
          />

          {/* Crop overlay - dark areas outside crop */}
          <div
            className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
            style={{
              width: CROP_SIZE,
              height: CROP_SIZE,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
            }}
          />
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center justify-center gap-4 p-4 border-b border-border">
          <Button variant="outline" size="icon" onClick={handleZoomOut}>
            <span className="text-lg font-bold">−</span>
          </Button>
          <span className="text-sm text-muted-foreground min-w-[80px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="outline" size="icon" onClick={handleZoomIn}>
            <span className="text-lg font-bold">+</span>
          </Button>
        </div>

        {/* Footer */}
        <div className="p-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave}>
            {t('profile.saveAvatar')}
          </Button>
        </div>
      </div>

      {/* Hidden canvas for cropping */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
