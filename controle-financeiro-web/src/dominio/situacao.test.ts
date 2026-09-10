import { describe, expect, it } from 'vitest';

import type { LinhaDePlanejamento } from '../tipos';
import { linhasEmAtencao, situacaoDoLimite } from './situacao';

/// O corte de atenção é 0,8. Os testes rondam essa borda de propósito: é onde
/// um erro de `>` para `>=` passaria despercebido a olho nu.

function linha(parcial: Partial<LinhaDePlanejamento> = {}): LinhaDePlanejamento {
  return {
    categoria: 'Geral',
    limite: 100,
    gasto: 0,
    proporcao: 0,
    restante: 100,
    ...parcial,
  };
}

describe('situacaoDoLimite', () => {
  it('sem limite quando o limite é zero ou negativo', () => {
    expect(situacaoDoLimite(linha({ limite: 0 })).chave).toBe('sem-limite');
    expect(situacaoDoLimite(linha({ limite: -5 })).chave).toBe('sem-limite');
  });

  it('estourou quando passa de 100%', () => {
    expect(situacaoDoLimite(linha({ limite: 100, proporcao: 1.5 })).chave).toBe('estourado');
  });

  it('exatamente 100% ainda é "no limite", não estouro', () => {
    // proporcao > 1 é estouro; em 1 cravado a categoria está no limite.
    const situacao = situacaoDoLimite(linha({ limite: 100, proporcao: 1 }));
    expect(situacao.chave).toBe('atencao');
  });

  it('atenção a partir de 80% (inclusive)', () => {
    expect(situacaoDoLimite(linha({ limite: 100, proporcao: 0.8 })).chave).toBe('atencao');
    expect(situacaoDoLimite(linha({ limite: 100, proporcao: 0.95 })).chave).toBe('atencao');
  });

  it('tranquilo abaixo de 80%', () => {
    expect(situacaoDoLimite(linha({ limite: 100, proporcao: 0.79 })).chave).toBe('tranquilo');
    expect(situacaoDoLimite(linha({ limite: 100, proporcao: 0.5 })).chave).toBe('tranquilo');
  });
});

describe('linhasEmAtencao', () => {
  it('fica só com quem tem limite e chegou a 80% ou mais', () => {
    const linhas = [
      linha({ categoria: 'No limite', limite: 100, proporcao: 0.9 }),
      linha({ categoria: 'Estourada', limite: 100, proporcao: 1.3 }),
      linha({ categoria: 'Tranquila', limite: 100, proporcao: 0.5 }),
      linha({ categoria: 'Sem limite', limite: 0, proporcao: 0 }),
    ];
    expect(linhasEmAtencao(linhas).map((l) => l.categoria)).toEqual(['No limite', 'Estourada']);
  });
});
