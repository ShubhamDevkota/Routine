"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { Profile } from "@/types/database";
import {
  getOrCreateClassInstance,
  getHolidays,
  setHolidayStatus,
} from "@/lib/attendance";
import { migrateLocalDataToSupabase } from "@/lib/migrate-local-data";
import AuthModal from "@/components/auth/AuthModal";
import UserProfileMenu from "@/components/auth/UserProfileMenu";
import AttendanceWidget from "@/components/attendance/AttendanceWidget";
import AttendanceButtons from "@/components/attendance/AttendanceButtons";
import RoutineCalendar from "@/components/calendar/RoutineCalendar";
import ClassChatDrawer from "@/components/chat/ClassChatDrawer";
import NotesAndTasksSection from "@/components/tasks/NotesAndTasksSection";
import {
  Calendar as CalendarIcon,
  Search,
  School,
  Clock,
  MapPin,
  User,
  Sparkles,
  Palmtree,
  CalendarDays,
} from "lucide-react";

interface RoutineSlot {
  subject: string;
  teacher: string;
  room: string;
  startTime: string;
  endTime: string;
  colspan: number;
}

interface DaySchedule {
  day: string;
  slots: RoutineSlot[];
}

interface RoutineApiResponse {
  group: string;
  schedule: DaySchedule[];
  groups: string[];
  error?: string;
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function getDayOfWeekName(dateStr: string): string {
  try {
    const parts = dateStr.split("-").map(Number);
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const map = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return map[d.getDay()] || "Mon";
  } catch {
    return "Mon";
  }
}

export default function SchedulePage() {
  // Auth & Profile State
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email?: string;
    isAnonymous?: boolean;
  } | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [attendanceRefreshKey, setAttendanceRefreshKey] = useState<number>(0);

  // Routine & UI State
  const [selectedGroup, setSelectedGroup] = useState<string>("I CE-I/I A");
  const [groups, setGroups] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>("Mon");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Calendar & Holiday State
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [holidays, setHolidays] = useState<string[]>([]);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState<boolean>(true);

  // Class Instance Map for the selected date & schedule: slotKey -> instanceId
  const [instanceIds, setInstanceIds] = useState<Record<string, string>>({});
  // Attendance records map: instanceId -> status
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, "present" | "absent" | "excused">
  >({});

  // Determine current live day of week
  const todayName = useMemo(() => {
    if (!currentTime) return "Mon";
    const dayIdx = currentTime.getDay();
    const map = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return map[dayIdx] || "Mon";
  }, [currentTime]);

  const isSelectedDateToday = useMemo(() => {
    if (!currentTime) return false;
    const now = currentTime;
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return selectedDate === `${y}-${m}-${d}`;
  }, [selectedDate, currentTime]);

  const selectedDateDayName = useMemo(() => {
    return getDayOfWeekName(selectedDate);
  }, [selectedDate]);

  const isSelectedDateHoliday = holidays.includes(selectedDate);
  const isWeekend = selectedDateDayName === "Sat" || selectedDateDayName === "Sun";

  // Auth state listener
  useEffect(() => {
    async function initAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          setCurrentUser({
            id: session.user.id,
            email: session.user.email,
            isAnonymous: session.user.is_anonymous,
          });

          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (profile) {
            setUserProfile(profile);
            if (profile.academic_group) {
              setSelectedGroup(profile.academic_group);
            }
          }
          return;
        }
      } catch (err) {
        console.debug("Supabase auth session offline, checking local session:", err);
      }

