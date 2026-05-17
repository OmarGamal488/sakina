// screens.jsx — CrisisCard, JournalCard, MoodTimeline, SettingsSheet, Onboarding

const { useState: useState_s } = React;

// ─── CRISIS CARD ───
function CrisisCard({ t, lang, hotlines, onAccept, onDecline }) {
  return (
    <div className="inline-card crisis-card" role="dialog" aria-label="Crisis support">
      <div className="crisis-icon">
        <Icon.Hand />
      </div>
      <h3>{t.crisisHeading}</h3>
      <p>{t.crisisBody}</p>
      <div className="crisis-actions">
        <button className="btn btn-primary" onClick={() => onAccept(hotlines[0])}>
          <Icon.Phone />
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.2 }}>
            <span>{t.crisisCall}</span>
            <span style={{ fontSize: 11, opacity: 0.8 }}>{t.crisisCallSub}</span>
          </span>
        </button>
        <button className="btn btn-ghost" onClick={onDecline}>{t.crisisDecline}</button>
      </div>
      <div className="crisis-foot">
        <Icon.Pencil style={{ width: 14, height: 14, opacity: 0.6 }} />
        <span>{t.crisisText}</span>
      </div>
    </div>
  );
}

// ─── JOURNAL CARD ───
function JournalCard({ t, lang, onSave, onSkip }) {
  const [val, setVal] = useState_s('');
  return (
    <div className="inline-card journal-card" role="dialog" aria-label="Journal prompt">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon.Sparkle style={{ color: 'var(--emo-joy)' }} />
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{t.journalTitle}</h3>
      </div>
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={t.placeholder}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      />
      <div className="journal-chips">
        <button className="chip" onClick={() => setVal(v => v ? v + '\n' + t.journalP1 : t.journalP1)}>{t.journalP1}</button>
        <button className="chip" onClick={() => setVal(v => v ? v + '\n' + t.journalP2 : t.journalP2)}>{t.journalP2}</button>
        <button className="chip" onClick={() => setVal(v => v ? v + '\n' + t.journalP3 : t.journalP3)}>{t.journalP3}</button>
      </div>
      <div className="journal-actions">
        <button className="btn btn-ghost" style={{ minHeight: 38, padding: '8px 16px' }} onClick={onSkip}>{t.journalSkip}</button>
        <button className="btn btn-sage" style={{ minHeight: 38, padding: '8px 16px' }} onClick={() => onSave(val)} disabled={!val.trim()}>{t.journalSave}</button>
      </div>
    </div>
  );
}

