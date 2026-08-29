"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { getAuthErrorMessage } from "@/lib/firebase/auth-errors";
import { requestDefaultRoleAssignment } from "@/lib/firebase/assign-role-client";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";

const MIN_PASSWORD_LENGTH = 6;

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setSubmitting(true);
    try {
      const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      await sendEmailVerification(credential.user).catch(() => {
        // Non-fatal: account creation already succeeded.
      });

      // The admin claim is assigned server-side by /api/admin/assign-role
      // (lib/firebase-admin/assign-role.ts), which verifies this user's own
      // ID token before granting anything — the client only reads the
      // outcome below, it never sets or requests a role itself.
      let assignment: { admin: boolean };
      try {
        assignment = await requestDefaultRoleAssignment(credential.user);
      } catch {
        router.push(
          "/sign-in?notice=" +
            encodeURIComponent(
              "가입은 완료되었지만 권한 설정 중 오류가 발생했습니다. 관리자에게 문의하세요.",
            ),
        );
        return;
      }

      if (assignment.admin) {
        router.push("/dashboard");
      } else {
        router.push(
          "/sign-in?notice=" +
            encodeURIComponent(
              "가입이 완료되었지만 관리자 권한이 자동으로 부여되지 않았습니다. 관리자에게 문의하세요.",
            ),
        );
      }
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard title="관리자 계정 만들기" description="회사 이메일로 가입하세요.">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <FormField
          id="email"
          label="이메일"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <FormField
          id="password"
          label="비밀번호"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <FormField
          id="confirm-password"
          label="비밀번호 확인"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "계정 생성 중..." : "회원가입"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm">
        이미 계정이 있으신가요?{" "}
        <Link href="/sign-in" className="text-blue-600 hover:underline">
          로그인
        </Link>
      </p>
    </AuthCard>
  );
}
