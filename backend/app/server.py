"""
Vercel FastAPI discovery looks for `app` under supported filenames such as
app/server.py (see Vercel docs). Our implementation lives in main.py.
"""
from app.main import app

__all__ = ["app"]
