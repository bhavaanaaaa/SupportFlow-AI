
from contextlib import asynccontextmanager, contextmanager
import os
import time
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import errors
from pydantic import BaseModel, EmailStr, Field


DB_PATH = Path(__file__).with_name("supportflow.db")
ENV_PATH = Path(__file__).with_name(".env")

load_dotenv(ENV_PATH)


@contextmanager
def get_connection():
    connection = sqlite3.connect(DB_PATH, check_same_thread=False)
    connection.row_factory = sqlite3.Row

    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS tickets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'open',
                category TEXT NOT NULL DEFAULT 'General Inquiry'
            )
        """)
    yield


app = FastAPI(title="SupportFlow AI", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TicketCreate(BaseModel):
    title: str = Field(min_length=3, max_length=150)
    description: str = Field(min_length=5, max_length=3000)
    customer_email: EmailStr


class TicketResponse(TicketCreate):
    id: int
    priority: str
    status: str
    category: str


class TicketStatusUpdate(BaseModel):
    status: str


def ticket_dict(row):
    return dict(row)


@app.get("/")
def home():
    return {"message": "Welcome to SupportFlow AI!"}


@app.post(
    "/tickets",
    response_model=TicketResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_ticket(ticket: TicketCreate):
    category = "General Inquiry"
    text = f"{ticket.title} {ticket.description}".lower()

    if any(word in text for word in [
        "delivery", "delivered", "order", "shipping"
    ]):
        category = "Delivery"
    elif any(word in text for word in [
        "payment", "refund", "charged", "billing"
    ]):
        category = "Billing"
    elif any(word in text for word in [
        "login", "password", "error", "bug"
    ]):
        category = "Technical Support"

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO tickets
                (title, description, customer_email, category)
            VALUES (?, ?, ?, ?)
            """,
            (
                ticket.title,
                ticket.description,
                str(ticket.customer_email),
                category,
            ),
        )

        row = connection.execute(
            "SELECT * FROM tickets WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()

    return ticket_dict(row)


@app.get("/tickets", response_model=list[TicketResponse])
def get_all_tickets():
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM tickets ORDER BY id DESC"
        ).fetchall()

    return [ticket_dict(row) for row in rows]


@app.get("/tickets/{ticket_id}", response_model=TicketResponse)
def get_ticket(ticket_id: int):
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM tickets WHERE id = ?",
            (ticket_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found",
        )

    return ticket_dict(row)


@app.patch(
    "/tickets/{ticket_id}/status",
    response_model=TicketResponse,
)
def update_ticket_status(
    ticket_id: int,
    update: TicketStatusUpdate,
):
    allowed_statuses = {"open", "in progress", "resolved"}
    new_status = update.status.strip().lower()

    if new_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Status must be open, in progress, or resolved",
        )

    with get_connection() as connection:
        cursor = connection.execute(
            "UPDATE tickets SET status = ? WHERE id = ?",
            (new_status, ticket_id),
        )

        if cursor.rowcount == 0:
            raise HTTPException(
                status_code=404,
                detail="Ticket not found",
            )

        row = connection.execute(
            "SELECT * FROM tickets WHERE id = ?",
            (ticket_id,),
        ).fetchone()

    return ticket_dict(row)


@app.post("/tickets/{ticket_id}/suggest-reply")
def suggest_reply(ticket_id: int):
    with get_connection() as connection:
        row = connection.execute(
            "SELECT * FROM tickets WHERE id = ?",
            (ticket_id,),
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Ticket not found",
        )

    ticket = ticket_dict(row)

    # Read the key from backend/.env or the environment.
    load_dotenv(ENV_PATH, override=False)
    api_key = (
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
    )

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Gemini API key is not configured in backend/.env",
        )

    prompt = f"""
You are a helpful customer support assistant.
Draft a polite, concise reply to the customer's issue.
Use the customer's message as context.
Do not invent facts, claim actions are completed,
promise refunds, or guarantee outcomes.
Return only the suggested reply.

Ticket title: {ticket['title']}
Description: {ticket['description']}
Category: {ticket['category']}
Priority: {ticket['priority']}
Status: {ticket['status']}
"""

    try:
        client = genai.Client( api_key=api_key,
    http_options={"timeout": 15000},)
        response = None

        # Retry temporary server errors up to three attempts.
        for attempt in range(3):
            try:
                response = client.models.generate_content(
                    model="gemini-3.8-flash",
                    contents=prompt,
                )
                break

            except errors.ServerError as exc:
                if exc.code not in (500, 502, 503, 504):
                    raise

                if attempt == 2:
                    raise

                time.sleep(2 ** attempt)

        reply = (response.text or "").strip() if response else ""

        if not reply:
            raise ValueError("Gemini returned an empty reply")

        return {
            "ticket_id": ticket["id"],
            "suggested_reply": reply,
            "generated_by": "Gemini",
        }

   
    except Exception as exc:
        print(
            f"Gemini reply generation failed: "
            f"{type(exc).__name__}: {exc}"
        )

        # Keep the feature usable if Gemini is unavailable.
        fallback_reply = (
            f"Hi,\n\n"
            f"Thank you for contacting us about "
            f"'{ticket['title']}'. "
            f"I'm sorry for the inconvenience.\n\n"
            f"We've received your message regarding "
            f"{ticket['category'].lower()}. "
            f"Our support team will review the details "
            f"and follow up with the appropriate next steps.\n\n"
            f"Thank you for your patience."
        )

        return {
            "ticket_id": ticket["id"],
            "suggested_reply": fallback_reply,
            "generated_by": "Fallback template",
        }
