"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { ModelHealthContent } from "./model-health-content";

export default function ModelHealthPage() {
  return <ProtectedRoute allowedRoles={["superAdmin", "admin"]}><ModelHealthContent /></ProtectedRoute>;
}
