import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
    cookies: Record<string, string | undefined>;
    correlationId?: string;
    user?: {
      id: string;
      role?: string;
    };
    userId: string;
    userRole?: string;
    orgId?: string;
    tenantRole?: string;
  }

  interface FastifyReply {
    setCookie(name: string, value: string, options?: Record<string, unknown>): FastifyReply;
    clearCookie(name: string, options?: Record<string, unknown>): FastifyReply;
  }
}
