/**
 * Sample internship programs and 12-week task plans (development/demo content only).
 * Dates are computed relative to the day the seeder runs so the demo always has an
 * open program, a program in progress and a completed program.
 */
import { DateTime } from 'luxon';

export const SAMPLE_TIMEZONE = 'Asia/Karachi';

/** Monday on or after `date`. */
const nextMonday = (dt) => (dt.weekday === 1 ? dt : dt.plus({ days: 8 - dt.weekday }));

export function programDates(now = DateTime.now().setZone(SAMPLE_TIMEZONE)) {
  const today = now.startOf('day');
  const upcomingStart = nextMonday(today.plus({ days: 14 }));
  const designStart = upcomingStart.plus({ weeks: 2 });
  // In progress: started ~6 weeks ago (on a Monday), 12 weeks long.
  const runningStart = nextMonday(today.minus({ weeks: 7 }));
  // Completed: ended a few weeks ago.
  const completedStart = nextMonday(today.minus({ weeks: 20 }));
  const twelveWeeks = (start) => start.plus({ weeks: 12 }).minus({ days: 3 }); // Friday of week 12
  return {
    upcoming: { start: upcomingStart, end: twelveWeeks(upcomingStart) },
    design: { start: designStart, end: twelveWeeks(designStart) },
    running: { start: runningStart, end: twelveWeeks(runningStart) },
    completed: { start: completedStart, end: twelveWeeks(completedStart) },
    today,
  };
}

const DAY_TEMPLATES = [
  { day: 1, label: 'Kick-off & setup', marks: 10, kind: 'setup' },
  { day: 2, label: 'Guided practice', marks: 10, kind: 'practice' },
  { day: 3, label: 'Feature implementation', marks: 10, kind: 'build' },
  { day: 4, label: 'Testing & refinement', marks: 10, kind: 'refine' },
  { day: 5, label: 'Weekly deliverable', marks: 20, kind: 'deliver' },
];

const TRACK_WEEKS = {
  'Web Development': [
    ['Environment & Git workflow', ['Git', 'Command line', 'VS Code']],
    ['Semantic HTML & accessibility', ['HTML', 'Accessibility']],
    ['Responsive CSS layouts', ['CSS', 'Flexbox', 'Grid']],
    ['JavaScript fundamentals', ['JavaScript']],
    ['DOM & events', ['JavaScript', 'DOM']],
    ['Working with APIs', ['Fetch', 'REST']],
    ['React components', ['React']],
    ['State & routing in React', ['React', 'React Router']],
    ['Node.js & Express APIs', ['Node.js', 'Express']],
    ['Databases with PostgreSQL', ['SQL', 'PostgreSQL']],
    ['Testing & deployment', ['Testing', 'Deployment']],
    ['Capstone project', ['Full-stack', 'Presentation']],
  ],
  'Data Science': [
    ['Python & notebooks setup', ['Python', 'Jupyter']],
    ['Python data structures', ['Python']],
    ['Data loading with pandas', ['pandas']],
    ['Data cleaning', ['pandas', 'Data cleaning']],
    ['Exploratory analysis', ['Statistics', 'EDA']],
    ['Visualization', ['matplotlib', 'Charts']],
    ['SQL for analysis', ['SQL']],
    ['Probability & statistics', ['Statistics']],
    ['Intro to machine learning', ['scikit-learn', 'ML']],
    ['Model evaluation', ['ML', 'Metrics']],
    ['Communicating insights', ['Storytelling', 'Dashboards']],
    ['Capstone analysis', ['End-to-end analysis', 'Presentation']],
  ],
  'UI/UX Design': [
    ['Design tools & process', ['Figma', 'Design process']],
    ['User research', ['Interviews', 'Personas']],
    ['Information architecture', ['IA', 'Card sorting']],
    ['User flows & wireframes', ['Wireframing']],
    ['Visual design foundations', ['Typography', 'Colour']],
    ['Layout & grids', ['Layout', 'Spacing']],
    ['Design systems', ['Components', 'Design tokens']],
    ['Interactive prototyping', ['Prototyping']],
    ['Usability testing', ['Testing', 'Research']],
    ['Accessibility in design', ['Accessibility', 'WCAG']],
    ['Responsive & mobile design', ['Responsive design']],
    ['Case study & portfolio', ['Portfolio', 'Presentation']],
  ],
};

