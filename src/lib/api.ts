import type {
  AdminFormRound, AdminState, CartItem, MyOrder, OrderForm, ProductPatch, StudentDetails, SubmitResult,
} from './types'

export interface AuthUser {
  id: string
  email: string
}

export type Bucket = 'form-assets' | 'payment-screenshots'

/** Everything the screens need. Two versions: Supabase (real) and an in-memory demo. */
export interface Api {
  mode: 'supabase' | 'demo'
  getUser(): Promise<AuthUser | null>
  onAuthChange(cb: () => void): () => void
  signIn(): Promise<void>
  signOut(): Promise<void>

  getForm(): Promise<OrderForm>
  /** A short-lived link to a private file (QR image, product photo, own screenshot). */
  fileUrl(bucket: Bucket, path: string): Promise<string>
  /** Uploads the (already compressed) screenshot into the student's own folder; returns its path. */
  uploadScreenshot(userId: string, file: Blob): Promise<string>
  submitOrder(args: {
    campaignId: string
    details: StudentDetails
    items: CartItem[]
    payment: { qr_id: string; txn_id: string; screenshot_path: string }
  }): Promise<SubmitResult>
  myOrders(): Promise<MyOrder[]>

  admin: {
    state(): Promise<AdminState>
    setOpen(campaignId: string, open: boolean): Promise<void>
    saveRound(campaignId: string, patch: Partial<Omit<AdminFormRound, 'campaign_id' | 'is_open'>>): Promise<void>
    saveProduct(productId: string, patch: ProductPatch): Promise<void>
    /** Uploads into form-assets; returns the path. */
    uploadAsset(folder: 'qr' | 'products', file: Blob): Promise<string>
    addQr(q: { payee_name: string; upi_id: string | null; image_path: string }): Promise<void>
    /** null = no live QR (students can't pay until one is live) */
    setActiveQr(id: string | null): Promise<void>
  }
}

/** Turns database / network errors into a sentence a student can act on. */
export function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e)
  if (/failed to fetch|network/i.test(msg)) return 'No internet connection. Check it and try again.'
  if (/JWT|not authenticated|Sign in/i.test(msg)) return 'Please sign in again with your @mdi.ac.in Google account.'
  if (/payload too large|exceeded the maximum allowed size/i.test(msg)) return 'That image is too big. Try a smaller screenshot.'
  if (/mime type|invalid_mime/i.test(msg)) return 'Upload a JPG, PNG or WebP image.'
  return msg
}
