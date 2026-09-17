"use client";

import { useEffect, useState, useMemo } from "react";

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

export default function SchedulePage() {
  const [selectedGroup, setSelectedGroup] = useState<string>("I CE-I/I A");
  const [groups, setGroups] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<DaySchedule[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  // Determine current day of week (Nepal / local)
  const todayName = useMemo(() => {
    if (!currentTime) return "Mon";
    const dayIdx = currentTime.getDay();
    const map = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return map[dayIdx] || "Mon";
  }, [currentTime]);

  const isWeekend = todayName === "Sat" || todayName === "Sun";

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

  // Helper to check if a slot is currently ongoing
  const isSlotOngoing = (day: string, startTime: string, endTime: string): boolean => {
    if (!currentTime) return false;
    if (day !== todayName) return false;

    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    return currentTotalMinutes >= startTotal && currentTotalMinutes < endTotal;
  };

  // Helper to check if a slot is upcoming today
  const isSlotUpcomingToday = (day: string, startTime: string): boolean => {
    if (!currentTime) return false;
    if (day !== todayName) return false;

    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    const [startH, startM] = startTime.split(":").map(Number);
    const startTotal = startH * 60 + startM;

    return startTotal > currentTotalMinutes;
  };

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

  // Summary counts
  const totalClassesFound = useMemo(() => {
    return filteredSchedule.reduce((acc, curr) => acc + curr.slots.length, 0);
  }, [filteredSchedule]);

  const ongoingClass = useMemo(() => {
    if (!currentTime) return null;
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
  }, [schedule, todayName, currentTime]);

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-zinc-500 font-medium">
              Kathmandu University / DOCSE
            </div>
            <h1 className="text-lg font-medium text-zinc-900 tracking-tight">
              Class Routine Schedule
            </h1>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-600">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-100 border border-zinc-200 font-mono">
              <span className="text-zinc-500">{todayName}</span>
              <span>{formattedTime}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex-1">
        {/* Controls Bar */}
        <section className="bg-white border border-zinc-200 rounded-xl p-4 sm:p-5 mb-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Group Selection */}
            <div className="md:col-span-6">
              <label
                htmlFor="group-select"
                className="block text-xs uppercase tracking-wider text-zinc-500 font-medium mb-1.5"
              >
                Academic Group
              </label>
              <div className="relative">
                <select
                  id="group-select"
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full bg-zinc-50 hover:bg-zinc-100/80 border border-zinc-300 rounded-lg px-3.5 py-2.5 text-sm font-medium text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
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
                className="block text-xs uppercase tracking-wider text-zinc-500 font-medium mb-1.5"
              >
                Filter by Room, Teacher, or Subject
              </label>
              <div className="relative">
                <input
                  id="search-input"
                  type="text"
                  placeholder="e.g. 9-404, Mr. Manoj Pandey, MATH 101..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-lg px-3.5 py-2.5 text-sm font-normal text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-900 px-2 py-1 uppercase tracking-wider font-medium"
                    type="button"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Day Navigation Tabs */}
          <div className="mt-5 pt-4 border-t border-zinc-100 flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-xs uppercase tracking-wider text-zinc-400 font-medium mr-1 hidden sm:inline">
              Day:
            </span>
            <button
              onClick={() => setSelectedDay("All")}
              type="button"
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedDay === "All"
                  ? "bg-zinc-900 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              All Days
            </button>

            {DAYS_OF_WEEK.map((day) => {
              const isToday = day === todayName;
              const isSelected = selectedDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  type="button"
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors relative ${
                    isSelected
                      ? "bg-zinc-900 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  {day}
                  {isToday && (
                    <span
                      className={`ml-1.5 text-[10px] uppercase tracking-wider px-1 py-0.2 rounded ${
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
        </section>

        {/* Live Ongoing Class Banner (If Any) */}
        {ongoingClass && (
          <section className="mb-6 bg-zinc-900 text-zinc-100 rounded-xl p-4 sm:p-5 border border-zinc-800 shadow-[0_1px_3px_rgba(0,0,0,0.1)]">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[11px] font-medium tracking-wider uppercase bg-zinc-800 text-zinc-200 border border-zinc-700">
                    Ongoing Now
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">
                    {ongoingClass.startTime} - {ongoingClass.endTime}
                  </span>
                </div>
                <div className="text-base font-medium text-white">
                  {ongoingClass.subject}
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-col sm:items-end gap-x-4 gap-y-1 text-xs text-zinc-300">
                <div>
                  <span className="text-zinc-500 uppercase tracking-wider text-[10px] mr-1">
                    Room:
                  </span>
                  <span className="font-mono text-white">
                    {ongoingClass.room}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 uppercase tracking-wider text-[10px] mr-1">
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
          <div className="mb-4 text-xs text-zinc-500 bg-zinc-100/80 border border-zinc-200 rounded-lg px-3.5 py-2">
            Today is {todayName} (Weekend). Showing {selectedDay}&apos;s schedule.
          </div>
        )}

        {/* Status / Count bar */}
        <div className="flex items-center justify-between text-xs text-zinc-500 mb-3 px-1">
          <div>
            Showing <span className="font-medium text-zinc-800">{totalClassesFound}</span> class session{totalClassesFound !== 1 ? "s" : ""} for{" "}
            <span className="font-medium text-zinc-800">{selectedGroup}</span>
            {searchQuery ? ` matching "${searchQuery}"` : ""}
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="text-xs text-zinc-700 hover:underline uppercase tracking-wider"
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
                className="bg-white border border-zinc-200 rounded-xl p-5 animate-pulse"
              >
                <div className="h-4 bg-zinc-200 rounded w-1/4 mb-3"></div>
                <div className="h-3 bg-zinc-100 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-zinc-100 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="bg-white border border-zinc-300 rounded-xl p-6 text-center">
            <div className="text-sm font-medium text-zinc-800 mb-1">
              Unable to Load Schedule
            </div>
            <div className="text-xs text-zinc-500 mb-4">{error}</div>
            <button
              onClick={() => setSelectedGroup((g) => `${g}`)}
              className="px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-lg hover:bg-zinc-800 transition-colors"
              type="button"
            >
              Retry
            </button>
          </div>
        )}

        {/* Schedule List (Mobile-First Vertical Card Stacks) */}
        {!isLoading && !error && (
          <div className="space-y-8">
            {filteredSchedule.length === 0 || totalClassesFound === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center text-zinc-500">
                <div className="text-sm font-medium text-zinc-800 mb-1">
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
                      <span className="font-medium text-zinc-700 mr-2">
                        {daySchedule.day}:
                      </span>
                      No classes scheduled.
                    </div>
                  );
                }

                const isDayToday = daySchedule.day === todayName;

                return (
                  <section
                    key={daySchedule.day}
                    className="space-y-3"
                    id={`day-${daySchedule.day}`}
                  >
                    {/* Day Section Header */}
                    <div className="flex items-center justify-between pb-1 border-b border-zinc-200">
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-medium text-zinc-900 tracking-tight">
                          {daySchedule.day}
                        </h2>
                        {isDayToday && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 font-medium">
                            Today
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400">
                        {daySchedule.slots.length} class
                        {daySchedule.slots.length > 1 ? "es" : ""}
                      </span>
                    </div>

                    {/* Class Cards Stack */}
                    <div className="grid grid-cols-1 gap-3">
                      {daySchedule.slots.map((slot, idx) => {
                        const ongoing = isSlotOngoing(
                          daySchedule.day,
                          slot.startTime,
                          slot.endTime
                        );
                        const upcoming = isSlotUpcomingToday(
                          daySchedule.day,
                          slot.startTime
                        );

                        return (
                          <div
                            key={`${daySchedule.day}-${slot.subject}-${slot.startTime}-${idx}`}
                            className={`bg-white border rounded-xl p-4 sm:p-5 transition-all ${
                              ongoing
                                ? "border-zinc-900 ring-1 ring-zinc-900 shadow-sm"
                                : "border-zinc-200 hover:border-zinc-300 shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5 mb-3">
                              {/* Subject & Timing */}
                              <div>
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="text-base font-medium text-zinc-900">
                                    {slot.subject}
                                  </span>

                                  {ongoing && (
                                    <span className="text-[11px] font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-900 text-white">
                                      Ongoing
                                    </span>
                                  )}

                                  {!ongoing && isDayToday && upcoming && (
                                    <span className="text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
                                      Upcoming
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs text-zinc-500 font-mono">
                                  {slot.startTime} - {slot.endTime}
                                  <span className="ml-2 text-zinc-400 font-sans">
                                    ({slot.colspan}h duration)
                                  </span>
                                </div>
                              </div>

                              {/* Room Badge */}
                              <div className="sm:text-right">
                                <span className="inline-block text-xs font-mono font-medium px-2.5 py-1 bg-zinc-100 text-zinc-800 border border-zinc-200 rounded-md">
                                  Room: {slot.room}
                                </span>
                              </div>
                            </div>

                            {/* Details Row */}
                            <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-zinc-600 gap-1.5">
                              <div>
                                <span className="text-zinc-400 uppercase tracking-wider text-[10px] mr-1.5 font-medium">
                                  Faculty:
                                </span>
                                <span className="font-medium text-zinc-800">
                                  {slot.teacher}
                                </span>
                              </div>

                              <div className="text-zinc-400 text-[11px]">
                                {selectedGroup}
                              </div>
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

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-6 mt-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-500 gap-2">
          <div>
            Kathmandu University &bull; Department of Computer Science &
            Engineering
          </div>
          <div className="font-mono text-zinc-400">
            Source: DOCSE Netlify Routine Table
          </div>
        </div>
      </footer>
    </div>
  );
}
