/**
 * Calendar Integration Utilities
 *
 * Supports:
 * - Radicale CalDAV (self-hosted)
 * - Google Calendar (cloud-based)
 */

import https from 'node:https';
import { URL } from 'node:url';

export type CalendarProvider = 'radicale' | 'google';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date | string;
  end: Date | string;
  allDay?: boolean;
  location?: string;
  description?: string;
  organizer?: string;
  attendees?: string[];
  rrule?: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
}

export interface CalendarDiff {
  isUpdate: boolean;
  changes: Record<string, { from: unknown; to: unknown }>;
  preview: Partial<CalendarEvent>;
}

/**
 * Radicale CalDAV Calendar Interface
 */
export interface RadicaleCalendarConfig {
  baseUrl: string; // e.g., https://radicale.example.com
  username: string;
  passwordRef: string; // secret ref like env://RADICALE_PASSWORD
  readonly?: boolean;
}

export class RadicaleCalendar {
  private config: RadicaleCalendarConfig;
  private password?: string;

  constructor(config: RadicaleCalendarConfig) {
    this.config = config;
  }

  async initialize(resolveSecret: (ref: string) => Promise<string>): Promise<void> {
    this.password = await resolveSecret(this.config.passwordRef);
  }

  async listCalendars(): Promise<Array<{ id: string; name: string }>> {
    if (!this.password) {
      throw new Error('Radicale calendar client is not initialized');
    }

    const pathsToTry = [`/${encodeURIComponent(this.config.username)}/`, '/'];
    let lastError: Error | null = null;

    for (const path of pathsToTry) {
      try {
        const responseXml = await this.request(
          'PROPFIND',
          path,
          `<?xml version="1.0" encoding="utf-8"?>
           <d:propfind xmlns:d="DAV:" xmlns:cs="http://calendarserver.org/ns/">
             <d:prop>
               <d:displayname />
               <d:resourcetype />
             </d:prop>
           </d:propfind>`,
          { Depth: '1' },
        );

        const calendars = parseRadicaleCalendarsFromMultiStatus(responseXml);
        if (calendars.length > 0) {
          return calendars;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (lastError) {
      throw lastError;
    }
    return [];
  }

  async listEvents(
    calendarId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CalendarEvent[]> {
    // Query Radicale CalDAV for events in date range using REPORT
    throw new Error('Radicale event listing not yet implemented');
  }

  async createEvent(calendarId: string, event: CalendarEvent): Promise<string> {
    // POST new event (iCalendar format) to Radicale
    throw new Error('Radicale event creation not yet implemented');
  }

  async updateEvent(calendarId: string, eventId: string, updates: Partial<CalendarEvent>): Promise<void> {
    // PUT updated event to Radicale
    throw new Error('Radicale event update not yet implemented');
  }

  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    // DELETE event from Radicale
    throw new Error('Radicale event deletion not yet implemented');
  }

  // Helper to make authenticated HTTP requests
  private async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PROPFIND' | 'REPORT',
    path: string,
    body?: string,
    extraHeaders?: Record<string, string>,
  ): Promise<string> {
    const url = new URL(path, this.config.baseUrl);
    const auth = Buffer.from(`${this.config.username}:${this.password}`).toString('base64');

    return new Promise((resolve, reject) => {
      const client = url.protocol === 'https:' ? https : require('http');
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/xml; charset=utf-8',
          ...(body && { 'Content-Length': Buffer.byteLength(body) }),
          ...(extraHeaders || {}),
        },
      };

      const req = client.request(options, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`Radicale request failed (${res.statusCode}): ${data}`));
          }
        });
      });

      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
  }
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseRadicaleCalendarsFromMultiStatus(xml: string): Array<{ id: string; name: string }> {
  const responses = xml.match(/<[^>]*:?response\b[\s\S]*?<\/[^>]*:?response>/gi) || [];
  const calendars: Array<{ id: string; name: string }> = [];
  const seenIds = new Set<string>();

  for (const response of responses) {
    const isCalendarCollection = /<[^>]*:?calendar\s*\/\s*>/i.test(response);
    if (!isCalendarCollection) continue;

    const hrefMatch = response.match(/<[^>]*:?href>([\s\S]*?)<\/[^>]*:?href>/i);
    if (!hrefMatch) continue;

    const href = decodeXmlEntities(String(hrefMatch[1] || '').trim());
    const cleanHref = href.split('?')[0].replace(/\/+$/, '');
    const id = decodeURIComponent(cleanHref.split('/').filter(Boolean).pop() || '').trim();
    if (!id || seenIds.has(id)) continue;

    const displayNameMatch = response.match(
      /<[^>]*:?displayname>([\s\S]*?)<\/[^>]*:?displayname>/i,
    );
    const name = decodeXmlEntities(String(displayNameMatch?.[1] || '').trim()) || id;

    seenIds.add(id);
    calendars.push({ id, name });
  }

  return calendars;
}

/**
 * Google Calendar Interface
 */
export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  accessToken?: string;
  refreshToken?: string;
}

export class GoogleCalendar {
  private config: GoogleCalendarConfig;
  private accessToken?: string;
  private refreshToken?: string;

