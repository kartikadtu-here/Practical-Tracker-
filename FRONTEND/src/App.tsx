import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileSpreadsheet,
  FileText,
  History,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Table2,
  Upload,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";

const API =
  import.meta.env.VITE_API_URL || "http://localhost:8787";

/* =========================================================
   TYPES
========================================================= */

type Theme = "light" | "dark";

type Page =
  | "dashboard"
  | "students"
  | "tracker"
  | "practicals"
  | "ocr"
  | "history"
  | "exports"
  | "sql"
  | "settings"
  | "invite";

type Me = {
  id: string;
  email: string;
  name: string;
};

type Student = {
  id: string;
  rollNumber: string;
  name: string;
  studentListId?: string;
  createdAt?: string;
};

type Practical = {
  id: string;
  practicalNumber: number;
  title: string;
  description?: string | null;
  isActive?: boolean | number;
};

type Submission = {
  id?: string;
  studentId: string;
  practicalId: string;
  submitted: boolean | number;
  submittedAt?: string | null;
  updatedAt?: string;
};

type Dashboard = {
  students?: {
    total: number;
  };
  practicals?: {
    total: number;
  };
  activePractical?: Practical | null;
  submissions?: {
    totalPossible: number;
    submitted: number;
    pending: number;
    progress: number;
  };
  practicalProgress?: Array<{
    id: string;
    practicalNumber: number;
    title: string;
    submitted: number;
    pending: number;
    totalStudents: number;
    progress: number;
  }>;
};

type ActivityItem = {
  id?: string;
  action?: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt?: string;
  studentName?: string;
  rollNumber?: string;
  practicalNumber?: number;
};

type OcrStudent = {
  rollNumber: string;
  name: string;
};

/* =========================================================
   API
========================================================= */

async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const contentType =
    response.headers.get("content-type") || "";

  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof body === "object" && body
        ? body.message ||
          body.error ||
          `Request failed (${response.status})`
        : `Request failed (${response.status})`;

    throw new Error(message);
  }

  return body as T;
}

function unwrap<T>(body: any, fallback: T): T {
  if (body?.data !== undefined) {
    return body.data as T;
  }

  return body ?? fallback;
}

/** Map snake_case DB row to camelCase frontend type */
function mapStudent(row: any): Student {
  return {
    id: row.id,
    rollNumber: row.rollNumber ?? row.roll_number ?? "",
    name: row.name ?? "",
    studentListId: row.studentListId ?? row.student_list_id,
    createdAt: row.createdAt ?? row.created_at,
  };
}

function mapPractical(row: any): Practical {
  return {
    id: row.id,
    practicalNumber: row.practicalNumber ?? row.practical_number ?? 0,
    title: row.title ?? "",
    description: row.description,
    isActive: row.isActive ?? row.is_active,
  };
}

function asBoolean(value: boolean | number | undefined) {
  return value === true || value === 1;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/* =========================================================
   HASH ROUTING
========================================================= */

function useHashPage(): [Page, (page: Page) => void] {
  const validPages: Page[] = [
    "dashboard",
    "students",
    "tracker",
    "practicals",
    "ocr",
    "history",
    "exports",
    "sql",
    "settings",
    "invite",
  ];

  function readPage(): Page {
    const raw = window.location.hash.replace(
      /^#\/?/,
      "",
    );

    if (raw.startsWith("invite/")) {
      return "invite";
    }

    return validPages.includes(raw as Page)
      ? (raw as Page)
      : "dashboard";
  }

  const [page, setPage] = useState<Page>(readPage);

  useEffect(() => {
    const handler = () => {
      setPage(readPage());
    };

    window.addEventListener("hashchange", handler);

    return () =>
      window.removeEventListener(
        "hashchange",
        handler,
      );
  }, []);

  function navigate(next: Page) {
    window.location.hash = `/${next}`;
    setPage(next);
  }

  return [page, navigate];
}

/* =========================================================
   BRAND
========================================================= */

function Brand() {
  return (
    <div className="brand">
      <div className="brand-mark">
        <Database size={19} />
      </div>

      <div>
        <strong>PracticalTracker</strong>
        <span>DBMS workspace</span>
      </div>
    </div>
  );
}

/* =========================================================
   LOGIN
========================================================= */

function Login({
  onLogin,
}: {
  onLogin: (me: Me) => void;
}) {
  const [email, setEmail] = useState(
    "teacher@dbms.local",
  );

  const [password, setPassword] = useState(
    "Teacher@123",
  );

  const [showPassword, setShowPassword] =
    useState(false);

  const [pwdFocused, setPwdFocused] =
    useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();

    setBusy(true);
    setError("");

    try {
      const result = await api<any>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            email,
            password,
          }),
        },
      );

      const possibleMe =
        result?.data?.teacher ||
        result?.teacher ||
        result?.data;

      if (possibleMe?.id) {
        onLogin(possibleMe as Me);
        return;
      }

      const session = await api<any>(
        "/api/auth/me",
      );

      const me =
        session?.teacher || session?.data?.teacher || session?.data || session;

      if (!me?.id) {
        throw new Error(
          "Login succeeded but the teacher session could not be loaded.",
        );
      }

      onLogin(me as Me);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Check your email and password.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-split-left">
        <div className="auth-watermark" aria-hidden="true">
          DBMS<br />
          TRACKER
        </div>

        <div className="auth-left-content">
          <div className="auth-brand">
            <div className="brand-mark">
              <Database size={18} />
            </div>
            <div>
              <strong>PracticalTracker</strong>
              <span>DBMS workspace</span>
            </div>
          </div>

          <div>
            <div className="auth-statement">
              Your practical workspace, <br/>
              <span>without the paperwork.</span>
            </div>

            <div className="auth-statement-divider" />

            <ul className="auth-features">
              <li><CheckCircle2 size={14} /> Teacher workspace</li>
              <li><CheckCircle2 size={14} /> Secure session</li>
              <li><CheckCircle2 size={14} /> Submission tracking</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="auth-split-right">
        <section className="auth-card">
          <div className="auth-heading">
            <h1>Welcome back.</h1>
            <p>Sign in to your teacher workspace</p>
          </div>

          <form
            className="auth-form"
            onSubmit={submit}
          >
            <label>
              <span>Email</span>
              <div className="input-wrap">
                <input
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  type="email"
                  autoComplete="username"
                  placeholder="teacher@dbms.local"
                  required
                />
              </div>
            </label>

            <label>
              <span>Password</span>
              <div className="input-wrap">
                <input
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  onFocus={() => setPwdFocused(true)}
                  onBlur={() => setPwdFocused(false)}
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="current-password"
                  required
                />
                
                <button
                  type="button"
                  className="pwd-eye"
                  onClick={() =>
                    setShowPassword((v) => !v)
                  }
                >
                  {showPassword ? (
                    <span>◉&nbsp;&nbsp;◉</span>
                  ) : pwdFocused ? (
                    <span>—&nbsp;&nbsp;—</span>
                  ) : (
                    <span>◉&nbsp;&nbsp;◉</span>
                  )}
                </button>
              </div>
            </label>

            {error && (
              <div className="form-error">
                <Info size={15} />
                <span>{error}</span>
              </div>
            )}

            <button
              className="primary-btn auth-submit"
              disabled={busy}
              type="submit"
            >
              {busy ? "Entering workspace..." : "Enter workspace →"}
            </button>
          </form>

          <div className="auth-footer">
            SECURE TEACHER SESSION
          </div>
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   INVITATION PAGE
========================================================= */

