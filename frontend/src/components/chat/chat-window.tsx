'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messagesApi, usersApi, Chat, Message } from '@/lib/api-client';
import { useChatStore, useSocketStore, useAuthStore } from '@/store';
import { useTranslation } from '@/lib/i18n-provider';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/icons';
import { GroupMembers } from './group-members';
import { MessageContextMenu } from './message-context-menu';
import { ForwardModal } from './forward-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { UserProfileModal } from './user-profile-modal';

interface ChatWindowProps {
  chat: Chat;
}

export function ChatWindow({ chat }: ChatWindowProps) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const { user: currentUser } = useAuthStore();
  const { 
    socket,
    joinChat, 
    leaveChat, 
    startTyping, 
    stopTyping, 
    typingUsers,
    isConnected,
    markAsRead,
    resetUnread,
  } = useSocketStore();
  const { addMessage, messages, markChatAsRead, isMessageRead, deleteMessage, togglePinMessage } = useChatStore();
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    message: Message | null;
    position: { x: number; y: number };
  }>({ isOpen: false, message: null, position: { x: 0, y: 0 } });
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; messageId: string | null }>({
    isOpen: false,
    messageId: null,
  });
  const [isBlocked, setIsBlocked] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Set active chat ID globally for socket store
  useEffect(() => {
    markChatAsRead(chat.id);
    markAsRead(chat.id);   // notify backend via socket
    resetUnread(chat.id);  // clear local unread counter
  }, [chat.id, markChatAsRead, markAsRead, resetUnread]);

  const typingUserList = Array.from(typingUsers.values())
    .filter((t) => t.chatId === chat.id && t.userId !== currentUser?.id);

  // Load initial messages - keep them in store
  const { data: fetchedMessages, isLoading } = useQuery({
    queryKey: ['messages', chat.id],
    queryFn: async () => {
      const response = await messagesApi.getAll(chat.id, 100);
      // Add fetched messages to store
      response.data.forEach((msg) => {
        addMessage(chat.id, msg);
      });
      return response.data;
    },
    staleTime: 5000, // Keep data fresh for 5 seconds
  });

  // Get messages from store
  const chatMessages = messages.get(chat.id) || [];
  
  // Get all pinned messages
  const pinnedMessages = chatMessages.filter((m) => m.isPinned);
  // Show all messages in chat (including pinned)
  const regularMessages = chatMessages;
  
  // Track which pinned message is currently shown in banner
  const [currentPinnedIndex, setCurrentPinnedIndex] = useState(0);
  const currentPinnedMessage = pinnedMessages[currentPinnedIndex] || null;

  // Reset index when pinned messages change
  useEffect(() => {
    if (pinnedMessages.length > 0 && currentPinnedIndex >= pinnedMessages.length) {
      setCurrentPinnedIndex(pinnedMessages.length - 1);
    }
  }, [pinnedMessages.length, currentPinnedIndex]);

  // Join chat room and setup socket listeners on mount
  useEffect(() => {
    joinChat(chat.id);

    // Setup socket event listeners
    const handleNewMessage = (e: Event) => {
      const customEvent = e as CustomEvent<Message>;
      const message = customEvent.detail;
      if (message.chatId === chat.id) {
        addMessage(chat.id, message);
        // Play notification sound if not in active chat
        const activeChatId = useChatStore.getState().activeChat?.id;
        if (activeChatId !== chat.id) {
          toast.info(`${t('message.newMessageFrom')} ${message.sender.firstName}`);
        } else {
          // If we are currently looking at the chat, mark the new message as read instantly
          if (message.senderId !== currentUser?.id) {
            markAsRead(chat.id);
          }
        }
      }
    };

    const handleMessageEdited = (e: Event) => {
      const customEvent = e as CustomEvent<Message>;
      const message = customEvent.detail;
      if (message.chatId === chat.id) {
        addMessage(chat.id, message);
      }
    };

    const handleMessageDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ chatId: string; messageId: string }>;
      const { chatId, messageId } = customEvent.detail;
      if (chatId === chat.id) {
        // Handle message deletion
      }
    };

    // Listen to custom events dispatched by socket-store
    window.addEventListener('socket-new-message', handleNewMessage as EventListener);
    window.addEventListener('socket-message-edited', handleMessageEdited as EventListener);
    window.addEventListener('socket-message-deleted', handleMessageDeleted as EventListener);

    // When the other user reads this chat — mark all our sent messages as read in the UI
    const handleMessagesRead = (e: Event) => {
      const { chatId: readChatId } = (e as CustomEvent<{ chatId: string; userId: string }>).detail;
      if (readChatId === chat.id) {
        markChatAsRead(chat.id);
      }
    };
    window.addEventListener('socket-messages-read', handleMessagesRead as EventListener);

    return () => {
      leaveChat(chat.id);
      window.removeEventListener('socket-new-message', handleNewMessage as EventListener);
      window.removeEventListener('socket-message-edited', handleMessageEdited as EventListener);
      window.removeEventListener('socket-message-deleted', handleMessageDeleted as EventListener);
      window.removeEventListener('socket-messages-read', handleMessagesRead as EventListener);
    };
  }, [chat.id]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  // Handle typing indicator
  useEffect(() => {
    if (isTyping) {
      startTyping(chat.id);
      const timer = setTimeout(() => {
        setIsTyping(false);
        stopTyping(chat.id);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isTyping, chat.id]);

  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const response = await messagesApi.create(chat.id, content, replyTo?.id);
      return response.data;
    },
    onSuccess: (message) => {
      // Message will be added via WebSocket event or optimistically
      setMessageInput('');
      setIsTyping(false);
      stopTyping(chat.id);
      setReplyTo(null); // Clear reply after sending
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || sendMessage.isPending) return;
    sendMessage.mutate(messageInput.trim());
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageInput(e.target.value);
    if (!isTyping && e.target.value) {
      setIsTyping(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Context menu handlers
  const handleContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      message,
      position: { x: e.clientX, y: e.clientY },
    });
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success(t('message.copiedToClipboard'));
  };

  const handleReplyToMessage = (message: Message) => {
    setReplyTo(message);
    setContextMenu({ ...contextMenu, isOpen: false });
    inputRef.current?.focus();
  };

  const handleDeleteMessage = (messageId: string) => {
    setContextMenu({ ...contextMenu, isOpen: false });
    setDeleteConfirm({ isOpen: true, messageId });
  };

  const confirmDelete = () => {
    const messageId = deleteConfirm.messageId;
    if (!messageId) return;

    console.log('Deleting message:', messageId);
    
    // Optimistic update - remove from store immediately
    deleteMessage(chat.id, messageId);
    
    // Actually call the API
    messagesApi.delete(chat.id, messageId)
      .then(() => toast.success(t('message.deleted')))
      .catch((error) => toast.error(error.response?.data?.message || t('message.failedToDelete')))
      .finally(() => setDeleteConfirm({ isOpen: false, messageId: null }));
  };

  const deleteSelectedMessages = () => {
    setDeleteConfirm({ isOpen: true, messageId: 'multiple' });
  };

  const confirmDeleteMultiple = () => {
    selectedMessages.forEach((msgId) => {
      deleteMessage(chat.id, msgId);
      messagesApi.delete(chat.id, msgId).catch(() => {});
    });
    toast.success(`${selectedMessages.size} ${t('message.selected')}`);
    setSelectedMessages(new Set());
    setIsSelectMode(false);
    setDeleteConfirm({ isOpen: false, messageId: null });
  };

  const handlePinMessage = async (message: Message) => {
    // Optimistic update
    togglePinMessage(chat.id, message.id);
    
    try {
      await messagesApi.togglePin(chat.id, message.id);
      toast.success(message.isPinned ? t('message.unpinnedSuccess') : t('message.pinnedSuccess'));
    } catch (error) {
      // Revert on error
      togglePinMessage(chat.id, message.id);
      toast.error(t('message.failedToPin'));
    }
  };

  const handleForwardMessage = (message: Message) => {
    setForwardMessage(message);
    setContextMenu({ ...contextMenu, isOpen: false });
  };

  const handleBlockUser = async () => {
    if (!otherMember) return;
    try {
      await usersApi.blockUser(otherMember.user.id);
      setIsBlocked(true);
      toast.success(t('blocked.userBlocked'));
    } catch (error) {
      toast.error(t('blocked.failedToBlock'));
    }
  };

  const handleUnblockUser = async () => {
    if (!otherMember) return;
    try {
      await usersApi.unblockUser(otherMember.user.id);
      setIsBlocked(false);
      toast.success(t('blocked.userUnblocked'));
    } catch (error) {
      toast.error(t('blocked.failedToUnblock'));
    }
  };

  // Selection mode handlers
  const toggleSelectMessage = (messageId: string) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
        if (next.size === 0) setIsSelectMode(false);
      } else {
        next.add(messageId);
        setIsSelectMode(true);
      }
      return next;
    });
  };

  const copySelectedMessages = () => {
    const chatMessages = messages.get(chat.id) || [];
    const selectedText = Array.from(selectedMessages)
      .map((id) => chatMessages.find((m) => m.id === id)?.content)
      .filter(Boolean)
      .join('\n\n');
    navigator.clipboard.writeText(selectedText);
    toast.success(t('message.copiedToClipboard'));
    setSelectedMessages(new Set());
    setIsSelectMode(false);
  };

  const forwardSelectedMessages = () => {
    toast.info(t('message.forwardFeatureSoon'));
    setSelectedMessages(new Set());
    setIsSelectMode(false);
  };

  const cancelSelection = () => {
    setSelectedMessages(new Set());
    setIsSelectMode(false);
  };

  const otherMember = chat.members.find((m) => m.user.id !== currentUser?.id);
  const isOnline = otherMember?.user.isOnline;

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <div
            className={cn(
              'w-10 h-10 rounded-full bg-secondary flex items-center justify-center cursor-pointer hover:opacity-80',
              !chat.isGroup && 'cursor-pointer hover:opacity-80'
            )}
            onClick={() => chat.isGroup ? setShowMembers(true) : setShowUserProfile(true)}
          >
            <span className="text-sm font-medium">
              {chat.isGroup
                ? (chat.name || '?')[0].toUpperCase()
                : `${otherMember?.user.firstName[0]}${otherMember?.user.lastName[0]}`}
            </span>
          </div>
          <div
            className="flex-1 cursor-pointer"
            onClick={() => chat.isGroup ? setShowMembers(true) : setShowUserProfile(true)}
          >
            <h3 className="font-semibold">
              {chat.isGroup ? chat.name : `${otherMember?.user.firstName} ${otherMember?.user.lastName}`}
            </h3>
            {!chat.isGroup && (
              <p className="text-xs text-muted-foreground">
                {isOnline ? (
                  <span className="text-green-500">{t('common.online')}</span>
                ) : otherMember?.user.lastSeen ? (
                  `${t('common.lastSeen')} ${new Date(otherMember.user.lastSeen).toLocaleString()}`
                ) : null}
              </p>
            )}
            {chat.isGroup && (
              <p className="text-xs text-muted-foreground">
                {chat.members.length} {chat.members.length === 1 ? t('chat.member') : t('chat.members')}
              </p>
            )}
          </div>
          {chat.isGroup ? (
            <button
              onClick={() => setShowMembers(true)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Icons.Users />
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-accent transition-colors">
                  <Icons.MoreHorizontal />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isBlocked ? (
                  <DropdownMenuItem onClick={handleUnblockUser}>
                    <Icons.Users className="w-4 h-4 mr-2" />
                    {t('blocked.unblockUser')}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleBlockUser} className="text-destructive">
                    <Icons.X className="w-4 h-4 mr-2" />
                    {t('blocked.blockUser')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Selection Mode Toolbar */}
          {isSelectMode && (
            <div className="sticky top-0 z-30 bg-card border border-border rounded-lg p-3 shadow-lg mb-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{selectedMessages.size} {t('message.selected')}</span>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={copySelectedMessages}>
                    <Icons.Copy className="w-4 h-4 mr-1" />
                    {t('message.copy')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={forwardSelectedMessages}>
                    <Icons.Forward className="w-4 h-4 mr-1" />
                    {t('message.forward')}
                  </Button>
                  {Array.from(selectedMessages).every((id) => {
                    const msg = chatMessages.find((m) => m.id === id);
                    return msg?.senderId === currentUser?.id;
                  }) && (
                    <Button variant="ghost" size="sm" onClick={deleteSelectedMessages} className="text-destructive">
                      <Icons.Trash className="w-4 h-4 mr-1" />
                      {t('message.delete')}
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={cancelSelection}>
                    {t('common.cancel')}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Pinned Message Banner - Sticky */}
          {currentPinnedMessage && (
            <div
              className="sticky top-0 z-30 mb-4 bg-muted/95 backdrop-blur border border-border rounded-lg px-3 py-2 cursor-pointer hover:bg-muted transition-colors shadow-lg"
              onClick={() => {
                // Cycle to previous pinned message
                if (pinnedMessages.length > 1) {
                  const newIndex = currentPinnedIndex === 0 ? pinnedMessages.length - 1 : currentPinnedIndex - 1;
                  setCurrentPinnedIndex(newIndex);
                }
                // Scroll to the current pinned message
                const element = document.getElementById(`msg-${currentPinnedMessage.id}`);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  element.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                  setTimeout(() => {
                    element.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
                  }, 2000);
                }
              }}
            >
              <div className="flex items-center gap-2">
                <Icons.Pin className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="text-sm truncate flex-1">{currentPinnedMessage.content}</p>
                {pinnedMessages.length > 1 && (
                  <span className="text-xs text-muted-foreground mr-1">
                    {currentPinnedIndex + 1}/{pinnedMessages.length}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePinMessage(currentPinnedMessage);
                  }}
                  className="p-1 hover:bg-accent rounded shrink-0"
                >
                  <Icons.X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}

          {isLoading && regularMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : regularMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground text-sm">{t('chat.noMessagesSayHello')}</p>
            </div>
          ) : (
            regularMessages.map((message) => {
              const isOwn = message.senderId === currentUser?.id;
              const isRead = isOwn && isMessageRead(message.id);
              const isSelected = selectedMessages.has(message.id);
              const isPinned = message.isPinned;

              return (
                <div
                  key={message.id}
                  id={`msg-${message.id}`}
                  className={cn('flex gap-2', isOwn ? 'justify-end' : 'justify-start')}
                  onContextMenu={(e) => handleContextMenu(e, message)}
                  onClick={() => isSelectMode && toggleSelectMessage(message.id)}
                >
                  {/* Selection Checkbox */}
                  {isSelectMode && (
                    <div className="flex items-center pt-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectMessage(message.id)}
                        className="w-4 h-4 rounded border-border"
                      />
                    </div>
                  )}
                  <div
                    className={cn(
                      'max-w-[70%] rounded-2xl px-4 py-2',
                      isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary',
                      isSelected && 'ring-2 ring-primary',
                      isPinned && 'border-2 border-primary/50'
                    )}
                  >
                    {isPinned && (
                      <div className="flex items-center gap-1 mb-1 text-xs opacity-75">
                        <Icons.Pin className="w-3 h-3" />
                        <span>{t('message.pinned')}</span>
                      </div>
                    )}
                    {/* Reply Preview */}
                    {message.replyTo && (
                      <div
                        className={cn(
                          'mb-2 p-2 rounded border-l-2 text-xs truncate',
                          isOwn ? 'border-primary/50 bg-primary/10' : 'border-secondary bg-secondary/50'
                        )}
                      >
                        <p className="font-medium">
                          {message.replyTo.sender.firstName} {message.replyTo.sender.lastName}
                        </p>
                        <p className="truncate opacity-75">{message.replyTo.content}</p>
                      </div>
                    )}
                    
                    {!isOwn && chat.isGroup && (
                      <p className="text-xs font-medium mb-1 opacity-75">
                        {message.sender.firstName} {message.sender.lastName}
                      </p>
                    )}
                    <p className="text-sm wrap-break-word">{message.content}</p>
                    <div className={cn('flex items-center gap-1 mt-1 text-xs', isOwn ? 'justify-end' : 'justify-start')}>
                      <span className="opacity-75">
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isOwn && (
                        <span className={cn('flex', isRead ? 'text-blue-500' : 'opacity-75')}>
                          {isRead ? (
                            <Icons.CheckCheck className="w-3 h-3" />
                          ) : (
                            <Icons.Check className="w-3 h-3" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing indicator */}
          {typingUserList.length > 0 && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs">
                {typingUserList.map((t) => {
                  const member = chat.members.find((m) => m.userId === t.userId);
                  return member?.user.firstName || 'Someone';
                }).join(', ')} {t('chat.typing')}
              </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-border">
          {isBlocked ? (
            <div className="flex items-center justify-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
              <Icons.Block className="w-4 h-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {t('blocked.cannotMessageBlocked')}
              </p>
              <button
                type="button"
                onClick={handleUnblockUser}
                className="text-sm text-primary hover:underline font-medium"
              >
                {t('blocked.unblockUser')}
              </button>
            </div>
          ) : (
            <>
              {/* Reply Preview */}
              {replyTo && (
                <div className="mb-2 flex items-center gap-2 p-2 bg-muted/50 rounded-lg border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                      {t('message.replyingTo')} {replyTo.sender.firstName} {replyTo.sender.lastName}
                    </p>
                    <p className="text-sm truncate">{replyTo.content}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyTo(null)}
                    className="p-1 hover:bg-accent rounded"
                  >
                    <Icons.X className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={t('chat.typeMessage')}
                  rows={1}
                  className="flex-1 resize-none px-4 py-2 bg-secondary border-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary max-h-32"
                  style={{ minHeight: '44px' }}
                />
                <button
                  type="submit"
                  disabled={!messageInput.trim() || sendMessage.isPending || !isConnected}
                  className="p-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
                  title={!isConnected ? 'Connecting...' : ''}
                >
                  <Icons.Send />
                </button>
              </div>
              {!isConnected && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Connecting to server...
                </p>
              )}
            </>
          )}
        </form>
      </div>

      {showMembers && chat.isGroup && (
        <GroupMembers chat={chat} onClose={() => setShowMembers(false)} />
      )}

      {/* Forward Modal */}
      <ForwardModal
        message={forwardMessage}
        isOpen={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        currentChatId={chat.id}
      />

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title={t('common.delete')}
        description={t('message.confirmDelete')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="destructive"
        onConfirm={deleteConfirm.messageId === 'multiple' ? confirmDeleteMultiple : confirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, messageId: null })}
      />

      {/* Message Context Menu */}
      {contextMenu.isOpen && contextMenu.message && (
        <MessageContextMenu
          message={contextMenu.message}
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          isOwn={contextMenu.message.senderId === currentUser?.id}
          onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
          onCopy={handleCopyMessage}
          onReply={handleReplyToMessage}
          onDelete={handleDeleteMessage}
          onPin={handlePinMessage}
          onForward={handleForwardMessage}
        />
      )}

      {/* User Profile Modal */}
      <UserProfileModal
        user={otherMember?.user || null}
        isOpen={showUserProfile}
        onClose={() => setShowUserProfile(false)}
        currentUserId={currentUser?.id}
      />
    </>
  );
}
