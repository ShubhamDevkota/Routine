import * as cheerio from "cheerio";

const BASE_URL = "https://docse.netlify.app";

// In-memory cache to prevent spawning browser on every request
interface CacheEntry {
  html: string;
  timestamp: number;
}

let cachedHtml: CacheEntry | null = null;
const CACHE_TTL_MS = 3600 * 1000; // 1 hour cache

/**
 * Scrapes routine HTML using Playwright (with serverless Chromium support for Vercel/Lambda).
 */
export async function scrapeRoutineWithPlaywright(groupName?: string): Promise<string> {
  // Return cached HTML if still fresh
  if (cachedHtml && Date.now() - cachedHtml.timestamp < CACHE_TTL_MS) {
    return cachedHtml.html;
  }

  let browser;
  try {
    const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL;

    if (isProduction) {
      // Serverless Chromium on Vercel / AWS Lambda
      const chromium = (await import("@sparticuz/chromium")).default;
      const { chromium: playwrightChromium } = await import("playwright-core");

      // Configure font and graphics options for serverless
      chromium.setGraphicsMode = false;

      const executablePath = await chromium.executablePath();

      browser = await playwrightChromium.launch({
        args: chromium.args,
        executablePath,
        headless: true,
      });
    } else {
      // Local development (using standard playwright-core)
      const { chromium } = await import("playwright-core");
      // In local development, you can use local installed Chrome/Edge or playwright browsers
      browser = await chromium
        .launch({
          headless: true,
          channel: "chrome", // will use locally installed Google Chrome if available
        })
        .catch(async () => {
          // Fallback to default bundled chromium
          return await chromium.launch({ headless: true });
        });
    }

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // 1. Navigate to the main portal
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    // 2. Locate the "Groups" row and "Days Vertical" link/action
    // DOM Structure: FET Timetable portal has a table with <tr><th>Groups</th>...<td><a href="...">view</a></td></tr>
    const groupsDaysVerticalLink = page.locator(
      "tr:has(th:text-is('Groups')) td:nth-child(3) a, tr:has(th:has-text('Groups')) a"
    );

    if ((await groupsDaysVerticalLink.count()) > 0) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null),
        groupsDaysVerticalLink.first().click(),
      ]);
    }

    // 3. If there is a group selector dropdown or specific anchor jump:
    if (groupName) {
      // If the page contains a dropdown for groups:
      const groupDropdown = page.locator("select#group, select[name='group'], select");
      if ((await groupDropdown.count()) > 0) {
        try {
          await groupDropdown.first().selectOption({ label: groupName });
        } catch {
          // If label match fails, try selecting by value or text
          await groupDropdown.first().selectOption({ value: groupName }).catch(() => null);
        }
      }
    }

    // 4. Wait for routine tables to render
    await page.waitForSelector("table[border='1'], table.odd_table, table.even_table, table", {
      timeout: 15000,
    });

    // 5. Extract full rendered HTML
    const html = await page.content();

    // Cache the result
    cachedHtml = {
      html,
      timestamp: Date.now(),
    };

    return html;
  } catch (error) {
    console.warn("Playwright scraper failed, falling back to dynamic HTTP resolver:", error);
    // Fallback: dynamically find the group timetable URL and fetch it via HTTP
    return await scrapeRoutineDynamicHttp();
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
  }
}

/**
 * Fast dynamic crawler fallback:
 * Automatically reads the main docse.netlify.app page, locates the dynamic Groups 'view' link,
 * and fetches the latest timetable HTML without requiring heavy browser binaries.
 */
export async function scrapeRoutineDynamicHttp(): Promise<string> {
  if (cachedHtml && Date.now() - cachedHtml.timestamp < CACHE_TTL_MS) {
    return cachedHtml.html;
  }

  // Step 1: Fetch the root homepage
  const homeRes = await fetch(BASE_URL, {
    next: { revalidate: 3600 },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!homeRes.ok) {
    throw new Error(`Failed to load homepage: ${homeRes.statusText}`);
  }

  const homeHtml = await homeRes.text();
  const $ = cheerio.load(homeHtml);

  // Find Groups row -> Days Vertical link
  let timetableRelPath = "";
  $("table tr").each((_, tr) => {
    const headerText = $(tr).find("th").first().text().trim();
    if (headerText.toLowerCase().includes("group")) {
      // Days Vertical is typically the 2nd td (or first <a> link with text "view")
      const link = $(tr).find("a").first().attr("href");
      if (link) {
        timetableRelPath = link;
      }
    }
  });

  if (!timetableRelPath) {
    // If not found in table row, search for any links containing 'groups_days_vertical'
    $('a[href*="groups_days_vertical"]').each((_, a) => {
      timetableRelPath = $(a).attr("href") || "";
    });
  }

  const targetUrl = timetableRelPath.startsWith("http")
    ? timetableRelPath
    : `${BASE_URL}${timetableRelPath.startsWith("/") ? "" : "/"}${timetableRelPath}`;

  // Step 2: Fetch the full group routines timetable
  const routineRes = await fetch(targetUrl, {
    next: { revalidate: 3600 },
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!routineRes.ok) {
    throw new Error(`Failed to fetch routine table from ${targetUrl}: ${routineRes.statusText}`);
  }

  const html = await routineRes.text();

  cachedHtml = {
    html,
    timestamp: Date.now(),
  };

  return html;
}
