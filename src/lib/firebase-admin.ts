import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function resolveProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }

  const candidates = [path.resolve(process.cwd(), 'firebase-applet-config.json')];

  try {
    if (typeof __dirname === 'string' && __dirname) {
      candidates.push(path.resolve(__dirname, '../../firebase-applet-config.json'));
      candidates.push(path.resolve(__dirname, '../firebase-applet-config.json'));
    } else if (typeof import.meta !== 'undefined' && import.meta.url) {
      const currentDir = path.dirname(fileURLToPath(import.meta.url));
      candidates.push(path.resolve(currentDir, '../../firebase-applet-config.json'));
      candidates.push(path.resolve(currentDir, '../firebase-applet-config.json'));
    }
  } catch {
    // Ignore path fallback errors in bundled runtimes
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
          projectId?: string;
        };
        if (parsed.projectId) return parsed.projectId;
      }
    } catch {
      // Try next candidate
    }
  }

  return 'deductive-climber-p5v9p';
}

if (!getApps().length) {
  initializeApp({
    projectId: resolveProjectId(),
  });
}

export const adminAuth = getAuth();
