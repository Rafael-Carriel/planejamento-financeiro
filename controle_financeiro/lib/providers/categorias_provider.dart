import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/categorias.dart';
import '../models/transacao.dart';

/// Catálogo de categorias de entrada, exposto como provider.
///
/// A lista é fixa (ver `core/categorias.dart`), então o provider apenas a
/// reaproveita; se um dia as categorias vierem do Firestore, basta trocar o
/// corpo por um `StreamProvider` sem mexer nas telas.
final categoriasEntradaProvider = Provider<List<Categoria>>(
  (ref) => Categorias.entradas,
);

/// Catálogo de categorias de saída.
final categoriasSaidaProvider = Provider<List<Categoria>>(
  (ref) => Categorias.saidas,
);

/// Categorias do tipo informado (entrada ou saída).
final categoriasPorTipoProvider = Provider.family<List<Categoria>, TipoTransacao>(
  (ref, tipo) => Categorias.para(tipo),
);

/// Nome da categoria padrão do tipo - usado ao abrir um novo lançamento.
final categoriaPadraoProvider = Provider.family<String, TipoTransacao>(
  (ref, tipo) => Categorias.padraoPara(tipo),
);

/// Ícone de uma categoria pelo nome, com fallback genérico.
final iconeCategoriaProvider = Provider.family<IconData, String>(
  (ref, nome) => Categorias.icone(nome),
);
