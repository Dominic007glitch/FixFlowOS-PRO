# FixFlowOS Pro

Sistema SaaS multi-loja para gerenciar ordens de serviço (OS) de assistências técnicas de celulares e tablets.

- Front-end: React (Vite) + Tailwind CSS + Lucide React + React Router DOM
- Back-end: **somente Firebase** (Authentication + Firestore). Não existe banco local.

---

## 1. O que você precisa ter instalado

1. **Node.js 18 ou mais novo** (baixe em https://nodejs.org, versão LTS).
2. **VS Code** (ou outro editor).
3. Uma **conta Google** para usar o Firebase.

Para conferir o Node, abra o terminal e digite `node -v`. Deve aparecer algo como `v20.x.x`.

---

## 2. Criar o projeto no Firebase

1. Acesse https://console.firebase.google.com e clique em **Adicionar projeto**.
2. Dê um nome (ex.: `fixflowos-pro`). O Google Analytics pode ficar desativado. Clique em **Criar projeto**.

### 2.1 Ativar o Authentication

1. No menu da esquerda, clique em **Criação > Authentication**.
2. Clique em **Vamos começar**.
3. Na aba **Sign-in method**, clique em **E-mail/senha**.
4. Ative a primeira chave (**E-mail/senha**) e clique em **Salvar**. (Não precisa ativar "Link por e-mail".)

### 2.2 Criar o banco Firestore

1. No menu, clique em **Criação > Firestore Database**.
2. Clique em **Criar banco de dados**.
3. Local: escolha **southamerica-east1 (São Paulo)**. Essa escolha não pode ser alterada depois.
4. Modo: escolha **Iniciar no modo de produção** e clique em **Criar**.

### 2.3 Registrar o app web e pegar o firebaseConfig

1. Na página inicial do projeto, clique no ícone **`</>` (Web)**.
2. Dê um apelido (ex.: `fixflowos-web`). **Não** precisa marcar o Firebase Hosting. Clique em **Registrar app**.
3. Vai aparecer um bloco de código com `const firebaseConfig = { ... }`. Deixe essa tela aberta, você vai usar no próximo passo.

---

## 3. Onde colar o firebaseConfig

Abra o arquivo **`src/firebase/config.js`** e substitua os valores de exemplo pelos do seu projeto:

```js
const firebaseConfig = {
  apiKey: 'COLE_SUA_API_KEY',
  authDomain: 'SEU_PROJETO.firebaseapp.com',
  projectId: 'SEU_PROJETO',
  storageBucket: 'SEU_PROJETO.appspot.com',
  messagingSenderId: 'SEU_SENDER_ID',
  appId: 'SEU_APP_ID',
};
```

Troque cada texto entre aspas pelo valor correspondente que o Firebase mostrou. Salve o arquivo.

---

## 4. Regras de segurança (Firestore Rules)

Estas regras impedem que a loja A leia ou escreva dados da loja B, e aplicam as permissões por cargo.

1. No Firebase Console, abra **Firestore Database > aba Regras**.
2. Apague todo o conteúdo que estiver lá.
3. Abra o arquivo **`firestore.rules`** deste projeto, copie **tudo** e cole no console.
4. Clique em **Publicar**.

Como as regras isolam as lojas: todos os dados de uma loja ficam em `lojas/{lojaId}/...`. Toda leitura ou escrita ali só é permitida se o documento `usuarios/{seu-uid}` tiver o mesmo `lojaId`, estiver ativo e tiver o cargo exigido para aquela coleção.

---

## 5. Criar o primeiro Super Admin e a Loja 1 (manualmente)

Você só precisa fazer isso uma vez. Depois, novas lojas são criadas pelo painel Super Admin dentro do sistema.

### 5.1 Criar o Super Admin (você)

1. Vá em **Authentication > aba Usuários > Adicionar usuário**.
2. Informe o seu e-mail e uma senha forte. Clique em **Adicionar usuário**.
3. Na lista, **copie o "UID do usuário"** (um código longo) do usuário que você criou.
4. Vá em **Firestore Database > aba Dados > Iniciar coleção**.
5. ID da coleção: `superadmins`.
6. **ID do documento: cole o UID** que você copiou (não use ID automático).
7. Adicione os campos (tipo string):
   - `nome` = `Seu Nome`
   - `email` = `seu e-mail`
8. Clique em **Salvar**.

### 5.2 Criar a Loja 1 (loja de teste)

**Opção fácil:** pule esta etapa. Entre no sistema como Super Admin (passo 6) e clique em **Nova loja**. O painel cria a loja, a conta do dono e o contador de OS automaticamente.

**Opção manual:**

1. Em **Authentication > Adicionar usuário**, crie o dono: `karlaopba@gmail.com` e uma senha. Copie o **UID** dele.
2. No Firestore, crie a coleção `lojas`, com **ID do documento** `loja1` e os campos:
   - `nome` (string) = `Loja 1`
   - `plano` (**number**) = `1`
   - `ativo` (**boolean**) = `true`
   - `donoUid` (string) = UID do dono
   - `donoNome` (string) = `Karla`
   - `donoEmail` (string) = `karlaopba@gmail.com`
3. Dentro do documento `loja1`, clique em **Iniciar coleção**, ID `configuracoes`, **ID do documento** `geral`, com o campo:
   - `contadorOS` (**number**) = `0`

   Atenção: precisa ser do tipo **number**, não string. É dele que sai a numeração 1, 2, 3...
4. Crie a coleção `usuarios`, com **ID do documento = UID do dono** e os campos:
   - `nome` (string) = `Karla`
   - `email` (string) = `karlaopba@gmail.com`
   - `cargo` (string) = `dono`
   - `lojaId` (string) = `loja1`
   - `ativo` (**boolean**) = `true`

---

## 6. Rodar o projeto

No terminal, dentro da pasta do projeto:

```bash
npm install
npm run dev
```

O navegador abre em http://localhost:5173. Entre com o e-mail e a senha do Super Admin (vai para `/superadmin`) ou com o do dono (vai para o sistema da loja).

Para gerar a versão de produção: `npm run build` (os arquivos saem na pasta `dist`).

---

## 7. Como o sistema funciona

| Cargo | Acessos |
|---|---|
| **Super Admin** | Painel de lojas: cria lojas, define plano, ativa/desativa loja, envia e-mail de redefinição de senha do dono |
| **Dono** | Tudo da loja: OS, Vendas, Caixa, Estoque (vê custo), Financeiro, Equipe/RH |
| **Vendedor** | Cria e edita OS, Vendas/PDV, Caixa. Vê o Estoque sem custo. Sem Financeiro e sem Equipe |
| **Técnico** | Somente edita OS. Sem Estoque, Financeiro e Equipe |

**Planos (limite de usuários ativos por loja):** Plano 1 (R$ 499, até 7), Plano 2 (R$ 599, até 10), Plano 3 (R$ 750, ilimitado).

**Estrutura no Firestore:**

```
superadmins/{uid}
usuarios/{uid}                             nome, email, cargo, lojaId, ativo
lojas/{lojaId}                             nome, plano, ativo, donoUid, donoNome, donoEmail
lojas/{lojaId}/configuracoes/geral         contadorOS
lojas/{lojaId}/ordens/{id}
lojas/{lojaId}/estoque/{id}
lojas/{lojaId}/vendas/{id}
lojas/{lojaId}/caixaSessoes/{id}
lojas/{lojaId}/caixaMovimentos/{id}
lojas/{lojaId}/equipe/{id}                 salários, adiantamentos e vales
```

---

## 8. Observações importantes

- **Senha do dono:** o app não tem tela para o dono trocar a própria senha. Quem dispara a redefinição é o Super Admin, pelo botão de e-mail na lista de lojas (o Firebase envia um link para o e-mail do dono). Para definir uma senha diretamente, sem e-mail, seria preciso o Firebase Admin SDK (Cloud Functions), que não faz parte deste projeto.
- **Limite de usuários do plano:** é verificado na tela de Equipe. As regras do Firestore isolam as lojas e os cargos, mas não contam usuários. Para bloquear o limite também no servidor, seria necessária uma Cloud Function.
- **Custo no estoque:** a tela esconde o custo de quem não é dono, mas as regras do Firestore não filtram campos individuais. Um vendedor tecnicamente avançado poderia ler o custo pelo navegador.
- **Técnico e estoque:** como o técnico não acessa o estoque, ele informa as peças manualmente na OS. A baixa automática vale para peças vinculadas por dono ou vendedor.
- **Funcionários desativados:** o app desativa (`ativo = false`) em vez de apagar, porque o navegador não consegue excluir contas do Authentication.
- **Impressão:** "Via do Cliente" (A4) e "Etiqueta" abrem uma nova janela. Se nada acontecer, libere os pop-ups do navegador para o site.
- **Login com domínio próprio:** ao publicar em outro domínio, adicione-o em **Authentication > Configurações > Domínios autorizados**.

## 9. Problemas comuns

| Mensagem | O que fazer |
|---|---|
| "Missing or insufficient permissions" | Confirme que publicou o `firestore.rules` e que os documentos de `usuarios` e `lojas` têm os campos certos (`ativo` deve ser boolean) |
| "Seu usuário não está cadastrado em nenhuma loja" | Falta o documento `usuarios/{UID}` com o UID exato do Authentication |
| "E-mail ou senha incorretos" | Confira se o usuário foi criado em Authentication e se o login por E-mail/senha está ativado |
| A numeração da OS não anda | Confira se `contadorOS` é do tipo **number** em `lojas/{id}/configuracoes/geral` |
| Tela branca ao rodar | Confira se colou o `firebaseConfig` e se rodou `npm install` |
