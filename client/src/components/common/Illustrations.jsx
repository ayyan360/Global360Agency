/**
 * Original Global360 SVG illustrations (flat, violet palette) — no third-party image assets.
 * All are decorative: aria-hidden, with surrounding text carrying the meaning.
 */
const V = {
  primary: '#6C2BEB',
  deep: '#4B17B5',
  mid: '#8B5CF6',
  soft: '#B9A0FA',
  pale: '#DDCDFD',
  tint: '#F1EAFF',
  ink: '#241A3D',
  skin: '#E8B08C',
  skinShade: '#D2936F',
  hair: '#231933',
  white: '#FFFFFF',
  laptop: '#E9E3F7',
  laptopShade: '#D4C9EE',
};

function Sparkle({ x, y, s = 1, fill = V.soft }) {
  return <path transform={`translate(${x} ${y}) scale(${s})`} d="M0-10 C1.6-3 3-1.6 10 0 3 1.6 1.6 3 0 10-1.6 3-3 1.6-10 0-3-1.6-1.6-3 0-10Z" fill={fill} />;
}

function FloatCard({ x, y, w = 46, h = 46, children, rotate = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
      <rect x="2" y="5" width={w} height={h} rx="11" fill={V.primary} opacity="0.12" />
      <rect width={w} height={h} rx="11" fill={V.white} stroke={V.pale} />
      {children}
    </g>
  );
}

function Plant({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 C-22-18-26-52-14-74 C-2-52 2-26 0 0Z" fill={V.soft} />
      <path d="M0 0 C16-22 34-40 52-44 C44-24 26-6 0 0Z" fill={V.mid} />
      <path d="M0 0 C-14-12-40-20-56-16 C-44-2-22 4 0 0Z" fill={V.pale} />
      <path d="M0 0 C4-26 14-50 30-66 C28-38 18-16 0 0Z" fill={V.primary} opacity="0.85" />
      <path d="M-20 0 h40 l-6 34 a6 6 0 0 1 -6 5 h-16 a6 6 0 0 1 -6 -5Z" fill={V.primary} />
      <rect x="-22" y="-4" width="44" height="8" rx="4" fill={V.deep} />
    </g>
  );
}

