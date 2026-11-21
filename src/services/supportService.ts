import { supabase } from '../config/supabaseClient';
import { authService } from './authService';
import type { SupportTopic } from '../utils/supportChat';

export interface SupportTicketMessage {
  id: string;
  authorRole: 'customer' | 'assistant' | 'support_agent' | 'system';
  body: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  orderId: string | null;
  conversationId: string | null;
  category: SupportTopic;
  status: 'open' | 'pending' | 'resolved' | 'closed';
  subject: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessage[];
}

export interface SupportArticle {
  slug: string;
  category: string;
  question: string;
  answer: string;
  updatedAt: string;
}

export interface CreateSupportTicketInput {
  orderId?: string | null;
  conversationId?: string | null;
  category: SupportTopic;
  subject: string;
  description: string;
}

const mapMessage = (row: any): SupportTicketMessage => ({
  id: String(row.id),
  authorRole: row.author_role,
  body: String(row.body ?? ''),
  createdAt: String(row.created_at ?? new Date().toISOString()),
});

const mapTicket = (row: any): SupportTicket => ({
  id: String(row.id),
  orderId: row.order_id ?? null,
  conversationId: row.conversation_id ?? null,
  category: row.category,
  status: row.status,
  subject: String(row.subject ?? ''),
  description: String(row.description ?? ''),
  createdAt: String(row.created_at ?? new Date().toISOString()),
  updatedAt: String(row.updated_at ?? row.created_at ?? new Date().toISOString()),
  messages: Array.isArray(row.support_ticket_messages)
    ? row.support_ticket_messages.map(mapMessage)
    : [],
});

export const supportService = {
  /** Creates a real in-app ticket. Ownership is verified by the RPC. */
  async createSupportTicket(input: CreateSupportTicketInput): Promise<SupportTicket> {
    const { data, error } = await supabase.rpc('qai_create_support_ticket', {
      p_order_id: input.orderId ?? null,
      p_conversation_id: input.conversationId ?? null,
      p_category: input.category,
      p_subject: input.subject,
      p_description: input.description,
      p_metadata: { source: 'ask_q' },
    });

    if (error) throw new Error(error.message || 'Could not create support ticket');
    if (!data) throw new Error('Support ticket was not created');
    // A composite return can be an object or a one-row array depending on the
    // PostgREST version; normalise both.
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('Support ticket was not created');
    return mapTicket(row);
  },

  async listSupportTickets(): Promise<SupportTicket[]> {
    const user = await authService.getCurrentSessionUser();
    if (!user?.id) return [];
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*, support_ticket_messages(id, author_role, body, created_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Could not load support tickets:', error.message);
      return [];
    }
    return (data ?? []).map(mapTicket);
  },

  /** Published FAQ content, shared with the assistant's knowledge table. */
  async listSupportArticles(): Promise<SupportArticle[]> {
    const { data, error } = await supabase
      .from('support_articles')
      .select('slug, category, question, answer_md, updated_at')
      .eq('status', 'published')
      .order('question', { ascending: true });

    if (error) {
      console.warn('Could not load support articles:', error.message);
      return [];
    }
    return (data ?? []).map((row: any) => ({
      slug: String(row.slug),
      category: String(row.category),
      question: String(row.question),
      answer: String(row.answer_md ?? ''),
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
    }));
  },
};
