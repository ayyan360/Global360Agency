import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { AssistantWidget } from '../components/assistant/AssistantWidget.jsx';
import { AssistantMarkdown } from '../components/assistant/AssistantMarkdown.jsx';
import { getAssistantPageContext } from '../components/assistant/pageContext.js';

vi.mock('../context/AuthContext.jsx', () => ({ useAuth: vi.fn() }));
vi.mock('../services/api.js', () => ({ api: { post: vi.fn() } }));

describe('Learning assistant widget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders assistant Markdown as formatted content without executing raw HTML', () => {
    const markdown = `## Learning progress

The page shows **course completion**.

| Item | Details |
| --- | --- |
| Progress | A visual summary |

\`<div>\` groups content.

<img src=x onerror=alert(1)>`;
    render(<AssistantMarkdown content={markdown} />);

    expect(screen.getByRole('heading', { name: 'Learning progress' })).toBeInTheDocument();
    expect(screen.getByText('course completion').tagName).toBe('STRONG');
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('<div>')).toBeInTheDocument();
    expect(document.querySelector('img')).not.toBeInTheDocument();
  });

  it('maps supported routes to page categories without including route IDs', () => {
    expect(getAssistantPageContext('/student')).toBe('student_dashboard');
    expect(getAssistantPageContext('/courses/intro-html')).toBe('course_details');
    expect(getAssistantPageContext('/learn/intro-html/lesson-123')).toBe('lesson_player');
    expect(getAssistantPageContext('/admin/certificates')).toBe('admin_certificates');
    expect(getAssistantPageContext('/student/internship/tasks/task-123')).toBe('internship_tasks');
    expect(getAssistantPageContext('/unrecognized/path')).toBe('other');
  });

  it('is hidden when the visitor is not signed in', () => {
    useAuth.mockReturnValue({ user: null, status: 'ready' });
    render(<MemoryRouter initialEntries={['/student']}><AssistantWidget /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: 'Open learning assistant' })).not.toBeInTheDocument();
  });

  it('lets a signed-in user ask a question and displays the assistant reply', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, status: 'ready' });
    api.post.mockResolvedValue({ data: { data: { reply: 'A div groups related content.' } } });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/student']}><AssistantWidget /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Open learning assistant' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Ask a question about learning or Global360' }), { target: { value: 'What does a div do?' } });
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai-assistant/chat', {
      messages: [{ role: 'user', content: 'What does a div do?' }],
      pageContext: 'student_dashboard',
    }));
    expect(await screen.findByText('A div groups related content.')).toBeInTheDocument();
  });

  it('offers useful quick prompts in the welcome state', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, status: 'ready' });
    api.post.mockResolvedValue({ data: { data: { reply: 'You can track progress from Learning Progress.' } } });
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/student']}><AssistantWidget /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Open learning assistant' }));
    await user.click(screen.getByRole('button', { name: 'How do I track course progress?' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ai-assistant/chat', {
      messages: [{ role: 'user', content: 'How do I track course progress?' }],
      pageContext: 'student_dashboard',
    }));
    expect(await screen.findByText('You can track progress from Learning Progress.')).toBeInTheDocument();
    expect(screen.queryByText('Try asking')).not.toBeInTheDocument();
  });

  it('starts a new private conversation when a different account signs in', async () => {
    useAuth.mockReturnValue({ user: { id: 'user-1' }, status: 'ready' });
    api.post.mockResolvedValue({ data: { data: { reply: 'A private reply for user one.' } } });
    const user = userEvent.setup();
    const { rerender } = render(<MemoryRouter initialEntries={['/student']}><AssistantWidget /></MemoryRouter>);

    await user.click(screen.getByRole('button', { name: 'Open learning assistant' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Ask a question about learning or Global360' }), { target: { value: 'A private question for user one?' } });
    await user.click(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByText('A private reply for user one.')).toBeInTheDocument();

    useAuth.mockReturnValue({ user: { id: 'user-2' }, status: 'ready' });
    rerender(<MemoryRouter initialEntries={['/student']}><AssistantWidget /></MemoryRouter>);

    expect(screen.queryByText('A private question for user one?')).not.toBeInTheDocument();
    expect(screen.queryByText('A private reply for user one.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open learning assistant' }));
    expect(screen.getByText(/I can explain topics, help with your courses, or guide you around Global360/)).toBeInTheDocument();
  });
});
