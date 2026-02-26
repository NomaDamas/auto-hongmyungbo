# 🤖 Auto-HongMyungbo (Open Source Local Edition) ⚽

> Write your idea once — Auto-HongMyungbo turns it into ready-to-post content for every SNS platform and publishes them for you.

---

## 📺 Demo Video

[Open demo video link](https://github.com/user-attachments/assets/d2640150-7402-49c0-96d1-b198d7d02130)

---

## 📋 Table of Contents

- [🚀 What Does This Do?](#what)
- [🛠️ Setup (First-Time Users)](#setup)
- [▶️ Running the App](#run)
- [📖 End-to-End Usage](#usage)
- [✨ Core Features at a Glance](#features)
- [🔐 How Login and Publishing Work](#login)
- [🧯 Common Errors and Fixes](#errors)
- [🧱 Project Structure](#structure)

---

<a name="what"></a>

## 🚀 What Does This Do?

**Auto-HongMyungbo** automates SNS content creation and publishing — all running locally on your computer.

| Step | What Happens |
| ---- | ------------ |
| ✍️ Write a draft | Paste your raw idea once |
| 🤖 AI generates posts | Creates platform-specific versions automatically |
| 👀 Preview & edit | Review and tweak each result |
| 📤 Auto-publish | Browser automation posts them in sequence |

All data is stored **locally on your machine** — nothing is sent to external servers.

---

<a name="setup"></a>

## 🛠️ Setup (First-Time Users)

### Requirements Checklist ✅

- [ ] macOS / Linux / Windows (WSL recommended)
- [ ] Git installed
- [ ] Node.js 20+ installed
- [ ] A terminal you can type in
- [ ] At least one AI API key:
  - 🌟 **OpenAI or OpenRouter** (recommended for beginners)
  - Anthropic / Grok / Gemini (optional)

> 💡 Not sure how to get API keys? See [`docs/API_KEYS.md`](docs/API_KEYS.md).

---

### Step 1 — Clone & Install

Open your terminal and run these commands one by one:

```bash
git clone https://github.com/NomaDamas/auto-hongmyungbo.git
cd auto-hongmyungbo
./scripts/setup_local_easy.sh
```

> ⏳ The first run downloads Playwright (browser automation). This may take a few minutes.

---

### Step 2 — Create Your Environment File

Create a file called `frontend/.env` (or `frontend/.env.local`) and fill in your API keys:

```env
# ✅ At least one of these is required
OPENROUTER_API_KEY=your_key_here
# or
OPENAI_API_KEY=your_key_here

# 🔽 Optional
ANTHROPIC_API_KEY=your_key_here
GROK_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

If you want Instagram auto-upload support, also add:

```env
INSTAGRAM_MEDIA_PATH=docs/images/sample.jpg
```

---

<a name="run"></a>

## ▶️ Running the App

```bash
./scripts/start_local.sh
```

Then open your browser and go to:

🌐 **http://localhost:3000**

To stop the server: press `Ctrl + C` in the terminal.

---

<a name="usage"></a>

## 📖 End-to-End Usage

### 1️⃣ Write Your Draft

Paste your rough idea into the `Draft` box on the left.

### 2️⃣ Configure Options

In the `Options` panel, set:

- **Provider** — OpenAI, OpenRouter, etc.
- **Model** — which AI model to use
- **API Keys** — your credentials
- Thinking / Temperature / Token settings

### 3️⃣ Boost Your Draft (Optional)

| Feature | What It Does |
| ------- | ------------ |
| `Draft Idea Booster` | Structures and strengthens your idea |
| `Aggro Pingpong` | Explores more powerful hooks |
| `Phrase Booster` | Refines a specific sentence you select |

> 💡 **Phrase Booster tip:** Highlight any text in the Draft box — a `Phrase Booster` button will appear. Click it to open a chat-style panel for targeted rewrites.

### 4️⃣ Generate for Each Platform

Click **`Generate N Platforms`** — the AI rewrites your draft for every SNS.

> Hover the button while it's running to reveal a `Cancel` option.

### 5️⃣ Review Results

In `Platform Results`:

- 👁️ Read in **Preview** mode
- ✏️ Make changes in **Edit** mode
- ✅ **Accept** → moves the card to your Queue
- ❌ **Reject** → discards it

### 6️⃣ Log In to Each Platform

Click **`Browser Login`** for each platform once.

> Even when a platform shows `Connected`, the app runs a quick login check before every publish.

### 7️⃣ Publish

| Button | What It Does |
| ------ | ------------ |
| `Post Next Platform` | Walks you through publishing one at a time |
| `Post All (Beta)` | Publishes all queued platforms in sequence |
| `Publish now` (on a card) | Publishes just that one platform immediately |

If publishing fails, you can retry from that platform or finish manually.

---

<a name="features"></a>

## ✨ Core Features at a Glance

### 👁️ Preview vs Edit

| Mode | Purpose |
| ---- | ------- |
| **Preview** | Clean reading view |
| **Edit** | Direct content editing |

### 🔀 Compare Mode

- **OFF** (default) — focused single-platform view
- **ON** — side-by-side comparison across platforms

### 💾 Saved Drafts

- Restore from auto-saved draft history
- Deleting a draft also removes it from local history

### 🌙 Dark / Light Theme

- Toggle with the sun/moon button in the bottom-right corner
- Your preference is saved in browser storage

---

<a name="login"></a>

## 🔐 How Login and Publishing Work

- Login state is determined from your **real browser session** — no stored passwords.
- A preflight login check runs automatically before every publish.
- Manual-heavy platforms (e.g., Reddit) detect leave/close events to avoid getting stuck.
- ✅ Successful publish → card removed from Queue
- ❌ Failed publish → card stays in Queue for retry

---

<a name="errors"></a>

## 🧯 Common Errors and Fixes

### ❗ 1) `OpenAI/OpenRouter not configured`

- Double-check `frontend/.env` has a valid API key
- Restart: `./scripts/start_local.sh`

### ❗ 2) `Playwright not installed`

Run the setup script again:

```bash
./scripts/setup_local_easy.sh
```

### ❗ 3) `LLM request failed: unsupported parameter/value`

- Some newer models restrict sampling parameters
- The app retries automatically with fallback settings
- If it keeps failing, switch to a different model in Options

### ❗ 4) Platform shows `Connected` but publish fails

1. Click **`Disconnect`** for that platform
2. Run **`Browser Login`** again

> Platform UI changes can sometimes break automation. Manual completion is always an option.

### ❗ 5) Queue doesn't clear after publishing

- Check the publish log/status panel
- Refresh the page once

---

<a name="structure"></a>

## 🧱 Project Structure

```text
auto-hongmyungbo/
├── 📁 frontend/
│   ├── src/app/api/      # Next.js API routes (server communication)
│   ├── src/components/   # UI components
│   ├── src/lib/          # Client-side utilities & types
│   └── src/server/       # AI (LLM) + local store + automation logic
├── 📁 scripts/           # Setup and run scripts
└── 📁 docs/              # Documentation & images
```

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

If you use or modify this project and provide it as a network service, you must also make the corresponding source code available under AGPL-3.0.

See the full license text in [`LICENSE`](LICENSE).

---

Made with ❤️ by the Auto-HongMyungbo team
