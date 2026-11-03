/** Tipos partilhados entre servidor e browser (nada de segredos aqui). */

export type CurrencyCode = "MT" | "BRL";

export type Product = {
  id: string;
  name: string;
  tagline: string;
  price: number;
  features: string[];
  premium: boolean;
  hasPdf: boolean;
  sortOrder: number;
};

export type Region = {
  country: string;
  currency: CurrencyCode;
  /** "MT" | "R$" */
  symbol: string;
  isMozambique: boolean;
};

export type OrderStatus =
  "pending" | "awaiting_review" | "paid" | "delivered" | "cancelled" | "expired";

export type OrderRow = {
  id: string;
  created_at: string;
  product_id: string;
  product_name: string;
  amount: number;
  currency: string;
  method: string;
  status: OrderStatus;
  country: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_contact: string | null;
  document: string | null;
  emola_number: string | null;
  emola_target: string | null;
  confirmation_message: string | null;
  payment_reference: string | null;
};

/**
 * Carteira móvel usada nos pagamentos de Moçambique.
 * O número e o titular são editáveis no painel `/admin` (separador Pagamentos).
 */
export type PaymentMethod = {
  id: string;
  label: string;
  number: string;
  holder: string;
  note: string;
  active: boolean;
  sortOrder: number;
};

export type VisitRow = {
  id: number;
  created_at: string;
  path: string | null;
  country: string | null;
  referrer: string | null;
};

export type SupportAuthor = "visitor" | "assistant" | "admin" | "system";

export type SupportMessage = {
  id: number;
  created_at: string;
  session_id: string;
  author: SupportAuthor;
  kind: "message" | "human_request";
  content: string;
  admin_name: string | null;
};

export type SupportThread = {
  session_id: string;
  last_at: string;
  total: number;
  human_requested: boolean;
  last_content: string;
  last_author: SupportAuthor;
  country: string | null;
  admin_replies: number;
};

export type AdminKpis = {
  confirmedSales: number;
  revenueBrl: number;
  revenueMz: number;
  pendingOrders: number;
  awaitingReview: number;
  visitsTotal: number;
  visitsToday: number;
  visits7d: number;
  salesByProduct: { id: string; name: string; count: number }[];
};

export const FALLBACK_PRODUCTS: Product[] = [
  {
    id: "beta",
    name: "Beta",
    tagline: "O primeiro passo",
    price: 19.9,
    features: ["Ebook digital", "Como Fazer 50K Antes de 2027", "Versão Beta"],
    premium: false,
    hasPdf: false,
    sortOrder: 1,
  },
  {
    id: "premium",
    name: "Premium",
    tagline: "Vá além do essencial",
    price: 399.89,
    features: [
      "Ebook digital",
      "Estratégias mais avançadas",
      "Conteúdo focado em acelerar a execução",
    ],
    premium: true,
    hasPdf: false,
    sortOrder: 2,
  },
];

/** Carteiras móveis por omissão (Moçambique). O painel /admin pode alterar. */
export const FALLBACK_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: "emola",
    label: "e-Mola",
    number: "8738373838",
    holder: "MenteExperta",
    note: "Transferência e-Mola para a conta MenteExperta.",
    active: true,
    sortOrder: 1,
  },
  {
    id: "mpesa",
    label: "M-Pesa",
    number: "8783838929",
    holder: "Experience Beta",
    note: "Transferência M-Pesa para a conta MenteExperta.",
    active: true,
    sortOrder: 2,
  },
];

export function formatPrice(price: number): string {
  return price.toFixed(2).replace(".", ",");
}

export function currencySymbol(currency: CurrencyCode): string {
  return currency === "MT" ? "MT" : "R$";
}
