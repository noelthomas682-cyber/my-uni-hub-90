export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assignments: {
        Row: {
          assignment_type: string | null
          completed_at: string | null
          connection_id: string | null
          course_code: string | null
          course_name: string | null
          created_at: string
          description: string | null
          due_date: string
          external_id: string | null
          id: string
          is_complete: boolean | null
          metadata: Json | null
          points_possible: number | null
          priority: string | null
          source: string | null
          submission_url: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          assignment_type?: string | null
          completed_at?: string | null
          connection_id?: string | null
          course_code?: string | null
          course_name?: string | null
          created_at?: string
          description?: string | null
          due_date: string
          external_id?: string | null
          id?: string
          is_complete?: boolean | null
          metadata?: Json | null
          points_possible?: number | null
          priority?: string | null
          source?: string | null
          submission_url?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          assignment_type?: string | null
          completed_at?: string | null
          connection_id?: string | null
          course_code?: string | null
          course_name?: string | null
          created_at?: string
          description?: string | null
          due_date?: string
          external_id?: string | null
          id?: string
          is_complete?: boolean | null
          metadata?: Json | null
          points_possible?: number | null
          priority?: string | null
          source?: string | null
          submission_url?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "lms_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          colour: string | null
          course_code: string | null
          course_name: string | null
          created_at: string
          end_time: string
          event_type: string | null
          external_id: string | null
          id: string
          is_blocked: boolean | null
          is_recurring: boolean | null
          location: string | null
          metadata: Json | null
          source: string | null
          start_time: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          colour?: string | null
          course_code?: string | null
          course_name?: string | null
          created_at?: string
          end_time: string
          event_type?: string | null
          external_id?: string | null
          id?: string
          is_blocked?: boolean | null
          is_recurring?: boolean | null
          location?: string | null
          metadata?: Json | null
          source?: string | null
          start_time: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          colour?: string | null
          course_code?: string | null
          course_name?: string | null
          created_at?: string
          end_time?: string
          event_type?: string | null
          external_id?: string | null
          id?: string
          is_blocked?: boolean | null
          is_recurring?: boolean | null
          location?: string | null
          metadata?: Json | null
          source?: string | null
          start_time?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          contact_user_id: string
          created_at: string
          id: string
          nickname: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_user_id: string
          created_at?: string
          id?: string
          nickname?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_user_id?: string
          created_at?: string
          id?: string
          nickname?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string | null
          team_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name?: string | null
          team_id?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string | null
          team_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          connection_id: string | null
          course_code: string
          course_name: string
          created_at: string
          external_id: string | null
          id: string
          instructor: string | null
          source: string
          user_id: string
        }
        Insert: {
          connection_id?: string | null
          course_code: string
          course_name: string
          created_at?: string
          external_id?: string | null
          id?: string
          instructor?: string | null
          source: string
          user_id: string
        }
        Update: {
          connection_id?: string | null
          course_code?: string
          course_name?: string
          created_at?: string
          external_id?: string | null
          id?: string
          instructor?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "lms_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      lms_connections: {
        Row: {
          access_token: string | null
          auth_method: string | null
          base_url: string | null
          client_id: string | null
          client_secret: string | null
          courses_count: number | null
          created_at: string
          detected_at: string | null
          email_domain: string | null
          events_count: number | null
          id: string
          instance_url: string
          is_active: boolean | null
          is_connected: boolean | null
          last_synced_at: string | null
          lms_name: string | null
          lms_type: string | null
          metadata: Json | null
          provider: string
          refresh_token: string | null
          sync_error: string | null
          tasks_count: number | null
          token_expires_at: string | null
          university_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          auth_method?: string | null
          base_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          courses_count?: number | null
          created_at?: string
          detected_at?: string | null
          email_domain?: string | null
          events_count?: number | null
          id?: string
          instance_url: string
          is_active?: boolean | null
          is_connected?: boolean | null
          last_synced_at?: string | null
          lms_name?: string | null
          lms_type?: string | null
          metadata?: Json | null
          provider: string
          refresh_token?: string | null
          sync_error?: string | null
          tasks_count?: number | null
          token_expires_at?: string | null
          university_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          auth_method?: string | null
          base_url?: string | null
          client_id?: string | null
          client_secret?: string | null
          courses_count?: number | null
          created_at?: string
          detected_at?: string | null
          email_domain?: string | null
          events_count?: number | null
          id?: string
          instance_url?: string
          is_active?: boolean | null
          is_connected?: boolean | null
          last_synced_at?: string | null
          lms_name?: string | null
          lms_type?: string | null
          metadata?: Json | null
          provider?: string
          refresh_token?: string | null
          sync_error?: string | null
          tasks_count?: number | null
          token_expires_at?: string | null
          university_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          id: string
          metadata: Json | null
          provider: string
          refresh_token: string | null
          scopes: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          id?: string
          metadata?: Json | null
          provider: string
          refresh_token?: string | null
          scopes?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          provider?: string
          refresh_token?: string | null
          scopes?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          university: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          university?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          university?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      session_rsvps: {
        Row: {
          id: string
          responded_at: string
          session_id: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          responded_at?: string
          session_id: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          responded_at?: string
          session_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_rsvps_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "team_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_activities: {
        Row: {
          activity_type: string
          content: string | null
          created_at: string
          id: string
          metadata: Json | null
          shared_by: string
          shared_with: string
          title: string
          url: string | null
        }
        Insert: {
          activity_type?: string
          content?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          shared_by: string
          shared_with: string
          title: string
          url?: string | null
        }
        Update: {
          activity_type?: string
          content?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          shared_by?: string
          shared_with?: string
          title?: string
          url?: string | null
        }
        Relationships: []
      }
      suggestions: {
        Row: {
          content: string | null
          course_code: string | null
          created_at: string
          id: string
          is_dismissed: boolean | null
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          content?: string | null
          course_code?: string | null
          created_at?: string
          id?: string
          is_dismissed?: boolean | null
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          content?: string | null
          course_code?: string | null
          created_at?: string
          id?: string
          is_dismissed?: boolean | null
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          course_code: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          is_complete: boolean | null
          metadata: Json | null
          priority: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_code?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_complete?: boolean | null
          metadata?: Json | null
          priority?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_code?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_complete?: boolean | null
          metadata?: Json | null
          priority?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          role: string
          team_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_sessions: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_time: string
          id: string
          location: string | null
          start_time: string
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_time: string
          id?: string
          location?: string | null
          start_time: string
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string
          id?: string
          location?: string | null
          start_time?: string
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          course_code: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          invite_code: string | null
          name: string
          updated_at: string
        }
        Insert: {
          course_code?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          invite_code?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          course_code?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          invite_code?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
