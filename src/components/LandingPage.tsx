import { useState } from 'react';
import {
  ArrowRight,
  Bug,
  CheckCircle2,
  Code2,
  FileDiff,
  FlaskConical,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

interface LandingPageProps {
  isAuthenticated: boolean;
  onGetStarted: () => void;
  onOpenAuth: () => void;
}

export function LandingPage({
  isAuthenticated,
  onGetStarted,
  onOpenAuth,
}: LandingPageProps) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [archImgFailed, setArchImgFailed] = useState(false);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-slate-100">
      {/* Top Bar Contract: Brand wordmark — 4 single-line nav links — 1 primary CTA */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070B14]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#home"
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            AutoPatch AI
          </a>

          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300"
          >
            <button
              type="button"
              onClick={() => scrollToSection('home')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('about')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            >
              About
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={isAuthenticated ? onGetStarted : onOpenAuth}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              {isAuthenticated ? 'Open Workbench' : 'Login'}
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section id="home" className="mx-auto max-w-7xl px-6 pt-14 pb-20 lg:pt-20 lg:pb-24">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
            <div className="flex flex-col justify-center lg:col-span-6">
              <p className="text-sm font-medium tracking-wide text-blue-400">
                Detect. Understand. Repair. Verify.
              </p>
              <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-white text-balance sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                Your AI-Powered Software Debugging Assistant.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
                Upload individual source files or complete project archives. AutoPatch AI pinpoints
                exact bug locations, explains root causes in plain developer language, generates
                minimal side-by-side patches, and validates fixes against edge-case tests.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('features')}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0D1322] px-6 py-3 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  Explore Features
                </button>
              </div>

              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-800/80 pt-6 text-xs text-slate-400">
                <span>Python, JS/TS, C/C++, Java, Go</span>
                <span aria-hidden="true">·</span>
                <span>Monaco Side-by-Side Diff</span>
                <span aria-hidden="true">·</span>
                <span>Safe Non-Destructive Repair</span>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[300px] overflow-hidden rounded-xl border border-slate-800 bg-[#0D1322]">
                {!heroImgFailed ? (
                  <img
                    src="/src/assets/images/hero_code_workbench_1795062933011.jpg"
                    alt="AutoPatch AI geometric inspection planes and optical code analysis workbench"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[300px] flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-[#0D1322] to-indigo-950/60 p-8 text-center">
                    <Code2 className="h-12 w-12 text-blue-400" aria-hidden="true" />
                    <p className="mt-3 font-display text-base font-semibold text-white">
                      AutoPatch AI Code Inspection Engine
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Workflow Visualization */}
        <section
          id="how-it-works"
          className="border-y border-slate-800/80 bg-[#0A101D] py-16 lg:py-20"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Five-Stage Autonomous Repair Workflow
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                Every file passes through structured static inspection, root cause diagnosis,
                surgical diff generation, and test verification before any change is approved.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {[
                {
                  step: '01',
                  title: 'Upload',
                  desc: 'Drop source files or ZIP project archives with automatic language detection and size validation.',
                },
                {
                  step: '02',
                  title: 'Scan',
                  desc: 'Gemini inspects syntax, runtime exceptions, edge cases, and security patterns by line number.',
                },
                {
                  step: '03',
                  title: 'Explain',
                  desc: 'Review plain-English root cause breakdowns, impact analysis, and inline code explanations.',
                },
                {
                  step: '04',
                  title: 'Fix',
                  desc: 'Compare original vs patched lines in Monaco DiffEditor and accept or reject each change.',
                },
                {
                  step: '05',
                  title: 'Test',
                  desc: 'Verify normal, invalid, and boundary inputs before and after patching, then export PDF reports.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-xl border border-slate-800 bg-[#0D1322] p-5 transition-colors hover:border-slate-700"
                >
                  <div className="font-mono text-xs font-semibold text-blue-400 tabular-nums">
                    {item.step}
                  </div>
                  <h3 className="mt-2 font-display text-base font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Asymmetric Bento Grid */}
        <section id="features" className="mx-auto max-w-7xl px-6 py-16 lg:py-24">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Built for Comprehension, Not Blind Auto-Edits
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Instead of silently rewriting files, AutoPatch AI pairs every patch with line-level
              attribution, transparent confidence estimates, and side-by-side review.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-6 md:col-span-2">
              <div className="flex items-center gap-3 text-blue-400">
                <Bug className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-medium text-blue-400">
                  01. Intelligent Code Scanner & Prioritization
                </span>
              </div>
              <h3 className="mt-3 font-display text-xl font-semibold text-white">
                Exact Line-Level Detection Ranked by Risk
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                Detects syntax errors, logical flaws, division-by-zero traps, unvalidated inputs,
                and security anti-patterns across uploaded projects. Findings are ranked by severity,
                category impact, and AI confidence score so critical issues surface first.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-6">
              <div className="flex items-center gap-3 text-purple-400">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-medium text-purple-400">02. Explain My Code</span>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold text-white">
                Select Any Block to Learn Why
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Highlight any function or expression in the Monaco Editor to receive a step-by-step
                walkthrough, complexity note, and pitfall checklist.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-6">
              <div className="flex items-center gap-3 text-blue-400">
                <FileDiff className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-medium text-blue-400">
                  03. Side-by-Side Comparison
                </span>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold text-white">
                Monaco DiffEditor Review
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Inspect original code on the left against AI-corrected code on the right with clear
                added, removed, and modified line highlighting before approving.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#0D1322] p-6 md:col-span-2">
              <div className="flex items-center gap-3 text-purple-400">
                <FlaskConical className="h-5 w-5" aria-hidden="true" />
                <span className="text-xs font-medium text-purple-400">
                  04. Testing & Before/After Validation
                </span>
              </div>
              <h3 className="mt-3 font-display text-xl font-semibold text-white">
                Normal, Invalid & Boundary Case Verification
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
                Generates targeted test suites covering valid inputs, malformed payloads, and edge
                boundaries. JavaScript modules execute in an isolated zero-privilege VM sandbox to
                compare before vs. after behavior honestly—never claiming verification unless tests
                actually ran.
              </p>
            </div>
          </div>
        </section>

        {/* About & Safety Guarantees */}
        <section
          id="about"
          className="border-t border-slate-800/80 bg-[#0A101D] py-16 lg:py-24"
        >
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 lg:grid-cols-12 lg:items-stretch">
            <div className="lg:col-span-6">
              <div className="h-full min-h-[280px] overflow-hidden rounded-xl border border-slate-800 bg-[#0D1322]">
                {!archImgFailed ? (
                  <img
                    src="/src/assets/images/architecture_pipeline_layers_1795062932102.jpg"
                    alt="Layered verification architecture visualization"
                    referrerPolicy="no-referrer"
                    onError={() => setArchImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[280px] flex-col items-center justify-center bg-slate-900 p-8">
                    <ShieldCheck className="h-12 w-12 text-blue-400" aria-hidden="true" />
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col justify-center lg:col-span-6">
              <h2 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Designed for Safe, Auditable Repairs
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                AutoPatch AI treats your uploaded source tree as immutable. All repairs live in a
                reviewed patch branch until you explicitly accept and export them.
              </p>

              <ul className="mt-6 space-y-4 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <ShieldCheck
                    className="mt-0.5 h-5 w-5 shrink-0 text-blue-400"
                    aria-hidden="true"
                  />
                  <div>
                    <span className="font-semibold text-white">Safe Repair Mode:</span> Original
                    uploaded files are never overwritten automatically; repaired versions are stored
                    and downloaded separately.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-purple-400" aria-hidden="true" />
                  <div>
                    <span className="font-semibold text-white">Untrusted Code Isolation:</span>{' '}
                    Uploaded archives are validated by extension and size and are never executed
                    directly on the host OS.
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-blue-400"
                    aria-hidden="true"
                  />
                  <div>
                    <span className="font-semibold text-white">Complete Audit & PDF Export:</span>{' '}
                    Every scan, accepted fix, rejection, and test case is persisted in relational
                    storage and exportable as a structured PDF report.
                  </div>
                </li>
              </ul>

              <div className="mt-8">
                <button
                  type="button"
                  onClick={onGetStarted}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <span>Launch Developer Workbench</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800/80 bg-[#070B14] py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 text-xs text-slate-400 sm:flex-row sm:items-center">
          <div className="font-display font-semibold text-slate-200">
            AutoPatch AI · Autonomous Software Bug Detection & Repair
          </div>
          <div>Detect. Understand. Repair. Verify.</div>
        </div>
      </footer>
    </div>
  );
}
