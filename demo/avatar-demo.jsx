// avatar-demo.jsx — standalone demo for the SakinaAvatar component
// DAIR emotion set: sadness · joy · love · anger · fear · surprise

const { useState: useSD } = React;

const ALL_EMOTIONS = ['sadness', 'joy', 'love', 'anger', 'fear', 'surprise'];
const EMO_LABEL_EN = {
  sadness: 'Sadness', joy: 'Joy', love: 'Love',
  anger: 'Anger', fear: 'Fear', surprise: 'Surprise',
};
const EMO_NOTE = {
  sadness:  'Cooler, comforting',
  joy:      'Sunlit, gentle',
  love:     'Warm, present',
  anger:    'Warm, not alarm',
  fear:     'Softens anxiety',
  surprise: 'Gentle wonder',
};

function AvatarDemo() {
  const [emotion, setEmotion] = useSD('joy');
  const [isSpeaking, setIsSpeaking] = useSD(false);
  const color = EMOTION_COLORS[emotion];

  return (
    <main className="av-demo" style={{ '--emo': color }}>
      <div>
        <h1>Sakina · emotion-reactive presence</h1>
        <div className="lede">DAIR emotion set · 600ms color crossfade · 200ms face crossfade</div>
      </div>

      {/* HERO at md (120px) — the default chat presence size */}
      <div className="hero-stage">
        <SakinaAvatar
          emotion={emotion}
          size="md"
          isSpeaking={isSpeaking}
        />
        <div className="hero-emo">
          <span className="swatch" />
          <span>{SR_LABELS[emotion]}</span>
        </div>
      </div>

      {/* Emotion pills */}
      <div className="pill-row" role="radiogroup" aria-label="Emotion">
        {ALL_EMOTIONS.map(e => (
          <button
            key={e}
            className={`emo-pill ${emotion === e ? 'on' : ''}`}
            style={{ '--emo': EMOTION_COLORS[e] }}
            onClick={() => setEmotion(e)}
            role="radio"
            aria-checked={emotion === e}
          >
            <span className="pill-dot" style={{ '--c': EMOTION_COLORS[e] }} />
            <span>{EMO_LABEL_EN[e]}</span>
          </button>
        ))}
      </div>

      {/* Size grid: sm, md, lg, hero */}
      <div className="size-grid">
        {[
          { size: 'sm',   label: 'sm',   px: 56,  use: 'Header / compact' },
          { size: 'md',   label: 'md',   px: 120, use: 'Chat default' },
          { size: 'lg',   label: 'lg',   px: 160, use: 'Onboarding' },
          { size: 'hero', label: 'hero', px: 220, use: 'Focus moment' },
        ].map(({ size, label, px, use }) => (
          <div key={size} className="size-cell">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
              <SakinaAvatar emotion={emotion} size={size} isSpeaking={isSpeaking} />
            </div>
            <div className="size-meta">
              <b>{label} · {px}px</b>
              <span>{use}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Speaking toggle */}
      <button
        className={`speak-toggle ${isSpeaking ? 'on' : ''}`}
        onClick={() => setIsSpeaking(v => !v)}
        aria-pressed={isSpeaking}
      >
        <span className="switch-mini" />
        <span>Simulate speaking — adds sonar-ping outer ring</span>
      </button>

      {/* Spec callouts */}
      <div className="spec-grid">
        <div className="spec-card">
          <b>The Ring</b>
          <p>4–8px circular ring around the avatar in the emotion's color. Strongest emotion signal — users read it first.</p>
        </div>
        <div className="spec-card">
          <b>Breathing</b>
          <p>Gentle 1.0 ↔ 1.03 scale, 4s cycle, infinite. Pauses on hover so the user can examine the face.</p>
        </div>
        <div className="spec-card">
          <b>Fear tremor</b>
          <p>±1px horizontal jitter only on fear. Sakina embodies a hint of the user's anxiety to acknowledge it.</p>
        </div>
        <div className="spec-card">
          <b>No alarm hues</b>
          <p>Every color is calm. No red, no neon. A mental-health product must visually settle, not panic.</p>
        </div>
        <div className="spec-card">
          <b>Sage clothing always</b>
          <p>The blazer stays #5C8374 across every emotion. Only the ring shifts. Identity remains stable.</p>
        </div>
        <div className="spec-card">
          <b>Reduced motion</b>
          <p>Breathing and tremor disabled when <code>prefers-reduced-motion</code> is set. Color crossfade is preserved.</p>
        </div>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AvatarDemo />);
