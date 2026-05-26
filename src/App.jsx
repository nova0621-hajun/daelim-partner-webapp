import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  Camera,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Phone,
  ShieldCheck,
  Upload,
  UserRound,
  Users,
  X,
} from "lucide-react";

const MOCK_USERS = {
  partner: {
    id: "partner01",
    password: "1234",
    name: "으뜸인테리어",
    role: "partner",
    partnerName: "으뜸인테리어",
  },
  engineer: {
    id: "woo",
    password: "1234",
    name: "우재경",
    role: "engineer",
    partnerName: "으뜸인테리어",
    engineerName: "우재경",
  },
};

const MOCK_JOBS = [
  {
    id: "JOB-001",
    customer: "스튜디오 영통",
    manager: "최환철",
    managerPhone: "010-3016-8698",
    phone: "010-2464-9020",
    address: "용인시 기흥구 신갈동 151-1 인성마을 현대A 102동 1102호",
    item: "부엌, 현관, 붙박이",
    orderStatus: "발주완료",
    living: "비거주",
    assembly: "조립출고",
    status: "시공계획확정",
    installDate: "2026-05-21",
    endDate: "2026-05-21",
    stoneDate: "2026-05-21",
    partner: "으뜸인테리어",
    engineer: "우재경",
    engineerPhone: "010-4118-3472",
    photo: "미등록",
    photoUrl: "#",
    siteMemo: `1층 비번 없음, 세대비번 1234*
배송시간 07:30분`,
    history: "파우더장 유리도어, 800불박이 옷걸이봉 사전미출로 한송 마감 예정",
    photoCounts: { 계약도면: 0, 시공전: 0, 완료사진: 0, 기타: 0 },
  },
  {
    id: "JOB-002",
    customer: "최서현",
    manager: "최하준",
    managerPhone: "010-3200-0621",
    phone: "010-0000-0000",
    address: "서울 영등포구 버드나루로 84",
    item: "부엌",
    orderStatus: "발주완료",
    living: "거주",
    assembly: "일반출고",
    status: "엔지니어배정완료",
    installDate: "2026-07-31",
    endDate: "2026-07-31",
    stoneDate: "",
    partner: "으뜸인테리어",
    engineer: "우재경",
    engineerPhone: "010-4118-3472",
    photo: "등록완료",
    photoUrl: "#",
    siteMemo: "엘리베이터 사용 가능",
    history: "",
    photoCounts: { 계약도면: 1, 시공전: 3, 완료사진: 0, 기타: 0 },
  },
  {
    id: "JOB-003",
    customer: "사용자",
    manager: "최하준",
    managerPhone: "010-3200-0621",
    phone: "010-0000-0000",
    address: "서울 강서구 화곡동",
    item: "현관",
    orderStatus: "계약중",
    living: "비거주",
    assembly: "조립출고",
    status: "엔지니어배정요청",
    installDate: "2026-07-02",
    endDate: "2026-07-02",
    stoneDate: "",
    partner: "으뜸인테리어",
    engineer: "미배정",
    engineerPhone: "",
    photo: "미등록",
    photoUrl: "",
    siteMemo: "엔지니어 배정 필요",
    history: "",
    photoCounts: { 계약도면: 0, 시공전: 0, 완료사진: 0, 기타: 0 },
  },
];

const STATUS_CLASS = {
  엔지니어배정요청: "border-amber-200 bg-amber-50 text-amber-700",
  엔지니어배정완료: "border-blue-200 bg-blue-50 text-blue-700",
  시공계획확정: "border-lime-200 bg-lime-50 text-lime-700",
  시공중: "border-purple-200 bg-purple-50 text-purple-700",
  시공완료: "border-emerald-700 bg-emerald-600 text-white",
};

const PHOTO_CATEGORY_OPTIONS = ["계약도면", "시공전", "완료사진", "기타"];
const ENGINEERS = ["우재경", "김기사", "박기사", "최기사"];

