

"use client";

import { useEffect, useState } from "react";
import { X, FileText, LogOut, Cloud } from "lucide-react";

import supabase from "../config/supabaseClient";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import DashboardStats from "../components/DashboardStats";
import FileCard from "../components/FileCard";
import UploadBox from "../components/UploadBox";

export default function Home() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [signupStep, setSignupStep] = useState("details");
  const [resendSeconds, setResendSeconds] = useState(0);

  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [activeCategory, setActiveCategory] = useState("All");

  // AUTHENTICATION SESSION
  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError(error.message);

      setSession(data?.session ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // OTP RESEND COUNTDOWN
  useEffect(() => {
    if (resendSeconds <= 0) return;

    const timer = setTimeout(() => {
      setResendSeconds((seconds) => seconds - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [resendSeconds]);

  // LOAD FILES FROM SUPABASE
  async function loadFiles() {
    setFilesLoading(true);
    setFilesError("");

    try {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const formattedFiles = data.map((file) => {
        const mime = file.mime_type || "";

        let type = "Document";

        if (mime.startsWith("image/")) {
          type = "Image";
        } else if (mime.includes("pdf")) {
          type = "PDF";
        } else if (
          mime.includes("spreadsheet") ||
          mime.includes("excel")
        ) {
          type = "Excel";
        } else if (mime.includes("zip")) {
          type = "ZIP";
        }

        return {
          id: file.id,
          name: file.name,
          type,
          size:
            file.size >= 1024 * 1024
              ? `${(file.size / (1024 * 1024)).toFixed(2)} MB`
              : `${(file.size / 1024).toFixed(2)} KB`,
          date: new Date(file.created_at).toLocaleDateString(),
          storage_path: file.storage_path,
          mime_type: file.mime_type,
        };
      });

      setFiles(formattedFiles);
    } catch (error) {
      console.error("File loading error:", error);
      setFilesError(error.message || "Unable to load files.");
    } finally {
      setFilesLoading(false);
    }
  }

  // LOAD FILES WHEN LOGGED IN
  useEffect(() => {
    if (session) {
      loadFiles();
    } else {
      setFiles([]);
    }
  }, [session]);

  // DOWNLOAD FILE
  async function handleDownload(file) {
    try {
      if (!file.storage_path) {
        throw new Error("File storage path is missing.");
      }

      const { data, error } = await supabase.storage
        .from("nextcloud-files")
        .createSignedUrl(file.storage_path, 60, {
          download: file.name,
        });

      if (error) throw error;

      if (!data?.signedUrl) {
        throw new Error("Could not generate a download link.");
      }

      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = file.name;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Download error:", error);
      alert("Download failed: " + error.message);
    }
  }

  // FULL-SCREEN PREVIEW
  async function handlePreview(file) {
    setPreviewFile(file);
    setPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(true);

    try {
      if (!file.storage_path) {
        throw new Error("File storage path is missing.");
      }

      const { data, error } = await supabase.storage
        .from("nextcloud-files")
        .createSignedUrl(file.storage_path, 300);

      if (error) throw error;

      if (!data?.signedUrl) {
        throw new Error("Could not generate preview link.");
      }

      setPreviewUrl(data.signedUrl);
    } catch (error) {
      console.error("Preview error:", error);
      setPreviewError(
        error.message || "Unable to preview this file."
      );
    } finally {
      setPreviewLoading(false);
    }
  }

  // CLOSE PREVIEW
  function closePreview() {
    setPreviewFile(null);
    setPreviewUrl("");
    setPreviewError("");
    setPreviewLoading(false);
  }

  // RENAME FILE PERMANENTLY
  async function renameFile(file, newName) {
    try {
      const cleanName = newName.trim().replace(/[\\/]/g, "-");

      if (!cleanName || cleanName === file.name) return;

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please log in again.");

      const newPath = `${user.id}/${crypto.randomUUID()}-${cleanName}`;

      const { error: copyError } = await supabase.storage
        .from("nextcloud-files")
        .copy(file.storage_path, newPath);

      if (copyError) throw copyError;

      const folder = user.id;

      const { data: objects, error: listError } =
        await supabase.storage
          .from("nextcloud-files")
          .list(folder);

      if (listError) {
        await supabase.storage
          .from("nextcloud-files")
          .remove([newPath]);

        throw listError;
      }

      const newFileName = newPath.split("/").pop();

      if (!objects?.some((item) => item.name === newFileName)) {
        await supabase.storage
          .from("nextcloud-files")
          .remove([newPath]);

        throw new Error("New file could not be verified in Storage.");
      }

      const { data: updatedRows, error: updateError } =
        await supabase
          .from("files")
          .update({
            name: cleanName,
            storage_path: newPath,
          })
          .eq("id", file.id)
          .eq("user_id", user.id)
          .select("id");

      if (updateError || !updatedRows?.length) {
        await supabase.storage
          .from("nextcloud-files")
          .remove([newPath]);

        throw updateError || new Error("Database record was not updated.");
      }

      const { error: removeError } = await supabase.storage
        .from("nextcloud-files")
        .remove([file.storage_path]);

      if (removeError) {
        console.error("Old file cleanup failed:", removeError);
      }

      await loadFiles();
      alert("File renamed successfully!");
    } catch (error) {
      console.error("Rename error:", error);
      alert("Rename failed: " + error.message);
    }
  }

  // DELETE FILE PERMANENTLY
  async function deleteFile(file) {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${file.name}"?`
    );

    if (!confirmed) return;

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user) throw new Error("Please log in again.");

      const { error: storageError } = await supabase.storage
        .from("nextcloud-files")
        .remove([file.storage_path]);

      if (storageError) throw storageError;

      const { error: databaseError } = await supabase
        .from("files")
        .delete()
        .eq("id", file.id)
        .eq("user_id", user.id);

      if (databaseError) {
        throw new Error(
          "Storage file was deleted, but its database record could not be deleted: " +
            databaseError.message
        );
      }

      if (previewFile?.id === file.id) {
        closePreview();
      }

      await loadFiles();
      alert("File deleted successfully!");
    } catch (error) {
      console.error("Delete error:", error);
      alert("Delete failed: " + error.message);
    }
  }

  // LOGIN AND SEND SIGNUP OTP
  async function handleAuth(event) {
    event.preventDefault();

    setAuthError("");
    setAuthMessage("");
    setSubmitting(true);

    try {
      if (authMode === "signup") {
        const response = await fetch("/api/auth/send-otp", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.error || "Unable to send verification code."
          );
        }

        setSignupStep("otp");
        setOtp("");
        setResendSeconds(60);
        setAuthMessage(
          "A six-digit verification code has been sent to your email."
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          if (
            error.message.toLowerCase().includes("email not confirmed")
          ) {
            throw new Error(
              "This account needs email verification. Please contact support."
            );
          }

          throw error;
        }
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  // VERIFY OTP AND CREATE ACCOUNT
  async function handleVerifyOTP(event) {
    event.preventDefault();

    setAuthError("");
    setAuthMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          name: fullName.trim(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "OTP verification failed."
        );
      }

      const { error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

      if (loginError) {
        setAuthMessage(
          "Your account was created. Please sign in using your email and password."
        );
        setAuthMode("login");
        setSignupStep("details");
        setPassword("");
        setOtp("");
        return;
      }

      setAuthMessage(
        "Your NEXCLOUD account has been created successfully!"
      );
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  // RESEND OTP
  async function handleResendOTP() {
    if (resendSeconds > 0 || submitting) return;

    setAuthError("");
    setAuthMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to resend verification code."
        );
      }

      setOtp("");
      setResendSeconds(60);
      setAuthMessage("A new verification code has been sent.");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  // LOGOUT
  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
    }
  }

  // FILE CATEGORIES
  const categories = {
    All: ["PDF", "Image", "Excel", "ZIP", "Document"],
    Documents: ["PDF", "Document"],
    Images: ["Image"],
    Spreadsheets: ["Excel"],
    Archives: ["ZIP"],
  };

  // SEARCH AND FILTER
  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const matchesCategory =
      categories[activeCategory]?.includes(file.type);

    return matchesSearch && matchesCategory;
  });

  // AUTH LOADING SCREEN
  if (authLoading) {
    return (
      <div className="auth-screen">
        <p>Loading NEXCLOUD...</p>
      </div>
    );
  }

  // LOGIN AND SIGNUP SCREEN
  if (!session) {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div className="auth-logo">
            <Cloud size={32} />
          </div>

          <h1>NEXCLOUD</h1>

          <p className="auth-subtitle">
            Your business files. One secure cloud.
          </p>

          <h2>
            {authMode === "login"
              ? "Welcome Back"
              : signupStep === "otp"
              ? "Verify Your Email"
              : "Create Your Account"}
          </h2>

          <p className="auth-description">
            {authMode === "login"
              ? "Sign in to access your cloud dashboard."
              : signupStep === "otp"
              ? "Enter the verification code sent to your email."
              : "Create an account to get started with NEXCLOUD."}
          </p>

          <form
            onSubmit={
              signupStep === "otp" && authMode === "signup"
                ? handleVerifyOTP
                : handleAuth
            }
            className="auth-form"
          >
            {authMode === "signup" && signupStep === "details" && (
              <>
                <label>Full Name</label>

                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(event.target.value)
                  }
                  autoComplete="name"
                  minLength={2}
                  required
                />
              </>
            )}

            <label>Email Address</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              readOnly={
                authMode === "signup" && signupStep === "otp"
              }
              required
            />

            {!(authMode === "signup" && signupStep === "otp") && (
              <>
                <label>Password</label>

                <input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  minLength={authMode === "signup" ? 8 : 6}
                  autoComplete={
                    authMode === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  required
                />
              </>
            )}

            {authMode === "signup" && signupStep === "otp" && (
              <>
                <label>Six-Digit Verification Code</label>

                <input
                  type="text"
                  placeholder="Enter your six-digit OTP"
                  value={otp}
                  onChange={(event) =>
                    setOtp(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6)
                    )
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                />

                <p className="auth-description">
                  Check your inbox and spam folder for the NEXCLOUD
                  verification code.
                </p>

                <button
                  type="button"
                  className="view-button"
                  onClick={handleResendOTP}
                  disabled={resendSeconds > 0 || submitting}
                >
                  {resendSeconds > 0
                    ? `Resend code in ${resendSeconds}s`
                    : "Resend verification code"}
                </button>

                <button
                  type="button"
                  className="view-button"
                  onClick={() => {
                    setSignupStep("details");
                    setOtp("");
                    setAuthError("");
                    setAuthMessage("");
                  }}
                >
                  Change registration details
                </button>
              </>
            )}

            {authError && (
              <p className="auth-error">{authError}</p>
            )}

            {authMessage && (
              <p className="auth-message">{authMessage}</p>
            )}

            <button
              className="primary-button auth-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Please wait..."
                : authMode === "login"
                ? "Sign In"
                : signupStep === "otp"
                ? "Verify Email & Create Account"
                : "Send Verification Code"}
            </button>
          </form>

          <p className="auth-switch">
            {authMode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}

            <button
              type="button"
              onClick={() => {
                setAuthMode(
                  authMode === "login" ? "signup" : "login"
                );
                setSignupStep("details");
                setFullName("");
                setOtp("");
                setPassword("");
                setResendSeconds(0);
                setAuthError("");
                setAuthMessage("");
              }}
            >
              {authMode === "login" ? "Sign Up" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // MAIN DASHBOARD
  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="main-content">
        <Navbar onSearch={setSearchQuery} />

        <section className="dashboard-content">
          <div className="welcome-section">
            <div>
              <h1>Welcome to NEXCLOUD</h1>

              <p>
                Manage your business files from one secure place.
              </p>

              <p>{session.user.email}</p>
            </div>

            <button
              className="view-button"
              type="button"
              onClick={handleLogout}
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>

          <DashboardStats />

          <UploadBox onUploadComplete={loadFiles} />

          <section className="files-section">
            <div className="section-heading">
              <h2>Recent Files</h2>

              <div className="category-filters">
                {Object.keys(categories).map((category) => (
                  <button
                    key={category}
                    className={`category-btn ${
                      activeCategory === category ? "active" : ""
                    }`}
                    onClick={() => setActiveCategory(category)}
                    type="button"
                  >
                    {category}
                  </button>
                ))}
              </div>

              <button
                className="view-button"
                type="button"
                onClick={loadFiles}
                disabled={filesLoading}
              >
                {filesLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="file-table">
              <div className="file-header">
                <span>Name</span>
                <span>Size</span>
                <span>Modified</span>
                <span></span>
              </div>

              {filesLoading ? (
                <p className="empty-files">
                  Loading your cloud files...
                </p>
              ) : filesError ? (
                <p className="auth-error">{filesError}</p>
              ) : filteredFiles.length > 0 ? (
                filteredFiles.map((file) => (
                  <FileCard
                    key={file.id}
                    {...file}
                    onPreview={() => handlePreview(file)}
                    onDownload={() => handleDownload(file)}
                    onRename={(newName) =>
                      renameFile(file, newName)
                    }
                    onDelete={() => deleteFile(file)}
                  />
                ))
              ) : (
                <p className="empty-files">
                  No files found. Upload your first file!
                </p>
              )}
            </div>
          </section>
        </section>
      </main>

      {/* FULL-SCREEN PDF AND IMAGE PREVIEW */}
      {previewFile && (
        <div className="fullscreen-preview">
          <header className="preview-toolbar">
            <div className="preview-file-info">
              <FileText size={22} />
              <span>{previewFile.name}</span>
            </div>

            <div className="preview-toolbar-actions">
              <button
                type="button"
                onClick={() => handleDownload(previewFile)}
                title="Download file"
              >
                Download
              </button>

              <button
                type="button"
                className="preview-close-full"
                onClick={closePreview}
                aria-label="Close preview"
                title="Close preview"
              >
                <X size={24} />
              </button>
            </div>
          </header>

          <main className="fullscreen-preview-content">
            {previewLoading ? (
              <p>Loading preview...</p>
            ) : previewError ? (
              <p className="auth-error">{previewError}</p>
            ) : previewUrl &&
              previewFile.mime_type === "application/pdf" ? (
              <iframe
                src={previewUrl}
                title={previewFile.name}
                className="fullscreen-pdf"
              />
            ) : previewUrl &&
              previewFile.mime_type?.startsWith("image/") ? (
              <img
                src={previewUrl}
                alt={previewFile.name}
                className="fullscreen-image"
              />
            ) : previewUrl ? (
              <p>
                Preview is not available for this file type.
                You can download it instead.
              </p>
            ) : null}
          </main>
        </div>
      )}
    </div>
  );
}
