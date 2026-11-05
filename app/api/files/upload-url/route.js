import { randomUUID } from "crypto";
import { authenticateRequest, serverError } from "../../../../lib/server/supabase";
import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  STORAGE_BUCKET,
  isValidFileName,
  sanitizeStorageFileName,
} from "../../../../lib/server/file-config";

export async function POST(request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const mimeType = body?.mimeType;
    const size = body?.size;

    if (
      !isValidFileName(name) ||
      typeof mimeType !== "string" ||
      !ALLOWED_FILE_TYPES.has(mimeType) ||
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      size > MAX_FILE_SIZE
    ) {
      return Response.json(
        { error: "This file name, type, or size is not allowed." },
        { status: 400 }
      );
    }

    const safeName = sanitizeStorageFileName(name);
    const storagePath = `${auth.user.id}/${randomUUID()}-${safeName}`;
    const { data, error } = await auth.supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });

    if (error) throw error;
    if (!data?.token) {
      throw new Error("Supabase did not return a signed upload token.");
    }

    return Response.json(
      { path: storagePath, token: data.token },
      { status: 201 }
    );
  } catch (error) {
    return serverError(error, "Create upload URL API error");
  }
}
