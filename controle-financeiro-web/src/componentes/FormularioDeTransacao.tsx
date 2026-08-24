import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useDados } from '../contextos/ContextoDados';
import { useMes } from '../contextos/ContextoMes';
import { mensagemDeErro } from '../servicos/servicoAutenticacao';
import type { DadosDeTransacao, TipoTransacao, Transacao } from '../tipos';
import { deCampoData, hoje, mesmoMes, paraCampoData } from '../utilitarios/datas';
import { interpretarValor } from '../utilitarios/formatadores';
import { Modal } from './Modal';

/// Formulário de lançamento, em modal.
///
/// A data já vem preenchida: hoje, se o mês aberto for o atual; senão, o dia 1º
/// do mês que está na tela. Quem está revisando março não quer lançar em agosto
/// por descuido.

interface Propriedades {
  /// Quando vem preenchido, o formulário edita esse lançamento.
  transacao: Transacao | null;
  tipoInicial: TipoTransacao;
  aoFechar: () => void;
}

interface Formulario {
  tipo: TipoTransacao;
  valor: string;
  descricao: string;
  categoria: string;
  data: string;
  observacao: string;
}

export function FormularioDeTransacao({ transacao, tipoInicial, aoFechar }: Propriedades) {
  const { categoriasDoTipo, salvarTransacao } = useDados();
  const { mes } = useMes();

  const dataPadrao = useMemo(
    () => paraCampoData(mesmoMes(mes, new Date()) ? hoje() : mes),
    [mes],
  );

  const [formulario, definirFormulario] = useState<Formulario>(() => ({
    tipo: transacao?.tipo ?? tipoInicial,
    valor: transacao ? transacao.valor.toFixed(2).replace('.', ',') : '',
    descricao: transacao?.descricao ?? '',
    categoria: transacao?.categoria ?? '',
    data: paraCampoData(transacao?.data ?? deCampoData(dataPadrao) ?? hoje()),
    observacao: transacao?.observacao ?? '',
  }));

  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [confirmacao, definirConfirmacao] = useState<string | null>(null);

  const categorias = useMemo(
    () => categoriasDoTipo(formulario.tipo),
    [categoriasDoTipo, formulario.tipo],
  );

  // Mantém a categoria coerente com o tipo: trocar para "entrada" com
  // "Mercado" escolhido deixaria um lançamento impossível de encontrar depois.
  useEffect(() => {
    const existe = categorias.some((categoria) => categoria.nome === formulario.categoria);
    if (!existe) {
      definirFormulario((atual) => ({
        ...atual,
        categoria: categorias[0]?.nome ?? '',
      }));
    }
  }, [categorias, formulario.categoria]);

  function alterar<C extends keyof Formulario>(campo: C, valor: Formulario[C]) {
    definirFormulario((atual) => {
      const proximo: Formulario = { ...atual };
      proximo[campo] = valor;
      return proximo;
    });
  }

  function validar(): DadosDeTransacao | string {
    const descricao = formulario.descricao.trim();
    if (descricao.length === 0) return 'Escreva uma descrição para reconhecer o lançamento depois.';
    if (descricao.length > 120) return 'A descrição passou de 120 caracteres.';

    const valor = interpretarValor(formulario.valor);
    if (valor === null || valor <= 0) return 'Informe um valor maior que zero.';

    if (formulario.categoria.length === 0) return 'Escolha uma categoria.';

    const data = deCampoData(formulario.data);
    if (!data) return 'Escolha uma data válida.';

    const observacao = formulario.observacao.trim();
    if (observacao.length > 500) return 'A observação passou de 500 caracteres.';

    return {
      descricao,
      valor,
      tipo: formulario.tipo,
      categoria: formulario.categoria,
      data,
      observacao: observacao.length > 0 ? observacao : null,
      // Editar um lançamento que nasceu de recorrência não pode romper o
      // vínculo: sem isso, a ocorrência daquele mês voltaria para a lista de
      // previstos e pareceria não paga.
      recorrenciaId: transacao?.recorrenciaId ?? null,
    };
  }

  async function gravar(continuar: boolean) {
    const resultado = validar();
    if (typeof resultado === 'string') {
      definirErro(resultado);
      return;
    }

    definirSalvando(true);
    definirErro(null);
    try {
      await salvarTransacao(resultado, transacao?.id);

      if (!continuar) {
        aoFechar();
        return;
      }

      // Fica pronto para o próximo: limpa descrição e valor, mantém tipo,
      // categoria e data, que costumam repetir em lançamentos seguidos.
      definirFormulario((atual) => ({ ...atual, descricao: '', valor: '', observacao: '' }));
      definirConfirmacao(`"${resultado.descricao}" lançado. Pode lançar o próximo.`);
    } catch (falha) {
      definirErro(mensagemDeErro(falha));
    } finally {
      definirSalvando(false);
    }
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    void gravar(false);
  }

  const editando = transacao !== null;

  return (
    <Modal
      titulo={editando ? 'Editar lançamento' : 'Novo lançamento'}
      descricao={
        editando
          ? 'As mudanças valem na hora em todas as telas.'
          : 'Registre o que entrou ou saiu. Leva alguns segundos.'
      }
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="botao botao-contorno" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </button>
          {editando ? null : (
            <button
              type="button"
              className="botao botao-suave"
              onClick={() => void gravar(true)}
              disabled={salvando}
            >
              Salvar e lançar outro
            </button>
          )}
          <button
            type="button"
            className="botao botao-principal"
            onClick={() => void gravar(false)}
            disabled={salvando}
          >
            {salvando ? 'Salvando…' : editando ? 'Salvar mudanças' : 'Salvar lançamento'}
          </button>
        </>
      }
    >
      <form className="formulario" onSubmit={aoEnviar}>
        <div className="alternador" role="group" aria-label="Tipo do lançamento">
          <button
            type="button"
            className="opcao-entrada"
            aria-pressed={formulario.tipo === 'entrada'}
            onClick={() => alterar('tipo', 'entrada')}
          >
            Entrada
          </button>
          <button
            type="button"
            className="opcao-saida"
            aria-pressed={formulario.tipo === 'saida'}
            onClick={() => alterar('tipo', 'saida')}
          >
            Saída
          </button>
        </div>

        <label className="campo campo-valor">
          <span>Valor</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={formulario.valor}
            onChange={(evento) => alterar('valor', evento.target.value)}
          />
          <span className="dica-campo">Use vírgula para os centavos: 1.250,90.</span>
        </label>

        <label className="campo">
          <span>Descrição</span>
          <input
            type="text"
            maxLength={120}
            autoComplete="off"
            placeholder={formulario.tipo === 'entrada' ? 'Salário de agosto' : 'Mercado do mês'}
            value={formulario.descricao}
            onChange={(evento) => alterar('descricao', evento.target.value)}
          />
        </label>

        <div className="formulario-duas-colunas">
          <label className="campo">
            <span>Categoria</span>
            <select
              value={formulario.categoria}
              onChange={(evento) => alterar('categoria', evento.target.value)}
            >
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.nome}>
                  {categoria.emoji} {categoria.nome}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            <span>Data</span>
            <input
              type="date"
              value={formulario.data}
              onChange={(evento) => alterar('data', evento.target.value)}
            />
          </label>
        </div>

        <label className="campo">
          <span>Observação (opcional)</span>
          <textarea
            maxLength={500}
            placeholder="Detalhe que ajude a lembrar do lançamento."
            value={formulario.observacao}
            onChange={(evento) => alterar('observacao', evento.target.value)}
          />
        </label>

        {erro ? <div className="aviso aviso-erro">{erro}</div> : null}
        {confirmacao && !erro ? <div className="aviso aviso-sucesso">{confirmacao}</div> : null}

        {/* Envio pelo Enter. O botão fica escondido porque o rodapé do modal já
            tem os botões visíveis — mas o formulário precisa de um submit para
            o Enter funcionar dentro dos campos. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1}>
          Salvar
        </button>
      </form>
    </Modal>
  );
}
