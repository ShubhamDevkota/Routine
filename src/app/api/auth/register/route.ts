import { NextRequest, NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, username, academicGroup, course } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email/username and password are required" },
        { status: 400 }
      );
    }

    const adminClient = getAdminSupabase();

    // Create user with email_confirm: true to completely bypass email sending & rate limits
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName || username || "Student",
        username: username || "student",
        academic_group: academicGroup,
        course: course,
      },
    });

    if (error) {
      // If user already exists, that's okay, we allow subsequent signInWithPassword
      if (
        error.message?.toLowerCase().includes("already registered") ||
        error.message?.toLowerCase().includes("user already exists")
      ) {
        return NextResponse.json({ success: true, message: "User already registered" });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Ensure profile row exists
    if (data?.user) {
      await adminClient.from("profiles").upsert({
        id: data.user.id,
        academic_group: academicGroup || "I CE-I/I A",
        course: course || "B.E. Computer Engineering",
        full_name: fullName || username || "Student",
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, user: data?.user });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
