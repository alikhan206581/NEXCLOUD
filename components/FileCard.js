
"use client";

import { useState } from "react";
import {
  FileText,
  Image,
  FileSpreadsheet,
  FileArchive,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Download,
} from "lucide-react";

const icons = {
  PDF: FileText,
  Image: Image,
  Excel: FileSpreadsheet,
  ZIP: FileArchive,
};

export default function FileCard({
  name,
  type,
  size,
  date,
  onPreview,
  onRename,
  onDelete,
  onDownload,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const Icon = icons[type] || FileText;

  function handleRename() {
    const newName = window.prompt(
      "Enter the new file name:",
      name
    );

    if (newName !== null && newName.trim()) {
      onRename(newName);
    }

    setMenuOpen(false);
  }

  return (
    <div className="file-row">
      <div className={`file-icon ${type.toLowerCase()}`}>
        <Icon size={22} />
      </div>

      <div className="file-name">
        <strong>{name}</strong>
        <span>{type} file</span>
      </div>

      <span className="file-size">{size}</span>
      <span className="file-date">{date}</span>

      <div className="file-actions">
        <button
          className="more-button"
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={`Actions for ${name}`}
          aria-expanded={menuOpen}
        >
          <MoreVertical size={20} />
        </button>

        {menuOpen && (
          <div className="file-menu">
            <button
              type="button"
              onClick={() => {
                onPreview();
                setMenuOpen(false);
              }}
            >
              <Eye size={16} />
              Preview
            </button>

            <button
              type="button"
              onClick={() => {
                onDownload();
                setMenuOpen(false);
              }}
            >
              <Download size={16} />
              Download
            </button>

            <button type="button" onClick={handleRename}>
              <Pencil size={16} />
              Rename
            </button>

            <button
              className="delete-action"
              type="button"
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
