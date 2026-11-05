export const STORAGE_BUCKET = "nextcloud-files";
export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "text/plain",
]);

export function isValidFileName(name) {
  return (
    typeof name === "string" &&
    name.trim().length > 0 &&
    name.trim().length <= 255 &&
    !/[\\/\u0000-\u001f]/.test(name.trim())
  );
}

export function sanitizeStorageFileName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
