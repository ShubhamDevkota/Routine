import { supabase } from "./supabase/client";
import { LocalAttendanceItem } from "./attendance";

/**
 * Migrates local (guest/offline) attendance records and notes/tasks
 * from localStorage to Supabase when a user logs in with a real account.
 *
 * - Only migrates data from "guest" and "local-*" keys.
 * - Uses the authenticated Supabase user's UUID as user_id.
 * - Does NOT delete local data if migration fails.
 * - On success, clears the migrated localStorage keys.
 */
export async function migrateLocalDataToSupabase(
  authUserId: string
): Promise<{ attendanceMigrated: number; notesMigrated: number; errors: string[] }> {
  const result = { attendanceMigrated: 0, notesMigrated: 0, errors: [] as string[] };

  if (typeof window === "undefined") return result;
  if (!authUserId || authUserId === "guest" || authUserId.startsWith("local-")) return result;

  // Collect all localStorage keys that hold guest/local data
  const attKeysToMigrate: string[] = [];
  const taskKeysToMigrate: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    // Match attendance keys: docse_att_guest, docse_att_local-*
    if (key === "docse_att_guest" || (key.startsWith("docse_att_local-"))) {
      attKeysToMigrate.push(key);
    }
    // Match task keys: docse_tasks_guest, docse_tasks_local-*
    if (key === "docse_tasks_guest" || (key.startsWith("docse_tasks_local-"))) {
      taskKeysToMigrate.push(key);
    }
  }

  // --- Migrate Attendance Records ---
  for (const key of attKeysToMigrate) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const items: LocalAttendanceItem[] = JSON.parse(raw);
      if (!items || items.length === 0) continue;

      const rows = items.map((item) => ({
        user_id: authUserId,
        class_instance_id: item.instanceId,
        status: item.status,
        updated_at: item.updatedAt || new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("attendance_records")
        .upsert(rows, { onConflict: "user_id,class_instance_id" });

      if (error) {
        console.error(`Migration error for attendance key "${key}":`, error.message);
        result.errors.push(`Attendance (${key}): ${error.message}`);
        // Don't delete local data on failure
        continue;
      }

      result.attendanceMigrated += rows.length;
      // Also save under the real user ID in localStorage as cache
      const existingRaw = localStorage.getItem(`docse_att_${authUserId}`);
      const existingItems: LocalAttendanceItem[] = existingRaw ? JSON.parse(existingRaw) : [];
      const mergedMap = new Map<string, LocalAttendanceItem>();
      for (const item of existingItems) {
        mergedMap.set(item.instanceId, item);
      }
      for (const item of items) {
        mergedMap.set(item.instanceId, { ...item, userId: authUserId });
      }
      localStorage.setItem(`docse_att_${authUserId}`, JSON.stringify(Array.from(mergedMap.values())));
      // Clear the old guest/local key
      localStorage.removeItem(key);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`Migration parse error for key "${key}":`, msg);
      result.errors.push(`Attendance parse (${key}): ${msg}`);
    }
  }

  // --- Migrate Notes/Tasks ---
  for (const key of taskKeysToMigrate) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;

      const items = JSON.parse(raw);
      if (!Array.isArray(items) || items.length === 0) continue;

      for (const item of items) {
        try {
          const { error } = await supabase.from("notes_and_tasks").insert({
            user_id: authUserId,
            academic_group: item.academic_group || null,
            title: item.title,
            description: item.description || null,
            type: item.type || "note",
            subject_name: item.subject_name || null,
            due_date: item.due_date || null,
            is_completed: item.is_completed || false,
          });

          if (error) {
            // If it's a duplicate, that's fine
            if (error.code === "23505") continue;
            console.error(`Migration error for note "${item.title}":`, error.message);
            result.errors.push(`Note "${item.title}": ${error.message}`);
            continue;
          }

          result.notesMigrated += 1;
        } catch (noteErr) {
          const msg = noteErr instanceof Error ? noteErr.message : "Unknown error";
          console.error(`Migration note insert error:`, msg);
          result.errors.push(`Note insert: ${msg}`);
        }
      }

      // Clear old key only if we had no errors for this batch
      if (!result.errors.some((e) => e.includes(key))) {
        localStorage.removeItem(key);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`Migration parse error for key "${key}":`, msg);
      result.errors.push(`Notes parse (${key}): ${msg}`);
    }
  }

  if (result.attendanceMigrated > 0 || result.notesMigrated > 0) {
    console.log(
      `[Migration] Migrated ${result.attendanceMigrated} attendance records and ${result.notesMigrated} notes to Supabase user ${authUserId}`
    );
  }

  if (result.errors.length > 0) {
    console.warn(`[Migration] ${result.errors.length} error(s) during migration:`, result.errors);
  }

  return result;
}
