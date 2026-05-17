// app.jsx — Main app with Tweaks panel, EN+AR panes

const { useState: useS, useEffect: useE } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "emotion": "neutral",
  "view": "split",
  "theme": "cream",
  "density": "default",
  "bubbleStyle": "rounded",
  "avatarStyle": "character",
  "showCrisis": false,
  "showJournal": false,
  "onboarding": false
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Shared emotion state (driven by tweak override or by send-detection in either pane)
  const [emotion, setEmotion] = useS(t.emotion);

  // When tweak changes, mirror to live state
  useE(() => { setEmotion(t.emotion); }, [t.emotion]);

  // When emotion changes via chat, push back to tweak so the control reflects it
  const onPaneEmotion = (next) => {
    setEmotion(next);
    setTweak('emotion', next);
  };

  // Body theme class (so page background follows dusk)
  useE(() => {
    document.body.classList.toggle('theme-dusk-page', t.theme === 'dusk');
  }, [t.theme]);

  // Render either single or split
  const langs = t.view === 'split' ? ['en', 'ar'] : t.view === 'ar' ? ['ar'] : ['en'];

  return (
    <div className="page-shell">
      <div className="page-title">
        <h1>Sakina · Emotion-aware Companion</h1>
        <p>EN + AR · Tweak emotion + view · v0.4.2</p>
      </div>

      <div className={`pane-set ${langs.length === 1 ? 'single' : ''}`}>
        {langs.map((lang, idx) => (
          <ChatShell
            key={lang}
            lang={lang}
            onLangChange={(L) => {
              // In split mode, no-op (both langs always shown).
              // In single, swap.
              if (t.view !== 'split') setTweak('view', L);
            }}
            emotion={emotion}
            setEmotion={onPaneEmotion}
            theme={t.theme}
            onThemeChange={(th) => setTweak('theme', th)}
            density={t.density}
            bubbleStyle={t.bubbleStyle}
            avatarStyle={t.avatarStyle}
            initialMessages={SAMPLE_MESSAGES_EN}
            showOnboarding={t.onboarding && idx === 0}
            onDismissOnboarding={() => setTweak('onboarding', false)}
            showCrisis={t.showCrisis}
            showJournal={t.showJournal}
            laneLabel={t.view === 'split' ? (lang === 'en' ? '› LTR · English' : '‹ RTL · العربية') : null}
          />
        ))}
      </div>

      <div style={{ height: 16 }} />

      <TweaksPanel>
        <TweakSection label="Emotion state" />
        <TweakSelect
          label="Detected emotion"
          value={t.emotion}
          options={['neutral', 'sad', 'anxious', 'angry', 'happy', 'crisis']}
          onChange={(v) => setTweak('emotion', v)}
        />
        <EmotionSwatches
          value={t.emotion}
          onChange={(v) => setTweak('emotion', v)}
        />

        <TweakSection label="Layout" />
        <TweakRadio
          label="View"
          value={t.view}
          options={['en', 'split', 'ar']}
          onChange={(v) => setTweak('view', v)}
        />
        <TweakRadio
          label="Theme"
          value={t.theme}
          options={['cream', 'dusk']}
          onChange={(v) => setTweak('theme', v)}
        />
        <TweakRadio
          label="Density"
          value={t.density}
          options={['cozy', 'default', 'comfortable']}
          onChange={(v) => setTweak('density', v)}
        />

        <TweakSection label="Visual variants" />
        <TweakRadio
          label="Bubble style"
          value={t.bubbleStyle}
          options={['rounded', 'squared', 'floating']}
          onChange={(v) => setTweak('bubbleStyle', v)}
        />
        <TweakRadio
          label="Avatar"
          value={t.avatarStyle}
          options={['character', 'orb', 'glyph']}
          onChange={(v) => setTweak('avatarStyle', v)}
        />

        <TweakSection label="Inline cards & screens" />
        <TweakToggle
          label="Crisis card inline"
          value={t.showCrisis}
          onChange={(v) => setTweak('showCrisis', v)}
        />
        <TweakToggle
          label="Journal card inline"
          value={t.showJournal}
          onChange={(v) => setTweak('showJournal', v)}
        />
        <TweakToggle
          label="Show onboarding"
          value={t.onboarding}
          onChange={(v) => setTweak('onboarding', v)}
        />
      </TweaksPanel>
    </div>
  );
}

// Custom: emotion color swatches row
function EmotionSwatches({ value, onChange }) {
  const order = ['neutral', 'sad', 'anxious', 'angry', 'happy', 'crisis'];
  return (
    <div className="twk-row">
      <div className="twk-lbl"><span>Quick pick</span><span className="twk-val">{value}</span></div>
      <div style={{ display: 'flex', gap: 6 }}>
        {order.map(e => (
          <button
            key={e}
            onClick={() => onChange(e)}
            title={e}
            style={{
              flex: 1,
              height: 28,
              borderRadius: 8,
              border: value === e ? '2px solid rgba(0,0,0,.4)' : '.5px solid rgba(0,0,0,.1)',
              background: EMOTION_COLORS[e],
              cursor: 'pointer',
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
