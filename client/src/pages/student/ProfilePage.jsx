import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { Avatar, Button, Card, Checkbox, Input, KeyValue, PageHeader, SectionHeader, Textarea } from '../../components/common/ui.jsx';
import { formatDate, titleCase } from '../../utils/format.js';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  phone: z.string().trim().max(40).optional(),
  headline: z.string().trim().max(160).optional(),
  bio: z.string().trim().max(2000).optional(),
  avatarUrl: z.string().trim().max(500).refine((v) => !v || /^https?:\/\//i.test(v), 'Enter a valid http(s) image URL').optional(),
  emailNotifications: z.boolean().optional(),
});
const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'At least 8 characters').max(128).refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use letters and numbers'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export default function ProfilePage() {
  useDocumentTitle('Profile');
  const { user, setUser } = useAuth();
  const toast = useToast();
  const profile = useForm({
    resolver: zodResolver(profileSchema),
    values: { name: user.name, phone: user.phone || '', headline: user.headline || '', bio: user.bio || '', avatarUrl: user.avatarUrl || '', emailNotifications: user.preferences?.emailNotifications ?? true },
  });
  const pw = useForm({ resolver: zodResolver(passwordSchema) });

  const saveProfile = async ({ emailNotifications, ...v }) => {
    try {
      const res = await api.patch('/auth/profile', { ...v, preferences: { emailNotifications } });
      setUser(res.data.data.user);
      toast.success('Profile updated.');
    } catch (err) {
      Object.entries(err.fieldErrors?.() || {}).forEach(([f, m]) => profile.setError(f, { message: m }));
      toast.error(err.message);
    }
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      pw.reset();
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) {
      if (err.code === 'WRONG_PASSWORD') pw.setError('currentPassword', { message: err.message });
      else toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Profile" description="Manage your personal information and account security." />
      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <Card className="h-fit text-center">
          <Avatar name={user.name} src={user.avatarUrl} size="lg" className="mx-auto size-20 text-2xl" />
          <p className="mt-3 text-lg font-semibold">{user.name}</p>
          <p className="text-sm text-muted">{user.email}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5 text-left">
            <KeyValue label="Role">{titleCase(user.role)}</KeyValue>
            <KeyValue label="Member since">{formatDate(user.createdAt)}</KeyValue>
          </dl>
          <p className="mt-4 text-xs text-muted">Your role and assessment results can only be changed by Global360 staff.</p>
        </Card>

        <div className="space-y-6">
          <Card>
            <SectionHeader title="Personal information" />
            <form onSubmit={profile.handleSubmit(saveProfile)} className="grid gap-4 sm:grid-cols-2" noValidate>
              <Input label="Full name" required error={profile.formState.errors.name?.message} {...profile.register('name')} />
              <Input label="Email" value={user.email} disabled readOnly hint="Contact support to change your email." />
              <Input label="Phone" type="tel" error={profile.formState.errors.phone?.message} {...profile.register('phone')} />
              <Input label="Headline" placeholder="e.g. Aspiring front-end developer" error={profile.formState.errors.headline?.message} {...profile.register('headline')} />
              <Input label="Avatar image URL" className="sm:col-span-2" placeholder="https://" error={profile.formState.errors.avatarUrl?.message} {...profile.register('avatarUrl')} />
              <Textarea label="Bio" className="sm:col-span-2" rows={3} error={profile.formState.errors.bio?.message} {...profile.register('bio')} />
              <Checkbox className="sm:col-span-2" label="Email notifications" description="Receive emails for important updates when email delivery is configured. In-app notifications are always on." {...profile.register('emailNotifications')} />
              <div className="sm:col-span-2">
                <Button type="submit" loading={profile.formState.isSubmitting}>Save changes</Button>
              </div>
            </form>
          </Card>

          <Card>
            <SectionHeader title="Change password" description="Changing your password signs you out on other devices." />
            <form onSubmit={pw.handleSubmit(changePassword)} className="grid gap-4 sm:grid-cols-3" noValidate>
              <Input label="Current password" type="password" autoComplete="current-password" error={pw.formState.errors.currentPassword?.message} {...pw.register('currentPassword')} />
              <Input label="New password" type="password" autoComplete="new-password" error={pw.formState.errors.newPassword?.message} {...pw.register('newPassword')} />
              <Input label="Confirm new password" type="password" autoComplete="new-password" error={pw.formState.errors.confirm?.message} {...pw.register('confirm')} />
              <div className="sm:col-span-3">
                <Button type="submit" variant="secondary" loading={pw.formState.isSubmitting}>Update password</Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
