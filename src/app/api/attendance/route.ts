import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const {
      userId,
      academicGroup,
      dayOfWeek,
      startTime,
      room,
      classDate,
      subjectName,
      status,
      classInstanceId,
    } = await req.json();

    if (!userId || userId === "guest" || userId.startsWith("local-")) {
      return NextResponse.json({ success: true, mode: "guest" });
    }

    const supabase = getAdminSupabase();

    let targetInstanceId = classInstanceId;
    const isUuid =
      typeof targetInstanceId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        targetInstanceId
      );

    // If not a valid UUID, find or create the schedule and instance in DB
    if (!isUuid) {
      const targetGroup = academicGroup || "I CE-I/I A";
      const targetDay = dayOfWeek || "Mon";
      const targetStart = startTime || "09:00";
      const targetRoom = room || "General";
      const targetSubject = subjectName || "General";
      const targetDate = classDate || new Date().toISOString().split("T")[0];

      // 1. Find or create schedule
      let scheduleId: string | null = null;
      const { data: scheds } = await supabase
        .from("class_schedules")
        .select("id")
        .eq("academic_group", targetGroup)
        .eq("day_of_week", targetDay)
        .eq("start_time", targetStart)
        .eq("room", targetRoom)
        .limit(1);

      if (scheds && scheds.length > 0) {
        scheduleId = scheds[0].id;
      } else {
        const { data: newSched, error: schedErr } = await supabase
          .from("class_schedules")
          .upsert(
            {
              academic_group: targetGroup,
              day_of_week: targetDay,
              start_time: targetStart,
              end_time: targetStart,
              room: targetRoom,
              subject_name: targetSubject,
            },
            { onConflict: "academic_group,day_of_week,start_time,room" }
          )
          .select("id")
          .single();

        if (!schedErr && newSched?.id) {
          scheduleId = newSched.id;
        }
      }

      // 2. Find or create class instance
      if (scheduleId) {
        const { data: insts } = await supabase
          .from("class_instances")
          .select("id")
          .eq("schedule_id", scheduleId)
          .eq("class_date", targetDate)
          .limit(1);

        if (insts && insts.length > 0) {
          targetInstanceId = insts[0].id;
        } else {
          const { data: newInst } = await supabase
            .from("class_instances")
            .insert({
              schedule_id: scheduleId,
              class_date: targetDate,
              status: "scheduled",
            })
            .select("id")
            .single();

          if (newInst?.id) {
            targetInstanceId = newInst.id;
          }
        }
      }
    }

    if (!targetInstanceId) {
      return NextResponse.json(
        { error: "Could not resolve or create class instance" },
        { status: 400 }
      );
    }

    // 3. Upsert attendance record
    const { error: attError } = await supabase
      .from("attendance_records")
      .upsert(
        {
          user_id: userId,
          class_instance_id: targetInstanceId,
          status: status,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,class_instance_id" }
      );

    if (attError) {
      console.error("Attendance API upsert error:", attError);
      return NextResponse.json({ error: attError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      class_instance_id: targetInstanceId,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("Attendance API route error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
