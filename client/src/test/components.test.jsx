import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ProgressBar, StatusBadge, Input, Pagination } from '../components/common/ui.jsx';
import { ResultsSummary, EligibilityChecklist } from '../components/internship/Results.jsx';
import { FileUpload } from '../components/forms/FileUpload.jsx';
import { CourseCard } from '../components/courses/CourseCard.jsx';
import { CourseThumbnail } from '../components/courses/CourseThumbnail.jsx';
import { BarChart } from '../components/dashboard/BarChart.jsx';

const results = {
  completionProgress: 80,
  finalScore: 36,
  provisionalScore: 36,
  scoreIsFinal: true,
  threshold: 70,
  outcome: 'not_qualified',
  counts: { approved: 4, totalRequired: 5 },
  marks: { earned: 18, possible: 50 },
  policy: { explanation: 'Explanation' },
  checks: [
    { key: 'programEnded', label: 'Internship has reached its end date', passed: true },
    { key: 'score', label: 'Final score of at least 70%', passed: false, detail: 'Final score is 36%.' },
  ],
};

describe('UI components', () => {
  it('ProgressBar exposes an accessible, clamped value', () => {
    render(<ProgressBar value={140} label="Course progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Course progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
  });

  it('StatusBadge renders readable labels', () => {
    render(<StatusBadge status="under_review" />);
    expect(screen.getByText('Under Review')).toBeInTheDocument();
  });

  it('Input links errors to the field for screen readers', () => {
    render(<Input label="Email" error="Enter a valid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email');
  });

  it('password inputs have a visibility toggle', async () => {
    render(<Input label="Password" type="password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });

  it('ResultsSummary shows task completion, score and eligibility as separate figures', () => {
    render(<ResultsSummary results={results} />);
    expect(screen.getByText('Task completion')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Final performance score')).toBeInTheDocument();
    expect(screen.getByText('36%')).toBeInTheDocument();
    expect(screen.getByText('Not Qualified')).toBeInTheDocument();
  });

  it('EligibilityChecklist marks passed and failed checks', () => {
    render(<EligibilityChecklist checks={results.checks} />);
    expect(screen.getByLabelText('Passed')).toBeInTheDocument();
    expect(screen.getByLabelText('Not met')).toBeInTheDocument();
    expect(screen.getByText('Final score is 36%.')).toBeInTheDocument();
  });

  it('FileUpload rejects disallowed types and oversize files before upload', async () => {
    const onChange = vi.fn();
    const { container } = render(<FileUpload files={[]} onChange={onChange} allowedTypes={['pdf']} maxSizeMB={1} maxFiles={2} />);
    const input = container.querySelector('input[type=file]');
    await userEvent.upload(input, new File(['x'], 'virus.exe', { type: 'application/octet-stream' }), { applyAccept: false });
    expect(screen.getByRole('alert')).toHaveTextContent('not an accepted file type');
    const big = new File([new Uint8Array(2 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    await userEvent.upload(input, big);
    expect(screen.getByRole('alert')).toHaveTextContent('larger than 1 MB');
    await userEvent.upload(input, new File(['%PDF'], 'ok.pdf', { type: 'application/pdf' }));
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'ok.pdf' })]);
  });

  it('CourseCard links to the course and does not invent ratings', () => {
    render(
      <MemoryRouter>
        <CourseCard course={{ id: '1', title: 'Web Basics', slug: 'web-basics', category: 'Web Development', level: 'beginner', lessonCount: 12, rating: null, reviewCount: 0, isFree: true }} />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Web Basics' })).toHaveAttribute('href', '/courses/web-basics');
    expect(screen.getByText('No reviews yet')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('CourseThumbnail prefers the uploaded image, then falls back to the first lecture thumbnail', () => {
    const { container } = render(
      <CourseThumbnail
        src="https://example.com/course-cover.jpg"
        lessonThumbnailUrl="https://img.youtube.com/vi/PkZNo7MFNFg/hqdefault.jpg"
        title="Web Basics"
        category="Web Development"
      />
    );
    const image = container.querySelector('img');
    expect(image).toHaveAttribute('src', 'https://example.com/course-cover.jpg');
    fireEvent.error(image);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://img.youtube.com/vi/PkZNo7MFNFg/hqdefault.jpg');
  });

  it('Pagination calls back with the requested page', async () => {
    const onPage = vi.fn();
    render(<Pagination meta={{ page: 2, totalPages: 5, total: 50, pageSize: 10 }} onPage={onPage} />);
    expect(screen.getByText('Showing 11–20 of 50')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPage).toHaveBeenCalledWith(3);
  });

  it('BarChart includes an accessible data table', () => {
    render(<BarChart label="Weekly score" data={[{ label: 'Week 1', value: 80 }, { label: 'Week 2', value: null }]} />);
    expect(screen.getByText('Weekly score')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
  });
});
