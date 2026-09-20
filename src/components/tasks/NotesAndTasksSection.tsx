"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";
import { NoteAndTask, NoteTaskType } from "@/types/database";
import {
  CheckSquare,
  Square,
  Plus,
  Bookmark,
  Calendar,
  Package,
  FileText,
  Bell,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface NotesAndTasksSectionProps {
  userId: string | null;
  academicGroup?: string;
  subjects?: string[];
  onOpenAuth?: () => void;
}

export default function NotesAndTasksSection({
  userId,
  academicGroup,
  subjects = [],
  onOpenAuth,
}: NotesAndTasksSectionProps) {
  const [items, setItems] = useState<NoteAndTask[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [isAdding, setIsAdding] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<NoteTaskType>("bring_item");
  const [newSubject, setNewSubject] = useState("");
  const [newDueDate, setNewDueDate] = useState("");

  // Load items
  useEffect(() => {
    if (!userId) {
      setItems([]);
      return;
    }

    let isMounted = true;
    async function loadTasks() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("notes_and_tasks")
          .select("*")
          .eq("user_id", userId)
          .order("is_completed", { ascending: true })
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0 && isMounted) {
          setItems(data);
          if (typeof window !== "undefined") {
            localStorage.setItem(`docse_tasks_${userId}`, JSON.stringify(data));
          }
          return;
        }
      } catch (err) {
        console.debug("Supabase tasks offline, checking local storage");
      } finally {
        if (isMounted) setLoading(false);
      }

      // Local storage fallback
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem(`docse_tasks_${userId}`);
        if (raw && isMounted) {
          try {
            setItems(JSON.parse(raw));
          } catch {}
        }
      }
    }

    loadTasks();

    return () => {
      isMounted = false;
    };
  }, [userId]);

  const handleToggleComplete = async (item: NoteAndTask) => {
    const updated = !item.is_completed;
    const newItems = items.map((t) =>
      t.id === item.id ? { ...t, is_completed: updated } : t
    );
    setItems(newItems);

    if (typeof window !== "undefined" && userId) {
      localStorage.setItem(`docse_tasks_${userId}`, JSON.stringify(newItems));
    }

    try {
      await supabase
        .from("notes_and_tasks")
        .update({ is_completed: updated, updated_at: new Date().toISOString() })
        .eq("id", item.id);
    } catch (err) {
      console.debug("Remote task toggle offline");
    }
  };

  const handleDelete = async (id: string) => {
    const newItems = items.filter((t) => t.id !== id);
    setItems(newItems);
    if (typeof window !== "undefined" && userId) {
      localStorage.setItem(`docse_tasks_${userId}`, JSON.stringify(newItems));
    }
    try {
      await supabase.from("notes_and_tasks").delete().eq("id", id);
    } catch (err) {
      console.debug("Remote task delete offline");
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !userId) return;

    const fallbackId = `task-${Date.now()}`;
    const newItem: NoteAndTask = {
      id: fallbackId,
      user_id: userId,
      academic_group: academicGroup || null,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      type: newType,
      subject_name: newSubject.trim() || null,
      due_date: newDueDate || null,
      is_completed: false,
      created_at: new Date().toISOString(),
    };

    const newItems = [newItem, ...items];
    setItems(newItems);
    if (typeof window !== "undefined") {
      localStorage.setItem(`docse_tasks_${userId}`, JSON.stringify(newItems));
    }

    setNewTitle("");
    setNewDescription("");
    setNewDueDate("");
    setIsAdding(false);

    try {
      const { data, error } = await supabase
        .from("notes_and_tasks")
        .insert({
          user_id: userId,
          academic_group: academicGroup || null,
          title: newItem.title,
          description: newItem.description,
          type: newItem.type,
          subject_name: newItem.subject_name,
          due_date: newItem.due_date,
          is_completed: false,
        })
        .select()
        .single();

      if (!error && data) {
        setItems((prev) => prev.map((t) => (t.id === fallbackId ? data : t)));
      }
    } catch (err) {
      console.debug("Remote task creation offline");
    }
  };

  const filteredItems = items.filter((item) => {
    if (filterType === "all") return true;
    return item.type === filterType;
  });

  const getTypeBadge = (type: NoteTaskType) => {
    switch (type) {
      case "bring_item":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            <Package className="w-3 h-3 text-amber-600" />
            What to Bring
          </span>
        );
      case "assignment":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
            <FileText className="w-3 h-3 text-purple-600" />
            Assignment
          </span>
        );
      case "reminder":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
            <Bell className="w-3 h-3 text-blue-600" />
            Reminder
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
            <Bookmark className="w-3 h-3 text-zinc-500" />
            Note
          </span>
        );
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-zinc-900 text-white">
            <Bookmark className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
                Notes, Assignments & What to Bring
              </h3>
              {items.length > 0 && (
                <span className="text-[11px] px-2 py-0.2 rounded-full bg-zinc-100 text-zinc-700 font-mono">
                  {items.filter((i) => !i.is_completed).length} pending
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              Keep track of materials to carry to lab, homework deadlines, and classroom reminders.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setIsExpanded(true);
              setIsAdding(!isAdding);
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            type="button"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="pt-4 space-y-4">
          {/* New Item Form */}
          {isAdding && (
            <form
              onSubmit={handleCreateItem}
              className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3 animate-in fade-in duration-150"
            >
              <div className="font-semibold text-xs text-zinc-900">
                Create New Reminder or Checklist Item
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bring Scientific Calculator for Lab"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                    Type
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as NoteTaskType)}
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  >
                    <option value="bring_item">What to Bring (Items/Hardware)</option>
                    <option value="assignment">Assignment / Submission</option>
                    <option value="reminder">Class Reminder</option>
                    <option value="note">General Note</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                    Associated Subject (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. COMP 102, Microprocessors"
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                    Due Date / Class Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-700 mb-1">
                  Additional Details / Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Chapter 4 questions 1 to 5 to be submitted in hardcopy."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-zinc-900 text-white text-xs font-semibold rounded-lg hover:bg-zinc-800 transition-colors shadow-xs"
                >
                  Save Item
                </button>
              </div>
            </form>
          )}

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {[
              { id: "all", label: "All Items" },
              { id: "bring_item", label: "What to Bring" },
              { id: "assignment", label: "Assignments" },
              { id: "reminder", label: "Reminders" },
              { id: "note", label: "Notes" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterType(f.id)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  filterType === f.id
                    ? "bg-zinc-900 text-white font-medium"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Items List */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl animate-pulse h-12"
                />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-400 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
              No tasks or items found in this filter category.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                    item.is_completed
                      ? "bg-zinc-50/60 border-zinc-200 opacity-60"
                      : "bg-white border-zinc-200 hover:border-zinc-300 shadow-xs"
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(item)}
                      className="mt-0.5 text-zinc-500 hover:text-zinc-900 transition-colors"
                    >
                      {item.is_completed ? (
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-xs font-semibold ${
                            item.is_completed
                              ? "line-through text-zinc-400"
                              : "text-zinc-900"
                          }`}
                        >
                          {item.title}
                        </span>
                        {getTypeBadge(item.type)}
                        {item.subject_name && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700 font-mono">
                            {item.subject_name}
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p className="text-xs text-zinc-600">{item.description}</p>
                      )}

                      {item.due_date && (
                        <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
                          <Calendar className="w-3 h-3" />
                          <span>Due: {item.due_date}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="text-zinc-300 hover:text-rose-600 transition-colors p-1"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
