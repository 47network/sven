import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';

const CALENDAR_ROUTE = path.resolve(__dirname, '../routes/admin/calendar.ts');

describe('admin/calendar route contract', () => {
  let source: string;

  beforeAll(async () => {
    source = await fs.readFile(CALENDAR_ROUTE, 'utf8');
  });

  it('registers calendar accounts and subscriptions endpoints', () => {
    expect(source).toContain("'/calendar/accounts'");
    expect(source).toContain("'/calendar/subscriptions'");
  });

  it('supports Radicale CalDAV and Google Calendar providers', () => {
    expect(source).toContain('RadicaleCalendar');
    expect(source).toContain('GoogleCalendar');
  });

  it('uses resolveSecretRef for credential handling', () => {
    expect(source).toContain('resolveSecretRef');
    expect(source).toContain("@sven/shared");
  });

  it('configures Google Calendar OAuth state store', () => {
    expect(source).toContain('configureGoogleCalendarOAuthStateStore');
    expect(source).toContain('issueGoogleCalendarOAuthState');
  });

  it('registers Google OAuth start endpoint', () => {
    expect(source).toContain("'/auth/google/start'");
  });
});
