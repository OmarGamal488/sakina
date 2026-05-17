// chat-shell.jsx — composes top bar, mood strip, messages, composer, panels
// One pane = one language. State for that pane is local but emotion is shared via prop.

const { useState: useSC, useRef: useRefSC, useEffect: useEffectSC } = React;

function ChatShell({
  lang, onLangChange,
  emotion, setEmotion,
  theme, onThemeChange,
  density, bubbleStyle, avatarStyle,
  initialMessages,
  showOnboarding, onDismissOnboarding,
  showCrisis, showJournal,
  laneLabel,
}) {
  const t = STRINGS[lang];
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  // Messages state — start with sample
  const [messages, setMessages] = useSC(initialMessages);
  const [status, setStatus] = useSC('ready'); // ready | submitted | streaming
  const [streamingText, setStreamingText] = useSC(''); // text of in-progress msg
  const [pendingEmo, setPendingEmo] = useSC(null);
  const [recording, setRecording] = useSC(false);
  const [voiceOn, setVoiceOn] = useSC(false);
  const [memory, setMemory] = useSC(true);
  const [voiceKind, setVoiceKind] = useSC('f');

  const [menuOpen, setMenuOpen] = useSC(false);
  const [settingsOpen, setSettingsOpen] = useSC(false);
  const [moodOpen, setMoodOpen] = useSC(false);
  const [range, setRange] = useSC('7d');

  // Crisis/journal visibility (override + auto)
  const messagesContainsCrisis = messages.some(m => m.kind === 'crisis');
  const messagesContainsJournal = messages.some(m => m.kind === 'journal');

  const scrollRef = useRefSC(null);
  useEffectSC(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  // Streaming simulation
  const streamRef = useRefSC(null);
  const startStreaming = (fullText, detectedEmotion) => {
    setStatus('streaming');
    setStreamingText('');
    setPendingEmo(detectedEmotion);
    let i = 0;
    const tick = () => {
      i += Math.max(1, Math.floor(Math.random() * 3));
      if (i >= fullText.length) {
        // Done — commit message
        setStreamingText('');
        const time = new Date().toTimeString().slice(0, 5);
        const newMsg = {
          id: 'a-' + Date.now(),
          role: 'assistant',
          emotion: detectedEmotion,
          time,
          text: { [lang]: fullText, [lang === 'en' ? 'ar' : 'en']: fullText }, // simplistic mirror
        };
        setMessages(m => [...m, newMsg]);
        setStatus('ready');
        setPendingEmo(null);
        // Crisis card injection
        if (detectedEmotion === 'crisis' && !m_containsCrisis()) {
          setTimeout(() => setMessages(m => [...m, { id: 'crisis-' + Date.now(), kind: 'crisis', role: 'system' }]), 400);
        }
        return;
      }
      setStreamingText(fullText.slice(0, i));
      streamRef.current = setTimeout(tick, 22 + Math.random() * 28);
    };
    streamRef.current = setTimeout(tick, 380);
  };
  const m_containsCrisis = () => messages.some(m => m.kind === 'crisis');

  const stopStreaming = () => {
    if (streamRef.current) clearTimeout(streamRef.current);
    if (streamingText) {
      const time = new Date().toTimeString().slice(0, 5);
      setMessages(m => [...m, {
        id: 'a-' + Date.now(), role: 'assistant', emotion: pendingEmo, time,
        text: { [lang]: streamingText, [lang === 'en' ? 'ar' : 'en']: streamingText }
      }]);
    }
    setStreamingText('');
    setStatus('ready');
    setPendingEmo(null);
  };

  const handleSend = (text) => {
    const time = new Date().toTimeString().slice(0, 5);
    setMessages(m => [...m, {
      id: 'u-' + Date.now(), role: 'user', time,
      text: { en: text, ar: text },
    }]);
    setStatus('submitted');
    const detected = detectEmotion(text, emotion === 'crisis' ? 'crisis' : 'neutral');
    setEmotion(detected);
    // Compose response
    const responseText = SIM_RESPONSES[detected][lang];
    setTimeout(() => startStreaming(responseText, detected), 250);
  };

  const handleClear = () => {
    setMessages([]);
    setMenuOpen(false);
  };

  const wrapClasses = [
    'pane',
    'theme-' + theme,
    'density-' + density,
    'style-' + bubbleStyle,
  ].join(' ');

  return (
    <div className={wrapClasses} dir={dir} data-screen-label={`Chat — ${lang.toUpperCase()}`}>
      {laneLabel && <div className="pane-label">{laneLabel}</div>}

      <TopBar
        lang={lang}
        onLangChange={onLangChange}
        voiceOn={voiceOn}
        onVoiceToggle={() => setVoiceOn(v => !v)}
        onMenu={() => setMenuOpen(o => !o)}
        emotion={emotion}
        t={t}
      />

      <PresenceHeader
        emotion={emotion}
        avatarStyle={avatarStyle}
        isSpeaking={status === 'streaming' || status === 'submitted'}
        t={t}
        lang={lang}
        onClick={() => setMoodOpen(true)}
      />

      {menuOpen && (
        <MenuPopover
          t={t}
          onClose={() => setMenuOpen(false)}
          onSettings={() => { setMenuOpen(false); setSettingsOpen(true); }}
          onMood={() => { setMenuOpen(false); setMoodOpen(true); }}
          onClear={handleClear}
        />
      )}

      <MoodStrip t={t} dots={TODAY_DOTS} onOpen={() => setMoodOpen(true)} />

      <div className="messages-region" ref={scrollRef} aria-live="polite">
        <DayDivider label={t.todayLabel} />

        {messages.map((msg, idx) => {
          if (msg.kind === 'crisis') {
            return (
              <CrisisCard
                key={msg.id}
                t={t}
                lang={lang}
                hotlines={[{ label: t.crisisCall, number: lang === 'ar' ? '8001717' : '988', type: 'call' }]}
                onAccept={() => {}}
                onDecline={() => setMessages(m => m.filter(x => x.id !== msg.id))}
              />
            );
          }
          if (msg.kind === 'journal') {
            return (
              <JournalCard
                key={msg.id}
                t={t}
                lang={lang}
                onSave={() => setMessages(m => m.filter(x => x.id !== msg.id))}
                onSkip={() => setMessages(m => m.filter(x => x.id !== msg.id))}
              />
            );
          }
          return (
            <Bubble
              key={msg.id}
              msg={msg}
              lang={lang}
              t={t}
            />
          );
        })}

        {/* Show streaming bubble */}
        {status === 'streaming' && streamingText && (
          <Bubble
            msg={{
              role: 'assistant',
              emotion: pendingEmo,
              text: { [lang]: streamingText, [lang === 'en' ? 'ar' : 'en']: streamingText },
              time: '',
            }}
            lang={lang}
            t={t}
            streaming
          />
        )}
        {status === 'submitted' && (
          <TypingIndicator />
        )}

        {/* Inject helper inserters (only if not already present) */}
        {showCrisis && !messagesContainsCrisis && (
          <CrisisCard
            t={t}
            lang={lang}
            hotlines={[{ label: t.crisisCall, number: lang === 'ar' ? '8001717' : '988', type: 'call' }]}
            onAccept={() => {}}
            onDecline={() => {}}
          />
        )}
        {showJournal && !messagesContainsJournal && (
          <JournalCard
            t={t}
            lang={lang}
            onSave={() => {}}
            onSkip={() => {}}
          />
        )}
      </div>

      <Composer
        t={t}
        lang={lang}
        status={status}
        onSend={handleSend}
        onStop={stopStreaming}
        recording={recording}
        onRecordToggle={() => setRecording(r => !r)}
        density={density}
      />

      {/* Onboarding overlay */}
      {showOnboarding && (
        <div className="overlay center" onClick={onDismissOnboarding}>
          <div onClick={(e) => e.stopPropagation()}>
            <Onboarding
              t={t}
              lang={lang}
              onLangChange={onLangChange}
              onStart={onDismissOnboarding}
              avatarStyle={avatarStyle}
            />
          </div>
        </div>
      )}

      {/* Settings sheet */}
      {settingsOpen && (
        <div className="overlay right-aligned" onClick={() => setSettingsOpen(false)}>
          <SettingsSheet
            t={t}
            lang={lang}
            onLangChange={onLangChange}
            voiceOn={voiceOn}
            onVoiceToggle={() => setVoiceOn(v => !v)}
            memory={memory}
            onMemoryToggle={() => setMemory(m => !m)}
            voiceKind={voiceKind}
            onVoiceKindChange={setVoiceKind}
            theme={theme}
            onThemeChange={onThemeChange}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      )}

      {/* Mood timeline */}
      {moodOpen && (
        <div className="overlay left-aligned" onClick={() => setMoodOpen(false)}>
          <MoodTimeline
            t={t}
            lang={lang}
            data={MOOD_7D}
            range={range}
            onRangeChange={setRange}
            onClose={() => setMoodOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ChatShell });
