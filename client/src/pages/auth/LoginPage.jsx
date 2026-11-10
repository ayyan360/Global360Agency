import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { AuthShell } from './AuthShell.jsx';
import { Alert, Button, Input } from '../../components/common/ui.jsx';
import { useAuth, homePathFor } from '../../context/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useCommon.js';

const schema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export function safeNext(search) {
  const next = new URLSearchParams(search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

export default function LoginPage() {
  useDocumentTitle('Login');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (values) => {
    setError(null);
    try {
      const user = await login(values);
      navigate(safeNext(location.search) || homePathFor(user), { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <AuthShell title="Welcome Back!" subtitle="Log in to continue learning, track your progress and manage your internship.">
      <h1 className="text-2xl font-bold">Log in to your account</h1>
      <p className="mt-1 text-sm text-muted">Enter your email and password to continue.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Input label="Email address" type="email" autoComplete="email" icon={Mail} placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          icon={Lock}
          placeholder="Enter your password"
          error={errors.password?.message}
          labelAction={<Link to="/contact?subject=Password%20reset" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>}
          {...register('password')}
        />
        <Button type="submit" block size="lg" loading={isSubmitting}>
          Login
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Don't have an account? <Link to={`/register${location.search}`} className="link">Sign up</Link>
      </p>
    </AuthShell>
  );
}
