import 'package:flutter/material.dart';

import '../core/theme.dart';
import '../services/connectivity_service.dart';

/// Faixa fixa no topo que avisa quando o aparelho está sem internet.
///
/// Ouve o stream de conectividade: quando fica offline, aparece uma faixa
/// âmbar dizendo que os dados serão sincronizados quando a conexão voltar;
/// quando a conexão volta, a faixa some sozinha.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<bool>(
      stream: ConnectivityService.instancia.onConnectivityChanged,
      // Otimista até a primeira checagem: não pisca a faixa no início.
      initialData: true,
      builder: (BuildContext context, AsyncSnapshot<bool> snapshot) {
        final online = snapshot.data ?? true;
        if (online) return const SizedBox.shrink();

        return const Material(
          color: AppCores.avisoSuave,
          child: Padding(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: <Widget>[
                Icon(Icons.wifi_off, size: 18, color: AppCores.aviso),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Modo offline — os dados serão sincronizados quando a '
                    'conexão voltar',
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: AppCores.aviso,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
