"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ky from "ky";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "../components/auth-context";
import Link from "next/link";
import { MessageSquare, Plus, X, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ConversationListProps {
  currentConversationId?: string;
  onSelect: (id: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export default function ConversationList({
  currentConversationId,
  onSelect,
  isOpen,
  onToggle,
}: ConversationListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: conversations = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => ky.get("/api/chat/conversations").json<Conversation[]>(),
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      ky.delete(`/api/chat/conversations/${id}`).json(),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["conversations"] });
      const previous = queryClient.getQueryData<Conversation[]>([
        "conversations",
      ]);
      queryClient.setQueryData<Conversation[]>(
        ["conversations"],
        (old) => old?.filter((c) => c.id !== id) ?? [],
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["conversations"], context.previous);
      }
      toast.error("Failed to delete conversation");
    },
    onSuccess: () => {
      toast.success("Conversation deleted");
    },
  });

  const handleDelete = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    toast.custom(
      (t) => (
        <div className="bg-[#141414] border border-white/10 p-4 shadow-xl min-w-[260px]">
          <p className="text-sm text-zinc-300 mb-3 font-medium">
            Delete &ldquo;{conv.title}&rdquo;?
          </p>
          <p className="text-xs text-zinc-500 mb-4">
            This action cannot be undone.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(t)}
              className="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                deleteMutation.mutate(conv.id);
                toast.dismiss(t);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: 10000 },
    );
  };

  // Sidebar content (shared between desktop and mobile)
  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-accent-gold-body">
            History
          </h2>
          <button
            onClick={onToggle}
            className="lg:hidden text-zinc-500 hover:text-white transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <Link
          href="/chat"
          className="flex items-center gap-2 w-full px-3 py-2 text-xs font-bold uppercase tracking-wider text-accent-gold-bright bg-accent-gold/10 border border-accent-gold/20 hover:bg-accent-gold/20 transition-all duration-300"
        >
          <Plus className="w-3.5 h-3.5" />
          New Chat
        </Link>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {!user ? (
          <div className="p-4 text-center">
            <p className="text-xs text-zinc-600 uppercase tracking-wider">
              Sign in to save conversations
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-accent-gold animate-spin" />
          </div>
        ) : isError ? (
          <div className="p-4 text-center">
            <p className="text-xs text-red-400 mb-2 uppercase tracking-wider">
              Failed to load
            </p>
            <button
              onClick={() => refetch()}
              className="text-xs text-accent-gold-body uppercase tracking-wider hover:text-accent-gold-bright transition-colors"
            >
              Retry
            </button>
          </div>
        ) : conversations.length === 0 ? (
          <div className="p-4 text-center">
            <MessageSquare className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
            <p className="text-xs text-zinc-600 uppercase tracking-wider">
              No conversations yet
            </p>
          </div>
        ) : (
          <div className="py-2">
            {conversations.map((conv) => {
              const isActive = conv.id === currentConversationId;
              return (
                <button
                  key={conv.id}
                  onClick={() => onSelect(conv.id)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors duration-200 group border-l-2 ${
                    isActive
                      ? "bg-accent-gold/10 border-accent-gold text-white"
                      : "border-transparent hover:bg-white/[0.03] text-zinc-400 hover:text-zinc-300"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-50" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{conv.title}</p>
                    <p className="text-xs text-zinc-600 mt-0.5 uppercase tracking-wider">
                      {formatDistanceToNow(new Date(conv.updated_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, conv)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-red-500/10 rounded"
                    aria-label={`Delete ${conv.title}`}
                  >
                    <Trash2 className="w-3 h-3 text-zinc-600 hover:text-red-400 transition-colors" />
                  </button>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed top-[64px] left-0 bottom-0 w-[280px] z-40 bg-[#0a0a0a] border-r border-white/5 transition-transform duration-300 ease-in-out lg:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:w-[280px] lg:flex-col lg:border-r lg:border-white/5 bg-[#0a0a0a]">
        {sidebarContent}
      </div>
    </>
  );
}
