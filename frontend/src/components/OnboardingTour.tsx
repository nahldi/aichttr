import { useState, useEffect } from 'react';

const TOUR_KEY = 'ghostlink_tour_complete';

interface TourStep {
  title: string;
  text: string;
  icon: string;
  position: 'center' | 'bottom-left' | 'bottom-right' | 'top';
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome to GhostLink',
    text: 'Your multi-agent AI chat hub. Multiple AI agents — Claude, Codex, Gemini — all in one shared chat room.',
    icon: 'waving_hand',
    position: 'center',
  },
  {
    title: 'Add Agents',
    text: 'Click the + button in the agent bar to spawn AI agents. Pick from presets like Code Reviewer or PM, or configure your own.',
    icon: 'add_circle',
    position: 'top',
  },
  {
    title: '@Mention to Talk',
    text: 'Type @claude or @codex to direct a message to a specific agent. Use @all to ask everyone at once.',
    icon: 'alternate_email',
    position: 'bottom-left',
  },
  {
    title: 'Slash Commands',
    text: 'Type / for quick commands: /status, /theme, /export, /help, and more. Press Up arrow to recall previous messages.',
    icon: 'terminal',
    position: 'bottom-left',
  },
  {
    title: 'Organize with Channels',
    text: 'Create channels like #frontend or #research to keep conversations organized. Click + next to the channel tabs.',
    icon: 'tag',
    position: 'top',
  },
  {
    title: 'You\'re Ready!',
    text: 'Start chatting with your AI team. Check Settings for themes, agent presets, and more. Use Ctrl+K to search anything.',
    icon: 'rocket_launch',
    position: 'center',
  },
];

export function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      // Show tour after a short delay so the app renders first
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(TOUR_KEY, 'true');
  };

  const next = () => {
    if (isLast) {
      dismiss();
    } else {
      setStep(step + 1);
    }
  };

  const posClass = current.position === 'center'
    ? 'items-center justify-center'
    : current.position === 'bottom-left'
    ? 'items-end justify-start pb-24 pl-6'
    : current.position === 'bottom-right'
    ? 'items-end justify-end pb-24 pr-6'
    : 'items-start justify-center pt-20';

  return (
    <div className={`fixed inset-0 z-[100] flex ${posClass}`} onClick={dismiss}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-[380px] max-w-[90vw] rounded-2xl p-6 border border-primary/20"
        style={{
          background: 'linear-gradient(145deg, #1a1a2e 0%, #0f0f1a 100%)',
          boxShadow: '0 0 60px rgba(167, 139, 250, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step indicator */}
        <div className="flex gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-all ${
                i <= step ? 'bg-primary' : 'bg-surface-container-highest'
              }`}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-2xl text-primary">{current.icon}</span>
        </div>

        {/* Content */}
        <h3 className="text-base font-bold text-on-surface mb-2">{current.title}</h3>
        <p className="text-sm text-on-surface-variant/70 leading-relaxed mb-6">{current.text}</p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={dismiss}
            className="text-xs text-on-surface-variant/40 hover:text-on-surface-variant/60 transition-colors"
          >
            Skip tour
          </button>
          <button
            onClick={next}
            className="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:brightness-110 transition-all active:scale-95"
          >
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
