import { useEffect, useMemo, useState } from "react";
import {
  Database,
  GitBranch,
  Play,
  Search,
  Table2,
  Terminal,
  UserRound,
  X,
} from "lucide-react";

type QueryType = "SELECT" | "WHERE" | "JOIN" | "UPDATE" | "INSERT";

type Query = {
  type: QueryType;
  sql: string;
  title: string;
  description: string;
  result: string;
};

const queries: Query[] = [
  {
    type: "SELECT",
    sql: "SELECT * FROM students;",
    title: "SELECT",
    description: "Reads rows from the students table.",
    result: "Returns every student stored in the table.",
  },
  {
    type: "WHERE",
    sql: "SELECT * FROM students WHERE submitted = 1;",
    title: "WHERE",
    description: "Filters records using a condition.",
    result: "Returns only students who submitted their practical.",
  },
  {
    type: "JOIN",
    sql: "SELECT students.name, submissions.submitted FROM students JOIN submissions ON students.id = submissions.student_id;",
    title: "JOIN",
    description: "Combines related records from multiple tables.",
    result: "Connects students with their submission status.",
  },
  {
    type: "UPDATE",
    sql: "UPDATE submissions SET submitted = 1 WHERE student_id = '01';",
    title: "UPDATE",
    description: "Changes an existing record.",
    result: "Marks a student's practical as submitted.",
  },
  {
    type: "INSERT",
    sql: "INSERT INTO students (roll_number, name) VALUES ('04', 'Priya Sharma');",
    title: "INSERT",
    description: "Adds a new record to a table.",
    result: "Creates a new student record.",
  },
];

const students = [
  { id: "01", name: "Rahul Sharma", submitted: true },
  { id: "02", name: "Aman Das", submitted: true },
  { id: "03", name: "Rohan Singh", submitted: false },
];

