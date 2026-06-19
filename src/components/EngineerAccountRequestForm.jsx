import { Loader2, Users } from "lucide-react";
import { formatPhone } from "../utils/partnerUtils";

function FieldLabel({ children }) {
  return <label className="mb-1 block text-xs font-black text-slate-500">{children}</label>;
}

export default function EngineerAccountRequestForm({ form, setForm, loading = false, message = "", onSubmit, onCollapse }) {
  const update = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: key === "phone" ? formatPhone(value) : value,
    }));
  };

  return (
    <section className="rounded-3xl border bg-white p-3 shadow-sm md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black text-slate-400">ENGINEER ACCOUNT</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">시공기사 계정 생성 요청</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">master 승인 후 기사 로그인ID가 생성됩니다.</p>
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
          {loading ? "요청 중" : "요청 보내기"}
        </button>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="rounded-2xl border bg-white px-4 py-3 text-sm font-black text-slate-600"
          >
            접기
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <FieldLabel>기사명</FieldLabel>
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            disabled={loading}
            className="w-full rounded-2xl border px-4 py-3 text-base font-bold disabled:opacity-60"
            placeholder="예: 김대림"
          />
        </div>
        <div>
          <FieldLabel>연락처</FieldLabel>
          <input
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            disabled={loading}
            inputMode="tel"
            className="w-full rounded-2xl border px-4 py-3 text-base font-bold disabled:opacity-60"
            placeholder="010-0000-0000"
          />
        </div>
      </div>

      {message ? (
        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-800">
          {message}
        </div>
      ) : null}
    </section>
  );
}
