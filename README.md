# Visitas de Obra (app de celular)

App para registrar visitas a obras: **contato, endereço, localização GPS/Google Maps, fotos, material de marketing entregue e retornos**.
É um **PWA**: instala na tela inicial do Android e do iPhone como um aplicativo, funciona **sem internet** e não precisa de loja de apps.

## Funcionalidades

- **Login simples**: só **e-mail e senha**, criados no primeiro acesso; depois o app **continua conectado** neste celular até tocar em *Sair*. Sem tela de código no cadastro nem no login; o **código de recuperação é opcional** e é gerado em *Ajustes* quando a pessoa quiser.
- **Nova visita**: obra, construtora, tipo e etapa; vários contatos (nome, cargo, telefone/WhatsApp, e-mail).
- **Endereço**: busca automática pelo **CEP** (ViaCEP) ou **pela localização do GPS**.
- **Localização**: botão **Capturar GPS** (busca a melhor precisão por até 15 s), ou **colar link do Google Maps**. Abre **Mapa** e **Rota** no Google Maps.
- **Fotos**: câmera ou galeria, com categoria (fachada, materiais, MKT entregue…), compactadas e com **carimbo de data/hora, GPS e obra**.
- **Material de MKT entregue**, interesse (quente/morno/frio), status, **data de retorno**, próximos passos e KM.
- **Salvamento automático** (rascunho), mesmo se o celular fechar o navegador ao abrir a câmera.
- **Relatório**: compartilha texto + fotos pelo WhatsApp/e-mail com 1 toque.
- **Retornos**: lista de atrasados/hoje/próximos, **rota do dia** no Google Maps e evento no **Google Agenda**.
- **Checklist de saída** diário (EPI, celular, material de MKT, veículo) + **KM do dia**.
- **Exportar planilha em Excel (.xlsx)**, com acentos corretos em qualquer programa (Excel, Google Planilhas, visualizador do celular), cabeçalho colorido, linha congelada e filtros. Também há **CSV** para outros programas e **backup/restauração** em ZIP, com fotos, completo ou só das novidades.
- **Rápido com muitos dados**: a lista usa miniaturas e carrega 40 visitas por vez (testado com 2000 visitas e 6000 fotos).
- Cores da marca (`Cores.png`): azul `#024089`, amarelo `#ffcc00`, cinzas `#3d3d3c` / `#2c2c2c` e branco.

## Estrutura

```
App/
├── public/                  ⬅ O APP (é esta pasta que se publica)
│   ├── index.html
│   ├── manifest.webmanifest   dados de instalação (nome, ícones, cores)
│   ├── sw.js                  service worker (offline) — troque a versão ao atualizar
│   ├── _headers               cabeçalhos de segurança para Netlify/Cloudflare
│   ├── css/styles.css         visual (cores da marca)
│   ├── js/config.js           ⚙️ PERSONALIZAÇÃO: nome, cores, listas, checklist, fotos
│   ├── js/db.js               banco local (IndexedDB)
│   ├── js/photos.js           compactação, carimbo e miniaturas das fotos
│   ├── js/zip.js              leitura e escrita de ZIP (backup)
│   ├── js/xlsx.js             gerador de planilha Excel (.xlsx)
│   ├── js/auth.js             login por e-mail e senha (hash, código de recuperação opcional, bloqueio por tentativas)
│   ├── js/app.js              telas e lógica
│   └── icons/                 ícones do app
├── .github/workflows/pages.yml       publicação automática no GitHub Pages
├── docs/FERRAMENTAS-COLABORADOR.md   kit e rotina do colaborador
├── package.json             comandos Node (servidor `npm start` e publicação)
├── serve.json               cabeçalhos/configuração do servidor do `npm start` (fica fora da pasta publicada)
├── netlify.toml / vercel.json / firebase.json   configurações de cada hospedagem
├── Cores.png                paleta da marca
└── README.md
```

---

## Publicar o app