/** Front-facing learner at a laptop (homepage / internship hero). */
export function LearnerIllustration({ className = '', headphones = true, badge = 'check' }) {
  return (
    <svg viewBox="0 0 520 420" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="g360-blob" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F3ECFF" />
          <stop offset="1" stopColor="#E7DBFF" />
        </linearGradient>
      </defs>
      <path d="M96 236 C70 140 160 54 268 58 C380 62 470 128 452 236 C436 330 352 378 254 376 C152 374 118 320 96 236Z" fill="url(#g360-blob)" />
      <circle cx="430" cy="92" r="9" fill={V.pale} />
      <circle cx="84" cy="300" r="6" fill={V.pale} />
      <Sparkle x={118} y={112} s={1.1} />
      <Sparkle x={440} y={300} s={0.8} fill={V.pale} />
      <Sparkle x={378} y={52} s={0.7} />

      {/* Person */}
      <g>
        <path d="M150 382 C150 300 186 262 260 262 C334 262 370 300 370 382Z" fill={V.primary} />
        <path d="M216 268 C228 296 292 296 304 268 C292 262 228 262 216 268Z" fill={V.deep} opacity="0.55" />
        <path d="M226 266 l8 34 M294 266 l-8 34" stroke={V.white} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
        <rect x="244" y="226" width="32" height="44" rx="12" fill={V.skinShade} />
        <ellipse cx="260" cy="186" rx="44" ry="50" fill={V.skin} />
        <ellipse cx="216" cy="192" rx="9" ry="13" fill={V.skin} />
        <ellipse cx="304" cy="192" rx="9" ry="13" fill={V.skin} />
        <path d="M214 178 C206 120 248 112 266 116 C300 110 324 140 306 182 C302 160 290 148 272 150 C252 160 232 152 222 140 C222 158 220 168 214 178Z" fill={V.hair} />
        <path d="M244 196 q4 -4 8 0 M268 196 q4 -4 8 0" stroke={V.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M250 214 q10 8 20 0" stroke={V.skinShade} strokeWidth="3" fill="none" strokeLinecap="round" />
        {headphones && (
          <g>
            <path d="M206 186 C204 130 316 130 314 186" fill="none" stroke={V.ink} strokeWidth="8" strokeLinecap="round" />
            <rect x="196" y="172" width="20" height="36" rx="10" fill={V.mid} />
            <rect x="304" y="172" width="20" height="36" rx="10" fill={V.mid} />
          </g>
        )}
        {/* Arms */}
        <path d="M172 320 C176 296 196 290 206 300 L240 336 C246 344 240 356 228 356 L186 356 C174 352 168 336 172 320Z" fill={V.primary} />
        <path d="M348 320 C344 296 324 290 314 300 L280 336 C274 344 280 356 292 356 L334 356 C346 352 352 336 348 320Z" fill={V.primary} />
        <ellipse cx="236" cy="348" rx="14" ry="9" fill={V.skin} />
        <ellipse cx="284" cy="348" rx="14" ry="9" fill={V.skin} />
      </g>

      {/* Laptop */}
      <path d="M178 286 h164 a10 10 0 0 1 10 10 v70 h-184 v-70 a10 10 0 0 1 10-10Z" fill={V.laptop} />
      <path d="M178 286 h164 a10 10 0 0 1 10 10 v8 h-184 v-8 a10 10 0 0 1 10-10Z" fill={V.white} opacity="0.6" />
      <circle cx="260" cy="324" r="9" fill={V.white} />
      <circle cx="260" cy="324" r="5" fill={V.soft} />
      <rect x="120" y="364" width="290" height="14" rx="7" fill={V.pale} />

      <Plant x={418} y={364} s={0.95} />

      {/* Floating UI cards */}
      <FloatCard x={92} y={168} rotate={-6}>
        {badge === 'check' ? (
          <path d="M14 24 l7 7 l13 -14" stroke={V.primary} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M18 14 v18 l14 -9Z" fill={V.primary} />
        )}
      </FloatCard>
      <FloatCard x={372} y={140} w={58} h={50} rotate={5}>
        <rect x="11" y="30" width="7" height="10" rx="2" fill={V.soft} />
        <rect x="22" y="22" width="7" height="18" rx="2" fill={V.mid} />
        <rect x="33" y="14" width="7" height="26" rx="2" fill={V.primary} />
      </FloatCard>
      <FloatCard x={336} y={66} w={42} h={42} rotate={-4}>
        <path d="M21 11 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1Z" fill={V.primary} />
      </FloatCard>
    </svg>
  );
}

/** Learner seated with a laptop on their lap (auth / application panels). */
export function SeatedLearnerIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 420 420" className={className} aria-hidden="true" focusable="false">
      <circle cx="210" cy="220" r="160" fill={V.tint} />
      <Sparkle x={70} y={120} s={1} />
      <Sparkle x={352} y={96} s={0.8} fill={V.pale} />
      <Sparkle x={340} y={300} s={0.7} />
      <circle cx="96" cy="300" r="7" fill={V.pale} />
      {/* floor shadow */}
      <ellipse cx="210" cy="372" rx="130" ry="14" fill={V.pale} opacity="0.7" />
      {/* legs */}
      <path d="M118 360 C120 318 168 300 214 318 L232 330 C218 352 172 364 118 360Z" fill={V.ink} />
      <path d="M302 360 C300 318 252 300 206 318 L188 330 C202 352 248 364 302 360Z" fill="#2E2350" />
      <ellipse cx="114" cy="358" rx="18" ry="9" fill={V.white} stroke={V.pale} />
      <ellipse cx="306" cy="358" rx="18" ry="9" fill={V.white} stroke={V.pale} />
      {/* torso */}
      <path d="M150 324 C146 252 172 214 210 214 C248 214 274 252 270 324Z" fill={V.primary} />
      <rect x="196" y="186" width="28" height="36" rx="11" fill={V.skinShade} />
      <ellipse cx="210" cy="150" rx="40" ry="46" fill={V.skin} />
      <ellipse cx="171" cy="156" rx="8" ry="12" fill={V.skin} />
      <ellipse cx="249" cy="156" rx="8" ry="12" fill={V.skin} />
      <path d="M170 146 C162 92 202 84 218 88 C252 82 272 112 254 148 C250 128 238 118 222 120 C204 128 186 122 176 110 C176 126 174 136 170 146Z" fill={V.hair} />
      <path d="M196 162 q4 -4 8 0 M218 162 q4 -4 8 0" stroke={V.ink} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M201 178 q9 7 18 0" stroke={V.skinShade} strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* laptop */}
      <path d="M142 270 l118 -14 a8 8 0 0 1 9 7 l8 62 a8 8 0 0 1 -7 9 l-118 14Z" fill={V.laptop} />
      <circle cx="210" cy="296" r="7" fill={V.white} />
      <path d="M128 336 l176 -18 a6 6 0 0 1 6 6 a6 6 0 0 1 -5 6 l-176 18Z" fill={V.laptopShade} />
      {/* arms */}
      <path d="M156 252 C140 270 140 300 160 314 L180 318 C186 300 176 284 172 262Z" fill={V.primary} />
      <path d="M264 252 C280 270 282 300 262 316 L244 320 C238 300 248 284 250 262Z" fill={V.primary} />
      <ellipse cx="184" cy="318" rx="12" ry="8" fill={V.skin} />
      <ellipse cx="240" cy="318" rx="12" ry="8" fill={V.skin} />
      <Plant x={340} y={366} s={0.75} />
      <FloatCard x={300} y={170} w={44} h={44} rotate={6}>
        <path d="M13 22 l6 6 l12 -12" stroke={V.primary} strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </FloatCard>
      <FloatCard x={70} y={196} w={48} h={42} rotate={-6}>
        <rect x="10" y="12" width="28" height="4" rx="2" fill={V.soft} />
        <rect x="10" y="20" width="20" height="4" rx="2" fill={V.pale} />
        <rect x="10" y="28" width="24" height="4" rx="2" fill={V.primary} />
      </FloatCard>
    </svg>
  );
}

