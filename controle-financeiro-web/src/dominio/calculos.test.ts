import { describe, expect, it } from 'vitest';

import type { Transacao } from '../tipos';
import {
  RESUMO_VAZIO,
  filtrarPorTipo,
  fluxoPorDia,
  linhasDePlanejamento,
  mediaMensal,
  resumir,
  resumosPorMes,
  totaisPorCategoria,
} from './calculos';

/// Fábrica de lançamento com padrões sensatos: cada teste sobrescreve só o que
/// lhe interessa, e o resto fica fora do caminho.
function transacao(parcial: Partial<Transacao> = {}): Transacao {
  return {
    id: 'id',
    descricao: 'Lançamento',
    valor: 0,
    tipo: 'saida',
    categoria: 'Geral',
    data: new Date(2026, 8, 15),
    observacao: null,
    recorrenciaId: null,
    criadoEm: null,
    ...parcial,
  };
}

describe('resumir', () => {
  it('devolve tudo zerado para lista vazia', () => {
    expect(resumir([])).toEqual({ entradas: 0, saidas: 0, saldo: 0, quantidade: 0 });
  });

  it('soma entradas e saídas separadamente e tira o saldo', () => {
    const resumo = resumir([
      transacao({ tipo: 'entrada', valor: 100 }),
      transacao({ tipo: 'entrada', valor: 50 }),
      transacao({ tipo: 'saida', valor: 30 }),
    ]);
    expect(resumo).toEqual({ entradas: 150, saidas: 30, saldo: 120, quantidade: 3 });
  });
});

describe('filtrarPorTipo', () => {
  it('devolve só os lançamentos do tipo pedido', () => {
    const lista = [
      transacao({ tipo: 'entrada', valor: 10 }),
      transacao({ tipo: 'saida', valor: 20 }),
      transacao({ tipo: 'entrada', valor: 30 }),
    ];
    const entradas = filtrarPorTipo(lista, 'entrada');
    expect(entradas).toHaveLength(2);
    expect(entradas.every((t) => t.tipo === 'entrada')).toBe(true);
  });
});

describe('totaisPorCategoria', () => {
  it('agrupa por categoria, ordena da maior para a menor e calcula a fatia', () => {
    const totais = totaisPorCategoria(
      [
        transacao({ tipo: 'saida', categoria: 'Alimentação', valor: 60 }),
        transacao({ tipo: 'saida', categoria: 'Alimentação', valor: 40 }),
        transacao({ tipo: 'saida', categoria: 'Transporte', valor: 300 }),
        // entrada tem de ser ignorada quando o tipo pedido é saída
        transacao({ tipo: 'entrada', categoria: 'Salário', valor: 5000 }),
      ],
      'saida',
    );

    expect(totais).toHaveLength(2);
    expect(totais[0]).toMatchObject({ categoria: 'Transporte', total: 300, quantidade: 1 });
    expect(totais[0].fatia).toBeCloseTo(0.75);
    expect(totais[1]).toMatchObject({ categoria: 'Alimentação', total: 100, quantidade: 2 });
    expect(totais[1].fatia).toBeCloseTo(0.25);
  });

  it('devolve lista vazia quando não há lançamentos do tipo', () => {
    expect(totaisPorCategoria([transacao({ tipo: 'entrada', valor: 10 })], 'saida')).toEqual([]);
  });
});

describe('fluxoPorDia', () => {
  it('cobre todos os dias do mês, mesmo os sem lançamento', () => {
    // Fevereiro de 2026 não é bissexto: 28 dias.
    const dias = fluxoPorDia([], new Date(2026, 1, 10));
    expect(dias).toHaveLength(28);
    expect(dias[0]).toEqual({ dia: 1, entradas: 0, saidas: 0, saldo: 0 });
  });

  it('acumula entrada e saída no dia certo', () => {
    const dias = fluxoPorDia(
      [
        transacao({ tipo: 'entrada', valor: 100, data: new Date(2026, 1, 15) }),
        transacao({ tipo: 'saida', valor: 40, data: new Date(2026, 1, 15) }),
      ],
      new Date(2026, 1, 1),
    );
    expect(dias[14]).toEqual({ dia: 15, entradas: 100, saidas: 40, saldo: 60 });
  });
});

