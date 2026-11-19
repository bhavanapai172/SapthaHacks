export type Severity = 'critical' | 'high' | 'medium' | 'low';

export type BugCategory =
  | 'syntax'
  | 'logical'
  | 'runtime'
  | 'edge_case'
  | 'security'
  | 'pattern';

export type FixStatus = 'pending' | 'accepted' | 'rejected';

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface ProjectSummary {
  id: number;
  user_id: number;
  name: string;
  description: string;
  primary_language: string;
  source_type: string;
  is_sample: number;
  created_at: string;
  updated_at: string;
  file_count: number;
  total_bugs: number;
  fixed_bugs: number;
  last_scanned_at: string | null;
}

export interface UploadedFile {
  id: number;
  project_id: number;
  file_path: string;
  language: string;
  size_bytes: number;
  original_content: string;
  repaired_content: string | null;
  created_at: string;
}

export interface ScanRecord {
  id: number;
  project_id: number;
  project_name?: string;
  user_id: number;
  status: 'completed' | 'failed';
  model_used: string;
  total_bugs: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  summary: string | null;
  error_message: string | null;
  scanned_at: string;
}

export interface SuggestedFix {
  id: number;
  bug_id: number;
  file_id: number;
  original_snippet: string;
  patched_snippet: string;
  patched_full_content: string;
  explanation: string;
  confidence_estimate: number;
  status: FixStatus;
  updated_at: string;
}

export interface DetectedBug {
  id: number;
  scan_id: number;
  project_id: number;
  file_id: number;
  file_path: string;
  line_number: number;
  end_line_number: number;
  category: BugCategory;
  severity: Severity;
  priority_score: number;
  title: string;
  description: string;
  why_occurred: string;
  root_cause: string;
  potential_impact: string;
  suggested_solution: string;
  confidence_estimate: number;
  status: 'open' | 'fixed' | 'rejected';
  fix?: SuggestedFix | null;
}

export interface TestResult {
  id: number;
  project_id: number;
  bug_id: number;
  fix_id: number | null;
  test_name: string;
  category: 'normal' | 'invalid' | 'boundary';
  input_summary: string;
  expected_behavior: string;
  before_result: string;
  after_result: string;
  before_passed: number;
  after_passed: number;
  execution_mode: 'sandboxed_vm' | 'static_trace_only';
  executed_at: string;
}

export interface ChangeHistoryEntry {
  id: number;
  project_id: number;
  project_name?: string;
  bug_id: number | null;
  fix_id: number | null;
  file_path: string;
  action: string;
  actor_email: string;
  notes: string | null;
  created_at: string;
}

export interface ProjectDetail {
  project: ProjectSummary;
  files: UploadedFile[];
  scans: ScanRecord[];
  bugs: DetectedBug[];
  tests: TestResult[];
  changes: ChangeHistoryEntry[];
}

export interface DashboardStats {
  totalProjects: number;
  totalScans: number;
  totalBugsDetected: number;
  bugsFixed: number;
  fixesRejected: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recentProjects: ProjectSummary[];
  recentScans: ScanRecord[];
  aiConfigured: boolean;
}

export interface CodeExplanation {
  summary: string;
  stepByStep: string[];
  potentialPitfalls: string[];
  complexityNote: string;
}

export interface SampleProjectCatalogItem {
  key: string;
  name: string;
  description: string;
  primaryLanguage: string;
  fileCount: number;
  focusAreas: string[];
}
