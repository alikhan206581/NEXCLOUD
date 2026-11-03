
"use client";

import { Search, Bell } from "lucide-react";

export default function Navbar({ onSearch }) {
  return (
    <header className="navbar">
      <div className="breadcrumb">
        Workspace / <span>Dashboard</span>
      </div>

      <div className="navbar-actions">
        <div className="search-box">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search your files..."
            onChange={(event) => onSearch(event.target.value)}
          />
        </div>

        <button className="icon-button" type="button">
          <Bell size={20} />
        </button>

        <button className="profile-avatar" type="button">
          A
        </button>
      </div>
    </header>
  );
}
