/**
 * Database types.
 *
 * Hand-authored from supabase/migrations/* in the same shape `supabase gen types
 * typescript` produces, so it is a drop-in replacement once we can regenerate. That needs
 * either Docker, or a Supabase access token:
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... npx supabase gen types typescript \
 *     --project-id qjusfigmihxwnnvqemwr > src/types/database.ts
 *
 * Keep this in sync with migrations until the generator takes over.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Role = "admin" | "ops_manager" | "finance" | "staff";
export type LocationType = "factory" | "showroom";
export type MovementType =
  | "opening"
  | "origination"
  | "transfer_out"
  | "transfer_in"
  | "dispatch"
  | "return"
  | "adjustment";
export type TransferStatus =
  | "dispatched"
  | "received"
  | "received_with_variance"
  | "cancelled";
export type StockCountStatus = "open" | "submitted" | "posted" | "cancelled";

export type Database = {
  __InternalSupabase: { PostgrestVersion: "12" };
  public: {
    Tables: {
      locations: {
        Row: {
          id: string;
          name: string;
          code: string;
          location_type: LocationType;
          can_originate: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          code: string;
          location_type: LocationType;
          can_originate?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          code?: string;
          location_type?: LocationType;
          can_originate?: boolean;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      product_categories: {
        Row: { id: string; name: string; sort_order: number; is_active: boolean };
        Insert: { id?: string; name: string; sort_order?: number; is_active?: boolean };
        Update: { id?: string; name?: string; sort_order?: number; is_active?: boolean };
        Relationships: [];
      };
      finishes: {
        Row: { id: string; name: string; sort_order: number; is_active: boolean };
        Insert: { id?: string; name: string; sort_order?: number; is_active?: boolean };
        Update: { id?: string; name?: string; sort_order?: number; is_active?: boolean };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          name: string;
          category_id: string | null;
          selling_price: number;
          standard_cost: number | null;
          image_path: string | null;
          shopify_sku: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category_id?: string | null;
          selling_price: number;
          standard_cost?: number | null;
          image_path?: string | null;
          shopify_sku?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category_id?: string | null;
          selling_price?: number;
          standard_cost?: number | null;
          image_path?: string | null;
          shopify_sku?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      adjustment_reasons: {
        Row: {
          id: string;
          label: string;
          requires_note: boolean;
          is_system: boolean;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          label: string;
          requires_note?: boolean;
          is_system?: boolean;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          label?: string;
          requires_note?: boolean;
          is_system?: boolean;
          is_active?: boolean;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: Role;
          home_location_id: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role: Role;
          home_location_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: Role;
          home_location_id?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_home_location_id_fkey";
            columns: ["home_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      transfers: {
        Row: {
          id: string;
          transfer_ref: string;
          from_location_id: string;
          to_location_id: string;
          status: TransferStatus;
          dispatch_date: string;
          dispatched_by: string;
          dispatched_at: string;
          receipt_date: string | null;
          received_by: string | null;
          received_at: string | null;
          order_number: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          transfer_ref: string;
          from_location_id: string;
          to_location_id: string;
          status: TransferStatus;
          dispatch_date: string;
          dispatched_by: string;
          dispatched_at?: string;
          receipt_date?: string | null;
          received_by?: string | null;
          received_at?: string | null;
          order_number?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          transfer_ref?: string;
          from_location_id?: string;
          to_location_id?: string;
          status?: TransferStatus;
          dispatch_date?: string;
          dispatched_by?: string;
          dispatched_at?: string;
          receipt_date?: string | null;
          received_by?: string | null;
          received_at?: string | null;
          order_number?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      transfer_lines: {
        Row: {
          id: string;
          transfer_id: string;
          product_id: string;
          finish_id: string | null;
          variant_note: string | null;
          qty_dispatched: number;
          qty_received: number | null;
          unit_selling_price: number;
          unit_standard_cost: number | null;
        };
        Insert: {
          id?: string;
          transfer_id: string;
          product_id: string;
          finish_id?: string | null;
          variant_note?: string | null;
          qty_dispatched: number;
          qty_received?: number | null;
          unit_selling_price: number;
          unit_standard_cost?: number | null;
        };
        Update: {
          id?: string;
          transfer_id?: string;
          product_id?: string;
          finish_id?: string | null;
          variant_note?: string | null;
          qty_dispatched?: number;
          qty_received?: number | null;
          unit_selling_price?: number;
          unit_standard_cost?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "transfer_lines_transfer_id_fkey";
            columns: ["transfer_id"];
            isOneToOne: false;
            referencedRelation: "transfers";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_counts: {
        Row: {
          id: string;
          count_ref: string;
          location_id: string;
          count_date: string;
          status: StockCountStatus;
          opened_by: string;
          opened_at: string;
          submitted_by: string | null;
          submitted_at: string | null;
          posted_by: string | null;
          posted_at: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          count_ref: string;
          location_id: string;
          count_date: string;
          status: StockCountStatus;
          opened_by: string;
          opened_at?: string;
          submitted_by?: string | null;
          submitted_at?: string | null;
          posted_by?: string | null;
          posted_at?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          count_ref?: string;
          location_id?: string;
          count_date?: string;
          status?: StockCountStatus;
          opened_by?: string;
          opened_at?: string;
          submitted_by?: string | null;
          submitted_at?: string | null;
          posted_by?: string | null;
          posted_at?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      stock_count_lines: {
        Row: {
          id: string;
          stock_count_id: string;
          product_id: string;
          finish_id: string | null;
          system_qty: number;
          counted_qty: number | null;
          variance: number | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          stock_count_id: string;
          product_id: string;
          finish_id?: string | null;
          system_qty: number;
          counted_qty?: number | null;
          notes?: string | null;
        };
        Update: {
          counted_qty?: number | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_count_lines_stock_count_id_fkey";
            columns: ["stock_count_id"];
            isOneToOne: false;
            referencedRelation: "stock_counts";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          id: number;
          movement_type: MovementType;
          location_id: string;
          product_id: string;
          finish_id: string | null;
          variant_note: string | null;
          quantity: number;
          unit_selling_price: number;
          unit_standard_cost: number | null;
          transaction_date: string;
          entered_at: string;
          entered_by: string;
          transfer_id: string | null;
          stock_count_id: string | null;
          order_number: string | null;
          reason_id: string | null;
          notes: string | null;
          reverses_movement_id: number | null;
          created_at: string;
        };
        Insert: {
          movement_type: MovementType;
          location_id: string;
          product_id: string;
          finish_id?: string | null;
          variant_note?: string | null;
          quantity: number;
          unit_selling_price?: number;
          unit_standard_cost?: number | null;
          transaction_date: string;
          entered_at?: string;
          entered_by: string;
          transfer_id?: string | null;
          stock_count_id?: string | null;
          order_number?: string | null;
          reason_id?: string | null;
          notes?: string | null;
          reverses_movement_id?: number | null;
          created_at?: string;
        };
        Update: { [_ in never]: never };
        Relationships: [];
      };
    };
    Views: {
      v_stock_balances: {
        Row: {
          location_id: string;
          product_id: string;
          finish_id: string | null;
          qty_on_hand: number;
          value_at_selling_price: number;
          value_at_standard_cost: number;
          lines_missing_cost: number;
        };
        Relationships: [];
      };
      v_in_transit: {
        Row: {
          id: string;
          transfer_ref: string;
          from_location_id: string;
          from_location: string;
          to_location_id: string;
          to_location: string;
          dispatch_date: string;
          dispatched_at: string;
          dispatched_by: string;
          dispatched_by_name: string;
          age_hours: number;
          line_count: number;
          value_at_selling_price: number;
        };
        Relationships: [];
      };
      v_open_variances: {
        Row: {
          transfer_id: string;
          transfer_ref: string;
          to_location_id: string;
          to_location: string;
          receipt_date: string | null;
          line_id: string;
          product_id: string;
          product: string;
          finish_id: string | null;
          qty_dispatched: number;
          qty_received: number;
          shortfall: number;
          unit_selling_price: number;
          shortfall_value: number;
        };
        Relationships: [];
      };
      v_adjustment_exceptions: {
        Row: {
          id: number;
          transaction_date: string;
          month: string;
          location_id: string;
          location: string;
          product_id: string;
          product: string;
          finish_id: string | null;
          quantity: number;
          unit_selling_price: number;
          abs_value_at_selling_price: number;
          reason_id: string | null;
          reason: string | null;
          notes: string | null;
          entered_by: string;
          entered_by_name: string;
          entered_at: string;
        };
        Relationships: [];
      };
      v_stock_accuracy: {
        Row: {
          location_id: string;
          location: string;
          month: string;
          lines_counted: number;
          lines_zero_variance: number;
          line_accuracy: number | null;
          unit_accuracy: number | null;
          units_over: number;
          units_short: number;
          net_value_impact: number;
        };
        Relationships: [];
      };
      v_count_lines_blind: {
        Row: {
          id: string;
          stock_count_id: string;
          product_id: string;
          finish_id: string | null;
          counted_qty: number | null;
          notes: string | null;
        };
        Relationships: [];
      };
      v_count_late_movements: {
        Row: {
          stock_count_id: string;
          movement_id: number;
          product_id: string;
          finish_id: string | null;
          quantity: number;
          transaction_date: string;
          entered_at: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      auth_role: { Args: Record<PropertyKey, never>; Returns: Role };
      auth_home_location: { Args: Record<PropertyKey, never>; Returns: string };
      auth_is_active: { Args: Record<PropertyKey, never>; Returns: boolean };
      fn_avg_unit_value: {
        Args: { p_location: string; p_product: string; p_finish: string | null };
        Returns: { avg_selling: number | null; avg_cost: number | null }[];
      };
      fn_stock_balances: {
        Args: { as_at: string; p_location?: string | null };
        Returns: {
          location_id: string;
          product_id: string;
          finish_id: string | null;
          qty_on_hand: number;
          value_at_selling_price: number;
          value_at_standard_cost: number;
          lines_missing_cost: number;
        }[];
      };
      rpc_dispatch_transfer: {
        Args: {
          p_from: string;
          p_to: string;
          p_date: string;
          p_order: string | null;
          p_notes: string | null;
          p_lines: Json;
        };
        Returns: Database["public"]["Tables"]["transfers"]["Row"];
      };
      rpc_receive_transfer: {
        Args: { p_transfer: string; p_date: string; p_lines: Json };
        Returns: Database["public"]["Tables"]["transfers"]["Row"];
      };
      rpc_cancel_transfer: {
        Args: { p_transfer: string; p_reason: string | null };
        Returns: Database["public"]["Tables"]["transfers"]["Row"];
      };
      rpc_open_stock_count: {
        Args: { p_location: string; p_date: string };
        Returns: Database["public"]["Tables"]["stock_counts"]["Row"];
      };
      rpc_add_count_line: {
        Args: { p_count: string; p_product: string; p_finish: string | null };
        Returns: Database["public"]["Tables"]["stock_count_lines"]["Row"];
      };
      rpc_set_count_line: {
        Args: { p_line: string; p_qty: number | null; p_notes?: string | null };
        Returns: undefined;
      };
      rpc_submit_stock_count: {
        Args: { p_count: string };
        Returns: Database["public"]["Tables"]["stock_counts"]["Row"];
      };
      rpc_post_stock_count: {
        Args: { p_count: string };
        Returns: Database["public"]["Tables"]["stock_counts"]["Row"];
      };
      rpc_cancel_stock_count: {
        Args: { p_count: string; p_reason?: string | null };
        Returns: Database["public"]["Tables"]["stock_counts"]["Row"];
      };
      rpc_commit_opening_balances: {
        Args: { p_go_live: string; p_rows: Json; p_force?: boolean };
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
