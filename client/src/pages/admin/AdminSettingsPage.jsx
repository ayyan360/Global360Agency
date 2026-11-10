import { useForm } from 'react-hook-form';
import { useApi } from '../../hooks/useApi.js';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { api } from '../../services/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { Alert, Button, Card, ErrorState, Input, PageHeader, PageLoader, SectionHeader } from '../../components/common/ui.jsx';

const SOCIAL = [['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['x', 'X (Twitter)'], ['youtube', 'YouTube'], ['instagram', 'Instagram'], ['github', 'GitHub']];

export default function AdminSettingsPage() {
  useDocumentTitle('Settings');
  const toast = useToast();
  const { setSettings } = useSettings();
  const { data, loading, error, reload } = useApi('/admin/settings');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ values: data });
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <PageLoader />;

  const save = async (values) => {
    try {
      const res = await api.put('/admin/settings', values);
      const { certificatePayments: _certificatePayments, ...publicSettings } = res.data.data;
      setSettings(publicSettings);
      toast.success('Settings saved.');
    } catch (err) {
      Object.entries(err.fieldErrors?.() || {}).forEach(([f, m]) => setError(f, { message: m }));
      toast.error(err.message);
    }
  };
  const e = (path) => path.split('.').reduce((o, k) => o?.[k], errors)?.message;

  return (
    <form onSubmit={handleSubmit(save)} className="space-y-6" noValidate>
      <PageHeader title="Settings" description="Public site information. Nothing is shown publicly until you enter it." actions={<Button type="submit" loading={isSubmitting}>Save settings</Button>} />
      <Alert tone="info">Internship rules (working days, holidays, timezone, certificate threshold, scoring and submission policies) are configured per program under <b>Internship Programs</b>.</Alert>
      <Card>
        <SectionHeader title="Contact information" description="Shown on the contact page and footer." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Public email" type="email" error={e('contact.email')} {...register('contact.email')} />
          <Input label="Phone" error={e('contact.phone')} {...register('contact.phone')} />
          <Input label="Address" className="sm:col-span-2" error={e('contact.address')} {...register('contact.address')} />
          <Input label="Support hours" placeholder="e.g. Mon–Fri, 9:00–17:00" error={e('contact.hours')} {...register('contact.hours')} />
        </div>
      </Card>
      <Card>
        <SectionHeader title="Site" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Footer tagline" className="sm:col-span-2" error={e('site.tagline')} {...register('site.tagline')} />
          <Input label="Support email" type="email" error={e('site.supportEmail')} {...register('site.supportEmail')} />
        </div>
      </Card>
      <Card>
        <SectionHeader title="Certificate payments" description="These bank transfer instructions are shown only to signed-in learners who qualify for a paid certificate." />
        <Alert tone="warning" className="mb-4">Enter a bank account number or IBAN intended for receiving transfers. Do not enter a payment card number. Leave these fields blank until verified.</Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Bank name" error={e('certificatePayments.bankName')} {...register('certificatePayments.bankName')} />
          <Input label="Account holder" error={e('certificatePayments.accountHolder')} {...register('certificatePayments.accountHolder')} />
          <Input label="Bank account number / IBAN" className="sm:col-span-2" autoComplete="off" error={e('certificatePayments.accountNumber')} {...register('certificatePayments.accountNumber')} />
        </div>
      </Card>
      <Card>
        <SectionHeader title="Social links" description="Only filled-in links appear in the footer." />
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIAL.map(([k, label]) => <Input key={k} label={label} type="url" placeholder="https://" error={e(`social.${k}`)} {...register(`social.${k}`)} />)}
        </div>
      </Card>
      <Card>
        <SectionHeader title="Email delivery" />
        <p className="text-sm text-muted">Email delivery is configured on the server (<code>EMAIL_PROVIDER</code>). When it is not configured, Global360 stores in-app notifications only and never claims an email was sent.</p>
      </Card>
    </form>
  );
}
