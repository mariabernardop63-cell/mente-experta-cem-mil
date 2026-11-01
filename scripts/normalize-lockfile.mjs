#!/usr/bin/env node
/**
 * Normaliza os URLs do `package-lock.json` para o registry público do npm.
 *
 * Porque isto é necessário:
 *   O Replit instala pacotes através de um proxy interno
 *   (`http://package-firewall.replit.internal/npm/`). Quando o `npm install`
 *   corre lá, grava esses URLs no campo `resolved` do lockfile. A Vercel (e
 *   qualquer outro host) não consegue alcançar esse domínio, e o deploy falha
 *   com `ENOTFOUND package-firewall.replit.internal`.
 *
 * Os tarballs servidos pelo proxy são os mesmos do npm público, por isso basta
 * trocar o prefixo do URL — as versões e os hashes de integridade não mudam.
 *
 * Uso:
 *   npm run fix:lockfile
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REGISTRY = "https://registry.npmjs.org/";
const FIREWALL = /https?:\/\/package-firewall\.replit\.internal\/npm\//g;

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "package-lock.json");

const original = readFileSync(file, "utf8");
const matches = original.match(FIREWALL);

if (!matches) {
  console.log("package-lock.json já aponta para o registry público. Nada a fazer.");
  process.exit(0);
}

writeFileSync(file, original.replace(FIREWALL, REGISTRY));
console.log(
  `Corrigidos ${matches.length} URL(s) em package-lock.json → ${REGISTRY}\n` +
    "Faz commit do ficheiro antes do deploy.",
);
