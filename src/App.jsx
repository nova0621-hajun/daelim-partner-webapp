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

const WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzunWIU75WOPAnZLS9MGqgLLJ9-P4P1f59gNpggLcWcEGs_P0NArHOLdKNwwPQGekMewg/exec";

const STATUS_CLASS = {
  엔지니어배정요청: "border-amber-200 bg-amber-50 text-amber-700",
  엔지니어배정완료: "border-blue-200 bg-blue-50 text-blue-700",
  시공계획확정: "border-lime-200 bg-lime-50 text-lime-700",
  시공중: "border-purple-200 bg-purple-50 text-purple-700",
  시공완료: "border-emerald-700 bg-emerald-600 text-white",
};

const PHOTO_CATEGORY_OPTIONS = ["계약도면", "시공전", "완료사진", "기타"];

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

function jobKey(job) {
  if (!job) return "";
  return `${job.month || job.sheet || ""}-${job.rowNumber || job.id || job.jobId || ""}`;
}

function buildEngineerOptions(data, partnerName) {
  const installersByPartner = data?.installersByPartner || {};
  const phoneByInstaller = data?.phoneByInstaller || {};
  const names = installersByPartner[partnerName] || [];

  return names
    .map((name) => ({
      name: String(name || "").trim(),
      phone: String(phoneByInstaller[name] || "").trim(),
    }))
    .filter((engineer) => engineer.name);
}