function InvitePage({ token, onAccept }: { token: string, onAccept: (me: Me) => void }) {
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [inviteData, setInviteData] = useState<{ email: string, isExistingUser: boolean } | null>(null);
  
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pwdFocused, setPwdFocused] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<any>(`/api/auth/invite/${token}`)
      .then((res) => {
        if (!res.success) throw new Error(res.message);
        setInviteData({ email: res.email, isExistingUser: res.isExistingUser });
      })
      .catch((err) => {
        setError(err.message || "Invalid or expired invitation.");
      })
      .finally(() => setChecking(false));
  }, [token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    
    try {
      const res = await api<any>("/api/auth/invite/accept", {
        method: "POST",
        body: JSON.stringify({ token, name, password })
      });
      
      if (!res.success) throw new Error(res.message);
      
      onAccept(res.teacher as Me);
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation.");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="auth-shell">
        <div className="boot-screen">
          <Database size={24} className="spin" />
          <span>Validating invitation...</span>
        </div>
      </main>
    );
  }

  if (error && !inviteData) {
    return (
      <main className="auth-shell" style={{ display: 'grid', placeItems: 'center' }}>
        <section className="auth-card" style={{ textAlign: 'center' }}>
          <Info size={48} style={{ color: 'var(--rose)', margin: '0 auto 20px' }} />
          <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>Invitation Invalid</h1>
          <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '30px' }}>{error}</p>
          <button onClick={() => window.location.hash = ""} className="primary-btn" style={{ padding: '12px 24px', display: 'inline-block' }}>Return to Login</button>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-shell">
      <div className="auth-split-left">
        <div className="auth-watermark" aria-hidden="true">
          DBMS<br />
          TRACKER
        </div>

        <div className="auth-left-content">
          <div className="auth-brand">
            <div className="brand-mark">
              <Database size={18} />
            </div>
            <div>
              <strong>PracticalTracker</strong>
              <span>DBMS workspace</span>
            </div>
          </div>

          <div>
            <div className="auth-statement">
              You're invited. <br/>
              <span>Your teacher workspace is ready.</span>
            </div>

            <div className="auth-statement-divider" />

            <ul className="auth-features">
              <li><CheckCircle2 size={14} /> Accept invitation</li>
              <li><CheckCircle2 size={14} /> Secure setup</li>
              <li><CheckCircle2 size={14} /> Enter workspace</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="auth-split-right">
        <section className="auth-card">
          <div className="auth-heading">
            <h1>Accept Invitation</h1>
            <p>{inviteData?.email}</p>
          </div>

          <form className="auth-form" onSubmit={submit}>
            {!inviteData?.isExistingUser && (
              <label>
                <span>Full Name</span>
                <div className="input-wrap">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    type="text"
                    placeholder="Jane Doe"
                    required
                  />
                </div>
              </label>
            )}

            <label>
              <span>{inviteData?.isExistingUser ? "Password" : "Create Password"}</span>
              <div className="input-wrap">
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPwdFocused(true)}
                  onBlur={() => setPwdFocused(false)}
                  type={showPassword ? "text" : "password"}
                  required
                />
                
                <button
                  type="button"
                  className="pwd-eye"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <span>◉&nbsp;&nbsp;◉</span>
                  ) : pwdFocused ? (
                    <span>—&nbsp;&nbsp;—</span>
                  ) : (
                    <span>◉&nbsp;&nbsp;◉</span>
                  )}
                </button>
              </div>
            </label>

            {error && (
              <div className="form-error">
                <Info size={15} />
                <span>{error}</span>
              </div>
            )}

            <button className="primary-btn auth-submit" disabled={busy} type="submit">
              {busy ? "Accepting..." : "Accept Invitation →"}
            </button>
          </form>

          <div className="auth-footer">
            SECURE TEACHER SESSION
          </div>
        </section>
      </div>
    </main>
  );
}

/* =========================================================
   APP SHELL
========================================================= */

function AppShell({
  me,
  page,
  navigate,
  theme,
  setTheme,
  onLogout,
  children,
}: {
  me: Me;
  page: Page;
  navigate: (page: Page) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  onLogout: () => void;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] =
    useState(false);

  type NavItem = [
    Page,
    string,
    LucideIcon,
  ];

  type NavGroup = {
    label: string;
    items: NavItem[];
  };

  const groups: NavGroup[] = [
    {
      label: "Workspace",
      items: [
        [
          "dashboard",
          "Dashboard",
          LayoutDashboard,
        ],
        ["students", "Students", Users],
        [
          "tracker",
          "Submission Tracker",
          ClipboardCheck,
        ],
        [
          "practicals",
          "Practicals",
          BookOpen,
        ],
        ["ocr", "OCR Import", Upload],
      ],
    },

    {
      label: "Insights",
      items: [
        ["history", "History", History],
        ["exports", "Exports", FileText],
        ["sql", "SQL Lab", Database],
      ],
    },
  ];

  function go(next: Page) {
    navigate(next);
    setMobileOpen(false);
  }

  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${
          mobileOpen ? "mobile-open" : ""
        }`}
      >
        <div className="sidebar-top">
          <Brand />

          <button
            className="mobile-close icon-btn"
            type="button"
            onClick={() =>
              setMobileOpen(false)
            }
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-scroll">
          {groups.map(
            ({ label, items }) => (
              <div
                className="nav-group"
                key={label}
              >
                <div className="nav-label">
                  {label}
                </div>

                {items.map(
                  ([
                    id,
                    title,
                    Icon,
                  ]) => (
                    <button
                      key={id}
                      type="button"
                      className={`nav-item ${
                        page === id
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        go(id)
                      }
                    >
                      <Icon size={17} />

                      <span>
                        {title}
                      </span>
                    </button>
                  ),
                )}
              </div>
            ),
          )}
        </div>

        <div className="sidebar-bottom">
          <button
            className={`nav-item ${
              page === "settings"
                ? "active"
                : ""
            }`}
            type="button"
            onClick={() =>
              go("settings")
            }
          >
            <Settings size={17} />
            <span>Settings</span>
          </button>

          <button
            className="nav-item"
            type="button"
            onClick={onLogout}
          >
            <LogOut size={17} />
            <span>Logout</span>
          </button>

          <div className="sidebar-account">
            <div className="avatar">
              {initials(me.name)}
            </div>

            <div>
              <strong>{me.name}</strong>
              <span>Teacher account</span>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          className="sidebar-overlay"
          type="button"
          onClick={() =>
            setMobileOpen(false)
          }
          aria-label="Close menu"
        />
      )}

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-btn menu-btn"
              type="button"
              onClick={() =>
                setMobileOpen(true)
              }
            >
              <Menu size={19} />
            </button>

            <div>
              <div className="breadcrumb">
                DBMS / {page}
              </div>

              <strong>
                {page === "dashboard"
                  ? "Dashboard"
                  : page
                      .replace(
                        /^./,
                        (char) =>
                          char.toUpperCase(),
                      )
                      .replace(
                        "-",
                        " ",
                      )}
              </strong>
            </div>
          </div>

          <div className="topbar-actions">
            <button
              className="icon-btn"
              type="button"
              onClick={() =>
                window.location.reload()
              }
              title="Refresh"
            >
              <RefreshCw size={17} />
            </button>

            <button
              className="theme-toggle"
              type="button"
              onClick={() =>
                setTheme(
                  theme === "dark"
                    ? "light"
                    : "dark",
                )
              }
            >
              {theme === "dark" ? (
                <Sun size={16} />
              ) : (
                <Moon size={16} />
              )}

              <span>
                {theme === "dark"
                  ? "Light"
                  : "Dark"}
              </span>
            </button>
          </div>
        </header>

        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   COMMON COMPONENTS
