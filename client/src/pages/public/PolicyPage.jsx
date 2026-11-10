import { useDocumentTitle } from '../../hooks/useCommon.js';
import { Alert } from '../../components/common/ui.jsx';

const CONTENT = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['Information we collect', 'When you create an account we store your name, email address and a securely hashed password. If you apply for an internship we store the information you submit in the application form. When you learn on Global360 we record your course enrollments and lesson progress. Internship submissions (text, links and files) and the feedback you receive are stored so that your work can be assessed.'],
      ['How we use it', 'Your information is used to provide the platform: tracking learning progress, reviewing internship applications and submissions, calculating results, issuing certificates and sending in-app notifications. We do not sell personal information.'],
      ['Certificates and verification', 'If you are issued a certificate, anyone with its certificate ID can verify it. The public verification page shows only the holder name, program, track, dates and status — never your email, marks breakdown or reviewer notes.'],
      ['Who can see your work', 'Internship submissions and private files are visible only to you, reviewers assigned to your program and administrators. Files are stored privately and are never published.'],
      ['Security', 'Passwords are hashed, sessions use secure HTTP-only cookies, and privileged actions are recorded in an audit log.'],
      ['Your choices', 'You can update your profile at any time. To request access to or deletion of your data, contact us through the contact page.'],
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      ['Using Global360', 'Global360 provides free online courses and free internship programs. You must provide accurate information and keep your account credentials secure.'],
      ['Internship participation', 'Participation in an internship requires an approved application. Submitting a task does not mean it is approved — tasks count only after a reviewer finalizes an assessment. Global360 does not guarantee employment, placement or a certificate.'],
      ['Certificates', 'A completion certificate is issued only when the internship has ended, all completion requirements are met and the final score reaches the program threshold (70% by default). Certificates may be revoked if they were issued in error or obtained through misconduct.'],
      ['Your submissions', 'You are responsible for the work you submit and must only submit work you are entitled to share. Do not upload malicious files or content that infringes others’ rights.'],
      ['Acceptable use', 'Do not attempt to access other users’ data, interfere with the service or misuse the platform. Accounts that violate these terms may be suspended.'],
      ['Changes', 'We may update these terms. Material changes will be communicated on the platform.'],
    ],
  },
};

export default function PolicyPage({ kind }) {
  const c = CONTENT[kind];
  useDocumentTitle(c.title);
  return (
    <section className="container-page max-w-3xl py-14">
      <h1 className="text-3xl font-bold">{c.title}</h1>
      <Alert tone="warning" className="mt-6" title="Template">
        This page describes how the Global360 software handles data. The site operator should review and adapt it with qualified legal advice before launch.
      </Alert>
      <div className="mt-8 space-y-7">
        {c.sections.map(([h, p]) => (
          <section key={h}>
            <h2 className="text-lg font-semibold">{h}</h2>
            <p className="mt-2 text-sm leading-7 text-muted">{p}</p>
          </section>
        ))}
      </div>
    </section>
  );
}
