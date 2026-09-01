import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useDados } from '../contextos/ContextoDados';
import { mensagemDeErro } from '../servicos/servicoAutenticacao';
import type {
  DadosDeRecorrencia,
  ModoLancamentoRecorrente,
  Recorrencia,
  TipoTransacao,
} from '../tipos';
import {
  deCampoData,
  diaDentroDoMes,
  hoje,
  inicioDoMes,
  paraCampoData,
  proximosMeses,
} from '../utilitarios/datas';
import { formatarData, formatarMoeda, interpretarValor } from '../utilitarios/formatadores';
import { Modal } from './Modal';

/// Formulário de recorrência, em modal.
///
/// A escolha de projeto que mais simplifica a tela: em vez de pedir "dia do mês"
/// e "mês de início" separados, pede **a primeira vez** numa única data. O dia
/// dela é o dia de todos os meses seguintes, e o mês dela é o começo da série.
/// Uma informação, dois campos preenchidos, nenhuma chance de dizer "dia 31,
/// começando em fevereiro".

interface Propriedades {
  /// Quando vem preenchida, o formulário edita essa recorrência.
  recorrencia: Recorrencia | null;
  tipoInicial: TipoTransacao;
  aoFechar: () => void;
}

type Repeticao = 'sempre' | 'vezes';

interface Formulario {
  tipo: TipoTransacao;
  valor: string;
  descricao: string;
  categoria: string;
  primeiraVez: string;
  repeticao: Repeticao;
  vezes: string;
  modoLancamento: ModoLancamentoRecorrente;
  observacao: string;
}

const QUANTAS_PREVER = 3;

