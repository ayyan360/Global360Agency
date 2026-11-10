import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Mail, UserRound } from 'lucide-react';
import { useState } from 'react';
import { AuthShell } from './AuthShell.jsx';
import { safeNext } from './LoginPage.jsx';
import { Alert, Button, Checkbox, Input } from '../../components/common/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDocumentTitle } from '../../hooks/useCommon.js';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Enter your full name').max(120),
    email: z.email('Enter a valid email address'),
    password: z.string().min(8, 'At least 8 characters').max(128).refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use at least one letter and one number'),
    confirm: z.string(),
    terms: z.literal(true, { error: 'Please accept the terms to continue' }),
  })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' });

export default function RegisterPage() {
  useDocumentTitle('Create account');
  const { register: signUp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const { register, handleSubmit, setError: setFieldError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async ({ name, email, password }) => {
    setError(null);
    try {
      await signUp({ name, email, password });
      toast.success('Welcome to Global360!');
      navigate(safeNext(location.search) || '/student', { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_TAKEN') setFieldError('email', { message: err.message });
      else {
        const fields = err.fieldErrors?.() || {};
        Object.entries(fields).forEach(([f, m]) => setFieldError(f, { message: m }));
        setError(err.message);
      }
    }
  };

  return (
    <AuthShell title="Start learning today" subtitle="Create a free account to enrol in courses, track your progress and apply for the free internship.">
      <h1 className="text-2xl font-bold">Create your free account</h1>
      <p className="mt-1 text-sm text-muted">It only takes a minute. No payment details required.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Input label="Full name" autoComplete="name" icon={UserRound} placeholder="Your full name" error={errors.name?.message} {...register('name')} />
        <Input label="Email address" type="email" autoComplete="email" icon={Mail} placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <Input label="Password" type="password" autoComplete="new-password" icon={Lock} placeholder="At least 8 characters" hint="Use at least 8 characters with letters and numbers." error={errors.password?.message} {...register('password')} />
        <Input label="Confirm password" type="password" autoComplete="new-password" icon={Lock} placeholder="Repeat your password" error={errors.confirm?.message} {...register('confirm')} />
        <div>
          <Checkbox
            label={
              <>
                I agree to the <Link to="/terms" className="link" target="_blank">Terms</Link> and <Link to="/privacy" className="link" target="_blank">Privacy Policy</Link>
              </>
            }
            {...register('terms')}
          />
          {errors.terms && <p className="mt-1 text-xs text-danger" role="alert">{errors.terms.message}</p>}
        </div>
        <Button type="submit" block size="lg" loading={isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account? <Link to={`/login${location.search}`} className="link">Log in</Link>
      </p>
    </AuthShell>
  );
}
