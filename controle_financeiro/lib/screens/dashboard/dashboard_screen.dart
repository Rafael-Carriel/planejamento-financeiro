import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../models/resumo_financeiro.dart';
import '../../models/transacao.dart';
import '../../state/estado_transacoes.dart';
import '../../widgets/cartao_resumo.dart';
import '../../widgets/estado_vazio.dart';
import '../../widgets/item_transacao.dart';
import '../transacoes/form_transacao_screen.dart';

/// Visão geral do mês: saldo, totais e os últimos lançamentos.
class DashboardScreen extends StatelessWidget {
  const DashboardScreen({
    required this.uid,
    required this.nome,
    required this.onVerTodos,
    super.key,
  });

  final String uid;
  final String nome;
  final VoidCallback onVerTodos;

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

    final resumo = ResumoFinanceiro.de(estado.transacoes);
    final ultimos = estado.transacoes.take(5).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
      children: <Widget>[
        Text(
          'Olá, ${_primeiroNome(nome)}',
          style: Theme.of(context)
              .textTheme
              .titleMedium
              ?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 16),
        CartaoResumo(resumo: resumo),
        const SizedBox(height: 24),
        if (estado.transacoes.isEmpty)
          EstadoVazio(
            icone: Icons.savings_outlined,
            titulo: 'Nenhum lançamento neste mês',
            mensagem:
                'Toque em "Lançamento" para registrar sua primeira entrada ou saída.',
            acao: FilledButton.tonalIcon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => FormTransacaoScreen(
                    uid: uid,
                    mesReferencia: DateTime.now(),
                  ),
                ),
              ),
              icon: const Icon(Icons.add),
              label: const Text('Adicionar agora'),
            ),
          )
        else ...<Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  'Últimos lançamentos',
                  style: Theme.of(context)
                      .textTheme
                      .titleSmall
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              TextButton(
                onPressed: onVerTodos,
                child: const Text('Ver todos'),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Card(
            child: Column(
              children: <Widget>[
                for (var indice = 0; indice < ultimos.length; indice++) ...<Widget>[
                  if (indice > 0) const Divider(height: 1, indent: 70),
                  ItemTransacao(
                    transacao: ultimos[indice],
                    onTap: () => _editar(context, ultimos[indice]),
                  ),
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }

  void _editar(BuildContext context, Transacao transacao) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => FormTransacaoScreen(
          uid: uid,
          mesReferencia: transacao.data,
          transacao: transacao,
        ),
      ),
    );
  }

  String _primeiroNome(String completo) {
    final partes = completo.trim().split(RegExp(r'\s+'));
    return partes.isEmpty || partes.first.isEmpty ? 'tudo bem' : partes.first;
  }
}
