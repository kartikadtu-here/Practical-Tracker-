import { Search, Bell, Command } from "lucide-react";

function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-search">
        <Search size={18} />
        <span>Search students, practicals...</span>

        <div className="search-shortcut">
          <Command size={12} />
          <span>K</span>
        </div>
      </div>

      <div className="topbar-actions">
        <div className="live-status">
          <span className="live-dot" />
          Live
        </div>

        <button className="icon-button" aria-label="Notifications">
          <Bell size={19} strokeWidth={1.8} />
          <span className="notification-dot" />
        </button>

        <div className="topbar-avatar">DT</div>
      </div>
    </header>
  );
}

export default Topbar;
