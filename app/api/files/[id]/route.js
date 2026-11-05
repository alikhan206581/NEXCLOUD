import { randomUUID } from "crypto";
import { authenticateRequest, serverError } from "../../../../lib/server/supabase";
import {
  STORAGE_BUCKET,
  isValidFileName,
  sanitizeStorageFileName,
} from "../../../../lib/server/file-config";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request, { params }) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      return Response.json({ error: "File not found." }, { status: 404 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!isValidFileName(name)) {
      return Response.json({ error: "Enter a valid file name." }, { status: 400 });
    }

    const { data: file, error: lookupError } = await auth.supabase
      .from("files")
      .select("id, name, storage_path")
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!file) {
      return Response.json({ error: "File not found." }, { status: 404 });
    }
    if (name === file.name) {
      return Response.json({ success: true });
    }

    const newPath = `${auth.user.id}/${randomUUID()}-${sanitizeStorageFileName(
      name
    )}`;
    const { error: copyError } = await auth.supabase.storage
      .from(STORAGE_BUCKET)
      .copy(file.storage_path, newPath);

    if (copyError) throw copyError;

    const { data: updatedRows, error: updateError } = await auth.supabase
      .from("files")
      .update({ name, storage_path: newPath })
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .select("id");

    if (updateError || !updatedRows?.length) {
      const { error: cleanupError } = await auth.supabase.storage
        .from(STORAGE_BUCKET)
        .remove([newPath]);
      if (cleanupError) {
        console.error("Failed to clean up copied file after rename failure:", cleanupError);
      }

      if (updateError) throw updateError;
      return Response.json({ error: "The file could not be renamed." }, { status: 409 });
    }

    const { error: removeError } = await auth.supabase.storage
      .from(STORAGE_BUCKET)
      .remove([file.storage_path]);

    if (removeError) {
      console.error("Old file cleanup failed after rename:", removeError);
    }

    return Response.json({ success: true });
  } catch (error) {
    return serverError(error, "Rename file API error");
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!UUID_PATTERN.test(id)) {
      return Response.json({ error: "File not found." }, { status: 404 });
    }

    const { data: file, error: lookupError } = await auth.supabase
      .from("files")
      .select("id, storage_path")
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!file) {
      return Response.json({ error: "File not found." }, { status: 404 });
    }

    const { error: storageError } = await auth.supabase.storage
      .from(STORAGE_BUCKET)
      .remove([file.storage_path]);

    if (storageError) throw storageError;

    const { data: deletedRows, error: deleteError } = await auth.supabase
      .from("files")
      .delete()
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .select("id");

    if (deleteError) {
      throw new Error(
        `Storage file was deleted, but its database record could not be deleted: ${deleteError.message}`
      );
    }
    if (!deletedRows?.length) {
      throw new Error("Storage file was deleted, but its database record was not found.");
    }

    return Response.json({ success: true });
  } catch (error) {
    return serverError(error, "Delete file API error");
  }
}
