# Planeora

O aplicativo original deste repositório usa agora o nome público Planeora. A publicação web permanece no site Firebase `controle-financeiro-rafael`; o outro site do projeto não é substituído.

Privacidade e termos são acessíveis sem login. A área Privacidade e direitos permite exportar registros e protocolar pedidos; a administração acompanha os atendimentos. Consulte [SECURITY.md](SECURITY.md) e [operação de privacidade](docs/privacidade-operacao.md) para limites e procedimentos necessários. Esses documentos não constituem certificação jurídica ou pentest.

Antes de publicar, confira o SAC configurado em `controle-financeiro-web/src/legal.ts`, gere o build de produção e confira a revisão. A checagem anterior ao deploy bloqueia builds de teste e configurações incompletas. A mensalidade permanece desativada até liberação operacional.

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


### SAC do Planeora
O nome público autorizado é Planeora, com atendimento em `/#/atendimento`. Não divulgar nome ou e-mail pessoal do proprietário. Usuários com e-mail verificado abrem protocolos privados; o administrador verificado responde na área Administração. Consultar diariamente SAC e pedidos de privacidade; respostas aparecem no sistema, sem aviso automático por e-mail. Incluir mensagens na exportação e na análise de retenção/exclusão.

A marca e o SAC não substituem a identificação jurídica do fornecedor/controlador quando exigida. Essa identificação e um canal alternativo para pessoas sem acesso à conta permanecem pendências de análise jurídica e operacional; não declarar conformidade integral com LGPD/CDC.
