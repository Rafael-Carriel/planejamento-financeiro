import { describe, expect, it } from 'vitest';

import {
  comInicialMaiuscula,
  formatarComSinal,
  interpretarValor,
} from './formatadores';

/// A joia da coroa aqui é `interpretarValor`: ele recebe texto digitado à mão e
/// precisa acertar o separador decimal em formatos que se contradizem. O resto
/// da formatação é delegado ao `Intl`, então testamos só a lógica própria.

describe('interpretarValor', () => {
  it('entende os quatro formatos prometidos na documentação', () => {
    expect(interpretarValor('1.234,56')).toBe(1234.56); // ponto milhar, vírgula decimal
    expect(interpretarValor('1234,56')).toBe(1234.56); // só vírgula decimal
    expect(interpretarValor('1234.56')).toBe(1234.56); // só ponto decimal
    expect(interpretarValor('R$ 1.234,56')).toBe(1234.56); // com símbolo e espaço
  });

  it('trata o último separador como o decimal quando os dois aparecem', () => {
    // Vírgula depois do ponto → padrão brasileiro (ponto é milhar).
    expect(interpretarValor('1.234.567,89')).toBe(1234567.89);
    // Ponto depois da vírgula → padrão americano (vírgula é milhar).
    expect(interpretarValor('1,234.56')).toBe(1234.56);
  });

  it('devolve sempre o valor absoluto, sem sinal', () => {
    expect(interpretarValor('-50,00')).toBe(50);
    expect(interpretarValor('- R$ 50')).toBe(50);
  });

  it('arredonda para dois decimais', () => {
    expect(interpretarValor('10,999')).toBe(11);
    expect(interpretarValor('10,994')).toBe(10.99);
  });

  it('aceita inteiros e zero', () => {
    expect(interpretarValor('10')).toBe(10);
    expect(interpretarValor('0')).toBe(0);
  });

  it('devolve null quando não sobra número', () => {
    expect(interpretarValor('')).toBeNull();
    expect(interpretarValor('   ')).toBeNull();
    expect(interpretarValor('abc')).toBeNull();
    expect(interpretarValor('R$')).toBeNull();
  });
});

describe('formatarComSinal', () => {
  it('usa + para valores positivos e zero', () => {
    expect(formatarComSinal(100).startsWith('+')).toBe(true);
    expect(formatarComSinal(0).startsWith('+')).toBe(true);
  });

  it('usa o menos matemático (−, não hífen) para negativos', () => {
    const texto = formatarComSinal(-100);
    expect(texto.startsWith('−')).toBe(true); // U+2212
    expect(texto.startsWith('-')).toBe(false); // não é o hífen U+002D
  });
});

describe('comInicialMaiuscula', () => {
  it('sobe só a primeira letra e não mexe no resto', () => {
    expect(comInicialMaiuscula('ola')).toBe('Ola');
    expect(comInicialMaiuscula('ABC')).toBe('ABC');
    expect(comInicialMaiuscula('ábaco')).toBe('Ábaco');
  });

  it('devolve string vazia sem quebrar', () => {
    expect(comInicialMaiuscula('')).toBe('');
  });
});