========================================================= */

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">
          {eyebrow}
        </div>

        <h1>{title}</h1>

        <p>{description}</p>
      </div>

      {action && (
        <div className="page-header-action">
          {action}
        </div>
      )}
    </div>
  );
}

function Loading() {
  return (
    <div className="loading-state">
      <RefreshCw
        size={20}
        className="spin"
      />

      <span>
        Loading workspace data...
      </span>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={22} />
      </div>

      <h3>{title}</h3>

      <p>{description}</p>

      {action}
    </div>
  );
}

function ErrorBox({
  message,
}: {
  message: string;
}) {
  return (
    <div className="form-error">
      <X size={16} />
      <span>{message}</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  caption,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  caption: string;
}) {
  return (
    <article className="stat-card">
      <div className="stat-icon">
        <Icon size={18} />
      </div>

      <span className="stat-label">
        {label}
      </span>

      <strong className="stat-value">
        {value}
      </strong>

      <small>{caption}</small>
    </article>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`panel ${className}`}
    >
      {children}
    </article>
  );
}

/* =========================================================
   DASHBOARD
========================================================= */

function DashboardPage({
  navigate,
}: {
  navigate: (page: Page) => void;
}) {
  const [dashboard, setDashboard] =
    useState<Dashboard | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const result = await api<any>(
        "/api/dashboard/summary",
      );

      setDashboard(
        unwrap<Dashboard>(
          result,
          {},
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <Loading />;
  }

  const students =
    dashboard?.students?.total || 0;

  const practicals =
    dashboard?.practicals?.total || 0;

  const submitted =
    dashboard?.submissions?.submitted || 0;

  const pending =
    dashboard?.submissions?.pending || 0;

  const progress =
    dashboard?.submissions?.progress || 0;

  const active =
    dashboard?.activePractical;

  return (
    <>
      <PageHeader
        eyebrow="DBMS PRACTICAL TRACKER"
        title={
          <>
            Keep every practical
            <br />
            <em>under control.</em>
          </>
        }
        description="Track student submissions, manage practicals and generate reports without maintaining a manual diary."
        action={
          <button
            className="secondary-btn"
            type="button"
            onClick={load}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      />

      {error && (
        <ErrorBox message={error} />
      )}

      <section className="stats-grid">
        <StatCard
          icon={Users}
          label="Students"
          value={students}
          caption="Total students"
        />

        <StatCard
          icon={BookOpen}
          label="Practicals"
          value={practicals}
          caption="Tracked practicals"
        />

        <StatCard
          icon={CheckCircle2}
          label="Submitted"
          value={submitted}
          caption={`of ${
            dashboard?.submissions
              ?.totalPossible || 0
          }`}
        />

        <StatCard
          icon={Activity}
          label="Pending"
          value={pending}
          caption="Need attention"
        />
      </section>

      <section className="dashboard-grid">
        <Panel className="current-practical">
          <div className="panel-head">
            <div>
              <div className="eyebrow">
                CURRENT PRACTICAL
              </div>

              <h2>
                {active
                  ? `Practical ${active.practicalNumber}`
                  : "No active practical"}
              </h2>

              <p>
                {active?.title ||
                  "Create a practical to begin tracking."}
              </p>
            </div>

            <div className="panel-icon">
              <Database size={19} />
            </div>
          </div>

          <div className="big-progress">
            <strong>
              {progress.toFixed(1)}%
            </strong>

            <span>
              completion
            </span>
          </div>

          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(
                  100,
                  progress,
                )}%`,
              }}
            />
          </div>

          <div className="progress-meta">
            <span>
              {submitted} submitted
            </span>

            <span>
              {pending} pending
            </span>
          </div>
        </Panel>

        <Panel className="quick-actions">
          <div className="panel-head">
            <div>
              <div className="eyebrow">
                QUICK ACTIONS
              </div>

              <h2>
                What do you need?
              </h2>
            </div>
          </div>

          <button
            className="quick-action"
            type="button"
            onClick={() =>
              navigate("tracker")
            }
          >
            <ClipboardCheck size={18} />

            <span>
              <strong>
                Mark submissions
              </strong>

              <small>
                Update today's practical
              </small>
            </span>

            <ArrowRight size={16} />
          </button>

          <button
            className="quick-action"
            type="button"
            onClick={() =>
              navigate("ocr")
            }
          >
            <Upload size={18} />

            <span>
              <strong>
                Import students
              </strong>

              <small>
                Use OCR from an image
              </small>
            </span>

            <ArrowRight size={16} />
          </button>

          <button
            className="quick-action"
            type="button"
            onClick={() =>
              navigate("exports")
            }
          >
            <FileText size={18} />

            <span>
              <strong>
                Generate report
              </strong>

              <small>
                PDF or Excel export
              </small>
            </span>

            <ArrowRight size={16} />
          </button>
        </Panel>
      </section>

      <Panel>
        <div className="panel-head">
          <div>
            <div className="eyebrow">
              PRACTICAL OVERVIEW
            </div>

            <h2>
              Submission progress
            </h2>
          </div>

          <button
            className="text-btn"
            type="button"
            onClick={() =>
              navigate("tracker")
            }
          >
            Open tracker
            <ArrowRight size={15} />
          </button>
        </div>

        {!dashboard?.practicalProgress
          ?.length ? (
          <EmptyState
            icon={Database}
            title="No practical progress available"
            description="Create a practical and import your students to start tracking."
          />
        ) : (
          <div className="progress-list">
            {dashboard.practicalProgress.map(
              (item) => (
                <div
                  className="progress-row"
                  key={item.id}
                >
                  <div>
                    <strong>
                      Practical{" "}
                      {item.practicalNumber}
                    </strong>

                    <span>
                      {item.title}
                    </span>
                  </div>

                  <div className="progress-row-main">
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(
                            100,
                            item.progress,
                          )}%`,
                        }}
                      />
                    </div>

                    <strong>
                      {item.progress.toFixed(
                        0,
                      )}
                      %
                    </strong>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </Panel>
    </>
  );
}

