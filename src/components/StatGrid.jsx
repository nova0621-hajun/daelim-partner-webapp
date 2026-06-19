import { Camera, CheckCircle2, ClipboardList, ShieldCheck, Users } from "lucide-react";

export default function StatGrid({ user, stats, setActiveTab }) {
  const cards = user.role === "partner" ? [
    ["전체 현장", stats.total, "today", ClipboardList],
    ["시공기사 미배정", stats.unassigned, "unassigned", Users],
    ["완료사진 필요", stats.completePhotoMissing, "photo", Camera],
    ["완료 현장", stats.complete, "complete", CheckCircle2],
  ] : [
    ["내 현장", stats.total, "today", ClipboardList],
    ["진행중", stats.total - stats.complete, "progress", ShieldCheck],
    ["완료사진 필요", stats.completePhotoMissing, "photo", Camera],
    ["완료 현장", stats.complete, "complete", CheckCircle2],
  ];

  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {cards.map(([title, value, tab, Icon]) => (
        <button key={title} onClick={() => setActiveTab(tab)} className="rounded-2xl border bg-white p-3 text-left shadow-sm active:scale-[0.99] md:rounded-3xl md:p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-slate-500">{title}</p>
            <Icon className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-black md:mt-3 md:text-3xl">{value}</p>
        </button>
      ))}
    </section>
  );
}
