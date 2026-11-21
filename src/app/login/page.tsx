import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Masuk" };

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
