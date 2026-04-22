# Railway Ollama Service Setup

This sets up a dedicated Ollama service on Railway so your dashboard can use a stable public Base URL.

## 1) Create the service in Railway

1. Open your Railway project.
2. Create a new service from your GitHub repo.
3. In service settings, set config-as-code path to `ollama-railway/railway.json`.

## 2) Required variables

Set these in the Ollama Railway service:

- `OLLAMA_MODEL=llama3.1:8b`
- `OLLAMA_SKIP_PULL=false`

Optional:

- `PORT=11434` (Railway usually injects this automatically)

## 3) Deploy and collect URL

1. Deploy the service.
2. Enable Railway public networking for the service.
3. Copy the generated domain, for example:
   - `https://your-ollama-service.up.railway.app`

## 4) Verify Ollama API

From terminal:

```bash
curl https://your-ollama-service.up.railway.app/api/tags
```

If it returns JSON, your Base URL is ready.

## 5) Use in Dissident settings

In `/app/settings` Personal AI provider:

1. Provider: `Ollama`
2. Base URL: `https://your-ollama-service.up.railway.app`
3. API key: any non-empty value (current validator requires one)
4. Model: `llama3.1:8b` (or your deployed model)

Then click **Validate** and **Save**.
