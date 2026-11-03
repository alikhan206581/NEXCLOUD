
import {
  LayoutDashboard,
  FolderOpen,
  Share2,
  Star,
  Trash2,
  Settings,
  Cloud,
  Users
} from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="sidebar">

      <div className="brand">
        <div className="brand-icon">
          <Cloud size={25} />
        </div>
        <h2>NEX<span>CLOUD</span></h2>
      </div>

      <div className="workspace">
        <span className="workspace-dot"></span>
        Business Workspace
      </div>

      <p className="menu-label">WORKSPACE</p>

      <nav className="sidebar-nav">

        <a className="nav-link active" href="#">
          <LayoutDashboard size={19} />
          Dashboard
        </a>

        <a className="nav-link" href="#">
          <FolderOpen size={19} />
          My Files
        </a>

        <a className="nav-link" href="#">
          <Share2 size={19} />
          Shared Files
        </a>

        <a className="nav-link" href="#">
          <Star size={19} />
          Favorites
        </a>

        <a className="nav-link" href="#">
          <Users size={19} />
          Team Members
        </a>

        <a className="nav-link" href="#">
          <Trash2 size={19} />
          Trash
        </a>

      </nav>

      <div className="sidebar-bottom">
        <a className="nav-link" href="#">
          <Settings size={19} />
          Settings
        </a>
      </div>

    </aside>
  );
}
