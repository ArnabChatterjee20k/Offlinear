import { Github } from "lucide-react";
import { loginWithGitHub } from "@/auth";

export function Login() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-canvas">
      <div className="w-full max-w-[360px] px-6 text-center">
        <div className="mx-auto mb-5 grid h-11 w-11 place-items-center rounded-xl bg-brand text-[18px] font-bold text-white">
          O
        </div>
        <h1 className="text-[24px] font-semibold tracking-tight text-ink">Offlinear</h1>
        <p className="mt-1.5 text-[14px] text-ink-subtle">
          Offline-first issues, mirrored to GitHub.
        </p>

        <button
          onClick={loginWithGitHub}
          className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-md bg-ink px-3 py-2.5 text-[14px] font-medium text-canvas transition-colors hover:bg-ink-muted"
        >
          <Github className="h-4 w-4" />
          Continue with GitHub
        </button>

        <p className="mt-4 text-[12px] text-ink-tertiary">
          You'll be redirected to GitHub to authorize.
        </p>
      </div>
    </div>
  );
}