function onlyDigits(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function shortDate(value) {
  if (!value) return "-";
  const [yyyy, mm, dd] = String(value).split("-");
  return `${yyyy}.${mm}.${dd}`;
}

function installPeriod(job) {
  if (!job.installDate) return "-";
  if (!job.endDate || job.installDate === job.endDate) return shortDate(job.installDate);
  return `${shortDate(job.installDate)} ~ ${shortDate(job.endDate)}`;
}

function Badge({ children, className = "" }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black leading-none ${className}`}>{children}</span>;
}

function FieldLabel({ children }) {
  return <label className="mb-1 block text-xs font-black text-slate-500">{children}</label>;
}

export default function PartnerInstallerPortal() {
  const [screen, setScreen] = useState("select");
  const [loginType, setLoginType] = useState("partner");
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState(MOCK_JOBS);
  const [activeTab, setActiveTab] = useState("today");
  const [detailJob, setDetailJob] = useState(null);
  const [uploadJob, setUploadJob] = useState(null);
  const [historyJob, setHistoryJob] = useState(null);

  const visibleJobs = useMemo(() => {
    if (!user) return [];
    if (user.role === "partner") return jobs.filter((job) => job.partner === user.partnerName);
    return jobs.filter((job) => job.engineer === user.engineerName);
  }, [jobs, user]);

  const filteredJobs = useMemo(() => {
    if (activeTab === "unassigned") return visibleJobs.filter((job) => !job.engineer || job.engineer === "미배정" || job.status === "엔지니어배정요청");
    if (activeTab === "photo") return visibleJobs.filter((job) => job.photo !== "등록완료");
    if (activeTab === "complete") return visibleJobs.filter((job) => job.status === "시공완료");
    if (activeTab === "progress") return visibleJobs.filter((job) => job.status !== "시공완료");
    return visibleJobs;
  }, [activeTab, visibleJobs]);

  const stats = useMemo(() => ({
    total: visibleJobs.length,
    unassigned: visibleJobs.filter((job) => !job.engineer || job.engineer === "미배정" || job.status === "엔지니어배정요청").length,
    photoMissing: visibleJobs.filter((job) => job.photo !== "등록완료").length,
    complete: visibleJobs.filter((job) => job.status === "시공완료").length,
  }), [visibleJobs]);

  const startLogin = (type) => {
    setLoginType(type);
    setScreen("login");
    setLoginId(type === "partner" ? "partner01" : "woo");
    setLoginPw("1234");
    setLoginMessage("");
  };

  const handleLogin = () => {
    const target = MOCK_USERS[loginType];
    if (loginId.trim() === target.id && loginPw.trim() === target.password) {
      setUser(target);
      setScreen("dashboard");
      setActiveTab("today");
      setLoginMessage("");
      return;
    }
    setLoginMessage("아이디 또는 비밀번호가 일치하지 않습니다. 테스트 계정은 자동 입력된 값 그대로 사용하세요.");
  };

  const handleLogout = () => {
    setUser(null);
    setScreen("select");
    setDetailJob(null);
    setUploadJob(null);
    setHistoryJob(null);
  };

  const assignInstaller = (jobId, engineer) => {
    setJobs((prev) => prev.map((job) => job.id === jobId ? {
      ...job,
      engineer,
      engineerPhone: "010-4118-3472",
      status: "엔지니어배정완료",
    } : job));
  };

  const completeJob = (jobId) => {
    setJobs((prev) => prev.map((job) => job.id === jobId ? { ...job, status: "시공완료" } : job));
  };

  const addHistory = (jobId, text) => {
    if (!text.trim()) return;
    setJobs((prev) => prev.map((job) => job.id === jobId ? {
      ...job,
      history: [
        job.history,
        `${new Date().toLocaleDateString("ko-KR")} ${user?.name || "사용자"}: ${text.trim()}`,
      ]
        .filter(Boolean)
        .join("\n"),
    } : job));
    setHistoryJob(null);
  };

  const markPhotoUploaded = (jobId, category) => {
    setJobs((prev) => prev.map((job) => job.id === jobId ? {
      ...job,
      photo: "등록완료",
      photoUrl: "#",
      photoCounts: {
        ...job.photoCounts,
        [category]: (job.photoCounts?.[category] || 0) + 1,
      },
    } : job));
    setUploadJob(null);
  };

  if (screen === "select") {
    return <LoginSelect onSelect={startLogin} />;
  }

  if (screen === "login") {
    return (
      <LoginForm
        type={loginType}
        id={loginId}
        password={loginPw}
        setId={setLoginId}
        setPassword={setLoginPw}
        message={loginMessage}
        onBack={() => setScreen("select")}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 text-slate-900 md:p-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <PortalHeader user={user} onLogout={handleLogout} />
        <StatGrid user={user} stats={stats} setActiveTab={setActiveTab} />
        <TabBar user={user} activeTab={activeTab} setActiveTab={setActiveTab} />

        <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm md:p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">{user.role === "partner" ? "협력사 현장 목록" : "내 현장 목록"}</h2>
              <p className="mt-1 text-xs font-medium text-slate-500">총 {filteredJobs.length}건 표시 중</p>
            </div>
            <button className="rounded-2xl border bg-white px-3 py-2 text-xs font-black text-slate-600">새로고침</button>
          </div>

          {filteredJobs.length ? filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              user={user}
              onDetail={() => setDetailJob(job)}
              onUpload={() => setUploadJob(job)}
              onHistory={() => setHistoryJob(job)}
              onComplete={() => completeJob(job.id)}
            />
          )) : (
            <div className="rounded-3xl border border-dashed p-8 text-center text-sm font-bold text-slate-400">표시할 현장이 없습니다.</div>
          )}
        </section>
      </div>

      {detailJob ? (
        <JobDetailModal
          job={detailJob}
          user={user}
          onClose={() => setDetailJob(null)}
          onUpload={() => { setUploadJob(detailJob); setDetailJob(null); }}
          onHistory={() => { setHistoryJob(detailJob); setDetailJob(null); }}
          onAssign={assignInstaller}
          onComplete={completeJob}
        />
      ) : null}

      {uploadJob ? <UploadModal job={uploadJob} onClose={() => setUploadJob(null)} onSubmit={markPhotoUploaded} /> : null}
      {historyJob ? <HistoryModal job={historyJob} onClose={() => setHistoryJob(null)} onSubmit={addHistory} /> : null}
    </div>
  );
}

function LoginSelect({ onSelect }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-5 text-white">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-sm font-bold text-sky-300">DAELIM BATH & KITCHEN</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">시공사 포털</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">협력사와 시공엔지니어가 현장정보 확인, 사진등록, 이력등록을 처리하는 전용 앱입니다.</p>
        </div>

        <div className="space-y-3 rounded-[2rem] border border-white/10 bg-white/10 p-4 shadow-2xl backdrop-blur">
          <button onClick={() => onSelect("partner")} className="flex w-full items-center gap-4 rounded-3xl bg-white p-5 text-left text-slate-900 shadow-lg transition active:scale-[0.99]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white"><Building2 className="h-6 w-6" /></div>
            <div>
              <p className="text-lg font-black">협력사 로그인</p>
              <p className="mt-1 text-xs font-bold text-slate-500">현장 확인 · 엔지니어 배정 · 사진/이력 보완</p>
            </div>
          </button>

          <button onClick={() => onSelect("engineer")} className="flex w-full items-center gap-4 rounded-3xl bg-white p-5 text-left text-slate-900 shadow-lg transition active:scale-[0.99]">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white"><UserRound className="h-6 w-6" /></div>
            <div>
              <p className="text-lg font-black">시공엔지니어 로그인</p>
              <p className="mt-1 text-xs font-bold text-slate-500">내 현장 확인 · 사진등록 · 완료보고</p>
            </div>
          </button>
        </div>

        <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4 text-xs leading-relaxed text-slate-300">
          테스트 계정은 다음 화면에서 자동 입력됩니다. 실제 운영 시에는 Google Sheets의 사용자권한 시트와 연결합니다.
        </div>
      </div>
    </main>
  );
}

function LoginForm({ type, id, password, setId, setPassword, message, onBack, onSubmit }) {
  const isPartner = type === "partner";
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-xl">
        <button onClick={onBack} className="mb-5 inline-flex items-center gap-1 text-sm font-black text-slate-500"><ArrowLeft className="h-4 w-4" /> 돌아가기</button>
        <div className="flex items-center gap-3">
          <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${isPartner ? "bg-slate-900" : "bg-blue-600"}`}>
            {isPartner ? <Building2 className="h-6 w-6" /> : <UserRound className="h-6 w-6" />}
          </div>
          <div>
            <h1 className="text-2xl font-black">{isPartner ? "협력사 로그인" : "시공엔지니어 로그인"}</h1>
            <p className="mt-1 text-xs font-bold text-slate-500">테스트 계정이 자동 입력되어 있습니다.</p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <FieldLabel>{isPartner ? "협력사 ID" : "기사 ID"}</FieldLabel>
            <input value={id} onChange={(e) => setId(e.target.value)} className="w-full rounded-2xl border px-4 py-3 text-base font-bold" />
          </div>
          <div>
            <FieldLabel>비밀번호</FieldLabel>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-2xl border px-4 py-3 text-base font-bold" />
          </div>
        </div>

        {message ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{message}</div> : null}

        <button onClick={onSubmit} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-sm font-black text-white">
          <Lock className="h-4 w-4" /> 로그인
        </button>
      </div>
    </main>
  );
}