// ─── MOOD TIMELINE (custom SVG area chart) ───
function MoodTimeline({ t, lang, data, range, onRangeChange, onClose }) {
  // Build stacked areas
  const W = 380, H = 180, PAD = 20;
  const emotions = ['sadness', 'joy', 'love', 'anger', 'fear', 'surprise'];
  const xStep = (W - PAD * 2) / (data.length - 1);
  // For each emotion, build a stacked y for each point. Stack order:
  const stacks = data.map(d => {
    let acc = 0;
    const out = {};
    emotions.forEach(e => {
      out[e] = { start: acc, end: acc + (d.emotions[e] || 0) };
      acc += d.emotions[e] || 0;
    });
    return out;
  });
  const yScale = (v) => H - PAD - v * (H - PAD * 2);

  // Smooth monotone path for each emotion's stacked area
  function areaPath(emo) {
    const top = data.map((_, i) => `${PAD + i * xStep},${yScale(stacks[i][emo].end)}`);
    const bot = data.map((_, i) => `${PAD + i * xStep},${yScale(stacks[i][emo].start)}`).reverse();
    return `M ${top.join(' L ')} L ${bot.join(' L ')} Z`;
  }

  const [hover, setHover] = useState_s(null);

  // Dominant emotion overall this week
  const totals = emotions.reduce((a, e) => {
    a[e] = data.reduce((s, d) => s + (d.emotions[e] || 0), 0);
    return a;
  }, {});
  const dominant = emotions.reduce((a, e) => totals[e] > totals[a] ? e : a, 'joy');

  return (
    <aside className="timeline-panel" onClick={(e) => e.stopPropagation()}>
      <div className="sheet-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2>{t.moodTitle}</h2>
          <div style={{ marginTop: 14 }}>
            <div className="timeline-tabs">
              <button className={range === '7d' ? 'on' : ''} onClick={() => onRangeChange('7d')}>{t.range7}</button>
              <button className={range === '30d' ? 'on' : ''} onClick={() => onRangeChange('30d')}>{t.range30}</button>
              <button className={range === '90d' ? 'on' : ''} onClick={() => onRangeChange('90d')}>{t.range90}</button>
            </div>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon.Close /></button>
      </div>
      <div className="sheet-body">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}
             onMouseLeave={() => setHover(null)}>
          {/* Areas */}
          {emotions.map(e => (
            <path key={e} d={areaPath(e)} fill={EMOTION_COLORS[e]} opacity="0.65" />
          ))}
          {/* X labels */}
          {data.map((d, i) => (
            <g key={d.date}>
              <text x={PAD + i * xStep} y={H - 4} textAnchor="middle"
                fontSize="10" fontFamily="JetBrains Mono, monospace"
                fill="var(--ink-fade)">
                {lang === 'ar' ? STRINGS.ar.days[i] : d.date}
              </text>
            </g>
          ))}
          {/* Hover guide */}
          {hover !== null && (
            <g>
              <line x1={PAD + hover * xStep} x2={PAD + hover * xStep}
                    y1={PAD} y2={H - PAD} stroke="var(--ink)" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
            </g>
          )}
          {/* Hover targets */}
          {data.map((d, i) => (
            <rect key={i} x={PAD + i * xStep - xStep / 2} y={0}
                  width={xStep} height={H} fill="transparent"
                  onMouseEnter={() => setHover(i)} />
          ))}
        </svg>

        {/* Hover readout */}
        <div style={{ minHeight: 38, marginTop: 8, fontSize: 13, color: 'var(--ink-soft)' }}>
          {hover !== null ? (() => {
            const d = data[hover];
            const dom = emotions.reduce((a, e) => (d.emotions[e] || 0) > (d.emotions[a] || 0) ? e : a, 'joy');
            return (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: EMOTION_COLORS[dom] }} />
                <strong style={{ color: 'var(--ink)' }}>{lang === 'ar' ? STRINGS.ar.days[hover] : d.date}</strong>
                <span>·</span>
                <span>{EMOTION_LABELS[lang][dom]}</span>
              </span>
            );
          })() : (
            <span style={{ color: 'var(--ink-fade)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
              {lang === 'ar' ? 'مرّر لمعرفة المزاج المهيمن' : 'Hover for the dominant feeling each day'}
            </span>
          )}
        </div>

        {/* Insight cards */}
        <div className="insight-cards">
          <div className="insight-card">
            <div className="insight-label">{t.insight1}</div>
            <div className="insight-chip">
              <span className="dot" style={{ background: EMOTION_COLORS[dominant] }} />
              <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{EMOTION_LABELS[lang][dominant]}</span>
            </div>
          </div>
          <div className="insight-card">
            <div className="insight-label">{t.insight2}</div>
            <div className="insight-value">{t.calmest}</div>
          </div>
          <div className="insight-card">
            <div className="insight-label">{t.insight3}</div>
            <div className="insight-value">{t.streak}</div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)' }}>
          {emotions.map(e => (
            <span key={e} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: EMOTION_COLORS[e] }} />
              <span>{EMOTION_LABELS[lang][e]}</span>
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}

