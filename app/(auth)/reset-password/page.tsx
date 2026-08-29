"use client";

import { useState } from "react";
import Link from "next/link";
import { FirebaseError } from "firebase/app";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { AuthCard } from "@/components/auth/auth-card";
import { FormField } from "@/components/auth/form-field";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSent(true);
    } catch (err) {
      // Avoid leaking whether an email exists: only surface a real client
      // error (bad format), otherwise show the same generic confirmation
      // Firebase would show for a valid, unregistered address.
      if (err instanceof FirebaseError && err.code === "auth/invalid-email") {
        setError("이메일 형식이 올바르지 않습니다.");
      } else {
        setSent(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthCard title="이메일을 확인하세요">
        <p className="text-sm text-zinc-600">
          입력하신 이메일 주소로 계정이 존재하는 경우, 비밀번호 재설정 링크를 보내드렸습니다.
        </p>
        <Link href="/sign-in" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
          로그인으로 돌아가기
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="비밀번호 재설정" description="가입한 이메일 주소를 입력하세요.">
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
          {submitting ? "전송 중..." : "재설정 링크 보내기"}
        </button>
      </form>
      <Link href="/sign-in" className="mt-6 inline-block text-sm text-blue-600 hover:underline">
        로그인으로 돌아가기
      </Link>
    </AuthCard>
  );
}
