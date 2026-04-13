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
          points_possible: number | null
          priority: string | null
          source: string | null
          title: string
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
          points_possible?: number | null
          priority?: string | null
          source?: string | null
          title: string
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
          points_possible?: number | null
          priority?: string | null
          source?: string | null
          title?: string
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
          course_code: string | null
          course_name: string | null
          created_at: string
          end_time: string
          event_type: string | null
          external_id: string | null
          id: string
          is_recurring: boolean | null
          location: string | null
          source: string | null
          start_time: string
          title: string
          user_id: string
        }
        Insert: {
          course_code?: string | null
          course_name?: string | null
          created_at?: string
          end_time: string
          event_type?: string | null
          external_id?: string | null
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          source?: string | null
          start_time: string
          title: string
          user_id: string
        }
        Update: {
          course_code?: string | null
          course_name?: string | null
          created_at?: string
          end_time?: string
          event_type?: string | null
          external_id?: string | null
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          source?: string | null
          start_time?: string
          title?: string
          user_id?: string
        }
        Relationships: []
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
          client_id: string | null
          client_secret: string | null
          created_at: string
          id: string
          instance_url: string
          is_active: boolean | null
          last_synced_at: string | null
          provider: string
          refresh_token: string | null
          token_expires_at: string | null
          university_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          id?: string
          instance_url: string
          is_active?: boolean | null
          last_synced_at?: string | null
          provider: string
          refresh_token?: string | null
          token_expires_at?: string | null
          university_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          client_id?: string | null
          client_secret?: string | null
          created_at?: string
          id?: string
          instance_url?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
          token_expires_at?: string | null
          university_name?: string
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
