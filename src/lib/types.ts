// Shapes returned by the database functions in mart-orders/supabase/migrations/20261123120100_order_form.sql

export interface FormRound {
  campaign_id: string
  title: string
  intro: string | null
  item_cap: number
  student_batches: string[]
  courses: string[]
  sections: string[]
  print_batches: string[]
  name_max: number
  /** only active MART team members can see and order in this round */
  team_only: boolean
}

export interface FormProduct {
  id: string
  name: string
  colour: string
  price_inr: number
  sizes: string[]
  description: string | null
  photo_paths: string[]
  allow_custom_size: boolean
}

export interface PaymentQr {
  id: string
  payee_name: string
  upi_id: string | null
  image_path: string
}

export interface StudentDetails {
  name: string
  phone: string
  roll_no: string
  batch: string
  course: string
  section: string
}

export interface OrderForm {
  round: FormRound | null
  products: FormProduct[]
  qr: PaymentQr | null
  me: Partial<StudentDetails> | null
  email: string
  /** a MART-team-only round is open, and this user is not on the team (so `round` is null) */
  team_only_round_open: boolean
  is_form_admin: boolean
}

export interface CartItem {
  key: string
  product_id: string
  size: string
  print_name: string | null
  print_batch: string
}

export interface SubmitResult {
  order_id: string
  items: number
  total_inr: number
  submitted_at: string
}

export type ItemStatus = 'ordered' | 'sent_to_vendor' | 'received' | 'handed_over'
export type PaymentStatus = 'unchecked' | 'received' | 'problem'

export interface MyOrder {
  key: string
  round: string
  submitted_at: string | null
  total_inr: number
  payment_status: PaymentStatus | null
  items: {
    product: string
    colour: string
    size: string
    print_name: string | null
    print_batch: string | null
    status: ItemStatus
    price_inr: number
  }[]
}

// ---- form admin ----
export interface AdminFormRound {
  campaign_id: string
  is_open: boolean
  title: string | null
  intro: string | null
  item_cap: number
  name_max: number
  team_only: boolean
  /** look on the order form; set by MART super admins only (missing before the migration) */
  theme?: 'tees' | 'hoodies'
}

export interface AdminProduct {
  id: string
  name: string
  colour: string
  price_inr: number
  sizes: string[]
  ordered: number
  form: { shown: boolean; description: string | null; photo_paths: string[]; allow_custom_size: boolean } | null
}

export interface AdminRound {
  campaign_id: string
  name: string
  form: AdminFormRound | null
  orders: number
  products: AdminProduct[]
}

export interface AdminQr extends PaymentQr {
  active: boolean
  activated_at: string | null
  deactivated_at: string | null
  created_at: string
}

export interface AdminState {
  rounds: AdminRound[]
  qrs: AdminQr[]
}

/** Form-only display settings. Price, sizes and names are edited in MART Orders only. */
export interface ProductPatch {
  shown?: boolean
  description?: string | null
  photo_paths?: string[]
  allow_custom_size?: boolean
}
