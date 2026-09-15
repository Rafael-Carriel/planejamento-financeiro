import { useEffect, useMemo, useState } from 'react';

import { CabecalhoDaPagina } from '../componentes/CabecalhoDaPagina';
import { Carregando, EstadoVazio, FaixaDeErro } from '../componentes/Estados';
import { useAutenticacao } from '../contextos/ContextoAutenticacao';
import { formatarData } from '../utilitarios/formatadores';
import {
  excluirLembrete,
  marcarComoLido,
  observarLembretes,
  type Lembrete,
  type TipoLembrete,
} from '../servicos/servicoLembretes';

/// Fila de avisos do usuário: contas que venceu, dívidas atrasadas, orçamento
/// estourado. Não mexe no dinheiro — só chama atenção para o que precisa dela.

/// Como cada tipo de lembrete aparece na lista: rótulo, selo e ícone.
/// O selo segue as cores dos demais estados do app: vermelho para dívida,
/// âmbar para orçamento, neutro para recorrência, verde para sistema.
const APARENCIA_POR_TIPO: Record<
  TipoLembrete,
  { rotulo: string; classeDoSelo: string; icone: string }
> = {
  recorrencia: { rotulo: 'Recorrência', classeDoSelo: 'selo-situacao selo-sem-limite', icone: '🔁' },
  divida: { rotulo: 'Dívida', classeDoSelo: 'selo-situacao selo-estourado', icone: '💳' },
  orcamento: { rotulo: 'Orçamento', classeDoSelo: 'selo-situacao selo-atencao', icone: '◎' },
  sistema: { rotulo: 'Sistema', classeDoSelo: 'selo-situacao selo-tranquilo', icone: '⚙️' },
};

export function Lembretes() {
  const { usuario } = useAutenticacao();
  const uid = usuario?.uid ?? null;

  const [lembretes, definirLembretes] = useState<Lembrete[]>([]);
  const [carregando, definirCarregando] = useState(true);
  const [erro, definirErro] = useState<string | null>(null);
  // Id do lembrete com uma ação em andamento, para travar só os botões dele.
  const [processando, definirProcessando] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;

    let vivo = true;
    definirCarregando(true);
    definirErro(null);

    const encerrar = observarLembretes(
      uid,
      (lista) => {
        if (!vivo) return;
        definirLembretes(lista);
        definirCarregando(false);
      },
      () => {
        if (!vivo) return;
        definirErro('Não deu para carregar os lembretes.');
        definirCarregando(false);
      },
    );

    return () => {
      vivo = false;
      encerrar();
    };
  }, [uid]);

  // --- Derivados ---

  const naoLidos = useMemo(
    () => lembretes.filter((lembrete) => !lembrete.lido),
    [lembretes],
  );

  // Não lidos primeiro; dentro de cada grupo, a ordem que veio do Firestore
  // (mais recente no topo). A ordenação do `sort` é estável, então preservar
  // a ordem original dentro dos grupos é garantido.
  const ordenados = useMemo(
    () => [...lembretes].sort((a, b) => Number(a.lido) - Number(b.lido)),
    [lembretes],
  );

  // --- Ações ---

  async function marcar(lembrete: Lembrete) {
    if (!uid || lembrete.lido || processando !== null) return;

    definirProcessando(lembrete.id);
    try {
      await marcarComoLido(uid, lembrete.id);
    } catch {
      definirErro('Não deu para marcar o lembrete como lido.');
    } finally {
      definirProcessando(null);
    }
  }

  async function excluir(lembrete: Lembrete) {
    if (!uid || processando !== null) return;

    definirProcessando(lembrete.id);
    try {
      await excluirLembrete(uid, lembrete.id);
    } catch {
      definirErro('Não deu para excluir o lembrete.');
    } finally {
      definirProcessando(null);
    }
  }

  return (
    <>
      <CabecalhoDaPagina
        titulo="Lembretes"
        descricao="Avisos sobre contas, dívidas e orçamento"
        comSeletorDeMes={false}
      />

      <div className="pagina">
        {erro ? <FaixaDeErro mensagem={erro} /> : null}

        {carregando ? (
          <Carregando mensagem="Carregando seus lembretes…" />
        ) : lembretes.length === 0 ? (
          <div className="cartao">
            <div className="cartao-corpo">
              <EstadoVazio
                selo="🔔"
                titulo="Nenhum lembrete por aqui"
                descricao="Quando algo precisar da sua atenção — conta que vence, dívida atrasada, orçamento estourado — o aviso aparece nesta lista e o sino na barra superior acusa a chegada."
              />
            </div>
          </div>
        ) : (
          <section className="cartao">
            <div className="cartao-cabeca">
              <h2>Notificações</h2>
              <span className="texto-miudo">
                {naoLidos.length === 0
                  ? `${lembretes.length} ${lembretes.length === 1 ? 'lembrete' : 'lembretes'}, todos lidos`
                  : `${naoLidos.length} não ${naoLidos.length === 1 ? 'lido' : 'lidos'} de ${lembretes.length}`}
              </span>
            </div>

            <ul className="lista-lancamentos">
              {ordenados.map((lembrete) => {
                const aparencia = APARENCIA_POR_TIPO[lembrete.tipo];
                const ocupado = processando === lembrete.id;

                return (
                  <li
                    className={[
                      'lancamento',
                      // Lido perde força visual: o que pede atenção é o que
                      // ainda não foi visto.
                      lembrete.lido ? 'lancamento-apagado' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    key={lembrete.id}
                  >
                    <span className="lancamento-selo" aria-hidden="true">
                      {aparencia.icone}
                    </span>

                    <div className="lancamento-textos">
                      <div className="lancamento-descricao">{lembrete.titulo}</div>
                      <div className="lancamento-meta">
                        <span>{formatarData(lembrete.data)}</span>
                        {lembrete.descricao ? (
                          <span>· {lembrete.descricao}</span>
                        ) : null}
                        <span className={aparencia.classeDoSelo}>
                          {aparencia.rotulo}
                        </span>
                      </div>
                    </div>

                    <div className="lancamento-acoes">
                      {!lembrete.lido ? (
                        <button
                          type="button"
                          className="botao-texto"
                          onClick={() => void marcar(lembrete)}
                          disabled={ocupado}
                        >
                          {ocupado ? 'Marcando…' : 'Marcar como lido'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="botao-texto acao-excluir-lembrete"
                        onClick={() => void excluir(lembrete)}
                        disabled={ocupado}
                      >
                        {ocupado ? 'Excluindo…' : 'Excluir'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
