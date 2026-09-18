import { useCallback, useEffect, useState } from 'react';
import { Users, UserPlus, Trash2, Shield, ShieldOff, Loader2, X } from 'lucide-react';
import { listUsers, createUser, updateUser, deleteUser } from '../../services/api';

export default function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setUsers(await listUsers());
      setLoadError(null);
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      await createUser(newUsername, newPassword, newRole);
      setNewUsername('');
      setNewPassword('');
      setNewRole('user');
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setCreateError(err.message.replace(/^\d+\s*/, ''));
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleRole(user) {
    setBusyId(user.id);
    try {
      await updateUser(user.id, { role: user.role === 'admin' ? 'user' : 'admin' });
      await refresh();
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(user) {
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    setBusyId(user.id);
    try {
      await deleteUser(user.id);
      await refresh();
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">User Management</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Admins can create accounts and control access</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <UserPlus className="h-4 w-4" />
          Add User
        </button>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-500/10 dark:text-red-400">
          {loadError}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
          {users.length === 0 && !loadError && (
            <p className="px-5 py-8 text-center text-sm text-slate-400">Loading...</p>
          )}
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                {u.username.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                  {u.username}
                  {u.id === currentUser.id && (
                    <span className="ml-2 text-xs font-normal text-slate-400">(you)</span>
                  )}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">Joined {u.created_at}</p>
              </div>
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  u.role === 'admin'
                    ? 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {u.role === 'admin' ? <Shield className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
                {u.role === 'admin' ? 'Admin' : 'User'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleRole(u)}
                  disabled={busyId === u.id || u.id === currentUser.id}
                  title={u.id === currentUser.id ? "Can't change your own role" : 'Toggle admin access'}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 dark:text-slate-500 dark:hover:bg-slate-800"
                >
                  {busyId === u.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : u.role === 'admin' ? (
                    <ShieldOff className="h-4 w-4" />
                  ) : (
                    <Shield className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(u)}
                  disabled={busyId === u.id || u.id === currentUser.id}
                  title={u.id === currentUser.id ? "Can't delete your own account" : 'Delete user'}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <Users className="h-4 w-4" />
                New User
              </p>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  autoFocus
                  required
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={4}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              {createError && <p className="text-xs text-red-500">{createError}</p>}
              <button
                type="submit"
                disabled={creating}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Create User
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
