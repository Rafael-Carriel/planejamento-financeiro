import { describe, expect, it } from 'vitest';

import type { OcorrenciaPrevista, Recorrencia, Transacao } from '../tipos';
import {
  descreverPeriodo,
  descricaoDaOcorrencia,
  doTipo,
  ocorrenciaDoMes,
  ocorrenciasDoMes,
  parcelasRestantes,
  pendentes,
  pesoMensal,
  previsaoDosMeses,
  proximaOcorrencia,
  recorrenciaEncerrada,
  somarOcorrencias,
  ultimoMesDaRecorrencia,
} from './recorrencias';

/// Toda função aqui aceita uma `referencia` explícita — os testes sempre passam
/// uma data fixa, então nada depende do relógio da máquina que roda a suíte.
/// Lembrete de índice de mês: janeiro é 0, setembro é 8, outubro é 9.

const SETEMBRO = new Date(2026, 8, 1);
const OUTUBRO = new Date(2026, 9, 1);
const REF = new Date(2026, 8, 15); // 15/09/2026, meio do mês

function recorrencia(parcial: Partial<Recorrencia> = {}): Recorrencia {
  return {
    id: 'r1',
    descricao: 'Assinatura',
    valor: 100,
    tipo: 'saida',
    categoria: 'Serviços',
    diaDoMes: 10,
    inicio: new Date(2026, 0, 1), // janeiro de 2026
    parcelas: null,
    ativa: true,
    modoLancamento: 'confirmar',
    automaticoDesde: null,
    automaticoAte: null,
    observacao: null,
    criadoEm: null,
    ...parcial,
  };
}

function transacao(parcial: Partial<Transacao> = {}): Transacao {
  return {
    id: 'id',
    descricao: 'Lançamento',
    valor: 0,
    tipo: 'saida',
    categoria: 'Geral',
    data: new Date(2026, 8, 10),
    observacao: null,
    recorrenciaId: null,
    criadoEm: null,
    ...parcial,
  };
}

function ocorrencia(parcial: Partial<OcorrenciaPrevista> = {}): OcorrenciaPrevista {
  return {
    chave: 'r1:2026-09',
    recorrenciaId: 'r1',
    descricao: 'Item',
    valor: 100,
    tipo: 'saida',
    categoria: 'Serviços',
    data: new Date(2026, 8, 10),
    observacao: null,
    modoLancamento: 'confirmar',
    parcela: null,
    totalDeParcelas: null,
    situacao: 'aVencer',
    transacaoId: null,
    ...parcial,
  };
}

describe('ultimoMesDaRecorrencia', () => {
  it('é null para série sem fim', () => {
    expect(ultimoMesDaRecorrencia(recorrencia({ parcelas: null }))).toBeNull();
  });

  it('é o mês da última parcela', () => {
    const ultimo = ultimoMesDaRecorrencia(
      recorrencia({ inicio: new Date(2026, 0, 1), parcelas: 3 }),
    );
    expect(ultimo?.getFullYear()).toBe(2026);
    expect(ultimo?.getMonth()).toBe(2); // março (jan + 2)
  });
});

describe('recorrenciaEncerrada', () => {
  it('série sem fim nunca encerra', () => {
    expect(recorrenciaEncerrada(recorrencia({ parcelas: null }), REF)).toBe(false);
  });

  it('encerra depois de passar da última parcela', () => {
    const boleto = recorrencia({ inicio: new Date(2026, 0, 1), parcelas: 3 }); // até março
    expect(recorrenciaEncerrada(boleto, new Date(2026, 3, 10))).toBe(true); // abril
  });

  it('no próprio mês da última parcela ainda não encerrou', () => {
    const boleto = recorrencia({ inicio: new Date(2026, 0, 1), parcelas: 3 }); // até março
    expect(recorrenciaEncerrada(boleto, new Date(2026, 2, 20))).toBe(false); // março
  });
});

describe('pesoMensal', () => {
  it('soma só recorrências vigentes, separando entrada de saída', () => {
    const peso = pesoMensal(
      [
        recorrencia({ id: 'sal', tipo: 'entrada', valor: 5000 }),
        recorrencia({ id: 'alu', tipo: 'saida', valor: 1500 }),
        recorrencia({ id: 'pausada', tipo: 'saida', valor: 30, ativa: false }),
        // Boleto de 2x começando em jan → encerrou muito antes de setembro.
        recorrencia({ id: 'quitado', tipo: 'saida', valor: 999, inicio: new Date(2026, 0, 1), parcelas: 2 }),
      ],
      REF,
    );
    expect(peso).toEqual({ entradas: 5000, saidas: 1500, saldo: 3500, vigentes: 2 });
  });
});