/** Graduation cap on books (course catalogue header). */
export function GraduationIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 240 160" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="124" cy="140" rx="96" ry="10" fill={V.pale} opacity="0.7" />
      <rect x="54" y="112" width="140" height="22" rx="5" fill={V.primary} />
      <rect x="60" y="116" width="128" height="6" rx="3" fill={V.white} opacity="0.5" />
      <rect x="66" y="90" width="124" height="22" rx="5" fill={V.soft} />
      <rect x="72" y="95" width="112" height="6" rx="3" fill={V.white} opacity="0.6" />
      <rect x="58" y="70" width="128" height="20" rx="5" fill={V.mid} />
      <path d="M122 14 L196 42 L122 70 L48 42Z" fill={V.ink} />
      <path d="M86 56 v18 c0 10 72 10 72 0 v-18 l-36 14Z" fill="#2E2350" />
      <path d="M190 44 v34" stroke={V.primary} strokeWidth="3" />
      <circle cx="190" cy="82" r="6" fill={V.primary} />
      <Sparkle x={30} y={30} s={0.8} />
      <Sparkle x={222} y={20} s={0.6} fill={V.pale} />
    </svg>
  );
}

/** Envelope with paper plane (contact page). */
export function EnvelopeIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 260 220" className={className} aria-hidden="true" focusable="false">
      <circle cx="130" cy="120" r="92" fill={V.tint} />
      <rect x="56" y="88" width="148" height="100" rx="12" fill={V.white} stroke={V.pale} strokeWidth="2" />
      <path d="M58 94 L130 148 L202 94" fill="none" stroke={V.soft} strokeWidth="3" />
      <path d="M56 100 L130 152 L204 100 V176 a12 12 0 0 1 -12 12 H68 a12 12 0 0 1 -12 -12Z" fill={V.primary} opacity="0.9" />
      <path d="M56 188 L118 140 M204 188 L142 140" stroke={V.deep} strokeWidth="3" />
      <path d="M150 52 L226 26 L196 96 L182 72Z" fill={V.mid} />
      <path d="M182 72 L226 26 L172 66Z" fill={V.primary} />
      <path d="M118 66 C130 58 142 58 150 62" stroke={V.soft} strokeWidth="3" fill="none" strokeDasharray="4 6" strokeLinecap="round" />
      <Sparkle x={42} y={60} s={0.8} />
      <Sparkle x={230} y={150} s={0.6} fill={V.pale} />
    </svg>
  );
}