export function FormularioDeRecorrencia({
  recorrencia,
  tipoInicial,
  aoFechar,
}: Propriedades) {
  const { categoriasDoTipo, salvarRecorrencia } = useDados();

  const [formulario, definirFormulario] = useState<Formulario>(() => {
    // Na edição, a "primeira vez" é reconstruída: mês de `inicio` + `diaDoMes`.
    const primeira = recorrencia
      ? diaDentroDoMes(recorrencia.inicio, recorrencia.diaDoMes)
      : hoje();

    return {
      tipo: recorrencia?.tipo ?? tipoInicial,
      valor: recorrencia ? recorrencia.valor.toFixed(2).replace('.', ',') : '',
      descricao: recorrencia?.descricao ?? '',
      categoria: recorrencia?.categoria ?? '',
      primeiraVez: paraCampoData(primeira),
      repeticao: recorrencia && recorrencia.parcelas !== null ? 'vezes' : 'sempre',
      vezes: recorrencia?.parcelas !== null && recorrencia?.parcelas !== undefined
        ? String(recorrencia.parcelas)
        : '3',
      modoLancamento: recorrencia?.modoLancamento ?? 'automatico',
      observacao: recorrencia?.observacao ?? '',
    };
  });

  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);

  const categorias = useMemo(
    () => categoriasDoTipo(formulario.tipo),
    [categoriasDoTipo, formulario.tipo],
  );

  // Mantém a categoria coerente com o tipo, como no formulário de lançamento.
  useEffect(() => {
    const existe = categorias.some((categoria) => categoria.nome === formulario.categoria);
    if (!existe) {
      definirFormulario((atual) => ({ ...atual, categoria: categorias[0]?.nome ?? '' }));
    }
  }, [categorias, formulario.categoria]);

  function alterar<C extends keyof Formulario>(campo: C, valor: Formulario[C]) {
    definirFormulario((atual) => {
      const proximo: Formulario = { ...atual };
      proximo[campo] = valor;
      return proximo;
    });
  }

  function validar(): DadosDeRecorrencia | string {
    const descricao = formulario.descricao.trim();
    if (descricao.length === 0) {
      return formulario.tipo === 'entrada'
        ? 'Escreva o que é essa receita: "Salário", "Aluguel recebido"…'
        : 'Escreva o que é essa conta: "Aluguel", "Financiamento do carro"…';
    }
    if (descricao.length > 120) return 'A descrição passou de 120 caracteres.';

    const valor = interpretarValor(formulario.valor);
    if (valor === null || valor <= 0) return 'Informe um valor maior que zero.';

    if (formulario.categoria.length === 0) return 'Escolha uma categoria.';

    const primeira = deCampoData(formulario.primeiraVez);
    if (!primeira) return 'Escolha a data da primeira vez.';

    let parcelas: number | null = null;
    if (formulario.repeticao === 'vezes') {
      const quantidade = Number.parseInt(formulario.vezes, 10);
      if (!Number.isFinite(quantidade) || quantidade < 1) {
        return 'Informe quantas vezes isso se repete (1 ou mais).';
      }
      if (quantidade > 600) return 'O limite é 600 repetições.';
      parcelas = quantidade;
    }

    const observacao = formulario.observacao.trim();
    if (observacao.length > 500) return 'A observação passou de 500 caracteres.';

    return {
      descricao,
      valor,
      tipo: formulario.tipo,
      categoria: formulario.categoria,
      diaDoMes: primeira.getDate(),
      inicio: inicioDoMes(primeira),
      parcelas,
      // Editar não pode religar o que estava pausado sem o usuário pedir.
      ativa: recorrencia?.ativa ?? true,
      modoLancamento: formulario.modoLancamento,
      observacao: observacao.length > 0 ? observacao : null,
    };
  }

  async function gravar() {
    const resultado = validar();
    if (typeof resultado === 'string') {
      definirErro(resultado);
      return;
    }

    definirSalvando(true);
    definirErro(null);
    try {
      await salvarRecorrencia(resultado, recorrencia?.id);
      aoFechar();
    } catch (falha) {
      definirErro(mensagemDeErro(falha));
      definirSalvando(false);
    }
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    void gravar();
  }

  // Prévia das próximas datas: é o que mostra, antes de salvar, que "dia 31"
  // vira 28 em fevereiro e que a série termina onde deveria terminar.
  const previa = useMemo(() => {
    const primeira = deCampoData(formulario.primeiraVez);
    if (!primeira) return [];

    const limite =
      formulario.repeticao === 'vezes'
        ? Math.max(1, Number.parseInt(formulario.vezes, 10) || 1)
        : QUANTAS_PREVER;

    return proximosMeses(inicioDoMes(primeira), Math.min(QUANTAS_PREVER, limite)).map((mes) =>
      diaDentroDoMes(mes, primeira.getDate()),
    );
  }, [formulario.primeiraVez, formulario.repeticao, formulario.vezes]);

  const valorInterpretado = interpretarValor(formulario.valor);
  const quantidadeDeVezes =
    formulario.repeticao === 'vezes' ? Number.parseInt(formulario.vezes, 10) : null;
  const total =
    valorInterpretado !== null && quantidadeDeVezes !== null && quantidadeDeVezes > 0
      ? valorInterpretado * quantidadeDeVezes
      : null;

  const editando = recorrencia !== null;
  const ehEntrada = formulario.tipo === 'entrada';

  return (
    <Modal
      titulo={editando ? 'Editar recorrência' : ehEntrada ? 'Nova receita recorrente' : 'Nova conta recorrente'}
      descricao={
        editando
          ? 'A mudança vale para os próximos meses. O que já virou lançamento fica como está.'
          : formulario.modoLancamento === 'automatico'
            ? 'Na data escolhida, o lançamento será registrado automaticamente.'
            : 'A cada mês, a ocorrência fica prevista até você confirmar.'
      }
      aoFechar={aoFechar}
      rodape={
        <>
          <button
            type="button"
            className="botao botao-contorno"
            onClick={aoFechar}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="botao botao-principal"
            onClick={() => void gravar()}
            disabled={salvando}
          >
            {salvando ? 'Salvando…' : editando ? 'Salvar mudanças' : 'Criar recorrência'}
          </button>
        </>
      }
    >
      <form className="formulario" onSubmit={aoEnviar}>
        <div className="alternador" role="group" aria-label="Tipo da recorrência">
          <button
            type="button"
            className="opcao-entrada"
            aria-pressed={ehEntrada}
            onClick={() => alterar('tipo', 'entrada')}
          >
            Entra todo mês
          </button>
          <button
            type="button"
            className="opcao-saida"
            aria-pressed={!ehEntrada}
            onClick={() => alterar('tipo', 'saida')}
          >
            Sai todo mês
          </button>
        </div>

        <label className="campo campo-valor">
          <span>Valor de cada mês</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={formulario.valor}
            onChange={(evento) => alterar('valor', evento.target.value)}
          />
          <span className="dica-campo">
            {total !== null
              ? `${quantidadeDeVezes}x de ${formatarMoeda(valorInterpretado ?? 0)} = ${formatarMoeda(total)} no total.`
              : 'Use vírgula para os centavos: 1.250,90.'}
          </span>
        </label>

        <label className="campo">
          <span>Descrição</span>
          <input
            type="text"
            maxLength={120}
            autoComplete="off"
            placeholder={ehEntrada ? 'Salário' : 'Aluguel'}
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
            <span>Primeira vez</span>
            <input
              type="date"
              value={formulario.primeiraVez}
              onChange={(evento) => alterar('primeiraVez', evento.target.value)}
            />
            <span className="dica-campo">
              O dia escolhido vale para todos os meses. Mês curto usa o último dia.
            </span>
          </label>
        </div>

        <div className="campo">
          <span>Como registrar</span>
          <div className="alternador" role="group" aria-label="Como registrar a recorrência">
            <button
              type="button"
              aria-pressed={formulario.modoLancamento === 'automatico'}
              onClick={() => alterar('modoLancamento', 'automatico')}
            >
              Automático
            </button>
            <button
              type="button"
              aria-pressed={formulario.modoLancamento === 'confirmar'}
              onClick={() => alterar('modoLancamento', 'confirmar')}
            >
              Confirmar manualmente
            </button>
          </div>
          <span className="dica-campo">
            {formulario.modoLancamento === 'automatico'
              ? 'Lança sozinho na data. Se o app estiver fechado, lança na próxima vez que abrir.'
              : 'Continua como previsão até você tocar em “Lançar”.'}
          </span>
        </div>

        <div className="formulario-duas-colunas">
          <label className="campo">
            <span>Repete</span>
            <select
              value={formulario.repeticao}
              onChange={(evento) => alterar('repeticao', evento.target.value as Repeticao)}
            >
              <option value="sempre">Todo mês, sem fim</option>
              <option value="vezes">Um número de vezes</option>
            </select>
            <span className="dica-campo">
              {formulario.repeticao === 'sempre'
                ? ehEntrada
                  ? 'O caso do salário: entra todo mês, sem data para acabar.'
                  : 'O caso do aluguel: sai todo mês, sem data para acabar.'
                : 'O caso do boleto parcelado: acaba na última parcela.'}
            </span>
          </label>

          {formulario.repeticao === 'vezes' ? (
            <label className="campo">
              <span>Quantas vezes</span>
              <input
                type="number"
                min={1}
                max={600}
                step={1}
                inputMode="numeric"
                value={formulario.vezes}
                onChange={(evento) => alterar('vezes', evento.target.value)}
              />
              <span className="dica-campo">
                Contando a primeira. Boleto em 3 meses = 3.
              </span>
            </label>
          ) : null}
        </div>

        {previa.length > 0 ? (
          <div className="aviso">
            <strong>{ehEntrada ? 'Entra' : 'Vence'} em:</strong>{' '}
            {previa.map((data) => formatarData(data)).join(' · ')}
            {formulario.repeticao === 'sempre' || (quantidadeDeVezes ?? 0) > previa.length
              ? ' · e segue'
              : ''}
          </div>
        ) : null}

        <label className="campo">
          <span>Observação (opcional)</span>
          <textarea
            maxLength={500}
            placeholder="Número do boleto, banco, com quem foi combinado…"
            value={formulario.observacao}
            onChange={(evento) => alterar('observacao', evento.target.value)}
          />
        </label>

        {erro ? <div className="aviso aviso-erro">{erro}</div> : null}

        {/* Envio pelo Enter; os botões visíveis ficam no rodapé do modal. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1}>
          Salvar
        </button>
      </form>
    </Modal>
  );
}
