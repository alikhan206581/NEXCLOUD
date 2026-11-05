
"use client";

import { useRef, useState } from "react";
import {
  UploadCloud,
  File,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

import supabase from "../config/supabaseClient";
import { apiRequest } from "../lib/api-client";

export default function UploadBox({ onUploadComplete }) {
  const inputRef = useRef(null);

  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);

  const [uploading, setUploading] = useState({});
  const [progress, setProgress] = useState({});
  const [errors, setErrors] = useState({});

  function addFiles(selectedFiles) {
    const newFiles = Array.from(selectedFiles).map((file) => ({
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      file,
    }));

    setFiles((previous) => [...previous, ...newFiles]);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  async function startUpload(id, file) {
    setUploading((previous) => ({ ...previous, [id]: true }));
    setErrors((previous) => ({ ...previous, [id]: "" }));
    setProgress((previous) => ({ ...previous, [id]: 0 }));

    try {
      if (file.size > 50 * 1024 * 1024) {
        throw new Error("File size cannot exceed 50 MB.");
      }

      const allowedTypes = [
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
      ];

      if (!allowedTypes.includes(file.type)) {
        throw new Error("This file type is not allowed.");
      }

      const { path, token } = await apiRequest("/api/files/upload-url", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      });

      setProgress((previous) => ({ ...previous, [id]: 30 }));

      const { error: storageError } = await supabase.storage
        .from("nextcloud-files")
        .uploadToSignedUrl(path, token, file, { contentType: file.type });

      if (storageError) {
        console.error("STORAGE UPLOAD ERROR:", storageError);
        throw storageError;
      }

      setProgress((previous) => ({ ...previous, [id]: 75 }));

      await apiRequest("/api/files", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          storagePath: path,
          mimeType: file.type,
          size: file.size,
        }),
      });

      setProgress((previous) => ({ ...previous, [id]: 100 }));

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      setErrors((previous) => ({
        ...previous,
        [id]: error.message || "Upload failed.",
      }));
    } finally {
      setUploading((previous) => ({ ...previous, [id]: false }));
    }
  }

  function removeFile(id) {
    if (uploading[id]) return;

    setFiles((previous) => previous.filter((item) => item.id !== id));

    setProgress((previous) => {
      const updated = { ...previous };
      delete updated[id];
      return updated;
    });

    setErrors((previous) => {
      const updated = { ...previous };
      delete updated[id];
      return updated;
    });
  }

  return (
    <div
      className={`upload-box ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="upload-icon">
        <UploadCloud size={30} />
      </div>

      <h3>Upload your files</h3>

      <p>Drag and drop your files here or click to browse.</p>

      <button
        className="primary-button"
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        Upload Files
      </button>

      {files.length > 0 && (
        <div className="selected-files">
          <h4>Selected Files ({files.length})</h4>

          {files.map(({ id, file }) => (
            <div className="selected-file" key={id}>
              <File size={20} />

              <div className="selected-file-info">
                <strong>{file.name}</strong>

                <span>
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </span>

                {progress[id] !== undefined && (
                  <div className="upload-progress">
                    <div
                      className="upload-progress-fill"
                      style={{ width: `${progress[id]}%` }}
                    />
                  </div>
                )}

                {errors[id] && (
                  <small className="auth-error">
                    <AlertCircle size={13} /> {errors[id]}
                  </small>
                )}

                {progress[id] === 100 && !errors[id] && (
                  <small className="auth-message">
                    Cloud upload successful!
                  </small>
                )}
              </div>

              {progress[id] === 100 && !errors[id] ? (
                <CheckCircle size={20} />
              ) : (
                <button
                  type="button"
                  disabled={uploading[id]}
                  onClick={() => startUpload(id, file)}
                >
                  {uploading[id]
                    ? `${progress[id] || 0}%`
                    : "Upload"}
                </button>
              )}

              <button
                type="button"
                disabled={uploading[id]}
                onClick={() => removeFile(id)}
                aria-label={`Remove ${file.name}`}
              >
                <X size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