Câmera, GPS e modo offline só funcionam em endereço **https**. Qualquer hospedagem de site estático com https serve.
Os dados das visitas **não vão para a hospedagem**: ficam no celular. Mesmo com o link público, ninguém vê as visitas.

### Opção A — Sem instalar nada (arrastar e soltar)

| Hospedagem | Passo a passo | Endereço gerado |
|---|---|---|
| **Netlify Drop** (mais rápido) | Acesse **app.netlify.com/drop**, crie conta grátis e **arraste a pasta `public`** | `nome.netlify.app` |
| **Cloudflare Pages** | Painel Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Upload assets** → arraste a pasta `public` | `nome.pages.dev` |
| **GitHub Pages** | Veja a seção **“Publicar pelo GitHub Pages”** abaixo (publicação automática pela pasta `public`) | `usuario.github.io/repositorio/` |
| **Site da empresa** (cPanel/FTP) | Envie o conteúdo de `public` para uma subpasta ou subdomínio (ex.: `visitas.suaempresa.com.br`). O SSL (https) precisa estar ativo | o seu domínio |

> No GitHub Pages grátis o repositório fica público (só o código; nenhum dado de visita).

### Publicar pelo GitHub Pages (automático)

O projeto já traz o workflow `.github/workflows/pages.yml`, que publica a pasta `public/` a cada atualização na branch `main`.

1. Envie o projeto inteiro para o repositório (menos a pasta `.claude`).
2. Uma vez só: **Settings → Pages → Build and deployment → Source: “GitHub Actions”**.
3. Acompanhe em **Actions**; ao terminar, o app fica em `https://usuario.github.io/visitas-obra/`.
4. Para atualizar: envie os arquivos alterados (lembre de aumentar a versão em `public/sw.js`). A publicação roda sozinha.

O app funciona na subpasta `/visitas-obra/` (testado: login, GPS, fotos, relatório, CSV, exclusão e modo offline).

### Opção B — Com Node.js (linha de comando)

Vantagem: publica e atualiza com **um comando**, sem arrastar pastas.

**1. Instalar o Node.js (uma vez só).** No PowerShell:

```bash
winget install OpenJS.NodeJS.LTS
```

Ou baixe a versão **LTS** em nodejs.org. Feche e abra o terminal e confira:

```bash
node --version
```

**2. Instalar as dependências e testar no computador** (dentro da pasta `App`):

```bash
npm install
```

```bash
npm start
```

Abra http://localhost:3000 (no Chrome, F12 → modo celular).
O `npm install` cria o `package-lock.json`: guarde-o junto com o projeto (versões fixas e iguais em todo lugar).

