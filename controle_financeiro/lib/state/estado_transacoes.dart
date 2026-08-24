import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/transacao.dart';
import '../services/firestore_service.dart';
import 'mes_selecionado.dart';

/// Retrato das transações do mês selecionado, com carregamento e erro.
@immutable
class EstadoTransacoes {
  const EstadoTransacoes({
    required this.transacoes,
    required this.carregando,
    this.erro,
  });

  final List<Transacao> transacoes;
  final bool carregando;
  final String? erro;

  bool get vazio => !carregando && erro == null && transacoes.isEmpty;

  List<Transacao> get entradas =>
      transacoes.where((transacao) => transacao.isEntrada).toList();

  List<Transacao> get saidas =>
      transacoes.where((transacao) => !transacao.isEntrada).toList();
}

/// Abre **uma** assinatura no Firestore por mês e compartilha o resultado com
/// todas as abas.
///
/// Sem isso, dashboard, lista e relatórios abririam três listeners para a mesma
/// consulta - o que funciona, mas custa três vezes mais leituras.
class ProvedorDeTransacoesDoMes extends StatefulWidget {
  const ProvedorDeTransacoesDoMes({
    required this.uid,
    required this.child,
    super.key,
  });

  final String uid;
  final Widget child;

  @override
  State<ProvedorDeTransacoesDoMes> createState() =>
      _ProvedorDeTransacoesDoMesState();
}

class _ProvedorDeTransacoesDoMesState extends State<ProvedorDeTransacoesDoMes> {
  DateTime? _mesAssinado;
  Stream<List<Transacao>>? _fluxo;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Provider.of com listen ligado é o padrão suportado em
    // didChangeDependencies: reagimos à troca de mês sem recriar o
    // stream em toda reconstrução da tela.
    final mes = Provider.of<MesSelecionado>(context).mes;
    if (_fluxo != null && mes == _mesAssinado) return;

    _mesAssinado = mes;
    _fluxo = context.read<FirestoreService>().transacoesDoMes(
          uid: widget.uid,
          mes: mes,
        );
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Transacao>>(
      stream: _fluxo,
      builder: (context, snapshot) {
        final estado = EstadoTransacoes(
          transacoes: snapshot.data ?? const <Transacao>[],
          carregando: snapshot.connectionState == ConnectionState.waiting &&
              !snapshot.hasData,
          erro: snapshot.hasError ? _mensagemDeErro(snapshot.error!) : null,
        );

        return Provider<EstadoTransacoes>.value(
          value: estado,
          child: widget.child,
        );
      },
    );
  }

  String _mensagemDeErro(Object erro) {
    final texto = erro.toString();
    if (texto.contains('permission-denied')) {
      return 'Sem permissão para ler estes dados. Confira as regras do Firestore.';
    }
    if (texto.contains('unavailable') || texto.contains('network')) {
      return 'Sem conexão com o servidor. Mostrando o que estiver em cache.';
    }
    return 'Não foi possível carregar as transações.';
  }
}