function PortalHeader({ user, onLogout }) {
  return (
    <header className="rounded-3xl bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black text-slate-400">대림바스&키친</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight">{user.role === "partner" ? "협력사 포털" : "시공엔지니어 포털"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={user.role === "partner" ? "border-slate-300 bg-slate-900 text-white" : "border-blue-200 bg-blue-50 text-blue-700"}>{user.role === "partner" ? "협력사" : "시공엔지니어"}</Badge>
            <span className="text-sm font-bold text-slate-600">{user.name}</span>
          </div>
        </div>
        <button onClick={onLogout} className="flex items-center gap-1 rounded-2xl border bg-white px-3 py-2 text-xs font-black text-slate-600">
          <LogOut className="h-4 w-4" /> 로그아웃
        </button>
      </div>
    </header>
  );
}

function StatGrid({ user, stats, setActiveTab }) {
  const cards = user.role === "partner" ? [
    ["전체 현장", stats.total, "today", ClipboardList],
    ["엔지니어 미배정", stats.unassigned, "unassigned", Users],
    ["사진 미등록", stats.photoMissing, "photo", Camera],
    ["완료 현장", stats.complete, "complete", CheckCircle2],
  ] : [
    ["내 현장", stats.total, "today", ClipboardList],
    ["진행중", stats.total - stats.complete, "progress", ShieldCheck],
    ["사진 미등록", stats.photoMissing, "photo", Camera],
    ["완료 현장", stats.complete, "complete", CheckCircle2],
  ];

  return (
    <section className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {cards.map(([title, value, tab, Icon]) => (
        <button key={title} onClick={() => setActiveTab(tab)} className="rounded-3xl border bg-white p-4 text-left shadow-sm active:scale-[0.99]">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black text-slate-500">{title}</p>
            <Icon className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-3 text-3xl font-black">{value}</p>
        </button>
      ))}
    </section>
  );
}