**Porta do servidor:** o `npm start` usa o [serve](https://github.com/vercel/serve), que lê a porta da variável de ambiente **`PORT`** (padrão **3000**). Nada de porta fixa no código. Para escolher outra porta no PowerShell:

```bash
$env:PORT=8080; npm start
```

Sem Node, também funciona com Python: `python -m http.server 8080 --directory public`.

**Hospedagem com Node (Render, Railway, Azure App Service, Fly.io etc.):** essas plataformas definem `PORT` sozinhas. Configure *Build command* `npm ci` e *Start command* `npm start`.

**3. Publicar** — escolha uma hospedagem. Na primeira vez cada uma abre o navegador para você fazer login e criar o projeto:

| Hospedagem | Comando | Observação |
|---|---|---|
| **Netlify** | `npm run deploy:netlify` | Na 1ª vez escolha “Create & configure a new site” |
| **Cloudflare Pages** | `npm run deploy:cloudflare` | Cria o projeto `visitas-obra` (troque o nome no `package.json` se quiser) |
| **Vercel** | `npm run deploy:vercel` | Responda às perguntas; a pasta `public` já está configurada em `vercel.json` |
| **Firebase Hosting** (Google) | `npm run firebase:login`, depois `npm run firebase:projeto` (escolha/crie o projeto no console.firebase.google.com) e `npm run deploy:firebase` | Melhor escolha se no futuro quiser **sincronizar as visitas na nuvem** para o gestor |

Todos têm plano gratuito suficiente para este app e permitem usar domínio próprio (ex.: `visitas.suaempresa.com.br`).

### Opção C — Lojas de aplicativos (opcional)

Com o app já publicado em https, o site **pwabuilder.com** gera o pacote:
- **Google Play**: conta de desenvolvedor com taxa única de US$ 25.
- **App Store (iPhone)**: precisa de um Mac e conta Apple Developer (US$ 99/ano).

Para poucos colaboradores não compensa: instalar pela tela inicial dá o mesmo resultado.

### O que **não** funciona

- **OneDrive, Google Drive, Dropbox**: guardam arquivos, mas não servem o app como site.
- **Abrir o `index.html` direto no celular** ou usar o servidor local pelo Wi-Fi: sem https, GPS e modo offline ficam bloqueados.

---

## Instalar no celular do colaborador

1. Abra o link publicado no celular.
   - **Android (Chrome):** menu **⋮** → **Instalar app** (ou o botão “Instalar” que aparece no app).
   - **iPhone (Safari):** **Compartilhar** → **Adicionar à Tela de Início**.
2. Abra pelo ícone e **crie sua conta (e-mail e senha)**. Depois, em *Ajustes → Gerar código de recuperação*, o gestor pode gerar e guardar um código (opcional).
3. **Permita câmera e localização** quando o celular pedir.
4. Em **Ajustes**, confira o nome do colaborador e preencha o nome da empresa (aparecem nos relatórios e nas fotos).
5. Faça uma visita de teste: capturar GPS, tirar foto, enviar relatório.

## Atualizar o app depois de mudanças

1. Edite os arquivos em `public/` (ex.: `public/js/config.js`).
2. Em `public/sw.js`, aumente a versão do `CACHE` (ex.: `visitas-obra-v2` → `visitas-obra-v3`).
3. Publique de novo (arraste a pasta `public` ou rode o mesmo `npm run deploy:…`). O celular recebe a atualização ao abrir o app com internet.

## Checklist antes de colocar em produção

- [ ] Trocar `empresa: 'Minha Empresa'` em `public/js/config.js` (ou preencher em *Ajustes* no celular).
- [ ] Publicar em **https** e testar no **celular real**: câmera, GPS, relatório pelo WhatsApp, instalar na tela inicial e abrir sem internet.
- [ ] Com Node: rodar `npm install` e guardar o `package-lock.json`.
- [ ] Combinar a rotina de **backup semanal** com o colaborador.

## Login por e-mail e senha

- **Primeiro acesso:** o colaborador informa **e-mail e senha** (mínimo 6 caracteres; o app recusa senhas fáceis como 123456). Há um botão *Mostrar* para ver o que está digitando. O nome que vai nos relatórios começa igual ao e-mail (ex.: `joao.silva@…` vira “Joao Silva”) e pode ser mudado em *Ajustes*.
- **Continua conectado:** depois do primeiro login o app abre direto neste celular, sem pedir senha, até o colaborador tocar em *Ajustes → Sair*. Ao entrar de novo, o e-mail já vem preenchido e o cursor vai para a senha. O navegador e o celular também podem oferecer salvar e preencher a senha (gerenciador de senhas).
- **Sem tela de código:** nenhum código aparece no cadastro nem no login. O **código de recuperação é opcional** e só existe se a pessoa pedir.
- **Gerar o código (opcional):** *Ajustes → Acesso → Gerar código de recuperação*. Pede a senha atual e mostra um código como `K7QM-4XNB-92PD` **uma única vez** (botões *Copiar* / *Enviar*), para o gestor guardar. Gerar um novo invalida o anterior. Só o hash fica guardado no aparelho.
- **Esqueci a senha:** na tela de login, o link **“Esqueci a senha”** pede o código de recuperação e a senha nova, **sem perder as visitas**. O código usado deixa de valer (gere outro depois, se quiser). Se o celular **não tem** código, a tela explica que o único caminho é apagar os dados do app e restaurar um backup, e oferece o botão *Apagar os dados deste celular* (com dupla confirmação).
- **Tentativas erradas:** depois de 5 erros o app espera 30 s, e a espera dobra a cada novo erro (até 32 min), mesmo se a página for recarregada. A mensagem não diz se o erro foi no e-mail ou na senha.
- **Trocar e-mail ou senha:** *Ajustes → Acesso → E-mail / senha* (pede a senha atual; deixe a senha nova em branco para trocar só o e-mail).
- **Quem já usava PIN (versão anterior):** na primeira abertura depois da atualização o app pede o PIN atual uma única vez e o colaborador cria e-mail e senha. As visitas continuam, e o código de recuperação que a conta já tinha continua valendo (“Esqueci o PIN” usa esse código).
- **Sem a senha e sem o código:** a única saída é apagar os dados do app no celular e restaurar o último backup. O backup **não** leva a senha.

> Limites: o e-mail **não é verificado** (não há servidor): ele só identifica o colaborador neste celular, e a senha só vale neste aparelho. Ela fica guardada como hash, mas os dados das visitas não são criptografados, e alguém com conhecimento técnico e acesso ao aparelho ainda poderia lê-los. Como o app **continua conectado**, quem pegar o celular já com o app aberto entra direto; peça ao colaborador para tocar em *Sair* se for emprestar ou perder o aparelho. Para login de verdade, controlado pelo gestor (criar e bloquear colaboradores), o caminho é um backend (ex.: Firebase Authentication).

## Segurança já configurada

- **Content-Security-Policy** no `index.html` (vale em qualquer hospedagem): scripts só do próprio app; conexões só com ViaCEP e OpenStreetMap; mapa só do Google.
- **Cabeçalhos HTTP** (`public/_headers`, `vercel.json`, `firebase.json`, `serve.json`): `nosniff`, `Referrer-Policy`, `Permissions-Policy` (câmera e GPS só no próprio app) e bloqueio de exibição em iframe. O GitHub Pages não aceita cabeçalhos; lá vale só a CSP do HTML.
- Sem listagem de pastas e sem redirecionar `/index.html` no `serve`.

## Dados e segurança

- Os dados ficam **no celular** (não há servidor). Faça **backup semanal** em *Ajustes → Backup* e guarde no Drive.
- Se o celular for trocado: *Restaurar backup* no aparelho novo.

### Backup (ZIP)

- **Backup completo (ZIP com fotos)**: um arquivo `.zip` com `dados.json` e as fotos em `fotos/`. Dá para abrir o ZIP em qualquer computador e ver as fotos. Leve em memória, mesmo com milhares de fotos (900 fotos ≈ 160 MB, gerado em segundos).
- **Backup só das novidades**: leva apenas as visitas alteradas e as fotos novas desde o **último backup** (qualquer tipo). É bem menor. Para restaurar, restaure primeiro o completo e depois cada backup de novidades, na ordem. **Guarde todos os arquivos.** Visitas ou fotos *excluídas* depois do backup não são removidas ao restaurar.
- **Restaurar** aceita o ZIP novo e também os backups `.json` do formato antigo. Visitas com o mesmo código são substituídas; as demais são mantidas.
- O backup **não** leva a senha.

### Desempenho (medido)

Teste com dados simulados num computador (celular costuma ser 3 a 6 vezes mais lento):

| | 2000 visitas / 6000 fotos |
|---|---|
| Lista aparece | **47 ms** (antes 5 s) |
| Busca | ~250 ms (antes 2 s por tecla) |
| Retornos | 68 ms (antes 2,9 s) |
| Backup de 900 fotos | 161 MB, pico de memória 22 MB (antes 457 MB) |
| Restaurar 900 fotos | 1,5 s (antes 8,5 s) |

Fotos antigas, sem miniatura, ganham uma na primeira vez que aparecem na lista (cerca de 15 a 20 ms por foto, uma única vez).
- Próximo passo possível: sincronizar com a nuvem (ex.: Firebase) para o gestor ver as visitas em tempo real.
