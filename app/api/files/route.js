import { authenticateRequest, serverError } from "../../../lib/server/supabase";
import {
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE,
  STORAGE_BUCKET,
  isValidFileName,
} from "../../../lib/server/file-config";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const pageSize = 1000;
    const files = [];
    let offset = 0;

    while (true) {
      const { data, error } = await auth.supabase
        .from("files")
        .select("id, name, storage_path, mime_type, size, created_at")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      files.push(...data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }

    return Response.json({ files });
  } catch (error) {
    return serverError(error, "List files API error");
  }
}

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

    const { name, storagePath, mimeType, size } = body ?? {};
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanPath = typeof storagePath === "string" ? storagePath : "";

    if (
      !isValidFileName(cleanName) ||
      !cleanPath.startsWith(`${auth.user.id}/`) ||
      typeof mimeType !== "string" ||
      !ALLOWED_FILE_TYPES.has(mimeType) ||
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      size > MAX_FILE_SIZE
    ) {
      return Response.json(
        { error: "The uploaded file details are invalid." },
        { status: 400 }
      );
    }

    const pathParts = cleanPath.split("/");
    if (
      pathParts.length !== 2 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-/i.test(
        pathParts[1]
      )
    ) {
      return Response.json(
        { error: "The uploaded file path is invalid." },
        { status: 400 }
      );
    }

    const { data: objects, error: storageError } = await auth.supabase.storage
      .from(STORAGE_BUCKET)
      .list(auth.user.id, { search: pathParts[1], limit: 10 });

    if (storageError) throw storageError;

    const uploadedObject = objects?.find((object) => object.name === pathParts[1]);
    if (
      !uploadedObject ||
      Number(uploadedObject.metadata?.size) !== size ||
      uploadedObject.metadata?.mimetype !== mimeType
    ) {
      return Response.json(
        { error: "The uploaded file could not be verified." },
        { status: 400 }
      );
    }

    const { data, error } = await auth.supabase
      .from("files")
      .insert({
        user_id: auth.user.id,
        name: cleanName,
        storage_path: cleanPath,
        mime_type: mimeType,
        size,
      })
      .select("id, name, storage_path, mime_type, size, created_at")
      .single();

    if (error) throw error;

    return Response.json({ file: data }, { status: 201 });
  } catch (error) {
    return serverError(error, "Create file API error");
  }
}
