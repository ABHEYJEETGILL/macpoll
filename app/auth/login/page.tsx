import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="max-w-md px-4 py-10 mx-auto text-sm text-slate-600">Loading...</div>}
    >
      <LoginForm />
    </Suspense>
  );
}
