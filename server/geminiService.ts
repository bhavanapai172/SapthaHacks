import crypto from 'node:crypto';
import vm from 'node:vm';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { BugCategory, Severity } from '../src/types';

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets (or .env) to enable live AI scanning, explanation, and patch generation.'
    );
    this.name = 'MissingApiKeyError';
  }
}

export const GEMINI_MODEL = 'gemini-4-hydrogen';

export function isGeminiConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key !== 'MY_GEMINI_API_KEY' && key.length > 10);
}

function getGeminiClient(): GoogleGenAI {
  if (!isGeminiConfigured()) {
    throw new MissingApiKeyError();
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractCleanErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string; code?: number } };
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // not JSON
  }
  return raw;
}

async function withGeminiRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const msg = extractCleanErrorMessage(err);
      const isTransient =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('429') ||
        msg.includes('high demand') ||
        msg.includes('RESOURCE_EXHAUSTED');
      if (!isTransient || attempt === maxAttempts) {
        throw new Error(msg);
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }
  throw new Error(extractCleanErrorMessage(lastError));
}

export interface AnalyzedBugItem {
  filePath: string;
  lineNumber: number;
  endLineNumber: number;
  category: BugCategory;
  severity: Severity;
  title: string;
  description: string;
  whyOccurred: string;
  rootCause: string;
  potentialImpact: string;
  suggestedSolution: string;
  confidenceEstimate: number;
  originalSnippet: string;
  patchedSnippet: string;
  patchedFullContent: string;
  fixExplanation: string;
}

export interface ProjectScanResult {
  summary: string;
  bugs: AnalyzedBugItem[];
}

export async function analyzeProjectWithGemini(
  files: Array<{ filePath: string; language: string; content: string }>
): Promise<ProjectScanResult> {
  const ai = getGeminiClient();

  const filesText = files
    .map((f) => {
      const numbered = f.content
        .split('\n')
        .map((line, i) => `${i + 1}: ${line}`)
        .join('\n');
      return `=== FILE: ${f.filePath} (language: ${f.language}) ===\n${numbered}`;
    })
    .join('\n\n');

  const prompt = `You are AutoPatch AI, a senior autonomous software debugging and security auditor.
Analyze the following source files carefully and identify real, concrete bugs across syntax errors, logical errors, runtime exceptions, incorrect outputs, edge-case failures, security vulnerabilities, and suspicious code patterns.

Rules:
1. Reference the exact filePath and accurate 1-indexed lineNumber/endLineNumber from the numbered lines below.
2. Provide beginner-friendly, crystal-clear root cause analysis explaining WHY the bug occurred, WHAT caused it, its POTENTIAL IMPACT, and the SUGGESTED SOLUTION.
3. For each bug, produce a minimal, surgical fix that does NOT rewrite unrelated code:
   - originalSnippet: exact lines from the original file around the bug
   - patchedSnippet: only the corrected lines replacing originalSnippet
   - patchedFullContent: the complete corrected content of that file with ONLY this bug's minimal fix applied (preserving all other formatting and unrelated code).
4. Provide an honest confidenceEstimate (integer 1-99) representing how certain you are that the fix is accurate without breaking other behavior.
5. Do not invent fake bugs if a file is clean.

Source files:
${filesText}`;

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    config: {
      systemInstruction:
        'You are a strict static and semantic code analyzer. Return valid JSON matching the schema exactly.',
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: {
            type: Type.STRING,
            description: 'Concise overall summary of scan findings across all analyzed files.',
          },
          bugs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                filePath: { type: Type.STRING },
                lineNumber: { type: Type.INTEGER },
                endLineNumber: { type: Type.INTEGER },
                category: {
                  type: Type.STRING,
                  description:
                    'One of: syntax, logical, runtime, edge_case, security, pattern',
                },
                severity: {
                  type: Type.STRING,
                  description: 'One of: critical, high, medium, low',
                },
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                whyOccurred: { type: Type.STRING },
                rootCause: { type: Type.STRING },
                potentialImpact: { type: Type.STRING },
                suggestedSolution: { type: Type.STRING },
                confidenceEstimate: { type: Type.INTEGER },
                originalSnippet: { type: Type.STRING },
                patchedSnippet: { type: Type.STRING },
                patchedFullContent: { type: Type.STRING },
                fixExplanation: { type: Type.STRING },
              },
              required: [
                'filePath',
                'lineNumber',
                'endLineNumber',
                'category',
                'severity',
                'title',
                'description',
                'whyOccurred',
                'rootCause',
                'potentialImpact',
                'suggestedSolution',
                'confidenceEstimate',
                'originalSnippet',
                'patchedSnippet',
                'patchedFullContent',
                'fixExplanation',
              ],
            },
          },
        },
        required: ['summary', 'bugs'],
      },
    },
  }));

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as ProjectScanResult;
  return {
    summary: parsed.summary || 'Scan completed.',
    bugs: Array.isArray(parsed.bugs) ? parsed.bugs : [],
  };
}

