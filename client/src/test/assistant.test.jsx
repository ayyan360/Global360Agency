import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { AssistantWidget } from '../components/assistant/AssistantWidget.jsx';

vi.mock('../context/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../services/api.js', () => ({ api: { post: vi.fn() } }));

describe('Learning assistant widget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is hidden when the visitor is not signed in', () => {
    useAuth.mockReturnValue({ user: null, status: 'ready' });
    render(<AssistantWidget />);
    expect(screen.queryByRole('button', { name: 'Open learning assistant' })).not.toBeInTheDocument();
  });

  it('lets a signed-in user ask a question and displays the assistant reply', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, status: 'ready' });
    api.post.mockResolvedValue({ data: { data: { reply: 'A div groups related content.' } } });
    const user = userEvent.setup();
    render(<AssistantWidget />);

    await user.click(screen.getByRole('button', { name: 'Open learning assistant' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Ask a learning question' }), { target: { value: 'What does a div do?' } });
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai-assistant/chat', {
      messages: [{ role: 'user', content: 'What does a div do?' }],
    }));
    expect(await screen.findByText('A div groups related content.')).toBeInTheDocument();
  });

  it('starts a new private conversation when a different account signs in', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, status: 'ready' });
    api.post.mockResolvedValue({ data: { data: { reply: 'A private reply for user one.' } } });
    const user = userEvent.setup();
    const { rerender } = render(<AssistantWidget />);

    await user.click(screen.getByRole('button', { name: 'Open learning assistant' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Ask a learning question' }), { target: { value: 'A private question for user one?' } });
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('A private reply for user one.')).toBeInTheDocument();

    useAuth.mockReturnValue({ user: { id: 'user-2' }, status: 'ready' });
    rerender(<AssistantWidget />);

    expect(screen.queryByText('A private question for user one?')).not.toBeInTheDocument();
    expect(screen.queryByText('A private reply for user one.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open learning assistant' }));
    expect(screen.getByText(/Hi! I'm your learning assistant/)).toBeInTheDocument();
  });
});
