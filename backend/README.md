# LeadPilot Backend

## Setup

1. Create and activate a virtual environment:
   ```
   python -m venv venv
   .\venv\Scripts\activate  # Windows
   source venv/bin/activate  # Mac/Linux
   ```
2. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

## Database Setup (PostgreSQL)

1. Install PostgreSQL and create a database:
   ```sql
   CREATE DATABASE leadpilot;
   CREATE USER leadpilot_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE leadpilot TO leadpilot_user;
   ```

2. Update your `.env` file with PostgreSQL connection details:
   ```
   DATABASE_URL=postgresql+asyncpg://leadpilot_user:your_password@localhost:5432/leadpilot
   ```

## Database Migrations

1. Initialize Alembic (first time only):
   ```
   alembic init alembic
   ```
2. Generate migration:
   ```
   alembic revision --autogenerate -m "init"
   ```
3. Apply migration:
   ```
   alembic upgrade head
   ```

## Run the API

```
uvicorn main:app --reload
```

## Environment Variables
- `SECRET_KEY` (for JWT)
- `OPENAI_API_KEY` (for GPT-4o-mini)
- `DATABASE_URL` (PostgreSQL connection string)
