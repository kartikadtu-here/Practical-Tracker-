import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Upload,
  FileText,
  History,
  Settings,
} from "lucide-react";

function Sidebar() {
  const navigation = [
    { label: "Dashboard", icon: LayoutDashboard, active: true },
    { label: "Students", icon: Users },
    { label: "Submission Tracker", icon: ClipboardCheck },
    { label: "Import Students", icon: Upload },
    { label: "Practicals", icon: FileText },
    { label: "History", icon: History },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">D</div>
        <div>
          <strong>DBMS</strong>
          <span>Practical Tracker</span>
        </div>
      </div>

      <div className="sidebar-section-label">WORKSPACE</div>

      <nav className="sidebar-nav">
        {navigation.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              className={`nav-item ${item.active ? "active" : ""}`}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <button className="nav-item">
          <Settings size={18} strokeWidth={1.8} />
          <span>Settings</span>
        </button>

        <div className="teacher-card">
          <div className="teacher-avatar">DT</div>
          <div>
            <strong>DBMS Teacher</strong>
            <span>Teacher account</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