  constructor(config: GoogleCalendarConfig) {
    this.config = config;
    this.accessToken = config.accessToken;
    this.refreshToken = config.refreshToken;
  }

  /**
   * Generate OAuth authorization URL for user to visit
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/calendar',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForToken(code: string): Promise<{ accessToken: string; refreshToken: string; expiryDate: Date }> {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: this.config.redirectUri,
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code for token: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || this.refreshToken || '',
      expiryDate: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(): Promise<{ accessToken: string; expiryDate: Date }> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.accessToken = data.access_token;
    return {
      accessToken: data.access_token,
      expiryDate: new Date(Date.now() + data.expires_in * 1000),
    };
  }

  /**
   * List calendars accessible to the user
   */
  async listCalendars(): Promise<Array<{ id: string; name: string; readonly: boolean }>> {
    const response = await this.makeRequest('GET', 'https://www.googleapis.com/calendar/v3/users/me/calendarList');
    const data = (await response.json()) as any;

    return (data.items || []).map((item: any) => ({
      id: item.id,
      name: item.summary || item.id,
      readonly: !item.accessRole || item.accessRole === 'reader',
    }));
  }

  /**
   * List events in a calendar
   */
  async listEvents(
    calendarId: string,
    startDate: Date,
    endDate: Date,
    searchQuery?: string,
  ): Promise<CalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
      ...(searchQuery && { q: searchQuery }),
    });

    const response = await this.makeRequest(
      'GET',
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    );
    const data = (await response.json()) as any;

    return (data.items || []).map((item: any) => ({
      id: item.id,
      title: item.summary || '(No title)',
      start: item.start.dateTime || item.start.date,
      end: item.end.dateTime || item.end.date,
      allDay: !item.start.dateTime,
      location: item.location,
      description: item.description,
      organizer: item.organizer?.email,
      attendees: item.attendees?.map((a: any) => a.email) || [],
      rrule: item.recurrence?.join('\n'),
      status: item.status,
    }));
  }

  /**
   * Create a new event
   */
  async createEvent(calendarId: string, event: CalendarEvent): Promise<string> {
    const body = {
      summary: event.title,
      description: event.description,
      location: event.location,
      start: event.allDay
        ? { date: new Date(event.start).toISOString().split('T')[0] }
        : { dateTime: new Date(event.start).toISOString() },
      end: event.allDay
        ? { date: new Date(event.end).toISOString().split('T')[0] }
        : { dateTime: new Date(event.end).toISOString() },
      attendees: event.attendees?.map((email) => ({ email })),
      recurrence: event.rrule ? [`RRULE:${event.rrule}`] : undefined,
    };

    const response = await this.makeRequest(
      'POST',
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
      JSON.stringify(body),
    );
    const data = (await response.json()) as any;
    return data.id;
  }

  /**
   * Update an existing event
   */
  async updateEvent(calendarId: string, eventId: string, updates: Partial<CalendarEvent>): Promise<void> {
    // First fetch current event
    const getResponse = await this.makeRequest(
      'GET',
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    );
    const current = (await getResponse.json()) as any;

    // Merge updates
    const updated = {
      summary: updates.title ?? current.summary,
      description: updates.description ?? current.description,
      location: updates.location ?? current.location,
      start: updates.start
        ? { dateTime: new Date(updates.start).toISOString() }
        : current.start,
      end: updates.end
        ? { dateTime: new Date(updates.end).toISOString() }
        : current.end,
    };

    await this.makeRequest(
      'PUT',
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      JSON.stringify(updated),
    );
  }

  /**
   * Delete an event
   */
  async deleteEvent(calendarId: string, eventId: string, notifyAttendees: boolean = true): Promise<void> {
    const params = new URLSearchParams({
      sendNotifications: notifyAttendees ? 'true' : 'false',
    });

    await this.makeRequest(
      'DELETE',
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}?${params}`,
    );
  }

  /**
   * Make authenticated request to Google Calendar API
   */
  private async makeRequest(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    body?: string,
  ): Promise<Response> {
    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...(body && { 'Content-Length': Buffer.byteLength(body).toString() }),
      },
    };

    if (body) {
      options.body = body;
    }

    const response = await fetch(url, options);

    // Handle token expiry and refresh
    if (response.status === 401) {
      await this.refreshAccessToken();
      // Retry request with new token
      return this.makeRequest(method, url, body);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Calendar API error (${response.status}): ${text}`);
    }

    return response;
  }

  setTokens(accessToken: string, refreshToken?: string): void {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
    }
  }
}

/**
 * Compute diff/preview for event changes
 */
export function computeEventDiff(current: CalendarEvent | undefined, proposed: CalendarEvent): CalendarDiff {
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  if (!current) {
    return {
      isUpdate: false,
      changes: {},
      preview: proposed,
    };
  }

  const fields: (keyof CalendarEvent)[] = ['title', 'start', 'end', 'location', 'description', 'organizer'];
  fields.forEach((field) => {
    if (current[field] !== proposed[field]) {
      changes[field] = { from: current[field], to: proposed[field] };
    }
  });

  return {
    isUpdate: true,
    changes,
    preview: proposed,
  };
}
