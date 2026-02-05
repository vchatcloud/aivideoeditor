# Setup Instructions

Because `.env` files are ignored by git, I could not create `.env.local` automatically.

Please create a file named `.env.local` in this directory (`c:\Users\veto\Downloads\kt-auto-mov`) and add the following content:

```
GEMINI_API_KEY=your_actual_api_key_here
```

Replace `your_actual_api_key_here` with your Google Gemini API Key.
Then run `npm run dev` again to load the new environment variables.
