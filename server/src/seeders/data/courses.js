/**
 * Sample course catalogue for development and demos. Every course is flagged isSample = true
 * so the UI labels it as sample content. Video URLs (only on a few preview lessons) are public
 * freeCodeCamp YouTube videos, embedded via YouTube's player — never downloaded or rehosted.
 */
const lesson = (title, minutes, description, extra = {}) => ({ title, durationSeconds: minutes * 60, description, ...extra });

export const SAMPLE_COURSES = [
  {
    title: 'Web Development Fundamentals',
    category: 'Web Development',
    level: 'beginner',
    instructorKey: 'web',
    shortDescription: 'Learn how the web works and build responsive pages with HTML, CSS and modern JavaScript.',
    description:
      'A practical introduction to front-end web development. You will learn semantic HTML, modern CSS layout with Flexbox and Grid, responsive design and the JavaScript fundamentals needed to make pages interactive. Each module ends with a small project you can add to your portfolio.',
    outcomes: ['Write semantic, accessible HTML', 'Build responsive layouts with Flexbox and Grid', 'Use JavaScript to add interactivity', 'Publish a small portfolio site'],
    requirements: ['A computer with a modern browser', 'A free code editor such as VS Code', 'No prior programming experience needed'],
    modules: [
      {
        title: 'Getting Started',
        lessons: [
          lesson('How the web works', 8, 'Browsers, servers, HTTP and what happens when you open a web page.', { isPreview: true, videoUrl: 'https://www.youtube.com/watch?v=pQN-pnXPaVg' }),
          lesson('Setting up your tools', 10, 'Install a code editor, use browser developer tools and organize a project folder.'),
          lesson('Your first HTML page', 14, 'Document structure, headings, paragraphs, links and images.'),
        ],
      },
      {
        title: 'HTML in Depth',
        lessons: [
          lesson('Semantic elements', 12, 'Use header, nav, main, article, section and footer to describe content meaningfully.'),
          lesson('Forms and inputs', 16, 'Collect user input with accessible labels, input types and validation attributes.'),
          lesson('Accessibility basics', 11, 'Alt text, landmarks, keyboard navigation and colour contrast.'),
        ],
      },
      {
        title: 'Styling with CSS',
        lessons: [
          lesson('Selectors and the cascade', 13, 'How CSS rules are matched and which rule wins.', { isPreview: true, videoUrl: 'https://www.youtube.com/watch?v=1Rs2ND1ryYc' }),
          lesson('The box model', 10, 'Margin, border, padding and sizing elements predictably.'),
          lesson('Flexbox layouts', 18, 'Align and distribute items in one dimension.'),
          lesson('CSS Grid layouts', 18, 'Build two-dimensional page layouts.'),
          lesson('Responsive design', 15, 'Media queries, fluid units and mobile-first thinking.'),
        ],
      },
      {
        title: 'JavaScript Essentials',
        lessons: [
          lesson('Variables, types and operators', 14, 'The building blocks of every JavaScript program.'),
          lesson('Functions and scope', 15, 'Reusable logic and how variables are resolved.'),
          lesson('Working with the DOM', 17, 'Select, create and update page elements in response to events.'),
          lesson('Mini project: interactive to-do list', 25, 'Combine everything to build a small interactive application.'),
        ],
      },
    ],
  },
  {
    title: 'JavaScript for Beginners',
    category: 'Programming',
    level: 'beginner',
    instructorKey: 'web',
    shortDescription: 'Master core JavaScript concepts step by step, from variables to asynchronous code.',
    description:
      'Build a solid foundation in JavaScript, the language of the web. This course covers syntax, control flow, functions, arrays, objects, modules and asynchronous programming with promises and async/await, with exercises after every lesson.',
    outcomes: ['Understand core JavaScript syntax', 'Work confidently with arrays and objects', 'Write asynchronous code with async/await', 'Structure code with modules'],
    requirements: ['Basic computer skills', 'Curiosity and willingness to practise'],
    modules: [
      {
        title: 'Foundations',
        lessons: [
          lesson('Introduction to JavaScript', 9, 'Where JavaScript runs and how to execute your first script.', { isPreview: true, videoUrl: 'https://www.youtube.com/watch?v=PkZNo7MFNFg' }),
          lesson('Values and variables', 12, 'let, const, primitive types and type conversion.'),
          lesson('Control flow', 14, 'Conditionals, loops and logical operators.'),
        ],
      },
      {
        title: 'Working with Data',
        lessons: [
          lesson('Arrays', 15, 'Create, transform and search lists of values.'),
          lesson('Objects', 15, 'Model real-world data with key/value pairs.'),
          lesson('Array methods: map, filter, reduce', 18, 'Functional patterns for transforming data.'),
        ],
      },
      {
        title: 'Asynchronous JavaScript',
        lessons: [
          lesson('Callbacks and the event loop', 16, 'Why JavaScript is non-blocking.'),
          lesson('Promises', 14, 'Represent future values and chain operations.'),
          lesson('async/await and fetch', 17, 'Call web APIs with readable asynchronous code.'),
        ],
      },
    ],
  },
  {
    title: 'Python for Data Analysis',
    category: 'Data Science',
    level: 'beginner',
    instructorKey: 'data',
    shortDescription: 'Use Python, pandas and visualizations to clean, explore and explain real datasets.',
    description:
      'Learn Python from the ground up and apply it to data analysis. You will load datasets, clean messy data, compute summary statistics and create clear charts that answer real questions.',
    outcomes: ['Write Python scripts and notebooks', 'Clean and transform data with pandas', 'Summarize data with descriptive statistics', 'Communicate findings with charts'],
    requirements: ['No programming experience required', 'Python 3 installed (instructions included)'],
    modules: [
      {
        title: 'Python Basics',
        lessons: [
          lesson('Why Python for data?', 7, 'The Python data ecosystem and setting up notebooks.', { isPreview: true, videoUrl: 'https://www.youtube.com/watch?v=rfscVS0vtbw' }),
          lesson('Variables, lists and dictionaries', 15, 'Core data structures you will use every day.'),
          lesson('Functions and loops', 15, 'Automate repetitive work.'),
        ],
      },
      {
        title: 'Data Wrangling with pandas',
        lessons: [
          lesson('DataFrames and Series', 16, 'Load CSV files and inspect their structure.'),
          lesson('Cleaning data', 18, 'Missing values, duplicates and type conversions.'),
          lesson('Grouping and aggregation', 17, 'Answer questions with groupby and pivot tables.'),
        ],
      },
      {
        title: 'Visualization and Storytelling',
        lessons: [
          lesson('Charts with matplotlib', 15, 'Line, bar and scatter plots.'),
          lesson('Choosing the right chart', 11, 'Match chart types to the question being asked.'),
          lesson('Project: analyse a public dataset', 30, 'Take a dataset from question to presentation.'),
        ],
      },
    ],
  },
  {
    title: 'UI/UX Design Essentials',
    category: 'Design',
    level: 'beginner',
    instructorKey: 'design',
    shortDescription: 'Learn user-centred design, wireframing and prototyping to create intuitive interfaces.',
    description:
      'Discover how great digital products are designed. This course introduces user research, information architecture, wireframes, visual design principles and interactive prototypes, finishing with a usability test of your own design.',
    outcomes: ['Run lightweight user research', 'Create wireframes and user flows', 'Apply visual hierarchy, spacing and colour', 'Build and test an interactive prototype'],
    requirements: ['A free design tool account (e.g. Figma or Penpot)', 'No design experience needed'],
    modules: [
      {
        title: 'Thinking Like a Designer',
        lessons: [
          lesson('What is UX design?', 9, 'The difference between UI and UX and the design process.', { isPreview: true }),
          lesson('Understanding users', 14, 'Interviews, personas and journey maps.'),
        ],
      },
      {
        title: 'From Idea to Wireframe',
        lessons: [
          lesson('User flows', 12, 'Map how users accomplish their goals.'),
          lesson('Low-fidelity wireframes', 16, 'Sketch layouts quickly and iterate.'),
          lesson('Information architecture', 13, 'Organize content so people can find it.'),
        ],
      },
      {
        title: 'Visual Design and Prototyping',
        lessons: [
          lesson('Layout, spacing and grids', 14, 'Create balanced, consistent screens.'),
          lesson('Typography and colour', 15, 'Readable type scales and accessible palettes.'),
          lesson('Interactive prototypes', 18, 'Link screens and simulate interactions.'),
          lesson('Usability testing', 16, 'Plan a test, observe users and prioritize fixes.'),
        ],
      },
    ],
  },
  {
    title: 'Digital Marketing Foundations',
    category: 'Marketing',
    level: 'beginner',
    instructorKey: 'design',
    shortDescription: 'Plan campaigns across search, social and email, and measure what works.',
    description:
      'Understand the fundamentals of digital marketing: audiences, content, search engine optimization, social media, email marketing and analytics. You will finish by drafting a simple campaign plan with measurable goals.',
    outcomes: ['Define audiences and goals', 'Understand SEO fundamentals', 'Plan social and email content', 'Track results with key metrics'],
    requirements: ['No prior marketing knowledge needed'],
    modules: [
      {
        title: 'Marketing Fundamentals',
        lessons: [
          lesson('The digital marketing landscape', 10, 'Channels, funnels and customer journeys.', { isPreview: true }),
          lesson('Audiences and positioning', 13, 'Who you serve and why they should care.'),
        ],
      },
      {
        title: 'Channels',
        lessons: [
          lesson('Search engine optimization', 17, 'How search works and on-page best practices.'),
          lesson('Social media strategy', 15, 'Choosing platforms and planning content.'),
          lesson('Email marketing', 14, 'Building lists ethically and writing effective emails.'),
        ],
      },
      {
        title: 'Measuring Results',
        lessons: [
          lesson('Key metrics and analytics', 15, 'Traffic, conversion and retention metrics.'),
          lesson('Project: a simple campaign plan', 25, 'Bring channels and metrics together in one plan.'),
        ],
      },
    ],
  },
  {
    title: 'Node.js & Express API Development',
    category: 'Web Development',
    level: 'intermediate',
    instructorKey: 'web',
    shortDescription: 'Build secure REST APIs with Node.js, Express and PostgreSQL.',
    description:
      'Go beyond the browser and build back-end services. Learn Node.js modules, Express routing and middleware, input validation, authentication, database access with an ORM, testing and deployment practices.',
    outcomes: ['Design RESTful endpoints', 'Validate input and handle errors centrally', 'Persist data in PostgreSQL', 'Secure APIs with authentication and authorization', 'Write automated API tests'],
    requirements: ['Comfortable with JavaScript fundamentals', 'Basic command-line usage'],
    modules: [
      {
        title: 'Node.js Basics',
        lessons: [
          lesson('The Node.js runtime', 10, 'Modules, npm and the event loop on the server.', { isPreview: true }),
          lesson('Your first HTTP server', 13, 'Handle requests and responses.'),
        ],
      },
      {
        title: 'Express in Practice',
        lessons: [
          lesson('Routing and controllers', 15, 'Organize endpoints cleanly.'),
          lesson('Middleware and validation', 17, 'Reusable request processing and schema validation.'),
          lesson('Error handling', 12, 'Consistent JSON errors and status codes.'),
        ],
      },
      {
        title: 'Data and Security',
        lessons: [
          lesson('PostgreSQL with an ORM', 20, 'Models, migrations and relationships.'),
          lesson('Authentication with cookies and JWT', 19, 'Sessions, hashing and secure cookies.'),
          lesson('Testing APIs', 16, 'Automated tests with a separate test database.'),
        ],
      },
    ],
  },
  {
    title: 'SQL & Databases for Beginners',
    category: 'Data Science',
    level: 'beginner',
    instructorKey: 'data',
    shortDescription: 'Query, join and model relational data with SQL.',
    description:
      'Relational databases power most applications. Learn to write SQL queries, filter and sort results, join tables, aggregate data and design simple schemas with keys and constraints.',
    outcomes: ['Write SELECT queries with filters and sorting', 'Join related tables', 'Aggregate data with GROUP BY', 'Design tables with keys and constraints'],
    requirements: ['No prior database experience needed'],
    modules: [
      {
        title: 'Querying Data',
        lessons: [
          lesson('Relational databases explained', 9, 'Tables, rows, columns and keys.', { isPreview: true }),
          lesson('SELECT, WHERE and ORDER BY', 15, 'Retrieve exactly the rows you need.'),
          lesson('Aggregations', 14, 'COUNT, SUM, AVG and GROUP BY.'),
        ],
      },
      {
        title: 'Relationships and Design',
        lessons: [
          lesson('Joining tables', 17, 'INNER and LEFT joins in practice.'),
          lesson('Designing a schema', 16, 'Normalization, primary keys and foreign keys.'),
          lesson('Indexes and performance basics', 13, 'Why some queries are fast and others slow.'),
        ],
      },
    ],
  },
  {
    title: 'Advanced React Patterns',
    category: 'Web Development',
    level: 'advanced',
    instructorKey: 'web',
    shortDescription: 'Compose scalable React applications with hooks, context and performance techniques.',
    description:
      'For developers who already know React basics. Explore custom hooks, context architecture, compound components, data fetching strategies, code splitting and performance profiling to build maintainable, fast interfaces.',
    outcomes: ['Design reusable custom hooks', 'Structure state with context and reducers', 'Build flexible compound components', 'Profile and optimize rendering'],
    requirements: ['Working knowledge of React and modern JavaScript'],
    modules: [
      {
        title: 'Hooks in Depth',
        lessons: [
          lesson('Rules and mental model of hooks', 12, 'How React tracks state between renders.', { isPreview: true }),
          lesson('Writing custom hooks', 16, 'Extract and share stateful logic.'),
        ],
      },
      {
        title: 'Component Architecture',
        lessons: [
          lesson('Context and reducers', 17, 'Manage shared state predictably.'),
          lesson('Compound components', 15, 'Flexible APIs for complex UI.'),
        ],
      },
      {
        title: 'Performance',
        lessons: [
          lesson('Memoization trade-offs', 14, 'When memo, useMemo and useCallback help.'),
          lesson('Code splitting and lazy loading', 13, 'Ship less JavaScript up front.'),
        ],
      },
    ],
  },
];
