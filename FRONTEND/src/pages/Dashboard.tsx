import SQLBackground from "../components/sql/SQLBackground";
import StatCard from "../components/dashboard/StatCard";
import PracticalProgress from "../components/dashboard/PracticalProgress";
import QuickActions from "../components/dashboard/QuickActions";
import RecentActivity from "../components/dashboard/RecentActivity";

export default function Dashboard() {
  return (
    <>
      <SQLBackground />

      <div className="dashboard-content">
        <section className="dashboard-hero">
          <div>
            <div className="eyebrow">
              <span className="eyebrow-dot" />
              DBMS PRACTICAL TRACKER
            </div>

            <h1>
              Good evening,
              <br />
              <span>Teacher.</span>
            </h1>

            <p>
              Keep track of practical submissions, student progress,
              and everything happening in your DBMS class.
            </p>
          </div>

          <div className="hero-meta">
            <span>Academic workspace</span>
            <strong>2026 · Semester 3</strong>
          </div>
        </section>

        <section className="stats-grid">
          <StatCard
            icon="students"
            value="3"
            label="Total Students"
            description="Active students"
          />

          <StatCard
            icon="practical"
            value="1"
            label="Practicals"
            description="Currently active"
          />

          <StatCard
            icon="submitted"
            value="2"
            label="Submitted"
            description="Out of 3 students"
          />

          <StatCard
            icon="pending"
            value="1"
            label="Pending"
            description="Needs attention"
          />
        </section>

        <section className="dashboard-grid">
          <PracticalProgress />
          <QuickActions />
        </section>

        <RecentActivity />
      </div>
    </>
  );
}
