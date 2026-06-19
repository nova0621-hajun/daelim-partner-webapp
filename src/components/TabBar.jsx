export default function TabBar({ user, activeTab, setActiveTab }) {
  const tabs = user.role === "partner"
    ? [["today", "전체"], ["unassigned", "미배정"], ["photo", "사진필요"], ["progress", "진행중"], ["complete", "완료"]]
    : [["today", "전체"], ["progress", "진행중"], ["photo", "사진필요"], ["complete", "완료"]];

  return (
    <nav className="sticky top-0 z-30 rounded-3xl border bg-white/95 p-1 shadow-sm backdrop-blur">
      <div className={`grid gap-1 ${tabs.length === 5 ? "grid-cols-5" : "grid-cols-4"}`}>
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} className={`rounded-2xl px-2 py-3 text-[12px] font-black ${activeTab === key ? "bg-slate-900 text-white" : "text-slate-500"}`}>{label}</button>
        ))}
      </div>
    </nav>
  );
}
