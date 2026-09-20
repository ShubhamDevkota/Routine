"use client";

import { useState } from "react";
import { User, LogOut, GraduationCap, School, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface UserProfileMenuProps {
  user: {
    id: string;
    email?: string;
    isAnonymous?: boolean;
  } | null;
  profile: {
    academic_group: string;
    course: string;
    full_name?: string | null;
  } | null;
  availableGroups: string[];
  onGroupChange: (group: string) => void;
  onOpenAuth: () => void;
  onSignOut: () => void;
}

export default function UserProfileMenu({
  user,
  profile,
  availableGroups,
  onGroupChange,
  onOpenAuth,
  onSignOut,
}: UserProfileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("docse_local_user");
      }
      await supabase.auth.signOut().catch(() => {});
      onSignOut();
      setIsOpen(false);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const handleGroupSelect = async (newGroup: string) => {
    onGroupChange(newGroup);
    if (user?.id) {
      try {
        await supabase
          .from("profiles")
          .update({ academic_group: newGroup, updated_at: new Date().toISOString() })
          .eq("id", user.id);
      } catch (err) {
        console.warn("Failed to sync profile group:", err);
      }
    }
    setIsOpen(false);
  };

  if (!user) {
    return (
      <button
        onClick={onOpenAuth}
        type="button"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 transition-colors shadow-sm"
      >
        <User className="w-3.5 h-3.5" />
        <span>Student Sign In</span>
      </button>
    );
  }

  const displayName =
    profile?.full_name || user.email?.split("@")[0] || (user.isAnonymous ? "Guest Student" : "Student");

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-zinc-900 text-xs font-medium transition-all"
      >
        <div className="w-5 h-5 rounded-full bg-zinc-900 text-white flex items-center justify-center text-[10px] font-bold">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span className="max-w-[100px] truncate">{displayName}</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 font-mono text-zinc-700">
          {profile?.academic_group || "Group"}
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-zinc-200 shadow-xl p-3 z-40 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-2 py-2 border-b border-zinc-100 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <div className="font-semibold text-xs text-zinc-900 truncate">
                  {displayName}
                </div>
                <div className="text-[11px] text-zinc-500 truncate flex items-center gap-1">
                  <GraduationCap className="w-3 h-3 text-zinc-400 shrink-0" />
                  <span>{profile?.course || "DOCSE Student"}</span>
                </div>
              </div>
            </div>
            {user.isAnonymous && (
              <div className="mt-2 text-[10px] bg-amber-50 border border-amber-200 text-amber-800 rounded px-2 py-1 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-amber-600" />
                <span>Guest Account (Local Session)</span>
              </div>
            )}
          </div>

          {/* Classroom Switching */}
          <div className="mb-3 px-1">
            <label className="block text-[11px] font-medium uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1">
              <School className="w-3 h-3" />
              Switch Classroom
            </label>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {availableGroups.map((grp) => (
                <button
                  key={grp}
                  type="button"
                  onClick={() => handleGroupSelect(grp)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between ${
                    profile?.academic_group === grp
                      ? "bg-zinc-900 text-white font-medium"
                      : "text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  <span>{grp}</span>
                  {profile?.academic_group === grp && (
                    <span className="text-[10px] font-normal opacity-80">Active</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-zinc-100">
            <button
              onClick={handleSignOut}
              type="button"
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
