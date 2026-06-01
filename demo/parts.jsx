// parts.jsx — TopBar, PresenceHeader, MoodStrip, Bubble, Composer, MenuPopover

const { useState, useRef, useEffect, useLayoutEffect } = React;

// ─── TOP BAR (slim — brand + controls) ───
function TopBar({ lang, onLangChange, voiceOn, onVoiceToggle, onMenu, emotion, t }) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <div className="topbar-brand">
          <span>{t.name}</span>
          <span className="dot-divider">·</span>
          <span className="sub">{t.statusBase}</span>
        </div>
      </div>
      <div className="topbar-right">
        <div className="lang-pill" role="tablist">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => onLangChange('en')}>EN</button>
          <button className={lang === 'ar' ? 'on' : ''} onClick={() => onLangChange('ar')}>ع</button>
        </div>
        <button
          className={`icon-btn ${voiceOn ? 'active' : ''}`}
          onClick={onVoiceToggle}
          title={voiceOn ? t.voiceOn : t.voiceOff}
          aria-pressed={voiceOn}
        >
          {voiceOn ? <Icon.Speaker /> : <Icon.SpeakerOff />}
        </button>
        <button className="icon-btn" onClick={onMenu} title="More">
          <Icon.More />
        </button>
      </div>
    </div>
  );
}

// ─── PRESENCE HEADER (large persistent Sakina avatar) ───
function PresenceHeader({ emotion, avatarStyle, isSpeaking, t, lang, onClick }) {
  return (
    <div className="presence" style={{ '--emo': EMOTION_COLORS[emotion] }}>
      <SakinaAvatar
        emotion={emotion}
        size="md"
        style={avatarStyle}
        isSpeaking={isSpeaking}
        onClick={onClick}
        label={t.name}
      />
      <div className="presence-meta">
        <div className="presence-emo">
          <span className="swatch" />
          <span>{t.name} · {EMOTION_LABELS[lang][emotion]}</span>
        </div>
      </div>
    </div>
  );
}

// ─── MENU POPOVER ───
function MenuPopover({ t, onClose, onSettings, onMood, onClear }) {
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [onClose]);
  return (
    <div className="menu-popover" ref={ref} role="menu">
      <button onClick={onMood}><Icon.Chart /><span>{t.menuMood}</span></button>
      <button onClick={onSettings}><Icon.Settings /><span>{t.menuSettings}</span></button>
      <div className="sep" />
      <button onClick={() => {}}><Icon.Download /><span>{t.menuExport}</span></button>
      <button onClick={onClear}><Icon.Trash /><span>{t.menuClear}</span></button>
    </div>
  );
}

// ─── MOOD STRIP ───
function MoodStrip({ t, dots, onOpen }) {
  return (
    <div className="mood-strip" onClick={onOpen} role="button" tabIndex={0}>
      <div className="mood-strip-left">
        <span style={{ fontWeight: 500, color: 'var(--ink)' }}>{t.todayMood}</span>
        <span className="mood-dots" aria-hidden>
          {dots.map((on, i) => <span key={i} className={`mood-dot ${on ? 'filled' : ''}`} />)}
        </span>
        <span>{t.moodSummary}</span>
      </div>
      <div className="mood-strip-right">{t.lastCheckin}</div>
    </div>
  );
}

// ─── DAY DIVIDER ───
function DayDivider({ label }) {
  return <div className="day-divider"><span>{label}</span></div>;
}

// ─── BUBBLE (plain — no avatar) ───
function Bubble({ msg, lang, t, streaming = false }) {
  const isAssistant = msg.role === 'assistant';
  const txt = msg.text?.[lang] || '';
  const emoColor = msg.emotion ? EMOTION_COLORS[msg.emotion] : null;
  const emoLabel = msg.emotion ? EMOTION_LABELS[lang][msg.emotion] : null;
  return (
    <div className={`msg-row ${msg.role}`}>
      <div style={{ minWidth: 0 }}>
        <div
          className="msg-bubble"
          style={isAssistant && msg.emotion ? { '--emo': emoColor } : undefined}
        >
          {txt}
          {streaming && <span className="caret" />}
        </div>
        {isAssistant && msg.emotion && (
          <div className="emo-tag" style={{ '--emo-c': emoColor }}>
            <span className="swatch" />
            <span>{emoLabel}</span>
            {msg.time && <span style={{ marginInlineStart: 6, opacity: 0.6 }}>· {msg.time}</span>}
          </div>
        )}
        {!msg.emotion && msg.time && (
          <div className="msg-meta">{msg.time}</div>
        )}
      </div>
    </div>
  );
}

// ─── TYPING INDICATOR ───
function TypingIndicator() {
  return (
    <div className="msg-row assistant">
      <div className="msg-bubble" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '12px 16px' }}>
        <Dot d={0} /><Dot d={150} /><Dot d={300} />
      </div>
    </div>
  );
}
function Dot({ d }) {
  return (
    <span
      style={{
        width: 6, height: 6, borderRadius: 999, background: 'var(--ink-fade)',
        display: 'inline-block',
        animation: 'av-breathe 1.2s ease-in-out infinite',
        animationDelay: `${d}ms`,
      }}
    />
  );
}

// ─── COMPOSER ───
function Composer({ t, lang, status, onSend, onStop, recording, onRecordToggle }) {
  const [value, setValue] = useState('');
  const taRef = useRef(null);
  const isStreaming = status === 'streaming' || status === 'submitted';

  useLayoutEffect(() => {
    if (!taRef.current) return;
    const el = taRef.current;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 144) + 'px';
  }, [value]);

  const submit = () => {
    const v = value.trim();
    if (!v || isStreaming) return;
    onSend(v);
    setValue('');
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <div className="composer-wrap" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="composer-box">
        <textarea
          ref={taRef}
          className="composer-input"
          rows={1}
          value={recording ? '' : value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={recording ? t.placeholderRec : t.placeholder}
          aria-label="Message Sakina"
          disabled={recording}
        />
        {isStreaming ? (
          <button className="send-btn stop" onClick={onStop} aria-label={t.stop} title={t.stop}>
            <Icon.Stop />
          </button>
        ) : (
          <button
            className={`send-btn ${canSend ? 'live' : ''}`}
            onClick={submit}
            disabled={!canSend}
            aria-label="Send"
            title="Send (Enter)"
          >
            <Icon.Send />
          </button>
        )}
      </div>
      <div className="composer-foot">
        <div className="composer-foot-left">
          <button
            className={`foot-btn ${recording ? 'rec' : ''}`}
            onClick={onRecordToggle}
            title={recording ? t.stop : t.record}
          >
            {recording ? <Icon.Wave /> : <Icon.Mic />}
            <span>{recording ? t.stop : t.record}</span>
          </button>
          <button className="foot-btn" disabled title={t.attach}>
            <Icon.Paperclip />
            <span>{t.attach}</span>
          </button>
        </div>
        <span>{value.length > 0 ? `${value.length}` : 'enter ⏎ · shift+⏎ newline'}</span>
      </div>
    </div>
  );
}

Object.assign(window, { TopBar, PresenceHeader, MenuPopover, MoodStrip, DayDivider, Bubble, TypingIndicator, Composer });
