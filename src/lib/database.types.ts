
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "activities": {
                  Row: {
                    "active": boolean,"bring": (string)[],"child_id": string,"household_id": string,"id": string,"start_time": string,"title": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"bring"?: (string)[],"child_id": string,"household_id": string,"id"?: string,"start_time": string,"title": string,"weekday": number
                  }
                  Update: {
                    "active"?: boolean,"bring"?: (string)[],"child_id"?: string,"household_id"?: string,"id"?: string,"start_time"?: string,"title"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "activities_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "activities_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"children": {
                  Row: {
                    "class_name": string | null,"color": string,"household_id": string,"id": string,"name": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "class_name"?: string | null,"color"?: string,"household_id": string,"id"?: string,"name": string,"sort"?: number
                  }
                  Update: {
                    "class_name"?: string | null,"color"?: string,"household_id"?: string,"id"?: string,"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "children_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"holidays": {
                  Row: {
                    "ends_on": string,"household_id": string,"id": string,"label": string | null,"starts_on": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ends_on": string,"household_id": string,"id"?: string,"label"?: string | null,"starts_on": string
                  }
                  Update: {
                    "ends_on"?: string,"household_id"?: string,"id"?: string,"label"?: string | null,"starts_on"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "holidays_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"households": {
                  Row: {
                    "activity_lead_minutes": number,"created_at": string,"id": string,"name": string,"notify_parents_activities": boolean,"notify_parents_all_ready": boolean,"prep_deadline_time": string,"prep_nudge_time": string | null,"prep_release_time": string,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_lead_minutes"?: number,"created_at"?: string,"id"?: string,"name": string,"notify_parents_activities"?: boolean,"notify_parents_all_ready"?: boolean,"prep_deadline_time"?: string,"prep_nudge_time"?: string | null,"prep_release_time"?: string,"timezone"?: string
                  }
                  Update: {
                    "activity_lead_minutes"?: number,"created_at"?: string,"id"?: string,"name"?: string,"notify_parents_activities"?: boolean,"notify_parents_all_ready"?: boolean,"prep_deadline_time"?: string,"prep_nudge_time"?: string | null,"prep_release_time"?: string,"timezone"?: string
                  }
                  Relationships: [
                    
                  ]
                },"members": {
                  Row: {
                    "created_at": string,"display_name": string,"household_id": string,"id": string,"phone": string | null,"role": Database["public"]['Enums']["member_role"],"setup_token": string | null,"setup_token_expires_at": string | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"household_id": string,"id"?: string,"phone"?: string | null,"role": Database["public"]['Enums']["member_role"],"setup_token"?: string | null,"setup_token_expires_at"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"household_id"?: string,"id"?: string,"phone"?: string | null,"role"?: Database["public"]['Enums']["member_role"],"setup_token"?: string | null,"setup_token_expires_at"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "attempts": number,"body": string,"channels": (string)[],"dedupe_key": string,"delivered_at": string | null,"delivery": Json | null,"household_id": string,"id": string,"kind": string,"link": string | null,"member_id": string,"read_at": string | null,"sent_at": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"body": string,"channels"?: (string)[],"dedupe_key": string,"delivered_at"?: string | null,"delivery"?: Json | null,"household_id": string,"id"?: string,"kind": string,"link"?: string | null,"member_id": string,"read_at"?: string | null,"sent_at"?: string,"title": string
                  }
                  Update: {
                    "attempts"?: number,"body"?: string,"channels"?: (string)[],"dedupe_key"?: string,"delivered_at"?: string | null,"delivery"?: Json | null,"household_id"?: string,"id"?: string,"kind"?: string,"link"?: string | null,"member_id"?: string,"read_at"?: string | null,"sent_at"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"outfits": {
                  Row: {
                    "household_id": string,"id": string,"is_school": boolean,"items": (string)[],"name": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "household_id": string,"id"?: string,"is_school"?: boolean,"items"?: (string)[],"name": string,"sort"?: number
                  }
                  Update: {
                    "household_id"?: string,"id"?: string,"is_school"?: boolean,"items"?: (string)[],"name"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "outfits_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"overrides": {
                  Row: {
                    "child_id": string,"extra_items": (string)[],"id": string,"note": string | null,"on_date": string,"outfit_id": string | null,"source": Database["public"]['Enums']["override_source"]
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"extra_items"?: (string)[],"id"?: string,"note"?: string | null,"on_date": string,"outfit_id"?: string | null,"source"?: Database["public"]['Enums']["override_source"]
                  }
                  Update: {
                    "child_id"?: string,"extra_items"?: (string)[],"id"?: string,"note"?: string | null,"on_date"?: string,"outfit_id"?: string | null,"source"?: Database["public"]['Enums']["override_source"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "overrides_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "overrides_outfit_id_fkey"
      columns: ["outfit_id"]
isOneToOne: false
      referencedRelation: "outfits"
      referencedColumns: ["id"]
    }
                  ]
                },"prep_items": {
                  Row: {
                    "checked_at": string | null,"checked_by": string | null,"child_id": string,"group_label": string,"id": string,"label": string,"session_id": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "checked_at"?: string | null,"checked_by"?: string | null,"child_id": string,"group_label": string,"id"?: string,"label": string,"session_id": string,"sort"?: number
                  }
                  Update: {
                    "checked_at"?: string | null,"checked_by"?: string | null,"child_id"?: string,"group_label"?: string,"id"?: string,"label"?: string,"session_id"?: string,"sort"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "prep_items_checked_by_fkey"
      columns: ["checked_by"]
isOneToOne: false
      referencedRelation: "member_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prep_items_checked_by_fkey"
      columns: ["checked_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prep_items_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "prep_items_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "prep_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"prep_sessions": {
                  Row: {
                    "completed_at": string | null,"deadline_at": string,"for_date": string,"household_id": string,"id": string,"released_at": string,"status": Database["public"]['Enums']["session_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"deadline_at": string,"for_date": string,"household_id": string,"id"?: string,"released_at"?: string,"status"?: Database["public"]['Enums']["session_status"]
                  }
                  Update: {
                    "completed_at"?: string | null,"deadline_at"?: string,"for_date"?: string,"household_id"?: string,"id"?: string,"released_at"?: string,"status"?: Database["public"]['Enums']["session_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "prep_sessions_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"last_ok_at": string | null,"member_id": string,"p256dh": string,"user_agent": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"last_ok_at"?: string | null,"member_id": string,"p256dh": string,"user_agent"?: string | null
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"last_ok_at"?: string | null,"member_id"?: string,"p256dh"?: string,"user_agent"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "push_subscriptions_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"security_events": {
                  Row: {
                    "created_at": string,"household_id": string,"id": string,"kind": string,"member_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"household_id": string,"id"?: string,"kind": string,"member_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"household_id"?: string,"id"?: string,"kind"?: string,"member_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "security_events_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "security_events_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "member_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "security_events_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assigned_to": string,"created_at": string,"created_by": string,"done_at": string | null,"done_by": string | null,"due_at": string | null,"household_id": string,"id": string,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_to": string,"created_at"?: string,"created_by": string,"done_at"?: string | null,"done_by"?: string | null,"due_at"?: string | null,"household_id": string,"id"?: string,"title": string
                  }
                  Update: {
                    "assigned_to"?: string,"created_at"?: string,"created_by"?: string,"done_at"?: string | null,"done_by"?: string | null,"due_at"?: string | null,"household_id"?: string,"id"?: string,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "member_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_assigned_to_fkey"
      columns: ["assigned_to"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "member_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "member_names"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_done_by_fkey"
      columns: ["done_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                },"weekly_routine": {
                  Row: {
                    "child_id": string,"outfit_id": string,"weekday": number
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"outfit_id": string,"weekday": number
                  }
                  Update: {
                    "child_id"?: string,"outfit_id"?: string,"weekday"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "weekly_routine_child_id_fkey"
      columns: ["child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "weekly_routine_outfit_id_fkey"
      columns: ["outfit_id"]
isOneToOne: false
      referencedRelation: "outfits"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "member_names": {
                  Row: {
                    "display_name": string,"household_id": string,"id": string,"role": Database["public"]['Enums']["member_role"]
                  }
                  ComputedFields: never
                  Insert: {
                           "display_name"?: string | null,"household_id"?: string | null,"id"?: string | null,"role"?: Database["public"]['Enums']["member_role"] | null
                         }
                        Update: {
                           "display_name"?: string | null,"household_id"?: string | null,"id"?: string | null,"role"?: Database["public"]['Enums']["member_role"] | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "members_household_id_fkey"
      columns: ["household_id"]
isOneToOne: false
      referencedRelation: "households"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "add_nanny":
{ Args: { "p_display_name": string,"p_phone": string }; Returns: string
                           },
"complete_task":
{ Args: { "p_task_id": string }; Returns: {
              "assigned_to": string,
"created_at": string,
"created_by": string,
"done_at": string | null,
"done_by": string | null,
"due_at": string | null,
"household_id": string,
"id": string,
"title": string
            }
                          SetofOptions: {
        from: "*"
        to: "tasks"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_household":
{ Args: { "p_display_name": string,"p_name": string,"p_phone"?: string }; Returns: string
                           },
"create_task":
{ Args: { "p_assigned_to": string,"p_due_local"?: string,"p_title": string }; Returns: string
                           },
"mark_notifications_read":
{ Args: { "p_ids": (string)[] }; Returns: undefined
                           },
"notification_health":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"pin_attempt_failed":
{ Args: { "p_phone": string }; Returns: string
                           },
"pin_attempt_start":
{ Args: { "p_phone": string }; Returns: string
                           },
"pin_attempts_reset":
{ Args: { "p_phone": string }; Returns: undefined
                           },
"prep_overview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"rebuild_prep_session":
{ Args: { "p_session_id": string }; Returns: undefined
                           },
"remove_day_change":
{ Args: { "p_override_id": string }; Returns: undefined
                           },
"reset_nanny_setup":
{ Args: { "p_member_id": string }; Returns: string
                           },
"run_scheduler":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"save_day_change":
{ Args: { "p_children": (string)[],"p_extra_items"?: (string)[],"p_note"?: string,"p_on_date": string,"p_outfit_id"?: string }; Returns: undefined
                           },
"send_test_notification":
{ Args: { "p_delay_minutes"?: number }; Returns: undefined
                           },
"tick_item":
{ Args: { "p_at"?: string,"p_checked": boolean,"p_item_id": string }; Returns: {
              "checked_at": string | null,
"checked_by": string | null,
"child_id": string,
"group_label": string,
"id": string,
"label": string,
"session_id": string,
"sort": number
            }
                          SetofOptions: {
        from: "*"
        to: "prep_items"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "member_role": "parent"|"nanny","override_source": "manual"|"school_notice","session_status": "pending"|"complete"|"overdue"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "member_role": ["parent", "nanny"],"override_source": ["manual", "school_notice"],"session_status": ["pending", "complete", "overdue"]
          }
        }
} as const
