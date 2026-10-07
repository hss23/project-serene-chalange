import type { Me, Role } from "./types";

export const ROLE_LABEL: Record<Role, string> = {
  student: "Student",
  teacher: "Teacher",
  admin: "Admin",
};

export const ROLE_HINT: Record<Role, string> = {
  student: "mentee",
  teacher: "mentor",
  admin: "administrator",
};

/** Which roles may open each section. Paths not listed are open to every signed-in user. */
const ROUTE_ROLES: [prefix: string, roles: Role[]][] = [
  ["/admin", ["admin"]],
  ["/dashboard", ["student", "teacher"]],
  ["/profile", ["student", "teacher"]],
  ["/match", ["student", "admin"]],
  ["/saved", ["student"]],
  ["/mentorship", ["student"]],
  ["/mentors", ["student", "teacher", "admin"]],
  ["/chat", ["student", "teacher", "admin"]],
];

export function allowedRoles(pathname: string): Role[] | null {
  return ROUTE_ROLES.find(([p]) => pathname === p || pathname.startsWith(`${p}/`))?.[1] ?? null;
}

/** Where a signed-in user should land. */
export function homePath(me: Me | null): string {
  if (!me) return "/login";
  if (!me.user.role || !me.profileComplete) return "/onboarding";
  return me.user.role === "admin" ? "/admin" : "/dashboard";
}
