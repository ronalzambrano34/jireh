from fastapi import FastAPI

from routes.webhook import router

app = FastAPI()

app.include_router(router)


@app.get("/")
def home():

    return {
        "message":
        "CubaLink API"
    }