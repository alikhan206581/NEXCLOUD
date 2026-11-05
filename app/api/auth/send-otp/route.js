
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { randomInt, createHmac } from "crypto";
import { createClient } from "@supabase/supabase-js";

function hashOTP(email, otp, secretKey) {
  return createHmac("sha256", secretKey)
    .update(`${email}:${otp}`)
    .digest("hex");
}

export async function POST(request) {
  try {
    const requiredEnvVars = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "SUPABASE_SECRET_KEY",
      "GMAIL_USER",
      "GMAIL_APP_PASSWORD",
    ];
    const missingEnvVars = requiredEnvVars.filter(
      (name) => !process.env[name]?.trim()
    );

    if (missingEnvVars.length > 0) {
      console.error("Send OTP configuration error:", {
        missingEnvVars,
      });

      return NextResponse.json(
        {
          error: `OTP email is not configured on the server. Missing: ${missingEnvVars.join(
            ", "
          )}.`,
        },
        { status: 503 }
      );
    }

    const secretKey = process.env.SUPABASE_SECRET_KEY;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      secretKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

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

    const otpHash = hashOTP(normalizedEmail, otp, secretKey);

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
        user: process.env.GMAIL_USER.trim(),
        pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, ""),
      },
    });

    try {
      await transporter.sendMail({
        from: `"NEXCLOUD Systems" <${process.env.GMAIL_USER.trim()}>`,
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
      const { error: deleteError } = await supabase
        .from("email_otps")
        .delete()
        .eq("email", normalizedEmail);

      if (deleteError) {
        console.error(
          "Failed to remove OTP after email delivery failed:",
          deleteError
        );
      }

      throw emailError;
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully!",
    });

  } catch (error) {
    console.error("Send OTP error:", error);

    const errorCode = error?.code;
    const errorMessage =
      typeof error?.message === "string" ? error.message.toLowerCase() : "";
    let responseMessage = "Unable to send OTP. Please try again.";

    if (errorCode === "EAUTH" || error?.responseCode === 535) {
      responseMessage =
        "The email provider rejected its credentials. Check GMAIL_USER and GMAIL_APP_PASSWORD in Vercel.";
    } else if (
      ["ENOTFOUND", "EAI_AGAIN", "ECONNECTION", "ETIMEDOUT"].includes(
        errorCode
      )
    ) {
      responseMessage =
        "Unable to connect to Gmail. Please try again later or check the email service configuration.";
    } else if (
      ["42P01", "PGRST205"].includes(errorCode) ||
      errorMessage.includes("email_otps")
    ) {
      responseMessage =
        "OTP storage is unavailable. Check that the email_otps table exists in Supabase.";
    } else if (
      errorMessage.includes("invalid api key") ||
      errorMessage.includes("invalid jwt")
    ) {
      responseMessage =
        "Supabase rejected the server credentials. Check SUPABASE_SECRET_KEY in Vercel.";
    }

    return NextResponse.json(
      { error: responseMessage },
      { status: 500 }
    );
  }
}
