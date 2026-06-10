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
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          last_login_at: string | null
          name: string
          password_hash: string
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          last_login_at?: string | null
          name: string
          password_hash: string
          role?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          last_login_at?: string | null
          name?: string
          password_hash?: string
          role?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_config: {
        Row: {
          accent_color: string
          brand_name: string
          favicon_url: string | null
          id: number
          logo_dark_url: string | null
          logo_url: string | null
          primary_color: string
          secondary_color: string
          short_name: string
          tagline: string
          updated_at: string | null
        }
        Insert: {
          accent_color?: string
          brand_name?: string
          favicon_url?: string | null
          id?: number
          logo_dark_url?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          short_name?: string
          tagline?: string
          updated_at?: string | null
        }
        Update: {
          accent_color?: string
          brand_name?: string
          favicon_url?: string | null
          id?: number
          logo_dark_url?: string | null
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          short_name?: string
          tagline?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cms_content: {
        Row: {
          created_at: string | null
          id: string
          key: string
          section: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          section: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          section?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      cms_pages: {
        Row: {
          created_at: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          slug: string
          status: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          company: string | null
          country: string | null
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          notes: string | null
          phone: string | null
          read_at: string | null
          responded_at: string | null
          service_interest: string | null
          source_page: string | null
          status: string
        }
        Insert: {
          company?: string | null
          country?: string | null
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          notes?: string | null
          phone?: string | null
          read_at?: string | null
          responded_at?: string | null
          service_interest?: string | null
          source_page?: string | null
          status?: string
        }
        Update: {
          company?: string | null
          country?: string | null
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          notes?: string | null
          phone?: string | null
          read_at?: string | null
          responded_at?: string | null
          service_interest?: string | null
          source_page?: string | null
          status?: string
        }
        Relationships: []
      }
      email_branding: {
        Row: {
          footer_html: string | null
          id: number
          logo_url: string | null
          primary_color: string
          signature_html: string | null
          updated_at: string | null
        }
        Insert: {
          footer_html?: string | null
          id?: number
          logo_url?: string | null
          primary_color?: string
          signature_html?: string | null
          updated_at?: string | null
        }
        Update: {
          footer_html?: string | null
          id?: number
          logo_url?: string | null
          primary_color?: string
          signature_html?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_html: string
          enabled: boolean
          id: string
          subject: string
          template_key: string
          updated_at: string | null
        }
        Insert: {
          body_html: string
          enabled?: boolean
          id?: string
          subject: string
          template_key: string
          updated_at?: string | null
        }
        Update: {
          body_html?: string
          enabled?: boolean
          id?: string
          subject?: string
          template_key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      page_sections: {
        Row: {
          content: Json
          created_at: string | null
          display_order: number
          id: string
          page_slug: string
          section_type: string
          styles: Json | null
          updated_at: string | null
          visible: boolean
        }
        Insert: {
          content?: Json
          created_at?: string | null
          display_order?: number
          id?: string
          page_slug: string
          section_type: string
          styles?: Json | null
          updated_at?: string | null
          visible?: boolean
        }
        Update: {
          content?: Json
          created_at?: string | null
          display_order?: number
          id?: string
          page_slug?: string
          section_type?: string
          styles?: Json | null
          updated_at?: string | null
          visible?: boolean
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: number
          settings: Json
          updated_at: string | null
        }
        Insert: {
          id?: number
          settings?: Json
          updated_at?: string | null
        }
        Update: {
          id?: number
          settings?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          id: string
          title: string
          slug: string
          number: string | null
          summary: string | null
          icon: string | null
          hero_image: string | null
          body: string | null
          bullets: Json
          cta_text: string | null
          display_order: number
          status: string
          seo_title: string | null
          seo_description: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          slug: string
          number?: string | null
          summary?: string | null
          icon?: string | null
          hero_image?: string | null
          body?: string | null
          bullets?: Json
          cta_text?: string | null
          display_order?: number
          status?: string
          seo_title?: string | null
          seo_description?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          number?: string | null
          summary?: string | null
          icon?: string | null
          hero_image?: string | null
          body?: string | null
          bullets?: Json
          cta_text?: string | null
          display_order?: number
          status?: string
          seo_title?: string | null
          seo_description?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      case_studies: {
        Row: {
          id: string
          title: string
          slug: string
          client_name: string | null
          industry: string | null
          service_id: string | null
          summary: string | null
          cover_image: string | null
          body: string | null
          metrics: Json
          featured: boolean
          display_order: number
          status: string
          seo_title: string | null
          seo_description: string | null
          published_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          slug: string
          client_name?: string | null
          industry?: string | null
          service_id?: string | null
          summary?: string | null
          cover_image?: string | null
          body?: string | null
          metrics?: Json
          featured?: boolean
          display_order?: number
          status?: string
          seo_title?: string | null
          seo_description?: string | null
          published_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          client_name?: string | null
          industry?: string | null
          service_id?: string | null
          summary?: string | null
          cover_image?: string | null
          body?: string | null
          metrics?: Json
          featured?: boolean
          display_order?: number
          status?: string
          seo_title?: string | null
          seo_description?: string | null
          published_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          id: string
          name: string
          role: string | null
          photo: string | null
          bio: string | null
          credentials: string | null
          linkedin_url: string | null
          email: string | null
          display_order: number
          visible: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          role?: string | null
          photo?: string | null
          bio?: string | null
          credentials?: string | null
          linkedin_url?: string | null
          email?: string | null
          display_order?: number
          visible?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          role?: string | null
          photo?: string | null
          bio?: string | null
          credentials?: string | null
          linkedin_url?: string | null
          email?: string | null
          display_order?: number
          visible?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      articles: {
        Row: {
          id: string
          title: string
          slug: string
          excerpt: string | null
          body: string | null
          cover_url: string | null
          category: string | null
          author_id: string | null
          status: string
          seo_title: string | null
          seo_description: string | null
          featured: boolean
          published_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          slug: string
          excerpt?: string | null
          body?: string | null
          cover_url?: string | null
          category?: string | null
          author_id?: string | null
          status?: string
          seo_title?: string | null
          seo_description?: string | null
          featured?: boolean
          published_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          excerpt?: string | null
          body?: string | null
          cover_url?: string | null
          category?: string | null
          author_id?: string | null
          status?: string
          seo_title?: string | null
          seo_description?: string | null
          featured?: boolean
          published_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          id: string
          name: string
          role: string | null
          company: string | null
          text: string
          rating: number | null
          status: string
          testimonial_type: string
          video_url: string | null
          is_featured: boolean
          show_on_landing: boolean
          display_order: number
          created_at: string | null
          approved_at: string | null
        }
        Insert: {
          id?: string
          name: string
          role?: string | null
          company?: string | null
          text: string
          rating?: number | null
          status?: string
          testimonial_type?: string
          video_url?: string | null
          is_featured?: boolean
          show_on_landing?: boolean
          display_order?: number
          created_at?: string | null
          approved_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          role?: string | null
          company?: string | null
          text?: string
          rating?: number | null
          status?: string
          testimonial_type?: string
          video_url?: string | null
          is_featured?: boolean
          show_on_landing?: boolean
          display_order?: number
          created_at?: string | null
          approved_at?: string | null
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
