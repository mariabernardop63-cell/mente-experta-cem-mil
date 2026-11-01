import { readEnvOr } from "./env.server";
import { FALLBACK_PAYMENT_METHODS, type PaymentMethod } from "./types";

/**
 * Carteiras móveis de Moçambique: e-Mola e M-Pesa.
 *
 * A fonte de verdade é a tabela `payment_methods` (editável em `/admin`).
 * Este módulo fornece apenas os valores de recurso usados quando a base de
 * dados ainda não está configurada — e que também podem ser ajustados por
 * ambiente, sem alterar código:
 *   EMOLA_NUMBER / EMOLA_HOLDER / MPESA_NUMBER / MPESA_HOLDER
 */

const ENV_BY_ID: Record<string, { number: string; holder: string }> = {
  emola: { number: "EMOLA_NUMBER", holder: "EMOLA_HOLDER" },
  mpesa: { number: "MPESA_NUMBER", holder: "MPESA_HOLDER" },
};

export function walletFallback(): PaymentMethod[] {
  return FALLBACK_PAYMENT_METHODS.map((method) => {
    const env = ENV_BY_ID[method.id];
    if (!env) return { ...method };
    return {
      ...method,
      number: readEnvOr(env.number, method.number),
      holder: readEnvOr(env.holder, method.holder),
    };
  });
}

/** Passos que o cliente MZ vê antes de submeter o comprovativo. */
export function walletInstructions(): string[] {
  return [
    "Abra a sua carteira móvel (e-Mola ou M-Pesa) e escolha Transferir.",
    "Escolha o número da carteira indicada abaixo e confirme o valor exato da edição escolhida.",
    "Copie a mensagem de confirmação que receber por SMS e cole no campo abaixo.",
    "Submeta o pedido e indique o seu WhatsApp ou e-mail para receber o ebook.",
  ];
}
