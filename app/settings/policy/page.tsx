"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { PolicySettingsContent } from "./policy-settings-content";

export default function PolicySettingsPage() {
  return <ProtectedRoute allowedRoles={["superAdmin"]}><PolicySettingsContent /></ProtectedRoute>;
}
