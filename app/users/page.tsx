"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { UserOperationsContent } from "./user-operations-content";

export default function UsersPage() {
  return <ProtectedRoute><UserOperationsContent /></ProtectedRoute>;
}

