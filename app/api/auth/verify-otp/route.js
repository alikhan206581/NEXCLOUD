
import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminSupabase } from "../../../../lib/server/supabase";

function hashOTP(email, otp, secretKey) {
  return createHmac("sha256", secretKey)
    .update(`${email}:${otp}`)
    .digest("hex");
}

export async function POST(request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const { email, otp, name, password } = body ?? {};

    if (
      typeof email !== "string" ||
      typeof otp !== "string" ||
      typeof name !== "string" ||
      typeof password !== "string" ||
      !/^\d{6}$/.test(otp) ||
      !email.includes("@") ||
      name.trim().length < 2 ||
      password.length < 8
    ) {
      return NextResponse.json(
        { error: "Please provide valid registration details and a six-digit OTP. Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!secretKey || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.error("OTP verification configuration is missing Supabase server credentials.");
      return NextResponse.json(
        { error: "Account verification is not configured on the server." },
        { status: 503 }
      );
    }

    const supabase = createAdminSupabase();

    const { data: record, error: lookupError } = await supabase
      .from("email_otps")
      .select("otp_hash, expires_at, attempts")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (!record) {
      return NextResponse.json(
        { error: "OTP not found. Please request a new code." },
        { status: 400 }
      );
    }

    if (new Date(record.expires_at).getTime() < Date.now()) {
      await supabase
        .from("email_otps")
        .delete()
        .eq("email", normalizedEmail);

      return NextResponse.json(
        { error: "OTP expired. Please request a new code." },
        { status: 400 }
      );
    }

    if (record.attempts >= 5) {
      await supabase
        .from("email_otps")
        .delete()
        .eq("email", normalizedEmail);

      return NextResponse.json(
        { error: "Too many attempts. Request a new OTP." },
        { status: 429 }
      );
    }

    const expectedHash = Buffer.from(record.otp_hash, "hex");
    const suppliedHash = Buffer.from(
      hashOTP(normalizedEmail, otp, secretKey),
      "hex"
    );

    const matches =
      expectedHash.length === suppliedHash.length &&
      timingSafeEqual(expectedHash, suppliedHash);

    if (!matches) {
      await supabase
        .from("email_otps")
        .update({ attempts: record.attempts + 1 })
        .eq("email", normalizedEmail);

      return NextResponse.json(
        { error: "Incorrect OTP. Please try again." },
        { status: 400 }
      );
    }

    // Create the Supabase account only after OTP verification.
    const { data: account, error: signupError } =
      await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name.trim(),
        },
      });

    if (signupError) {
      if (signupError.message.toLowerCase().includes("already")) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please sign in." },
          { status: 409 }
        );
      }

      throw signupError;
    }

    await supabase
      .from("email_otps")
      .delete()
      .eq("email", normalizedEmail);

    return NextResponse.json({
      success: true,
      message: "Email verified and account created successfully!",
      user: {
        id: account.user.id,
        email: account.user.email,
      },
    });

  } catch (error) {
    console.error("OTP verification error:", error);

    return NextResponse.json(
      { error: "Unable to verify OTP or create account." },
      { status: 500 }
    );
  }
}
