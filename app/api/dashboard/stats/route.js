import { authenticateRequest, serverError } from "../../../../lib/server/supabase";

export async function GET(request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.error) {
      return Response.json({ error: auth.error }, { status: auth.status });
    }

    const pageSize = 1000;
    let offset = 0;
    let totalFiles = 0;
    let totalBytes = 0;

    while (true) {
      const { data, error } = await auth.supabase
        .from("files")
        .select("size")
        .eq("user_id", auth.user.id)
        .range(offset, offset + pageSize - 1);

      if (error) throw error;

      totalFiles += data.length;
      totalBytes += data.reduce(
        (total, file) => total + Number(file.size),
        0
      );

      if (data.length < pageSize) break;
      offset += pageSize;
    }

    return Response.json({
      totalFiles,
      totalBytes,
    });
  } catch (error) {
    return serverError(error, "Dashboard stats API error");
  }
}
