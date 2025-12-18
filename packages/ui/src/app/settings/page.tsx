'use client';

import { useState } from 'react';
import { ProtectedRoute, useAuth } from '@/lib/auth';
import { apiClient, ApiError } from '@/lib/api';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Billing portal state
  const [isLoadingBilling, setIsLoadingBilling] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiClient.updatePassword(currentPassword, newPassword);
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to change password');
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    setIsLoadingBilling(true);
    setError('');
    try {
      const { url } = await apiClient.getBillingPortalUrl();
      window.open(url, '_blank');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to open billing portal');
      }
    } finally {
      setIsLoadingBilling(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsDeletingAccount(true);

    try {
      await apiClient.deleteAccount(deletePassword);
      await apiClient.logout();
      router.push('/login');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to delete account');
      }
      setIsDeletingAccount(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Account Settings</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Account Information */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Account Information</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  className="input bg-gray-50"
                  disabled
                  readOnly
                />
                <p className="mt-1 text-xs text-gray-500">
                  Email cannot be changed in the current version
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  User ID
                </label>
                <input
                  type="text"
                  value={user?.id || ''}
                  className="input bg-gray-50 font-mono text-sm"
                  disabled
                  readOnly
                />
              </div>
            </div>
          </div>

          {/* Change Password */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Change Password</h2>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input"
                  required
                  disabled={isChangingPassword}
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input"
                  required
                  disabled={isChangingPassword}
                  minLength={8}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input"
                  required
                  disabled={isChangingPassword}
                  minLength={8}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isChangingPassword}
              >
                {isChangingPassword ? 'Changing Password...' : 'Change Password'}
              </button>
            </form>
          </div>

          {/* Subscription & Billing */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Subscription & Billing</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Plan
                </label>
                <p className="text-lg font-semibold capitalize">
                  {user?.subscription?.plan || 'Free'}
                </p>
                <p className="text-sm text-gray-600">
                  Status: <span className="capitalize">{user?.subscription?.status || 'Active'}</span>
                </p>
              </div>
              <button
                onClick={handleOpenBillingPortal}
                className="btn btn-secondary"
                disabled={isLoadingBilling}
              >
                {isLoadingBilling ? 'Loading...' : 'Manage Billing'}
              </button>
              <p className="text-xs text-gray-500">
                Opens Stripe billing portal to manage your subscription, payment methods, and invoices
              </p>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="card border-red-200 bg-red-50">
            <h2 className="text-xl font-semibold text-red-900 mb-4">Danger Zone</h2>
            {!showDeleteConfirm ? (
              <div>
                <p className="text-sm text-red-800 mb-4">
                  Once you delete your account, there is no going back. This action cannot be undone.
                  All your data, API keys, and usage history will be permanently deleted.
                </p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="btn btn-danger"
                >
                  Delete Account
                </button>
              </div>
            ) : (
              <div>
                <p className="text-sm text-red-800 mb-4 font-semibold">
                  Are you absolutely sure? This action cannot be undone.
                </p>
                <form onSubmit={handleDeleteAccount} className="space-y-4">
                  <div>
                    <label htmlFor="deletePassword" className="block text-sm font-medium text-red-900 mb-1">
                      Enter your password to confirm
                    </label>
                    <input
                      id="deletePassword"
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      className="input border-red-300 focus:border-red-500 focus:ring-red-500"
                      placeholder="Enter your password"
                      required
                      disabled={isDeletingAccount}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="btn btn-danger"
                      disabled={isDeletingAccount}
                    >
                      {isDeletingAccount ? 'Deleting Account...' : 'Yes, Delete My Account'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeletePassword('');
                      }}
                      className="btn btn-secondary"
                      disabled={isDeletingAccount}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
