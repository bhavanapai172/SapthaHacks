import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import jsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import tsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';

let initialized = false;

export function ensureMonacoConfigured(): void {
  if (initialized) return;
  initialized = true;

  const win = self as unknown as {
    MonacoEnvironment?: { getWorker: (moduleId: string, label: string) => Worker };
  };

  win.MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      if (label === 'json') {
        return new jsonWorker();
      }
      if (label === 'typescript' || label === 'javascript') {
        return new tsWorker();
      }
      return new editorWorker();
    },
  };

  loader.config({ monaco });

  monaco.editor.defineTheme('autopatch-obsidian', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
      { token: 'keyword', foreground: '60A5FA' },
      { token: 'string', foreground: '34D399' },
      { token: 'number', foreground: 'A78BFA' },
      { token: 'type', foreground: '38BDF8' },
    ],
    colors: {
      'editor.background': '#0A101D',
      'editor.foreground': '#E2E8F0',
      'editorLineNumber.foreground': '#475569',
      'editorLineNumber.activeForeground': '#94A3B8',
      'editor.selectionBackground': '#2563EB40',
      'editor.lineHighlightBackground': '#131C31',
      'editorGutter.background': '#0A101D',
      'diffEditor.insertedTextBackground': '#10B98126',
      'diffEditor.removedTextBackground': '#EF444426',
      'diffEditor.insertedLineBackground': '#10B98118',
      'diffEditor.removedLineBackground': '#EF444418',
    },
  });
}

export { monaco };
