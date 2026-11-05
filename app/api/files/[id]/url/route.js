import { authenticateRequest, serverError } from "../../../../../lib/server/supabase";

const STORAGE_BUCKET = "nextcloud-files";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request, { params }) {
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
      .select("name, storage_path")
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!file) {
      return Response.json({ error: "File not found." }, { status: 404 });
    }

    const download = new URL(request.url).searchParams.get("download") === "true";
    const { data, error } = await auth.supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(file.storage_path, download ? 60 : 300, {
        ...(download ? { download: file.name } : {}),
      });

    if (error) throw error;
    if (!data?.signedUrl) {
      throw new Error("Supabase did not return a signed file URL.");
    }

    return Response.json({ url: data.signedUrl });
  } catch (error) {
    return serverError(error, "Create signed file URL API error");
  }
}