      // Local storage fallback
      if (typeof window !== "undefined") {
        const rawLocal = localStorage.getItem("docse_local_user");
        if (rawLocal) {
          try {
            const localData = JSON.parse(rawLocal);
            if (localData?.userId) {
              setCurrentUser({
                id: localData.userId,
                email: localData.name,
                isAnonymous: true,
              });
              setUserProfile({
                id: localData.userId,
                academic_group: localData.group || "I CE-I/I A",
                course: localData.course || "B.E. Computer Engineering",
                full_name: localData.name || "Student",
              });
              if (localData.group) {
                setSelectedGroup(localData.group);
              }
            }
          } catch {}
        }
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event: string, session: { user: { id: string; email?: string; is_anonymous?: boolean } } | null) => {
        if (session?.user) {
          setCurrentUser({
            id: session.user.id,
            email: session.user.email,
            isAnonymous: session.user.is_anonymous,
          });

          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (profile) {
            setUserProfile(profile);
            if (profile.academic_group) {
              setSelectedGroup(profile.academic_group);
            }
          }
        } else {
          setCurrentUser(null);
          setUserProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Initialize clock and day selection
  useEffect(() => {
    const now = new Date();
    setCurrentTime(now);
    const dayIdx = now.getDay();
    const map = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const currentDay = map[dayIdx];

    if (DAYS_OF_WEEK.includes(currentDay)) {
      setSelectedDay(currentDay);
    } else {
      setSelectedDay("Mon");
    }

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  // Load holidays on mount and when user / group changes
  useEffect(() => {
    let isMounted = true;
    getHolidays(currentUser?.id || null, selectedGroup).then((hList) => {
      if (isMounted) setHolidays(hList);
    });

    return () => {
      isMounted = false;
    };
  }, [currentUser, selectedGroup, attendanceRefreshKey]);

  // Fetch routine whenever selectedGroup changes
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    async function loadRoutine() {
      try {
        const res = await fetch(
          `/api/routine?group=${encodeURIComponent(selectedGroup)}`
        );
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const data: RoutineApiResponse = await res.json();
        if (isMounted) {
          if (data.error) {
            setError(data.error);
          } else {
            setSchedule(data.schedule || []);
            if (data.groups && data.groups.length > 0) {
              setGroups(data.groups);
              if (!data.groups.includes(selectedGroup) && data.group) {
                setSelectedGroup(data.group);
              }
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load schedule"
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadRoutine();

    return () => {
      isMounted = false;
    };
  }, [selectedGroup]);

  // Load or ensure Class Instances for the selected calendar date
  useEffect(() => {
    if (!schedule || schedule.length === 0) return;

    let isMounted = true;

    async function syncInstances() {
      const newInstanceMap: Record<string, string> = {};

      for (const dayItem of schedule) {
        for (const slot of dayItem.slots) {
          const key = `${selectedGroup}-${dayItem.day}-${slot.startTime}-${slot.room}`;
          const instanceId = await getOrCreateClassInstance(
            selectedGroup,
            dayItem.day,
            slot.startTime,
            slot.room,
            selectedDate,
            slot.subject
          );
          if (instanceId && isMounted) {
            newInstanceMap[key] = instanceId;
          }
        }
      }

      if (isMounted) {
        setInstanceIds(newInstanceMap);
      }
    }

    syncInstances();

    return () => {
      isMounted = false;
    };
  }, [schedule, selectedGroup, selectedDate]);

  // Load current user's attendance records for known instances
  useEffect(() => {
    if (Object.keys(instanceIds).length === 0) return;

    let isMounted = true;
    const effectiveUserId = currentUser?.id || "guest";

    async function loadAttendance() {
      const ids = Object.values(instanceIds);
      if (ids.length === 0) return;

      if (
        currentUser?.id &&
        currentUser.id !== "guest" &&
        !currentUser.id.startsWith("local-")
      ) {
        try {
          const { data, error } = await supabase
            .from("attendance_records")
            .select("class_instance_id, status")
            .eq("user_id", currentUser.id)
            .in("class_instance_id", ids);

          if (!error && data && data.length > 0 && isMounted) {
            const map: Record<string, "present" | "absent" | "excused"> = {};
            data.forEach((rec: { class_instance_id: string; status: string }) => {
              map[rec.class_instance_id] = rec.status as "present" | "absent" | "excused";
            });
            setAttendanceMap(map);
            return;
          }
        } catch (err) {
          console.debug("Supabase attendance fetch offline:", err);
        }
      }

      // Local storage fallback (used for guest, offline, or non-synced items)
      if (typeof window !== "undefined" && isMounted) {
        const raw = localStorage.getItem(`docse_att_${effectiveUserId}`);
        if (raw) {
          try {
            const list = JSON.parse(raw);
            const map: Record<string, "present" | "absent" | "excused"> = {};
            list.forEach((item: { instanceId: string; status: "present" | "absent" | "excused" }) => {
              map[item.instanceId] = item.status;
            });
            setAttendanceMap(map);
          } catch {}
        }
      }
    }

    loadAttendance();

    return () => {
      isMounted = false;
    };
  }, [currentUser, instanceIds, attendanceRefreshKey]);

  // Handle holiday toggle on calendar
  const handleToggleHoliday = async (date: string, isHoliday: boolean) => {
    await setHolidayStatus(currentUser?.id || null, date, isHoliday, selectedGroup);
    setHolidays((prev) =>
      isHoliday ? (prev.includes(date) ? prev : [...prev, date]) : prev.filter((d) => d !== date)
    );
    setAttendanceRefreshKey((k) => k + 1);
  };

  // Helper to check if a slot is currently ongoing
  const isSlotOngoing = useCallback(
    (day: string, startTime: string, endTime: string): boolean => {
      if (!currentTime || !isSelectedDateToday) return false;
      if (day !== todayName) return false;

      const currentHours = currentTime.getHours();
      const currentMinutes = currentTime.getMinutes();
      const currentTotalMinutes = currentHours * 60 + currentMinutes;

      const [startH, startM] = startTime.split(":").map(Number);
      const [endH, endM] = endTime.split(":").map(Number);

      const startTotal = startH * 60 + startM;
      const endTotal = endH * 60 + endM;

      return currentTotalMinutes >= startTotal && currentTotalMinutes < endTotal;
    },
    [currentTime, isSelectedDateToday, todayName]
  );

  // Helper to check if a slot is upcoming today
  const isSlotUpcomingToday = useCallback(
    (day: string, startTime: string): boolean => {
      if (!currentTime || !isSelectedDateToday) return false;
      if (day !== todayName) return false;

      const currentHours = currentTime.getHours();
      const currentMinutes = currentTime.getMinutes();
      const currentTotalMinutes = currentHours * 60 + currentMinutes;

      const [startH, startM] = startTime.split(":").map(Number);
      const startTotal = startH * 60 + startM;

      return startTotal > currentTotalMinutes;
    },
    [currentTime, isSelectedDateToday, todayName]
  );

  // Filter schedule by selected day and search query
  const filteredSchedule = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return schedule
      .filter((dayItem) => {
        if (selectedDay === "All") return true;
        return dayItem.day === selectedDay;
      })
      .map((dayItem) => {
        if (!q) return dayItem;
        const matchedSlots = dayItem.slots.filter((slot) => {
          return (
            slot.subject.toLowerCase().includes(q) ||
            slot.teacher.toLowerCase().includes(q) ||
            slot.room.toLowerCase().includes(q) ||
            slot.startTime.includes(q) ||
            slot.endTime.includes(q)
          );
        });
        return {
          ...dayItem,
          slots: matchedSlots,
        };
      });
  }, [schedule, selectedDay, searchQuery]);

  // Extract unique subjects for tasks dropdown
  const allSubjects = useMemo(() => {
    const set = new Set<string>();
    schedule.forEach((day) =>
      day.slots.forEach((s) => {
        if (s.subject) set.add(s.subject);
      })
    );
    return Array.from(set);
  }, [schedule]);

  // Summary counts
  const totalClassesFound = useMemo(() => {
    return filteredSchedule.reduce((acc, curr) => acc + curr.slots.length, 0);
  }, [filteredSchedule]);

  const ongoingClass = useMemo(() => {
    if (!currentTime || !isSelectedDateToday) return null;
    for (const dayItem of schedule) {
      if (dayItem.day === todayName) {
        for (const slot of dayItem.slots) {
          if (isSlotOngoing(dayItem.day, slot.startTime, slot.endTime)) {
            return { ...slot, day: dayItem.day };
          }
        }
      }
    }
    return null;
  }, [schedule, todayName, currentTime, isSelectedDateToday, isSlotOngoing]);

  const formattedTime = currentTime
    ? currentTime.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : "";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col justify-between">
      {/* Top Navigation Bar */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              KU
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold flex items-center gap-1.5">
                <span>Kathmandu University / DOCSE</span>
              </div>
              <h1 className="text-base font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
                <span>Class Routine & Attendance</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-end sm:self-center">
            {/* Clock & Day */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 border border-zinc-200 font-mono text-xs text-zinc-700">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span className="font-semibold text-zinc-900">{todayName}</span>
              <span>{formattedTime}</span>
            </div>

            {/* User Profile / Sign In */}
            <UserProfileMenu
              user={currentUser}
              profile={userProfile}
              availableGroups={groups}
              onGroupChange={(grp) => setSelectedGroup(grp)}
              onOpenAuth={() => setIsAuthModalOpen(true)}
              onSignOut={() => {
                setCurrentUser(null);
                setUserProfile(null);
              }}
            />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
        {/* 80% Attendance Dashboard Widget - Visible Immediately to All Users */}
        <AttendanceWidget
          userId={currentUser?.id || null}
          academicGroup={selectedGroup}
          refreshKey={attendanceRefreshKey}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />

        {/* Interactive Academic Calendar & Holiday Marking */}
        {isCalendarExpanded && (
          <RoutineCalendar
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              const dow = getDayOfWeekName(date);
              if (DAYS_OF_WEEK.includes(dow)) {
                setSelectedDay(dow);
              } else {
                setSelectedDay("Mon");
              }
            }}
            holidays={holidays}
            onToggleHoliday={handleToggleHoliday}
          />
        )}

        {/* Notes & Tasks Module */}
        <NotesAndTasksSection
          userId={currentUser?.id || null}
          academicGroup={selectedGroup}
          subjects={allSubjects}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />

        {/* Controls Bar */}
        <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Group Selection */}
            <div className="md:col-span-6">
              <label
                htmlFor="group-select"
                className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1.5 flex items-center gap-1.5"
              >
                <School className="w-3.5 h-3.5" />
                Academic Group / Classroom
              </label>
              <div className="relative">
                <select
                  id="group-select"
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-300 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
                >
                  {groups.length > 0 ? (
                    groups.map((grp) => (
                      <option key={grp} value={grp}>
                        {grp}
                      </option>
                    ))
                  ) : (
                    <option value={selectedGroup}>{selectedGroup}</option>
                  )}
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="md:col-span-6">
              <label
                htmlFor="search-input"
                className="block text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-1.5 flex items-center gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                Filter by Room, Faculty, or Subject
              </label>
              <div className="relative">
                <input
                  id="search-input"
                  type="text"
                  placeholder="e.g. 9-404, Mr. Manoj Pandey, MATH 101..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-xl px-3.5 py-2.5 text-sm font-normal text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-900 px-2 py-1 uppercase tracking-wider font-semibold"
                    type="button"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Day Navigation Tabs */}
          <div className="mt-5 pt-4 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold mr-1 hidden sm:inline flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5" />
                Day:
              </span>
              <button
                onClick={() => setSelectedDay("All")}
                type="button"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  selectedDay === "All"
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                All Days
              </button>

              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDay === day;
                const isToday = day === todayName && isSelectedDateToday;
                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    type="button"
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors relative ${
                      isSelected
                        ? "bg-zinc-900 text-white shadow-xs"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                    }`}
                  >
                    {day}
                    {isToday && (
                      <span
                        className={`ml-1.5 text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded font-bold ${
                          isSelected
                            ? "bg-zinc-700 text-zinc-100"
                            : "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        Today
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Calendar toggle button */}
            <button
              type="button"
              onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium transition-colors"
            >
              <CalendarDays className="w-3.5 h-3.5 text-zinc-500" />
              <span>{isCalendarExpanded ? "Hide Calendar" : "Show Calendar"}</span>
            </button>
          </div>
        </section>

        {/* Holiday Banner for Selected Date */}
        {isSelectedDateHoliday && (
          <section className="mb-6 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-xs animate-in fade-in duration-200">
            <div className="p-2 rounded-xl bg-amber-200 text-amber-900 shrink-0">
              <Palmtree className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-amber-950 tracking-tight">
                  University Holiday &bull; Classes Suspended
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 uppercase tracking-wider">
                  {selectedDate}
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-1 max-w-2xl">
                This date is marked as a holiday. Classes on this date are automatically excluded from your 80% total attendance calculation.
              </p>
            </div>
          </section>
        )}

        {/* Live Ongoing Class Banner */}
        {ongoingClass && !isSelectedDateHoliday && (
          <section className="mb-6 bg-zinc-900 text-zinc-100 rounded-2xl p-5 border border-zinc-800 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    Ongoing Now
                  </span>
                  <span className="text-xs text-zinc-300 font-mono">
                    {ongoingClass.startTime} - {ongoingClass.endTime}
                  </span>
                </div>
                <div className="text-lg font-bold text-white tracking-tight">
                  {ongoingClass.subject}
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-col sm:items-end gap-x-4 gap-y-1 text-xs text-zinc-300">
                <div className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-zinc-400 uppercase tracking-wider text-[10px]">
                    Room:
                  </span>
                  <span className="font-mono text-white font-semibold">
                    {ongoingClass.room}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-zinc-400 uppercase tracking-wider text-[10px]">
                    Faculty:
                  </span>
                  <span>{ongoingClass.teacher}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Weekend Note */}
        {isWeekend && selectedDay !== "All" && (
          <div className="mb-4 text-xs text-zinc-600 bg-zinc-100/80 border border-zinc-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-zinc-500" />
            <span>
              Selected date is on a <strong>{selectedDateDayName}</strong> (Weekend). Showing {selectedDay}&apos;s schedule.
            </span>
          </div>
        )}

        {/* Status / Count bar */}
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-3 px-1">
          <div>
            Showing <span className="font-semibold text-zinc-900">{totalClassesFound}</span> session{totalClassesFound !== 1 ? "s" : ""} for{" "}
            <span className="font-semibold text-zinc-900">{selectedGroup}</span> on{" "}
            <span className="font-semibold text-zinc-900">{selectedDate} ({selectedDay})</span>
            {searchQuery ? ` matching "${searchQuery}"` : ""}
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-zinc-700 hover:underline uppercase tracking-wider font-semibold"
              type="button"
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-zinc-200 rounded-2xl p-5 animate-pulse"
              >
                <div className="h-4 bg-zinc-200 rounded w-1/4 mb-3" />
                <div className="h-3 bg-zinc-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-zinc-100 rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="bg-white border border-zinc-300 rounded-2xl p-8 text-center shadow-xs">
            <div className="text-sm font-semibold text-zinc-800 mb-1">
              Unable to Load Schedule
            </div>
            <div className="text-xs text-zinc-500 mb-4">{error}</div>
            <button
              onClick={() => setSelectedGroup((g) => `${g}`)}
              className="px-4 py-2 bg-zinc-900 text-white text-xs font-semibold rounded-xl hover:bg-zinc-800 transition-colors"
              type="button"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Schedule List */}
        {!isLoading && !error && (
          <div className="space-y-8">
            {filteredSchedule.length === 0 || totalClassesFound === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center text-zinc-500">
                <div className="text-sm font-semibold text-zinc-800 mb-1">
                  No Classes Found
                </div>
                <div className="text-xs text-zinc-500">
                  {searchQuery
                    ? "No sessions match the current search query."
                    : "No scheduled sessions for this selection."}
                </div>
              </div>
            ) : (
              filteredSchedule.map((daySchedule) => {
                if (daySchedule.slots.length === 0) {
                  return (
                    <div
                      key={daySchedule.day}
                      className="bg-white border border-zinc-200 rounded-xl p-4 text-xs text-zinc-400"
                    >
                      <span className="font-semibold text-zinc-700 mr-2">
                        {daySchedule.day}:
                      </span>
                      No classes scheduled.
                    </div>
                  );
                }

                const isDayToday = daySchedule.day === todayName && isSelectedDateToday;

                return (
                  <section
                    key={daySchedule.day}
                    className="space-y-3"
                    id={`day-${daySchedule.day}`}
                  >
                    {/* Day Section Header */}
                    <div className="flex items-center justify-between pb-1.5 border-b border-zinc-200">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold text-zinc-900 tracking-tight">
                          {daySchedule.day}
                        </h2>
                        {isDayToday && (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-800 font-bold">
                            Today
                          </span>
                        )}
                        {isSelectedDateHoliday && (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                            Holiday
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400 font-medium">
                        {daySchedule.slots.length} class
                        {daySchedule.slots.length > 1 ? "es" : ""}
                      </span>
                    </div>

                    {/* Class Cards */}
                    <div className="grid grid-cols-1 gap-3.5">
                      {daySchedule.slots.map((slot, idx) => {
                        const slotKey = `${selectedGroup}-${daySchedule.day}-${slot.startTime}-${slot.room}`;
                        const instanceId = instanceIds[slotKey] || null;
                        const ongoing = isSlotOngoing(
                          daySchedule.day,
                          slot.startTime,
                          slot.endTime
                        );
                        const upcoming = isSlotUpcomingToday(
                          daySchedule.day,
                          slot.startTime
                        );
                        const currentAttendanceStatus = instanceId
                          ? attendanceMap[instanceId]
                          : null;

                        return (
                          <div
                            key={`${slotKey}-${idx}`}
                            className={`bg-white border rounded-2xl p-4 sm:p-5 transition-all ${
                              isSelectedDateHoliday
                                ? "border-amber-200/80 bg-amber-50/20"
                                : ongoing
                                ? "border-zinc-900 ring-2 ring-zinc-900 shadow-md"
                                : "border-zinc-200 hover:border-zinc-300 shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                              {/* Subject & Timing */}
                              <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-base font-bold text-zinc-900">
                                    {slot.subject}
                                  </span>

                                  {isSelectedDateHoliday && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                                      Holiday / Excluded
                                    </span>
                                  )}

                                  {!isSelectedDateHoliday && ongoing && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-900 text-white">
                                      Ongoing
                                    </span>
                                  )}

                                  {!isSelectedDateHoliday && !ongoing && isDayToday && upcoming && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
                                      Upcoming
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs text-zinc-500 font-mono flex items-center gap-2">
                                  <span>
                                    {slot.startTime} - {slot.endTime}
                                  </span>
                                  <span className="text-zinc-400 font-sans text-[11px]">
                                    ({slot.colspan}h duration)
                                  </span>
                                </div>
                              </div>

                              {/* Attendance Action & Room Badge */}
                              <div className="flex flex-wrap sm:flex-col sm:items-end gap-2">
                                <span className="inline-block text-xs font-mono font-semibold px-2.5 py-1 bg-zinc-100 text-zinc-800 border border-zinc-200 rounded-lg">
                                  Room: {slot.room}
                                </span>

                                {/* Interactive Attendance Controls */}
                                <AttendanceButtons
                                  userId={currentUser?.id || null}
                                  academicGroup={selectedGroup}
                                  dayOfWeek={daySchedule.day}
                                  startTime={slot.startTime}
                                  room={slot.room}
                                  classInstanceId={instanceId}
                                  classDate={selectedDate}
                                  subjectName={slot.subject}
                                  initialStatus={currentAttendanceStatus}
                                  onStatusChange={(newStatus, resolvedInstanceId) => {
                                    const effectiveId = resolvedInstanceId || instanceId;
                                    if (effectiveId) {
                                      setAttendanceMap((prev) => ({
                                        ...prev,
                                        [effectiveId]: newStatus,
                                      }));
                                      if (resolvedInstanceId && resolvedInstanceId !== instanceId) {
                                        setInstanceIds((prev) => ({
                                          ...prev,
                                          [slotKey]: resolvedInstanceId,
                                        }));
                                      }
                                      setAttendanceRefreshKey((k) => k + 1);
                                    }
                                  }}
                                  onRequireAuth={() => setIsAuthModalOpen(true)}
                                />
                              </div>
                            </div>

                            {/* Faculty & Discussion Row */}
                            <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-600 gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="text-zinc-400 uppercase tracking-wider text-[10px] font-semibold">
                                  Faculty:
                                </span>
                                <span className="font-semibold text-zinc-800">
                                  {slot.teacher}
                                </span>
                              </div>

                              {/* Realtime Chat Drawer Trigger */}
                              <ClassChatDrawer
                                classInstanceId={instanceId}
                                scheduleKey={slotKey}
                                subjectName={slot.subject}
                                roomName={slot.room}
                                userId={currentUser?.id || null}
                                userName={userProfile?.full_name || currentUser?.email?.split("@")[0] || "Student"}
                                academicGroup={selectedGroup}
                                onOpenAuth={() => setIsAuthModalOpen(true)}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Auth & Onboarding Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        availableGroups={groups}
        currentGroup={selectedGroup}
        onSuccess={async (data) => {
          // CRITICAL: Set currentUser immediately with the real Supabase user ID
          // so all downstream components use the correct ID for data operations
          const isRealUser = data.userId && data.userId !== "guest" && !data.userId.startsWith("local-");
          setCurrentUser({
            id: data.userId,
            email: data.name || undefined,
            isAnonymous: !isRealUser,
          });
          setSelectedGroup(data.group);
          setUserProfile({
            id: data.userId,
            academic_group: data.group,
            course: data.course,
            full_name: data.name || null,
          });
          setAttendanceRefreshKey((k) => k + 1);

          // Migrate local/guest data to Supabase for real authenticated users
          if (isRealUser) {
            try {
              const migrationResult = await migrateLocalDataToSupabase(data.userId);
              if (migrationResult.attendanceMigrated > 0 || migrationResult.notesMigrated > 0) {
                // Refresh attendance display after migration
                setAttendanceRefreshKey((k) => k + 1);
              }
              if (migrationResult.errors.length > 0) {
                console.warn("Some local data failed to migrate:", migrationResult.errors);
              }
            } catch (err) {
              console.error("Local data migration failed:", err);
            }
          }
        }}
      />

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-2">
          <div>
            Kathmandu University &bull; Department of Computer Science & Engineering (DOCSE)
          </div>
          <div className="font-mono text-zinc-400">
            Powered by DOCSE Routine Parser & Supabase
          </div>
        </div>
      </footer>
    </div>
  );
}
