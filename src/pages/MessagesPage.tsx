import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MessageCircle, Send, Search, Loader2, Check, CheckCheck,
  User, ArrowRight, MessageSquareDot
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/useAuthStore';

interface Conversation {
  other_user_id: string;
  other_user_name: string;
  other_user_role: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

const roleLabel = (role: string) =>
  role === 'DOCTOR' ? 'طبيب' : role === 'PATIENT' ? 'مريض' : role;

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });

const fmtDate = (d: string) => {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'اليوم';
  if (date.toDateString() === yesterday.toDateString()) return 'أمس';
  return date.toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' });
};

export default function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((s) => s.user);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [activeId, setActiveId] = useState<string | null>(searchParams.get('with'));
  const [activeName, setActiveName] = useState<string>(searchParams.get('name') || '');
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load conversation list ───────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc('get_conversations', { p_user_id: user.id });
      if (error) throw error;
      setConversations(data || []);
    } catch (e) {
      console.error('get_conversations:', e);
    } finally {
      setConvLoading(false);
    }
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // ── Open conversation from URL (?with=uuid&name=...) ─────
  useEffect(() => {
    const withId = searchParams.get('with');
    const name   = searchParams.get('name') || '';
    if (withId && withId !== activeId) {
      setActiveId(withId);
      setActiveName(name);
    }
  }, [searchParams]);

  // ── Load messages for active conversation ─────────────────
  const loadMessages = useCallback(async () => {
    if (!user || !activeId) return;
    setMsgLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_conversation', {
        p_user_a: user.id,
        p_user_b: activeId,
      });
      if (error) throw error;
      setMessages(data || []);
      // mark as read
      await supabase.rpc('mark_messages_read', {
        p_reader_id: user.id,
        p_sender_id: activeId,
      });
      loadConversations(); // refresh unread badge
    } catch (e) {
      console.error('get_conversation:', e);
    } finally {
      setMsgLoading(false);
    }
  }, [user, activeId]);

  useEffect(() => {
    if (!activeId) return;
    setMessages([]);
    loadMessages();
    // Poll every 4 seconds for new messages
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(loadMessages, 4000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeId, loadMessages]);

  // ── Scroll to bottom on new messages ─────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ─────────────────────────────────────────
  const handleSend = async () => {
    const body = input.trim();
    if (!body || !user || !activeId || sending) return;
    setSending(true);
    setInput('');
    try {
      const { error } = await supabase.rpc('send_message', {
        p_sender_id:   user.id,
        p_receiver_id: activeId,
        p_body:        body,
      });
      if (error) throw error;
      await loadMessages();
    } catch (e) {
      console.error('send_message:', e);
      setInput(body); // restore on failure
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const openConversation = (conv: Conversation) => {
    setActiveId(conv.other_user_id);
    setActiveName(conv.other_user_name);
    setSearchParams({ with: conv.other_user_id, name: conv.other_user_name });
  };

  const filteredConvs = conversations.filter(c =>
    c.other_user_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalUnread = conversations.reduce((s, c) => s + Number(c.unread_count), 0);

  return (
    <div className="h-[calc(100vh-80px)] flex rounded-3xl overflow-hidden border border-slate-100 bg-white shadow-sm" dir="rtl">

      {/* ── Sidebar: conversation list ── */}
      <div className={`w-full md:w-72 lg:w-80 flex-shrink-0 border-l border-slate-100 flex flex-col ${activeId ? 'hidden md:flex' : 'flex'}`}>

        {/* Sidebar header */}
        <div className="p-4 border-b border-slate-50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              {totalUnread > 0 && (
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-xs font-black flex items-center justify-center">
                  {totalUnread}
                </span>
              )}
              <MessageCircle className="w-4 h-4 text-indigo-500" />
            </div>
            <h2 className="font-black text-slate-900 text-base">الرسائل</h2>
          </div>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="بحث..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pr-9 pl-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-indigo-300 transition-colors"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {convLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            </div>
          )}

          {!convLoading && filteredConvs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <MessageSquareDot className="w-10 h-10 text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm font-medium">لا توجد محادثات بعد</p>
              <p className="text-slate-300 text-xs mt-1">ابدأ محادثة من صفحة الحجوزات أو المرضى</p>
            </div>
          )}

          {filteredConvs.map(conv => {
            const isActive = activeId === conv.other_user_id;
            const initials = conv.other_user_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('');
            return (
              <button
                key={conv.other_user_id}
                onClick={() => openConversation(conv)}
                className={`w-full p-4 text-right flex items-center gap-3 transition-all hover:bg-slate-50 ${isActive ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
              >
                {/* Avatar */}
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-white text-sm flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                >
                  {initials}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0 text-right">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs text-slate-400">{fmtDate(conv.last_message_at)}</span>
                    <span className="font-black text-slate-900 text-sm truncate">{conv.other_user_name}</span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    {Number(conv.unread_count) > 0 ? (
                      <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-xs font-black flex items-center justify-center flex-shrink-0">
                        {conv.unread_count}
                      </span>
                    ) : <span />}
                    <p className="text-xs text-slate-400 truncate">{conv.last_message}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main: chat window ── */}
      <div className={`flex-1 flex flex-col min-w-0 ${!activeId ? 'hidden md:flex' : 'flex'}`}>

        {!activeId ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-indigo-50 flex items-center justify-center">
              <MessageCircle className="w-9 h-9 text-indigo-300" />
            </div>
            <div>
              <h3 className="font-black text-slate-700 text-lg">اختر محادثة</h3>
              <p className="text-slate-400 text-sm mt-1">اختر شخصاً من القائمة لبدء المحادثة</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-50 bg-white flex-shrink-0">
              <div className="flex-1 text-right">
                <h3 className="font-black text-slate-900">{activeName}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {roleLabel(conversations.find(c => c.other_user_id === activeId)?.other_user_role || '')}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-white text-sm flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
              >
                {activeName.split(' ').map(w => w[0]).slice(0, 2).join('')}
              </div>
              {/* Back button (mobile) */}
              <button
                className="md:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors"
                onClick={() => { setActiveId(null); setSearchParams({}); }}
              >
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Messages area — dir=ltr so flex-row-reverse puts MY messages on the RIGHT */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-2 bg-slate-50/40" dir="ltr">
              {msgLoading && messages.length === 0 && (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                </div>
              )}

              {!msgLoading && messages.length === 0 && (
                <p className="text-center text-slate-400 text-sm py-10">لا توجد رسائل بعد. ابدأ المحادثة!</p>
              )}

              {/* Group messages by date */}
              {messages.map((msg, idx) => {
                const isMine = msg.sender_id === user?.id;
                const showDate = idx === 0 || fmtDate(msg.created_at) !== fmtDate(messages[idx - 1].created_at);
                const isLastMine = isMine && (idx === messages.length - 1 || messages[idx + 1]?.sender_id !== user?.id);

                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-xs text-slate-400 font-medium px-2">{fmtDate(msg.created_at)}</span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    )}
                    {/* isMine → flex-row-reverse pushes bubble to RIGHT; other → flex-row pushes to LEFT */}
                    <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Avatar — only for other person's first message in a group */}
                      {!isMine && (idx === 0 || messages[idx - 1]?.sender_id === user?.id) ? (
                        <div
                          className="w-7 h-7 rounded-xl flex items-center justify-center font-black text-white text-xs flex-shrink-0 self-end mb-0.5"
                          style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
                        >
                          {activeName[0]}
                        </div>
                      ) : !isMine ? (
                        <div className="w-7 flex-shrink-0" />
                      ) : null}

                      {/* Bubble */}
                      <div
                        className={`max-w-[72%] rounded-2xl px-4 py-2.5 ${
                          isMine
                            ? 'text-white rounded-br-sm'
                            : 'bg-white border border-slate-100 text-slate-800 rounded-bl-sm shadow-sm'
                        }`}
                        style={isMine ? { background: 'linear-gradient(135deg, #3730a3, #4f46e5)' } : {}}
                        dir="rtl"
                      >
                        <p className="text-sm leading-relaxed break-words">{msg.body}</p>
                        <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : 'justify-start'}`} dir="ltr">
                          {isMine && isLastMine && (
                            msg.is_read
                              ? <CheckCheck className="w-3 h-3 text-sky-300" />
                              : <Check className="w-3 h-3 text-white/50" />
                          )}
                          <span className={`text-[10px] ${isMine ? 'text-white/60' : 'text-slate-400'}`}>
                            {fmtTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input bar — send button on LEFT in LTR input bar, textarea fills rest */}
            <div className="flex items-end gap-3 px-4 py-3 border-t border-slate-100 bg-white flex-shrink-0" dir="ltr">
              <textarea
                rows={1}
                value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
                onKeyDown={handleKeyDown}
                placeholder="اكتب رسالتك..."
                className="flex-1 resize-none rounded-2xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-right text-slate-800 placeholder:text-right placeholder:text-slate-400 outline-none focus:border-indigo-300 transition-colors leading-relaxed max-h-[120px] overflow-y-auto"
                style={{ minHeight: '42px' }}
                dir="rtl"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white transition-all active:scale-95 disabled:opacity-40 flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3730a3, #4f46e5)' }}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