const instructionsFor = (theme, tmpl) => {
  const base = {
    setup: `Prepare your workspace for this week's topic: ${theme}. Read the reference material, set up any tools needed and write a short plan describing what you expect to learn.`,
    practice: `Complete the guided exercises for ${theme}. Work through each exercise, keep your code or files organized and note anything you found difficult.`,
    build: `Apply ${theme} to build a small feature or artifact. Focus on correctness and clarity, and explain the decisions you made.`,
    refine: `Review and improve yesterday's work on ${theme}. Test it, fix issues, improve accessibility and quality, and document what you changed.`,
    deliver: `Submit this week's deliverable for ${theme}: a polished piece of work demonstrating everything practised this week, with a short write-up (what you built, how, and what you would improve).`,
  }[tmpl.kind];
  return base;
};

export function taskPlanForTrack(track) {
  const weeks = TRACK_WEEKS[track] || TRACK_WEEKS['Web Development'];
  const plan = [];
  weeks.forEach(([theme, skills], i) => {
    for (const tmpl of DAY_TEMPLATES) {
      const isCapstoneFinal = i === weeks.length - 1 && tmpl.day === 5;
      plan.push({
        weekNumber: i + 1,
        scheduledDay: tmpl.day,
        title: isCapstoneFinal ? `Final capstone submission` : `${theme} — ${tmpl.label}`,
        description: isCapstoneFinal
          ? 'Submit your completed capstone project with documentation and a short presentation.'
          : `Week ${i + 1} ${tmpl.label.toLowerCase()} task focused on ${theme.toLowerCase()}.`,
        instructions: isCapstoneFinal
          ? 'Submit your final capstone: a working project or artifact, a README or case study explaining the problem, your approach, trade-offs and next steps, and a link to a short recorded walkthrough if possible.'
          : instructionsFor(theme, tmpl),
        requirements: tmpl.kind === 'deliver' ? ['Complete, working deliverable', 'Short written summary (150–300 words)', 'Link or file containing your work'] : ['Follow the task instructions', 'Explain your approach briefly'],
        acceptanceCriteria:
          tmpl.kind === 'deliver'
            ? ['Meets all requirements for the week', 'Work is well organized and documented', 'Shows understanding of the week’s concepts']
            : ['Task instructions completed', 'Work is clear and correct', 'Explanation shows understanding'],
        skills,
        resources: [],
        submissionTypes: track === 'UI/UX Design' ? ['text', 'live', 'file'] : ['text', 'repository', 'live', 'file'],
        maxMarks: isCapstoneFinal ? 30 : tmpl.marks,
        isRequired: true,
      });
    }
  });
  return plan;
}

export function weeklyCurriculum(track) {
  return (TRACK_WEEKS[track] || []).map(([title], i) => ({ week: i + 1, title, summary: `Daily practical tasks on ${title.toLowerCase()}, ending with a weekly deliverable.` }));
}

