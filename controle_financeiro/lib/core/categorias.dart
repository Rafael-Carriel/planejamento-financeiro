import 'package:flutter/material.dart';

import '../models/transacao.dart';

/// Categoria pré-definida, com o ícone usado na lista.
class Categoria {
  const Categoria(this.nome, this.icone);

  final String nome;
  final IconData icone;
}

/// Catálogo fixo de categorias.
///
/// Ficam no app (e não no Firestore) para a lista funcionar offline e sem
/// leitura extra. Se um dia o usuário puder criar categorias próprias, mova
/// isto para uma subcoleção `usuarios/{uid}/categorias`.
abstract final class Categorias {
  static const List<Categoria> entradas = <Categoria>[
    Categoria('Salário', Icons.badge_outlined),
    Categoria('Freelance', Icons.laptop_mac_outlined),
    Categoria('Vendas', Icons.sell_outlined),
    Categoria('Investimentos', Icons.trending_up),
    Categoria('Presente', Icons.card_giftcard_outlined),
    Categoria('Reembolso', Icons.replay_outlined),
    Categoria('Outras entradas', Icons.add_circle_outline),
  ];

  static const List<Categoria> saidas = <Categoria>[
    Categoria('Moradia', Icons.home_outlined),
    Categoria('Alimentação', Icons.restaurant_outlined),
    Categoria('Mercado', Icons.shopping_cart_outlined),
    Categoria('Transporte', Icons.directions_bus_outlined),
    Categoria('Saúde', Icons.favorite_outline),
    Categoria('Educação', Icons.school_outlined),
    Categoria('Lazer', Icons.sports_esports_outlined),
    Categoria('Assinaturas', Icons.subscriptions_outlined),
    Categoria('Contas', Icons.receipt_long_outlined),
    Categoria('Roupas', Icons.checkroom_outlined),
    Categoria('Dívidas', Icons.credit_card_outlined),
    Categoria('Outras saídas', Icons.remove_circle_outline),
  ];

  static List<Categoria> para(TipoTransacao tipo) =>
      tipo == TipoTransacao.entrada ? entradas : saidas;

  static String padraoPara(TipoTransacao tipo) => para(tipo).first.nome;

  /// Ícone da categoria; cai num genérico se o nome não estiver no catálogo
  /// (por exemplo, dados antigos ou gravados por outra versão do app).
  static IconData icone(String nome) {
    for (final categoria in <Categoria>[...entradas, ...saidas]) {
      if (categoria.nome == nome) return categoria.icone;
    }
    return Icons.label_outline;
  }
}
