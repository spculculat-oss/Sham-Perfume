import { UserProfile } from '../types/auth';

export const USER_EXPERIENCE_KEY = 'sham_perfume_user_experience_v1';
export const USER_ORDERS_KEY = 'sham_perfume_user_orders_v1';
export const USER_ANALYTICS_KEY = 'sham_perfume_user_analytics_v1';

export interface UserExperience {
  id: string;
  userId: string;
  type: 'formula_saved' | 'calculation_completed' | 'pyramid_created' | 'news_viewed' | 'ai_consulted' | 'spec_printed' | 'address_set' | 'language_changed';
  titleAr: string;
  titleEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface UserOrder {
  id: string;
  userId: string;
  type: 'formula' | 'calculation' | 'print' | 'export';
  titleAr: string;
  titleEn: string;
  timestamp: string;
  status: 'completed' | 'pending' | 'failed';
  details?: Record<string, unknown>;
}

export interface UserAnalytics {
  userId: string;
  totalLogins: number;
  totalFormulas: number;
  totalCalculations: number;
  totalPyramids: number;
  totalAIConsultations: number;
  totalSpecPrints: number;
  firstLogin: string;
  lastLogin: string;
  preferredLanguages: SupportedLanguage[];
}

export type SupportedLanguage = 'ar' | 'en' | 'fr' | 'es' | 'it' | 'de' | 'ru' | 'zh' | 'tr' | 'fa';

// Simple encryption simulation for user data privacy
function simpleEncrypt(data: string): string {
  try {
    // Using a simple obfuscated storage (in production, use Web Crypto API)
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const key = new TextEncoder().encode('sham-perfume-v1-secret');
    const encrypted = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
      encrypted[i] = dataBytes[i] ^ key[i % key.length];
    }
    return btoa(String.fromCharCode(...encrypted));
  } catch (e) {
    return data;
  }
}

function simpleDecrypt(encrypted: string): string {
  try {
    const decoded = atob(encrypted);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      bytes[i] = decoded.charCodeAt(i);
    }
    const key = new TextEncoder().encode('sham-perfume-v1-secret');
    const decrypted = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      decrypted[i] = bytes[i] ^ key[i % key.length];
    }
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    return encrypted;
  }
}

// Get user experience from localStorage (encrypted)
export function getUserExperiences(userId: string): UserExperience[] {
  try {
    const raw = localStorage.getItem(`${USER_EXPERIENCE_KEY}_${userId}`);
    if (raw) {
      const decrypted = simpleDecrypt(raw);
      return JSON.parse(decrypted) as UserExperience[];
    }
  } catch (e) {}
  return [];
}

// Save user experience (encrypted)
export function saveUserExperience(user: UserProfile, experience: Omit<UserExperience, 'id' | 'userId' | 'timestamp'>): UserExperience {
  const experiences = getUserExperiences(user.id);
  const newExperience: UserExperience = {
    id: 'exp-' + Date.now(),
    userId: user.id,
    timestamp: new Date().toISOString(),
    ...experience,
  };
  experiences.unshift(newExperience);
  // Keep only last 100 experiences
  const trimmed = experiences.slice(0, 100);
  const encrypted = simpleEncrypt(JSON.stringify(trimmed));
  localStorage.setItem(`${USER_EXPERIENCE_KEY}_${user.id}`, encrypted);
  return newExperience;
}

// Get user orders from localStorage (encrypted)
export function getUserOrders(userId: string): UserOrder[] {
  try {
    const raw = localStorage.getItem(`${USER_ORDERS_KEY}_${userId}`);
    if (raw) {
      const decrypted = simpleDecrypt(raw);
      return JSON.parse(decrypted) as UserOrder[];
    }
  } catch (e) {}
  return [];
}

// Save user order (encrypted)
export function saveUserOrder(user: UserProfile, order: Omit<UserOrder, 'id' | 'userId' | 'timestamp' | 'status'>): UserOrder {
  const orders = getUserOrders(user.id);
  const newOrder: UserOrder = {
    id: 'ord-' + Date.now(),
    userId: user.id,
    timestamp: new Date().toISOString(),
    status: 'completed',
    ...order,
  };
  orders.unshift(newOrder);
  const trimmed = orders.slice(0, 200);
  const encrypted = simpleEncrypt(JSON.stringify(trimmed));
  localStorage.setItem(`${USER_ORDERS_KEY}_${user.id}`, encrypted);
  return newOrder;
}

// Get user analytics
export function getUserAnalytics(userId: string): UserAnalytics | null {
  try {
    const raw = localStorage.getItem(`${USER_ANALYTICS_KEY}_${userId}`);
    if (raw) {
      const decrypted = simpleDecrypt(raw);
      return JSON.parse(decrypted) as UserAnalytics;
    }
  } catch (e) {}
  return null;
}

// Update user analytics
export function updateUserAnalytics(user: UserProfile, eventType: 'login' | 'formula' | 'calculation' | 'pyramid' | 'ai' | 'print'): UserAnalytics {
  let analytics = getUserAnalytics(user.id);
  
  if (!analytics) {
    analytics = {
      userId: user.id,
      totalLogins: 0,
      totalFormulas: 0,
      totalCalculations: 0,
      totalPyramids: 0,
      totalAIConsultations: 0,
      totalSpecPrints: 0,
      firstLogin: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      preferredLanguages: [],
    };
  }
  
  analytics.lastLogin = new Date().toISOString();
  switch (eventType) {
    case 'login':
      analytics.totalLogins++;
      break;
    case 'formula':
      analytics.totalFormulas++;
      break;
    case 'calculation':
      analytics.totalCalculations++;
      break;
    case 'pyramid':
      analytics.totalPyramids++;
      break;
    case 'ai':
      analytics.totalAIConsultations++;
      break;
    case 'print':
      analytics.totalSpecPrints++;
      break;
  }
  
  const encrypted = simpleEncrypt(JSON.stringify(analytics));
  localStorage.setItem(`${USER_ANALYTICS_KEY}_${user.id}`, encrypted);
  return analytics;
}

// Get all users (for admin access only)
export function getAllUsersExperiences(): Map<string, { user: UserProfile; experiences: UserExperience[]; orders: UserOrder[]; analytics: UserAnalytics | null }> {
  const result = new Map();
  try {
    const rawUsers = localStorage.getItem('sham_perfume_registered_users_db');
    if (rawUsers) {
      const users = JSON.parse(rawUsers) as Array<UserProfile & { password?: string }>;
      for (const user of users) {
        if (user.id) {
          result.set(user.id, {
            user: { ...user },
            experiences: getUserExperiences(user.id),
            orders: getUserOrders(user.id),
            analytics: getUserAnalytics(user.id),
          });
        }
      }
    }
  } catch (e) {}
  return result;
}

// Clear user data (for logout)
export function clearUserSessionData(userId: string): void {
  try {
    localStorage.removeItem(`${USER_EXPERIENCE_KEY}_${userId}`);
    localStorage.removeItem(`${USER_ORDERS_KEY}_${userId}`);
    // Keep analytics for historical data
  } catch (e) {}
}
