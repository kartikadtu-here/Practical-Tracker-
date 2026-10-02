import {
  Upload,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  ArrowUpRight,
} from "lucide-react";

function QuickActions() {
  const actions = [
    {
      label: "Import students",
      description: "Upload a student list",
      icon: Upload,
    },
    {
      label: "Mark submissions",
      description: "Update practical status",
      icon: ClipboardCheck,
    },
    {
      label: "Export Excel",
      description: "Download tracker data",
      icon: FileSpreadsheet,
    },
    {
      label: "Generate report",
      description: "Create a PDF report",
      icon: FileText,
    },
  ];

  return (
    <section className="panel quick-panel">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">SHORTCUTS</span>
          <h2>Quick actions</h2>
        </div>
      </div>

      <div className="quick-actions">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button className="quick-action" key={action.label}>
              <div className="quick-icon">
                <Icon size={18} strokeWidth={1.8} />
              </div>

              <div className="quick-copy">
                <strong>{action.label}</strong>
                <span>{action.description}</span>
              </div>

              <ArrowUpRight size={16} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default QuickActions;
