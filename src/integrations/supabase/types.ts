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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      absence_entries: {
        Row: {
          absence_type: Database["public"]["Enums"]["absence_type"]
          created_at: string
          date: string
          hours: number
          id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          absence_type: Database["public"]["Enums"]["absence_type"]
          created_at?: string
          date: string
          hours?: number
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          absence_type?: Database["public"]["Enums"]["absence_type"]
          created_at?: string
          date?: string
          hours?: number
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      current_entry: {
        Row: {
          breaks: Json | null
          id: string
          start_time: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          breaks?: Json | null
          id?: string
          start_time: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          breaks?: Json | null
          id?: string
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      overtime_allowance: {
        Row: {
          consumed_hours: number
          created_at: string
          id: string
          is_fully_consumed: boolean
          notes: string | null
          start_date: string
          total_hours: number
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          consumed_hours?: number
          created_at?: string
          id?: string
          is_fully_consumed?: boolean
          notes?: string | null
          start_date: string
          total_hours?: number
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          consumed_hours?: number
          created_at?: string
          id?: string
          is_fully_consumed?: boolean
          notes?: string | null
          start_date?: string
          total_hours?: number
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      time_entries: {
        Row: {
          breaks: Json | null
          created_at: string
          date: string
          end_time: string
          id: string
          is_surcharge_day: boolean
          net_work_duration_minutes: number
          regular_minutes: number
          start_time: string
          surcharge_amount: number
          surcharge_label: string | null
          surcharge_minutes: number
          total_break_duration_ms: number
          user_id: string
        }
        Insert: {
          breaks?: Json | null
          created_at?: string
          date: string
          end_time: string
          id?: string
          is_surcharge_day?: boolean
          net_work_duration_minutes: number
          regular_minutes?: number
          start_time: string
          surcharge_amount?: number
          surcharge_label?: string | null
          surcharge_minutes?: number
          total_break_duration_ms?: number
          user_id: string
        }
        Update: {
          breaks?: Json | null
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          is_surcharge_day?: boolean
          net_work_duration_minutes?: number
          regular_minutes?: number
          start_time?: string
          surcharge_amount?: number
          surcharge_label?: string | null
          surcharge_minutes?: number
          total_break_duration_ms?: number
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          auto_clock_in_enabled: boolean | null
          auto_clock_out_enabled: boolean | null
          break_reminder_enabled: boolean
          created_at: string
          custom_holidays: Json | null
          geofence_locations: Json | null
          geofence_radius_meters: number | null
          geofencing_enabled: boolean | null
          id: string
          notification_preferences: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_clock_in_enabled?: boolean | null
          auto_clock_out_enabled?: boolean | null
          break_reminder_enabled?: boolean
          created_at?: string
          custom_holidays?: Json | null
          geofence_locations?: Json | null
          geofence_radius_meters?: number | null
          geofencing_enabled?: boolean | null
          id?: string
          notification_preferences?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_clock_in_enabled?: boolean | null
          auto_clock_out_enabled?: boolean | null
          break_reminder_enabled?: boolean
          created_at?: string
          custom_holidays?: Json | null
          geofence_locations?: Json | null
          geofence_radius_meters?: number | null
          geofencing_enabled?: boolean | null
          id?: string
          notification_preferences?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vacation_allowance: {
        Row: {
          carried_over_days: number
          created_at: string
          id: string
          notes: string | null
          remaining_days: number | null
          total_days: number
          updated_at: string
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          carried_over_days?: number
          created_at?: string
          id?: string
          notes?: string | null
          remaining_days?: number | null
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id: string
          year: number
        }
        Update: {
          carried_over_days?: number
          created_at?: string
          id?: string
          notes?: string | null
          remaining_days?: number | null
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id?: string
          year?: number
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
      absence_type: "urlaub" | "juep" | "krankheit"
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
    Enums: {
      absence_type: ["urlaub", "juep", "krankheit"],
    },
  },
} as const
