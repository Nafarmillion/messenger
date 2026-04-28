'use client';

import React, { useEffect } from 'react';
import { Message } from '@/lib/api-client';
import { Icons } from '@/components/icons';
import { useTranslation } from '@/lib/i18n-provider';

interface MessageContextMenuProps {
  message: Message;
  isOpen: boolean;
  position: { x: number; y: number };
  isOwn: boolean;
  onClose: () => void;
  onCopy: (content: string) => void;
  onReply: (message: Message) => void;
  onDelete: (messageId: string) => void;
  onPin: (message: Message) => void;
  onForward: (message: Message) => void;
}

export function MessageContextMenu({
  message,
  isOpen,
  position,
  isOwn,
  onClose,
  onCopy,
  onReply,
  onDelete,
  onPin,
  onForward,
}: MessageContextMenuProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      <div
        className="fixed z-50 min-w-[180px] bg-popover border border-border rounded-lg shadow-lg py-1"
        style={{
          left: Math.min(position.x, window.innerWidth - 200),
          top: Math.min(position.y, window.innerHeight - 300),
        }}
      >
        <div
          onClick={() => { onCopy(message.content); onClose(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent"
        >
          <Icons.Copy className="w-4 h-4" />
          {t('message.copy')}
        </div>
        
        <div
          onClick={() => { onReply(message); onClose(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent"
        >
          <Icons.Reply className="w-4 h-4" />
          {t('message.reply')}
        </div>
        
        <div
          onClick={() => { onForward(message); onClose(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent"
        >
          <Icons.Forward className="w-4 h-4" />
          {t('message.forward')}
        </div>
        
        <div className="border-t border-border my-1" />
        
        <div
          onClick={() => { onPin(message); onClose(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent"
        >
          <Icons.Pin className="w-4 h-4" />
          {message.isPinned ? t('message.unpin') : t('message.pin')}
        </div>
        
        {isOwn && (
          <>
            <div className="border-t border-border my-1" />
            <div
              onClick={() => { onDelete(message.id); onClose(); }}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-destructive/10 text-destructive"
            >
              <Icons.Trash className="w-4 h-4" />
              {t('message.delete')}
            </div>
          </>
        )}
      </div>
    </>
  );
}
