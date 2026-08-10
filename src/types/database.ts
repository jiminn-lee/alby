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
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
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
      activity_events: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          actor_id: string
          album_id: string
          created_at: string
          id: string
          listen_later_item_id: string | null
          rating_id: string | null
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          actor_id: string
          album_id: string
          created_at?: string
          id?: string
          listen_later_item_id?: string | null
          rating_id?: string | null
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          actor_id?: string
          album_id?: string
          created_at?: string
          id?: string
          listen_later_item_id?: string | null
          rating_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "public_album_aggregates"
            referencedColumns: ["album_id"]
          },
          {
            foreignKeyName: "activity_events_listen_later_item_id_fkey"
            columns: ["listen_later_item_id"]
            isOneToOne: false
            referencedRelation: "listen_later_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_events_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: false
            referencedRelation: "ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      albums: {
        Row: {
          artist_name: string
          cover_path: string | null
          created_at: string
          id: string
          release_date: string | null
          release_type: Database["public"]["Enums"]["album_release_type"]
          spotify_id: string | null
          spotify_url: string | null
          title: string
          track_count: number | null
          updated_at: string
        }
        Insert: {
          artist_name: string
          cover_path?: string | null
          created_at?: string
          id?: string
          release_date?: string | null
          release_type?: Database["public"]["Enums"]["album_release_type"]
          spotify_id?: string | null
          spotify_url?: string | null
          title: string
          track_count?: number | null
          updated_at?: string
        }
        Update: {
          artist_name?: string
          cover_path?: string | null
          created_at?: string
          id?: string
          release_date?: string | null
          release_type?: Database["public"]["Enums"]["album_release_type"]
          spotify_id?: string | null
          spotify_url?: string | null
          title?: string
          track_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          activity_event_id: string
          body: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_event_id: string
          body: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_event_id?: string
          body?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_activity_event_id_fkey"
            columns: ["activity_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followed_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followed_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followed_id?: string
          follower_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_followed_id_fkey"
            columns: ["followed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      likes: {
        Row: {
          activity_event_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          activity_event_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          activity_event_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "likes_activity_event_id_fkey"
            columns: ["activity_event_id"]
            isOneToOne: false
            referencedRelation: "activity_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listen_later_items: {
        Row: {
          album_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          album_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          album_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listen_later_items_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listen_later_items_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "public_album_aggregates"
            referencedColumns: ["album_id"]
          },
          {
            foreignKeyName: "listen_later_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_private: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_private?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_private?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      ratings: {
        Row: {
          album_id: string
          created_at: string
          id: string
          note: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          album_id: string
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          album_id?: string
          created_at?: string
          id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "public_album_aggregates"
            referencedColumns: ["album_id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_album_aggregates: {
        Row: {
          album_id: string | null
          average_rating: number | null
          ratings_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_view_profile_content: {
        Args: { target_user_id: string; viewer_id?: string }
        Returns: boolean
      }
      get_album_rating_summary: {
        Args: { target_album_id: string }
        Returns: {
          friend_average: number
          friend_count: number
          global_average: number
          global_count: number
        }[]
      }
      get_home_feed: {
        Args: { before_time?: string; page_size?: number }
        Returns: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          actor_avatar_path: string
          actor_display_name: string
          actor_id: string
          actor_username: string
          album_id: string
          album_title: string
          artist_name: string
          comments_count: number
          cover_path: string
          created_at: string
          id: string
          liked_by_me: boolean
          likes_count: number
          my_rating_value: number
          rating_note: string
          rating_value: number
          saved_by_me: boolean
        }[]
      }
      get_profile_overview: {
        Args: { profile_username: string }
        Returns: {
          avatar_path: string
          bio: string
          can_view_content: boolean
          display_name: string
          followers_count: number
          following_count: number
          id: string
          is_following: boolean
          is_mutual: boolean
          is_private: boolean
          member_since: string
          ratings_count: number
          saved_count: number
          username: string
        }[]
      }
      is_mutual_follow: {
        Args: { target_user_id: string; viewer_id?: string }
        Returns: boolean
      }
      materialize_spotify_album: {
        Args: {
          album_artist_name: string
          album_cover_path: string
          album_release_date: string
          album_release_type: Database["public"]["Enums"]["album_release_type"]
          album_spotify_url: string
          album_title: string
          album_track_count: number
          spotify_album_id: string
        }
        Returns: {
          album_id: string
          outcome: string
        }[]
      }
    }
    Enums: {
      activity_type: "rating_created" | "rating_updated" | "listen_later_added"
      album_release_type: "album" | "ep"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_type: ["rating_created", "rating_updated", "listen_later_added"],
      album_release_type: ["album", "ep"],
    },
  },
} as const
