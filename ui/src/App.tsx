import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  fetchStudents,
  makePayment,
  fetchPayments,
  login,
  type Student,
} from "./api";

// ─── types ───────────────────────────────────────────────────────────────────
interface Toast {
  id: string;
  kind: "success" | "error";
  msg: string;
}

// ─── tiny helpers ─────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2);
const initials = (s: Student) =>
  ((s.firstName[0] ?? "") + (s.lastName[0] ?? "")).toUpperCase();

// ─── shared class strings ─────────────────────────────────────────────────────
const FIELD =
  "w-full bg-surface-2 border border-border-2 rounded-lg px-3 py-2 " +
  "text-sm text-text-1 placeholder:text-text-3 " +
  "outline-none transition-all duration-150 " +
  "focus:border-accent focus:ring-2 focus:ring-accent/20";

const LABEL = "block text-xs font-medium text-text-2 mb-2";

const BTN_PRIMARY =
  "w-full py-2 rounded-lg bg-white text-black text-sm font-semibold " +
  "transition-all duration-150 hover:bg-neutral-100 active:scale-[0.98] " +
  "disabled:opacity-40 disabled:cursor-not-allowed";

const BTN_GHOST =
  "border border-border-2 text-text-2 text-xs px-2.5 py-1 rounded-lg my-1.5 " +
  "transition-all duration-150 hover:border-border hover:text-text-1 hover:bg-surface-2";

// ─── LoginForm ────────────────────────────────────────────────────────────────
function LoginForm({
  onLogin,
}: {
  onLogin: (token: string, email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await login(email, password);
      if (res.success) onLogin(res.data.token, res.data.user.email);
      else setError("Invalid credentials — please try again.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-in w-full max-w-[420px]">
      {/* Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-card">
        {/* Brand */}
        <div className="mb-8">
          <div className="w-10 h-10 rounded-xl bg-white text-black text-lg flex items-center justify-center mb-5 font-bold select-none">
            🎓
          </div>
          <h1 className="text-xl font-semibold text-text-1 leading-snug">
            Welcome back
          </h1>
          <p className="text-sm text-text-2 mt-1">
            Sign in to Student Dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email-input" className={LABEL}>Email</label>
            <input
              id="email-input"
              className={FIELD}
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label htmlFor="password-input" className={LABEL}>Password</label>
            <input
              id="password-input"
              className={FIELD}
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="text-xs text-danger bg-danger-dim border border-danger/20 rounded-md px-3 py-2.5">
              {error}
            </p>
          )}

          <div className="mt-1"></div>

          <button type="submit" disabled={loading} className={BTN_PRIMARY}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-7 pt-6 border-t border-border">
          <p className="text-xs text-text-3 text-center">
            Demo: <span className="text-text-2 font-mono">admin@gmail.com</span>{" "}
            / <span className="text-text-2 font-mono">123456</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── SkeletonRow ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border border-border rounded-xl animate-skeleton">
      <div className="w-9 h-9 rounded-full bg-surface-2 shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 bg-surface-2 rounded-md w-2/5" />
        <div className="h-2.5 bg-surface-2/70 rounded-md w-3/5" />
      </div>
    </div>
  );
}

// ─── StudentCard ──────────────────────────────────────────────────────────────
function StudentCard({
  student,
  selected,
  onClick,
}: {
  student: Student;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      id={`student-${student.id}`}
      onClick={onClick}
      className={[
        "w-full flex items-center gap-3 px-4 py-1.5 rounded-xl border text-left",
        "transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent/30",
        selected
          ? "bg-accent-dim border-accent/40 shadow-glow"
          : "bg-surface border-border hover:bg-surface-2 hover:border-border-2",
      ].join(" ")}
    >
      {/* Avatar */}
      <div
        className={[
          "w-9 h-9 rounded-full flex items-center justify-center",
          "text-xs font-bold shrink-0 select-none",
          selected ? "bg-accent/20 text-accent" : "bg-surface-2 text-text-2",
        ].join(" ")}
      >
        {initials(student)}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium text-text-1 truncate leading-snug">
          {student.firstName} {student.lastName}
        </p>
        <p className="text-xs text-text-2 truncate mt-1">{student.email}</p>
      </div>

      {/* ID pill */}
      <span className="shrink-0 text-[11px] text-text-3 font-mono bg-surface-2 border border-border px-2.5 py-1 rounded-lg">
        #{student.id}
      </span>
    </button>
  );
}

