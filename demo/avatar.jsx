// avatar.jsx — Sakina avatar v3 (DAIR emotion set)
// Emotions: sadness · joy · love · anger · fear · surprise

const { useMemo: useMemoA, useState: useStateA, useEffect: useEffectA } = React;

// ── SIZE PRESETS ──
const SIZE_PRESETS = {
  sm:   { px: 56,  ring: 3, glow: 10, ringGap: 3 },
  md:   { px: 120, ring: 5, glow: 20, ringGap: 4 },
  lg:   { px: 160, ring: 6, glow: 28, ringGap: 5 },
  hero: { px: 220, ring: 8, glow: 36, ringGap: 6 },
};

// ── EXPRESSION MAP (used by orb/glyph variants) ──
const EXPRESSIONS = {
  sadness:  { eyes: 'squint',  mouth: 'concerned', brow: 'down' },
  joy:      { eyes: 'happy',   mouth: 'smile',     brow: 'lift' },
  love:     { eyes: 'happy',   mouth: 'smile',     brow: 'lift' },
  anger:    { eyes: 'default', mouth: 'serious',   brow: 'pinch' },
  fear:     { eyes: 'side',    mouth: 'concerned', brow: 'lift' },
  surprise: { eyes: 'wide',    mouth: 'o',         brow: 'lift' },
};

const SR_LABELS = {
  sadness:  'Sakina, gentle and quiet',
  joy:      'Sakina, warm',
  love:     'Sakina, warm and present',
  anger:    'Sakina, focused',
  fear:     'Sakina, attentive',
  surprise: 'Sakina, attentive',
};

// ── CHARACTER FACE (DiceBear micah asset) ──
const AVATAR_SRC = {
  sadness:  'assets/avatars/sakina_sadness.svg',
  joy:      'assets/avatars/sakina_joy.svg',
  love:     'assets/avatars/sakina_love.svg',
  anger:    'assets/avatars/sakina_anger.svg',
  fear:     'assets/avatars/sakina_fear.svg',
  surprise: 'assets/avatars/sakina_surprise.svg',
};

function CharacterFace({ emotion = 'joy', size = 120 }) {
  const src = AVATAR_SRC[emotion] || AVATAR_SRC.joy;
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
function OrbFace({ emotion = 'joy', size = 120 }) {
  const color = EMOTION_COLORS[emotion] || EMOTION_COLORS.joy;
  const expr = EXPRESSIONS[emotion] || EXPRESSIONS.joy;
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
      {expr.mouth === 'o' && <ellipse cx="50" cy="62" rx="3" ry="4" fill="rgba(255,255,255,0.85)" />}
      {expr.mouth === 'default' && <path d="M 41 60 q 9 2 18 0" stroke="rgba(255,255,255,0.6)" strokeWidth="1.7" fill="none" strokeLinecap="round" />}
      {expr.eyes === 'wide' ? (
        <>
          <circle cx="40" cy="46" r="3.2" fill="rgba(255,255,255,0.92)" />
          <circle cx="60" cy="46" r="3.2" fill="rgba(255,255,255,0.92)" />
        </>
      ) : (
        <>
          <circle cx="40" cy="46" r="2.1" fill="rgba(255,255,255,0.92)" />
          <circle cx="60" cy="46" r="2.1" fill="rgba(255,255,255,0.92)" />
        </>
      )}
    </svg>
  );
}

// ── GLYPH FACE ──
function GlyphFace({ emotion = 'joy', size = 120 }) {
  const color = EMOTION_COLORS[emotion] || EMOTION_COLORS.joy;
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
function SakinaAvatar({
  emotion = 'joy',
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
  const color = EMOTION_COLORS[emotion] || EMOTION_COLORS.joy;
  const Face = style === 'orb' ? OrbFace : style === 'glyph' ? GlyphFace : CharacterFace;

  const inset = preset.ring + preset.ringGap;
  const faceSize = px - inset * 2;

  // Fear keeps the subtle tremor (the old "anxious" behavior). All others: normal 4s breath.
  const breatheClass = breathe ? (
    emotion === 'fear' ? 'avatar-breathe anxious' :
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
      {isSpeaking && <span className="sakina-av-ping" aria-hidden />}
      <span className="sakina-av-glow" aria-hidden />
      {ring && <span className="sakina-av-ring" aria-hidden />}
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
  const [fade, setFade] = useStateA('in');
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

const Avatar = SakinaAvatar;

Object.assign(window, { SakinaAvatar, Avatar, EXPRESSIONS, SR_LABELS, SIZE_PRESETS, AVATAR_SRC });
