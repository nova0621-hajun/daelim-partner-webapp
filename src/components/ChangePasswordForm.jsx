import { Loader2, Lock } from "lucide-react";

function FieldLabel({ children }) {
  return <label className="mb-1 block text-xs font-black text-slate-500">{children}</label>;
}

export default function ChangePasswordForm({
  user,
  nextPassword,
  nextPasswordConfirm,
  setNextPassword,
  setNextPasswordConfirm,
  message,
  loading = false,
  onSubmit,
  onLogout,
}) {
  const submitOnEnter = (event) => {
    if (event.key !== "Enter") return;
    onSubmit();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400">DAELIM BATH & KITCHEN</p>
            <h1 className="text-2xl font-black">비밀번호 변경</h1>
            <p className="mt-1 text-xs font-bold text-slate-500">
              {user?.name || "사용자"}님, 최초 로그인 후 비밀번호 변경이 필요합니다.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <FieldLabel>새 비밀번호</FieldLabel>
            <input
              type="password"
              value={nextPassword}
              onKeyDown={submitOnEnter}
              onChange={(e) => setNextPassword(e.target.value)}
              disabled={loading}
              maxLength={4}
              placeholder="숫자 4자리"
              className="w-full rounded-2xl border px-4 py-3 text-base font-bold disabled:opacity-60"
            />
          </div>

          <div>
            <FieldLabel>새 비밀번호 확인</FieldLabel>
            <input
              type="password"
              value={nextPasswordConfirm}
              onKeyDown={submitOnEnter}
              onChange={(e) => setNextPasswordConfirm(e.target.value)}
              disabled={loading}
              maxLength={4}
              placeholder="숫자 4자리 재입력"
              className="w-full rounded-2xl border px-4 py-3 text-base font-bold disabled:opacity-60"
            />
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {message}
          </div>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            onClick={onLogout}
            disabled={loading}
            className="rounded-2xl border px-4 py-4 text-sm font-black text-slate-600 disabled:opacity-50"
          >
            로그아웃
          </button>

          <button
            onClick={onSubmit}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-sm font-black text-white disabled:bg-slate-300"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            {loading ? "변경 중" : "변경하기"}
          </button>
        </div>
      </div>
    </main>
  );
}