describe('ocorrenciaDoMes', () => {
  it('devolve null para recorrência pausada', () => {
    expect(ocorrenciaDoMes(recorrencia({ ativa: false }), SETEMBRO, [], REF)).toBeNull();
  });

  it('devolve null antes do início da série', () => {
    const futura = recorrencia({ inicio: new Date(2026, 11, 1) }); // dezembro
    expect(ocorrenciaDoMes(futura, SETEMBRO, [], REF)).toBeNull();
  });

  it('devolve null depois da última parcela', () => {
    const boleto = recorrencia({ inicio: new Date(2026, 0, 1), parcelas: 3 }); // até março
    expect(ocorrenciaDoMes(boleto, SETEMBRO, [], REF)).toBeNull();
  });

  it('marca como atrasada quando a data já passou e ninguém lançou', () => {
    const oc = ocorrenciaDoMes(recorrencia({ diaDoMes: 10 }), SETEMBRO, [], REF);
    expect(oc?.situacao).toBe('atrasada'); // dia 10 < 15
  });

  it('marca como a vencer quando a data ainda está por vir', () => {
    const oc = ocorrenciaDoMes(recorrencia({ diaDoMes: 20 }), SETEMBRO, [], REF);
    expect(oc?.situacao).toBe('aVencer'); // dia 20 > 15
  });

  it('marca como lançada e adota o valor real da transação', () => {
    const rec = recorrencia({ id: 'alu', valor: 1500, diaDoMes: 10 });
    const tx = transacao({
      id: 't-alu',
      recorrenciaId: 'alu',
      valor: 1512, // veio R$ 12 mais caro
      data: new Date(2026, 8, 10),
    });
    const oc = ocorrenciaDoMes(rec, SETEMBRO, [tx], REF);
    expect(oc?.situacao).toBe('lancada');
    expect(oc?.valor).toBe(1512);
    expect(oc?.transacaoId).toBe('t-alu');
  });

  it('numera a parcela pelo índice a partir do início', () => {
    const rec = recorrencia({ inicio: new Date(2026, 0, 1), parcelas: 12, diaDoMes: 10 });
    const oc = ocorrenciaDoMes(rec, SETEMBRO, [], REF);
    expect(oc?.parcela).toBe(9); // jan=1 … set=9
    expect(oc?.totalDeParcelas).toBe(12);
  });

  it('deixa a parcela nula em série sem fim', () => {
    const oc = ocorrenciaDoMes(recorrencia({ parcelas: null }), SETEMBRO, [], REF);
    expect(oc?.parcela).toBeNull();
    expect(oc?.totalDeParcelas).toBeNull();
  });
});

describe('ocorrenciasDoMes', () => {
  it('devolve as ocorrências ordenadas por data', () => {
    const salario = recorrencia({ id: 'sal', tipo: 'entrada', valor: 5000, diaDoMes: 5 });
    const aluguel = recorrencia({ id: 'alu', tipo: 'saida', valor: 1500, diaDoMes: 10 });
    const ocs = ocorrenciasDoMes([aluguel, salario], SETEMBRO, [], REF);
    expect(ocs.map((o) => o.recorrenciaId)).toEqual(['sal', 'alu']); // dia 5 antes do dia 10
  });
});

describe('pendentes / doTipo / somarOcorrencias', () => {
  it('pendentes remove as já lançadas', () => {
    const lista = [
      ocorrencia({ situacao: 'lancada' }),
      ocorrencia({ situacao: 'atrasada' }),
      ocorrencia({ situacao: 'aVencer' }),
    ];
    expect(pendentes(lista)).toHaveLength(2);
    expect(pendentes(lista).every((o) => o.situacao !== 'lancada')).toBe(true);
  });

  it('doTipo separa entradas de saídas', () => {
    const lista = [
      ocorrencia({ tipo: 'entrada' }),
      ocorrencia({ tipo: 'saida' }),
      ocorrencia({ tipo: 'saida' }),
    ];
    expect(doTipo(lista, 'saida')).toHaveLength(2);
    expect(doTipo(lista, 'entrada')).toHaveLength(1);
  });

  it('somarOcorrencias soma os valores', () => {
    expect(somarOcorrencias([ocorrencia({ valor: 100 }), ocorrencia({ valor: 250 })])).toBe(350);
    expect(somarOcorrencias([])).toBe(0);
  });
});