export default function SQLBackground() {
  const [activeQuery, setActiveQuery] = useState<Query>(queries[0]);
  const [running, setRunning] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [pulse, setPulse] = useState(0);

  const nodes = useMemo(
    () =>
      Array.from({ length: 26 }, (_, index) => ({
        id: index,
        x: 4 + ((index * 37) % 92),
        y: 7 + ((index * 61) % 86),
        delay: (index % 7) * 0.45,
        size: index % 5 === 0 ? 5 : 3,
      })),
    []
  );

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPulse((value) => value + 1);
    }, 2800);

    return () => window.clearInterval(timer);
  }, []);

  const runQuery = (query: Query) => {
    setActiveQuery(query);
    setRunning(true);
    setShowPanel(true);

    window.setTimeout(() => {
      setRunning(false);
    }, 1700);
  };

  return (
    <>
      <div className="sql-background" aria-hidden="true">
        <div className="sql-grid" />

        <div className="sql-glow sql-glow-one" />
        <div className="sql-glow sql-glow-two" />

        <div className={`sql-network ${running ? "is-running" : ""}`}>
          <svg
            className="sql-lines"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {nodes.slice(0, 18).map((node, index) => {
              const target = nodes[(index * 3 + 5) % nodes.length];

              return (
                <line
                  key={node.id}
                  x1={node.x}
                  y1={node.y}
                  x2={target.x}
                  y2={target.y}
                />
              );
            })}
          </svg>

          {nodes.map((node) => (
            <span
              key={node.id}
              className="sql-node"
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                width: `${node.size}px`,
                height: `${node.size}px`,
                animationDelay: `${node.delay}s`,
              }}
            />
          ))}

          <div className="sql-table sql-table-students">
            <div className="sql-table-head">
              <UserRound size={12} />
              students
            </div>

            <div className="sql-table-row">
              <span>01</span>
              <span>Rahul</span>
            </div>

            <div className="sql-table-row">
              <span>02</span>
              <span>Aman</span>
            </div>

            <div className="sql-table-row">
              <span>03</span>
              <span>Rohan</span>
            </div>
          </div>

          <div className="sql-table sql-table-submissions">
            <div className="sql-table-head">
              <Table2 size={12} />
              submissions
            </div>

            <div className="sql-table-row">
              <span>01</span>
              <span className="sql-success-dot" />
            </div>

            <div className="sql-table-row">
              <span>02</span>
              <span className="sql-success-dot" />
            </div>

            <div className="sql-table-row">
              <span>03</span>
              <span className="sql-pending-dot" />
            </div>
          </div>

          <div className="sql-table sql-table-practicals">
            <div className="sql-table-head">
              <Database size={12} />
              practicals
            </div>

            <div className="sql-table-row">
              <span>01</span>
              <span>DBMS Intro</span>
            </div>

            <div className="sql-table-row">
              <span>02</span>
              <span>ER Model</span>
            </div>
          </div>

          {running && (
            <>
              <div className="sql-packet packet-one">
                <Terminal size={11} />
                SELECT
              </div>

              <div className="sql-packet packet-two">
                <GitBranch size={11} />
                JOIN
              </div>

              <div className="sql-packet packet-three">
                <Search size={11} />
                WHERE
              </div>
            </>
          )}

          <div className="sql-floating-query">
            <span className="sql-terminal-dot" />
            <code>{activeQuery.sql}</code>
          </div>

          <div className="sql-background-label">
            <span>LIVE DATABASE VISUALIZER</span>
            <strong>SQL ENGINE</strong>
          </div>
        </div>
      </div>

      <div className="sql-interaction">
        <div className="sql-interaction-top">
          <div>
            <span className="sql-mini-label">DATABASE LAB</span>
            <strong>Explore SQL</strong>
          </div>

          <button
            type="button"
            className="sql-open-button"
            onClick={() => setShowPanel((value) => !value)}
          >
            {showPanel ? <X size={15} /> : <Terminal size={15} />}
            {showPanel ? "Close" : "Run SQL"}
          </button>
        </div>

        {showPanel && (
          <div className="sql-control-panel">
            <div className="sql-panel-title">
              <div>
                <span>INTERACTIVE QUERY</span>
                <strong>See what SQL actually does</strong>
              </div>

              <div className="sql-live-indicator">
                <i />
                Live
              </div>
            </div>

            <div className="sql-query-list">
              {queries.map((query) => (
                <button
                  type="button"
                  key={query.type}
                  className={`sql-query-button ${
                    activeQuery.type === query.type ? "active" : ""
                  }`}
                  onClick={() => runQuery(query)}
                >
                  <span className="sql-query-type">{query.type}</span>

                  <span className="sql-query-copy">
                    <strong>{query.title}</strong>
                    <small>{query.description}</small>
                  </span>

                  <Play size={13} />
                </button>
              ))}
            </div>

            <div className={`sql-result ${running ? "running" : ""}`}>
              <div className="sql-result-header">
                <div className="sql-result-icon">
                  <Terminal size={14} />
                </div>

                <div>
                  <span>QUERY</span>
                  <strong>{activeQuery.type}</strong>
                </div>

                <div className="sql-result-status">
                  {running ? "Executing..." : "Complete"}
                </div>
              </div>

              <pre>{activeQuery.sql}</pre>

              <div className="sql-result-explanation">
                <span>WHAT HAPPENS</span>
                <p>{activeQuery.result}</p>
              </div>

              <div className="sql-demo-table">
                <div className="sql-demo-row sql-demo-head">
                  <span>ROLL</span>
                  <span>STUDENT</span>
                  <span>STATUS</span>
                </div>

                {students.map((student) => (
                  <div className="sql-demo-row" key={student.id}>
                    <span>{student.id}</span>
                    <span>{student.name}</span>
                    <span
                      className={
                        student.submitted
                          ? "sql-status-submitted"
                          : "sql-status-pending"
                      }
                    >
                      {student.submitted ? "Submitted" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="sql-panel-footer">
              <span>
                <span className="sql-footer-dot" />
                Visual simulation
              </span>

              <span>
                Interaction #{pulse + 1}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
