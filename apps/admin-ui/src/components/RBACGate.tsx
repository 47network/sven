'use client';

import { ReactNode } from 'react';
import { useMe } from '@/lib/hooks';

interface RBACGateProps {
  /** Required role(s) to render children. If array, user must have ANY of the listed roles. */
  roles: string | string[];
  /** Content shown when user lacks the required role. Defaults to nothing. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditionally renders children only if the current user has one of the required roles.
 *
 * Usage:
 *   <RBACGate roles="admin">
 *     <DangerButton />
 *   </RBACGate>
 *
 *   <RBACGate roles={['admin', 'moderator']} fallback={<p>Insufficient permissions</p>}>
 *     <SecretPanel />
 *   </RBACGate>
 */
export function RBACGate({ roles, fallback = null, children }: RBACGateProps) {
  const { data: me, isLoading } = useMe();

  // While loading, render nothing to avoid flicker
  if (isLoading) return null;

  const requiredRoles = Array.isArray(roles) ? roles : [roles];
  const userRole = me?.role ?? '';

  const allowed = requiredRoles.includes(userRole);

  return <>{allowed ? children : fallback}</>;
}
