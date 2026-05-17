// avatar.jsx — Sakina avatar v2
// Hand-drawn SVG, emotion-reactive ring/face/motion, sm/md/lg/hero sizes.
// Three style variants: character (default), orb, glyph.

const { useMemo: useMemoA, useState: useStateA, useEffect: useEffectA } = React;

// ── SIZE PRESETS ──
const SIZE_PRESETS = {
  sm:   { px: 56,  ring: 3, glow: 10, ringGap: 3 },
  md:   { px: 120, ring: 5, glow: 20, ringGap: 4 },
  lg:   { px: 160, ring: 6, glow: 28, ringGap: 5 },
  hero: { px: 220, ring: 8, glow: 36, ringGap: 6 },
};

// ── EXPRESSION MAP ──
const EXPRESSIONS = {
  neutral: { eyes: 'default', mouth: 'default',   brow: 'rest' },
  sad:     { eyes: 'squint',  mouth: 'concerned', brow: 'down' },
  anxious: { eyes: 'side',    mouth: 'concerned', brow: 'lift' },
  angry:   { eyes: 'default', mouth: 'serious',   brow: 'pinch' },
  happy:   { eyes: 'happy',   mouth: 'smile',     brow: 'lift' },
  crisis:  { eyes: 'default', mouth: 'concerned', brow: 'down' },
};

const SR_LABELS = {
  neutral: 'Sakina, calm',
  sad: 'Sakina, gentle and quiet',
  anxious: 'Sakina, attentive',
  angry: 'Sakina, focused',
  happy: 'Sakina, warm',
  crisis: 'Sakina, here with you',
};

// ── CHARACTER FACE (real DiceBear micah asset) ──
const AVATAR_SRC = {
  neutral: 'assets/avatars/sakina_neutral.svg',
  sad:     'assets/avatars/sakina_sad.svg',
  anxious: 'assets/avatars/sakina_anxious.svg',
  angry:   'assets/avatars/sakina_angry.svg',
  happy:   'assets/avatars/sakina_happy.svg',
  crisis:  'assets/avatars/sakina_crisis.svg',
};

function CharacterFace({ emotion = 'neutral', size = 120 }) {
  const src = AVATAR_SRC[emotion] || AVATAR_SRC.neutral;
  // Slightly inset so the head fills the ring nicely (the SVG has padding inside its 360 box)
  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      draggable={false}
      style={{
        width: size,
        height: size,
        display: 'block',
        borderRadius: '50%',
        background: '#F0E6D2',
        userSelect: 'none',
      }}
    />
  );
}

