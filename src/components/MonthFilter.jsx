function Badge({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black ${className}`}>
      {children}
    </span>
  );
}

export default function MonthFilter({ months, selectedMonth, setSelectedMonth, totalCount, jobCounts = {} }) {
  const options = [["all", "\uC804\uCCB4"], ...months.map((month) => [month, month])];

  return (
    <section className="rounded-3xl border bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-black text-slate-500">{"\uC6D4 \uD544\uD130"}</p>
          <p className="text-[11px] font-bold text-slate-400">{"\uC804\uCCB4 \uC870\uD68C "}{totalCount}{"\uAC74"}</p>
        </div>
        <Badge className="border-slate-200 bg-slate-50 text-slate-600">
          {selectedMonth === "all" ? "\uC804\uCCB4" : selectedMonth}
        </Badge>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {options.map(([value, label]) => {
          const loadedCount = value !== "all" ? jobCounts[value] : null;
          const displayLabel = loadedCount != null ? `${label} (${loadedCount}\uAC74)` : label;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setSelectedMonth(value)}
              className={`shrink-0 rounded-2xl px-4 py-2 text-xs font-black ${selectedMonth === value ? "bg-slate-900 text-white" : "border bg-white text-slate-600"}`}
            >
              {displayLabel}
            </button>
          );
        })}
      </div>
    </section>
  );
}
