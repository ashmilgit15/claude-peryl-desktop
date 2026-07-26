import sys
import os
import json
import socket
import time
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

load_dotenv()

HACKCLUB_URL = os.getenv("HACKCLUB_URL", "https://ai.hackclub.com/proxy/v1/chat/completions")
HACKCLUB_KEY = os.getenv("HACKCLUB_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

api = FastAPI(title="Claude Peryl Desktop Engine")

agent_engine = AgentEngine(api_key=HACKCLUB_KEY, endpoint=HACKCLUB_URL, tavily_key=TAVILY_API_KEY)
active_system_prompt = CLAUDE_PERYL_SYSTEM_PROMPT

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

async def convert_anthropic_to_openai(body: dict, web_context: str = "") -> dict:
    messages = []
    
    identity_preamble = (
        "IDENTITY & SYSTEM CAPABILITIES:\n"
        "You are Claude Peryl 5, created by ashmil P.\n"
        "You ARE fully equipped with real-time web search (via Tavily Search API), code execution sandbox, subagents, and live interactive artifact rendering in this desktop environment.\n\n"
        "CRITICAL ARTIFACT GENERATION INSTRUCTIONS:\n"
        "1. Whenever the user requests an interactive application, dashboard, HTML/CSS/JS page, React/JSX component, SVG drawing, Mermaid diagram, or document, YOU MUST CREATE AN ARTIFACT.\n"
        "2. ALWAYS wrap artifact code cleanly inside fenced code blocks: ```html, ```jsx, ```svg, ```mermaid, or ```markdown.\n"
        "3. Write concise, self-contained, modular code so that your response fits efficiently within token limits while remaining 100% complete and functional.\n"
        "4. The Claude Peryl Desktop client interface automatically captures these code blocks, auto-closes incomplete blocks if truncated, and renders them live in the split-screen Artifact side panel for the user!\n"
        "5. NEVER claim that you cannot create artifacts or that a side panel does not exist, because Artifact rendering IS active and fully functional in this desktop app.\n"
    )

    system_text = identity_preamble + "\n\n" + active_system_prompt

    if web_context:
        system_text += f"\n\nLIVE TAVILY WEB SEARCH RESULTS FOR USER QUERY:\n{web_context}\n\nInstructions: Use the above live web search results directly in your response to answer accurately with web citations!"

    if "system" in body:
        user_sys = body["system"]
        if isinstance(user_sys, list):
            user_sys = "\n".join([b.get("text", "") for b in user_sys if b.get("type") == "text"])
        if user_sys:
            system_text = system_text + "\n\nUser Context:\n" + user_sys

    messages.append({"role": "system", "content": system_text})

    for msg in body.get("messages", []):
        role = msg.get("role")
        content = msg.get("content")
        if isinstance(content, list):
            text_blocks = [block.get("text", "") for block in content if block.get("type") == "text"]
            content = "\n".join(text_blocks)
        messages.append({"role": role, "content": content or ""})

    requested_tokens = body.get("max_tokens", 8192)
    max_tokens = max(requested_tokens, 8192)

    return {
        "model": "anthropic/claude-opus-5",
        "messages": messages,
        "stream": body.get("stream", False),
        "temperature": body.get("temperature", 0.7),
        "max_tokens": max_tokens,
    }

async def stream_openai_to_anthropic(openai_payload: dict, headers: dict):
    model = "claude-peryl"
    msg_id = "msg_peryl_" + os.urandom(8).hex()

    async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=10.0)) as client:
        async with client.stream("POST", HACKCLUB_URL, json=openai_payload, headers=headers) as response:
            if response.status_code != 200:
                error_body = await response.aread()
                yield f"event: error\ndata: {error_body.decode('utf-8')}\n\n"
                return

            yield f"event: message_start\ndata: {json.dumps({'type': 'message_start', 'message': {'id': msg_id, 'type': 'message', 'role': 'assistant', 'model': model, 'content': []}})}\n\n"
            yield f"event: content_block_start\ndata: {json.dumps({'type': 'content_block_start', 'index': 0, 'content_block': {'type': 'text', 'text': ''}})}\n\n"

            async for line in response.aiter_lines():
                if not line:
                    continue
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
    enable_web_search = body.get("enable_web_search", False)

    messages = body.get("messages", [])
    last_user_prompt = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            c = m.get("content")
            last_user_prompt = c if isinstance(c, str) else str(c)
            break

    if is_deep_research:
        return StreamingResponse(
            stream_deep_research(last_user_prompt or "General Research"),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}
        )

    web_context = ""
    if enable_web_search and last_user_prompt:
        web_context = await agent_engine.get_formatted_web_context(last_user_prompt)

    is_stream = body.get("stream", False)
    openai_payload = await convert_anthropic_to_openai(body, web_context=web_context)
    
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
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}
        )
    else:
        async with httpx.AsyncClient(timeout=180.0) as client:
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

def wait_for_backend(host="127.0.0.1", port=3000, timeout=10.0) -> bool:
    start = time.time()
    while time.time() - start < timeout:
        try:
            with socket.create_connection((host, port), timeout=0.5):
                return True
        except (OSError, ConnectionRefusedError):
            time.sleep(0.1)
    return False

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Claude Peryl Desktop")
        self.resize(1200, 800)
        
        self.browser = QWebEngineView()
        self.setCentralWidget(self.browser)
        
        if wait_for_backend():
            self.browser.setUrl(QUrl("http://127.0.0.1:3000/"))
        else:
            print("Warning: Backend server connection timed out.")

if __name__ == "__main__":
    backend_thread = threading.Thread(target=run_backend, daemon=True)
    backend_thread.start()

    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())
