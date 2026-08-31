import { useState, type FormEvent } from 'react';

import type { DadosDeDivida, Divida } from '../tipos';
import { deCampoData, paraCampoData } from '../utilitarios/datas';
import { formatarMoeda, interpretarValor } from '../utilitarios/formatadores';
import { Modal } from './Modal';

/// Formulário de dívida, em modal.
///
/// Permite criar ou editar uma dívida. Na edição, oferece um campo simples para
/// registrar pagamento (atualizar valorPago).

interface Propriedades {
  /// Quando vem preenchida, o formulário edita essa dívida.
  divida?: Divida;
  aoSalvar: (dados: DadosDeDivida) => Promise<void>;
  aoFechar: () => void;
}

interface Formulario {
  descricao: string;
  valor: string;
  valorPago: string;
  credor: string;
  dataVencimento: string;
  observacao: string;
}

export function FormularioDeDivida({ divida, aoSalvar, aoFechar }: Propriedades) {
  const [formulario, definirFormulario] = useState<Formulario>(() => ({
    descricao: divida?.descricao ?? '',
    valor: divida ? divida.valor.toFixed(2).replace('.', ',') : '',
    valorPago: divida ? divida.valorPago.toFixed(2).replace('.', ',') : '0,00',
    credor: divida?.credor ?? '',
    dataVencimento: divida?.dataVencimento ? paraCampoData(divida.dataVencimento) : '',
    observacao: divida?.observacao ?? '',
  }));

  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);

  // Seção de pagamento (só aparece na edição)
  const [pagamentoAberto, definirPagamentoAberto] = useState(false);
  const [valorPagamento, definirValorPagamento] = useState('');

  function alterar<C extends keyof Formulario>(campo: C, valor: Formulario[C]) {
    definirFormulario((atual) => {
      const proximo: Formulario = { ...atual };
      proximo[campo] = valor;
      return proximo;
    });
  }

  function validar(): DadosDeDivida | string {
    const descricao = formulario.descricao.trim();
    if (descricao.length === 0) {
      return 'Escreva o que é essa dívida: "Empréstimo pessoal", "Financiamento"…';
    }
    if (descricao.length > 120) return 'A descrição passou de 120 caracteres.';

    const valor = interpretarValor(formulario.valor);
    if (valor === null || valor <= 0) return 'Informe um valor maior que zero.';

    const valorPago = interpretarValor(formulario.valorPago);
    if (valorPago === null || valorPago < 0) return 'O valor pago não pode ser negativo.';

    const credor = formulario.credor.trim();
    if (credor.length === 0) return 'Informe o credor (quem emprestou ou a quem se deve).';
    if (credor.length > 120) return 'O nome do credor passou de 120 caracteres.';

    const dataVencimento = deCampoData(formulario.dataVencimento);

    const observacao = formulario.observacao.trim();
    if (observacao.length > 500) return 'A observação passou de 500 caracteres.';

    return {
      descricao,
      valor,
      valorPago,
      credor,
      dataVencimento: dataVencimento ?? null,
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
      await aoSalvar(resultado);
      aoFechar();
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : String(falha));
      definirSalvando(false);
    }
  }

  async function registrarPagamento() {
    if (!divida) return;

    const valor = interpretarValor(valorPagamento);
    if (valor === null || valor <= 0) {
      definirErro('Informe um valor de pagamento maior que zero.');
      return;
    }

    const novoValorPago = Math.min(divida.valorPago + valor, divida.valor);
    definirSalvando(true);
    definirErro(null);
    try {
      await aoSalvar({
        descricao: divida.descricao,
        valor: divida.valor,
        valorPago: novoValorPago,
        credor: divida.credor,
        dataVencimento: divida.dataVencimento,
        observacao: divida.observacao,
      });
      aoFechar();
    } catch (falha) {
      definirErro(falha instanceof Error ? falha.message : String(falha));
      definirSalvando(false);
    }
  }

  function aoEnviar(evento: FormEvent) {
    evento.preventDefault();
    void gravar();
  }

  const editando = divida !== undefined;
  const valorInterpretado = interpretarValor(formulario.valor);
  const valorPagoInterpretado = interpretarValor(formulario.valorPago);
  const restante =
    valorInterpretado !== null && valorPagoInterpretado !== null
      ? valorInterpretado - valorPagoInterpretado
      : null;

  return (
    <Modal
      titulo={editando ? 'Editar dívida' : 'Nova dívida'}
      descricao={
        editando
          ? 'Atualize os dados da dívida ou registre um pagamento.'
          : 'Registre uma dívida que não entra no planejamento mensal.'
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
            {salvando ? 'Salvando…' : editando ? 'Salvar mudanças' : 'Criar dívida'}
          </button>
        </>
      }
    >
      <form className="formulario" onSubmit={aoEnviar}>
        <label className="campo">
          <span>Descrição</span>
          <input
            type="text"
            maxLength={120}
            autoComplete="off"
            placeholder="Empréstimo pessoal"
            value={formulario.descricao}
            onChange={(evento) => alterar('descricao', evento.target.value)}
          />
        </label>

        <div className="campo campo-valor">
          <span>Valor total da dívida</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={formulario.valor}
            onChange={(evento) => alterar('valor', evento.target.value)}
          />
          <span className="dica-campo">Use vírgula para os centavos: 1.250,90.</span>
        </div>

        <div className="campo campo-valor">
          <span>Valor já pago</span>
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            value={formulario.valorPago}
            onChange={(evento) => alterar('valorPago', evento.target.value)}
          />
          <span className="dica-campo">
            {restante !== null && restante > 0
              ? `Faltam ${formatarMoeda(restante)}.`
              : restante !== null && restante <= 0
                ? 'Dívida quitada!'
                : 'Quanto já foi pago até agora.'}
          </span>
        </div>

        <label className="campo">
          <span>Credor</span>
          <input
            type="text"
            maxLength={120}
            autoComplete="off"
            placeholder="Banco, pessoa, instituição…"
            value={formulario.credor}
            onChange={(evento) => alterar('credor', evento.target.value)}
          />
        </label>

        <label className="campo">
          <span>Data de vencimento (opcional)</span>
          <input
            type="date"
            value={formulario.dataVencimento}
            onChange={(evento) => alterar('dataVencimento', evento.target.value)}
          />
          <span className="dica-campo">Quando essa dívida vence ou venceu.</span>
        </label>

        <label className="campo">
          <span>Observação (opcional)</span>
          <textarea
            maxLength={500}
            placeholder="Número do contrato, parcelas restantes, condições…"
            value={formulario.observacao}
            onChange={(evento) => alterar('observacao', evento.target.value)}
          />
        </label>

        {/* Seção de registro de pagamento — só na edição */}
        {editando && divida.valorPago < divida.valor ? (
          <div className="aviso">
            <strong>Registrar pagamento</strong>
            <div className="campo campo-valor">
              <span>Valor do pagamento</span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={valorPagamento}
                onChange={(evento) => definirValorPagamento(evento.target.value)}
              />
              <span className="dica-campo">
                Total pago: {formatarMoeda(divida.valorPago)} de {formatarMoeda(divida.valor)}.
              </span>
            </div>
            <button
              type="button"
              className="botao botao-principal"
              onClick={() => void registrarPagamento()}
              disabled={salvando || valorPagamento.trim().length === 0}
            >
              {salvando ? 'Salvando…' : 'Registrar pagamento'}
            </button>
          </div>
        ) : null}

        {erro ? <div className="aviso aviso-erro">{erro}</div> : null}

        {/* Envio pelo Enter; os botões visíveis ficam no rodapé do modal. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1}>
          Salvar
        </button>
      </form>
    </Modal>
  );
}
