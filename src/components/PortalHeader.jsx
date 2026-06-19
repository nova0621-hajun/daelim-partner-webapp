import { LogOut, Users } from "lucide-react";

function Badge({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${className}`}>
      {children}
    </span>
  );
}

export default function PortalHeader({
  user,
  onLogout,
  canRequestEngineer = false,
  showEngineerRequest = false,
  onToggleEngineerRequest,
}) {
  return (
    <header className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black text-slate-400">대림바스&키친</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">{user.role === "partner" ? "협력사 포털" : "시공기사 포털"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={user.role === "partner" ? "border-slate-300 bg-slate-900 text-white" : "border-blue-200 bg-blue-50 text-blue-700"}>{user.role === "partner" ? "협력사" : "시공기사"}</Badge>
            <span className="text-sm font-bold text-slate-600">{user.name}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          {canRequestEngineer ? (
            <button
              type="button"
              onClick={onToggleEngineerRequest}
              className={`flex items-center gap-1 rounded-2xl border px-3 py-2 text-xs font-black shadow-sm active:scale-[0.99] ${
                showEngineerRequest
                  ? "border-slate-300 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <Users className="h-4 w-4" />
              시공기사 계정신청
            </button>
          ) : null}
          <button onClick={onLogout} className="flex items-center gap-1 rounded-2xl border bg-white px-3 py-2 text-xs font-black text-slate-600">
          <LogOut className="h-4 w-4" /> 로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
