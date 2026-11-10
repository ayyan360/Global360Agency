import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Mail, MapPin, Phone, Send } from 'lucide-react';
import { api } from '../../services/api.js';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useCommon.js';
import { Alert, Button, Input, Select, Textarea } from '../../components/common/ui.jsx';
import { EnvelopeIllustration } from '../../components/common/Illustrations.jsx';

const SUBJECTS = ['General question', 'Courses', 'Internship program', 'Certificate verification', 'Technical support', 'Password reset', 'Partnerships'];

const schema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email: z.email('Enter a valid email address'),
  subject: z.string().trim().min(3, 'Choose a subject').max(200),
  message: z.string().trim().min(10, 'Please write at least 10 characters').max(5000),
  website: z.string().max(0).optional(),
});

export default function ContactPage() {
  useDocumentTitle('Contact');
  const { settings } = useSettings();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);
  const preset = params.get('subject');
  const { register, handleSubmit, reset, setError: setFieldError, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: user?.name || '', email: user?.email || '', subject: SUBJECTS.includes(preset) ? preset : '', message: '' },
  });
  const c = settings?.contact || {};
  const hasContact = c.email || c.phone || c.address || c.hours;

  const onSubmit = async (values) => {
    setError(null);
    try {
      await api.post('/contact', values);
      setSent(true);
      reset({ name: user?.name || '', email: user?.email || '', subject: '', message: '' });
    } catch (err) {
      Object.entries(err.fieldErrors?.() || {}).forEach(([f, m]) => setFieldError(f, { message: m }));
      setError(err.message);
    }
  };

  return (
    <section className="container-page py-12 lg:py-16">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h1 className="text-4xl font-bold">Get in Touch</h1>
          <p className="mt-3 text-muted">Have a question about courses, the internship or your certificate? Send us a message and the team will reply by email.</p>
          {hasContact ? (
            <ul className="mt-8 space-y-5">
              {c.address && <ContactItem icon={MapPin} label="Our office">{c.address}</ContactItem>}
              {c.email && <ContactItem icon={Mail} label="Email us"><a href={`mailto:${c.email}`} className="hover:text-primary">{c.email}</a></ContactItem>}
              {c.phone && <ContactItem icon={Phone} label="Call us"><a href={`tel:${c.phone.replace(/\s/g, '')}`} className="hover:text-primary">{c.phone}</a></ContactItem>}
              {c.hours && <ContactItem icon={Clock} label="Support hours">{c.hours}</ContactItem>}
            </ul>
          ) : (
            <p className="mt-8 rounded-xl bg-primary-50 p-4 text-sm text-muted">Use the form to reach us — we'll respond to the email address you provide.</p>
          )}
          <EnvelopeIllustration className="mt-8 hidden w-64 lg:block" />
        </div>

        <div className="card p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Send us a message</h2>
          {sent ? (
            <div className="mt-6 flex flex-col items-center py-10 text-center" role="status">
              <CheckCircle2 className="size-12 text-success" aria-hidden="true" />
              <p className="mt-4 text-lg font-semibold">Message sent</p>
              <p className="mt-1 max-w-sm text-sm text-muted">Thank you for contacting Global360. We've received your message and will reply by email.</p>
              <Button variant="outline" className="mt-6" onClick={() => setSent(false)}>Send another message</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 grid gap-4 sm:grid-cols-2" noValidate>
              {error && <Alert tone="danger" className="sm:col-span-2">{error}</Alert>}
              <Input label="Name" required autoComplete="name" placeholder="Your name" error={errors.name?.message} {...register('name')} />
              <Input label="Email" required type="email" autoComplete="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
              <Select label="Subject" required className="sm:col-span-2" placeholder="Select a subject" options={SUBJECTS.map((s) => ({ value: s, label: s }))} error={errors.subject?.message} {...register('subject')} />
              <Textarea label="Message" required className="sm:col-span-2" rows={6} placeholder="How can we help?" error={errors.message?.message} {...register('message')} />
              <div className="hidden" aria-hidden="true">
                <label htmlFor="website">Website</label>
                <input id="website" tabIndex={-1} autoComplete="off" {...register('website')} />
              </div>
              <Button type="submit" size="lg" className="sm:col-span-2" icon={Send} loading={isSubmitting}>
                Send Message
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function ContactItem({ icon: Icon, label, children }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-light text-primary"><Icon className="size-5" aria-hidden="true" /></span>
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="text-sm text-muted">{children}</span>
      </span>
    </li>
  );
}
