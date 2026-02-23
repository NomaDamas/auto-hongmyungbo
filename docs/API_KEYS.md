# API Key Guide (Beginner Friendly)

This project needs an LLM API key to generate posts.

Recommended default: **OpenRouter**  
Optional alternative: **OpenAI**

## 1) OpenRouter (Recommended)

Why recommended:
- One key for multiple models/providers
- Easy to switch models in the app

Steps:
1. Create an account at `https://openrouter.ai/`
2. Add credits/billing
3. Go to Keys and create an API key
4. Open `backend/.env`
5. Set:

```env
OPENROUTER_API_KEY=your_openrouter_key_here
```

6. (Optional) leave `OPENAI_API_KEY` empty

## 2) OpenAI (Optional)

Use this if you prefer direct OpenAI usage.

Steps:
1. Create an account at `https://platform.openai.com/`
2. Add billing/credits
3. Create an API key
4. Open `backend/.env`
5. Set:

```env
OPENAI_API_KEY=your_openai_key_here
```

## Important Notes

- You need at least one of:
  - `OPENROUTER_API_KEY`
  - `OPENAI_API_KEY`
- Voice refine (STT) requires `OPENAI_API_KEY`.
- Never commit real API keys to Git.

## Quick Check

After setting keys:

```bash
./scripts/start_local.sh
```

If key setup is wrong, the script will stop and show what is missing.

