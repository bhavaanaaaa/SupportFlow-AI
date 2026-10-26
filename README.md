# SupportFlow AI

An AI-assisted customer support ticket management dashboard built with React, TypeScript, FastAPI, and SQLite.

## Features

- Create and manage customer support tickets
- Automatically categorize tickets using keyword-based rules
- Update ticket statuses and filter by category
- Generate editable customer-support reply drafts using Gemini
- Provide fallback reply templates when the AI service is unavailable
- Copy suggested replies for support agents

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI
- **Database:** SQLite
- **AI:** Google Gemini API

## Project Structure

```text
SupportFlow-AI/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   └── package.json
├── screenshots/
├── .gitignore
└── README.md
```

## Run Locally

### Backend

```bash
cd backend
python -m venv .venv
```

On Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create a local `backend/.env` file containing:

```text
GEMINI_API_KEY=your_api_key_here
```

Replace the placeholder with your own key. Never commit the real key.

Start the API:

```bash
python -m uvicorn main:app --reload --port 8001
```

API documentation: http://127.0.0.1:8001/docs

### Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite, usually http://localhost:5173.

## How It Works

1. The frontend retrieves tickets from the FastAPI backend.
2. The backend stores and updates ticket data in SQLite.
3. Ticket categories are assigned using keyword-based rules.
4. The reply endpoint attempts to generate a customer-support draft with Gemini.
5. If the AI service is unavailable, a fallback template can be returned.
6. Support agents can review, edit, and copy the draft.

## Security

- Keep API keys in the local backend `.env` file.
- Never commit `.env` files, real API keys, or local databases.
- Review suggested replies before sending them to customers.

## Future Improvements

- Add authentication and role-based access control
- Add automated tests
- Improve ticket classification
- Deploy the application to a cloud platform
