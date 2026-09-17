# Copyforge Pro — Vercel Ready

This version keeps the existing Copyforge UI and features, but routes all AI content generation through `/api/ai`.

## Important

- No Puter.js.
- No browser API key.
- Visitors/clients do not enter their own API key.
- No fixed/demo AI fallback when the AI request fails.
- No `temperature` parameter is sent to the OpenAI Responses API.
- The owner key is stored only as a Vercel Environment Variable.

## Deploy

1. Upload this folder to GitHub.
2. Import the repository into Vercel.
3. In **Vercel → Project → Settings → Environment Variables**, add:

   `OPENAI_API_KEY` = your OpenAI API key

   Optional:

   `OPENAI_MODEL` = `gpt-5.6-luna`

4. Redeploy after saving the variable.
5. Open the site and use **Creator AI → Settings → Test Owner AI**.

The browser calls `/api/ai`; the server function calls OpenAI. The API key never goes into `index.html`.
