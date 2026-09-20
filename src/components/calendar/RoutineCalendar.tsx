"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Palmtree,
  Sparkles,
  CheckCircle2,
  CalendarCheck,
  CalendarX2,
} from "lucide-react";

interface RoutineCalendarProps {
  selectedDate: string; // "YYYY-MM-DD"
  onSelectDate: (date: string) => void;
  holidays: string[]; // array of "YYYY-MM-DD"
  onToggleHoliday: (date: string, isHoliday: boolean) => void;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function RoutineCalendar({
  selectedDate,
  onSelectDate,
  holidays,
  onToggleHoliday,
}: RoutineCalendarProps) {
  // Parse currently selected date
  const parsedSelected = useMemo(() => {
    const parts = selectedDate.split("-").map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date();
  }, [selectedDate]);

  // Calendar navigation month/year state
  const [navYear, setNavYear] = useState<number>(() => parsedSelected.getFullYear());
  const [navMonth, setNavMonth] = useState<number>(() => parsedSelected.getMonth());

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const isSelectedDateHoliday = holidays.includes(selectedDate);

  // Month navigation
  const handlePrevMonth = () => {
    if (navMonth === 0) {
      setNavMonth(11);
      setNavYear((y) => y - 1);
    } else {
      setNavMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (navMonth === 11) {
      setNavMonth(0);
      setNavYear((y) => y + 1);
    } else {
      setNavMonth((m) => m + 1);
    }
  };

  const handleGoToToday = () => {
    const now = new Date();
    setNavYear(now.getFullYear());
    setNavMonth(now.getMonth());
    onSelectDate(todayStr);
  };

  // Build grid days for the month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(navYear, navMonth, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(navYear, navMonth + 1, 0).getDate();

    const days: Array<{
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isHoliday: boolean;
      isSelected: boolean;
      dayOfWeekName: string;
      hasClasses: boolean;
    }> = [];

    // Previous month padding
    const prevMonthDays = new Date(navYear, navMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dNum = prevMonthDays - i;
      const prevMonth = navMonth === 0 ? 11 : navMonth - 1;
      const prevYear = navMonth === 0 ? navYear - 1 : navYear;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
      const dObj = new Date(prevYear, prevMonth, dNum);
      const dow = dObj.getDay();
      const dowName = WEEKDAY_NAMES[dow];

      days.push({
        dateStr,
        dayNumber: dNum,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isHoliday: holidays.includes(dateStr),
        isSelected: dateStr === selectedDate,
        dayOfWeekName: dowName,
        hasClasses: dow >= 1 && dow <= 5,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${navYear}-${String(navMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dObj = new Date(navYear, navMonth, d);
      const dow = dObj.getDay();
      const dowName = WEEKDAY_NAMES[dow];

      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isHoliday: holidays.includes(dateStr),
        isSelected: dateStr === selectedDate,
        dayOfWeekName: dowName,
        hasClasses: dow >= 1 && dow <= 5,
      });
    }

    // Next month padding to fill grid to full weeks (up to 35 or 42)
    const totalCells = Math.ceil(days.length / 7) * 7;
    const remaining = totalCells - days.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = navMonth === 11 ? 0 : navMonth + 1;
      const nextYear = navMonth === 11 ? navYear + 1 : navYear;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      const dObj = new Date(nextYear, nextMonth, i);
      const dow = dObj.getDay();
      const dowName = WEEKDAY_NAMES[dow];

      days.push({
        dateStr,
        dayNumber: i,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
        isHoliday: holidays.includes(dateStr),
        isSelected: dateStr === selectedDate,
        dayOfWeekName: dowName,
        hasClasses: dow >= 1 && dow <= 5,
      });
    }

    return days;
  }, [navYear, navMonth, holidays, selectedDate, todayStr]);

  // Format selected date nicely
  const formattedSelectedDate = useMemo(() => {
    try {
      const parts = selectedDate.split("-").map(Number);
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  // Quick helper dates (e.g. today, yesterday, recent weekdays)
  const quickDates = useMemo(() => {
    const list: Array<{ label: string; dateStr: string }> = [];
    const now = new Date();

    list.push({ label: "Today", dateStr: todayStr });

    // Yesterday
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;
    list.push({ label: "Yesterday", dateStr: yestStr });

    // Last 3 weekdays
    for (let i = 2; i <= 5; i++) {
      const past = new Date(now);
      past.setDate(past.getDate() - i);
      const dow = past.getDay();
      if (dow >= 1 && dow <= 5) {
        const pStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-${String(past.getDate()).padStart(2, "0")}`;
        const dayName = WEEKDAY_NAMES[dow];
        list.push({ label: `Last ${dayName}`, dateStr: pStr });
      }
    }

    return list.slice(0, 5);
  }, [todayStr]);

  return (
    <section className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all">
      {/* Calendar Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3.5 border-b border-zinc-100">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-zinc-900 text-white">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 tracking-tight flex items-center gap-2">
              <span>Academic Date & Calendar</span>
              {isSelectedDateHoliday && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 inline-flex items-center gap-1">
                  <Palmtree className="w-3 h-3 text-amber-700" />
                  Holiday Marked
                </span>
              )}
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Select any past or upcoming date to view scheduled lectures and mark university holidays.
            </p>
          </div>
        </div>

        {/* Month & Today Switchers */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={handleGoToToday}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors"
          >
            Today
          </button>
          <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 border border-zinc-200">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/80 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-zinc-900 px-2 min-w-[110px] text-center">
              {MONTH_NAMES[navMonth]} {navYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/80 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Jump Bar */}
      <div className="pt-3 pb-2.5 flex items-center gap-1.5 overflow-x-auto text-xs">
        <span className="text-zinc-400 font-medium text-[11px] uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Quick:
        </span>
        {quickDates.map((q) => {
          const isQSelected = q.dateStr === selectedDate;
          const isQHoliday = holidays.includes(q.dateStr);
          return (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                const parts = q.dateStr.split("-").map(Number);
                setNavYear(parts[0]);
                setNavMonth(parts[1] - 1);
                onSelectDate(q.dateStr);
              }}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all text-xs whitespace-nowrap flex items-center gap-1 shrink-0 ${
                isQSelected
                  ? "bg-zinc-900 text-white shadow-xs font-semibold"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              }`}
            >
              {q.label}
              {isQHoliday && (
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isQSelected ? "bg-amber-400" : "bg-amber-500"
                  }`}
                  title="Holiday"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Calendar Grid */}
      <div className="mt-2 border border-zinc-200 rounded-xl overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-zinc-50 border-b border-zinc-200 text-center text-[11px] font-semibold text-zinc-500 py-1.5 uppercase tracking-wider">
          {WEEKDAY_NAMES.map((d, i) => (
            <div key={d} className={i === 0 || i === 6 ? "text-zinc-400" : ""}>
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 bg-white">
          {calendarDays.map((cell) => {
            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => onSelectDate(cell.dateStr)}
                className={`min-h-[44px] sm:min-h-[48px] p-1 sm:p-1.5 text-center flex flex-col items-center justify-between border-b border-r border-zinc-100 last:border-r-0 transition-all relative ${
                  !cell.isCurrentMonth
                    ? "bg-zinc-50/50 text-zinc-300"
                    : cell.isSelected
                    ? "bg-zinc-900 text-white font-semibold shadow-inner"
                    : cell.isHoliday
                    ? "bg-amber-50/60 text-amber-950 hover:bg-amber-100/70"
                    : cell.isToday
                    ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200/80 font-bold"
                    : "text-zinc-700 hover:bg-zinc-100/70"
                }`}
              >
                <div className="flex items-center justify-between w-full text-[10px] leading-none px-0.5">
                  <span
                    className={`font-mono text-xs ${
                      cell.isSelected
                        ? "text-white font-bold"
                        : cell.isToday
                        ? "text-zinc-900 font-extrabold"
                        : cell.isCurrentMonth
                        ? "text-zinc-800"
                        : "text-zinc-400"
                    }`}
                  >
                    {cell.dayNumber}
                  </span>

                  {cell.isToday && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-semibold uppercase tracking-wider ${
                        cell.isSelected ? "bg-white/20 text-white" : "bg-zinc-300 text-zinc-800"
                      }`}
                    >
                      Now
                    </span>
                  )}
                </div>

                {/* Holiday Badge or Dot */}
                <div className="w-full flex items-center justify-center mt-0.5">
                  {cell.isHoliday ? (
                    <span
                      className={`inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-semibold leading-tight ${
                        cell.isSelected
                          ? "bg-amber-400 text-zinc-950"
                          : "bg-amber-200 text-amber-900"
                      }`}
                      title="Holiday (Classes Excluded)"
                    >
                      <Palmtree className="w-2.5 h-2.5" />
                      <span className="hidden sm:inline">Holiday</span>
                    </span>
                  ) : cell.hasClasses && cell.isCurrentMonth ? (
                    <span
                      className={`w-1 h-1 rounded-full ${
                        cell.isSelected ? "bg-white/40" : "bg-zinc-300"
                      }`}
                    />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Action Bar */}
      <div className="mt-3.5 pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-zinc-50 p-3 rounded-xl">
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-lg ${
              isSelectedDateHoliday
                ? "bg-amber-100 text-amber-800"
                : "bg-zinc-200 text-zinc-800"
            }`}
          >
            {isSelectedDateHoliday ? (
              <CalendarX2 className="w-4 h-4" />
            ) : (
              <CalendarCheck className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-zinc-900 flex items-center gap-2">
              <span>Viewing: {formattedSelectedDate}</span>
              {isSelectedDateHoliday && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded">
                  Holiday
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {isSelectedDateHoliday
                ? "This day is marked as a Holiday. Classes on this date are excluded from your 80% total attendance count."
                : "Regular academic day. Scheduled classes count towards your attendance percentage."}
            </p>
          </div>
        </div>

        {/* Holiday Toggle Button */}
        <button
          type="button"
          onClick={() => onToggleHoliday(selectedDate, !isSelectedDateHoliday)}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs shrink-0 ${
            isSelectedDateHoliday
              ? "bg-amber-600 hover:bg-amber-700 text-white"
              : "bg-zinc-900 hover:bg-zinc-800 text-white"
          }`}
        >
          {isSelectedDateHoliday ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Unmark Holiday (Restore Classes)</span>
            </>
          ) : (
            <>
              <Palmtree className="w-3.5 h-3.5" />
              <span>Mark Date as Holiday</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}