function TabBar({ user, activeTab, setActiveTab }) {
  const tabs = user.role === "partner"
    ? [["today", "전체"], ["unassigned", "미배정"], ["photo", "사진미등록"], ["progress", "진행중"], ["complete", "완료"]]
    : [["today", "전체"], ["progress", "진행중"], ["photo", "사진미등록"], ["complete", "완료"]];

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

function JobCard({ job, user, onDetail, onUpload, onHistory, onComplete }) {
  return (
    <article className="rounded-3xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-black">{job.customer}</p>
          <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500">{job.address}</p>
        </div>
        <Badge className={STATUS_CLASS[job.status] || "border-slate-200 bg-slate-100 text-slate-600"}>{job.status}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 text-sm">
        <Info label="시공일" value={installPeriod(job)} />
        <Info label="아이템" value={job.item} />
        <Info label="담당자" value={job.manager} />
        <Info label="기사" value={job.engineer || "미배정"} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <button onClick={onDetail} className="rounded-2xl bg-slate-900 px-3 py-3 text-xs font-black text-white">상세보기</button>
        <button onClick={onUpload} className="rounded-2xl border bg-white px-3 py-3 text-xs font-black text-slate-700">사진등록</button>
        <button onClick={onHistory} className="rounded-2xl border bg-white px-3 py-3 text-xs font-black text-slate-700">이력등록</button>
        <button onClick={() => onComplete(job.id)} className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-black text-emerald-700">완료보고</button>
      </div>

      {user.role === "partner" && (!job.engineer || job.engineer === "미배정" || job.status === "엔지니어배정요청") ? (
        <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-700">엔지니어 배정이 필요한 현장입니다.</div>
      ) : null}
    </article>
  );
}

function Info({ label, value }) {
  return <div><p className="text-[11px] font-black text-slate-400">{label}</p><p className="mt-1 font-black text-slate-700">{value || "-"}</p></div>;
}

function JobDetailModal({ job, user, onClose, onUpload, onHistory, onAssign, onComplete }) {
  const [engineer, setInstaller] = useState(job.engineer === "미배정" ? "" : job.engineer || "");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4">
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl md:rounded-[2rem]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">{job.customer}</h2>
            <div className="mt-2 flex flex-wrap gap-2"><Badge className={STATUS_CLASS[job.status] || "border-slate-200 bg-slate-100 text-slate-600"}>{job.status}</Badge><Badge className="border-slate-200 bg-slate-50 text-slate-600">{job.item}</Badge></div>
          </div>
          <button onClick={onClose} className="rounded-2xl border p-2 text-slate-500"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-4 rounded-3xl bg-slate-50 p-4">
          <div className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" /><p className="text-sm font-bold leading-relaxed text-slate-700">{job.address}</p></div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailBox title="기본 정보">
            <DetailRow label="담당자" value={job.manager} />
            <DetailRow label="담당자 연락처" value={<PhoneLink value={job.managerPhone} />} />
            <DetailRow label="고객 연락처" value={<PhoneLink value={job.phone} />} />
            <DetailRow label="계약/발주" value={job.orderStatus} />
            <DetailRow label="거주여부" value={job.living} />
            <DetailRow label="조립출고" value={job.assembly} />
          </DetailBox>

          <DetailBox title="시공 정보">
            <DetailRow label="시공기간" value={installPeriod(job)} />
            <DetailRow label="대리석" value={shortDate(job.stoneDate)} />
            <DetailRow label="협력사" value={job.partner} />
            <DetailRow label="시공엔지니어" value={job.engineer || "미배정"} />
            <DetailRow label="엔지니어 연락처" value={<PhoneLink value={job.engineerPhone} />} />
          </DetailBox>
        </div>

        {user.role === "partner" ? (
          <div className="mt-4 rounded-3xl border border-blue-100 bg-blue-50 p-4">
            <h3 className="font-black text-blue-900">엔지니어 배정</h3>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
              <select value={engineer} onChange={(e) => setInstaller(e.target.value)} className="rounded-2xl border bg-white px-3 py-3 text-sm font-bold">
                <option value="">엔지니어 선택</option>
                {ENGINEERS.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <button onClick={() => engineer && onAssign(job.id, engineer)} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white">배정</button>
            </div>
          </div>
        ) : null}

        <DetailBox title="현장 메모 / 중요 이력" className="mt-4">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm font-medium leading-relaxed text-slate-700 whitespace-pre-wrap">{job.siteMemo || "메모 없음"}</div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium leading-relaxed text-amber-900 whitespace-pre-wrap">{job.history || "중요 이력 없음"}</div>
        </DetailBox>

        <DetailBox title="사진 / 도면" className="mt-4">
          <div className="grid grid-cols-2 gap-2">
            {PHOTO_CATEGORY_OPTIONS.map((category) => <div key={category} className="rounded-2xl border bg-slate-50 p-3 text-center text-xs font-black text-slate-600">{category} {job.photoCounts?.[category] || 0}</div>)}
          </div>
          <button onClick={onUpload} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-4 text-sm font-black text-white"><Upload className="h-4 w-4" /> 사진등록</button>
        </DetailBox>

        <div className="sticky bottom-0 -mx-5 mt-5 grid grid-cols-2 gap-2 border-t bg-white/95 px-5 py-4 backdrop-blur">
          <button onClick={onHistory} className="rounded-2xl border px-4 py-3 text-sm font-black">이력등록</button>
          <button onClick={() => onComplete(job.id)} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white">완료보고</button>
        </div>
      </div>
    </div>
  );
}

function DetailBox({ title, children, className = "" }) {
  return <section className={`rounded-3xl border bg-white p-4 shadow-sm ${className}`}><h3 className="font-black">{title}</h3><div className="mt-3 space-y-3">{children}</div></section>;
}

function DetailRow({ label, value }) {
  return <div className="flex items-center justify-between gap-3 border-b pb-2 text-sm last:border-b-0"><span className="font-bold text-slate-500">{label}</span><span className="text-right font-black text-slate-800">{value || "-"}</span></div>;
}

function PhoneLink({ value }) {
  const phone = formatPhone(value || "");
  if (!phone) return <span>-</span>;
  return <a href={`tel:${onlyDigits(phone)}`} className="font-black text-blue-700 underline decoration-blue-300 underline-offset-2"><Phone className="mr-1 inline h-3.5 w-3.5" />{phone}</a>;
}

function UploadModal({ job, onClose, onSubmit }) {
  const [category, setCategory] = useState("시공전");
  const [hasFile, setHasFile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const submit = () => {
    if (!hasFile) {
      setMessage("첨부할 사진 또는 파일을 선택해 주세요.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSubmit(job.id, category);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">사진등록</h2>
            <p className="mt-1 text-sm font-bold text-slate-500">{job.customer} 현장</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">이미지는 최대 15개, PDF는 계약도면에만 등록합니다.</p>
          </div>
          <button onClick={onClose} className="rounded-2xl border p-2 text-slate-500"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <FieldLabel>사진 구분</FieldLabel>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-2xl border px-4 py-3 font-bold">
              {PHOTO_CATEGORY_OPTIONS.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>{category === "계약도면" ? "PDF 또는 이미지 선택" : "갤러리에서 사진 선택"}</FieldLabel>
            <input type="file" accept={category === "계약도면" ? "image/*,.pdf" : "image/*"} multiple onChange={(e) => setHasFile(!!e.target.files?.length)} className="w-full rounded-2xl border px-4 py-3 text-sm" />
          </div>
        </div>

        {message ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-black text-rose-700">{message}</div> : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button onClick={onClose} disabled={loading} className="rounded-2xl border px-4 py-3 text-sm font-black disabled:opacity-50">취소</button>
          <button onClick={submit} disabled={loading} className="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} {loading ? "등록 중" : "사진등록"}</button>
        </div>
      </div>
    </div>
  );
}

function HistoryModal({ job, onClose, onSubmit }) {
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
          <button onClick={onClose} className="rounded-2xl border px-4 py-3 text-sm font-black">취소</button>
          <button onClick={() => onSubmit(job.id, text)} className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white">등록</button>
        </div>
      </div>
    </div>
  );
}
