import * as cheerio from "cheerio";

export interface RoutineSlot {
  subject: string;
  teacher: string;
  room: string;
  startTime: string;
  endTime: string;
  colspan: number;
}

export interface DaySchedule {
  day: string;
  slots: RoutineSlot[];
}

export interface GroupRoutine {
  group: string;
  schedule: DaySchedule[];
}

export interface ApiResponse extends GroupRoutine {
  groups: string[];
}

const ROUTINE_URL =
  "https://docse.netlify.app/sep_18_mathfixd_2026_docse_cecsbit_i_with_room_fixed_routine_groups_days_vertical#table_2";

function normalizeTime(t: string): string {
  const parts = t.trim().split(":");
  if (parts.length === 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`;
  }
  return t.trim();
}

export async function fetchAndParseAllRoutines(): Promise<{
  allRoutines: Map<string, GroupRoutine>;
  groups: string[];
}> {
  const res = await fetch(ROUTINE_URL, {
    next: { revalidate: 3600 },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch routine HTML: ${res.statusText}`);
  }

  const html = await res.text();
  return parseRoutineHtml(html);
}

export function parseRoutineHtml(html: string): {
  allRoutines: Map<string, GroupRoutine>;
  groups: string[];
} {
  const $ = cheerio.load(html);
  const allRoutines = new Map<string, GroupRoutine>();
  const groups: string[] = [];

  $("table[border='1'], table.odd_table, table.even_table").each((_, table) => {
    const $table = $(table);
    const caption = $table.find("caption");
    if (!caption.length) return;

    let groupName = caption.find(".name").text().trim();
    if (!groupName) {
      const fullCaption = caption.text().trim();
      const parts = fullCaption.split("\n").map((p) => p.trim()).filter(Boolean);
      groupName = parts.length > 1 ? parts[parts.length - 1] : fullCaption;
    }

    if (!groupName) return;

    // Parse time headers
    const timeSlots: { start: string; end: string }[] = [];
    $table.find("thead tr th.xAxis").each((_, th) => {
      const text = $(th).text().trim();
      const [start, end] = text.split("-");
      if (start && end) {
        timeSlots.push({
          start: normalizeTime(start),
          end: normalizeTime(end),
        });
      }
    });

    if (timeSlots.length === 0) return;

    const schedule: DaySchedule[] = [];

    $table.find("tbody tr").each((_, tr) => {
      const $tr = $(tr);
      if ($tr.hasClass("foot")) return;

      const dayHeader = $tr.find("th.yAxis").text().trim();
      if (!dayHeader) return;

      const daySlots: RoutineSlot[] = [];
      let currentSlotIndex = 0;

      $tr.find("td").each((_, td) => {
        const $td = $(td);
        const colspanAttr = $td.attr("colspan");
        const colspan = colspanAttr ? parseInt(colspanAttr, 10) : 1;

        const isNotAvailable = $td.hasClass("notAvailable") || $td.find(".notAvailable").length > 0;
        const isEmpty = $td.hasClass("empty") || $td.find(".empty").length > 0;
        const textContent = $td.text().trim();

        if (
          !isNotAvailable &&
          !isEmpty &&
          textContent !== "-x-" &&
          textContent !== "---" &&
          textContent !== ""
        ) {
          const subject =
            $td.find(".subject").text().trim() ||
            $td.find(".line1 span").text().trim() ||
            $td.find(".line1").text().trim() ||
            $td.find("div:nth-child(1)").text().trim();

          const teacher =
            $td.find(".teacher").text().trim() ||
            $td.find(".line2").text().trim() ||
            $td.find("div:nth-child(2)").text().trim();

          const room =
            $td.find(".room").text().trim() ||
            $td.find(".line3").text().trim() ||
            $td.find("div:nth-child(3)").text().trim();

          const startIdx = currentSlotIndex;
          const endIdx = Math.min(currentSlotIndex + colspan - 1, timeSlots.length - 1);

          const startTime =
            startIdx < timeSlots.length ? timeSlots[startIdx].start : "00:00";
          const endTime =
            endIdx < timeSlots.length ? timeSlots[endIdx].end : "00:00";

          if (subject) {
            daySlots.push({
              subject,
              teacher,
              room,
              startTime,
              endTime,
              colspan,
            });
          }
        }

        currentSlotIndex += colspan;
      });

      schedule.push({
        day: dayHeader,
        slots: daySlots,
      });
    });

    if (!allRoutines.has(groupName)) {
      groups.push(groupName);
      allRoutines.set(groupName, {
        group: groupName,
        schedule,
      });
    }
  });

  return { allRoutines, groups };
}
