import { Building2, Loader2, Lock } from "lucide-react";

function FieldLabel({ children }) {
  return <label className="mb-1 block text-xs font-black text-slate-500">{children}</label>;
}

export default function LoginForm({ id, password, setId, setPassword, message, loading = false, onSubmit }) {
  const submitLogin = (event) => {
    event?.preventDefault?.();
    if (loading) return;
    onSubmit();
  };

  const submitOnEnter = (event) => {
    if (event.key !== "Enter") return;
    submitLogin(event);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <form className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-xl" onSubmit={submitLogin}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400">DAELIM BATH & KITCHEN</p>
            <h1 className="text-2xl font-black">시공사 포털 로그인</h1>
            <p className="mt-1 text-xs font-bold text-slate-500">계정 권한에 따라 화면이 자동으로 열립니다.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <FieldLabel>ID</FieldLabel>
            <input value={id} onKeyDown={submitOnEnter} onChange={(e) => setId(e.target.value)} disabled={loading} className="w-full rounded-2xl border px-4 py-3 text-base font-bold disabled:opacity-60" />
          </div>
          <div>
            <FieldLabel>비밀번호</FieldLabel>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="current-password"
              value={password}
              onKeyDown={submitOnEnter}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full rounded-2xl border px-4 py-3 text-base font-bold disabled:opacity-60"
            />
          </div>
        </div>

        {message ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{message}</div> : null}

        <button type="submit" disabled={loading} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-sm font-black text-white disabled:bg-slate-300">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} {loading ? "확인 중" : "로그인"}
        </button>
      </form>
    </main>
  );
}
