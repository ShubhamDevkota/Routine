"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { ClassComment } from "@/types/database";
import { MessageSquare, Send, Sparkles, User, X } from "lucide-react";

interface ClassChatDrawerProps {
  classInstanceId?: string | null;
  scheduleKey: string; // e.g. "I CE-I/I A-Mon-10:00-Room"
  subjectName: string;
  roomName: string;
  userId: string | null;
  userName?: string | null;
  academicGroup: string;
  onOpenAuth?: () => void;
}

export default function ClassChatDrawer({
  classInstanceId,
  scheduleKey,
  subjectName,
  roomName,
  userId,
  userName = "Student",
  academicGroup,
  onOpenAuth,
}: ClassChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [comments, setComments] = useState<ClassComment[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Load comments & set up Supabase Realtime subscription
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;

    async function loadComments() {
      try {
        let query = supabase
          .from("class_comments")
          .select("*")
          .order("created_at", { ascending: true });

        if (classInstanceId) {
          query = query.eq("class_instance_id", classInstanceId);
        } else {
          query = query.eq("academic_group", academicGroup);
        }

        const { data, error } = await query.limit(50);
        if (!error && data && data.length > 0 && isMounted) {
          setComments(data);
          return;
        }
      } catch (err) {
        console.debug("Class comments offline, checking local storage");
      }

      if (typeof window !== "undefined") {
        const raw = localStorage.getItem(`docse_chat_${scheduleKey}`);
        if (raw && isMounted) {
          try {
            setComments(JSON.parse(raw));
          } catch {}
        }
      }
    }

    loadComments();

    // Setup Realtime subscription
    const channel = supabase
      .channel(`room-chat-${scheduleKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "class_comments",
        },
        (payload: { new: ClassComment }) => {
          const newComment = payload.new as ClassComment;
          if (
            (classInstanceId && newComment.class_instance_id === classInstanceId) ||
            (!classInstanceId && newComment.academic_group === academicGroup)
          ) {
            setComments((prev) => {
              if (prev.some((c) => c.id === newComment.id)) return prev;
              return [...prev, newComment];
            });
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [isOpen, classInstanceId, academicGroup, scheduleKey]);

  useEffect(() => {
    if (isOpen) {
      commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments, isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    if (!userId) {
      if (onOpenAuth) onOpenAuth();
      return;
    }

    const messageText = inputText.trim();
    setInputText("");
    setLoading(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticComment: ClassComment = {
      id: tempId,
      user_id: userId,
      user_name: userName,
      class_instance_id: classInstanceId || null,
      academic_group: academicGroup,
      message: messageText,
      created_at: new Date().toISOString(),
    };

    const newCommentsList = [...comments, optimisticComment];
    setComments(newCommentsList);
    if (typeof window !== "undefined") {
      localStorage.setItem(`docse_chat_${scheduleKey}`, JSON.stringify(newCommentsList));
    }

    try {
      const { data, error } = await supabase
        .from("class_comments")
        .insert({
          user_id: userId,
          user_name: userName,
          class_instance_id: classInstanceId || null,
          academic_group: academicGroup,
          message: messageText,
        })
        .select()
        .single();

      if (!error && data) {
        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? data : c))
        );
      }
    } catch (err) {
      console.debug("Remote comment send offline");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-medium px-2 py-1 rounded hover:bg-zinc-100"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span>
          {isOpen
            ? "Hide Room Chat"
            : comments.length > 0
            ? `Class Chat (${comments.length})`
            : "Class Room Chat"}
        </span>
      </button>

      {/* Collapsible Chat Box */}
      {isOpen && (
        <div className="mt-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200 mb-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-900">{subjectName}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 font-mono">
                {roomName}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-zinc-400 hover:text-zinc-700 rounded"
              type="button"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="max-h-48 overflow-y-auto space-y-2.5 pr-1 mb-3">
            {comments.length === 0 ? (
              <div className="text-center py-4 text-xs text-zinc-400">
                No discussion messages yet. Start the conversation for this class!
              </div>
            ) : (
              comments.map((comment) => {
                const isMe = comment.user_id === userId;
                const timeStr = new Date(comment.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={comment.id}
                    className={`flex flex-col text-xs ${
                      isMe ? "items-end" : "items-start"
                    }`}
                  >
                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 mb-0.5 px-1">
                      <span>{comment.user_name || "Student"}</span>
                      <span>&bull;</span>
                      <span>{timeStr}</span>
                    </div>
                    <div
                      className={`px-3 py-2 rounded-xl max-w-[85%] text-xs break-words ${
                        isMe
                          ? "bg-zinc-900 text-white rounded-br-xs"
                          : "bg-white border border-zinc-200 text-zinc-800 rounded-bl-xs shadow-xs"
                      }`}
                    >
                      {comment.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Input Box */}
          {userId ? (
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                placeholder="Ask a question or share classroom info..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
              <button
                type="submit"
                disabled={loading || !inputText.trim()}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shrink-0"
              >
                <Send className="w-3 h-3" />
                <span>Send</span>
              </button>
            </form>
          ) : (
            <div className="flex items-center justify-between p-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-600">
              <span>Sign in to participate in real-time class room chat.</span>
              <button
                type="button"
                onClick={onOpenAuth}
                className="font-medium text-zinc-900 hover:underline ml-2"
              >
                Sign In
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
