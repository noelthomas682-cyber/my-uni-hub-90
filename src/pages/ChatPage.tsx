import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Send, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/trackEvent' // message_sent signal;
import { trackEvent } from '@/lib/trackEvent';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  name: string | null;
  type: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;
    loadConversations();
    loadContacts();
  }, [user]);

  // Auto-open a specific conversation when navigated from TeamHub
  useEffect(() => {
    const state = location.state as { conversationId?: string } | null;
    if (!state?.conversationId || conversations.length === 0) return;
    const target = conversations.find(c => c.id === state.conversationId);
    if (target) openConversation(target);
  }, [location.state, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const loadConversations = async () => {
    const { data } = await supabase
      .from('conversation_members')
      .select('conversation_id, conversations(*)')
      .eq('user_id', user!.id);
    setConversations(data?.map((d: any) => d.conversations).filter(Boolean) || []);
  };

  const loadContacts = async () => {
    const { data } = await supabase
      .from('contacts')
      .select('contact_id, profiles(*)')
      .eq('user_id', user!.id);
    setContacts(data?.map((d: any) => d.profiles).filter(Boolean) || []);
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at');
    setMessages(data as Message[] || []);

    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`conv-${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, (payload) => setMessages(prev => [...prev, payload.new as Message]))
      .subscribe();
    channelRef.current = channel;
  };

  const openConversation = (conv: Conversation) => {
    setActiveConv(conv);
    setShowNewChat(false);
    loadMessages(conv.id);
  };

  const startNewChat = async (contact: any) => {
    const { data: existing } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', user!.id);

    const convIds = existing?.map((e: any) => e.conversation_id) || [];

    if (convIds.length > 0) {
      const { data: shared } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', contact.id)
        .in('conversation_id', convIds);

      if (shared && shared.length > 0) {
        const conv = conversations.find(c => c.id === shared[0].conversation_id);
        if (conv) { openConversation(conv); return; }
      }
    }

    const { data: newConv, error } = await supabase
      .from('conversations')
      .insert({ type: 'direct', created_by: user!.id })
      .select()
      .single();

    if (!newConv || error) return;

    await supabase.from('conversation_members').insert([
      { conversation_id: newConv.id, user_id: user!.id },
      { conversation_id: newConv.id, user_id: contact.id },
    ]);

    setConversations(prev => [...prev, newConv]);
    openConversation({ ...newConv, contact });
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConv || sending) return;
    setSending(true);
    await supabase.from('messages').insert({
      conversation_id: activeConv.id,
      sender_id: user!.id,
      content: newMessage.trim(),
    });
    // Track message sent — social engagement signal for risk scoring
    trackEvent(user!.id, 'message_sent');
    await trackEvent(user!.id, 'message_sent', { conversation_id: activeConv.id });
    setNewMessage('');
    setSending(false);
  };

  return (
    <div className="flex flex-col h-screen bg-background">

      <div className="flex items-center gap-3 px-5 pt-12 pb-4 border-b border-border/40">
        <button
          onClick={() => activeConv ? setActiveConv(null) : navigate('/home')}
          className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="font-heading text-xl font-bold flex-1">
          {activeConv ? (activeConv.name || 'Chat') : 'Messages'}
        </h1>
        {!activeConv && (
          <button
            onClick={() => setShowNewChat(!showNewChat)}
            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Plus className="w-4 h-4 text-primary-foreground" />
          </button>
        )}
      </div>

      {!activeConv ? (
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {showNewChat && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">
                Start a conversation
              </p>
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No contacts yet — add classmates via QR code in Social
                </p>
              ) : contacts.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => startNewChat(contact)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-sm">
                      {(contact.full_name || contact.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-sm">{contact.full_name || contact.email}</p>
                    <p className="text-xs text-muted-foreground">{contact.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {conversations.length === 0 && !showNewChat ? (
            <div className="text-center py-20">
              <p className="font-heading font-bold text-lg mb-2">No messages yet</p>
              <p className="text-muted-foreground text-sm mb-4">Start a conversation with a classmate</p>
              <button
                onClick={() => setShowNewChat(true)}
                className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full text-sm font-semibold">
                New Message
              </button>
            </div>
          ) : conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => openConversation(conv)}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-secondary/50 transition-colors mb-1">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-primary font-bold">
                  {(conv.name || 'C').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="font-medium text-sm truncate">{conv.name || 'Conversation'}</p>
                <p className="text-xs text-muted-foreground">Tap to open</p>
              </div>
            </button>
          ))}
        </div>

      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={cn('flex', msg.sender_id === user!.id ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[75%] px-4 py-2.5 rounded-2xl text-sm',
                  msg.sender_id === user!.id
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-secondary text-foreground rounded-bl-sm'
                )}>
                  <p>{msg.content}</p>
                  <p className={cn(
                    'text-[10px] mt-1',
                    msg.sender_id === user!.id ? 'text-primary-foreground/60' : 'text-muted-foreground'
                  )}>
                    {format(new Date(msg.created_at), 'h:mm a')}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-5 py-4 border-t border-border/40 flex items-center gap-3">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type a message..."
              className="flex-1 bg-secondary/60 rounded-full px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 disabled:opacity-50">
              <Send className="w-4 h-4 text-primary-foreground" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}