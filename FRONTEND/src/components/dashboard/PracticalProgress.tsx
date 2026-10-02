import { ArrowRight, CheckCircle2 } from "lucide-react";

function PracticalProgress() {
  const submitted = 2;
  const total = 3;
  const progress = (submitted / total) * 100;

  return (
    <section className="panel practical-panel">
      <div className="panel-header">
        <div>
          <span className="panel-kicker">CURRENT PRACTICAL</span>
          <h2>DBMS Introduction</h2>
        </div>

        <button className="panel-link">
          View details
          <ArrowRight size={15} />
        </button>
      </div>

      <div className="practical-meta">
        <span>Practical 01</span>
        <span>3 students</span>
      </div>

      <div className="progress-area">
        <div className="progress-heading">
          <strong>{submitted} submitted</strong>
          <span>{total - submitted} pending</span>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="progress-footer">
          <span>{progress.toFixed(0)}% complete</span>
          <span>Submission progress</span>
        </div>
      </div>

      <div className="submission-preview">
        <div className="student-mini">
          <div className="student-mini-avatar">RS</div>
          <div>
            <strong>Rahul Sharma</strong>
            <span>Roll 01</span>
          </div>
          <CheckCircle2 size={17} className="success-icon" />
        </div>

        <div className="student-mini">
          <div className="student-mini-avatar">AD</div>
          <div>
            <strong>Aman Das</strong>
            <span>Roll 02</span>
          </div>
          <CheckCircle2 size={17} className="success-icon" />
        </div>

        <div className="student-mini pending">
          <div className="student-mini-avatar">RS</div>
          <div>
            <strong>Rohan Singh</strong>
            <span>Roll 03</span>
          </div>
          <span className="pending-label">Pending</span>
        </div>
      </div>
    </section>
  );
}

export default PracticalProgress;
