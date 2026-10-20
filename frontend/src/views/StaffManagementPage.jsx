import React, { useState, useEffect, useCallback } from "react";
import useAuth from "../utils/useAuth";

const ROLE_COLOR = { ADMIN: "#FFB020", OFFICER: "#17D9A3" };

function Badge({ text, color }) {
  return React.createElement("span", {
    style: { fontSize: "9px", background: color || "rgba(23,217,163,0.15)", border: "1px solid " + (color || "#17D9A3"),
      color: color || "#17D9A3", padding: "2px 7px", borderRadius: "4px", fontWeight: 700, letterSpacing: "0.08em", fontFamily: "IBM Plex Mono, monospace" }
  }, text);
}

function Modal({ title, children, onClose }) {
  return React.createElement("div", {
    style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }
  },
    React.createElement("div", {
      style: { background: "#0C1E2E", border: "1px solid rgba(23,217,163,0.3)", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "400px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.8)" }
    },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" } },
        React.createElement("div", { style: { fontFamily: "IBM Plex Mono, monospace", fontSize: "12px", fontWeight: 700, letterSpacing: "0.1em", color: "#17D9A3" } }, title),
        React.createElement("button", { onClick: onClose, style: { background: "none", border: "none", color: "#5A7A8A", cursor: "pointer", fontSize: "18px", lineHeight: 1 } }, "\u00D7")
      ),
      children
    )
  );
}

