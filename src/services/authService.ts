import { supabase } from '../config/supabaseClient';
import { User, Address } from '../models/user';
import { mapAddresses } from '../utils/address';
import { notificationPermissionService } from './notificationPermissionService';

export const authService = {
  async signUp(email: string, password: string, fullName: string, phone: string): Promise<User | null> {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) return null;

    const newUser: Partial<User> = {
      id: authData.user.id,
      email,
      phone,
      fullName,
      ageVerified: false,
      addresses: [],
      favoriteProducts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { error: profileError } = await supabase.from('users').upsert({
      id: authData.user.id,
      email,
      phone,
      full_name: fullName,
      age_verified: false,
      addresses: [],
      favorite_products: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      console.warn('Profile upsert warning:', profileError.message);
    }

    return {
      id: authData.user.id,
      email,
      phone,
      fullName,
      ageVerified: false,
      addresses: [],
      favoriteProducts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  async signIn(email: string, password: string): Promise<User | null> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (!data.user) return null;
    return await this.getUserProfile(data.user.id);
  },

  async signOut(): Promise<void> {
    // Remove push delivery instruments while the session is still valid;
    // RLS only allows a user to delete their own rows.
    await notificationPermissionService.revoke();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getCurrentSessionUser() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return await this.getUserProfile(data.user.id);
  },

  async getUserProfile(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      const { data: authUser } = await supabase.auth.getUser();
      if (authUser?.user && authUser.user.id === userId) {
        return {
          id: userId,
          email: authUser.user.email || '',
          phone: authUser.user.user_metadata?.phone || '',
          fullName: authUser.user.user_metadata?.full_name || 'User',
          ageVerified: false,
          addresses: [],
          favoriteProducts: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      phone: data.phone,
      fullName: data.full_name,
      ageVerified: data.age_verified || false,
      idDocumentUrl: data.id_document_url,
      addresses: mapAddresses(data.addresses, data.id),
      favoriteProducts: data.favorite_products || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },

  async updateUserProfile(userId: string, updates: Partial<User>): Promise<User | null> {
    const payload: any = {
      updated_at: new Date().toISOString(),
    };
    if (updates.fullName !== undefined) payload.full_name = updates.fullName;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.ageVerified !== undefined) payload.age_verified = updates.ageVerified;
    if (updates.idDocumentUrl !== undefined) payload.id_document_url = updates.idDocumentUrl;
    if (updates.addresses !== undefined) payload.addresses = updates.addresses;
    if (updates.favoriteProducts !== undefined) payload.favorite_products = updates.favoriteProducts;

    const { error } = await supabase.from('users').update(payload).eq('id', userId);
    if (error) throw error;

    return await this.getUserProfile(userId);
  },

  async sendPhoneLoginOtp(phone: string): Promise<void> {
    // Passwordless phone login. For verifying a new number on an existing
    // account use requestPhoneVerification() instead.
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw error;
  },

  async verifyPhoneLoginOtp(phone: string, token: string): Promise<boolean> {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    if (error) throw error;
    return true;
  },

  /**
   * Verifies a new phone number on the signed-in account. Supabase sends a
   * `phone_change` code and keeps the current session; the number is only
   * written to `public.users` after confirmPhoneVerification() succeeds.
   */
  async requestPhoneVerification(phone: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ phone });
    if (error) throw error;
  },

  async confirmPhoneVerification(phone: string, token: string): Promise<boolean> {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'phone_change',
    });
    if (error) throw error;
    return true;
  },

  async sendPasswordResetEmail(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'com.queless.app://reset-password',
    });
    if (error) throw error;
  },

  async resetPassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async verifyAge(userId: string, idDocumentUrl?: string): Promise<boolean> {
    await this.updateUserProfile(userId, {
      ageVerified: true,
      idDocumentUrl,
    });
    return true;
  },

  async saveAddresses(userId: string, addresses: Address[]): Promise<User | null> {
    return await this.updateUserProfile(userId, { addresses });
  },

  async toggleFavorite(productId: string): Promise<string[]> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return [];

    const profile = await this.getUserProfile(data.user.id);
    const favorites = profile?.favoriteProducts ?? [];
    const nextFavorites = favorites.includes(productId)
      ? favorites.filter((id) => id !== productId)
      : [...favorites, productId];

    await this.updateUserProfile(data.user.id, { favoriteProducts: nextFavorites });
    return nextFavorites;
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const user = await authService.getUserProfile(session.user.id);
        callback(user);
      } else {
        callback(null);
      }
    });
  },
};
