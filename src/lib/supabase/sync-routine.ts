import { getAdminSupabase } from "./admin";
import { GroupRoutine } from "@/lib/parser";

/**
 * Synchronizes scraped routine schedules, subjects, and teachers to Supabase DB.
 */
export async function syncRoutinesToSupabase(
  routines: Map<string, GroupRoutine> | GroupRoutine[]
): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    const supabase = getAdminSupabase();

    // Check if environment variables are valid
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("YOUR_SUPABASE_PROJECT_ID") ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder")
    ) {
      return {
        success: false,
        message: "Supabase URL is not configured with a live project reference.",
      };
    }

    const routineList = Array.isArray(routines)
      ? routines
      : Array.from(routines.values());

    const subjectSet = new Set<string>();
    const teacherSet = new Set<string>();

    for (const groupRoutine of routineList) {
      for (const day of groupRoutine.schedule) {
        for (const slot of day.slots) {
          if (slot.subject && slot.subject.trim()) {
            subjectSet.add(slot.subject.trim());
          }
          if (slot.teacher && slot.teacher.trim()) {
            teacherSet.add(slot.teacher.trim());
          }
        }
      }
    }

    // 1. Upsert Subjects
    if (subjectSet.size > 0) {
      const subjectRows = Array.from(subjectSet).map((name) => ({ name }));
      await supabase
        .from("subjects")
        .upsert(subjectRows, { onConflict: "name", ignoreDuplicates: false });
    }

    // 2. Upsert Teachers
    if (teacherSet.size > 0) {
      const teacherRows = Array.from(teacherSet).map((name) => ({ name }));
      await supabase
        .from("teachers")
        .upsert(teacherRows, { onConflict: "name", ignoreDuplicates: false });
    }

    // Fetch master subject & teacher mappings
    const { data: dbSubjects } = await supabase.from("subjects").select("id, name");
    const { data: dbTeachers } = await supabase.from("teachers").select("id, name");

    const subjectMap = new Map<string, string>();
    dbSubjects?.forEach((s: { id: string; name: string }) => subjectMap.set(s.name, s.id));

    const teacherMap = new Map<string, string>();
    dbTeachers?.forEach((t: { id: string; name: string }) => teacherMap.set(t.name, t.id));

    // 3. Prepare and Upsert Class Schedules
    const scheduleRows: Array<{
      academic_group: string;
      day_of_week: string;
      start_time: string;
      end_time: string;
      room: string;
      subject_id?: string | null;
      subject_name?: string | null;
      teacher_id?: string | null;
      teacher_name?: string | null;
      colspan?: number;
    }> = [];

    for (const groupRoutine of routineList) {
      for (const day of groupRoutine.schedule) {
        for (const slot of day.slots) {
          scheduleRows.push({
            academic_group: groupRoutine.group,
            day_of_week: day.day,
            start_time: slot.startTime,
            end_time: slot.endTime,
            room: slot.room,
            subject_id: subjectMap.get(slot.subject) || null,
            subject_name: slot.subject,
            teacher_id: teacherMap.get(slot.teacher) || null,
            teacher_name: slot.teacher,
            colspan: slot.colspan || 1,
          });
        }
      }
    }

    if (scheduleRows.length > 0) {
      // Upsert into class_schedules matching (academic_group, day_of_week, start_time, room)
      await supabase.from("class_schedules").upsert(scheduleRows, {
        onConflict: "academic_group,day_of_week,start_time,room",
        ignoreDuplicates: false,
      });
    }

    return {
      success: true,
      message: `Synced ${subjectSet.size} subjects, ${teacherSet.size} teachers, and ${scheduleRows.length} schedule slots.`,
      count: scheduleRows.length,
    };
  } catch (error) {
    console.warn("Routine Supabase sync error:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown sync error",
    };
  }
}
