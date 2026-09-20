import { NextRequest, NextResponse } from "next/server";
import { fetchAndParseAllRoutines } from "@/lib/parser";
import { syncRoutinesToSupabase } from "@/lib/supabase/sync-routine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedGroup = searchParams.get("group") || undefined;

    const { allRoutines, groups } = await fetchAndParseAllRoutines(requestedGroup);

    // Trigger Supabase persistence in the background
    syncRoutinesToSupabase(allRoutines).catch((err) =>
      console.warn("Background routine DB sync error:", err)
    );

    const targetGroup =
      requestedGroup && allRoutines.has(requestedGroup)
        ? requestedGroup
        : groups.includes("I CE-I/I A")
        ? "I CE-I/I A"
        : groups[0] || "";

    const routine = allRoutines.get(targetGroup);

    if (!routine) {
      return NextResponse.json(
        {
          error: "No routine data found",
          groups: groups,
          group: targetGroup,
          schedule: [],
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      group: routine.group,
      schedule: routine.schedule,
      groups,
    });
  } catch (error) {
    console.error("Routine fetch error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch and parse routine data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
