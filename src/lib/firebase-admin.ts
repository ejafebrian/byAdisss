import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(__dirname, '../../firebase-applet-config.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
        projectId?: string;
      };
      if (parsed.projectId) return parsed.projectId;
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