async function apiPost(payload) {
  const response = await fetch(WEBAPP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`API 응답 형식 오류: ${text.slice(0, 160)}`);
  }
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
  const [jobs, setJobs] = useState([]);
  const [engineerOptions, setEngineerOptions] = useState([]);
  const [activeTab, setActiveTab] = useState("today");
  const [detailJob, setDetailJob] = useState(null);
  const [uploadJob, setUploadJob] = useState(null);
  const [historyJob, setHistoryJob] = useState(null);
  const [assigningJobId, setAssigningJobId] = useState("");
  const [completingJobId, setCompletingJobId] = useState("");
  const [historySavingJobId, setHistorySavingJobId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

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

  const fetchPartnerJobs = async (loginUser) => {
    try {
      const result = await apiPost({
        action: "getPartnerJobs",
        role: loginUser.role,
        partnerName: loginUser.partnerName,
        engineerName: loginUser.engineerName || "",
      });

      if (!result.success) {
        setLoginMessage(result.message || "현장 목록 조회 실패");
        return [];
      }

      return result.rows || [];
    } catch (err) {
      console.error(err);
      setLoginMessage(err.message || "현장 목록 API 연결 실패");
      return [];
    }
  };

  const fetchEngineerOptions = async (loginUser) => {
    if (!loginUser?.partnerName) return [];

    try {
      const response = await fetch(`${WEBAPP_URL}?action=partnerInstallerData&t=${Date.now()}`);
      const result = await response.json();

      if (!result.success) return [];

      return buildEngineerOptions(result, loginUser.partnerName);
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const handleLogin = async () => {
    const trimmedId = loginId.trim();
    const trimmedPw = loginPw.trim();

    if (!trimmedId || !trimmedPw) {
      setLoginMessage("아이디와 비밀번호를 입력해 주세요.");
      return;
    }

    setLoginMessage("로그인 확인 중입니다.");

    try {
      const result = await apiPost({
        action: "partnerLogin",
        role: loginType,
        id: trimmedId,
        password: trimmedPw,
      });

      if (!result.success) {
        setLoginMessage(result.message || "아이디 또는 비밀번호를 확인해 주세요.");
        return;
      }

      const loginUser = {
        id: result.id || trimmedId,
        name: result.name || result.partnerName || result.engineerName || trimmedId,
        role: result.role || loginType,
        partnerName: result.partnerName || result.partner || "",
        engineerName: result.engineerName || result.engineer || "",
        engineerPhone: result.engineerPhone || result.phone || "",
      };

      const [rows, engineers] = await Promise.all([
        fetchPartnerJobs(loginUser),
        fetchEngineerOptions(loginUser),
      ]);

      setUser(loginUser);
      setJobs(rows);
      setEngineerOptions(engineers);
      setActiveTab("today");
      setScreen("portal");
      setLoginMessage("");
    } catch (err) {
      console.error(err);
      setLoginMessage(err.message || "로그인 API 연결 실패");
    }
  };

  const handleLogout = () => {
    setUser(null);
    setScreen("select");
    setDetailJob(null);
    setUploadJob(null);
    setHistoryJob(null);
    setEngineerOptions([]);
  };

  const refreshJobs = async (message = "현장 목록을 새로고침했습니다.") => {
    if (!user) return;
    setRefreshing(true);
    setActionMessage("");

    try {
      const rows = await fetchPartnerJobs(user);
      setJobs(rows);
      setDetailJob((current) => current ? rows.find((row) => jobKey(row) === jobKey(current)) || current : current);
      setHistoryJob((current) => current ? rows.find((row) => jobKey(row) === jobKey(current)) || current : current);
      setActionMessage(message);
    } finally {
      setRefreshing(false);
    }
  };

  const assignInstaller = async (job, engineer) => {
    if (!job || !engineer || !user) return;

    const key = jobKey(job);
    const selectedEngineer = engineerOptions.find((item) => item.name === engineer);

    setAssigningJobId(key);
    setActionMessage("");

    try {
      const result = await apiPost({
        action: "assignEngineer",
        rowNumber: job.rowNumber || "",
        jobId: job.id || job.jobId || "",
        id: job.id || "",
        month: job.month || job.sheet || "",
        partnerName: user.partnerName || job.partner || "",
        engineerName: engineer,
        engineerPhone: selectedEngineer?.phone || job.engineerPhone || "",
      });

      if (!result.success) {
        setActionMessage(result.message || "엔지니어 배정 저장에 실패했습니다.");
        return;
      }

      const rows = await fetchPartnerJobs(user);
      setJobs(rows);
      setDetailJob((current) => {
        if (!current) return current;
        return rows.find((row) => jobKey(row) === key) || {
          ...current,
          engineer,
          engineerPhone: selectedEngineer?.phone || current.engineerPhone,
          status: "엔지니어배정완료",
        };
      });
      setActionMessage("엔지니어 배정이 저장되었습니다.");
    } catch (err) {
      console.error(err);
      setActionMessage(err.message || "엔지니어 배정 API 연결 실패");
    } finally {
      setAssigningJobId("");
    }
  };

  const completeJob = async (job) => {
    if (!job || !user) return;

    const key = jobKey(job);
    setCompletingJobId(key);
    setActionMessage("");

    try {
      const result = await apiPost({
        action: "completeJob",
        rowNumber: job.rowNumber || "",
        jobId: job.id || job.jobId || "",
        id: job.id || "",
        month: job.month || job.sheet || "",
        role: user.role,
        partnerName: user.partnerName || job.partner || "",
        engineerName: user.engineerName || job.engineer || "",
      });

      if (!result.success) {
        setActionMessage(result.message || "완료보고 저장에 실패했습니다.");
        return;
      }

      const rows = await fetchPartnerJobs(user);
      setJobs(rows);
      setDetailJob((current) => {
        if (!current) return current;
        return rows.find((row) => jobKey(row) === key) || { ...current, status: "시공완료" };
      });
      setActionMessage("완료보고가 저장되었습니다.");
    } catch (err) {
      console.error(err);
      setActionMessage(err.message || "완료보고 API 연결 실패");
    } finally {
      setCompletingJobId("");
    }
  };

  const addHistory = async (job, text) => {
    if (!text.trim()) return;
    if (!job || !user) return;

    const key = jobKey(job);
    setHistorySavingJobId(key);
    setActionMessage("");

    try {
      const result = await apiPost({
        action: "addHistory",
        rowNumber: job.rowNumber || "",
        jobId: job.id || job.jobId || "",
        id: job.id || "",
        month: job.month || job.sheet || "",
        role: user.role,
        partnerName: user.partnerName || job.partner || "",
        engineerName: user.engineerName || job.engineer || "",
        actor: user.name || user.engineerName || user.partnerName || "사용자",
        text: text.trim(),
      });

      if (!result.success) {
        setActionMessage(result.message || "이력등록 저장에 실패했습니다.");
        return;
      }

      const rows = await fetchPartnerJobs(user);
      setJobs(rows);
      setDetailJob((current) => current ? rows.find((row) => jobKey(row) === jobKey(current)) || current : current);
      setHistoryJob(null);
      setActionMessage("이력등록이 저장되었습니다.");
    } catch (err) {
      console.error(err);
      setActionMessage(err.message || "이력등록 API 연결 실패");
    } finally {
      setHistorySavingJobId("");
    }
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
            <button onClick={() => refreshJobs()} disabled={refreshing} className="rounded-2xl border bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-50">{refreshing ? "조회중" : "새로고침"}</button>
          </div>
          {actionMessage ? <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-800">{actionMessage}</div> : null}

          {filteredJobs.length ? filteredJobs.map((job) => (
            <JobCard
              key={jobKey(job)}
              job={job}
              user={user}
              onDetail={() => {
                setActionMessage("");
                setDetailJob(job);
              }}
              onUpload={() => setUploadJob(job)}
              onHistory={() => setHistoryJob(job)}
              onComplete={() => completeJob(job)}
              completing={completingJobId === jobKey(job)}
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
          engineerOptions={engineerOptions}
          assigning={assigningJobId === jobKey(detailJob)}
          completing={completingJobId === jobKey(detailJob)}
          actionMessage={actionMessage}
          onComplete={completeJob}
        />
      ) : null}

      {uploadJob ? <UploadModal job={uploadJob} onClose={() => setUploadJob(null)} onSubmit={markPhotoUploaded} /> : null}
      {historyJob ? <HistoryModal job={historyJob} onClose={() => setHistoryJob(null)} onSubmit={addHistory} saving={historySavingJobId === jobKey(historyJob)} message={actionMessage} /> : null}
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

function JobCard({ job, user, onDetail, onUpload, onHistory, onComplete, completing = false }) {
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
        <button onClick={onComplete} disabled={completing} className="flex items-center justify-center gap-1 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-black text-emerald-700 disabled:opacity-50">
          {completing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {completing ? "저장중" : "완료보고"}
        </button>
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

function JobDetailModal({ job, user, onClose, onUpload, onHistory, onAssign, engineerOptions = [], assigning = false, completing = false, actionMessage = "", onComplete }) {
  const [engineer, setInstaller] = useState(job.engineer === "미배정" ? "" : job.engineer || "");
  const engineerNames = engineerOptions.map((item) => item.name);

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
              <select value={engineer} onChange={(e) => setInstaller(e.target.value)} disabled={assigning} className="rounded-2xl border bg-white px-3 py-3 text-sm font-bold disabled:opacity-60">
                <option value="">엔지니어 선택</option>
                {engineerNames.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              <button onClick={() => engineer && onAssign(job, engineer)} disabled={!engineer || assigning} className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:bg-blue-300">
                {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {assigning ? "저장 중" : "배정"}
              </button>
            </div>
            {actionMessage ? <p className="mt-3 text-xs font-bold text-blue-800">{actionMessage}</p> : null}
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
          <button onClick={() => onComplete(job)} disabled={completing} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:bg-emerald-300">
            {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {completing ? "저장 중" : "완료보고"}
          </button>
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

function HistoryModal({ job, onClose, onSubmit, saving = false, message = "" }) {
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
