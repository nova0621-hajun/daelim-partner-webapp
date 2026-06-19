import { useState } from "react";
import { Loader2, X } from "lucide-react";

function FieldLabel({ children }) {
  return <label className="mb-1 block text-xs font-black text-slate-500">{children}</label>;
}

export default function HistoryModal({ job, onClose, onSubmit, saving = false, message = "" }) {
  const [text, setText] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">이력등록</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{job.customer} 현장</p>
          </div>
          <button onClick={onClose} className="rounded-2xl border p-2 text-slate-500"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5">
          <FieldLabel>중요 이력 내용</FieldLabel>
          <textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-36 w-full rounded-2xl border px-4 py-3 text-sm" placeholder="예: 자재누락, 고객 요청, 재방문 필요, 완료보고 특이사항 등" />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={saving} className="rounded-2xl border px-4 py-3 text-sm font-black disabled:opacity-50">취소</button>
          <button onClick={() => onSubmit(job, text)} disabled={saving || !text.trim()} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "저장 중" : "등록"}
          </button>
        </div>
        {message ? <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-bold text-blue-800">{message}</div> : null}
      </div>
    </div>
  );
}