describe('previsaoDosMeses', () => {
  const salario = recorrencia({ id: 'sal', tipo: 'entrada', valor: 5000, diaDoMes: 5 });
  const aluguel = recorrencia({ id: 'alu', tipo: 'saida', valor: 1500, diaDoMes: 10 });

  it('não soma duas vezes uma ocorrência já lançada', () => {
    // Salário já caiu como transação; o aluguel do mês ainda é só previsão.
    const txSalario = transacao({
      id: 't-sal',
      recorrenciaId: 'sal',
      tipo: 'entrada',
      valor: 5000,
      data: new Date(2026, 8, 5),
    });
    const [mes] = previsaoDosMeses([salario, aluguel], [SETEMBRO], [txSalario], REF);

    // A entrada aparece uma vez só (5000), não 10000 — este é o pulo do gato.
    expect(mes.entradas).toBe(5000);
    expect(mes.entradasLancadas).toBe(5000);
    expect(mes.entradasPrevistas).toBe(0);
    expect(mes.saidas).toBe(1500); // aluguel, ainda previsto
    expect(mes.saidasPrevistas).toBe(1500);
    expect(mes.saldo).toBe(3500);
  });

  it('acumula o saldo dos meses na ordem da lista', () => {
    const meses = previsaoDosMeses([salario, aluguel], [SETEMBRO, OUTUBRO], [], REF);
    expect(meses[0].saldo).toBe(3500);
    expect(meses[0].acumulado).toBe(3500);
    expect(meses[1].saldo).toBe(3500);
    expect(meses[1].acumulado).toBe(7000); // 3500 + 3500
  });
});

describe('proximaOcorrencia', () => {
  it('é null para recorrência pausada', () => {
    expect(proximaOcorrencia(recorrencia({ ativa: false }), REF)).toBeNull();
  });

  it('pula para o mês seguinte quando a data deste mês já passou', () => {
    const prox = proximaOcorrencia(recorrencia({ diaDoMes: 5 }), REF); // dia 5 < 15
    expect(prox?.getMonth()).toBe(9); // outubro
    expect(prox?.getDate()).toBe(5);
  });

  it('fica no mês atual quando a data ainda não chegou', () => {
    const prox = proximaOcorrencia(recorrencia({ diaDoMes: 20 }), REF); // dia 20 > 15
    expect(prox?.getMonth()).toBe(8); // setembro
    expect(prox?.getDate()).toBe(20);
  });

  it('projeta a primeira ocorrência de uma série que ainda vai começar', () => {
    const futura = recorrencia({ inicio: new Date(2026, 11, 1), diaDoMes: 5 }); // dezembro
    const prox = proximaOcorrencia(futura, REF);
    expect(prox?.getMonth()).toBe(11);
    expect(prox?.getDate()).toBe(5);
  });

  it('é null quando a série já terminou', () => {
    const boleto = recorrencia({ inicio: new Date(2026, 0, 1), parcelas: 3 }); // até março
    expect(proximaOcorrencia(boleto, REF)).toBeNull();
  });
});

describe('parcelasRestantes', () => {
  it('é null para série sem fim', () => {
    expect(parcelasRestantes(recorrencia({ parcelas: null }), REF)).toBeNull();
  });

  it('conta as parcelas que ainda vão cair', () => {
    // 12x desde jan, dia 5. Em 15/09 já caíram jan…set (9); restam out, nov, dez.
    const rec = recorrencia({ inicio: new Date(2026, 0, 1), parcelas: 12, diaDoMes: 5 });
    expect(parcelasRestantes(rec, REF)).toBe(3);
  });

  it('devolve todas quando a série ainda não começou', () => {
    const rec = recorrencia({ inicio: new Date(2026, 11, 1), parcelas: 6 }); // dezembro
    expect(parcelasRestantes(rec, REF)).toBe(6);
  });
});

describe('descreverPeriodo', () => {
  it('série sem fim: "desde" o mês inicial', () => {
    const texto = descreverPeriodo(recorrencia({ parcelas: null, diaDoMes: 5 }));
    expect(texto).toContain('Todo mês');
    expect(texto).toContain('dia 5');
    expect(texto).toContain('desde');
  });

  it('série de uma parcela: "1 vez" e sem "até"', () => {
    const texto = descreverPeriodo(recorrencia({ inicio: new Date(2026, 0, 1), parcelas: 1 }));
    expect(texto).toContain('1 vez');
    expect(texto).not.toContain('até');
  });

  it('série de várias parcelas: "Nx" e com "até"', () => {
    const texto = descreverPeriodo(recorrencia({ inicio: new Date(2026, 0, 1), parcelas: 3 }));
    expect(texto).toContain('3x');
    expect(texto).toContain('até');
  });
});

describe('descricaoDaOcorrencia', () => {
  it('anexa a parcela quando a série tem fim', () => {
    const oc = ocorrencia({ descricao: 'Financiamento', parcela: 2, totalDeParcelas: 12 });
    expect(descricaoDaOcorrencia(oc)).toBe('Financiamento (2/12)');
  });

  it('usa só a descrição em série sem fim', () => {
    const oc = ocorrencia({ descricao: 'Salário', parcela: null, totalDeParcelas: null });
    expect(descricaoDaOcorrencia(oc)).toBe('Salário');
  });
});