// ── ORB FACE ──
function OrbFace({ emotion = 'neutral', size = 120 }) {
  const color = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;
  const expr = EXPRESSIONS[emotion];
  const gid = `orb-${emotion}-${size}-${Math.random().toString(36).slice(2,6)}`;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <defs>
        <radialGradient id={gid} cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.7" />
          <stop offset="45%" stopColor={color} stopOpacity="0.92" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#${gid})`} />
      {expr.mouth === 'smile' && <path d="M 38 60 q 12 9 24 0" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      {expr.mouth === 'concerned' && <path d="M 40 62 q 10 -3 20 0" stroke="rgba(255,255,255,0.8)" strokeWidth="2" fill="none" strokeLinecap="round" />}
      {expr.mouth === 'serious' && <path d="M 40 61 L 60 61" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" />}
      {expr.mouth === 'default' && <path d="M 41 60 q 9 2 18 0" stroke="rgba(255,255,255,0.6)" strokeWidth="1.7" fill="none" strokeLinecap="round" />}
      <circle cx="40" cy="46" r="2.1" fill="rgba(255,255,255,0.92)" />
      <circle cx="60" cy="46" r="2.1" fill="rgba(255,255,255,0.92)" />
    </svg>
  );
}

// ── GLYPH FACE ──
function GlyphFace({ emotion = 'neutral', size = 120 }) {
  const color = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;
  return (
    <svg viewBox="0 0 100 100" width={size} height={size}>
      <circle cx="50" cy="50" r="46" fill="#F0E6D2" />
      <path d="M 28 66 Q 50 28 72 66" stroke={color} strokeWidth="3.8" fill="none" strokeLinecap="round" />
      <path d="M 35 62 Q 50 40 65 62" stroke={color} strokeWidth="3.2" fill="none" strokeLinecap="round" opacity="0.55" />
      <path d="M 42 60 Q 50 50 58 60" stroke={color} strokeWidth="2.6" fill="none" strokeLinecap="round" opacity="0.3" />
      <circle cx="50" cy="70" r="2.8" fill={color} />
    </svg>
  );
}

// ── PUBLIC: SakinaAvatar ──
// Props:
//   emotion: Emotion
//   size: 'sm'|'md'|'lg'|'hero' OR a number (px)
//   isSpeaking: bool — adds outer sonar ping
//   onClick: optional
//   label: aria-label override
//   style: 'character'|'orb'|'glyph'
//   ring: bool (default true)
//   breathe: bool (default true)
function SakinaAvatar({
  emotion = 'neutral',
  size = 'md',
  isSpeaking = false,
  label,
  onClick,
  style = 'character',
  ring = true,
  breathe = true,
}) {
  const preset = typeof size === 'string'
    ? (SIZE_PRESETS[size] || SIZE_PRESETS.md)
    : { px: size, ring: Math.max(2, Math.round(size / 30)), glow: Math.round(size / 6), ringGap: Math.max(2, Math.round(size / 30)) };

  const px = preset.px;
  const color = EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral;
  const Face = style === 'orb' ? OrbFace : style === 'glyph' ? GlyphFace : CharacterFace;

  // Inner face inset so it sits inside the ring + gap
  const inset = preset.ring + preset.ringGap;
  const faceSize = px - inset * 2;

  // Crisis: slower breath (6s). Anxious: tremor.
  const breatheClass = breathe ? (
    emotion === 'crisis' ? 'avatar-breathe slow' :
    emotion === 'anxious' ? 'avatar-breathe anxious' :
    'avatar-breathe'
  ) : '';

  const wrapStyle = {
    width: px,
    height: px,
    '--emo': color,
    '--glow': preset.glow + 'px',
    '--ring': preset.ring + 'px',
  };

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      className={`sakina-av${onClick ? ' clickable' : ''}`}
      style={wrapStyle}
      onClick={onClick}
      role="img"
      aria-label={label || SR_LABELS[emotion] || 'Sakina'}
    >
      <span className="sr-only">{SR_LABELS[emotion] || 'Sakina'}</span>
      {/* Sonar speaking ping */}
      {isSpeaking && <span className="sakina-av-ping" aria-hidden />}
      {/* Outer glow */}
      <span className="sakina-av-glow" aria-hidden />
      {/* Ring */}
      {ring && <span className="sakina-av-ring" aria-hidden />}
      {/* Face with breathing + face crossfade */}
      <span className={`sakina-av-face ${breatheClass}`} aria-hidden>
        <FaceCrossfade keyId={emotion} duration={200}>
          <Face emotion={emotion} size={faceSize} />
        </FaceCrossfade>
      </span>
    </Tag>
  );
}

// Soft opacity crossfade when emotion changes
function FaceCrossfade({ keyId, duration, children }) {
  const [shown, setShown] = useStateA(children);
  const [fade, setFade] = useStateA('in'); // in | out
  const lastKey = React.useRef(keyId);
  useEffectA(() => {
    if (lastKey.current === keyId) return;
    setFade('out');
    const t1 = setTimeout(() => {
      setShown(children);
      setFade('in');
      lastKey.current = keyId;
    }, duration);
    return () => clearTimeout(t1);
  }, [keyId, children, duration]);
  return (
    <span className={`sakina-fade ${fade}`} style={{ transitionDuration: duration + 'ms' }}>
      {shown}
    </span>
  );
}

// Back-compat alias used elsewhere
const Avatar = SakinaAvatar;

Object.assign(window, { SakinaAvatar, Avatar, EXPRESSIONS, SR_LABELS, SIZE_PRESETS });