export async function explainCodeWithGemini(
  filePath: string,
  language: string,
  selectedCode: string,
  fullContext: string
) {
  const ai = getGeminiClient();

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Explain the following selected ${language} code from "${filePath}" clearly so a developer or student can immediately understand what it does, step-by-step execution, and any hidden pitfalls.\n\nSelected code:\n\`\`\`${language}\n${selectedCode}\n\`\`\`\n\nSurrounding file context:\n\`\`\`${language}\n${fullContext.slice(0, 6000)}\n\`\`\``,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          stepByStep: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          potentialPitfalls: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          complexityNote: { type: Type.STRING },
        },
        required: ['summary', 'stepByStep', 'potentialPitfalls', 'complexityNote'],
      },
    },
  }));

  const rawText = (response.text ?? '{}').trim();
  return JSON.parse(rawText) as {
    summary: string;
    stepByStep: string[];
    potentialPitfalls: string[];
    complexityNote: string;
  };
}

export interface GeneratedTestCase {
  testName: string;
  category: 'normal' | 'invalid' | 'boundary';
  inputSummary: string;
  expectedBehavior: string;
  jsAssertionExpression?: string;
  predictedBeforeOutcome: string;
  predictedAfterOutcome: string;
}

export async function generateTestsWithGemini(params: {
  filePath: string;
  language: string;
  originalContent: string;
  patchedContent: string;
  bugTitle: string;
  bugDescription: string;
}): Promise<GeneratedTestCase[]> {
  const ai = getGeminiClient();

  const isJs = params.language === 'javascript';
  const jsInstruction = isJs
    ? `Because the language is JavaScript, ALSO provide "jsAssertionExpression" for each test: a pure self-contained JavaScript function body (NO fs, NO process, NO net, NO eval; only standard JS + Buffer + optional require('crypto') for timingSafeEqual/hash) that receives the module exports object as \`mod\` and returns \`{ passed: boolean, detail: string }\`. Do NOT write assertions that expect exceptions unless the code explicitly throws. Example: \`const { verifySignature } = mod; const res = verifySignature("secret", "wrong"); return { passed: res === false, detail: String(res) };\``
    : `Because the language is ${params.language} (non-JS, cannot run in browser/Node VM without native execution), leave jsAssertionExpression empty and explain exact expected inputs and predicted before/after behavior honestly.`;

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Generate 6 targeted validation test cases (2 normal inputs, 2 invalid inputs, 2 boundary conditions) to compare behavior BEFORE and AFTER applying a fix for "${params.bugTitle}" in "${params.filePath}".

Bug description: ${params.bugDescription}
${jsInstruction}

ORIGINAL CODE:
\`\`\`${params.language}
${params.originalContent}
\`\`\`

PATCHED CODE:
\`\`\`${params.language}
${params.patchedContent}
\`\`\``,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tests: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                testName: { type: Type.STRING },
                category: { type: Type.STRING, description: 'normal, invalid, or boundary' },
                inputSummary: { type: Type.STRING },
                expectedBehavior: { type: Type.STRING },
                jsAssertionExpression: { type: Type.STRING },
                predictedBeforeOutcome: { type: Type.STRING },
                predictedAfterOutcome: { type: Type.STRING },
              },
              required: [
                'testName',
                'category',
                'inputSummary',
                'expectedBehavior',
                'predictedBeforeOutcome',
                'predictedAfterOutcome',
              ],
            },
          },
        },
        required: ['tests'],
      },
    },
  }));

  const parsed = JSON.parse((response.text ?? '{}').trim()) as {
    tests?: GeneratedTestCase[];
  };
  return Array.isArray(parsed.tests) ? parsed.tests : [];
}

/**
 * Isolated zero-privilege Node VM runner for pure JavaScript CommonJS-style functions.
 * Never exposes fs, process, require, or network globals.
 */
export function runJsSandboxTest(
  sourceCode: string,
  assertionBody: string
): { executed: boolean; passed: boolean; output: string } {
  try {
    const safeCrypto = {
      timingSafeEqual: crypto.timingSafeEqual,
      createHash: crypto.createHash,
      createHmac: crypto.createHmac,
      randomBytes: crypto.randomBytes,
    };
    const safeRequire = (modName: string) => {
      if (modName === 'crypto' || modName === 'node:crypto') {
        return safeCrypto;
      }
      throw new Error(`Module "${modName}" is blocked in isolated sandbox`);
    };

    const sandbox = {
      module: { exports: {} as Record<string, unknown> },
      exports: {} as Record<string, unknown>,
      require: safeRequire,
      Buffer,
      TextEncoder,
      TextDecoder,
      Date,
      Math,
      JSON,
      Map,
      Set,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Error,
      TypeError,
      RangeError,
      SyntaxError,
    };
    const context = vm.createContext(sandbox);
    const wrapped = `
      "use strict";
      (function(module, exports) {
        ${sourceCode}
      })(module, exports);
      const __mod = Object.keys(module.exports).length ? module.exports : exports;
      (function(mod) {
        ${assertionBody}
      })(__mod);
    `;
    const script = new vm.Script(wrapped);
    const result = script.runInContext(context, { timeout: 400 }) as
      | { passed?: boolean; detail?: string }
      | undefined;

    if (result && typeof result.passed === 'boolean') {
      return {
        executed: true,
        passed: result.passed,
        output: result.detail ? String(result.detail) : result.passed ? 'Passed' : 'Failed',
      };
    }
    return {
      executed: true,
      passed: false,
      output: 'Assertion did not return { passed: boolean }.',
    };
  } catch (err) {
    return {
      executed: true,
      passed: false,
      output: err instanceof Error ? `Runtime error: ${err.message}` : 'Runtime exception',
    };
  }
}
