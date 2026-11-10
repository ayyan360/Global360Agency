import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock the API layer so page tests run without a server.
const apiMock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() }));
vi.mock('../services/api.js', async () => {
  const actual = await vi.importActual('../services/api.js');
  return { ...actual, api: apiMock, ensureCsrf: vi.fn(async () => 'token'), setCsrfToken: vi.fn() };
});

import { AuthProvider } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import { RequireAuth } from '../routes/guards.jsx';
import LoginPage from '../pages/auth/LoginPage.jsx';
import VerifyCertificatePage from '../pages/public/VerifyCertificatePage.jsx';
import { ApiError } from '../services/api.js';

function renderWithProviders(ui, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ToastProvider>
        <AuthProvider>{ui}</AuthProvider>
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  Object.values(apiMock).forEach((fn) => fn.mockReset());
  apiMock.get.mockImplementation(async (url) => {
    if (url === '/auth/me') return { data: { data: { user: null } } };
    throw new Error(`unexpected GET ${url}`);
  });
});

describe('Pages', () => {
  it('Login validates input before calling the API', async () => {
    renderWithProviders(<LoginPage />, { route: '/login' });
    await userEvent.click(await screen.findByRole('button', { name: 'Login' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('Login shows the server error for wrong credentials', async () => {
    apiMock.post.mockRejectedValueOnce(new ApiError({ status: 401, code: 'UNAUTHENTICATED', message: 'Incorrect email or password.' }));
    renderWithProviders(<LoginPage />, { route: '/login' });
    await userEvent.type(await screen.findByLabelText('Email address'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'WrongPass1');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));
    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
    expect(apiMock.post).toHaveBeenCalledWith('/auth/login', { email: 'a@example.com', password: 'WrongPass1' });
  });

  it('RequireAuth redirects anonymous users to login with a return path', async () => {
    renderWithProviders(
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/student" element={<p>Secret dashboard</p>} />
        </Route>
        <Route path="/login" element={<p>Login screen</p>} />
      </Routes>,
      { route: '/student' }
    );
    expect(await screen.findByText('Login screen')).toBeInTheDocument();
    expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument();
  });

  it('RequireAuth blocks users without the required permission', async () => {
    apiMock.get.mockImplementation(async (url) => {
      if (url === '/auth/me') return { data: { data: { user: { id: '1', name: 'S', role: 'student', permissions: ['learning:use'] } } } };
      throw new Error('unexpected');
    });
    renderWithProviders(
      <Routes>
        <Route element={<RequireAuth permissions={['courses:manage']} />}>
          <Route path="/admin" element={<p>Admin area</p>} />
        </Route>
        <Route path="/access-denied" element={<p>Access denied</p>} />
      </Routes>,
      { route: '/admin' }
    );
    expect(await screen.findByText('Access denied')).toBeInTheDocument();
  });

  it('certificate verification shows a revoked certificate as invalid', async () => {
    apiMock.get.mockImplementation(async (url) => {
      if (url === '/auth/me') return { data: { data: { user: null } } };
      if (url.startsWith('/certificates/verify/')) {
        return { data: { data: { valid: false, status: 'revoked', certificateNumber: 'G360-2026-ABCDEFGH', holderName: 'Sara Demo', programTitle: 'Web Dev', track: 'Web Development', startDate: '2026-01-05', endDate: '2026-03-27', completionDate: '2026-03-27', issuedAt: '2026-04-01T00:00:00Z', revokedAt: '2026-05-01T00:00:00Z' } } };
      }
      throw new Error('unexpected');
    });
    renderWithProviders(
      <Routes>
        <Route path="/verify-certificate/:certificateId" element={<VerifyCertificatePage />} />
      </Routes>,
      { route: '/verify-certificate/G360-2026-ABCDEFGH' }
    );
    await waitFor(() => expect(screen.getByText('This certificate has been revoked')).toBeInTheDocument());
    expect(screen.getByText('Sara Demo')).toBeInTheDocument();
  });
});
