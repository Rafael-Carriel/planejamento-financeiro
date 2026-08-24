import type { Transacao } from '../tipos';
import { formatarData } from './formatadores';

/// Exportação dos lançamentos para planilha.
///
/// Sai em CSV com ponto e vírgula e vírgula decimal, que é o que o Excel em
/// português abre sem passar pelo assistente de importação. O BOM no começo é
/// o que faz o Excel reconhecer o UTF-8 e não estragar os acentos.

function escapar(campo: string): string {
  const limpo = campo.replace(/"/g, '""');
  return `"${limpo}"`;
}

export function transacoesParaCsv(transacoes: Transacao[]): string {
  const cabecalho = [
    'Data',
    'Descrição',
    'Tipo',
    'Categoria',
    'Valor',
    'Observação',
  ];

  const linhas = transacoes.map((transacao) =>
    [
      formatarData(transacao.data),
      escapar(transacao.descricao),
      transacao.tipo === 'entrada' ? 'Entrada' : 'Saída',
      escapar(transacao.categoria),
      transacao.valor.toFixed(2).replace('.', ','),
      escapar(transacao.observacao ?? ''),
    ].join(';'),
  );

  return [cabecalho.join(';'), ...linhas].join('\r\n');
}

/// Dispara o download do arquivo no navegador.
export function baixarCsv(nomeDoArquivo: string, conteudo: string): void {
  // U+FEFF escrito como escape, e não como caractere literal, para o BOM não
  // virar um byte invisível no meio do código-fonte.
  const bom = '\uFEFF';
  const arquivo = new Blob([bom + conteudo], {
    type: 'text/csv;charset=utf-8;',
  });

  const endereco = URL.createObjectURL(arquivo);
  const link = document.createElement('a');
  link.href = endereco;
  link.download = nomeDoArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(endereco);
}
