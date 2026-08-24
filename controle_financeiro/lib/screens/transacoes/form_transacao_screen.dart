import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/categorias.dart';
import '../../core/formatters.dart';
import '../../core/theme.dart';
import '../../models/transacao.dart';
import '../../services/firestore_service.dart';

/// Cadastro e edição de um lançamento.
///
/// A mesma tela atende os dois casos: passar [transacao] liga o modo edição.
class FormTransacaoScreen extends StatefulWidget {
  const FormTransacaoScreen({
    required this.uid,
    required this.mesReferencia,
    this.transacao,
    super.key,
  });

  final String uid;

  /// Mês que o usuário está visualizando - define a data sugerida.
  final DateTime mesReferencia;

  /// Quando informado, a tela edita este lançamento em vez de criar um novo.
  final Transacao? transacao;

  @override
  State<FormTransacaoScreen> createState() => _FormTransacaoScreenState();
}

class _FormTransacaoScreenState extends State<FormTransacaoScreen> {
  final _formulario = GlobalKey<FormState>();
  late final TextEditingController _valor;
  late final TextEditingController _descricao;
  late final TextEditingController _observacao;

  late TipoTransacao _tipo;
  late String _categoria;
  late DateTime _data;
  bool _salvando = false;

  bool get _editando => widget.transacao != null;

  @override
  void initState() {
    super.initState();
    final existente = widget.transacao;

    _tipo = existente?.tipo ?? TipoTransacao.saida;
    _categoria = existente?.categoria ?? Categorias.padraoPara(_tipo);
    _data = existente?.data ?? _dataSugerida();

    _valor = TextEditingController(
      text: existente == null
          ? ''
          : existente.valor.toStringAsFixed(2).replaceAll('.', ','),
    );
    _descricao = TextEditingController(text: existente?.descricao ?? '');
    _observacao = TextEditingController(text: existente?.observacao ?? '');
  }

  /// Hoje, se o usuário está no mês corrente; senão o dia 1 do mês exibido.
  DateTime _dataSugerida() {
    final agora = DateTime.now();
    final mesmoMes = widget.mesReferencia.year == agora.year &&
        widget.mesReferencia.month == agora.month;
    return mesmoMes ? somenteData(agora) : inicioDoMes(widget.mesReferencia);
  }

  @override
  void dispose() {
    _valor.dispose();
    _descricao.dispose();
    _observacao.dispose();
    super.dispose();
  }

  void _trocarTipo(TipoTransacao novo) {
    setState(() {
      _tipo = novo;
      // A categoria antiga pode não existir no outro tipo.
      final disponiveis = Categorias.para(novo).map((c) => c.nome);
      if (!disponiveis.contains(_categoria)) {
        _categoria = Categorias.padraoPara(novo);
      }
    });
  }

  Future<void> _escolherData() async {
    final escolhida = await showDatePicker(
      context: context,
      initialDate: _data,
      firstDate: DateTime(2015),
      lastDate: DateTime(DateTime.now().year + 5, 12, 31),
      helpText: 'Data do lançamento',
    );
    if (escolhida != null) setState(() => _data = somenteData(escolhida));
  }

  Future<void> _salvar() async {
    if (!_formulario.currentState!.validate()) return;

    final valor = parseValor(_valor.text);
    if (valor == null) return;

    setState(() => _salvando = true);
    final firestore = context.read<FirestoreService>();
    final navegador = Navigator.of(context);
    final mensageiro = ScaffoldMessenger.of(context);

    final transacao = Transacao(
      id: widget.transacao?.id ?? '',
      descricao: _descricao.text,
      valor: valor,
      tipo: _tipo,
      categoria: _categoria,
      data: _data,
      observacao: _observacao.text,
      criadoEm: widget.transacao?.criadoEm,
    );

    try {
      if (_editando) {
        await firestore.atualizarTransacao(uid: widget.uid, transacao: transacao);
      } else {
        await firestore.adicionarTransacao(uid: widget.uid, transacao: transacao);
      }
      if (!mounted) return;
      navegador.pop();
      mensageiro.showSnackBar(
        SnackBar(
          content: Text(_editando ? 'Lançamento atualizado.' : 'Lançamento salvo.'),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _salvando = false);
      mensageiro.showSnackBar(
        const SnackBar(content: Text('Não foi possível salvar. Tente de novo.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final entrada = _tipo == TipoTransacao.entrada;
    final cor = entrada ? AppCores.entrada : AppCores.saida;

    return Scaffold(
      appBar: AppBar(
        title: Text(_editando ? 'Editar lançamento' : 'Novo lançamento'),
      ),
      body: SafeArea(
        child: Form(
          key: _formulario,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
            children: <Widget>[
              SegmentedButton<TipoTransacao>(
                segments: const <ButtonSegment<TipoTransacao>>[
                  ButtonSegment<TipoTransacao>(
                    value: TipoTransacao.saida,
                    label: Text('Saída'),
                    icon: Icon(Icons.arrow_upward),
                  ),
                  ButtonSegment<TipoTransacao>(
                    value: TipoTransacao.entrada,
                    label: Text('Entrada'),
                    icon: Icon(Icons.arrow_downward),
                  ),
                ],
                selected: <TipoTransacao>{_tipo},
                onSelectionChanged: (selecao) => _trocarTipo(selecao.first),
              ),
              const SizedBox(height: 24),
              TextFormField(
                controller: _valor,
                autofocus: !_editando,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: <TextInputFormatter>[
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.,]')),
                ],
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  color: cor,
                ),
                decoration: const InputDecoration(
                  labelText: 'Valor',
                  prefixText: 'R\$ ',
                  hintText: '0,00',
                ),
                validator: (texto) => parseValor(texto ?? '') == null
                    ? 'Informe um valor maior que zero.'
                    : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _descricao,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Descrição',
                  hintText: 'Ex.: Mercado do mês',
                  prefixIcon: Icon(Icons.edit_outlined),
                ),
                validator: (texto) => (texto == null || texto.trim().length < 2)
                    ? 'Descreva o lançamento.'
                    : null,
              ),
              const SizedBox(height: 16),
              InputDecorator(
                decoration: const InputDecoration(
                  labelText: 'Categoria',
                  prefixIcon: Icon(Icons.label_outline),
                ),
                child: DropdownButton<String>(
                  value: _categoria,
                  isExpanded: true,
                  underline: const SizedBox.shrink(),
                  items: <DropdownMenuItem<String>>[
                    for (final categoria in Categorias.para(_tipo))
                      DropdownMenuItem<String>(
                        value: categoria.nome,
                        child: Row(
                          children: <Widget>[
                            Icon(categoria.icone, size: 18),
                            const SizedBox(width: 10),
                            Text(categoria.nome),
                          ],
                        ),
                      ),
                  ],
                  onChanged: (valor) {
                    if (valor != null) setState(() => _categoria = valor);
                  },
                ),
              ),
              const SizedBox(height: 16),
              InkWell(
                onTap: _escolherData,
                borderRadius: BorderRadius.circular(14),
                child: InputDecorator(
                  decoration: const InputDecoration(
                    labelText: 'Data',
                    prefixIcon: Icon(Icons.event_outlined),
                  ),
                  child: Text(formatarData(_data)),
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _observacao,
                maxLines: 3,
                textCapitalization: TextCapitalization.sentences,
                decoration: const InputDecoration(
                  labelText: 'Observação (opcional)',
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 28),
              FilledButton.icon(
                onPressed: _salvando ? null : _salvar,
                icon: _salvando
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.4,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.check),
                label: Text(_editando ? 'Salvar alterações' : 'Salvar lançamento'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
