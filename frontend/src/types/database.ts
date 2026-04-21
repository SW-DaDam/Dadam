// F-01 완료 후 아래 명령으로 교체:
// supabase gen types typescript --project-id <PROJECT_ID> > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          kakao_id: string | null
          name: string | null
          avatar_url: string | null
          role: 'senior' | 'reader'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      senior_profiles: {
        Row: {
          id: string
          user_id: string
          nickname: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['senior_profiles']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['senior_profiles']['Insert']>
      }
      family_links: {
        Row: {
          id: string
          senior_id: string
          reader_id: string
          relation: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['family_links']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['family_links']['Insert']>
      }
      memories: {
        Row: {
          id: string
          senior_id: string
          category: string | null
          content: string
          source_utterance_id: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['memories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['memories']['Insert']>
      }
      conversations: {
        Row: {
          id: string
          senior_id: string
          started_at: string
          ended_at: string | null
        }
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'started_at'>
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>
      }
      utterances: {
        Row: {
          id: string
          conversation_id: string
          role: 'user' | 'assistant'
          content: string
          audio_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['utterances']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['utterances']['Insert']>
      }
      books: {
        Row: {
          id: string
          senior_id: string
          title: string | null
          month: string
          cover_image_id: string | null
          epilogue: string | null
          status: 'draft' | 'published'
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['books']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['books']['Insert']>
      }
      chapters: {
        Row: {
          id: string
          book_id: string
          order: number
          title: string | null
          content: string
          included: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['chapters']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['chapters']['Insert']>
      }
      comments: {
        Row: {
          id: string
          chapter_id: string
          author_id: string
          content: string | null
          audio_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['comments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['comments']['Insert']>
      }
      replies: {
        Row: {
          id: string
          comment_id: string
          author_id: string
          content: string | null
          audio_url: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['replies']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['replies']['Insert']>
      }
      cover_images: {
        Row: {
          id: string
          senior_id: string
          storage_path: string
          theme: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['cover_images']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['cover_images']['Insert']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          read: boolean
          data: Json | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>
      }
      book_generation_jobs: {
        Row: {
          id: string
          book_id: string
          status: 'pending' | 'running' | 'done' | 'failed'
          error: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['book_generation_jobs']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['book_generation_jobs']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: 'senior' | 'reader'
      book_status: 'draft' | 'published'
      job_status: 'pending' | 'running' | 'done' | 'failed'
    }
  }
}