/* =========================================================
   STUDENTS
========================================================= */

function StudentsPage({
  navigate,
}: {
  navigate: (page: Page) => void;
}) {
  const [students, setStudents] =
    useState<Student[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState("");

  const [error, setError] =
    useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const result = await api<any>(
        "/api/students",
      );

      const raw = unwrap<any[]>(result, []);
      setStudents(raw.map(mapStudent));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load students.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    if (!query) return students;

    return students.filter(
      (student) =>
        student.name
          .toLowerCase()
          .includes(query) ||
        student.rollNumber
          .toLowerCase()
          .includes(query),
    );
  }, [students, search]);

  return (
    <>
      <PageHeader
        eyebrow="STUDENT REGISTER"
        title="Students"
        description="The official student register used by your practical tracker."
        action={
          <div className="button-row">
            <button
              className="secondary-btn"
              type="button"
              onClick={load}
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <button
              className="primary-btn"
              type="button"
              onClick={() =>
                navigate("ocr")
              }
            >
              <Upload size={16} />
              Import list
            </button>
          </div>
        }
      />

      {error && (
        <ErrorBox message={error} />
      )}

      <Panel>
        <div className="toolbar">
          <div className="search-box">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search by roll number or name..."
            />
          </div>

          <span className="toolbar-count">
            {filtered.length} students
          </span>
        </div>

        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students found"
            description={
              students.length
                ? "Try another search."
                : "Import your student list using OCR to get started."
            }
            action={
              students.length === 0 ? (
                <button
                  className="primary-btn"
                  type="button"
                  onClick={() =>
                    navigate("ocr")
                  }
                >
                  <Upload size={16} />
                  Import students
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Roll No.</th>
                  <th>Student</th>
                  <th>Student ID</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(
                  (student) => (
                    <tr key={student.id}>
                      <td>
                        <span className="roll-badge">
                          {student.rollNumber}
                        </span>
                      </td>

                      <td>
                        <div className="student-cell">
                          <div className="avatar small">
                            {initials(
                              student.name,
                            )}
                          </div>

                          <strong>
                            {student.name}
                          </strong>
                        </div>
                      </td>

                      <td>
                        <code>
                          {student.id.slice(
                            0,
                            8,
                          )}
                          ...
                        </code>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

/* =========================================================
   TRACKER
========================================================= */

function TrackerPage() {
  const [students, setStudents] =
    useState<Student[]>([]);

  const [practicals, setPracticals] =
    useState<Practical[]>([]);

  const [submissions, setSubmissions] =
    useState<Submission[]>([]);

  const [selectedPractical, setSelectedPractical] =
    useState("");

  const [changes, setChanges] =
    useState<
      Record<string, boolean>
    >({});

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const [
        studentResult,
        practicalResult,
      ] = await Promise.all([
        api<any>("/api/students"),
        api<any>("/api/practicals"),
      ]);

      const studentData =
        unwrap<any[]>(studentResult, []).map(mapStudent);

      const practicalData =
        unwrap<any[]>(practicalResult, []).map(mapPractical);

      setStudents(studentData);
      setPracticals(practicalData);

      if (
        !selectedPractical &&
        practicalData.length
      ) {
        setSelectedPractical(
          practicalData[0].id,
        );
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load tracker.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadSubmissions(
    practicalId: string,
  ) {
    try {
      const result = await api<any>(
        `/api/submissions?practicalId=${encodeURIComponent(
          practicalId,
        )}`,
      );

      // Backend returns { success, practical, summary, students: [...] }
      const rawStudents: any[] =
        result?.students || unwrap<any[]>(result, []);

      const data: Submission[] = rawStudents.map(
        (row: any) => ({
          studentId: row.studentId ?? row.student_id ?? "",
          practicalId: practicalId,
          submitted: row.submitted,
          submittedAt: row.submittedAt ?? row.submitted_at,
          updatedAt: row.updatedAt ?? row.updated_at,
        }),
      );

      setSubmissions(data);

      const initial: Record<
        string,
        boolean
      > = {};

      data.forEach((submission) => {
        initial[
          submission.studentId
        ] = asBoolean(
          submission.submitted,
        );
      });

      setChanges(initial);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load submissions.",
      );
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (selectedPractical) {
      void loadSubmissions(
        selectedPractical,
      );
    }
  }, [selectedPractical]);

  const filteredStudents =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) return students;

      return students.filter(
        (student) =>
          student.name
            .toLowerCase()
            .includes(query) ||
          student.rollNumber
            .toLowerCase()
            .includes(query),
      );
    }, [students, search]);

  const submittedCount =
    Object.values(changes).filter(
      Boolean,
    ).length;

  const hasChanges = students.some(
    (student) => {
      const current =
        Boolean(changes[student.id]);

      const original =
        submissions.find(
          (item) =>
            item.studentId ===
            student.id,
        );

      return (
        current !==
        Boolean(
          original?.submitted,
        )
      );
    },
  );

  function toggle(
    studentId: string,
  ) {
    setChanges((current) => ({
      ...current,
      [studentId]:
        !current[studentId],
    }));
  }

  async function applyChanges() {
    if (!selectedPractical) {
      setError(
        "Select a practical first.",
      );
      return;
    }

    const payload = students
      .filter((student) => {
        const current =
          Boolean(
            changes[student.id],
          );

        const original =
          submissions.find(
            (item) =>
              item.studentId ===
              student.id,
          );

        return (
          current !==
          Boolean(
            original?.submitted,
          )
        );
      })
      .map((student) => ({
        studentId: student.id,
        practicalId:
          selectedPractical,
        submitted:
          Boolean(
            changes[student.id],
          ),
      }));

    if (!payload.length) {
      setMessage(
        "There are no changes to apply.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await api(
        "/api/submissions/apply",
        {
          method: "POST",
          body: JSON.stringify({
            practicalId: selectedPractical,
            changes: payload,
          }),
        },
      );

      await loadSubmissions(
        selectedPractical,
      );

      setMessage(
        `${payload.length} submission status${
          payload.length === 1
            ? ""
            : "es"
        } updated successfully.`,
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to apply changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <Loading />;
  }

  return (
    <>
      <PageHeader
        eyebrow="SUBMISSION TRACKER"
        title="Mark practical submissions"
        description="Tick or untick submission status. Changes stay staged until you explicitly apply them."
        action={
          <button
            className="secondary-btn"
            type="button"
            onClick={load}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      />

      {error && (
        <ErrorBox message={error} />
      )}

      {message && (
        <div className="success-banner">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}

      <Panel>
        <div className="tracker-toolbar">
          <label className="field">
            <span>Practical</span>

            <select
              value={selectedPractical}
              onChange={(event) =>
                setSelectedPractical(
                  event.target.value,
                )
              }
            >
              {practicals.map(
                (practical) => (
                  <option
                    key={practical.id}
                    value={practical.id}
                  >
                    Practical{" "}
                    {
                      practical.practicalNumber
                    }{" "}
                    · {practical.title}
                  </option>
                ),
              )}
            </select>
          </label>

          <div className="search-box">
            <Search size={17} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search students..."
            />
          </div>

          <div className="tracker-summary">
            <strong>
              {submittedCount}
            </strong>
            <span>
              submitted
            </span>
          </div>

          <button
            className="primary-btn"
            type="button"
            disabled={
              saving || !hasChanges
            }
            onClick={applyChanges}
          >
            {saving ? (
              <RefreshCw
                size={16}
                className="spin"
              />
            ) : (
              <Check size={16} />
            )}

            {saving
              ? "Applying..."
              : "Apply Changes"}
          </button>
        </div>

        <div className="tracker-notice">
          <ShieldCheck size={16} />

          <span>
            Student identity information is
            read-only here. Only submission
            status can be changed.
          </span>
        </div>

        <div className="table-wrap">
          <table className="tracker-table">
            <thead>
              <tr>
                <th>Roll</th>
                <th>Student</th>
                <th>Status</th>
                <th>Last updated</th>
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map(
                (student) => {
                  const checked =
                    Boolean(
                      changes[
                        student.id
                      ],
                    );

                  const original =
                    submissions.find(
                      (item) =>
                        item.studentId ===
                        student.id,
                    );

                  return (
                    <tr
                      key={student.id}
                    >
                      <td>
                        <span className="roll-badge">
                          {
                            student.rollNumber
                          }
                        </span>
                      </td>

                      <td>
                        <div className="student-cell">
                          <div className="avatar small">
                            {initials(
                              student.name,
                            )}
                          </div>

                          <strong>
                            {student.name}
                          </strong>
                        </div>
                      </td>

                      <td>
                        <button
                          type="button"
                          className={`status-toggle ${
                            checked
                              ? "checked"
                              : ""
                          }`}
                          onClick={() =>
                            toggle(
                              student.id,
                            )
                          }
                        >
                          <span>
                            {checked
                              ? "Submitted"
                              : "Pending"}
                          </span>

                          {checked && (
                            <Check
                              size={15}
                            />
                          )}
                        </button>
                      </td>

                      <td>
                        {formatDate(
                          original?.updatedAt ||
                            original?.submittedAt,
                        )}
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/* =========================================================
   PRACTICALS
========================================================= */

function PracticalsPage() {
  const [practicals, setPracticals] =
    useState<Practical[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [number, setNumber] =
    useState("");

  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  async function load() {
    setLoading(true);
    setError("");

    try {
      const result = await api<any>(
        "/api/practicals",
      );

      const raw = unwrap<any[]>(result, []);
      setPracticals(raw.map(mapPractical));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load practicals.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createPractical(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!number || !title.trim()) {
      setError(
        "Practical number and title are required.",
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await api(
        "/api/practicals",
        {
          method: "POST",
          body: JSON.stringify({
            practicalNumber:
              Number(number),
            title: title.trim(),
            description:
              description.trim(),
            isActive: true,
          }),
        },
      );

      setNumber("");
      setTitle("");
      setDescription("");

      await load();

      setMessage(
        "Practical created successfully.",
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create practical.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="PRACTICAL MANAGEMENT"
        title="Practicals"
        description="Create and manage the practicals that appear in your submission tracker."
        action={
          <button
            className="secondary-btn"
            type="button"
            onClick={load}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      />

      {error && (
        <ErrorBox message={error} />
      )}

      {message && (
        <div className="success-banner">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}

      <section className="two-column">
        <Panel>
          <div className="panel-head">
            <div>
              <div className="eyebrow">
                NEW PRACTICAL
              </div>

              <h2>
                Add practical
              </h2>

              <p>
                Create a new practical for
                submission tracking.
              </p>
            </div>

            <Plus size={19} />
          </div>

          <form
            className="stack-form"
            onSubmit={createPractical}
          >
            <label className="field">
              <span>
                Practical number
              </span>

              <input
                type="number"
                min="1"
                value={number}
                onChange={(event) =>
                  setNumber(
                    event.target.value,
                  )
                }
                placeholder="1"
              />
            </label>

            <label className="field">
              <span>Title</span>

              <input
                value={title}
                onChange={(event) =>
                  setTitle(
                    event.target.value,
                  )
                }
                placeholder="DBMS Introduction"
              />
            </label>

            <label className="field">
              <span>
                Description
              </span>

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                placeholder="Introduction to Database Management Systems"
                rows={4}
              />
            </label>

            <button
              className="primary-btn"
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <RefreshCw
                  size={16}
                  className="spin"
                />
              ) : (
                <Plus size={16} />
              )}

              {saving
                ? "Creating..."
                : "Create practical"}
            </button>
          </form>
        </Panel>

        <Panel>
          <div className="panel-head">
            <div>
              <div className="eyebrow">
                PRACTICAL LIST
              </div>

              <h2>
                {practicals.length} practicals
              </h2>
            </div>
          </div>

          {loading ? (
            <Loading />
          ) : practicals.length ===
            0 ? (
            <EmptyState
              icon={BookOpen}
              title="No practicals yet"
              description="Create your first practical using the form."
            />
          ) : (
            <div className="practical-list">
              {practicals.map(
                (practical) => (
                  <div
                    className="practical-row"
                    key={practical.id}
                  >
                    <div className="practical-number">
                      {String(
                        practical.practicalNumber,
                      ).padStart(2, "0")}
                    </div>

                    <div>
                      <strong>
                        {practical.title}
                      </strong>

                      <span>
                        {practical.description ||
                          "No description"}
                      </span>
                    </div>

                    <div className="status-pill">
                      {asBoolean(
                        practical.isActive,
                      )
                        ? "Active"
                        : "Inactive"}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </Panel>
      </section>
    </>
  );
}

/* =========================================================
   OCR
========================================================= */

function OcrPage({
  navigate,
}: {
  navigate: (page: Page) => void;
}) {
  const [file, setFile] =
    useState<File | null>(null);

  const [preview, setPreview] =
    useState("");

  const [students, setStudents] =
    useState<OcrStudent[]>([]);

  const [processing, setProcessing] =
    useState(false);

  const [importing, setImporting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  function chooseFile(
    selected: File | null,
  ) {
    setError("");
    setMessage("");

    if (!selected) return;

    if (
      !selected.type.startsWith(
        "image/",
      )
    ) {
      setError(
        "Please select an image file.",
      );
      return;
    }

    setFile(selected);
    setPreview(
      URL.createObjectURL(selected),
    );
    setStudents([]);
  }

  async function runOcr() {
    if (!file) {
      setError(
        "Choose a student-list image first.",
      );
      return;
    }

    setProcessing(true);
    setError("");
    setMessage("");

    try {
      const form = new FormData();
      form.append("file", file);

      const fileBlob = file;
      const arrayBuf = await fileBlob.arrayBuffer();

      const result = await api<any>(
        "/api/ocr/students",
        {
          method: "POST",
          body: arrayBuf,
          headers: {
            "Content-Type": file.type,
          },
        },
      );

      const data =
        result?.data ||
        result;

      const extracted =
        data?.students ||
        result?.students ||
        [];

      setStudents(
        extracted.map(
          (student: any) => ({
            rollNumber:
              String(
                student.rollNumber ??
                  student.roll_number ??
                  "",
              ),
            name: String(
              student.name ?? "",
            ),
          }),
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "OCR processing failed.",
      );
    } finally {
      setProcessing(false);
    }
  }

  function editStudent(
    index: number,
    field: keyof OcrStudent,
    value: string,
  ) {
    setStudents((current) =>
      current.map(
        (student, studentIndex) =>
          studentIndex === index
            ? {
                ...student,
                [field]: value,
              }
            : student,
      ),
    );
  }

  async function confirmImport() {
    if (!students.length) {
      setError(
        "There are no students to import.",
      );
      return;
    }

    setImporting(true);
    setError("");
    setMessage("");

    try {
      await api(
        "/api/students/import",
        {
          method: "POST",
          body: JSON.stringify({
            students,
          }),
        },
      );

      setMessage(
        `${students.length} students imported successfully.`,
      );

      setStudents([]);
      setFile(null);
      setPreview("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to import students.",
      );
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="OCR IMPORT"
        title="Import student list"
        description="Upload a student-list image, review the OCR result and confirm it before anything is written to the database."
        action={
          <button
            className="secondary-btn"
            type="button"
            onClick={() =>
              navigate("students")
            }
          >
            <Users size={16} />
            View students
          </button>
        }
      />

      {error && (
        <ErrorBox message={error} />
      )}

      {message && (
        <div className="success-banner">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}

      <section className="ocr-grid">
        <Panel className="ocr-upload">
          <div className="panel-head">
            <div>
              <div className="eyebrow">
                STEP 01
              </div>

              <h2>
                Upload image
              </h2>

              <p>
                Use a clear photo or screenshot
                of the official student list.
              </p>
            </div>

            <Upload size={20} />
          </div>

          <label className="dropzone">
            <input
              type="file"
              accept="image/*"
              onChange={(event) =>
                chooseFile(
                  event.target.files?.[0] ||
                    null,
                )
              }
            />

            {preview ? (
              <img
                src={preview}
                alt="Student list preview"
              />
            ) : (
              <>
                <div className="drop-icon">
                  <Upload size={25} />
                </div>

                <strong>
                  Drop student-list image
                </strong>

                <span>
                  or click to browse
                </span>
              </>
            )}
          </label>

          {file && (
            <div className="file-info">
              <div>
                <strong>
                  {file.name}
                </strong>

                <span>
                  {(
                    file.size /
                    1024 /
                    1024
                  ).toFixed(2)}{" "}
                  MB
                </span>
              </div>

              <button
                className="icon-btn"
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreview("");
                  setStudents([]);
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          <button
            className="primary-btn full-btn"
            type="button"
            disabled={
              processing || !file
            }
            onClick={runOcr}
          >
            {processing ? (
              <RefreshCw
                size={16}
                className="spin"
              />
            ) : (
              <Sparkles size={16} />
            )}

            {processing
              ? "Reading student list..."
              : "Run OCR"}
          </button>
        </Panel>

        <Panel className="ocr-results">
          <div className="panel-head">
            <div>
              <div className="eyebrow">
                STEP 02
              </div>

              <h2>
                Review extracted students
              </h2>

              <p>
                Correct any OCR mistakes before
                confirming the import.
              </p>
            </div>

            <span className="count-pill">
              {students.length}
            </span>
          </div>

          {!students.length ? (
            <EmptyState
              icon={Table2}
              title="Nothing extracted yet"
              description="Upload an image and run OCR. The extracted students will appear here for confirmation."
            />
          ) : (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Roll number</th>
                      <th>Name</th>
                    </tr>
                  </thead>

                  <tbody>
                    {students.map(
                      (
                        student,
                        index,
                      ) => (
                        <tr
                          key={`${student.rollNumber}-${index}`}
                        >
                          <td>
                            <input
                              value={
                                student.rollNumber
                              }
                              onChange={(
                                event,
                              ) =>
                                editStudent(
                                  index,
                                  "rollNumber",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            />
                          </td>

                          <td>
                            <input
                              value={
                                student.name
                              }
                              onChange={(
                                event,
                              ) =>
                                editStudent(
                                  index,
                                  "name",
                                  event
                                    .target
                                    .value,
                                )
                              }
                            />
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="ocr-confirm">
                <div>
                  <ShieldCheck size={17} />

                  <span>
                    Review complete? Confirm
                    to write these students to
                    the database.
                  </span>
                </div>

                <button
                  className="primary-btn"
                  type="button"
                  disabled={importing}
                  onClick={
                    confirmImport
                  }
                >
                  {importing ? (
                    <RefreshCw
                      size={16}
                      className="spin"
                    />
                  ) : (
                    <Check size={16} />
                  )}

                  {importing
                    ? "Importing..."
                    : "Confirm Import"}
                </button>
              </div>
            </>
          )}
        </Panel>
      </section>
    </>
  );
}

/* =========================================================
   HISTORY
========================================================= */

function HistoryPage() {
  const [items, setItems] =
    useState<ActivityItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const result = await api<any>(
        "/api/submissions/history",
      );

      setItems(
        unwrap<ActivityItem[]>(
          result,
          [],
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load history.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="AUDIT TRAIL"
        title="Submission history"
        description="Review when submission statuses changed and which student or practical was affected."
        action={
          <button
            className="secondary-btn"
            type="button"
            onClick={load}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      />

      {error && (
        <ErrorBox message={error} />
      )}

      <Panel>
        {loading ? (
          <Loading />
        ) : items.length ? (
          <div className="timeline">
            {items.map(
              (item, index) => (
                <div
                  className="timeline-item"
                  key={
                    item.id ||
                    String(index)
                  }
                >
                  <div className="timeline-dot">
                    <Activity size={14} />
                  </div>

                  <div className="timeline-content">
                    <strong>
                      {item.action ||
                        "Submission updated"}
                    </strong>

                    <span>
                      {item.studentName ||
                        item.rollNumber ||
                        "Student"}{" "}
                      · Practical{" "}
                      {item.practicalNumber ??
                        "—"}
                    </span>

                    <small>
                      {formatDate(
                        item.createdAt,
                      )}
                    </small>
                  </div>

                  <div className="timeline-change">
                    {item.oldValue ??
                      "—"}{" "}
                    →{" "}
                    {item.newValue ??
                      "—"}
                  </div>
                </div>
              ),
            )}
          </div>
        ) : (
          <EmptyState
            icon={History}
            title="No history available"
            description="Once submission statuses change, the audit trail will appear here."
          />
        )}
      </Panel>
    </>
  );
}

/* =========================================================
   EXPORTS
========================================================= */

function ExportsPage() {
  const [busy, setBusy] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [practicals, setPracticals] =
    useState<Practical[]>([]);

  const [selectedPractical, setSelectedPractical] =
    useState("");

  useEffect(() => {
    api<any>("/api/practicals")
      .then((result) => {
        const raw = unwrap<any[]>(result, []);
        const mapped = raw.map(mapPractical);
        setPracticals(mapped);
        if (mapped.length) {
          setSelectedPractical(mapped[0].id);
        }
      })
      .catch(() => {});
  }, []);

  async function download(
    path: string,
    filename: string,
  ) {
    setBusy(filename);
    setMessage("");

    try {
      const response =
        await fetch(
          `${API}${path}`,
          {
            credentials:
              "include",
          },
        );

      if (!response.ok) {
        throw new Error(
          `Export failed (${response.status})`,
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(
          blob,
        );

      const anchor =
        document.createElement(
          "a",
        );

      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(
        anchor,
      );
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);

      setMessage(
        `${filename} generated successfully.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Export failed.",
      );
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="REPORTING"
        title="Exports & reports"
        description="Download the current tracker data for sharing, printing or offline analysis."
      />

      {practicals.length > 0 && (
        <Panel>
          <label className="field" style={{ maxWidth: 400 }}>
            <span>Practical for submission and PDF exports</span>
            <select
              value={selectedPractical}
              onChange={(e) => setSelectedPractical(e.target.value)}
            >
              {practicals.map((p) => (
                <option key={p.id} value={p.id}>
                  Practical {p.practicalNumber} · {p.title}
                </option>
              ))}
            </select>
          </label>
        </Panel>
      )}

      <section className="export-grid" style={{ marginTop: 14 }}>
        <ExportCard
          icon={FileSpreadsheet}
          title="Student Excel"
          description="Current student register as an .xlsx file."
          busy={
            busy ===
            "students.xlsx"
          }
          onClick={() =>
            download(
              "/api/exports/students/excel",
              "students.xlsx",
            )
          }
        />

        <ExportCard
          icon={Table2}
          title="Submission Excel"
          description="Submission status across practicals."
          busy={
            busy ===
            "submissions.xlsx"
          }
          onClick={() => {
            if (!selectedPractical) { setMessage("Select a practical first."); return; }
            download(
              `/api/exports/submissions/excel?practicalId=${encodeURIComponent(selectedPractical)}`,
              "submissions.xlsx",
            );
          }}
        />

        <ExportCard
          icon={FileText}
          title="PDF report"
          description="Teacher-friendly report for printing or sharing."
          busy={
            busy ===
            "report.pdf"
          }
          onClick={() => {
            if (!selectedPractical) { setMessage("Select a practical first."); return; }
            download(
              `/api/exports/report/pdf?practicalId=${encodeURIComponent(selectedPractical)}`,
              "report.pdf",
            );
          }}
        />
      </section>

      {message && (
        <div className="success-banner">
          <CheckCircle2 size={16} />
          {message}
        </div>
      )}
    </>
  );
}

function ExportCard({
  icon: Icon,
  title,
  description,
  busy,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <Panel className="export-card">
      <div className="export-icon">
        <Icon size={21} />
      </div>

      <h3>{title}</h3>

      <p>{description}</p>

      <button
        className="secondary-btn"
        type="button"
        disabled={busy}
        onClick={onClick}
      >
        {busy ? (
          <RefreshCw
            size={16}
            className="spin"
          />
        ) : (
          <ArrowDownToLine size={16} />
        )}

        {busy
          ? "Generating..."
          : "Download"}
      </button>
    </Panel>
  );
}

/* =========================================================
   SQL LAB
========================================================= */

function SqlPage() {
  const examples = [
    {
      title:
        "Find pending submissions",

      sql: `SELECT student.name, practical.practical_number
FROM submissions
JOIN student
  ON student.id = submissions.student_id
JOIN practical
  ON practical.id = submissions.practical_id
WHERE submissions.submitted = 0;`,

      result:
        "Returns students whose submission status is pending.",
    },

    {
      title:
        "Count submitted work",

      sql: `SELECT COUNT(*)
FROM submissions
WHERE submitted = 1;`,

      result:
        "Counts completed submissions in the tracker.",
    },

    {
      title:
        "Show the student register",

      sql: `SELECT roll_number, name
FROM students
ORDER BY roll_number;`,

      result:
        "Reads the official student list in roll-number order.",
    },
  ];

  const [selected, setSelected] =
    useState(0);

  return (
    <>
      <PageHeader
        eyebrow="LEARNING MODE"
        title="SQL Lab"
        description="Understand what the tracker is doing underneath without giving the browser arbitrary database access."
      />

      <section className="sql-layout">
        <Panel className="sql-list">
          <div className="eyebrow">
            QUERY EXAMPLES
          </div>

          {examples.map(
            (example, index) => (
              <button
                className={`sql-item ${
                  selected === index
                    ? "active"
                    : ""
                }`}
                type="button"
                key={example.title}
                onClick={() =>
                  setSelected(index)
                }
              >
                <Database size={16} />

                <span>
                  <strong>
                    {example.title}
                  </strong>

                  <small>
                    {example.result}
                  </small>
                </span>

                <ArrowRight size={15} />
              </button>
            ),
          )}
        </Panel>

        <Panel className="sql-editor">
          <div className="editor-top">
            <span>
              <span className="status-dot" />
              Read-only preview
            </span>

            <span>SQL</span>
          </div>

          <pre>
            {examples[selected].sql}
          </pre>

          <div className="query-result">
            <CheckCircle2 size={16} />

            <strong>
              {examples[selected].result}
            </strong>
          </div>
        </Panel>
      </section>
    </>
  );
}

/* =========================================================
   SETTINGS
========================================================= */

function SettingsPage({
  theme,
  setTheme,
  me,
}: {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  me: Me;
}) {
  const [status, setStatus] = useState("Checking...");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState("");

  async function check() {
    setStatus("Checking...");
    try {
      const result = await api<any>("/api/health");
      setStatus(
        result?.database === "connected"
          ? "Worker + D1 connected"
          : "Worker online",
      );
    } catch {
      setStatus("Backend unavailable");
    }
  }

  useEffect(() => {
    void check();
  }, []);

  async function createInvite(e: FormEvent) {
    e.preventDefault();
    setInviteBusy(true);
    setInviteError("");
    setInviteLink("");

    try {
      const result = await api<any>("/api/auth/invite", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail })
      });

      if (!result.success) throw new Error(result.message);

      const url = new URL(window.location.href);
      url.hash = `#/invite/${result.token}`;
      setInviteLink(url.toString());
      setInviteEmail("");
    } catch (err: any) {
      setInviteError(err.message || "Failed to create invitation");
    } finally {
      setInviteBusy(false);
    }
  }

  function copyInvite() {
    navigator.clipboard.writeText(inviteLink);
  }

  return (
    <>
      <PageHeader
        eyebrow="PREFERENCES"
        title="Settings"
        description="Control the workspace appearance and verify the local backend connection."
      />

      <section className="settings-grid">
        <Panel>
          <div className="panel-head">
            <div>
              <div className="eyebrow">APPEARANCE</div>
              <h2>Theme</h2>
            </div>
            <Sparkles size={18} />
          </div>

          <div className="theme-options">
            <button
              type="button"
              className={theme === "light" ? "selected" : ""}
              onClick={() => setTheme("light")}
            >
              <Sun size={19} />
              <strong>Light</strong>
              <span>Clean paper-like workspace</span>
            </button>

            <button
              type="button"
              className={theme === "dark" ? "selected" : ""}
              onClick={() => setTheme("dark")}
            >
              <Moon size={19} />
              <strong>Dark</strong>
              <span>Low-light focused workspace</span>
            </button>
          </div>
        </Panel>

        <Panel>
          <div className="panel-head">
            <div>
              <div className="eyebrow">ACCOUNT</div>
              <h2>Teacher account</h2>
            </div>
            <ShieldCheck size={18} />
          </div>

          <div className="account-detail">
            <div className="avatar large">{initials(me.name)}</div>
            <div>
              <strong>{me.name}</strong>
              <span>{me.email}</span>
            </div>
          </div>

          <div className="connection-card">
            <span className="status-dot" />
            <div>
              <strong>{status}</strong>
              <span>API endpoint · {API}</span>
            </div>
            <button className="icon-btn" type="button" onClick={check}>
              <RefreshCw size={16} />
            </button>
          </div>
        </Panel>
        
        <Panel>
          <div className="panel-head">
            <div>
              <div className="eyebrow">INVITATIONS</div>
              <h2>Invite Teacher</h2>
            </div>
            <Users size={18} />
          </div>
          
          <form onSubmit={createInvite} style={{ display: 'grid', gap: '15px', marginTop: '15px' }}>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)' }}>Email Address</span>
              <div className="input-wrap">
                <input 
                  type="email" 
                  value={inviteEmail} 
                  onChange={(e) => setInviteEmail(e.target.value)} 
                  placeholder="colleague@example.com" 
                  required 
                />
              </div>
            </label>

            {inviteError && (
              <div className="form-error">
                <Info size={15} />
                <span>{inviteError}</span>
              </div>
            )}
            
            <button className="primary-btn" disabled={inviteBusy} type="submit" style={{ padding: '12px' }}>
              {inviteBusy ? "Creating..." : "Create Invitation"}
            </button>
          </form>

          {inviteLink && (
            <div className="success-banner" style={{ marginTop: '15px', flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={15} />
                <strong>Invitation Created</strong>
              </div>
              <div className="input-wrap" style={{ background: 'rgba(0,0,0,0.1)', borderColor: 'rgba(0,0,0,0.1)' }}>
                <input type="text" readOnly value={inviteLink} style={{ fontSize: '11px' }} />
                <button type="button" className="input-action" onClick={copyInvite} style={{ color: 'var(--text)' }}>
                  Copy
                </button>
              </div>
              <span style={{ fontSize: '10px', opacity: 0.8 }}>This link contains a one-time token and expires in 7 days. Do not share it publicly.</span>
            </div>
          )}
        </Panel>
      </section>
    </>
  );
}

/* =========================================================
   APP
========================================================= */

export default function App() {
  const [me, setMe] =
    useState<Me | null>(null);

  const [checking, setChecking] =
    useState(true);

  const [theme, setThemeState] =
    useState<Theme>(() => {
      const stored =
        localStorage.getItem(
          "dpt-theme",
        );

      return stored === "light"
        ? "light"
        : "dark";
    });

  const [page, navigate] =
    useHashPage();

  useEffect(() => {
    document.documentElement.dataset.theme =
      theme;

    localStorage.setItem(
      "dpt-theme",
      theme,
    );
  }, [theme]);

  useEffect(() => {
    api<any>("/api/auth/me")
      .then((result) => {
        const user =
          result?.teacher ||
          result?.data?.teacher ||
          result?.data ||
          result;

        if (user?.id) {
          setMe(user as Me);
        } else {
          setMe(null);
        }
      })
      .catch(() => {
        setMe(null);
      })
      .finally(() => {
        setChecking(false);
      });
  }, []);

  async function logout() {
    try {
      await api(
        "/api/auth/logout",
        {
          method: "POST",
        },
      );
    } finally {
      setMe(null);
      window.location.hash = "";
    }
  }

  if (checking) {
    return (
      <div className="boot-screen">
        <Database size={24} />

        <span>
          Connecting to
          PracticalTracker...
        </span>
      </div>
    );
  }

  if (page === "invite") {
    if (me) {
      window.location.hash = "";
      return null;
    }

    const token = window.location.hash.replace(/^#\/?invite\//, "");
    return (
      <InvitePage
        token={token}
        onAccept={(user) => {
          setMe(user);
          window.location.hash = "";
        }}
      />
    );
  }

  if (!me) {
    return (
      <Login
        onLogin={(user) =>
          setMe(user)
        }
      />
    );
  }

  let content: ReactNode;

  switch (page) {
    case "students":
      content = (
        <StudentsPage
          navigate={navigate}
        />
      );
      break;

    case "tracker":
      content = <TrackerPage />;
      break;

    case "practicals":
      content = (
        <PracticalsPage />
      );
      break;

    case "ocr":
      content = (
        <OcrPage
          navigate={navigate}
        />
      );
      break;

    case "history":
      content = <HistoryPage />;
      break;

    case "exports":
      content = <ExportsPage />;
      break;

    case "sql":
      content = <SqlPage />;
      break;

    case "settings":
      content = (
        <SettingsPage
          theme={theme}
          setTheme={setThemeState}
          me={me}
        />
      );
      break;

    default:
      content = (
        <DashboardPage
          navigate={navigate}
        />
      );
  }

  return (
    <AppShell
      me={me}
      page={page}
      navigate={navigate}
      theme={theme}
      setTheme={setThemeState}
      onLogout={logout}
    >
      {content}
    </AppShell>
  );
}