# DOCSE Routine Gate — Kathmandu University

> **An academic routine hub, attendance tracking system, and student productivity workspace built for Kathmandu University's Department of Computer Science & Engineering (DOCSE).**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS%20v4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

---

## ✨ Features

- 📅 **Dynamic Routine Parsing & Live Schedules**: Automated headless scraping of the university FET portal with intelligent timetable matrix reconstruction, live class status (Ongoing, Upcoming, Room assignments, Faculty details).
- 🛡️ **80% Attendance Health Dashboard**: Real-time percentage tracking with exact calculations for **safe skip buffer** and **catch-up requirements** to maintain semester board exam eligibility.
- ⚡ **Real-Time Per-Class Discussion**: Live WebSocket classroom chat drawer for lecture discussions, Q&A, and quick announcements.
- 🗓️ **Interactive Calendar & Holiday Exclusions**: Full month calendar with one-click holiday/vacation date toggling, automatically recalculating attendance quotas without penalization.
- 📝 **Academic Planner**: Manage assignments, lab equipment to bring, reminders, and lecture notes with subject-specific filtering and cloud synchronization.
- 🚀 **Offline-First & Transparent Cloud Migration**: Full guest offline support via `localStorage` with automatic batch migration to Supabase when signing up.
- 🔒 **Zero-Email Onboarding Pipeline**: Server-side registration bypassing free-tier Supabase email rate limits and enabling simple username logins.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ or 20+
- A [Supabase](https://supabase.com) project

### 2. Installation & Setup
```bash
# Clone repository and enter directory
cd routine

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env.local  # or create .env.local
```

### 3. Environment Variables (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 4. Database Setup
Copy and execute the complete SQL script provided in [DOCUMENTATION.md](./DOCUMENTATION.md#complete-sql-database-setup-script) inside your Supabase SQL Editor.

### 5. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📖 Complete Technical Documentation

For the complete architectural breakdown, database ERD, mathematical proofs, scraping mechanics, and troubleshooting guide, see **[DOCUMENTATION.md](./DOCUMENTATION.md)**.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Styling**: Tailwind CSS v4 + PostCSS
- **Database & Auth**: Supabase (PostgreSQL, Row Level Security, Realtime WebSockets)
- **Scraper**: Playwright Core + `@sparticuz/chromium` + Cheerio
- **Icons**: Lucide React

---
*Kathmandu University • Department of Computer Science & Engineering (DOCSE)*
