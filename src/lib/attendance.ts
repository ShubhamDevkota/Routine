import { supabase } from "./supabase/client";

export interface SubjectAttendanceStat {
  subject_name: string;
  total_classes: number;
  attended_classes: number;
  absent_classes: number;
  excused_classes: number;
  attendance_percentage: number;
  classes_can_skip: number;
  classes_needed_to_catchup: number;
}

export interface LocalAttendanceItem {
  userId: string;
  instanceId: string;
  subjectName: string;
  status: "present" | "absent" | "excused";
  date?: string; // YYYY-MM-DD
  updatedAt: string;
}

/**
 * Calculates 80% attendance metrics given attended and total classes.
 */
export function computeAttendanceMetrics(
  attended: number,
  total: number
): {
  percentage: number;
  canSkip: number;
  neededToCatchup: number;
} {
  if (total <= 0) {
    return {
      percentage: 100,
      canSkip: 0,
      neededToCatchup: 0,
    };
  }

  const percentage = Math.round((attended / total) * 100 * 10) / 10;

  if (percentage >= 80) {
    const canSkip = Math.max(0, Math.floor(attended / 0.8 - total));
    return {
      percentage,
      canSkip,
      neededToCatchup: 0,
    };
  } else {
    const neededToCatchup = Math.max(
      1,
      Math.ceil((0.8 * total - attended) / 0.2)
    );
    return {
      percentage,
      canSkip: 0,
      neededToCatchup,
    };
  }
}

/**
 * Save holiday status to local storage.
 */
export function saveLocalHoliday(
  userId: string | null,
  date: string,
  isHoliday: boolean
) {
  if (typeof window === "undefined") return;
  try {
    const effectiveUser = userId || "guest";
    const key = `docse_holidays_${effectiveUser}`;
    const raw = localStorage.getItem(key);
    let list: string[] = raw ? JSON.parse(raw) : [];
    if (isHoliday) {
      if (!list.includes(date)) {
        list.push(date);
      }
    } else {
      list = list.filter((d) => d !== date);
    }
    localStorage.setItem(key, JSON.stringify(list));
    // Also store in general fallback
    localStorage.setItem("docse_holidays_all", JSON.stringify(list));
  } catch (err) {
    console.warn("Local storage holiday save error:", err);
  }
}

/**
 * Get holiday dates from local storage.
 */
export function getLocalHolidays(userId?: string | null): string[] {
  if (typeof window === "undefined") return [];
  try {
    const effectiveUser = userId || "guest";
    const userKey = `docse_holidays_${effectiveUser}`;
    const rawUser = localStorage.getItem(userKey);
    const rawAll = localStorage.getItem("docse_holidays_all");

    const userList: string[] = rawUser ? JSON.parse(rawUser) : [];
    const allList: string[] = rawAll ? JSON.parse(rawAll) : [];

    return Array.from(new Set([...userList, ...allList]));
  } catch {
    return [];
  }
}

/**
 * Fetch holiday dates from Supabase and local storage.
 */
export async function getHolidays(
  userId: string | null,
  academicGroup?: string
): Promise<string[]> {
  const localHolidays = getLocalHolidays(userId);

  if (!userId || userId === "guest" || userId.startsWith("local-")) {
    return localHolidays;
  }

  try {
    const isPlaceholderUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR_SUPABASE_PROJECT_ID") ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

    if (isPlaceholderUrl) {
      return localHolidays;
    }

    const query = supabase
      .from("user_holidays")
      .select("holiday_date")
      .or(`user_id.eq.${userId}${academicGroup ? `,academic_group.eq.${academicGroup}` : ""}`);

    const { data, error } = await query;
    if (!error && data) {
      const dbDates = data.map((row: { holiday_date: string }) => row.holiday_date);
      const merged = Array.from(new Set([...localHolidays, ...dbDates]));
      return merged;
    }
  } catch (err) {
    console.debug("Supabase holiday fetch offline:", err);
  }

  return localHolidays;
}

/**
 * Set holiday status both in Supabase and localStorage.
 */