export function samplePrograms(dates) {
  const iso = (d) => d.toISODate();
  const common = {
    durationMonths: 3,
    durationWeeks: 12,
    workingDays: [1, 2, 3, 4, 5],
    timezone: SAMPLE_TIMEZONE,
    certificateThreshold: 70,
    isSample: true,
  };
  return [
    {
      key: 'web-upcoming',
      title: 'Web Development Internship',
      slug: 'web-development-internship',
      track: 'Web Development',
      shortDescription: 'Build real websites and full-stack features through daily practical tasks over twelve weeks.',
      description:
        'A free, fully online internship for aspiring web developers. Over twelve weeks you will complete practical tasks every working day — from semantic HTML and responsive CSS to React, Node.js APIs and PostgreSQL — and receive feedback from reviewers on your work. You will finish with a capstone project for your portfolio.',
      startDate: iso(dates.upcoming.start),
      endDate: iso(dates.upcoming.end),
      applicationOpenAt: dates.today.minus({ days: 7 }).toUTC().toJSDate(),
      applicationCloseAt: dates.upcoming.start.minus({ days: 3 }).endOf('day').toUTC().toJSDate(),
      capacity: 50,
      objectives: ['Build responsive, accessible web pages', 'Create interactive interfaces with React', 'Develop REST APIs with Node.js and Express', 'Work with a PostgreSQL database', 'Ship a capstone project to your portfolio'],
      skills: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js', 'PostgreSQL', 'Git'],
      eligibility: ['Basic familiarity with computers and the internet', 'Able to commit around 2–3 hours per working day', 'Access to a computer and a stable internet connection', 'Completion of a Global360 web course is recommended but not required'],
      weeklyCurriculum: weeklyCurriculum('Web Development'),
      status: 'published',
      holidays: [],
      ...common,
    },
    {
      key: 'data-running',
      title: 'Data Science Internship',
      slug: 'data-science-internship',
      track: 'Data Science',
      shortDescription: 'Analyse real datasets with Python, pandas and SQL, and communicate clear insights.',
      description:
        'A free online internship for aspiring data analysts. Each working day brings a practical task — cleaning data, exploring it, visualizing results and building simple models — reviewed by mentors who give actionable feedback. You will finish with an end-to-end capstone analysis.',
      startDate: iso(dates.running.start),
      endDate: iso(dates.running.end),
      applicationOpenAt: dates.running.start.minus({ weeks: 5 }).toUTC().toJSDate(),
      applicationCloseAt: dates.running.start.minus({ days: 3 }).toUTC().toJSDate(),
      capacity: 40,
      objectives: ['Clean and transform data with pandas', 'Explore datasets with statistics and charts', 'Query data with SQL', 'Build and evaluate a simple model', 'Present insights clearly'],
      skills: ['Python', 'pandas', 'SQL', 'Statistics', 'Visualization', 'Machine learning'],
      eligibility: ['Comfortable with basic maths', 'Able to commit around 2–3 hours per working day', 'Access to a computer and internet connection'],
      weeklyCurriculum: weeklyCurriculum('Data Science'),
      status: 'published',
      holidays: [{ date: iso(dates.running.start.plus({ weeks: 8, days: 2 })), name: 'Program break day' }],
      ...common,
    },
    {
      key: 'design-upcoming',
      title: 'UI/UX Design Internship',
      slug: 'ui-ux-design-internship',
      track: 'UI/UX Design',
      shortDescription: 'Research, wireframe, prototype and test user-centred designs with mentor feedback.',
      description:
        'A free online internship for aspiring product designers. You will practise the full design process — research, information architecture, wireframes, visual design, prototyping and usability testing — through daily tasks and weekly deliverables, ending with a portfolio case study.',
      startDate: iso(dates.design.start),
      endDate: iso(dates.design.end),
      applicationOpenAt: dates.today.minus({ days: 3 }).toUTC().toJSDate(),
      applicationCloseAt: dates.design.start.minus({ days: 3 }).endOf('day').toUTC().toJSDate(),
      capacity: 30,
      objectives: ['Plan and run lightweight user research', 'Create wireframes and user flows', 'Apply visual design principles', 'Build interactive prototypes', 'Present a portfolio-ready case study'],
      skills: ['User research', 'Wireframing', 'Visual design', 'Prototyping', 'Usability testing'],
      eligibility: ['Interest in design and problem-solving', 'Access to a free design tool such as Figma or Penpot', 'Able to commit around 2–3 hours per working day'],
      weeklyCurriculum: weeklyCurriculum('UI/UX Design'),
      status: 'published',
      holidays: [],
      ...common,
    },
    {
      key: 'web-completed',
      title: 'Web Development Internship — Previous Cohort',
      slug: 'web-development-internship-previous-cohort',
      track: 'Web Development',
      shortDescription: 'A completed cohort of the Web Development Internship (sample data).',
      description: 'A completed sample cohort used to demonstrate completion results and certificate verification.',
      startDate: iso(dates.completed.start),
      endDate: iso(dates.completed.end),
      applicationOpenAt: dates.completed.start.minus({ weeks: 5 }).toUTC().toJSDate(),
      applicationCloseAt: dates.completed.start.minus({ days: 3 }).toUTC().toJSDate(),
      capacity: 50,
      objectives: ['Build responsive web pages', 'Create React interfaces', 'Develop REST APIs'],
      skills: ['HTML', 'CSS', 'JavaScript', 'React', 'Node.js'],
      eligibility: ['Basic computer skills'],
      weeklyCurriculum: weeklyCurriculum('Web Development'),
      status: 'archived',
      holidays: [],
      ...common,
    },
  ];
}
