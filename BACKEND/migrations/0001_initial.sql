PRAGMA foreign_keys = ON;

-- ============================================
-- TEACHERS
-- ============================================

CREATE TABLE teachers (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- STUDENT LISTS
-- Each uploaded student list becomes a roster
-- ============================================

CREATE TABLE student_lists (
    id TEXT PRIMARY KEY,
    source_file_name TEXT,
    source_file_url TEXT,
    uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    uploaded_by TEXT NOT NULL,

    FOREIGN KEY (uploaded_by)
        REFERENCES teachers(id)
        ON DELETE RESTRICT
);


-- ============================================
-- STUDENTS
-- Student identity is controlled by imported
-- student lists, not normal CRUD.
-- ============================================

CREATE TABLE students (
    id TEXT PRIMARY KEY,
    student_list_id TEXT NOT NULL,
    roll_number TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(student_list_id, roll_number),

    FOREIGN KEY (student_list_id)
        REFERENCES student_lists(id)
        ON DELETE RESTRICT
);


-- ============================================
-- PRACTICALS
-- ============================================

CREATE TABLE practicals (
    id TEXT PRIMARY KEY,
    practical_number INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- SUBMISSIONS
-- One record per student + practical
-- ============================================

CREATE TABLE submissions (
    id TEXT PRIMARY KEY,

    student_id TEXT NOT NULL,
    practical_id TEXT NOT NULL,

    submitted INTEGER NOT NULL DEFAULT 0,
    submitted_at TEXT,

    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(student_id, practical_id),

    FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (practical_id)
        REFERENCES practicals(id)
        ON DELETE RESTRICT
);


-- ============================================
-- AUDIT LOGS
-- Records every submission change
-- ============================================

CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,

    teacher_id TEXT NOT NULL,
    practical_id TEXT,
    student_id TEXT,

    action TEXT NOT NULL,

    old_value TEXT,
    new_value TEXT,

    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (teacher_id)
        REFERENCES teachers(id)
        ON DELETE RESTRICT,

    FOREIGN KEY (practical_id)
        REFERENCES practicals(id)
        ON DELETE SET NULL,

    FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE SET NULL
);


-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_students_roll
ON students(roll_number);

CREATE INDEX idx_students_name
ON students(name);

CREATE INDEX idx_submissions_practical
ON submissions(practical_id);

CREATE INDEX idx_submissions_student
ON submissions(student_id);

CREATE INDEX idx_submissions_status
ON submissions(submitted);

CREATE INDEX idx_audit_created
ON audit_logs(created_at);