function AddStaffModal({ onClose, onAdded, apiPost }) {
  const [form, setForm] = useState({ username: "", fullName: "", role: "OFFICER", rankTitle: "" });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const inputStyle = { width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(23,217,163,0.2)", borderRadius: "8px", padding: "10px 12px", color: "#fff", fontSize: "13px", fontFamily: "IBM Plex Mono, monospace", outline: "none", boxSizing: "border-box", marginBottom: "12px" };
  const labelStyle = { fontSize: "10px", color: "#8CA1B4", fontFamily: "IBM Plex Mono, monospace", letterSpacing: "0.1em", display: "block", marginBottom: "4px" };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(null); setSaving(true);
    try {
      const created = await apiPost("/api/auth/register", form);
      onAdded(created);
      onClose();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  return React.createElement(Modal, { title: "ADD STAFF ACCOUNT", onClose },
    React.createElement("form", { onSubmit: handleSubmit },
      React.createElement("label", { style: labelStyle }, "FULL NAME"),
      React.createElement("input", { style: inputStyle, value: form.fullName, onChange: (e) => setForm({ ...form, fullName: e.target.value }), placeholder: "e.g. John Antony", required: true }),
      React.createElement("label", { style: labelStyle }, "USERNAME"),
      React.createElement("input", { style: inputStyle, value: form.username, onChange: (e) => setForm({ ...form, username: e.target.value }), placeholder: "Login name", required: true }),
      React.createElement("label", { style: labelStyle }, "ROLE"),
      React.createElement("select", { style: { ...inputStyle, cursor: "pointer" }, value: form.role, onChange: (e) => setForm({ ...form, role: e.target.value }) },
        React.createElement("option", { value: "OFFICER" }, "OFFICER"),
        React.createElement("option", { value: "ADMIN" }, "ADMIN")
      ),
      React.createElement("label", { style: labelStyle }, "RANK / TITLE (OPTIONAL)"),
      React.createElement("input", { style: inputStyle, value: form.rankTitle, onChange: (e) => setForm({ ...form, rankTitle: e.target.value }), placeholder: "e.g. Navigation Officer" }),
      React.createElement("div", { style: { fontSize: "10px", color: "#5A7A8A", fontFamily: "IBM Plex Mono, monospace", marginBottom: "14px" } },
        "Account will start with PENDING_SETUP - user sets own password on first login."),
      error && React.createElement("div", { style: { background: "rgba(255,79,79,0.12)", border: "1px solid rgba(255,79,79,0.35)", borderRadius: "6px", padding: "8px 10px", marginBottom: "12px", fontSize: "11px", color: "#FF8888", fontFamily: "IBM Plex Mono, monospace" } }, error),
      React.createElement("button", { type: "submit", disabled: saving, style: { width: "100%", background: saving ? "rgba(23,217,163,0.3)" : "linear-gradient(135deg,#17D9A3 0%,#0BB582 100%)", color: "#071826", border: "none", borderRadius: "8px", padding: "12px", fontSize: "12px", fontWeight: 700, cursor: saving ? "wait" : "pointer", fontFamily: "IBM Plex Mono, monospace" } },
        saving ? "ADDING..." : "ADD STAFF MEMBER")
    )
  );
}

function StaffRow({ staff, isCurrentUser, onReset, onToggleActive, onChangeRole }) {
  const [resetting, setResetting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const color = ROLE_COLOR[staff.role] || "#17D9A3";

  const handleReset = async () => {
    if (!confirm("Reset password for " + staff.fullName + "? They will set a new password on next login.")) return;
    setResetting(true);
    await onReset(staff.id).finally(() => setResetting(false));
  };
  const handleToggle = async () => {
    const msg = staff.active ? "Deactivate " + staff.fullName + "? They will be logged out immediately." : "Activate " + staff.fullName + "?";
    if (!confirm(msg)) return;
    setToggling(true);
    await onToggleActive(staff.id, !staff.active).finally(() => setToggling(false));
  };

  const btnStyle = { border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.04)", color: "#8CA1B4", borderRadius: "6px", padding: "5px 10px", fontSize: "10px", cursor: "pointer", fontFamily: "IBM Plex Mono, monospace", transition: "all 0.2s" };

  return React.createElement("div", {
    style: { background: staff.active ? "rgba(15,42,63,0.5)" : "rgba(255,79,79,0.05)", border: "1px solid " + (staff.active ? "rgba(23,217,163,0.12)" : "rgba(255,79,79,0.15)"),
      borderRadius: "12px", padding: "14px 16px", marginBottom: "10px" }
  },
    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" } },
      React.createElement("div", null,
        React.createElement("div", { style: { fontSize: "14px", fontWeight: 600, color: staff.active ? "#fff" : "#5A7A8A", marginBottom: "3px", display: "flex", alignItems: "center", gap: "8px" } },
          staff.fullName,
          staff.needsPasswordSetup && React.createElement(Badge, { text: "SETUP PENDING", color: "#FFB020" }),
          !staff.active && React.createElement(Badge, { text: "INACTIVE", color: "#FF4F4F" }),
          isCurrentUser && React.createElement(Badge, { text: "YOU", color: "#17D9A3" })
        ),
        React.createElement("div", { style: { fontSize: "10px", color: "#5A7A8A", fontFamily: "IBM Plex Mono, monospace" } },
          "@" + staff.username + " \u00B7 " + (staff.rankTitle || "Naval Staff") + " \u00B7 Last login: " + (staff.lastLoginAt ? new Date(staff.lastLoginAt).toLocaleDateString() : "Never"))
      ),
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "6px" } },
        React.createElement("select", {
          value: staff.role,
          onChange: (e) => { if (confirm("Change role to " + e.target.value + "?")) onChangeRole(staff.id, e.target.value); },
          disabled: isCurrentUser,
          style: { background: "rgba(0,0,0,0.3)", border: "1px solid " + color, color: color, borderRadius: "6px", padding: "4px 8px", fontSize: "10px", cursor: "pointer", fontFamily: "IBM Plex Mono, monospace" }
        },
          React.createElement("option", { value: "OFFICER" }, "OFFICER"),
          React.createElement("option", { value: "ADMIN" }, "ADMIN")
        )
      )
    ),
    React.createElement("div", { style: { display: "flex", gap: "8px" } },
      React.createElement("button", { style: btnStyle, onClick: handleReset, disabled: resetting || isCurrentUser, title: "Reset password" }, resetting ? "..." : " RESET PWD"),
      !isCurrentUser && React.createElement("button", {
        style: { ...btnStyle, color: staff.active ? "#FF6B6B" : "#17D9A3", borderColor: staff.active ? "rgba(255,79,79,0.3)" : "rgba(23,217,163,0.3)" },
        onClick: handleToggle, disabled: toggling
      }, toggling ? "..." : (staff.active ? " DEACTIVATE" : " ACTIVATE"))
    )
  );
}

