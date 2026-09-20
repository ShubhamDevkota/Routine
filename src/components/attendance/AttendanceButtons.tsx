"use client";

import { useState, useEffect } from "react";
import { Check, X, ShieldAlert } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { saveLocalAttendanceRecord } from "@/lib/attendance";

interface AttendanceButtonsProps {
  userId: string | null;
  classInstanceId: string | null;
  classDate?: string;
  subjectName?: string;
  initialStatus?: "present" | "absent" | "excused" | null;
  onStatusChange?: (status: "present" | "absent" | "excused") => void;
  onRequireAuth?: () => void;
}

export default function AttendanceButtons({
  userId,
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

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const handleSelect = async (newStatus: "present" | "absent" | "excused") => {
    const effectiveUserId = userId || "guest";
    const instanceKey = classInstanceId || `instance_${subjectName}_${classDate || ""}`;

    setStatus(newStatus);
    if (onStatusChange) onStatusChange(newStatus);

    // Save to local storage for offline / local support
    saveLocalAttendanceRecord(
      effectiveUserId,
      instanceKey,
      subjectName,
      newStatus,
      classDate
    );

    // If logged in with real Supabase user, attempt remote write
    if (
      userId &&
      userId !== "guest" &&
      !userId.startsWith("local-") &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR_SUPABASE_PROJECT_ID")
    ) {
      try {
        setLoading(true);
        await supabase.from("attendance_records").upsert(
          {
            user_id: userId,
            class_instance_id: instanceKey,
            status: newStatus,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,class_instance_id" }
        );
      } catch (err) {
        console.debug("Supabase attendance write offline:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
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
  );
}
