'use strict';

const FREE = 20;
const BLOCK_SIZE = 30;
const BLOCK_PRICE = 20;
const MAX_BLOCKS = 100;

function blocks(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_BLOCKS) {
    throw Object.assign(new Error('Escolha entre 1 e 100 blocos.'), { status: 400 });
  }
  return value;
}

function tier(count) {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('Consumo inválido.');
  const quantity = Math.max(0, Math.ceil((count - FREE) / BLOCK_SIZE));
  return { blocks: quantity, limit: FREE + quantity * BLOCK_SIZE, price: quantity * BLOCK_PRICE };
}

function period(now, mode) {
  if (!['monthly', 'lifetime'].includes(mode)) throw new Error('Configure USAGE_MODE: monthly ou lifetime.');
  return mode === 'lifetime' ? 'total' : new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
  }).format(now);
}

function monthAfter(date) {
  const [year, month, day] = date.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay), 3));
}

function entitlement(account, now) {
  const until = account?.validUntil?.toDate?.() ?? account?.validUntil;
  return until && new Date(until) > now ? Number(account.blocks || 0) : 0;
}

function paid(status) { return ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status); }

function validTransactionDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 19) === value.slice(0, 19);
}

module.exports = { FREE, BLOCK_SIZE, BLOCK_PRICE, MAX_BLOCKS, blocks, tier, period, monthAfter, entitlement, paid, validTransactionDate };
