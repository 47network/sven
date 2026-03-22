/**
 * Calendar Integration Utilities
 *
 * Supports:
 * - Radicale CalDAV (self-hosted)
 * - Google Calendar (cloud-based)
 */
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
    changes: Record<string, {
        from: unknown;
        to: unknown;
    }>;
    preview: Partial<CalendarEvent>;
}
/**
 * Radicale CalDAV Calendar Interface
 */
export interface RadicaleCalendarConfig {
    baseUrl: string;
    username: string;
    passwordRef: string;
    readonly?: boolean;
}
export declare class RadicaleCalendar {
    private config;
    private password?;
    constructor(config: RadicaleCalendarConfig);
    initialize(resolveSecret: (ref: string) => Promise<string>): Promise<void>;
    listCalendars(): Promise<Array<{
        id: string;
        name: string;
    }>>;
    listEvents(calendarId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]>;
    createEvent(calendarId: string, event: CalendarEvent): Promise<string>;
    updateEvent(calendarId: string, eventId: string, updates: Partial<CalendarEvent>): Promise<void>;
    deleteEvent(calendarId: string, eventId: string): Promise<void>;
    private request;
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
export declare class GoogleCalendar {
    private config;
    private accessToken?;
    private refreshToken?;
    constructor(config: GoogleCalendarConfig);
    /**
     * Generate OAuth authorization URL for user to visit
     */
    getAuthorizationUrl(state: string): string;
    /**
     * Exchange authorization code for tokens
     */
    exchangeCodeForToken(code: string): Promise<{
        accessToken: string;
        refreshToken: string;
        expiryDate: Date;
    }>;
    /**
     * Refresh access token using refresh token
     */
    refreshAccessToken(): Promise<{
        accessToken: string;
        expiryDate: Date;
    }>;
    /**
     * List calendars accessible to the user
     */
    listCalendars(): Promise<Array<{
        id: string;
        name: string;
        readonly: boolean;
    }>>;
    /**
     * List events in a calendar
     */
    listEvents(calendarId: string, startDate: Date, endDate: Date, searchQuery?: string): Promise<CalendarEvent[]>;
    /**
     * Create a new event
     */
    createEvent(calendarId: string, event: CalendarEvent): Promise<string>;
    /**
     * Update an existing event
     */
    updateEvent(calendarId: string, eventId: string, updates: Partial<CalendarEvent>): Promise<void>;
    /**
     * Delete an event
     */
    deleteEvent(calendarId: string, eventId: string, notifyAttendees?: boolean): Promise<void>;
    /**
     * Make authenticated request to Google Calendar API
     */
    private makeRequest;
    setTokens(accessToken: string, refreshToken?: string): void;
}
/**
 * Compute diff/preview for event changes
 */
export declare function computeEventDiff(current: CalendarEvent | undefined, proposed: CalendarEvent): CalendarDiff;
//# sourceMappingURL=calendar.d.ts.map