"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, Plus, Building2, UserPlus, X, Users, Trash2, Crown } from "lucide-react";
import {
  createOrganization,
  assignUserToOrganization,
  getOrganizationMembers,
  removeOrganizationMember,
  type OrgMember,
} from "@/app/actions/super-admin";

export default function SuperAdminPage() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  const [assignOrgId, setAssignOrgId] = useState<string | null>(null);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignRole, setAssignRole] = useState("owner");
  const [assignLoading, setAssignLoading] = useState(false);

  const [manageOrg, setManageOrg] = useState<{ id: string; name: string } | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function openManage(org: { id: string; name: string }) {
    setManageOrg(org);
    setMembers([]);
    setMembersError(null);
    setMembersLoading(true);
    const res = await getOrganizationMembers(org.id);
    setMembersLoading(false);
    if (res.success && res.members) setMembers(res.members);
    else setMembersError(res.error ?? "Failed to load members");
  }

  async function handleRemoveMember(userId: string) {
    if (!manageOrg) return;
    if (!confirm("Remove this member from the organization?")) return;
    setRemovingId(userId);
    const res = await removeOrganizationMember(manageOrg.id, userId);
    setRemovingId(null);
    if (res.success) {
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      loadOrgs(); // refresh member counts
    } else {
      alert(res.error ?? "Failed to remove member");
    }
  }

  useEffect(() => {
    loadOrgs();
  }, []);

  async function loadOrgs() {
    setLoading(true);
    const { data, error } = await supabase
      .from('organizations')
      .select(`
        id,
        name,
        slug,
        created_at,
        organization_members (count)
      `)
      .order('created_at', { ascending: true });

    if (data) {
      setOrganizations(data);
    } else {
      console.error("Error loading orgs", error);
    }
    setLoading(false);
  }

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    const result = await createOrganization(newOrgName, newOrgSlug);
    setCreateLoading(false);
    
    if (result.success && result.organization) {
      setOrganizations([...organizations, { ...result.organization, organization_members: [{ count: 0 }] }]);
      setIsCreateOrgOpen(false);
      setNewOrgName("");
      setNewOrgSlug("");
    } else {
      alert("Failed to create organization: " + result.error);
    }
  };

  const handleAssignUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignOrgId) return;
    setAssignLoading(true);
    const result = await assignUserToOrganization(assignEmail, assignOrgId, assignRole);
    setAssignLoading(false);

    if (result.success) {
      alert("User assigned successfully!");
      setAssignOrgId(null);
      setAssignEmail("");
      loadOrgs(); // refresh counts
    } else {
      alert("Failed to assign user: " + result.error);
    }
  };

  if (loading && organizations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-rose-500" />
        <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Orgs…</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Organizations</h2>
          <p className="text-slate-400 text-sm font-bold mt-0.5">Manage all tenants on the platform</p>
        </div>
        <button
          className="flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded-xl font-black text-sm transition-all active:translate-y-px"
          style={{ boxShadow: "0 3px 0 0 #be123c" }}
          onClick={() => setIsCreateOrgOpen(true)}
        >
          <Plus size={16} />
          New Organization
        </button>
      </div>

      <div className="bg-white rounded-[1.5rem] border-2 border-slate-100 overflow-hidden" style={{ boxShadow: "0 4px 0 0 #e2e8f0" }}>
        <div className="divide-y-2 divide-slate-50">
          {organizations.length === 0 ? (
            <div className="px-5 py-8 text-center text-slate-300">
              <Building2 className="w-7 h-7 mx-auto mb-2" />
              <p className="text-xs font-black">No organizations found or RLS blocked</p>
            </div>
          ) : (
            organizations.map((org) => (
              <div key={org.id} className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <p className="font-black text-slate-800 text-base">{org.name}</p>
                    <p className="text-[11px] font-bold text-slate-400 font-mono mt-0.5">{org.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="font-black text-slate-800 text-sm">{org.organization_members[0]?.count ?? 0}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Members</p>
                  </div>
                  <button
                    onClick={() => openManage({ id: org.id, name: org.name })}
                    className="flex items-center gap-2 text-slate-600 hover:text-slate-800 font-black text-xs bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <Users size={14} />
                    Members
                  </button>
                  <button
                    onClick={() => setAssignOrgId(org.id)}
                    className="flex items-center gap-2 text-rose-600 hover:text-rose-700 font-black text-xs bg-rose-50 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition-colors"
                  >
                    <UserPlus size={14} />
                    Assign User
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Org Modal — portalled to document.body so it escapes the sidebar layout */}
      {isCreateOrgOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-7 w-full max-w-md relative" style={{ boxShadow: "0 8px 0 0 #e2e8f0" }}>
            <button
              onClick={() => setIsCreateOrgOpen(false)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="mb-6">
              <div className="w-11 h-11 bg-rose-100 rounded-2xl flex items-center justify-center mb-3" style={{ boxShadow: "0 3px 0 0 #fecaca" }}>
                <Building2 size={20} className="text-rose-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Create Organization</h3>
              <p className="text-slate-400 text-sm font-bold mt-0.5">Add a new pesantren tenant to the platform.</p>
            </div>
            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Organization Name *</label>
                <input
                  type="text"
                  required
                  value={newOrgName}
                  onChange={(e) => {
                    setNewOrgName(e.target.value);
                    if (!newOrgSlug) {
                      setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
                    }
                  }}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-rose-400 transition-colors"
                  placeholder="e.g. Pesantren Darunnajah"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Slug *</label>
                <input
                  type="text"
                  required
                  value={newOrgSlug}
                  onChange={(e) => setNewOrgSlug(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 font-mono text-sm font-bold focus:outline-none focus:border-rose-400 transition-colors"
                  placeholder="e.g. darunnajah"
                />
              </div>
              <button
                disabled={createLoading}
                type="submit"
                className="w-full mt-2 bg-rose-500 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 active:translate-y-px transition-transform disabled:opacity-60"
                style={{ boxShadow: "0 3px 0 0 #be123c" }}
              >
                {createLoading ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Creating…</> : "+ Create Organization"}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Assign User Modal — portalled to document.body */}
      {assignOrgId && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-7 w-full max-w-md relative" style={{ boxShadow: "0 8px 0 0 #e2e8f0" }}>
            <button
              onClick={() => setAssignOrgId(null)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="mb-6">
              <div className="w-11 h-11 bg-rose-100 rounded-2xl flex items-center justify-center mb-3" style={{ boxShadow: "0 3px 0 0 #fecaca" }}>
                <UserPlus size={20} className="text-rose-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Assign User to Organization</h3>
              <p className="text-slate-400 text-sm font-bold mt-0.5">Add an existing user account to this pesantren.</p>
            </div>
            <form onSubmit={handleAssignUser} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">User Email *</label>
                <input
                  type="email"
                  required
                  value={assignEmail}
                  onChange={(e) => setAssignEmail(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-rose-400 transition-colors"
                  placeholder="e.g. admin@pesantren.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Role</label>
                <select
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:border-rose-400 transition-colors appearance-none"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="ustadz">Ustadz</option>
                </select>
              </div>
              <button
                disabled={assignLoading}
                type="submit"
                className="w-full mt-2 bg-rose-500 text-white font-black py-3.5 rounded-xl flex items-center justify-center gap-2 active:translate-y-px transition-transform disabled:opacity-60"
                style={{ boxShadow: "0 3px 0 0 #be123c" }}
              >
                {assignLoading ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Assigning…</> : "Assign User"}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Manage Members Modal — view owners/members and remove */}
      {manageOrg && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-7 w-full max-w-lg relative" style={{ boxShadow: "0 8px 0 0 #e2e8f0" }}>
            <button
              onClick={() => setManageOrg(null)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-200 transition-colors"
            >
              <X size={16} />
            </button>
            <div className="mb-6">
              <div className="w-11 h-11 bg-slate-100 rounded-2xl flex items-center justify-center mb-3" style={{ boxShadow: "0 3px 0 0 #e2e8f0" }}>
                <Users size={20} className="text-slate-600" />
              </div>
              <h3 className="text-xl font-black text-slate-800">Members — {manageOrg.name}</h3>
              <p className="text-slate-400 text-sm font-bold mt-0.5">Owners, admins and ustadz in this organization.</p>
            </div>

            {membersLoading ? (
              <div className="flex items-center justify-center py-10 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                <span className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading…</span>
              </div>
            ) : membersError ? (
              <div className="py-6 text-center text-rose-600 text-sm font-bold">{membersError}</div>
            ) : members.length === 0 ? (
              <div className="py-10 text-center text-slate-300">
                <Users className="w-7 h-7 mx-auto mb-2" />
                <p className="text-xs font-black">No members yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[22rem] overflow-y-auto">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-100">
                    <div className="min-w-0">
                      <p className="font-black text-slate-800 text-sm truncate flex items-center gap-1.5">
                        {m.role === "owner" && <Crown size={13} className="text-amber-500 flex-shrink-0" />}
                        {m.name || "—"}
                      </p>
                      <p className="text-[11px] font-bold text-slate-400 truncate">{m.email || m.user_id}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        m.role === "owner" ? "bg-amber-100 text-amber-700"
                        : m.role === "admin" ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-600"
                      }`}>
                        {m.role}
                      </span>
                      <button
                        onClick={() => handleRemoveMember(m.user_id)}
                        disabled={removingId === m.user_id}
                        title="Remove from organization"
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors disabled:opacity-50"
                      >
                        {removingId === m.user_id
                          ? <Loader2 size={14} className="animate-spin" />
                          : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
