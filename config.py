from dotenv import load_dotenv
import os

load_dotenv()

TOKEN = os.getenv("TOKEN")
PHONE_ID = os.getenv("PHONE_ID")
DATABASE_URL = os.getenv("DATABASE_URL")