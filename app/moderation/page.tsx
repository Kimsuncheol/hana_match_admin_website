"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { ModerationQueueContent } from "./moderation-queue-content";

export default function ModerationQueuePage() {
  return (
    <ProtectedRoute>
      <ModerationQueueContent />
    </ProtectedRoute>
  );
}

