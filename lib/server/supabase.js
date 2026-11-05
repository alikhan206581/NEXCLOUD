import { createClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";

export function createAdminSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Server configuration is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY."
    );
  }

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function authenticateRequest(request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    return {
      error: "Authentication is required.",
      status: 401,
    };
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return {
      error: "Your session is invalid or has expired. Please sign in again.",
      status: 401,
    };
  }

  return { supabase, user: data.user };
}

export function serverError(error, context) {
  unstable_rethrow(error);
  console.error(`${context}:`, error);

  return Response.json(
    { error: "The server could not complete this request. Please try again." },
    { status: 500 }
  );
}
