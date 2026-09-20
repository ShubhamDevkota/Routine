"use client";

import { useState, useEffect } from "react";
import { Check, X, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { saveLocalAttendanceRecord } from "@/lib/attendance";

interface AttendanceButtonsProps {
  userId: string | null;
  academicGroup?: string;
  dayOfWeek?: string;
  startTime?: string;
  room?: string;
  classInstanceId: string | null;
  classDate?: string;
  subjectName?: string;
  initialStatus?: "present" | "absent" | "excused" | null;
  onStatusChange?: (status: "present" | "absent" | "excused", resolvedInstanceId?: string) => void;
  onRequireAuth?: () => void;
}

export default function AttendanceButtons({
  userId,
  academicGroup,
  dayOfWeek,
  startTime,
  room,
  classInstanceId,
  classDate,
  subjectName = "General",
  initialStatus = null,
  onStatusChange,
}: AttendanceButtonsProps) {
  const [status, setStatus] = useState<"present" | "absent" | "excused" | null>(
    initialStatus
  );
  const [, setLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const handleSelect = async (newStatus: "present" | "absent" | "excused") => {
    const effectiveUserId = userId || "guest";
    const instanceKey = classInstanceId || `instance_${subjectName}_${classDate || ""}`;

    setStatus(newStatus);
    setSyncError(null);
    if (onStatusChange) onStatusChange(newStatus, classInstanceId || undefined);

    // Save to local storage for offline / local support
    saveLocalAttendanceRecord(
      effectiveUserId,
      instanceKey,
      subjectName,
      newStatus,
      classDate
    );

    // If logged in with real Supabase user, sync via server API route
    if (
      userId &&
      userId !== "guest" &&
      !userId.startsWith("local-")
    ) {
      try {
        setLoading(true);
        const res = await fetch("/api/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            academicGroup,
            dayOfWeek,
            startTime,
            room,
            classDate,
            subjectName,
            status: newStatus,
            classInstanceId,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to sync attendance");
        }

        // Successfully synced to cloud
        setSyncError(null);
        if (data.class_instance_id && onStatusChange) {
          onStatusChange(newStatus, data.class_instance_id);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        console.error("Supabase attendance write error:", msg);
        setSyncError(`Sync error: ${msg}`);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="inline-flex items-center gap-1 p-1 bg-zinc-100/90 rounded-lg border border-zinc-200 text-xs">
        <button
          type="button"
          onClick={() => handleSelect("present")}
          title="Mark Present"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
            status === "present"
              ? "bg-emerald-600 text-white shadow-xs font-semibold"
              : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60"
          }`}
        >
          <Check className="w-3.5 h-3.5" />
          <span>Present</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelect("absent")}
          title="Mark Absent"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-all ${
            status === "absent"
              ? "bg-rose-600 text-white shadow-xs font-semibold"
              : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60"
          }`}
        >
          <X className="w-3.5 h-3.5" />
          <span>Absent</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelect("excused")}
          title="Mark Excused"
          className={`flex items-center gap-1 px-2 py-1 rounded-md font-medium transition-all ${
            status === "excused"
              ? "bg-amber-600 text-white shadow-xs font-semibold"
              : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60"
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Excused</span>
        </button>
      </div>
      {syncError && (
        <div className="text-[10px] text-rose-600 font-medium px-1" title={syncError}>
          ⚠ Saved locally only (cloud sync failed)
        </div>
      )}
    </div>
  );
}
