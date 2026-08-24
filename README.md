# Planejamento Financeiro

Controle de entradas e saídas do mês, em dois aplicativos que conversam com o
**mesmo** projeto no Firebase (`controle-financeiro-rafael`) e com o mesmo
modelo de dados no Firestore. O que você lança no celular aparece na web e
vice-versa, porque não existe banco separado: existe uma coleção por usuário.

| Pasta | O que é | Como abrir |
| --- | --- | --- |
| [`controle_financeiro/`](controle_financeiro) | Aplicativo Flutter (Android) | `flutter run` — veja o [SETUP](controle_financeiro/SETUP.md) |
| [`controle-financeiro-web/`](controle-financeiro-web) | Aplicativo React + Vite (navegador) | `.\iniciar.ps1` — veja o [LEIA-ME](controle-financeiro-web/LEIA-ME.md) |

## Onde ficam as regras do banco

`controle_financeiro/firestore.rules` é a **fonte única** das regras de
segurança, usada pelos dois aplicativos. Se um campo novo entrar no modelo, ele
precisa entrar ali antes de a gravação funcionar. Publicar:

```powershell
cd controle_financeiro
firebase deploy --only firestore:rules
```

## O que o repositório não guarda

As chaves e os arquivos gerados na máquina ficam fora do git: `.env.local` na
web, `lib/firebase_options.dart` e `google-services.json` no Flutter. Cada um
deles tem um `.example` ou um script `configurar` que o recria. As chaves da web
são públicas por natureza (o navegador as enxerga de qualquer forma) — quem
protege os dados são as regras do Firestore, não o segredo da chave.