export default function StaffManagementPage({ onClose }) {
  const { user: currentUser, apiGet, apiPost, apiPut } = useAuth();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3500); };

  const fetchStaff = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiGet("/api/auth/staff");
      setStaff(data);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }, [apiGet]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleReset = async (id) => {
    try {
      await apiPost("/api/auth/staff/" + id + "/reset-password", {});
      showSuccess("Password reset. User will set new password on next login.");
      await fetchStaff();
    } catch (err) { setError(err.message); }
  };

  const handleToggleActive = async (id, active) => {
    try {
      await apiPut("/api/auth/staff/" + id + "/active", { active });
      showSuccess(active ? "Account activated." : "Account deactivated and sessions cleared.");
      await fetchStaff();
    } catch (err) { setError(err.message); }
  };

  const handleChangeRole = async (id, role) => {
    try {
      await apiPut("/api/auth/staff/" + id + "/role", { role });
      showSuccess("Role updated to " + role);
      await fetchStaff();
    } catch (err) { setError(err.message); }
  };

  const s = { fontFamily: "IBM Plex Sans, sans-serif" };

  return React.createElement("div", {
    style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: "16px", ...s }
  },
    React.createElement("div", {
      style: { width: "100%", maxWidth: "680px", maxHeight: "90vh", background: "#081826", border: "1px solid rgba(255,176,32,0.3)", borderRadius: "20px",
        display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.9)" }
    },
      React.createElement("div", {
        style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }
      },
        React.createElement("div", null,
          React.createElement("div", { style: { fontFamily: "IBM Plex Mono, monospace", fontSize: "14px", fontWeight: 700, letterSpacing: "0.1em", color: "#FFB020" } }, " STAFF MANAGEMENT"),
          React.createElement("div", { style: { fontSize: "11px", color: "#5A7A8A", fontFamily: "IBM Plex Mono, monospace", marginTop: "2px" } }, "Admin only \u00B7 " + staff.length + " accounts")
        ),
        React.createElement("div", { style: { display: "flex", gap: "10px" } },
          React.createElement("button", {
            onClick: () => setShowAddModal(true),
            style: { background: "rgba(255,176,32,0.12)", border: "1px solid rgba(255,176,32,0.4)", color: "#FFB020", borderRadius: "8px", padding: "8px 14px", fontSize: "11px", cursor: "pointer", fontFamily: "IBM Plex Mono, monospace", fontWeight: 600 }
          }, "+ ADD STAFF"),
          React.createElement("button", { onClick: onClose, style: { background: "none", border: "none", color: "#5A7A8A", cursor: "pointer", fontSize: "22px", lineHeight: 1, padding: "4px" } }, "\u00D7")
        )
      ),
      successMsg && React.createElement("div", {
        style: { margin: "12px 24px 0", background: "rgba(23,217,163,0.12)", border: "1px solid rgba(23,217,163,0.3)", borderRadius: "8px", padding: "8px 12px", fontSize: "11px", color: "#17D9A3", fontFamily: "IBM Plex Mono, monospace" }
      }, "" + successMsg),
      error && React.createElement("div", {
        style: { margin: "12px 24px 0", background: "rgba(255,79,79,0.12)", border: "1px solid rgba(255,79,79,0.3)", borderRadius: "8px", padding: "8px 12px", fontSize: "11px", color: "#FF8888", fontFamily: "IBM Plex Mono, monospace" }
      }, " " + error),
      React.createElement("div", { style: { flex: 1, overflowY: "auto", padding: "16px 24px 20px" } },
        loading ? React.createElement("div", { style: { textAlign: "center", color: "#5A7A8A", fontFamily: "IBM Plex Mono, monospace", padding: "40px" } }, "LOADING STAFF ROSTER...") :
        staff.length === 0 ? React.createElement("div", { style: { textAlign: "center", color: "#5A7A8A", padding: "40px" } }, "No staff accounts found.") :
        staff.map((s) =>
          React.createElement(StaffRow, {
            key: s.id, staff: s,
            isCurrentUser: currentUser && currentUser.id === s.id,
            onReset: handleReset, onToggleActive: handleToggleActive, onChangeRole: handleChangeRole
          })
        )
      ),
      showAddModal && React.createElement(AddStaffModal, {
        onClose: () => setShowAddModal(false),
        onAdded: (newStaff) => { setStaff(prev => [...prev, newStaff]); showSuccess("Staff account created: " + newStaff.fullName + " (PENDING_SETUP)"); },
        apiPost
      })
    )
  );
}