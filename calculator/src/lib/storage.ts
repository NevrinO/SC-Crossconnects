export interface StoredSession {
  id: string;
  timestamp: string;  // ISO date
  name?: string;      // User can name sessions
  results: CalculationRecord[];
}

export interface CalculationRecord {
  id: string;
  timestamp: string;
  start: string;
  end: string;
  room: string;
  cableType: 'fiber' | 'copper';
  pathName: string;
  feet: number;
  meters: number;
  qty?: number; // Quantity field (defaults to 1 if not provided)
}

const STORAGE_KEY = 'crossconnect_sessions';
const MAX_SESSIONS = 50;
const MAX_STORAGE_BYTES = 2 * 1024 * 1024; // 2MB

export function loadSessions(): StoredSession[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to load sessions:', err);
    return [];
  }
}

export function saveSession(session: StoredSession): { success: boolean; error?: string } {
  try {
    const sessions = loadSessions();
    const existingIndex = sessions.findIndex(s => s.id === session.id);

    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }

    // Enforce session count limit - remove oldest sessions if needed
    if (sessions.length > MAX_SESSIONS) {
      sessions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      sessions.splice(0, sessions.length - MAX_SESSIONS);
    }

    // Enforce storage size limit - remove oldest sessions if needed
    let serialized = JSON.stringify(sessions);
    while (serialized.length > MAX_STORAGE_BYTES && sessions.length > 1) {
      sessions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      sessions.shift(); // Remove oldest session
      serialized = JSON.stringify(sessions);
    }

    localStorage.setItem(STORAGE_KEY, serialized);
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to save session';
    console.error('Failed to save session:', err);
    return { success: false, error: errorMessage };
  }
}

export function deleteSession(id: string): { success: boolean; error?: string } {
  try {
    const sessions = loadSessions();
    const filtered = sessions.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to delete session';
    console.error('Failed to delete session:', err);
    return { success: false, error: errorMessage };
  }
}

export function clearOldSessions(cutoffDate: Date): void {
  try {
    const sessions = loadSessions();
    const validSessions = sessions.filter(s => 
      new Date(s.timestamp) > cutoffDate
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validSessions));
  } catch (err) {
    console.error('Failed to clear old sessions:', err);
  }
}

// Initialize cleanup on app load
export function initializeSessionCleanup(): void {
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  clearOldSessions(oneYearAgo);
}

export function createSessionId(): string {
  // 9 random base36 characters = 36^9 ≈ 100 trillion combinations
  // Collision probability is negligible for expected session volume (<1000 sessions/year)
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}