/** Three learners (about page). */
export function TeamIllustration({ className = '' }) {
  const person = (x, shirt, hair, s = 1) => (
    <g transform={`translate(${x} 0) scale(${s})`}>
      <path d="M-46 220 C-46 168 -26 148 0 148 C26 148 46 168 46 220Z" fill={shirt} />
      <rect x="-11" y="122" width="22" height="30" rx="9" fill={V.skinShade} />
      <ellipse cx="0" cy="100" rx="30" ry="34" fill={V.skin} />
      <path d={hair} fill={V.hair} />
      <path d="M-12 104 q3 -3 6 0 M6 104 q3 -3 6 0" stroke={V.ink} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M-7 116 q7 6 14 0" stroke={V.skinShade} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </g>
  );
  return (
    <svg viewBox="0 0 360 240" className={className} aria-hidden="true" focusable="false">
      <path d="M30 160 C20 90 90 30 180 34 C280 38 344 92 332 160 C322 220 260 236 180 236 C96 236 40 220 30 160Z" fill={V.tint} />
      <Sparkle x={52} y={52} s={0.9} />
      <Sparkle x={318} y={48} s={0.7} fill={V.pale} />
      {person(96, V.mid, 'M-31 96 C-36 58 -6 52 6 56 C30 52 40 76 30 98 C28 82 18 74 6 76 C-8 82 -20 78 -26 70 C-26 82 -28 90 -31 96Z', 0.9)}
      {person(264, V.soft, 'M-32 100 C-40 60 -10 46 6 52 C34 48 44 80 32 102 C34 120 30 136 22 140 C26 112 20 90 2 80 C-12 84 -22 90 -26 96 C-24 116 -26 130 -32 140Z', 0.9)}
      {person(180, V.primary, 'M-30 98 C-36 56 -4 50 8 54 C34 50 42 78 30 100 C26 80 16 72 4 74 C-10 80 -22 76 -26 68 C-26 82 -28 90 -30 98Z', 1)}
      <rect x="138" y="196" width="84" height="40" rx="6" fill={V.laptop} />
      <circle cx="180" cy="216" r="6" fill={V.white} />
    </svg>
  );
}

/** Certificate document with ribbon. */
export function CertificateIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 220 170" className={className} aria-hidden="true" focusable="false">
      <ellipse cx="110" cy="156" rx="84" ry="8" fill={V.pale} opacity="0.7" />
      <rect x="28" y="20" width="164" height="124" rx="10" fill={V.white} stroke={V.pale} strokeWidth="2" />
      <rect x="38" y="30" width="144" height="104" rx="6" fill="none" stroke={V.primary} strokeWidth="2" />
      <rect x="68" y="48" width="84" height="8" rx="4" fill={V.ink} />
      <rect x="80" y="64" width="60" height="6" rx="3" fill={V.soft} />
      <rect x="58" y="82" width="104" height="5" rx="2.5" fill={V.pale} />
      <rect x="66" y="94" width="88" height="5" rx="2.5" fill={V.pale} />
      <circle cx="160" cy="120" r="16" fill={V.primary} />
      <path d="M152 132 l-6 22 l10 -6 l6 10 l4 -22Z" fill={V.mid} />
      <path d="M154 120 l5 5 l9 -10" stroke={V.white} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/** Small "promo" person used in dashboard motivation cards. */
export function DeskMiniIllustration({ className = '' }) {
  return <LearnerIllustration className={className} headphones={false} badge="play" />;
}
