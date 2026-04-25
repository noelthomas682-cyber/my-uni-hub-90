import { useState } from 'react';
import { MessageSquare, X, Send, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'react-router-dom';

export default function FeedbackButton() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!message.trim()) return;
    setSending(true);
    await supabase.from('feedback').insert({
      user_id: user?.id || null,
      message: message.trim(),
      page: location.pathname,
    });
    setSending(false);
    setSent(true);
    setMessage('');
    setTimeout(() => { setSent(false); setOpen(false); }, 2000);
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-36 right-4 z-50 w-72 glass-card rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm">Send Feedback</p>
            <button onClick={() => setOpen(false)}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="What's broken or what do you want? Be brutally honest."
            rows={3}
            className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none mb-3"
          />
          <button
            onClick={submit}
            disabled={!message.trim() || sending || sent}
            className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {sent ? <><Check className="w-4 h-4" />Sent!</> : sending ? 'Sending...' : <><Send className="w-4 h-4" />Send</>}
          </button>
        </div>
      )}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed right-4 z-40 w-12 h-12 bg-primary rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        style={{ bottom: open ? '320px' : '88px' }}
      >
        <MessageSquare className="w-5 h-5 text-primary-foreground" />
      </button>
    </>
  );
}