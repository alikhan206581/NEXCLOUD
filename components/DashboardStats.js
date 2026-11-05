"use client";

import { Cloud, Folder } from "lucide-react";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  );
  const value = bytes / 1024 ** unitIndex;

  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: unitIndex === 0 ? 0 : 2,
  })} ${units[unitIndex]}`;
}

export default function DashboardStats({ stats, error }) {
  const cards = [
    {
      title: "Storage Used",
      value: stats ? formatBytes(stats.totalBytes) : "—",
      detail: "Across your files",
      icon: Cloud,
    },
    {
      title: "Total Files",
      value: stats ? stats.totalFiles.toLocaleString("en-US") : "—",
      detail: "Files in your account",
      icon: Folder,
    },
  ];

  return (
    <>
      <div className="stats-grid">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div className="stat-card" key={card.title}>
              <div className="stat-top">
                <span>{card.title}</span>
                <Icon size={21} />
              </div>

              <h2>{card.value}</h2>
              <p>{card.detail}</p>
            </div>
          );
        })}
      </div>
      {error && <p className="auth-error">{error}</p>}
    </>
  );
}
