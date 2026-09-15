
import type { Transacao } from '../tipos';
import { formatarData, formatarMoeda } from '../utilitarios/formatadores';

/// Gera um PDF com os lançamentos do período, um por linha.
///
/// A formatação é a mesma da tela (pt-BR: R$ e DD/MM/AAAA), reutilizando os
/// O jsPDF só é baixado no clique do botão: a biblioteca passa dos 400 kB e
/// não faz sentido carregá-la junto com a página, que nem sempre exporta nada.
export async function exportarPdf(
  transacoes: Transacao[],
  titulo: string,
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF();

  // Título do relatório no topo da página.
  doc.setFontSize(16);
  doc.text(titulo, 14, 18);

  // Ordem cronológica facilita a conferência no papel.
  const linhas = [...transacoes]
    .sort((a, b) => a.data.getTime() - b.data.getTime())
    .map((transacao) => [
      formatarData(transacao.data),
      transacao.descricao,
      transacao.categoria,
      transacao.tipo === 'entrada' ? 'Entrada' : 'Saída',
      formatarMoeda(transacao.valor),
    ]);

  autoTable(doc, {
    head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
    body: linhas,
    startY: 26,
    styles: { fontSize: 9 },
    // Mesmo tom de tinta escura do app (família slate).
    headStyles: { fillColor: [15, 23, 42] },
    columnStyles: {
      4: { halign: 'right' },
    },
  });

  doc.save('relatorio-financeiro.pdf');
}
