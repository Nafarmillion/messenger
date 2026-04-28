"use client";

import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ChatList } from "@/components/chat/chat-list";
import { ChatWindow } from "@/components/chat/chat-window";
import { useChatStore } from "@/store";
import { Chat as ChatType } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { useTranslation } from "@/lib/i18n-provider";

export default function ChatsPage() {
  const { t } = useTranslation();
  const { activeChat, setActiveChat } = useChatStore();
  const [showChatList, setShowChatList] = useState(true);

  const handleSelectChat = (chat: ChatType) => {
    setActiveChat(chat);
    setShowChatList(false);
  };

  const handleBackToList = () => {
    setShowChatList(true);
    setActiveChat(null);
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex h-full">
          {/* Chat List */}
          <div
            className={cn(
              "w-full md:w-80 border-r border-border shrink-0",
              activeChat && "hidden md:block",
            )}
          >
            <ChatList
              onSelectChat={handleSelectChat}
              activeChatId={activeChat?.id}
            />
          </div>

          {/* Chat Window */}
          <div
            className={cn(
              "flex-1 flex flex-col",
              !activeChat && "hidden md:flex",
            )}
          >
            {activeChat ? (
              <>
                {/* Mobile back button */}
                <button
                  onClick={handleBackToList}
                  className="md:hidden p-3 border-b border-border flex items-center gap-2"
                >
                  <Icons.ArrowLeft />
                  {t("common.back")}
                </button>
                <ChatWindow chat={activeChat} />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg font-medium mb-2">
                    {t("chat.selectChat")}
                  </p>
                  <p className="text-sm">{t("chat.noMessagesYet")}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