export async function setHolidayStatus(
  userId: string | null,
  date: string,
  isHoliday: boolean,
  academicGroup?: string
): Promise<void> {
  // Always update local storage first
  saveLocalHoliday(userId, date, isHoliday);

  if (!userId || userId === "guest" || userId.startsWith("local-")) {
    return;
  }

  try {
    const isPlaceholderUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR_SUPABASE_PROJECT_ID") ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

    if (isPlaceholderUrl) return;

    if (isHoliday) {
      await supabase.from("user_holidays").upsert(
        {
          user_id: userId,
          holiday_date: date,
          academic_group: academicGroup || null,
          title: "Holiday",
        },
        { onConflict: "user_id,holiday_date" }
      );
    } else {
      await supabase
        .from("user_holidays")
        .delete()
        .eq("user_id", userId)
        .eq("holiday_date", date);
    }
  } catch (err) {
    console.debug("Supabase holiday sync offline:", err);
  }
}

/**
 * Save attendance record to local storage as fallback/cache.
 */
export function saveLocalAttendanceRecord(
  userId: string | null,
  instanceId: string,
  subjectName: string,
  status: "present" | "absent" | "excused",
  date?: string
) {
  if (typeof window === "undefined") return;
  try {
    const effectiveUser = userId || "guest";
    const key = `docse_att_${effectiveUser}`;
    const raw = localStorage.getItem(key);
    const list: LocalAttendanceItem[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((i) => i.instanceId !== instanceId);
    filtered.push({
      userId: effectiveUser,
      instanceId,
      subjectName,
      status,
      date,
      updatedAt: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (err) {
    console.warn("Local storage attendance save error:", err);
  }
}

/**
 * Fetch local attendance records.
 */
export function getLocalAttendanceRecords(userId?: string | null): LocalAttendanceItem[] {
  if (typeof window === "undefined") return [];
  try {
    const effectiveUser = userId || "guest";
    const key = `docse_att_${effectiveUser}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Fetch or compute subject attendance statistics for a given user.
 * Automatically excludes any classes that fall on dates marked as Holiday.
 */
export async function getUserSubjectAttendance(
  userId: string | null,
  academicGroup?: string
): Promise<SubjectAttendanceStat[]> {
  const effectiveUserId = userId || "guest";

  // 1. Fetch holidays list so we can exclude holiday dates from total_classes
  const holidayDates = await getHolidays(userId, academicGroup);
  const holidaySet = new Set(holidayDates);

  // If user is a real Supabase user, attempt remote fetch
  const isRealSupabaseUser =
    userId &&
    userId !== "guest" &&
    !userId.startsWith("local-") &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR_SUPABASE_PROJECT_ID");

  if (isRealSupabaseUser) {
    try {
      // Query raw attendance_records joined with class_instances to check class_date against holidays
      const { data: records, error: recError } = await supabase
        .from("attendance_records")
        .select(
          `
          id,
          status,
          class_instance:class_instances (
            id,
            class_date,
            schedule:class_schedules (
              subject_name
            )
          )
        `
        )
        .eq("user_id", userId);

      if (!recError && records && records.length > 0) {
        const map = new Map<
          string,
          { attended: number; absent: number; excused: number; total: number }
        >();

        for (const rec of records) {
          const instance = Array.isArray(rec.class_instance)
            ? rec.class_instance[0]
            : rec.class_instance;
          const classDate = instance?.class_date;

          // Exclude any class that falls on a holiday!
          if (classDate && holidaySet.has(classDate)) {
            continue;
          }

          const schedule = Array.isArray(instance?.schedule)
            ? instance?.schedule[0]
            : instance?.schedule;
          const subjectName = schedule?.subject_name || "General";

          if (!map.has(subjectName)) {
            map.set(subjectName, { attended: 0, absent: 0, excused: 0, total: 0 });
          }

          const stat = map.get(subjectName)!;
          if (rec.status === "present") {
            stat.attended += 1;
            stat.total += 1;
          } else if (rec.status === "absent") {
            stat.absent += 1;
            stat.total += 1;
          } else if (rec.status === "excused") {
            stat.excused += 1;
          }
        }

        const results: SubjectAttendanceStat[] = [];
        map.forEach((stat, subject_name) => {
          const metrics = computeAttendanceMetrics(stat.attended, stat.total);
          results.push({
            subject_name,
            total_classes: stat.total,
            attended_classes: stat.attended,
            absent_classes: stat.absent,
            excused_classes: stat.excused,
            attendance_percentage: metrics.percentage,
            classes_can_skip: metrics.canSkip,
            classes_needed_to_catchup: metrics.neededToCatchup,
          });
        });

        if (results.length > 0) {
          return results;
        }
      }
    } catch (err) {
      console.warn("Supabase attendance fetch failed, checking local storage:", err);
    }
  }

  // Fallback to Local Storage (covers guest mode, offline mode, and local records)
  const localList = getLocalAttendanceRecords(effectiveUserId);
  if (localList.length === 0) {
    return [];
  }

  const map = new Map<
    string,
    { attended: number; absent: number; excused: number; total: number }
  >();

  for (const item of localList) {
    // Check if the item date is in holiday set
    if (item.date && holidaySet.has(item.date)) {
      continue;
    }

    // Check if instanceId contains the holiday date
    const isHolidayInstance = Array.from(holidaySet).some((hDate) =>
      item.instanceId.includes(hDate.replace(/-/g, "_")) || item.instanceId.includes(hDate)
    );
    if (isHolidayInstance) {
      continue;
    }

    const subjectName = item.subjectName || "General";
    if (!map.has(subjectName)) {
      map.set(subjectName, { attended: 0, absent: 0, excused: 0, total: 0 });
    }
    const stat = map.get(subjectName)!;
    if (item.status === "present") {
      stat.attended += 1;
      stat.total += 1;
    } else if (item.status === "absent") {
      stat.absent += 1;
      stat.total += 1;
    } else if (item.status === "excused") {
      stat.excused += 1;
    }
  }

  const results: SubjectAttendanceStat[] = [];
  map.forEach((stat, subject_name) => {
    const metrics = computeAttendanceMetrics(stat.attended, stat.total);
    results.push({
      subject_name,
      total_classes: stat.total,
      attended_classes: stat.attended,
      absent_classes: stat.absent,
      excused_classes: stat.excused,
      attendance_percentage: metrics.percentage,
      classes_can_skip: metrics.canSkip,
      classes_needed_to_catchup: metrics.neededToCatchup,
    });
  });

  return results;
}

/**
 * Ensures or retrieves a class_instance id for a schedule slot and date.
 */
export async function getOrCreateClassInstance(
  academicGroup: string,
  dayOfWeek: string,
  startTime: string,
  room: string,
  classDate: string,
  subjectName: string
): Promise<string> {
  const localKey = `${academicGroup}_${dayOfWeek}_${startTime}_${room}_${classDate}`.replace(/[\s/:]+/g, "_");

  try {
    const isPlaceholderUrl =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR_SUPABASE_PROJECT_ID") ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

    if (isPlaceholderUrl) {
      return localKey;
    }

    const { data: schedules } = await supabase
      .from("class_schedules")
      .select("id")
      .eq("academic_group", academicGroup)
      .eq("day_of_week", dayOfWeek)
      .eq("start_time", startTime)
      .eq("room", room)
      .limit(1);

    let scheduleId = schedules?.[0]?.id;

    if (!scheduleId) {
      const { data: newSched } = await supabase
        .from("class_schedules")
        .upsert(
          {
            academic_group: academicGroup,
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: startTime,
            room: room,
            subject_name: subjectName,
          },
          { onConflict: "academic_group,day_of_week,start_time,room" }
        )
        .select("id")
        .single();
      scheduleId = newSched?.id;
    }

    if (scheduleId) {
      const { data: instances } = await supabase
        .from("class_instances")
        .select("id")
        .eq("schedule_id", scheduleId)
        .eq("class_date", classDate)
        .limit(1);

      if (instances && instances.length > 0) {
        return instances[0].id;
      }

      const { data: newInstance } = await supabase
        .from("class_instances")
        .insert({
          schedule_id: scheduleId,
          class_date: classDate,
          status: "scheduled",
        })
        .select("id")
        .single();

      if (newInstance?.id) return newInstance.id;
    }
  } catch {
    // Fail gracefully in offline mode
    console.debug("Remote instance sync offline, using local key");
  }

  return localKey;
}
