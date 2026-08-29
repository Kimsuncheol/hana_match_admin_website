import { ProtectedRoute } from "@/components/auth/protected-route";
import { CaseDetailContent } from "./case-detail-content";

export default async function CaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return (
    <ProtectedRoute>
      <CaseDetailContent caseId={caseId} />
    </ProtectedRoute>
  );
}

