import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import "./App.css";
import {
  fetchStudents,
  makePayment,
  fetchPayments,
  login,
  type Student,
} from "./api";

interface Toast {
  id: string;
  kind: "success" | "error";
  msg: string;
}

// ---- Helpers ----
function uid() {
  return Math.random().toString(36).slice(2);
}

function initials(s: Student) {
  return (s.firstName[0] ?? "") + (s.lastName[0] ?? "");
}

// ---- Components ----

function LoginForm({
  onLogin,
}: {
  onLogin: (token: string, email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await login(email, password);
      if (res.success) {
        onLogin(res.data.token, res.data.user.email);
      } else {
        setError("Login failed. Please check your credentials.");
      }
    } catch {
      setError("An error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card">
      <div className="login-header">
        <div className="login-icon">🔐</div>
        <h2>Welcome Back</h2>
        <p>Sign in to access the Student Dashboard</p>
      </div>
      <form onSubmit={handleSubmit} className="login-form">
        <div className="form-group">
          <label>Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="btn-pay" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
      <div className="login-footer">
        <p>Demo credentials: admin@gmail.com/123456</p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return <div className="skeleton skeleton-card" />;
}

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
    <div
      className={`student-card${selected ? " selected" : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      id={`student-${student.id}`}
    >
      <div className="student-avatar">{initials(student)}</div>
      <div className="student-info">
        <div className="student-name">
          {student.firstName} {student.lastName}
        </div>
        <div className="student-email">{student.email}</div>
      </div>
      <div className="student-id">#{student.id}</div>
    </div>
  );
}

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
      makePayment(student.id, {
        amount: parseFloat(amount),
        reference,
      }),
    onSuccess: (response) => {
      onToast({
        id: uid(),
        kind: "success",
        msg: response.data.message,
      });

      setAmount("");
      setReference("");
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["payments", student.id] });
      }, 150);
    },
    onError: () => {
      onToast({
        id: uid(),
        kind: "error",
        msg: "Payment failed — see event log.",
      });
    },
  });

  const canSubmit =
    amount.trim() !== "" &&
    parseFloat(amount) > 0 &&
    reference.trim() !== "" &&
    !mutation.isPending;

  return (
    <div className="payment-card">
      <div className="section-heading">
        <span>💳</span>
        <h2>Initiate Payment</h2>
      </div>

      <div className="student-chip">
        <span>👤</span>
        <span>
          {student.firstName} {student.lastName}
        </span>
        <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
          #{student.id}
        </span>
      </div>

      <div className="form-group">
        <label htmlFor="amount-input">Amount (USD)</label>
        <div className="amount-wrap">
          <span className="currency">$</span>
          <input
            id="amount-input"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="reference-input">Payment Reference</label>
        <input
          id="reference-input"
          type="text"
          placeholder="e.g. Tuition Fee Semester 1"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>

      <button
        className={`btn-pay${mutation.isPending ? " loading" : ""}`}
        disabled={!canSubmit}
        onClick={() => mutation.mutate()}
        id="btn-initiate-payment"
      >
        {mutation.isPending ? "⏳ Processing…" : "⚡ Initiate Payment"}
      </button>
    </div>
  );
}

// ---- Payment History ----
function PaymentHistory({ student }: { student: Student }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["payments", student.id],
    queryFn: () => fetchPayments(student.id),
    enabled: !!student.id,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="payment-card">
      <div className="section-heading">
        <span>📜</span>
        <h2>Payment History</h2>
        {data && (
          <span className="section-badge">{data.data.length} payments</span>
        )}
        <button
          className="btn-refetch"
          onClick={() => refetch()}
          id="btn-refetch-payments"
        >
          ↺ Refresh
        </button>
      </div>

      {isLoading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div className="skeleton" style={{ height: "50px" }} />
          <div className="skeleton" style={{ height: "50px" }} />
        </div>
      )}

      {isError && (
        <div className="error-box">⚠️ Could not fetch payment history.</div>
      )}

      {data && data.data.length === 0 && (
        <div className="select-prompt" style={{ padding: "20px 0" }}>
          <div className="icon">💰</div>
          No payments found for this student.
        </div>
      )}

      {data && data.data.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            maxHeight: "250px",
            overflowY: "auto",
          }}
        >
          {data.data.map((payment) => (
            <div
              key={payment.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.88rem",
                    color: "var(--text-primary)",
                  }}
                >
                  {payment.reference}
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    marginTop: "2px",
                  }}
                >
                  {payment.created_at
                    ? new Date(payment.created_at).toLocaleString()
                    : "N/A"}
                </div>
                {payment.transaction_id && (
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--accent-blue)",
                      marginTop: "4px",
                      fontFamily: "monospace",
                    }}
                  >
                    TX: {payment.transaction_id}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "0.9rem",
                    color: "var(--accent-green)",
                  }}
                >
                  ${payment.amount.toFixed(2)}
                </div>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    padding: "1px 6px",
                    borderRadius: "4px",
                    marginTop: "6px",
                    textTransform: "uppercase",
                    background:
                      payment.status === "SUCCESS"
                        ? "rgba(72,187,120,0.12)"
                        : payment.status === "FAILED"
                          ? "rgba(252,129,129,0.12)"
                          : "rgba(237,137,54,0.12)",
                    color:
                      payment.status === "SUCCESS"
                        ? "var(--accent-green)"
                        : payment.status === "FAILED"
                          ? "var(--accent-red)"
                          : "var(--accent-orange)",
                    border:
                      payment.status === "SUCCESS"
                        ? "1px solid rgba(72,187,120,0.2)"
                        : payment.status === "FAILED"
                          ? "1px solid rgba(252,129,129,0.2)"
                          : "1px solid rgba(237,137,54,0.2)",
                  }}
                >
                  {payment.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [userEmail, setUserEmail] = useState<string | null>(
    localStorage.getItem("user"),
  );
  const [selected, setSelected] = useState<Student | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["students"],
    queryFn: fetchStudents,
    refetchOnWindowFocus: false,
    enabled: !!token,
  });

  // console.log(data);

  const handleLogin = (newToken: string, email: string) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", email);
    setToken(newToken);
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
    setToasts((prev) => [...prev, t]);
    setTimeout(
      () => setToasts((prev) => prev.filter((x) => x.id !== t.id)),
      4000,
    );
  };

  // Socket connection effect
  useEffect(() => {
    if (!selected) return;

    // Connect to WebSocket gateway namespace "/payment"
    const socket = io("http://localhost:3000/payment", {
      auth: {
        studentId: selected.id,
      },
    });

    socket.on("connect", () => {
      console.log(`Socket connected for student: ${selected.id}`);
    });

    socket.on("payment.success", (eventData) => {
      console.log("Received payment success:", eventData);
      addToast({
        id: uid(),
        kind: "success",
        msg: `Payment of $${eventData.amount} succeeded!`,
      });
      // Invalidate queries to trigger a fresh fetch
      queryClient.invalidateQueries({ queryKey: ["payments", selected.id] });
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    return () => {
      socket.disconnect();
    };
  }, [selected, queryClient]);

  if (!token) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-icon">🎓</div>
          <h1>Student Dashboard</h1>
          <span className="header-sub">Microservice Event Flow</span>
        </header>
        <main
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <LoginForm onLogin={handleLogin} />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-icon">🎓</div>
        <h1>Student Dashboard</h1>
        <span className="header-sub">Microservice Event Flow</span>
        {userEmail && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}
            >
              👤 {userEmail}
            </span>
            <button
              className="header-logout"
              onClick={handleLogout}
              id="btn-logout"
            >
              Logout
            </button>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="main">
        {/* Left — students */}
        <div>
          <div className="section-heading">
            <span>👥</span>
            <h2>Students</h2>
            {data && (
              <span className="section-badge">
                {data.pagination.total} total
              </span>
            )}
            <button
              className="btn-refetch"
              onClick={() => refetch()}
              id="btn-refetch-students"
            >
              ↺ Refresh
            </button>
          </div>

          {isLoading && (
            <div className="students-grid">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          )}

          {isError && (
            <div className="error-box">
              ⚠️ Could not fetch students. Is the gateway running on port 3000?
            </div>
          )}

          {data?.data && (
            <div className="students-grid" id="students-list">
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

        {/* Right panel */}
        <div className="right-panel">
          {selected ? (
            <>
              <PaymentForm student={selected} onToast={addToast} />
              <PaymentHistory student={selected} />
            </>
          ) : (
            <div className="payment-card">
              <div className="select-prompt">
                <div className="icon">👈</div>
                Select a student to initiate a payment
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Toasts */}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === "success" ? "✅" : "❌"} {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}
