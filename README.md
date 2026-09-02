# MusicGym Frontend

Frontend React (Vite) + Tailwind CSS para visualização de cifras e setlists.

---

## Pré-requisitos

- **Node.js 18+** instalado (recomendado: [Node.js LTS](https://nodejs.org))
- **npm** disponível no PATH
- **MySQL e Redis rodando via Docker** (veja [`musicgym-api/README.md`](../musicgym-api/README.md))

---

## Iniciando o projeto completo

> ⚠️ Execute cada bloco em um **terminal separado**. Não encadeie os comandos em uma única linha.

---

### Terminal 1 — Infraestrutura (MySQL + Redis)

Execute a partir da **raiz do monorepo** (`/musicgym`):

```bash
docker compose up -d mysql redis
```

---

### Terminal 2 — Backend (API FastAPI)

```bash
cd /Users/cauebeloni/Documents/musicgym/musicgym-api
pyenv local 3.11.9
python -m venv venv
python -m venv venv
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

API disponível em: **http://localhost:8000**

---

### Terminal 3 — Frontend (React + Vite)

```bash
cd /Users/cauebeloni/Documents/musicgym/musicgym-front
npm install
npm run dev
```

Frontend disponível em: **http://localhost:3000**

---

## Configuração de variável de ambiente

Crie um arquivo `.env` em `musicgym-front/` (opcional — já há valor padrão):

```env
VITE_API_URL=http://localhost:8000/api/v1
```

> Se a API estiver em outra porta ou servidor, ajuste `VITE_API_URL` aqui.

---

## Scripts disponíveis

| Comando            | Descrição                                      |
|--------------------|------------------------------------------------|
| `npm run dev`      | Inicia servidor de desenvolvimento (porta 3000)|
| `npm run build`    | Gera build de produção em `dist/`              |
| `npm run preview`  | Pré-visualiza o build de produção localmente   |

---

## Estrutura do projeto

```
musicgym-front/
├── src/
│   ├── components/
│   │   ├── AutoScrollControls.jsx  # Controle de rolagem automática na cifra
│   │   ├── SetlistCard.jsx         # Card de setlist na home
│   │   ├── SetlistEditor.jsx       # Editor drag & drop de setlist
│   │   └── YouTubePlayer.jsx       # Player do YouTube embutido
│   ├── pages/
│   │   ├── HomePage.jsx            # Página principal com grid de setlists
│   │   ├── ChordSheetPage.jsx      # Página de visualização de cifra
│   │   └── SetlistBuilderPage.jsx  # Página de edição de setlist
│   ├── services/
│   │   └── api.js                  # Chamadas para a API REST
│   ├── App.jsx                     # Roteamento principal
│   ├── main.jsx                    # Entry point React
│   └── index.css                   # Estilos globais + Tailwind
├── tailwind.config.js              # Configuração do Tailwind (tema verde)
├── vite.config.js                  # Configuração do Vite
└── package.json
```

---

## Tecnologias utilizadas

| Tecnologia         | Versão  | Uso                                |
|--------------------|---------|------------------------------------|
| React              | 18      | UI declarativa                     |
| Vite               | 5       | Build tool + dev server            |
| Tailwind CSS       | 3       | Estilização utilitária             |
| React Router DOM   | 6       | Roteamento SPA                     |
| Axios              | 1       | Requisições HTTP                   |
| @dnd-kit           | 6/8     | Drag & drop do editor de setlist   |
| react-player       | 2       | Player de YouTube embutido         |
