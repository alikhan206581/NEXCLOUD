
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { randomInt, createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";



const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function hashOTP(email, otp) {
  return createHmac("sha256", process.env.SUPABASE_SECRET_KEY)
    .update(`${email}:${otp}`)
    .digest("hex");
}

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check the resend waiting period.
    const { data: existing, error: lookupError } = await supabase
      .from("email_otps")
      .select("created_at")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (lookupError) throw lookupError;

    if (
      existing &&
      Date.now() - new Date(existing.created_at).getTime() < 60000
    ) {
      return NextResponse.json(
        { error: "Please wait 60 seconds before requesting another code." },
        { status: 429 }
      );
    }

    // Generate a secure six-digit OTP.
    const otp = randomInt(100000, 1000000).toString();

    const otpHash = hashOTP(normalizedEmail, otp);

    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    ).toISOString();

    const { error: saveError } = await supabase
      .from("email_otps")
      .upsert({
        email: normalizedEmail,
        otp_hash: otpHash,
        expires_at: expiresAt,
        attempts: 0,
        created_at: new Date().toISOString(),
      });

    if (saveError) throw saveError;

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    try {
      await transporter.sendMail({
        from: `"NEXCLOUD Systems" <${process.env.GMAIL_USER}>`,
        to: normalizedEmail,
        subject: "Your NEXCLOUD Verification Code",
        text: `Your NEXCLOUD OTP is ${otp}. It expires in 5 minutes.`,
        html: `
          <div style="font-family:Arial;padding:25px">
            <h2>Welcome to NEXCLOUD!</h2>
            <p>Your six-digit verification code is:</p>
            <h1 style="letter-spacing:8px">${otp}</h1>
            <p>This code expires in 5 minutes.</p>
            <p>If you did not request this code, ignore this email.</p>
            <p>Regards,<br>NEXCLOUD Systems</p>
          </div>
        `,
      });
    } catch (emailError) {
      await supabase
        .from("email_otps")
        .delete()
        .eq("email", normalizedEmail);

      throw emailError;
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully!",
    });

  } catch (error) {
    console.error("Send OTP error:", error);

    return NextResponse.json(
      { error: "Unable to send OTP. Please try again." },
      { status: 500 }
    );
  }
}
