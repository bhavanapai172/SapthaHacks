# AutoPatch AI — Autonomous Software Bug Detection and Repair System

**Tagline:** Detect. Understand. Repair. Verify.

AutoPatch AI is a full-stack developer debugging platform that ingests source files or ZIP project archives, pinpoints bugs with exact file and line attribution, explains root causes in plain developer language, generates minimal side-by-side patches via Monaco DiffEditor, and validates repairs against targeted normal, invalid, and boundary test cases.

---

## Key Features

- **Landing & Workflow Overview**: Clean developer presentation explaining the 5-stage `Upload → Scan → Explain → Fix → Test` pipeline.
- **User Authentication**: Email/password registration and sign-in backed by `bcryptjs` password hashing and JWT bearer sessions (`dev@autopatch.ai` / `AutoPatch2026!` pre-seeded for first-time exploration).
- **Real-Time Developer Dashboard**: SQL-aggregated project counts, severity distribution chart (Critical, High, Medium, Low), fix acceptance stats, recent projects, and scan history.
- **Project & ZIP Uploader**: Validates individual source files (`.py`, `.js`, `.ts`, `.java`, `.c`, `.cpp`, `.go`, `.rs`, `.sql`, `.json`) and `.zip` archives without executing untrusted uploaded code directly on the host. Includes 3 multi-file sample projects.
- **Intelligent Code Scanner & Prioritization**: Uses server-side `@google/genai` (`gemini-4-hydrogen`) structured JSON schemas to detect syntax, logical, runtime, edge-case, security, and suspicious code patterns, ranked by severity, category impact, and confidence score.
- **Root Cause Analysis & Explain My Code**: Displays bug title, description, file/line, why it occurred, root cause, potential impact, suggested solution, AI confidence disclaimer, and on-demand code block walkthroughs.
- **Safe Repair Mode & Side-by-Side Diff**: Preserves original uploaded files (`original_content`) and compares them side-by-side against AI-corrected drafts (`repaired_content`) in Monaco `DiffEditor` with explicit Accept / Reject approval.
- **Testing & Validation**: Generates normal, invalid, and boundary test cases; runs JavaScript assertions in an isolated zero-privilege `node:vm` sandbox and reports non-JS test specs transparently without false verification claims.
- **Audit History & Exports**: Tracks every scan, repair acceptance/rejection, and validation run, with one-click repaired file downloads, ZIP bundle downloads, and formatted PDF bug reports (`jsPDF`).

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Monaco Editor (`@monaco-editor/react` + bundled `monaco-editor`), `lucide-react`, `jsPDF`
- **Backend**: Node.js + Express (`server.ts`), `multer`, `adm-zip`, `bcryptjs`, `jsonwebtoken`
- **AI Engine**: `@google/genai` (`gemini-4-hydrogen`, server-side only)
- **Database**: Relational SQLite (`node:sqlite` with foreign keys enabled) + reference MySQL 8.0 DDL in `database/schema.sql`

---

## Setup & Execution

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   Copy `.env.example` to `.env` and set your Gemini API key:
   ```env
   GEMINI_API_KEY="your_gemini_api_key_here"
   JWT_SECRET="your_secure_random_secret"
   ```

3. **Run unit tests**
   ```bash
   npx --yes tsx --test src/utils/bugLogic.test.ts
   ```

4. **Start development server (port 3000)**
   ```bash
   npm run dev
   ```

5. **Build & run production bundle**
   ```bash
   npm run build
   npm start
   ```
