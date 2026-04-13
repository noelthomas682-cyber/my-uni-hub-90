export type LMSProvider = 'canvas' | 'moodle' | 'd2l' | 'blackboard';

export interface LMSConnection {
  id: string;
  user_id: string;
  provider: LMSProvider;
  instance_url: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: string;
  university_name: string;
  is_active: boolean;
  last_synced_at?: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  event_type: 'class' | 'lecture' | 'seminar' | 'lab' | 'tutorial' | 'exam' | 'personal';
  course_code?: string;
  course_name?: string;
  is_recurring: boolean;
  source: LMSProvider | 'manual';
  external_id?: string;
  created_at: string;
}

export interface Assignment {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  course_code?: string;
  course_name?: string;
  due_date: string;
  assignment_type: 'assignment' | 'quiz' | 'exam' | 'discussion' | 'project';
  priority: 'high' | 'medium' | 'low';
  is_complete: boolean;
  completed_at?: string;
  points_possible?: number;
  source: LMSProvider | 'manual';
  external_id?: string;
  created_at: string;
}

export interface Course {
  id: string;
  user_id: string;
  course_code: string;
  course_name: string;
  instructor?: string;
  source: LMSProvider;
  external_id: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  university?: string;
  avatar_url?: string;
  created_at: string;
}

export const LMS_CONFIG: Record<LMSProvider, {
  name: string;
  description: string;
  color: string;
  oauthPath: string;
  apiBase: string;
}> = {
  canvas: {
    name: 'Canvas',
    description: 'By Instructure — used by most US & Canadian universities',
    color: 'bg-lms-canvas',
    oauthPath: '/login/oauth2/auth',
    apiBase: '/api/v1',
  },
  moodle: {
    name: 'Moodle',
    description: 'Open-source LMS — widely used globally',
    color: 'bg-lms-moodle',
    oauthPath: '/admin/oauth2callback.php',
    apiBase: '/webservice/rest/server.php',
  },
  d2l: {
    name: 'D2L Brightspace',
    description: 'Common in Canadian universities — Valence API',
    color: 'bg-lms-d2l',
    oauthPath: '/d2l/auth/api/token',
    apiBase: '/d2l/api',
  },
  blackboard: {
    name: 'Blackboard',
    description: 'Anthology Learn — common in US & UK universities',
    color: 'bg-lms-blackboard',
    oauthPath: '/learn/api/public/v1/oauth2/token',
    apiBase: '/learn/api/public/v1',
  },
};