describe('linhasDePlanejamento', () => {
  it('inclui categorias com limite e também as que gastaram sem limite', () => {
    const linhas = linhasDePlanejamento(
      [
        transacao({ tipo: 'saida', categoria: 'Alimentação', valor: 600 }),
        transacao({ tipo: 'saida', categoria: 'Lazer', valor: 50 }),
        // entrada não entra no gasto
        transacao({ tipo: 'entrada', categoria: 'Alimentação', valor: 999 }),
      ],
      { Alimentação: 500, Transporte: 200 },
    );

    // Ordem: quem tem limite primeiro (mais apertado na frente), sem-limite por último.
    expect(linhas.map((l) => l.categoria)).toEqual(['Alimentação', 'Transporte', 'Lazer']);

    const alimentacao = linhas[0];
    expect(alimentacao.limite).toBe(500);
    expect(alimentacao.gasto).toBe(600);
    expect(alimentacao.proporcao).toBeCloseTo(1.2);
    expect(alimentacao.restante).toBe(-100);

    const lazer = linhas[2];
    expect(lazer.limite).toBe(0);
    expect(lazer.proporcao).toBe(0); // sem limite → proporção 0
    expect(lazer.restante).toBe(-50);
  });
});

describe('resumosPorMes', () => {
  it('devolve um resumo por mês pedido, na ordem, com meses vazios zerados', () => {
    const resumos = resumosPorMes(
      [
        transacao({ tipo: 'entrada', valor: 100, data: new Date(2026, 6, 10) }),
        transacao({ tipo: 'saida', valor: 40, data: new Date(2026, 6, 20) }),
        transacao({ tipo: 'entrada', valor: 300, data: new Date(2026, 8, 5) }),
      ],
      [new Date(2026, 6, 1), new Date(2026, 7, 1), new Date(2026, 8, 1)],
    );

    expect(resumos.map((r) => r.chave)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(resumos[0]).toMatchObject({ entradas: 100, saidas: 40, saldo: 60, quantidade: 2 });
    expect(resumos[1]).toMatchObject({ entradas: 0, saidas: 0, saldo: 0, quantidade: 0 });
    expect(resumos[2]).toMatchObject({ entradas: 300, saidas: 0, saldo: 300, quantidade: 1 });
  });
});

describe('mediaMensal', () => {
  it('considera só os meses com movimento', () => {
    const resumos = resumosPorMes(
      [
        transacao({ tipo: 'entrada', valor: 100, data: new Date(2026, 6, 10) }),
        transacao({ tipo: 'saida', valor: 40, data: new Date(2026, 6, 20) }),
        transacao({ tipo: 'entrada', valor: 300, data: new Date(2026, 8, 5) }),
      ],
      [new Date(2026, 6, 1), new Date(2026, 7, 1), new Date(2026, 8, 1)],
    );

    // Agosto está vazio e não pode puxar a média para baixo.
    const media = mediaMensal(resumos);
    expect(media.entradas).toBeCloseTo(200); // (100 + 300) / 2
    expect(media.saidas).toBeCloseTo(20); // (40 + 0) / 2
    expect(media.saldo).toBeCloseTo(180);
    expect(media.quantidade).toBe(2); // meses com movimento
  });

  it('devolve o resumo vazio quando nenhum mês teve movimento', () => {
    const vazios = resumosPorMes([], [new Date(2026, 6, 1), new Date(2026, 7, 1)]);
    expect(mediaMensal(vazios)).toEqual(RESUMO_VAZIO);
  });
});