// ─── PaymentForm ──────────────────────────────────────────────────────────────
function PaymentForm({
  student,
  onToast,
}: {
  student: Student;
  onToast: (t: Toast) => void;
}) {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      makePayment(student.id, { amount: parseFloat(amount), reference }),
    onSuccess: (res) => {
      onToast({ id: uid(), kind: "success", msg: res.data.message });
      setAmount("");
      setReference("");
      setTimeout(
        () =>
          queryClient.invalidateQueries({ queryKey: ["payments", student.id] }),
        150,
      );
    },
    onError: () =>
      onToast({
        id: uid(),
        kind: "error",
        msg: "Payment failed — please try again.",
      }),
  });

  const canSubmit =
    amount.trim() !== "" &&
    parseFloat(amount) > 0 &&
    reference.trim() !== "" &&
    !mutation.isPending;

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
      {/* Header band */}
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text-1">Initiate Payment</p>
          <p className="text-xs text-text-2 mt-0.5">
            {student.firstName} {student.lastName}
            <span className="text-text-3 ml-1.5 font-mono">#{student.id}</span>
          </p>
        </div>
        <span className="text-xl" aria-hidden>
          💳
        </span>
      </div>

      {/* Form body */}
      <div className="px-5 py-4 space-y-4">
        {/* Amount */}
        <div>
          <label htmlFor="amount-input" className={LABEL}>
            Amount (USD)
          </label>
          <div className="relative">
            <input
              id="amount-input"
              className={`${FIELD} pl-8`}
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>

        {/* Reference */}
        <div>
          <label htmlFor="reference-input" className={LABEL}>
            Reference
          </label>
          <input
            id="reference-input"
            className={FIELD}
            type="text"
            placeholder="e.g. Tuition Fee Semester 1"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>

        <div className="mt-1"></div>

        <button
          id="btn-initiate-payment"
          className={BTN_PRIMARY}
          disabled={!canSubmit}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? "Processing…" : "Initiate Payment →"}
        </button>
      </div>
    </div>
  );
}

