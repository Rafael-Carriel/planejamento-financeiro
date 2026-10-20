import { describe, expect, it } from 'vitest';
import { transacoesParaCsv } from './csv';
import type { Transacao } from '../tipos';
describe('exportação CSV segura',()=>{
  const base:Transacao={id:'qa',descricao:'Mercado',valor:20,tipo:'saida',categoria:'Outros',data:new Date(2026,9,20),observacao:null,recorrenciaId:null,criadoEm:null};
  for(const formula of ['=1+1','+cmd','@SUM(A1:A2)','-10+20','\t=1+1','\r=1+1']){
    it(`neutraliza fórmula com prefixo ${JSON.stringify(formula.slice(0,2))}`,()=>{
      const csv=transacoesParaCsv([{...base,descricao:formula,categoria:formula,observacao:formula}]);
      expect(csv).toContain(`"'${formula}"`);
    });
  }
  it('preserva texto comum e escapa aspas',()=>{
    expect(transacoesParaCsv([{...base,descricao:'Mercado "Centro"'}])).toContain('"Mercado ""Centro"""');
  });
});
