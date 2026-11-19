-- AutoPatch AI Relational Schema (MySQL 8.0+ Compatible Reference DDL)
-- Runtime SQLite mirrors these exact 8 tables with foreign-key enforcement.

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(40) NOT NULL DEFAULT 'developer',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT,
  primary_language VARCHAR(60) NOT NULL DEFAULT 'mixed',
  source_type VARCHAR(40) NOT NULL DEFAULT 'files',
  is_sample TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS uploaded_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  language VARCHAR(60) NOT NULL,
  size_bytes INT NOT NULL,
  original_content LONGTEXT NOT NULL,
  repaired_content LONGTEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_files_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scan_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  status VARCHAR(40) NOT NULL,
  model_used VARCHAR(80) NOT NULL,
  total_bugs INT NOT NULL DEFAULT 0,
  critical_count INT NOT NULL DEFAULT 0,
  high_count INT NOT NULL DEFAULT 0,
  medium_count INT NOT NULL DEFAULT 0,
  low_count INT NOT NULL DEFAULT 0,
  summary TEXT,
  error_message TEXT,
  scanned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_scan_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_scan_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS detected_bugs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  scan_id INT NOT NULL,
  project_id INT NOT NULL,
  file_id INT NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  line_number INT NOT NULL,
  end_line_number INT NOT NULL,
  category VARCHAR(60) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  priority_score INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  why_occurred TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  potential_impact TEXT NOT NULL,
  suggested_solution TEXT NOT NULL,
  confidence_estimate INT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'open',
  CONSTRAINT fk_bugs_scan FOREIGN KEY (scan_id) REFERENCES scan_history(id) ON DELETE CASCADE,
  CONSTRAINT fk_bugs_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_bugs_file FOREIGN KEY (file_id) REFERENCES uploaded_files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS suggested_fixes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bug_id INT NOT NULL,
  file_id INT NOT NULL,
  original_snippet LONGTEXT NOT NULL,
  patched_snippet LONGTEXT NOT NULL,
  patched_full_content LONGTEXT NOT NULL,
  explanation TEXT NOT NULL,
  confidence_estimate INT NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'pending',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_fixes_bug FOREIGN KEY (bug_id) REFERENCES detected_bugs(id) ON DELETE CASCADE,
  CONSTRAINT fk_fixes_file FOREIGN KEY (file_id) REFERENCES uploaded_files(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS test_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  bug_id INT NOT NULL,
  fix_id INT,
  test_name VARCHAR(200) NOT NULL,
  category VARCHAR(40) NOT NULL,
  input_summary TEXT NOT NULL,
  expected_behavior TEXT NOT NULL,
  before_result TEXT NOT NULL,
  after_result TEXT NOT NULL,
  before_passed TINYINT(1) NOT NULL DEFAULT 0,
  after_passed TINYINT(1) NOT NULL DEFAULT 0,
  execution_mode VARCHAR(40) NOT NULL,
  executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tests_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_tests_bug FOREIGN KEY (bug_id) REFERENCES detected_bugs(id) ON DELETE CASCADE,
  CONSTRAINT fk_tests_fix FOREIGN KEY (fix_id) REFERENCES suggested_fixes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS change_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  bug_id INT,
  fix_id INT,
  file_path VARCHAR(512) NOT NULL,
  action VARCHAR(60) NOT NULL,
  actor_email VARCHAR(190) NOT NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_changes_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
