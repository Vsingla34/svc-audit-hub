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
      applications: {
        Row: {
          applied_at: string | null
          assignment_id: string
          auditor_id: string
          id: string
          status: string | null
        }
        Insert: {
          applied_at?: string | null
          assignment_id: string
          auditor_id: string
          id?: string
          status?: string | null
        }
        Update: {
          applied_at?: string | null
          assignment_id?: string
          auditor_id?: string
          id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_auditor_id_fkey"
            columns: ["auditor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          address: string
          allotted_to: string | null
          audit_date: string
          audit_type: string
          branch_name: string
          city: string
          client_name: string
          created_at: string | null
          created_by: string
          deadline_date: string
          fees: number
          id: string
          latitude: number | null
          longitude: number | null
          ope: number | null
          pincode: string
          state: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address: string
          allotted_to?: string | null
          audit_date: string
          audit_type: string
          branch_name: string
          city: string
          client_name: string
          created_at?: string | null
          created_by: string
          deadline_date: string
          fees: number
          id?: string
          latitude?: number | null
          longitude?: number | null
          ope?: number | null
          pincode: string
          state: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string
          allotted_to?: string | null
          audit_date?: string
          audit_type?: string
          branch_name?: string
          city?: string
          client_name?: string
          created_at?: string | null
          created_by?: string
          deadline_date?: string
          fees?: number
          id?: string
          latitude?: number | null
          longitude?: number | null
          ope?: number | null
          pincode?: string
          state?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_allotted_to_fkey"
            columns: ["allotted_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auditor_profiles: {
        Row: {
          base_city: string | null
          base_state: string | null
          created_at: string | null
          experience_years: number | null
          gst_number: string | null
          id: string
          kyc_status: string | null
          pan_card: string | null
          preferred_cities: string[] | null
          preferred_states: string[] | null
          qualifications: string[] | null
          rating: number | null
          resume_url: string | null
          updated_at: string | null
          user_id: string
          willing_to_travel_radius: number | null
        }
        Insert: {
          base_city?: string | null
          base_state?: string | null
          created_at?: string | null
          experience_years?: number | null
          gst_number?: string | null
          id?: string
          kyc_status?: string | null
          pan_card?: string | null
          preferred_cities?: string[] | null
          preferred_states?: string[] | null
          qualifications?: string[] | null
          rating?: number | null
          resume_url?: string | null
          updated_at?: string | null
          user_id: string
          willing_to_travel_radius?: number | null
        }
        Update: {
          base_city?: string | null
          base_state?: string | null
          created_at?: string | null
          experience_years?: number | null
          gst_number?: string | null
          id?: string
          kyc_status?: string | null
          pan_card?: string | null
          preferred_cities?: string[] | null
          preferred_states?: string[] | null
          qualifications?: string[] | null
          rating?: number | null
          resume_url?: string | null
          updated_at?: string | null
          user_id?: string
          willing_to_travel_radius?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auditor_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          assignment_id: string
          auditor_id: string
          base_amount: number
          created_at: string
          id: string
          invoice_date: string
          invoice_number: string
          net_payable: number
          ope_amount: number | null
          payment_date: string | null
          payment_reference: string | null
          payment_remarks: string | null
          payment_status: string
          tds_amount: number
          tds_rate: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          assignment_id: string
          auditor_id: string
          base_amount: number
          created_at?: string
          id?: string
          invoice_date?: string
          invoice_number: string
          net_payable: number
          ope_amount?: number | null
          payment_date?: string | null
          payment_reference?: string | null
          payment_remarks?: string | null
          payment_status?: string
          tds_amount: number
          tds_rate?: number | null
          total_amount: number
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          auditor_id?: string
          base_amount?: number
          created_at?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          net_payable?: number
          ope_amount?: number | null
          payment_date?: string | null
          payment_reference?: string | null
          payment_remarks?: string | null
          payment_status?: string
          tds_amount?: number
          tds_rate?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_auditor_id_fkey"
            columns: ["auditor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "auditor" | "client"
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
      app_role: ["admin", "auditor", "client"],
    },
  },
} as const
