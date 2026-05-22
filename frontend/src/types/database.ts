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
      book_generation_jobs: {
        Row: {
          book_id: string | null
          created_at: string
          error_log: string | null
          id: string
          retry_count: number
          senior_id: string | null
          stage_payload: Json
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          book_id?: string | null
          created_at?: string
          error_log?: string | null
          id?: string
          retry_count?: number
          senior_id?: string | null
          stage_payload?: Json
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          book_id?: string | null
          created_at?: string
          error_log?: string | null
          id?: string
          retry_count?: number
          senior_id?: string | null
          stage_payload?: Json
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_generation_jobs_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_generation_jobs_senior_id_fkey"
            columns: ["senior_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          book_type: Database["public"]["Enums"]["book_type"]
          chapter_count: number
          cover_image_url: string | null
          created_at: string
          dedication: string | null
          id: string
          month: number
          published_at: string | null
          senior_id: string
          status: Database["public"]["Enums"]["book_status"]
          subtitle: string | null
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          book_type?: Database["public"]["Enums"]["book_type"]
          chapter_count?: number
          cover_image_url?: string | null
          created_at?: string
          dedication?: string | null
          id?: string
          month: number
          published_at?: string | null
          senior_id: string
          status?: Database["public"]["Enums"]["book_status"]
          subtitle?: string | null
          title: string
          updated_at?: string
          year: number
        }
        Update: {
          book_type?: Database["public"]["Enums"]["book_type"]
          chapter_count?: number
          cover_image_url?: string | null
          created_at?: string
          dedication?: string | null
          id?: string
          month?: number
          published_at?: string | null
          senior_id?: string
          status?: Database["public"]["Enums"]["book_status"]
          subtitle?: string | null
          title?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "books_senior_id_fkey"
            columns: ["senior_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chapters: {
        Row: {
          book_id: string
          content: string
          created_at: string
          id: string
          is_deleted: boolean
          photo_url: string | null
          sort_order: number
          source_utterance_ids: string[] | null
          theme: string
          title: string
          updated_at: string
        }
        Insert: {
          book_id: string
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          photo_url?: string | null
          sort_order?: number
          source_utterance_ids?: string[] | null
          theme: string
          title: string
          updated_at?: string
        }
        Update: {
          book_id?: string
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          photo_url?: string | null
          sort_order?: number
          source_utterance_ids?: string[] | null
          theme?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          audio_url: string | null
          author_id: string
          book_id: string
          content: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          author_id: string
          book_id: string
          content: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          author_id?: string
          book_id?: string
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          memory_extracted: boolean
          senior_id: string
          started_at: string
          summary: string | null
          utterance_count: number
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          memory_extracted?: boolean
          senior_id: string
          started_at?: string
          summary?: string | null
          utterance_count?: number
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          memory_extracted?: boolean
          senior_id?: string
          started_at?: string
          summary?: string | null
          utterance_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_senior_id_fkey"
            columns: ["senior_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cover_images: {
        Row: {
          book_id: string
          chapter_id: string | null
          created_at: string
          id: string
          image_url: string
          prompt: string | null
          status: Database["public"]["Enums"]["cover_status"]
        }
        Insert: {
          book_id: string
          chapter_id?: string | null
          created_at?: string
          id?: string
          image_url: string
          prompt?: string | null
          status?: Database["public"]["Enums"]["cover_status"]
        }
        Update: {
          book_id?: string
          chapter_id?: string | null
          created_at?: string
          id?: string
          image_url?: string
          prompt?: string | null
          status?: Database["public"]["Enums"]["cover_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cover_images_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cover_images_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      family_links: {
        Row: {
          accepted_at: string | null
          expires_at: string
          family_id: string | null
          id: string
          invite_code: string
          invite_status: Database["public"]["Enums"]["invite_status"]
          invited_at: string
          relationship: string | null
          senior_id: string
        }
        Insert: {
          accepted_at?: string | null
          expires_at: string
          family_id?: string | null
          id?: string
          invite_code: string
          invite_status?: Database["public"]["Enums"]["invite_status"]
          invited_at?: string
          relationship?: string | null
          senior_id: string
        }
        Update: {
          accepted_at?: string | null
          expires_at?: string
          family_id?: string | null
          id?: string
          invite_code?: string
          invite_status?: Database["public"]["Enums"]["invite_status"]
          invited_at?: string
          relationship?: string | null
          senior_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_links_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_links_senior_id_fkey"
            columns: ["senior_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memories: {
        Row: {
          created_at: string
          data: Json
          id: string
          senior_id: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          senior_id: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          senior_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "memories_senior_id_fkey"
            columns: ["senior_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          recipient_id: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      reply_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          reply_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          reply_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          reply_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reply_reactions_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "replies"
            referencedColumns: ["id"]
          },
        ]
      }
      replies: {
        Row: {
          audio_url: string | null
          comment_id: string
          content: string
          created_at: string
          id: string
          senior_id: string
        }
        Insert: {
          audio_url?: string | null
          comment_id: string
          content: string
          created_at?: string
          id?: string
          senior_id: string
        }
        Update: {
          audio_url?: string | null
          comment_id?: string
          content?: string
          created_at?: string
          id?: string
          senior_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replies_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replies_senior_id_fkey"
            columns: ["senior_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      senior_profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          dialect: string | null
          gender: string | null
          id: string
          interests_summary: string | null
          onboarding_completed: boolean
          region: string | null
          tts_speed: string
          tts_voice: string
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          dialect?: string | null
          gender?: string | null
          id: string
          interests_summary?: string | null
          onboarding_completed?: boolean
          region?: string | null
          tts_speed?: string
          tts_voice?: string
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          dialect?: string | null
          gender?: string | null
          id?: string
          interests_summary?: string | null
          onboarding_completed?: boolean
          region?: string | null
          tts_speed?: string
          tts_voice?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "senior_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      utterances: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sequence_number: number
          speaker: Database["public"]["Enums"]["speaker_role"]
          tags: Database["public"]["Enums"]["utterance_tag"][]
          used_in_short_book_id: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sequence_number: number
          speaker: Database["public"]["Enums"]["speaker_role"]
          tags?: Database["public"]["Enums"]["utterance_tag"][]
          used_in_short_book_id?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sequence_number?: number
          speaker?: Database["public"]["Enums"]["speaker_role"]
          tags?: Database["public"]["Enums"]["utterance_tag"][]
          used_in_short_book_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utterances_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utterances_used_in_short_book_id_fkey"
            columns: ["used_in_short_book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_all_memories: { Args: { p_senior_id: string }; Returns: undefined }
      get_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_family_of: { Args: { p_senior_id: string }; Returns: boolean }
      net_http_post_cover:
        | {
            Args: {
              p_anon_key: string
              p_book_id: string
              p_chapter_id: string
              p_secret: string
              p_senior_id: string
              p_url: string
            }
            Returns: number
          }
        | {
            Args: {
              p_book_id: string
              p_chapter_id: string
              p_secret: string
              p_senior_id: string
              p_url: string
            }
            Returns: undefined
          }
      publish_book: {
        Args: { book_id: string; dedication?: string }
        Returns: undefined
      }
      remove_memory_item:
        | {
            Args: {
              p_category: string
              p_item_index?: number
              p_item_key?: string
              p_senior_id: string
            }
            Returns: undefined
          }
        | { Args: { p_senior_id: string; p_text: string }; Returns: undefined }
      restore_chapter: { Args: { chapter_id: string }; Returns: undefined }
      select_cover: {
        Args: { book_id: string; cover_id: string }
        Returns: undefined
      }
      soft_delete_chapter: { Args: { chapter_id: string }; Returns: undefined }
      trigger_book_generation: {
        Args: { p_month: number; p_senior_id: string; p_year: number }
        Returns: string
      }
      trigger_short_book_generation: {
        Args: {
          p_senior_id: string
          p_topic_title: string
          p_utterance_ids: string[]
        }
        Returns: string
      }
      update_chapter_title: {
        Args: { chapter_id: string; new_title: string }
        Returns: undefined
      }
    }
    Enums: {
      book_status: "draft" | "editing" | "published"
      book_type: "monthly" | "short"
      cover_status: "candidate" | "selected" | "rejected"
      invite_status: "pending" | "accepted" | "expired" | "revoked"
      job_status:
        | "pending"
        | "aggregating"
        | "chaptering"
        | "cover_requested"
        | "done"
        | "failed"
      notification_type:
        | "new_book"
        | "new_comment"
        | "new_reply"
        | "invite_accepted"
        | "book_draft_ready"
      speaker_role: "senior" | "ai"
      user_role: "senior" | "family"
      utterance_tag:
        | "daily_mundane"
        | "memory_recall"
        | "emotional_peak"
        | "philosophy"
        | "relationship_event"
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
      book_status: ["draft", "editing", "published"],
      book_type: ["monthly", "short"],
      cover_status: ["candidate", "selected", "rejected"],
      invite_status: ["pending", "accepted", "expired", "revoked"],
      job_status: [
        "pending",
        "aggregating",
        "chaptering",
        "cover_requested",
        "done",
        "failed",
      ],
      notification_type: [
        "new_book",
        "new_comment",
        "new_reply",
        "invite_accepted",
        "book_draft_ready",
      ],
      speaker_role: ["senior", "ai"],
      user_role: ["senior", "family"],
      utterance_tag: [
        "daily_mundane",
        "memory_recall",
        "emotional_peak",
        "philosophy",
        "relationship_event",
      ],
    },
  },
} as const
