import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/formatters.dart';
import '../../models/resumo_financeiro.dart';
import '../../models/transacao.dart';
import '../../services/firestore_service.dart';
import '../../state/estado_transacoes.dart';
import '../../widgets/estado_vazio.dart';
import '../../widgets/item_transacao.dart';
import 'form_transacao_screen.dart';

enum _Filtro { todos, entradas, saidas }

/// Lista completa do mês, agrupada por dia, com filtro e exclusão.
class TransacoesScreen extends StatefulWidget {
  const TransacoesScreen({required this.uid, super.key});

  final String uid;

  @override
  State<TransacoesScreen> createState() => _TransacoesScreenState();
}

class _TransacoesScreenState extends State<TransacoesScreen> {
  _Filtro _filtro = _Filtro.todos;

  @override
  Widget build(BuildContext context) {
    final estado = context.watch<EstadoTransacoes>();

    if (estado.carregando) {
      return const Center(child: CircularProgressIndicator());
    }
    if (estado.erro != null) {
      return EstadoVazio(
        icone: Icons.cloud_off_outlined,
        titulo: 'Não deu para carregar',
        mensagem: estado.erro!,
      );
    }

    final filtradas = switch (_filtro) {
      _Filtro.todos => estado.transacoes,
      _Filtro.entradas => estado.entradas,
      _Filtro.saidas => estado.saidas,
    };
    final resumo = ResumoFinanceiro.de(filtradas);

    return Column(
      children: <Widget>[
        _BarraDeFiltro(
          selecionado: _filtro,
          onSelecionar: (filtro) => setState(() => _filtro = filtro),
          quantidade: filtradas.length,
          total: switch (_filtro) {
            _Filtro.todos => resumo.saldo,
            _Filtro.entradas => resumo.entradas,
            _Filtro.saidas => resumo.saidas,
          },
        ),
        Expanded(
          child: filtradas.isEmpty
              ? const EstadoVazio(
                  icone: Icons.filter_list_off,
                  titulo: 'Nada por aqui',
                  mensagem:
                      'Não há lançamentos com esse filtro no mês selecionado.',
                )
              : _ListaAgrupada(
                  transacoes: filtradas,
                  onEditar: _editar,
                  onExcluir: _excluir,
                ),
        ),
      ],
    );
  }

  void _editar(Transacao transacao) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => FormTransacaoScreen(
          uid: widget.uid,
          mesReferencia: transacao.data,
          transacao: transacao,
        ),
      ),
    );
  }

  Future<bool> _excluir(Transacao transacao) async {
    final confirmado = await showDialog<bool>(
      context: context,
      builder: (contexto) => AlertDialog(
        title: const Text('Excluir lançamento?'),
        content: Text(
          '"${transacao.descricao}" de ${formatarMoeda(transacao.valor)} '
          'será removido definitivamente.',
        ),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(contexto).pop(false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(contexto).pop(true),
            child: const Text('Excluir'),
          ),
        ],
      ),
    );

    if (confirmado != true || !mounted) return false;

    try {
      await context.read<FirestoreService>().removerTransacao(
            uid: widget.uid,
            transacaoId: transacao.id,
          );
      return true;
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Não foi possível excluir. Tente de novo.')),
        );
      }
      return false;
    }
  }
}

class _BarraDeFiltro extends StatelessWidget {
  const _BarraDeFiltro({
    required this.selecionado,
    required this.onSelecionar,
    required this.quantidade,
    required this.total,
  });

  final _Filtro selecionado;
  final ValueChanged<_Filtro> onSelecionar;
  final int quantidade;
  final double total;

  @override
  Widget build(BuildContext context) {
    final cores = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Wrap(
            spacing: 8,
            children: <Widget>[
              for (final filtro in _Filtro.values)
                ChoiceChip(
                  label: Text(switch (filtro) {
                    _Filtro.todos => 'Todos',
                    _Filtro.entradas => 'Entradas',
                    _Filtro.saidas => 'Saídas',
                  }),
                  selected: selecionado == filtro,
                  onSelected: (_) => onSelecionar(filtro),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '$quantidade ${quantidade == 1 ? 'lançamento' : 'lançamentos'} · '
            '${formatarMoeda(total)}',
            style: TextStyle(fontSize: 12.5, color: cores.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _ListaAgrupada extends StatelessWidget {
  const _ListaAgrupada({
    required this.transacoes,
    required this.onEditar,
    required this.onExcluir,
  });

  final List<Transacao> transacoes;
  final void Function(Transacao) onEditar;
  final Future<bool> Function(Transacao) onExcluir;

  @override
  Widget build(BuildContext context) {
    final grupos = <DateTime, List<Transacao>>{};
    for (final transacao in transacoes) {
      grupos.putIfAbsent(somenteData(transacao.data), () => <Transacao>[]).add(transacao);
    }
    final dias = grupos.keys.toList()..sort((a, b) => b.compareTo(a));

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
      itemCount: dias.length,
      itemBuilder: (context, indice) {
        final dia = dias[indice];
        final doDia = grupos[dia]!;
        final saldoDoDia = doDia.fold<double>(
          0,
          (acumulado, transacao) => acumulado + transacao.valorComSinal,
        );

        return Padding(
          padding: EdgeInsets.only(top: indice == 0 ? 0 : 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.only(left: 4, bottom: 8),
                child: Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        formatarDiaCompleto(dia),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Text(
                      formatarMoeda(saldoDoDia),
                      style: TextStyle(
                        fontSize: 12.5,
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
              Card(
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: <Widget>[
                    for (var i = 0; i < doDia.length; i++) ...<Widget>[
                      if (i > 0) const Divider(height: 1, indent: 70),
                      Dismissible(
                        key: ValueKey<String>(doDia[i].id),
                        direction: DismissDirection.endToStart,
                        confirmDismiss: (_) => onExcluir(doDia[i]),
                        background: Container(
                          color: Theme.of(context).colorScheme.errorContainer,
                          alignment: Alignment.centerRight,
                          padding: const EdgeInsets.only(right: 20),
                          child: Icon(
                            Icons.delete_outline,
                            color: Theme.of(context).colorScheme.onErrorContainer,
                          ),
                        ),
                        child: ItemTransacao(
                          transacao: doDia[i],
                          mostrarData: false,
                          onTap: () => onEditar(doDia[i]),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
