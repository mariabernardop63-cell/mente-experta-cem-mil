import { readEnvOr } from "./env.server";

/**
 * Destinos de transferência e-Mola (Moçambique).
 *
 * Os números são configuráveis por ambiente para não ficarem presos ao código:
 *   EMOLA_PERSONAL_NUMBER / EMOLA_COMPANY_NUMBER / EMOLA_COMPANY_NAME
 */

export type EmolaTarget = {
  /** "personal" | "company" */
  kind: "personal" | "company";
  label: string;
  number: string;
  holder: string;
  note: string;
};

export type EmolaConfig = {
  personal: EmolaTarget;
  company: EmolaTarget;
  /** Passos que o cliente MZ vê antes de submeter o comprovativo. */
  instructions: string[];
};

export function emolaConfig(): EmolaConfig {
  return {
    personal: {
      kind: "personal",
      label: "Conta pessoal",
      number: readEnvOr("EMOLA_PERSONAL_NUMBER", "8738373838"),
      holder: readEnvOr("EMOLA_PERSONAL_HOLDER", "MenteExperta"),
      note: "Transferência e-Mola direta para a conta pessoal.",
    },
    company: {
      kind: "company",
      label: "Conta empresa",
      number: readEnvOr("EMOLA_COMPANY_NUMBER", "8783838929"),
      holder: readEnvOr("EMOLA_COMPANY_NAME", "Experience Beta"),
      note: "Use esta conta se estiver a pagar em nome de uma empresa.",
    },
    instructions: [
      "Abra o seu M-Pesa / e-Mola e escolha Transferir.",
      "Escolha o número indicado abaixo e confirme o valor exato da edição escolhida.",
      "Copie a mensagem de confirmação que receber por SMS e cole no campo abaixo.",
      "Submeta o pedido e indique o seu WhatsApp ou e-mail para receber o ebook.",
    ],
  };
}
