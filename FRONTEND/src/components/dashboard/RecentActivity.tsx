import {
  CheckCircle2,
  Clock3,
  Upload,
} from "lucide-react";

function RecentActivity() {
  const activities = [
    {
      student: "Rahul Sharma",
      action: "Practical 01 submitted",
      time: "Today · 09:42 PM",
      type: "success",
    },
    {
      student: "Aman Das",
      action: "Practical 01 submitted",
      time: "Today · 09:38 PM",
      type: "success",
    },
    {
      student: "Student list imported",
      action: "10 students detected",
      time: "Yesterday · 06:21 PM",
      type: "upload",
    },
    {
      student: "Rohan Singh",
      action: "Practical 01 pending",
      time: "Yesterday · 05:12 PM",
      type: "pending",
    },
  ];

  return (
    <section className="panel activity-panel">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">ACTIVITY</span>
          <h2>Recent activity</h2>
        </div>
      </div>

      <div className="activity-list">
        {activities.map((item, index) => {
          const Icon =
            item.type === "success"
              ? CheckCircle2
              : item.type === "upload"
                ? Upload
                : Clock3;

          return (
            <div className="activity-row" key={`${item.student}-${index}`}>
              <div className={`activity-icon ${item.type}`}>
                <Icon size={16} strokeWidth={1.8} />
              </div>

              <div className="activity-copy">
                <strong>{item.student}</strong>
                <span>{item.action}</span>
              </div>

              <time>{item.time}</time>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default RecentActivity;
