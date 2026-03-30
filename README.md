<img width="1230" height="444" alt="홍명보명" src="https://github.com/user-attachments/assets/cda16148-8607-4b72-9a3e-f556e2c16f4d" />

# 🤖 Auto-HongMyungbo (Open Source Local Edition) ⚽

> One draft in, platform-ready posts out.
> Refine, compare, and publish across multiple SNS platforms from one local workspace.

![Auto-HongMyungbo Preview](docs/images/ddalcak_myungbo.png)

[![GitHub stars](https://img.shields.io/github/stars/NomaDamas/auto-hongmyungbo?style=flat-square)](https://github.com/NomaDamas/auto-hongmyungbo/stargazers)
[![GitHub issues](https://img.shields.io/github/issues/NomaDamas/auto-hongmyungbo?style=flat-square)](https://github.com/NomaDamas/auto-hongmyungbo/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/NomaDamas/auto-hongmyungbo?style=flat-square)](https://github.com/NomaDamas/auto-hongmyungbo/pulls)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)

## 📺 Demo

[Watch the demo video](https://github.com/user-attachments/assets/d2640150-7402-49c0-96d1-b198d7d02130)

## ⚡ Quick Install

```bash
git clone https://github.com/NomaDamas/auto-hongmyungbo.git
cd auto-hongmyungbo
./scripts/setup_local_easy.sh
./scripts/start_local.sh
```

Open: `http://localhost:3000`

## 🔗 Quick Links

- [What is this?](#-what-is-this)
- [Why this over alternatives?](#-why-this-over-alternatives)
- [Setup (first-time users)](#-setup-first-time-users)
- [Basic commands](#-basic-commands)
- [How to use](#-how-to-use)
- [Docs and support](#-docs-and-support)
- [Contributing](#-contributing)
- [Growth playbook](#-growth-playbook-for-maintainers)

## 🎯 What Is This?

Auto-HongMyungbo is a local-first OSS tool for creators and indie builders who want to:

- write one messy idea once
- turn it into platform-specific drafts (Reddit, LinkedIn, X, Threads, etc.)
- refine tone and structure quickly
- publish in sequence with browser automation

### Core flow

1. Write a draft
2. Generate platform posts
3. Preview/Edit/Compare
4. Accept to queue
5. Publish one-by-one or batch

## 🥊 Why This Over Alternatives?

| Capability | Manual copy/paste workflow | Single-platform AI writer | Auto-HongMyungbo |
| --- | --- | --- | --- |
| One draft to many platforms | ❌ | ❌ | ✅ |
| Platform-specific output in one UI | ❌ | ⚠️ Partial | ✅ |
| Side-by-side review before posting | ❌ | ❌ | ✅ |
| Queue-based multi-platform publish flow | ❌ | ❌ | ✅ |
| Local-first (no external DB required) | ✅ | ⚠️ Varies | ✅ |
| Open-source and customizable | ⚠️ Varies | ❌ | ✅ |

If your pain is "I rewrite the same post 5 times," this project is built for that exact problem.

## 🛠️ Setup (First-Time Users)

### Requirements

- macOS / Linux / Windows (WSL recommended)
- Git
- Node.js 20+
- At least one LLM API key
  - OpenAI or OpenRouter recommended
  - Anthropic / Grok / Gemini optional

API key guide: [`docs/API_KEYS.md`](docs/API_KEYS.md)

### Environment file

Create `frontend/.env` (or `frontend/.env.local`):

```env
# At least one is required
OPENROUTER_API_KEY=your_key_here
# or
OPENAI_API_KEY=your_key_here

# Optional providers
ANTHROPIC_API_KEY=your_key_here
GROK_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here

# Optional: for Instagram media upload flow
INSTAGRAM_MEDIA_PATH=docs/images/sample.jpg
```

## ⌨️ Basic Commands

```bash
# one-time local setup
./scripts/setup_local_easy.sh

# start app
./scripts/start_local.sh

# frontend only
cd frontend
npm run dev

# production build check
npm run build
```

## 📖 How To Use

1. **Draft**: paste your raw idea.
2. **Options**: set provider/model/API key.
3. **Refine (optional)**:
   - Draft Idea Booster
   - Aggro Pingpong
   - Phrase Booster
4. **Generate**: click `Generate N Platforms`.
5. **Review**: Preview/Edit each platform card.
6. **Queue**: Accept cards you want to publish.
7. **Login**: run `Browser Login` per platform once.
8. **Publish**:
   - `Post Next Platform`
   - `Post All (Beta)`
   - `Publish now` on each queue card

## 🧭 Docs and Support

- API keys: [`docs/API_KEYS.md`](docs/API_KEYS.md)
- Publish env checklist: [`docs/PUBLISH_ENV_CHECKLIST.md`](docs/PUBLISH_ENV_CHECKLIST.md)
- Monorepo/GitHub notes: [`docs/MONOREPO_GITHUB.md`](docs/MONOREPO_GITHUB.md)
- Report bugs / request features: [GitHub Issues](https://github.com/NomaDamas/auto-hongmyungbo/issues)
- Ongoing changes: [Pull Requests](https://github.com/NomaDamas/auto-hongmyungbo/pulls)

## 🤝 Contributing

Contributions are welcome.

- Start with a small issue or bug fix.
- Open a branch from `main`.
- Submit a PR with clear before/after behavior.
- Keep changes focused and easy to review.

If you are new, documentation and UX fixes are great first PRs.

## 📈 Growth Playbook (For Maintainers)

To drive network effects (more users -> more feedback -> better product -> more users):

1. **Build around real pain**
   - target "rewrite once, post everywhere" pain
   - prioritize workflows users repeat weekly
2. **Ship and measure in public**
   - share every meaningful release with examples/GIF/video
   - track where users drop off (setup, login, publish)
3. **Distribute where users already gather**
   - relevant Subreddits
   - Hacker News / GeekNews
   - Awesome lists in this domain
4. **Tight feedback loop**
   - convert repeated issue patterns into quick UX wins
   - keep README/install flow brutally simple

## 🧱 Project Structure

```text
auto-hongmyungbo/
├── frontend/
│   ├── src/app/api/      # Next.js API routes
│   ├── src/components/   # UI components
│   ├── src/lib/          # client helpers/types
│   └── src/server/       # LLM + local store + automation
├── scripts/              # setup/run scripts
├── docs/                 # docs + images
└── LICENSE
```

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

If you use or modify this project and provide it as a network service, you must also make the corresponding source code available under AGPL-3.0.

See the full license text in [`LICENSE`](LICENSE).

---
## 📬 Contact
- For questions, errors, or support, feel free to reach out:
- Email: developerminsing@gmail.com