// ─── SETTINGS SHEET ───
function SettingsSheet({ t, lang, onLangChange, voiceOn, onVoiceToggle, memory, onMemoryToggle, voiceKind, onVoiceKindChange, theme, onThemeChange, onClose }) {
  const [confirm, setConfirm] = useState_s(null);
  return (
    <aside className="sheet" onClick={(e) => e.stopPropagation()}>
      <div className="sheet-header">
        <h2>{t.settingsTitle}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon.Close /></button>
      </div>
      <div className="sheet-body">
        {/* Language */}
        <div className="section-block">
          <h3>{t.secLanguage}</h3>
          <div className="radio-row">
            <button className={`radio-pill ${lang === 'en' ? 'on' : ''}`} onClick={() => onLangChange('en')}>English</button>
            <button className={`radio-pill ${lang === 'ar' ? 'on' : ''}`} onClick={() => onLangChange('ar')}>العربية</button>
          </div>
        </div>

        {/* Theme (extra) */}
        <div className="section-block">
          <h3>{lang === 'ar' ? 'المظهر' : 'Appearance'}</h3>
          <div className="radio-row">
            <button className={`radio-pill ${theme === 'cream' ? 'on' : ''}`} onClick={() => onThemeChange('cream')}>{lang === 'ar' ? 'كريمي' : 'Cream'}</button>
            <button className={`radio-pill ${theme === 'dusk' ? 'on' : ''}`} onClick={() => onThemeChange('dusk')}>{lang === 'ar' ? 'غسق' : 'Dusk'}</button>
          </div>
        </div>

        {/* Voice */}
        <div className="section-block">
          <h3>{t.secVoice}</h3>
          <div className="row">
            <div className="row-label">
              <span>{t.voiceRead}</span>
            </div>
            <button className={`switch ${voiceOn ? 'on' : ''}`} onClick={onVoiceToggle} aria-pressed={voiceOn} />
          </div>
          <div style={{ marginTop: 8, opacity: voiceOn ? 1 : 0.5, transition: 'opacity 200ms' }}>
            <div className="row" style={{ paddingBottom: 0 }}>
              <span className="row-sub">{t.voicePicker}</span>
            </div>
            <div className="radio-row">
              {[['f', t.voiceCalmF], ['m', t.voiceCalmM], ['sys', t.voiceSys]].map(([k, lbl]) => (
                <button key={k} className={`radio-pill ${voiceKind === k ? 'on' : ''}`}
                        onClick={() => voiceOn && onVoiceKindChange(k)}
                        disabled={!voiceOn}>{lbl}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="section-block">
          <h3>{t.secMemory}</h3>
          <div className="row">
            <div className="row-label">
              <span>{t.memoryRemember}</span>
              <span className="row-sub">{t.memoryRememberSub}</span>
            </div>
            <button className={`switch ${memory ? 'on' : ''}`} onClick={onMemoryToggle} aria-pressed={memory} />
          </div>
          <button className="btn btn-destructive" style={{ marginTop: 12, width: '100%', minHeight: 40 }}
                  onClick={() => setConfirm('memory')}>
            <Icon.Trash />
            <span>{t.memoryClear}</span>
          </button>
          {confirm === 'memory' && (
            <div style={{ marginTop: 10, padding: 14, background: 'var(--sand-soft)', borderRadius: 12, fontSize: 13 }}>
              <p style={{ margin: '0 0 12px', color: 'var(--ink-soft)' }}>
                {lang === 'ar' ? 'سيتم مسح سجل المحادثات. ستبقى الإعدادات.' : "I'll forget our conversations. Your settings stay."}
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" style={{ minHeight: 36, padding: '6px 14px' }}
                        onClick={() => setConfirm(null)}>{t.crisisDecline}</button>
                <button className="btn btn-destructive" style={{ minHeight: 36, padding: '6px 14px' }}
                        onClick={() => setConfirm(null)}>{t.memoryClear}</button>
              </div>
            </div>
          )}
        </div>

        {/* Privacy */}
        <div className="section-block">
          <h3>{t.secPrivacy}</h3>
          <button className="row" style={{ background: 'transparent', border: 0, padding: '8px 0', width: '100%', cursor: 'pointer' }}>
            <span style={{ color: 'var(--sage)' }}>{t.privUse}</span>
            <Icon.ChevronLeft className="mirror" />
          </button>
          <button className="row" style={{ background: 'transparent', border: 0, padding: '8px 0', width: '100%', cursor: 'pointer' }}>
            <span style={{ color: 'var(--emo-anger)' }}>{t.privDelete}</span>
            <Icon.ChevronLeft className="mirror" />
          </button>
        </div>

        {/* About */}
        <div className="section-block">
          <h3>{t.secAbout}</h3>
          <div style={{ fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.7 }}>
            <div>{t.version}</div>
            <div style={{ opacity: 0.7, marginTop: 4 }}>{t.credit}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── ONBOARDING ───
function Onboarding({ t, lang, onLangChange, onStart, avatarStyle }) {
  return (
    <div className="onboarding-card" role="dialog">
      <Avatar emotion="joy" size={96} style={avatarStyle} glow />
      <h1>{t.onboardTitle}</h1>
      <p>{t.onboardBody}</p>
      <div className="radio-row" style={{ marginBottom: 16 }}>
        <button className={`radio-pill ${lang === 'en' ? 'on' : ''}`} onClick={() => onLangChange('en')}>English</button>
        <button className={`radio-pill ${lang === 'ar' ? 'on' : ''}`} onClick={() => onLangChange('ar')}>العربية</button>
      </div>
      <button className="cta" onClick={onStart}>{t.cta}</button>
      <div className="foot">
        <div>{t.foot1}</div>
        <div style={{ marginTop: 4 }}><a href="#">{t.foot2} →</a></div>
      </div>
    </div>
  );
}

Object.assign(window, { CrisisCard, JournalCard, MoodTimeline, SettingsSheet, Onboarding });
