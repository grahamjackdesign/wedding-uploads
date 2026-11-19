"use server";

import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, adminToken } from "@/lib/admin-auth";

export async function login(formData: FormData) {
  const pw = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) redirect("/admin?error=config");
  const a = Buffer.from(pw);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) redirect("/admin?error=1");

  (await cookies()).set(COOKIE, adminToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 60 * 12,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).set(COOKIE, "", { path: "/admin", maxAge: 0 });
  redirect("/admin");
}