// ─── PaymentHistory ───────────────────────────────────────────────────────────
function PaymentHistory({ student }: { student: Student }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["payments", student.id],
    queryFn: () => fetchPayments(student.id),
    enabled: !!student.id,
    refetchOnWindowFocus: false,
  });

  const badge = (status: string) => {
    if (status === "SUCCESS")
      return "text-success border-success/25 bg-success-dim";
    if (status === "FAILED")
      return "text-danger  border-danger/25  bg-danger-dim";
    return "text-warn    border-warn/25    bg-warn-dim";
  };

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-card overflow-hidden mt-1.5">
      {/* Header */}
      <div className="py-1.5 px-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <p className="text-sm font-semibold text-text-1">Payment History</p>
          {data && (
            <span className="text-[11px] font-medium text-text-2 bg-surface-2 border border-border px-2 py-0.5 rounded-full">
              {data.data.length}
            </span>
          )}
        </div>
        <button
          id="btn-refetch-payments"
          onClick={() => refetch()}
          className={BTN_GHOST}
        >
          ↺ Refresh
        </button>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl bg-surface-2 animate-skeleton"
              />
            ))}
          </div>
        )}

        {isError && (
          <div className="text-xs text-danger bg-danger-dim border border-danger/20 rounded-lg px-4 py-3">
            ⚠️ Could not load payment history.
          </div>
        )}

        {data?.data.length === 0 && (
          <div className="text-center py-10">
            <p className="text-3xl mb-3">💰</p>
            <p className="text-sm text-text-2">No payments yet</p>
            <p className="text-xs text-text-3 mt-1">
              Payments will appear here after you submit one
            </p>
          </div>
        )}

        {data && data.data.length > 0 && (
          <div className="space-y-1.5 max-h-96 overflow-y-auto grid gap-y-1.5 p-2">
            {data.data.map((p) => (
              <div
                key={p.id}
                className="flex items-start justify-between gap-3 px-4 py-1.5 bg-surface-2/50 border border-border rounded-xl"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-1 truncate">
                    {p.reference}
                  </p>
                  <p className="text-xs text-text-3 mt-0.5">
                    {p.created_at
                      ? new Date(p.created_at).toLocaleString()
                      : "—"}
                  </p>
                  {p.transaction_id && (
                    <p className="text-[11px] text-text-3 font-mono mt-1 truncate">
                      {p.transaction_id}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="text-sm font-semibold text-text-1">
                    ${p.amount.toFixed(2)}
                  </span>
                  <span
                    className={`text-[9px]  font-semibold uppercase tracking-wide px-1 py-0.5 rounded border ${badge(p.status)}`}
                  >
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    function init() {
      setToken(localStorage.getItem("token"));
      setUserEmail(localStorage.getItem("user"));
      setAuthLoading(false);
    }
    init();
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["students"],
    queryFn: fetchStudents,
    refetchOnWindowFocus: false,
    enabled: !!token,
  });

  const handleLogin = (t: string, email: string) => {
    localStorage.setItem("token", t);
    localStorage.setItem("user", email);
    setToken(t);
    setUserEmail(email);
  };
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUserEmail(null);
    setSelected(null);
  };
  const addToast = (t: Toast) => {
    setToasts((p) => [...p, t]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== t.id)), 4000);
  };

  // WebSocket
  useEffect(() => {
    if (!selected) return;
    const socket = io(import.meta.env.VITE_API_URL + "/payment", {
      auth: { studentId: selected.id },
    });
    socket.on("connect", () => console.log(`WS connected: ${selected.id}`));
    socket.on("payment.success", (ev) => {
      addToast({
        id: uid(),
        kind: "success",
        msg: `Payment of $${ev.amount} succeeded!`,
      });
      queryClient.invalidateQueries({ queryKey: ["payments", selected.id] });
    });
    socket.on("disconnect", () => console.log("WS disconnected"));
    return () => {
      socket.disconnect();
    };
  }, [selected, queryClient]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-border-2 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-bg flex flex-col">
        {/* Nav */}
        <nav className="border-b border-border bg-surface/60 backdrop-blur-md">
          <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-3">
            <div className="w-7 h-7 bg-white rounded-md grid place-items-center text-sm shrink-0">
              🎓
            </div>
            <span className="text-sm font-semibold text-text-1">
              Student Dashboard
            </span>
          </div>
        </nav>
        {/* Center form */}
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <LoginForm onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  // ── Main ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg text-text-1">
      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-3">
          <div className="w-7 h-7 bg-white rounded-md grid place-items-center text-sm shrink-0 select-none">
            🎓
          </div>
          <span className="text-sm font-semibold text-text-1">
            Student Dashboard
          </span>
          <span className="text-xs text-text-3 hidden sm:inline">/</span>
          <span className="text-xs text-text-3 hidden sm:inline">
            Microservice Demo
          </span>

          <div className="ml-auto flex items-center gap-3">
            {userEmail && (
              <span className="text-xs text-text-3 hidden md:block truncate max-w-[200px]">
                {userEmail}
              </span>
            )}
            <button
              id="btn-logout"
              onClick={handleLogout}
              className={BTN_GHOST + " bg-red-500 text-white"}
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {/* ── Page body ── */}
      <div className="max-w-5xl mx-auto px-4 py-3">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
          {/* ── Left: Students ── */}
          <div
            className="animate-in space-y-0"
            style={{ animationDelay: "0ms" }}
          >
            {/* Section title */}
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text-1">Students</h2>
                {data && (
                  <span className="text-[11px] font-medium text-text-2 bg-surface border border-border px-2 py-0.5 rounded-full">
                    {data.pagination.total}
                  </span>
                )}
              </div>
              <button
                id="btn-refetch-students"
                onClick={() => refetch()}
                className={BTN_GHOST}
              >
                ↺ Refresh
              </button>
            </div>

            {/* Skeleton */}
            {isLoading && (
              <div className="space-y-1.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <SkeletonRow key={i} />
                ))}
              </div>
            )}

            {/* Error */}
            {isError && (
              <div className="text-xs text-danger bg-danger-dim border border-danger/20 rounded-lg px-4 py-3">
                ⚠️ Could not load students. Is the gateway running on port 3000?
              </div>
            )}

            {/* List */}
            {data?.data && (
              <div className="space-y-1.5 grid gap-1.5" id="students-list">
                {data.data.map((s) => (
                  <StudentCard
                    key={s.id}
                    student={s}
                    selected={selected?.id === s.id}
                    onClick={() => setSelected(s)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Right: Payment panel ── */}
          <div
            className="space-y-4 animate-in"
            style={{ animationDelay: "60ms" }}
          >
            {selected ? (
              <>
                <PaymentForm student={selected} onToast={addToast} />
                <PaymentHistory student={selected} />
              </>
            ) : (
              <div className="bg-surface border border-border rounded-2xl px-8 py-14 text-center shadow-card">
                <p className="text-3xl mb-4 select-none">👈</p>
                <p className="text-sm font-medium text-text-1">
                  Select a student
                </p>
                <p className="text-xs text-text-2 mt-1.5 max-w-[220px] mx-auto">
                  Choose a student from the list to initiate a payment
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Toasts ── */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "animate-toast flex items-center gap-2 px-3 py-2 rounded-lg border",
              "text-sm font-medium shadow-card pointer-events-auto max-w-xs",
              t.kind === "success"
                ? "bg-surface border-success/30 text-success"
                : "bg-surface border-danger/30 text-danger",
            ].join(" ")}
          >
            <span className="text-base">
              {t.kind === "success" ? "✓" : "✕"}
            </span>
            <span className="text-text-1 text-xs">{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
