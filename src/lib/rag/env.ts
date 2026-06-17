import "server-only";

/**
 * Centralised, validated access to server-only Research Library RAG secrets.
 * These keys must NEVER be exposed to the browser. Voyage is used for
 * embeddings; Anthropic for chat/generation. Both are read from the
 * environment and validated at import time so misconfiguration fails loudly.
 */
const voyageApiKey = process.env.VOYAGE_AI_API_KEY;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

if (!voyageApiKey) {
  throw new Error(
    "Eksik RAG yapılandırması. .env.local içinde VOYAGE_AI_API_KEY tanımlı olmalı.",
  );
}

if (!anthropicApiKey) {
  throw new Error(
    "Eksik RAG yapılandırması. .env.local içinde ANTHROPIC_API_KEY tanımlı olmalı.",
  );
}

export const ragEnv = { voyageApiKey, anthropicApiKey } as const;
