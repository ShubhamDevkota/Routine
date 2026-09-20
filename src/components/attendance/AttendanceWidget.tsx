"use client";

import { useEffect, useState, useMemo } from "react";
import {
  getUserSubjectAttendance,
  SubjectAttendanceStat,
} from "@/lib/attendance";
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  TrendingUp,
  CloudOff,
} from "lucide-react";

interface AttendanceWidgetProps {
  userId: string | null;
  academicGroup?: string;
  refreshKey?: number;
  onOpenAuth?: () => void;
}

export default function AttendanceWidget({
  userId,
  academicGroup,
  refreshKey = 0,
  onOpenAuth,
}: AttendanceWidgetProps) {
  const [stats, setStats] = useState<SubjectAttendanceStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getUserSubjectAttendance(userId, academicGroup)
      .then((data) => {
        if (isMounted) {
          setStats(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, academicGroup, refreshKey]);

  // Overall attendance calculations
  const overallMetrics = useMemo(() => {
    if (!stats || stats.length === 0) {
      return { total: 0, attended: 0, percentage: 100, safe: true };
    }
    const total = stats.reduce((acc, curr) => acc + curr.total_classes, 0);
    const attended = stats.reduce((acc, curr) => acc + curr.attended_classes, 0);
    const percentage =
      total > 0 ? Math.round((attended / total) * 100 * 10) / 10 : 100;
    return {
      total,
      attended,
      percentage,
      safe: percentage >= 80,
    };
  }, [stats]);

  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6 shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all">
      {/* Header Bar */}
      <div
        className={`flex items-center justify-between ${
          isExpanded ? "pb-3 border-b border-zinc-100" : ""
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl text-white ${
              overallMetrics.safe ? "bg-emerald-600" : "bg-rose-600"
            }`}
          >
            {overallMetrics.safe ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-zinc-900 tracking-tight">
                80% Attendance Health Dashboard
              </h3>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  overallMetrics.safe
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-rose-50 text-rose-700 border border-rose-200 animate-pulse"
                }`}
              >
                {overallMetrics.percentage}% Overall
              </span>

              {!userId && (
                <button
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200 transition-colors"
                  title="Tracking in offline / local storage mode. Click to sign in and sync."
                >
                  <CloudOff className="w-3 h-3 text-zinc-400" />
                  <span>Local Mode</span>
                  <span className="text-zinc-400 font-normal">&bull; Sync</span>
                </button>
              )}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">
              {stats.length === 0
                ? "Mark classes as Present or Absent below to track your mandatory 80% criteria in real time."
                : overallMetrics.safe
                ? "You are maintaining the mandatory 80% university attendance threshold."
                : "Warning: Your overall attendance is below the required 80% criterion."}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          aria-label="Toggle Attendance Widget"
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="pt-4">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl animate-pulse space-y-2"
                >
                  <div className="h-3 bg-zinc-200 rounded w-1/3" />
                  <div className="h-2 bg-zinc-200 rounded w-full" />
                </div>
              ))}
            </div>
          ) : stats.length === 0 ? (
            <div className="text-center py-6 px-4 bg-zinc-50 border border-dashed border-zinc-200 rounded-xl text-zinc-500">
              <TrendingUp className="w-6 h-6 text-zinc-400 mx-auto mb-2" />
              <div className="text-xs font-medium text-zinc-700">
                No Attendance Records Recorded Yet
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Mark your daily class status (Present / Absent) below to view subject analytics and skip allowances.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {stats.map((stat) => {
                const isSafe = stat.attendance_percentage >= 80;
                return (
                  <div
                    key={stat.subject_name}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isSafe
                        ? "bg-zinc-50/70 border-zinc-200 hover:border-zinc-300"
                        : "bg-rose-50/40 border-rose-200 hover:border-rose-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="overflow-hidden">
                        <div className="text-xs font-semibold text-zinc-900 truncate">
                          {stat.subject_name}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono">
                          {stat.attended_classes} / {stat.total_classes} attended
                        </div>
                      </div>

                      <span
                        className={`text-xs font-bold font-mono px-2 py-0.5 rounded-md ${
                          isSafe
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {stat.attendance_percentage}%
                      </span>
                    </div>

                    {/* Progress Bar with 80% Mark */}
                    <div className="relative w-full h-2 bg-zinc-200 rounded-full overflow-hidden mb-2">
                      <div
                        className={`h-full transition-all duration-500 rounded-full ${
                          isSafe ? "bg-emerald-600" : "bg-rose-600"
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(0, stat.attendance_percentage))}%`,
                        }}
                      />
                      {/* 80% Threshold indicator line */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-zinc-900/40 z-10"
                        style={{ left: "80%" }}
                        title="80% Threshold"
                      />
                    </div>

                    {/* Dynamic Action Allowance */}
                    <div className="text-[11px] pt-1 flex items-center justify-between">
                      {isSafe ? (
                        <span className="text-emerald-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            Can skip: <strong>{stat.classes_can_skip}</strong> class
                            {stat.classes_can_skip !== 1 ? "es" : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="text-rose-700 font-medium flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>
                            Attend <strong>{stat.classes_needed_to_catchup}</strong> class
                            {stat.classes_needed_to_catchup !== 1 ? "es" : ""} to recover
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
