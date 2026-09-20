"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { LogIn, UserPlus, Sparkles, AlertCircle, X, GraduationCap, School, User, Lock } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableGroups: string[];
  currentGroup?: string;
  onSuccess: (userData: { userId: string; group: string; course: string; name?: string }) => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  availableGroups,
  currentGroup = "I CE-I/I A",
  onSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "guest">("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [academicGroup, setAcademicGroup] = useState(currentGroup);
  const [course, setCourse] = useState("B.E. Computer Engineering");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOfflineMode = () => {
    const localId = `local-${Date.now()}`;
    const cleanUser = username.trim() || "student";
    const localData = {
      userId: localId,
      group: academicGroup,
      course: course,
      name: fullName || cleanUser || (mode === "guest" ? "Guest Student" : "Student"),
    };
    if (typeof window !== "undefined") {
      localStorage.setItem("docse_local_user", JSON.stringify(localData));
    }
    onSuccess(localData);
    onClose();
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // Check if Supabase URL is placeholder
    const isPlaceholderUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR_SUPABASE_PROJECT_ID") ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

    if (isPlaceholderUrl) {
      // Proceed directly in local offline mode
      handleOfflineMode();
      setLoading(false);
      return;
    }

    const rawInput = username.trim().toLowerCase();
    let authEmail: string;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

    if (emailRegex.test(rawInput)) {
      authEmail = rawInput;
    } else {
      // Strip domain/invalid chars and map safely to @docse.com (valid standard TLD)
      const cleanLocal = rawInput.replace(/@.*$/, "").replace(/[^a-z0-9._-]/g, "") || "student";
      authEmail = `${cleanLocal}@docse.com`;
    }

    const displayNameFromInput = fullName || rawInput.replace(/@.*$/, "") || "Student";

    try {
      if (mode === "guest") {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        if (data.user) {
          await supabase.from("profiles").upsert({
            id: data.user.id,
            academic_group: academicGroup,
            course: course,
            full_name: fullName || "Guest Student",
            updated_at: new Date().toISOString(),
          });
          onSuccess({
            userId: data.user.id,
            group: academicGroup,
            course: course,
            name: fullName || "Guest Student",
          });
          onClose();
        }
      } else if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        });
        if (error) throw error;
        if (data.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", data.user.id)
            .single();

          const targetGroup = profile?.academic_group || academicGroup;
          const targetCourse = profile?.course || course;
          const targetName = profile?.full_name || displayNameFromInput;

          if (!profile) {
            await supabase.from("profiles").upsert({
              id: data.user.id,
              academic_group: targetGroup,
              course: targetCourse,
              full_name: targetName,
              updated_at: new Date().toISOString(),
            });
          }

          onSuccess({
            userId: data.user.id,
            group: targetGroup,
            course: targetCourse,
            name: targetName,
          });
          onClose();
        }
      } else if (mode === "signup") {
        // 1. Call server API to create pre-confirmed user (bypasses email sending & rate limits)
        let serverCreated = false;
        try {
          const res = await fetch("/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: authEmail,
              password,
              fullName: displayNameFromInput,
              username: rawInput.replace(/@.*$/, ""),
              academicGroup,
              course,
            }),
          });
          const resData = await res.json();
          if (res.ok && resData.success) {
            serverCreated = true;
          }
        } catch {
          // Server endpoint fallback
        }

        // 2. Sign in with the created credentials
        const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        });

        if (!signInErr && signInData.user) {
          await supabase.from("profiles").upsert({
            id: signInData.user.id,
            academic_group: academicGroup,
            course: course,
            full_name: displayNameFromInput,
            updated_at: new Date().toISOString(),
          });
          onSuccess({
            userId: signInData.user.id,
            group: academicGroup,
            course: course,
            name: displayNameFromInput,
          });
          onClose();
          return;
        }

        // 3. If direct signin didn't work and server couldn't create, fallback to client signUp
        if (!serverCreated) {
          const { data, error } = await supabase.auth.signUp({
            email: authEmail,
            password,
            options: {
              data: {
                full_name: displayNameFromInput,
                username: rawInput.replace(/@.*$/, ""),
                academic_group: academicGroup,
                course: course,
              },
            },
          });

          if (error) throw error;
          if (data.user) {
            await supabase.from("profiles").upsert({
              id: data.user.id,
              academic_group: academicGroup,
              course: course,
              full_name: displayNameFromInput,
              updated_at: new Date().toISOString(),
            });
            onSuccess({
              userId: data.user.id,
              group: academicGroup,
              course: course,
              name: displayNameFromInput,
            });
            onClose();
          }
        } else if (signInErr) {
          throw signInErr;
        }
      }
    } catch (err: unknown) {
      console.error("Auth error:", err);
      const message = err instanceof Error ? err.message : "Authentication failed";
      if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
        setErrorMsg("Supabase connection offline. You can click below to continue in Local Offline Mode.");
      } else if (message.toLowerCase().includes("invalid login credentials")) {
        setErrorMsg("Incorrect username or password. If you haven't created this account yet, please use the Sign Up tab.");
      } else {
        setErrorMsg(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-zinc-100 flex items-start justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-xs font-medium mb-2">
              <Sparkles className="w-3.5 h-3.5 text-zinc-900" />
              <span>DOCSE Routine Gate</span>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
              {mode === "signin"
                ? "Sign in to your Routine"
                : mode === "signup"
                ? "Create your Student Profile"
                : "Continue as Guest"}
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              Personalized schedules, 80% attendance alerts & class notes.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-100 rounded-xl text-xs font-medium text-zinc-600">
            <button
              type="button"
              onClick={() => {
                setMode("signin");
                setErrorMsg(null);
              }}
              className={`py-1.5 rounded-lg transition-all ${
                mode === "signin"
                  ? "bg-white text-zinc-900 shadow-sm font-semibold"
                  : "hover:text-zinc-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setErrorMsg(null);
              }}
              className={`py-1.5 rounded-lg transition-all ${
                mode === "signup"
                  ? "bg-white text-zinc-900 shadow-sm font-semibold"
                  : "hover:text-zinc-900"
              }`}
            >
              Sign Up
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("guest");
                setErrorMsg(null);
              }}
              className={`py-1.5 rounded-lg transition-all ${
                mode === "guest"
                  ? "bg-white text-zinc-900 shadow-sm font-semibold"
                  : "hover:text-zinc-900"
              }`}
            >
              Guest Access
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleAuthSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
              <button
                type="button"
                onClick={handleOfflineMode}
                className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-xs"
              >
                Continue in Local Offline Mode
              </button>
            </div>
          )}

          {/* Full Name & Group (Shown for signup and guest) */}
          {(mode === "signup" || mode === "guest") && (
            <div className="space-y-3 p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                  required={mode === "signup"}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1 flex items-center gap-1.5">
                  <School className="w-3.5 h-3.5 text-zinc-500" />
                  Classroom / Academic Group
                </label>
                <select
                  value={academicGroup}
                  onChange={(e) => setAcademicGroup(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-xs font-medium text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                  required
                >
                  {availableGroups.length > 0 ? (
                    availableGroups.map((grp) => (
                      <option key={grp} value={grp}>
                        {grp}
                      </option>
                    ))
                  ) : (
                    <option value="I CE-I/I A">I CE-I/I A</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-zinc-500" />
                  Course / Major
                </label>
                <input
                  type="text"
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                  placeholder="e.g. B.E. Computer Engineering"
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                  required
                />
              </div>
            </div>
          )}

          {/* Username & Password (Shown for Sign In and Sign Up) */}
          {mode !== "guest" && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-500" />
                  Username or Email
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. shubham, john, or you@example.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-zinc-500" />
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-xs text-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
                  required
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-md transition-all mt-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : mode === "signin" ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </>
            ) : mode === "signup" ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Profile & Enter</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Start Guest Session</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
