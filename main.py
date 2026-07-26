import sys
import os
import json
import asyncio
import threading
import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from PyQt6.QtCore import QUrl
from PyQt6.QtWidgets import QApplication, QMainWindow
from PyQt6.QtWebEngineWidgets import QWebEngineView
from dotenv import load_dotenv

from system_prompt import get_system_prompt, CLAUDE_PERYL_SYSTEM_PROMPT
from agent_engine import AgentEngine

# Load environment variables securely from .env
load_dotenv()

HACKCLUB_URL = os.getenv("HACKCLUB_URL", "https://ai.hackclub.com/proxy/v1/chat/completions")
HACKCLUB_KEY = os.getenv("HACKCLUB_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

api = FastAPI(title="Claude Peryl Desktop Engine")

agent_engine = AgentEngine(api_key=HACKCLUB_KEY, endpoint=HACKCLUB_URL, tavily_key=TAVILY_API_KEY)
active_system_prompt = CLAUDE_PERYL_SYSTEM_PROMPT

# Mount static files directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(STATIC_DIR, exist_ok=True)
api.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@api.get("/")
async def get_index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@api.get("/v1/models")
async def list_models():
    return {
        "data": [
            {"id": "claude-peryl", "display_name": "Claude Peryl 5", "created_at": "2026-06-09T00:00:00Z"},
            {"id": "claude-peryl-opus", "display_name": "Claude Peryl Opus 4.8", "created_at": "2026-06-09T00:00:00Z"},
            {"id": "claude-peryl-sonnet", "display_name": "Claude Peryl Sonnet 4.6", "created_at": "2026-06-09T00:00:00Z"},
            {"id": "claude-peryl-deep-research", "display_name": "Claude Peryl Deep Research Agent", "created_at": "2026-06-09T00:00:00Z"}
        ],
        "has_more": False
    }

@api.get("/api/system_prompt")
async def fetch_system_prompt():
    return {"system_prompt": active_system_prompt}

@api.post("/api/system_prompt")
async def update_system_prompt(request: Request):
    global active_system_prompt
    data = await request.json()
    if "system_prompt" in data:
        active_system_prompt = data["system_prompt"]
    return {"status": "ok", "system_prompt": active_system_prompt}

def convert_anthropic_to_openai(body: dict) -> dict:
    messages = []
    system_text = active_system_prompt
    if "system" in body:
        user_sys = body["system"]
        if isinstance(user_sys, list):
            user_sys = "\n".join([b.get("text", "") for b in user_sys if b.get("type") == "text"])
        if user_sys:
            system_text = system_text + "\n\nUser Custom Context:\n" + user_sys

    messages.append({"role": "system", "content": system_text})

    for msg in body.get("messages", []):
        role = msg.get("role")
        content = msg.get("content")
        if isinstance(content, list):
            text_blocks = [block.get("text", "") for block in content if block.get("type") == "text"]
            content = "\n".join(text_blocks)
        messages.append({"role": role, "content": content or ""})

    return {
        "model": "anthropic/claude-opus-5",
        "messages": messages,
        "stream": body.get("stream", False),
        "temperature": body.get("temperature", 0.7),
        "max_tokens": body.get("max_tokens", 4096),
    }

async def stream_openai_to_anthropic(openai_payload: dict, headers: dict):
    model = "claude-peryl"
    msg_id = "msg_peryl_" + os.urandom(8).hex()

    async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
        async with client.stream("POST", HACKCLUB_URL, json=openai_payload, headers=headers) as response:
            if response.status_code != 200:
                error_body = await response.aread()
                yield f"event: error\ndata: {error_body.decode('utf-8')}\n\n"
                return

            yield f"event: message_start\ndata: {json.dumps({'type': 'message_start', 'message': {'id': msg_id, 'type': 'message', 'role': 'assistant', 'model': model, 'content': []}})}\n\n"
            yield f"event: content_block_start\ndata: {json.dumps({'type': 'content_block_start', 'index': 0, 'content_block': {'type': 'text', 'text': ''}})}\n\n"

            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                        choices = chunk.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {}).get("content", "")
                            if delta:
                                delta_event = {
                                    "type": "content_block_delta",
                                    "index": 0,
                                    "delta": {"type": "text_delta", "text": delta}
                                }
                                yield f"event: content_block_delta\ndata: {json.dumps(delta_event)}\n\n"
                    except json.JSONDecodeError:
                        continue

            yield f"event: content_block_stop\ndata: {json.dumps({'type': 'content_block_stop', 'index': 0})}\n\n"
            yield f"event: message_delta\ndata: {json.dumps({'type': 'message_delta', 'delta': {'stop_reason': 'end_turn'}})}\n\n"
            yield f"event: message_stop\ndata: {json.dumps({'type': 'message_stop'})}\n\n"

async def stream_deep_research(topic: str):
    msg_id = "msg_research_" + os.urandom(8).hex()
    yield f"data: {json.dumps({'type': 'message_start', 'message': {'id': msg_id, 'role': 'assistant', 'model': 'claude-peryl-deep-research'}})}\n\n"
    
    async for event in agent_engine.deep_research_stream(topic):
        if event["type"] == "text_delta":
            delta_event = {
                "type": "content_block_delta",
                "index": 0,
                "delta": {"type": "text_delta", "text": event["delta"]}
            }
            yield f"data: {json.dumps(delta_event)}\n\n"
        else:
            yield f"data: {json.dumps(event)}\n\n"

    yield f"data: [DONE]\n\n"

@api.post("/v1/messages")
async def handle_anthropic_messages(request: Request):
    body = await request.json()
    is_deep_research = body.get("deep_research", False) or body.get("model") == "claude-peryl-deep-research"

    if is_deep_research:
        messages = body.get("messages", [])
        last_topic = messages[-1]["content"] if messages else "General Research"
        return StreamingResponse(
            stream_deep_research(last_topic),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
        )

    is_stream = body.get("stream", False)
    openai_payload = convert_anthropic_to_openai(body)
    
    clean_headers = {
        "Authorization": f"Bearer {HACKCLUB_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "ClaudePeryl-Desktop/1.0",
        "Accept": "*/*"
    }

    if is_stream:
        return StreamingResponse(
            stream_openai_to_anthropic(openai_payload, clean_headers),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
        )
    else:
        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.post(HACKCLUB_URL, json=openai_payload, headers=clean_headers)
            data = res.json()
            if res.status_code != 200:
                return JSONResponse(status_code=res.status_code, content=data)

            content_text = data["choices"][0]["message"].get("content", "")
            anthropic_response = {
                "id": data.get("id", "msg_peryl_123"),
                "type": "message",
                "role": "assistant",
                "model": "claude-peryl",
                "content": [{"type": "text", "text": content_text}],
                "stop_reason": "end_turn",
                "usage": {"input_tokens": 0, "output_tokens": 0}
            }
            return JSONResponse(content=anthropic_response)

def run_backend():
    import uvicorn
    uvicorn.run(api, host="127.0.0.1", port=3000, log_level="warning")

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Claude Peryl Desktop")
        self.resize(1200, 800)
        
        self.browser = QWebEngineView()
        self.browser.setUrl(QUrl("http://127.0.0.1:3000/"))
        self.setCentralWidget(self.browser)

if __name__ == "__main__":
    backend_thread = threading.Thread(target=run_backend, daemon=True)
    backend_thread.start()

    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
