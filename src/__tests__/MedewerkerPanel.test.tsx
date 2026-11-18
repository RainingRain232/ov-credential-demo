import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import MedewerkerPanel from '@/components/medewerker/MedewerkerPanel';
import type { ChatMessage, FlowStep, ToolCallItem } from '@/lib/types';

const defaultProps = {
  sessionId: 'abc123def456ghi789',
  messages: [] as ChatMessage[],
  toolCallLog: [] as ToolCallItem[],
  flowStep: 'GREETING' as FlowStep,
  isPending: false,
  onDecision: vi.fn(),
  maximized: false,
  onToggleMaximize: vi.fn(),
};

// De beslisknoppen werken pas als alle punten van de beoordelingslijst zijn afgevinkt
const CHECKLIST = ['Gesprek gelezen', 'Processtappen gecontroleerd', 'Geschiktheid bevestigd', 'Toestemming aanwezig', 'Identiteit geverifieerd'];
const tickAll = () => CHECKLIST.forEach(label => fireEvent.click(screen.getByText(label)));

describe('MedewerkerPanel', () => {
  afterEach(() => {
    cleanup();
  });
  it('renders "Geen review actief" when not pending', () => {
    render(<MedewerkerPanel {...defaultProps} />);
    expect(screen.getByText('Geen review actief')).toBeDefined();
  });

  it('renders "Wacht op beoordeling..." when isPending', () => {
    render(<MedewerkerPanel {...defaultProps} isPending={true} />);
    expect(screen.getByText('Wacht op beoordeling...')).toBeDefined();
  });

  it('shows approve/reject buttons when isPending', () => {
    render(<MedewerkerPanel {...defaultProps} isPending={true} />);
    expect(screen.getByText('Goedkeuren')).toBeDefined();
    expect(screen.getByText('Afwijzen')).toBeDefined();
  });

  it('hides buttons when not pending', () => {
    render(<MedewerkerPanel {...defaultProps} isPending={false} />);
    expect(screen.queryByText('Goedkeuren')).toBeNull();
    expect(screen.queryByText('Afwijzen')).toBeNull();
  });

  it('does not decide before the checklist is complete', () => {
    const onDecision = vi.fn();
    render(<MedewerkerPanel {...defaultProps} isPending={true} onDecision={onDecision} />);
    fireEvent.click(screen.getByText('Goedkeuren'));
    expect(onDecision).not.toHaveBeenCalled();
  });

  it('calls onDecision("approved") when approve clicked', () => {
    const onDecision = vi.fn();
    render(<MedewerkerPanel {...defaultProps} isPending={true} onDecision={onDecision} />);
    tickAll();
    fireEvent.click(screen.getByText('Goedkeuren'));
    expect(onDecision).toHaveBeenCalledWith('approved');
  });

  it('calls onDecision("rejected") when reject clicked', () => {
    const onDecision = vi.fn();
    render(<MedewerkerPanel {...defaultProps} isPending={true} onDecision={onDecision} />);
    tickAll();
    fireEvent.click(screen.getByText('Afwijzen'));
    expect(onDecision).toHaveBeenCalledWith('rejected');
  });

  it('displays session ID and message count', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hallo', timestamp: '2024-01-01T00:00:00Z' },
      { role: 'assistant', content: 'Welkom', timestamp: '2024-01-01T00:00:01Z' },
    ];
    render(<MedewerkerPanel {...defaultProps} messages={messages} />);
    // Session ID is sliced to first 12 chars + "..."
    expect(screen.getByText('abc123def456...')).toBeDefined();
    // Message count
    expect(screen.getByText('2')).toBeDefined();
  });

  it('displays conversation messages', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Ik wil een OV-credential', timestamp: '2024-01-01T00:00:00Z' },
      { role: 'assistant', content: 'Ik help u graag', timestamp: '2024-01-01T00:00:01Z' },
    ];
    render(<MedewerkerPanel {...defaultProps} messages={messages} />);
    expect(screen.getByText('Ik wil een OV-credential')).toBeDefined();
    expect(screen.getByText('Ik help u graag')).toBeDefined();
    expect(screen.getByText('Gebruiker')).toBeDefined();
    expect(screen.getByText('Assistent')).toBeDefined();
  });
});
