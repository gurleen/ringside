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
    PostgrestVersion: '14.5'
  }
  predictions: {
    Tables: {
      match_predictions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          match_id: string
          points_awarded: number | null
          predicted_participants: Json
          predicted_side_index: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          match_id: string
          points_awarded?: number | null
          predicted_participants: Json
          predicted_side_index: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          match_id?: string
          points_awarded?: number | null
          predicted_participants?: Json
          predicted_side_index?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      score_event_predictions: { Args: { p_event_id: string }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      dashboard_cache: {
        Row: {
          key: string
          payload: Json
          refreshed_at: string
        }
        Insert: {
          key: string
          payload: Json
          refreshed_at?: string
        }
        Update: {
          key?: string
          payload?: Json
          refreshed_at?: string
        }
        Relationships: []
      }
      event_commentators: {
        Row: {
          event_id: string
          seq: number
          wrestler_id: string | null
          wrestler_name: string | null
        }
        Insert: {
          event_id: string
          seq: number
          wrestler_id?: string | null
          wrestler_name?: string | null
        }
        Update: {
          event_id?: string
          seq?: number
          wrestler_id?: string | null
          wrestler_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'event_commentators_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: {
          arena: string | null
          broadcast_date: string | null
          broadcast_type: string | null
          date: string | null
          event_date: string | null
          event_rating: number | null
          event_time: string | null
          event_timezone: string | null
          event_type: string | null
          event_votes: number | null
          id: string
          location: string | null
          name: string | null
          profile_url: string | null
          promotion: string | null
          tv_network: string | null
        }
        Insert: {
          arena?: string | null
          broadcast_date?: string | null
          broadcast_type?: string | null
          date?: string | null
          event_date?: string | null
          event_rating?: number | null
          event_time?: string | null
          event_timezone?: string | null
          event_type?: string | null
          event_votes?: number | null
          id: string
          location?: string | null
          name?: string | null
          profile_url?: string | null
          promotion?: string | null
          tv_network?: string | null
        }
        Update: {
          arena?: string | null
          broadcast_date?: string | null
          broadcast_type?: string | null
          date?: string | null
          event_date?: string | null
          event_rating?: number | null
          event_time?: string | null
          event_timezone?: string | null
          event_type?: string | null
          event_votes?: number | null
          id?: string
          location?: string | null
          name?: string | null
          profile_url?: string | null
          promotion?: string | null
          tv_network?: string | null
        }
        Relationships: []
      }
      match_notes: {
        Row: {
          match_id: string
          note: string
          seq: number
        }
        Insert: {
          match_id: string
          note: string
          seq: number
        }
        Update: {
          match_id?: string
          note?: string
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: 'match_notes_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
        ]
      }
      match_side_participants: {
        Row: {
          match_side_id: string
          participant_id: string | null
          participant_name: string | null
          participant_role: string
          seq: number
        }
        Insert: {
          match_side_id: string
          participant_id?: string | null
          participant_name?: string | null
          participant_role: string
          seq: number
        }
        Update: {
          match_side_id?: string
          participant_id?: string | null
          participant_name?: string | null
          participant_role?: string
          seq?: number
        }
        Relationships: [
          {
            foreignKeyName: 'match_side_participants_match_side_id_fkey'
            columns: ['match_side_id']
            isOneToOne: false
            referencedRelation: 'match_sides'
            referencedColumns: ['id']
          },
        ]
      }
      match_sides: {
        Row: {
          id: string
          is_champion: boolean | null
          match_id: string
          side_index: number
          side_role: string
        }
        Insert: {
          id: string
          is_champion?: boolean | null
          match_id: string
          side_index: number
          side_role: string
        }
        Update: {
          id?: string
          is_champion?: boolean | null
          match_id?: string
          side_index?: number
          side_role?: string
        }
        Relationships: [
          {
            foreignKeyName: 'match_sides_match_id_fkey'
            columns: ['match_id']
            isOneToOne: false
            referencedRelation: 'matches'
            referencedColumns: ['id']
          },
        ]
      }
      matches: {
        Row: {
          duration: string | null
          event_id: string
          finish_note: string | null
          id: string
          match_index: number
          match_rating: number | null
          match_type: string | null
          match_votes: number | null
          result: string | null
          title_change: boolean | null
          title_id: string | null
          title_name: string | null
          won_rating: string | null
        }
        Insert: {
          duration?: string | null
          event_id: string
          finish_note?: string | null
          id: string
          match_index: number
          match_rating?: number | null
          match_type?: string | null
          match_votes?: number | null
          result?: string | null
          title_change?: boolean | null
          title_id?: string | null
          title_name?: string | null
          won_rating?: string | null
        }
        Update: {
          duration?: string | null
          event_id?: string
          finish_note?: string | null
          id?: string
          match_index?: number
          match_rating?: number | null
          match_type?: string | null
          match_votes?: number | null
          result?: string | null
          title_change?: boolean | null
          title_id?: string | null
          title_name?: string | null
          won_rating?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'matches_event_id_fkey'
            columns: ['event_id']
            isOneToOne: false
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          username: string
        }
        Insert: {
          created_at?: string
          id: string
          is_admin?: boolean
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          username?: string
        }
        Relationships: []
      }
      promotion_abbr: {
        Row: {
          abbreviation: string
          promotion_id: string
        }
        Insert: {
          abbreviation: string
          promotion_id: string
        }
        Update: {
          abbreviation?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'promotion_abbr_promotion_id_fkey'
            columns: ['promotion_id']
            isOneToOne: true
            referencedRelation: 'promotions'
            referencedColumns: ['id']
          },
        ]
      }
      promotion_name_history: {
        Row: {
          from_date: string | null
          name: string
          promotion_id: string
          seq: number
          to_date: string | null
        }
        Insert: {
          from_date?: string | null
          name: string
          promotion_id: string
          seq: number
          to_date?: string | null
        }
        Update: {
          from_date?: string | null
          name?: string
          promotion_id?: string
          seq?: number
          to_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'promotion_name_history_promotion_id_fkey'
            columns: ['promotion_id']
            isOneToOne: false
            referencedRelation: 'promotions'
            referencedColumns: ['id']
          },
        ]
      }
      promotions: {
        Row: {
          active_year_end: number | null
          active_year_start: number | null
          id: string
          location: string | null
          name: string
          profile_url: string | null
          rating: number | null
          votes: number | null
        }
        Insert: {
          active_year_end?: number | null
          active_year_start?: number | null
          id: string
          location?: string | null
          name: string
          profile_url?: string | null
          rating?: number | null
          votes?: number | null
        }
        Update: {
          active_year_end?: number | null
          active_year_start?: number | null
          id?: string
          location?: string | null
          name?: string
          profile_url?: string | null
          rating?: number | null
          votes?: number | null
        }
        Relationships: []
      }
      sdh_title_name_history: {
        Row: {
          from_date: string | null
          image_url: string | null
          name: string
          seq: number
          title_id: string
          to_date: string | null
        }
        Insert: {
          from_date?: string | null
          image_url?: string | null
          name: string
          seq: number
          title_id: string
          to_date?: string | null
        }
        Update: {
          from_date?: string | null
          image_url?: string | null
          name?: string
          seq?: number
          title_id?: string
          to_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sdh_title_name_history_title_id_fkey'
            columns: ['title_id']
            isOneToOne: false
            referencedRelation: 'sdh_titles'
            referencedColumns: ['id']
          },
        ]
      }
      sdh_title_reign_champions: {
        Row: {
          reign_count: number | null
          seq: number
          title_reign_id: string
          wrestler_id: string | null
          wrestler_name: string | null
        }
        Insert: {
          reign_count?: number | null
          seq: number
          title_reign_id: string
          wrestler_id?: string | null
          wrestler_name?: string | null
        }
        Update: {
          reign_count?: number | null
          seq?: number
          title_reign_id?: string
          wrestler_id?: string | null
          wrestler_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sdh_title_reign_champions_title_reign_id_fkey'
            columns: ['title_reign_id']
            isOneToOne: false
            referencedRelation: 'sdh_title_reigns'
            referencedColumns: ['id']
          },
        ]
      }
      sdh_title_reigns: {
        Row: {
          duration_days: number | null
          event_name: string | null
          event_url: string | null
          from_date: string | null
          id: string
          is_vacant: boolean | null
          location: string | null
          notes: string | null
          reign_number: number | null
          seq: number
          title_id: string
          to_date: string | null
        }
        Insert: {
          duration_days?: number | null
          event_name?: string | null
          event_url?: string | null
          from_date?: string | null
          id: string
          is_vacant?: boolean | null
          location?: string | null
          notes?: string | null
          reign_number?: number | null
          seq: number
          title_id: string
          to_date?: string | null
        }
        Update: {
          duration_days?: number | null
          event_name?: string | null
          event_url?: string | null
          from_date?: string | null
          id?: string
          is_vacant?: boolean | null
          location?: string | null
          notes?: string | null
          reign_number?: number | null
          seq?: number
          title_id?: string
          to_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sdh_title_reigns_title_id_fkey'
            columns: ['title_id']
            isOneToOne: false
            referencedRelation: 'sdh_titles'
            referencedColumns: ['id']
          },
        ]
      }
      sdh_titles: {
        Row: {
          brand: string | null
          current_champion: string | null
          date_established: string | null
          gender: string | null
          id: string
          image_url: string | null
          name: string
          profile_url: string | null
          promotion: string | null
          territory: string | null
          title_type: string | null
        }
        Insert: {
          brand?: string | null
          current_champion?: string | null
          date_established?: string | null
          gender?: string | null
          id: string
          image_url?: string | null
          name: string
          profile_url?: string | null
          promotion?: string | null
          territory?: string | null
          title_type?: string | null
        }
        Update: {
          brand?: string | null
          current_champion?: string | null
          date_established?: string | null
          gender?: string | null
          id?: string
          image_url?: string | null
          name?: string
          profile_url?: string | null
          promotion?: string | null
          territory?: string | null
          title_type?: string | null
        }
        Relationships: []
      }
      sdh_wrestler_alignments: {
        Row: {
          alignment: string
          details: string | null
          from_date: string | null
          seq: number
          to_date: string | null
          wrestler_id: string
        }
        Insert: {
          alignment: string
          details?: string | null
          from_date?: string | null
          seq: number
          to_date?: string | null
          wrestler_id: string
        }
        Update: {
          alignment?: string
          details?: string | null
          from_date?: string | null
          seq?: number
          to_date?: string | null
          wrestler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sdh_wrestler_alignments_wrestler_id_fkey'
            columns: ['wrestler_id']
            isOneToOne: false
            referencedRelation: 'sdh_wrestlers'
            referencedColumns: ['id']
          },
        ]
      }
      sdh_wrestler_attributes: {
        Row: {
          attr_type: string
          seq: number
          value: string
          wrestler_id: string
        }
        Insert: {
          attr_type: string
          seq: number
          value: string
          wrestler_id: string
        }
        Update: {
          attr_type?: string
          seq?: number
          value?: string
          wrestler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sdh_wrestler_attributes_wrestler_id_fkey'
            columns: ['wrestler_id']
            isOneToOne: false
            referencedRelation: 'sdh_wrestlers'
            referencedColumns: ['id']
          },
        ]
      }
      sdh_wrestler_images: {
        Row: {
          image_url: string
          label: string | null
          seq: number
          wrestler_id: string
        }
        Insert: {
          image_url: string
          label?: string | null
          seq: number
          wrestler_id: string
        }
        Update: {
          image_url?: string
          label?: string | null
          seq?: number
          wrestler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sdh_wrestler_images_wrestler_id_fkey'
            columns: ['wrestler_id']
            isOneToOne: false
            referencedRelation: 'sdh_wrestlers'
            referencedColumns: ['id']
          },
        ]
      }
      sdh_wrestler_name_history: {
        Row: {
          from_date: string | null
          name: string
          seq: number
          to_date: string | null
          wrestler_id: string
        }
        Insert: {
          from_date?: string | null
          name: string
          seq: number
          to_date?: string | null
          wrestler_id: string
        }
        Update: {
          from_date?: string | null
          name?: string
          seq?: number
          to_date?: string | null
          wrestler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sdh_wrestler_name_history_wrestler_id_fkey'
            columns: ['wrestler_id']
            isOneToOne: false
            referencedRelation: 'sdh_wrestlers'
            referencedColumns: ['id']
          },
        ]
      }
      sdh_wrestler_promotions: {
        Row: {
          brand: string | null
          from_date: string | null
          promotion: string
          seq: number
          to_date: string | null
          wrestler_id: string
        }
        Insert: {
          brand?: string | null
          from_date?: string | null
          promotion: string
          seq: number
          to_date?: string | null
          wrestler_id: string
        }
        Update: {
          brand?: string | null
          from_date?: string | null
          promotion?: string
          seq?: number
          to_date?: string | null
          wrestler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sdh_wrestler_promotions_wrestler_id_fkey'
            columns: ['wrestler_id']
            isOneToOne: false
            referencedRelation: 'sdh_wrestlers'
            referencedColumns: ['id']
          },
        ]
      }
      sdh_wrestler_roles: {
        Row: {
          from_date: string | null
          role: string
          seq: number
          to_date: string | null
          wrestler_id: string
        }
        Insert: {
          from_date?: string | null
          role: string
          seq: number
          to_date?: string | null
          wrestler_id: string
        }
        Update: {
          from_date?: string | null
          role?: string
          seq?: number
          to_date?: string | null
          wrestler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'sdh_wrestler_roles_wrestler_id_fkey'
            columns: ['wrestler_id']
            isOneToOne: false
            referencedRelation: 'sdh_wrestlers'
            referencedColumns: ['id']
          },
        ]
      }
      sdh_wrestlers: {
        Row: {
          age: number | null
          billed_from: string | null
          birthday: string | null
          birthplace: string | null
          gender: string | null
          height_cm: number | null
          id: string
          image_url: string | null
          name: string
          nationality: string | null
          profile_url: string | null
          real_name: string | null
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          billed_from?: string | null
          birthday?: string | null
          birthplace?: string | null
          gender?: string | null
          height_cm?: number | null
          id: string
          image_url?: string | null
          name: string
          nationality?: string | null
          profile_url?: string | null
          real_name?: string | null
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          billed_from?: string | null
          birthday?: string | null
          birthplace?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          name?: string
          nationality?: string | null
          profile_url?: string | null
          real_name?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      title_crosswalk: {
        Row: {
          cagematch_id: string
          confidence: number
          match_method: string
          sdh_id: string
        }
        Insert: {
          cagematch_id: string
          confidence: number
          match_method: string
          sdh_id: string
        }
        Update: {
          cagematch_id?: string
          confidence?: number
          match_method?: string
          sdh_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'title_crosswalk_cagematch_id_fkey'
            columns: ['cagematch_id']
            isOneToOne: false
            referencedRelation: 'titles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'title_crosswalk_sdh_id_fkey'
            columns: ['sdh_id']
            isOneToOne: false
            referencedRelation: 'sdh_titles'
            referencedColumns: ['id']
          },
        ]
      }
      title_reign_champions: {
        Row: {
          reign_count: number | null
          seq: number
          title_reign_id: string
          wrestler_id: string | null
          wrestler_name: string | null
        }
        Insert: {
          reign_count?: number | null
          seq: number
          title_reign_id: string
          wrestler_id?: string | null
          wrestler_name?: string | null
        }
        Update: {
          reign_count?: number | null
          seq?: number
          title_reign_id?: string
          wrestler_id?: string | null
          wrestler_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'title_reign_champions_title_reign_id_fkey'
            columns: ['title_reign_id']
            isOneToOne: false
            referencedRelation: 'title_reigns'
            referencedColumns: ['id']
          },
        ]
      }
      title_reigns: {
        Row: {
          duration_days: number | null
          from_date: string | null
          id: string
          location: string | null
          reign_number: number
          team_id: string | null
          team_name: string | null
          team_reign_count: number | null
          title_id: string
          to_date: string | null
        }
        Insert: {
          duration_days?: number | null
          from_date?: string | null
          id: string
          location?: string | null
          reign_number: number
          team_id?: string | null
          team_name?: string | null
          team_reign_count?: number | null
          title_id: string
          to_date?: string | null
        }
        Update: {
          duration_days?: number | null
          from_date?: string | null
          id?: string
          location?: string | null
          reign_number?: number
          team_id?: string | null
          team_name?: string | null
          team_reign_count?: number | null
          title_id?: string
          to_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'title_reigns_title_id_fkey'
            columns: ['title_id']
            isOneToOne: false
            referencedRelation: 'titles'
            referencedColumns: ['id']
          },
        ]
      }
      titles: {
        Row: {
          id: string
          name: string
          promotion: string | null
        }
        Insert: {
          id: string
          name: string
          promotion?: string | null
        }
        Update: {
          id?: string
          name?: string
          promotion?: string | null
        }
        Relationships: []
      }
      wrestler_attributes: {
        Row: {
          attr_type: string
          seq: number
          value: string
          wrestler_id: string
        }
        Insert: {
          attr_type: string
          seq: number
          value: string
          wrestler_id: string
        }
        Update: {
          attr_type?: string
          seq?: number
          value?: string
          wrestler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wrestler_attributes_wrestler_id_fkey'
            columns: ['wrestler_id']
            isOneToOne: false
            referencedRelation: 'wrestlers'
            referencedColumns: ['id']
          },
        ]
      }
      wrestler_crosswalk: {
        Row: {
          cagematch_id: string
          confidence: number
          match_method: string
          sdh_id: string
        }
        Insert: {
          cagematch_id: string
          confidence: number
          match_method: string
          sdh_id: string
        }
        Update: {
          cagematch_id?: string
          confidence?: number
          match_method?: string
          sdh_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wrestler_crosswalk_cagematch_id_fkey'
            columns: ['cagematch_id']
            isOneToOne: false
            referencedRelation: 'wrestlers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'wrestler_crosswalk_sdh_id_fkey'
            columns: ['sdh_id']
            isOneToOne: false
            referencedRelation: 'sdh_wrestlers'
            referencedColumns: ['id']
          },
        ]
      }
      wrestler_promotions: {
        Row: {
          promotion_id: string
          seq: number
          wrestler_id: string
        }
        Insert: {
          promotion_id: string
          seq: number
          wrestler_id: string
        }
        Update: {
          promotion_id?: string
          seq?: number
          wrestler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wrestler_promotions_wrestler_id_fkey'
            columns: ['wrestler_id']
            isOneToOne: false
            referencedRelation: 'wrestlers'
            referencedColumns: ['id']
          },
        ]
      }
      wrestler_role_date_ranges: {
        Row: {
          from_date: string | null
          seq: number
          to_date: string | null
          wrestler_role_id: number
        }
        Insert: {
          from_date?: string | null
          seq: number
          to_date?: string | null
          wrestler_role_id: number
        }
        Update: {
          from_date?: string | null
          seq?: number
          to_date?: string | null
          wrestler_role_id?: number
        }
        Relationships: [
          {
            foreignKeyName: 'wrestler_role_date_ranges_wrestler_role_id_fkey'
            columns: ['wrestler_role_id']
            isOneToOne: false
            referencedRelation: 'wrestler_roles'
            referencedColumns: ['id']
          },
        ]
      }
      wrestler_roles: {
        Row: {
          id: number
          role: string
          seq: number
          wrestler_id: string
        }
        Insert: {
          id: number
          role: string
          seq: number
          wrestler_id: string
        }
        Update: {
          id?: number
          role?: string
          seq?: number
          wrestler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'wrestler_roles_wrestler_id_fkey'
            columns: ['wrestler_id']
            isOneToOne: false
            referencedRelation: 'wrestlers'
            referencedColumns: ['id']
          },
        ]
      }
      wrestlers: {
        Row: {
          age: number | null
          birthday: string | null
          birthplace: string | null
          career_end: string | null
          career_experience_years: number | null
          career_shows: number | null
          career_start: string | null
          current_brand: string | null
          current_promotion: string | null
          gender: string | null
          height_cm: number | null
          id: string
          name: string
          profile_url: string | null
          roster_rating: number | null
          roster_votes: number | null
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          birthday?: string | null
          birthplace?: string | null
          career_end?: string | null
          career_experience_years?: number | null
          career_shows?: number | null
          career_start?: string | null
          current_brand?: string | null
          current_promotion?: string | null
          gender?: string | null
          height_cm?: number | null
          id: string
          name: string
          profile_url?: string | null
          roster_rating?: number | null
          roster_votes?: number | null
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          birthday?: string | null
          birthplace?: string | null
          career_end?: string | null
          career_experience_years?: number | null
          career_shows?: number | null
          career_start?: string | null
          current_brand?: string | null
          current_promotion?: string | null
          gender?: string | null
          height_cm?: number | null
          id?: string
          name?: string
          profile_url?: string | null
          roster_rating?: number | null
          roster_votes?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_clear_match_result: {
        Args: { p_match_id: string }
        Returns: undefined
      }
      admin_set_match_result: {
        Args: {
          p_match_id: string
          p_title_change?: boolean
          p_winner_side_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  reviews: {
    Tables: {
      match_reviews: {
        Row: {
          created_at: string
          id: string
          is_first_watch: boolean | null
          match_id: string
          rating: number | null
          review_text: string | null
          updated_at: string
          user_id: string
          viewing_method: string | null
          watched_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_first_watch?: boolean | null
          match_id: string
          rating?: number | null
          review_text?: string | null
          updated_at?: string
          user_id: string
          viewing_method?: string | null
          watched_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_first_watch?: boolean | null
          match_id?: string
          rating?: number | null
          review_text?: string | null
          updated_at?: string
          user_id?: string
          viewing_method?: string | null
          watched_at?: string | null
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
  shows: {
    Tables: {
      event_attendance: {
        Row: {
          attendance: string
          created_at: string
          event_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendance: string
          created_at?: string
          event_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendance?: string
          created_at?: string
          event_id?: string
          id?: string
          updated_at?: string
          user_id?: string
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

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] &
        DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] &
        DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  predictions: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  reviews: {
    Enums: {},
  },
  shows: {
    Enums: {},
  },
} as const
