import sys
import os
import json
import socket
import time
import asyncio
import threading
import httpx
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
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

# Project Context Database (In-Memory state + workspace support)
projects_db: Dict[str, Dict[str, Any]] = {}
active_project_id: Optional[str] = None

# Robust Model Mapping Dictionary
MODEL_MAPPING: Dict[str, str] = {
    # Requested mappings:
    "claude-3-7-sonnet-extra": "meta-llama/llama-3.3-70b-instruct",
    "claude-peryl": "meta-llama/llama-3.3-70b-instruct",
    "claude-peryl-opus": "meta-llama/llama-3.3-70b-instruct",
    "claude-peryl-sonnet": "qwen/qwen-2.5-coder-32b-instruct",
    "claude-peryl-deep-research": "meta-llama/llama-3.3-70b-instruct",
    "openai/gpt-4o": "openai/gpt-4o",
    "deepseek/deepseek-chat": "deepseek/deepseek-chat",
    # Active proxy model pass-throughs & aliases:
    "meta-llama/llama-3.3-70b-instruct": "meta-llama/llama-3.3-70b-instruct",
    "qwen/qwen-2.5-coder-32b-instruct": "qwen/qwen-2.5-coder-32b-instruct",
    "gpt-4o": "openai/gpt-4o",
    "deepseek-chat": "deepseek/deepseek-chat",
    "claude-3-5-sonnet": "meta-llama/llama-3.3-70b-instruct",
    "claude-peryl-haiku": "qwen/qwen-2.5-coder-32b-instruct",
}

DEFAULT_PROXY_MODEL = "meta-llama/llama-3.3-70b-instruct"

def resolve_model(model_id: Optional[str]) -> str:
    """Resolve any requested model ID to one of the active proxy models."""
    if not model_id:
        return DEFAULT_PROXY_MODEL
    if model_id in MODEL_MAPPING:
        return MODEL_MAPPING[model_id]
    if model_id in MODEL_MAPPING.values():
        return model_id
    return DEFAULT_PROXY_MODEL

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
os.makedirs(STATIC_DIR, exist_ok=True)
api.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@api.get("/")
async def get_index():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))

@api.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Claude Peryl Desktop Engine"}

@api.get("/v1/models")
async def list_models():
    return {
        "data": [
            {"id": "claude-3-7-sonnet-extra", "display_name": "Claude 3.7 Sonnet Extra", "created_at": "2026-06-09T00:00:00Z"},
            {"id": "claude-peryl", "display_name": "Claude Peryl 5", "created_at": "2026-06-09T00:00:00Z"},
            {"id": "claude-peryl-opus", "display_name": "Claude Peryl Opus 4.8", "created_at": "2026-06-09T00:00:00Z"},
            {"id": "claude-peryl-sonnet", "display_name": "Claude Peryl Sonnet 4.6", "created_at": "2026-06-09T00:00:00Z"},
            {"id": "claude-peryl-deep-research", "display_name": "Claude Peryl Deep Research Agent", "created_at": "2026-06-09T00:00:00Z"},
            {"id": "openai/gpt-4o", "display_name": "OpenAI GPT-4o", "created_at": "2026-06-09T00:00:00Z"},
            {"id": "deepseek/deepseek-chat", "display_name": "DeepSeek Chat", "created_at": "2026-06-09T00:00:00Z"},
            {"id": "meta-llama/llama-3.3-70b-instruct", "display_name": "Llama 3.3 70B Instruct", "created_at": "2026-06-09T00:00:00Z"},
            {"id": "qwen/qwen-2.5-coder-32b-instruct", "display_name": "Qwen 2.5 Coder 32B", "created_at": "2026-06-09T00:00:00Z"}
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

@api.delete("/api/system_prompt")
async def reset_system_prompt():
    global active_system_prompt
    active_system_prompt = CLAUDE_PERYL_SYSTEM_PROMPT
    return {"status": "ok", "system_prompt": active_system_prompt}

# --- Project Context Endpoints ---
@api.get("/api/projects")
async def get_projects():
    return {
        "projects": list(projects_db.values()),
        "active_project_id": active_project_id
    }

@api.post("/api/projects")
async def update_projects(request: Request):
    global active_project_id, projects_db
    data = await request.json()

    if "active_project_id" in data:
        active_project_id = data["active_project_id"]

    if "id" in data and "name" in data:
        proj_id = data["id"]
        projects_db[proj_id] = {
            "id": proj_id,
            "name": data.get("name", "Untitled Project"),
            "instructions": data.get("instructions", ""),
            "files": data.get("files", [])
        }
        if data.get("set_active") or data.get("active"):
            active_project_id = proj_id

    if "projects" in data and isinstance(data["projects"], list):
        for p in data["projects"]:
            if isinstance(p, dict) and "id" in p:
                projects_db[p["id"]] = p

    return {
        "status": "ok",
        "projects": list(projects_db.values()),
        "active_project_id": active_project_id
    }

@api.delete("/api/projects/{project_id}")
async def delete_project(project_id: str):
    global active_project_id, projects_db
    if project_id in projects_db:
        del projects_db[project_id]
    if active_project_id == project_id:
        active_project_id = None
    return {
        "status": "ok",
        "projects": list(projects_db.values()),
        "active_project_id": active_project_id
    }

def format_message_content(msg: dict) -> str:
    """Extract and format user message contents including file attachments, code files, and image descriptions."""
    content = msg.get("content", "")
    text_pieces = []
    inline_attachments = []

    if isinstance(content, str):
        text_pieces.append(content)
    elif isinstance(content, list):
        for block in content:
            if isinstance(block, str):
                text_pieces.append(block)
            elif isinstance(block, dict):
                btype = block.get("type")
                if btype == "text":
                    text_pieces.append(block.get("text", ""))
                elif btype in ("image", "image_url"):
                    source = block.get("source", {})
                    media_type = source.get("media_type") or block.get("media_type") or "image"
                    desc = block.get("description") or source.get("description") or ""
                    url = block.get("image_url", {}).get("url") or source.get("url") or ""
                    text_pieces.append(f"[Attached Image ({media_type}){f': {desc}' if desc else ''}{f' URL: {url}' if url else ''}]")
                elif btype in ("file", "attachment", "document", "code"):
                    inline_attachments.append(block)
                elif any(k in block for k in ("file_name", "filename", "name", "content")):
                    inline_attachments.append(block)
                else:
                    text_pieces.append(block.get("text") or str(block))

    msg_attachments = msg.get("attachments") or msg.get("files") or []
    if isinstance(msg_attachments, list):
        inline_attachments.extend(msg_attachments)

    result_text = "\n".join([t for t in text_pieces if t])
    if inline_attachments:
        att_str = agent_engine.process_attachments(inline_attachments)
        result_text = (result_text + "\n" + att_str).strip()

    return result_text

async def convert_anthropic_to_openai(body: dict, web_context: str = "") -> dict:
    messages = []
    
    identity_preamble = (
        "IDENTITY & SYSTEM CAPABILITIES:\n"
        "You are Claude Peryl 5, created by ashmil P.\n"
        "You ARE fully equipped with real-time web search (via Tavily Search API), code execution sandbox, subagents, and live interactive artifact rendering in this desktop environment.\n\n"
        "CRITICAL ARTIFACT & GRAPHICS GENERATION INSTRUCTIONS:\n"
        "1. Whenever you generate ANY code, HTML page, SVG drawing/diagram, React component, Mermaid diagram, or document, YOU MUST WRAP IT IN A FENCED CODE BLOCK (```html, ```svg, ```jsx, ```mermaid, ```xml, or ```markdown).\n"
        "2. ABSOLUTELY NEVER output raw <svg> tags, HTML elements, or code directly in plain text without code fences (```).\n"
        "3. Write concise, self-contained, modular code so that your response fits efficiently within token limits while remaining 100% complete and functional.\n"
        "4. The Claude Peryl Desktop client interface automatically captures these fenced code blocks in the background and renders them live as interactive split-screen Artifacts for the user!\n"
        "5. NEVER claim that you cannot create artifacts or that a side panel does not exist, because Artifact rendering IS active and fully functional in this desktop app.\n"
    )

    system_text = identity_preamble + "\n\n" + active_system_prompt

    # Project Context Injection
    project_context = ""
    proj_id = body.get("project_id") or active_project_id
    if proj_id and proj_id in projects_db:
        proj = projects_db[proj_id]
        project_context = (
            f"\n\nACTIVE PROJECT WORKSPACE: '{proj.get('name', 'Project')}'\n"
            f"Project Instructions:\n{proj.get('instructions', 'None')}\n"
        )
        if proj.get("files"):
            project_context += agent_engine.process_attachments(proj["files"])
    elif body.get("project_instructions"):
        project_context = f"\n\nACTIVE PROJECT INSTRUCTIONS:\n{body.get('project_instructions')}\n"

    if project_context:
        system_text += project_context

    if web_context:
        system_text += f"\n\nLIVE TAVILY WEB SEARCH RESULTS FOR USER QUERY:\n{web_context}\n\nInstructions: Use the above live web search results directly in your response to answer accurately with web citations!"

    if "system" in body:
        user_sys = body["system"]
        if isinstance(user_sys, list):
            user_sys = "\n".join([b.get("text", "") for b in user_sys if isinstance(b, dict) and b.get("type") == "text"])
        if user_sys:
            system_text = system_text + "\n\nUser Context:\n" + str(user_sys)

    messages.append({"role": "system", "content": system_text})

    top_level_attachments = body.get("attachments") or body.get("files") or []
    raw_messages = body.get("messages", [])

    for idx, msg in enumerate(raw_messages):
        role = msg.get("role")
        formatted_content = format_message_content(msg)

        # If top-level attachments provided, append to last user message
        if idx == len(raw_messages) - 1 and role == "user" and top_level_attachments:
            att_text = agent_engine.process_attachments(top_level_attachments)
            formatted_content = (formatted_content + "\n" + att_text).strip()

        messages.append({"role": role, "content": formatted_content})

    requested_tokens = body.get("max_tokens", 8192)
    max_tokens = max(requested_tokens, 8192)

    requested_model = body.get("model", "claude-peryl")
    target_model = resolve_model(requested_model)

    return {
        "model": target_model,
        "messages": messages,
        "stream": body.get("stream", False),
        "temperature": body.get("temperature", 0.7),
        "max_tokens": max_tokens,
    }

async def stream_openai_to_anthropic(openai_payload: dict, headers: dict, requested_model: str):
    msg_id = "msg_peryl_" + os.urandom(8).hex()

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=10.0)) as client:
            async with client.stream("POST", HACKCLUB_URL, json=openai_payload, headers=headers) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    error_msg = error_body.decode('utf-8', errors='replace')
                    yield f"event: error\ndata: {json.dumps({'type': 'error', 'error': {'type': 'api_error', 'message': error_msg}})}\n\n"
                    return

                yield f"event: message_start\ndata: {json.dumps({'type': 'message_start', 'message': {'id': msg_id, 'type': 'message', 'role': 'assistant', 'model': requested_model, 'content': []}})}\n\n"
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
    except Exception as e:
        yield f"event: error\ndata: {json.dumps({'type': 'error', 'error': {'type': 'api_error', 'message': str(e)}})}\n\n"

async def stream_deep_research(topic: str, target_model: str):
    msg_id = "msg_research_" + os.urandom(8).hex()
    yield f"event: message_start\ndata: {json.dumps({'type': 'message_start', 'message': {'id': msg_id, 'role': 'assistant', 'model': 'claude-peryl-deep-research'}})}\n\n"
    yield f"event: content_block_start\ndata: {json.dumps({'type': 'content_block_start', 'index': 0, 'content_block': {'type': 'text', 'text': ''}})}\n\n"

    async for event in agent_engine.deep_research_stream(topic, model=target_model):
        if event["type"] == "text_delta":
            delta_event = {
                "type": "content_block_delta",
                "index": 0,
                "delta": {"type": "text_delta", "text": event["delta"]}
            }
            yield f"event: content_block_delta\ndata: {json.dumps(delta_event)}\n\n"
        else:
            yield f"event: subagent_step\ndata: {json.dumps(event)}\n\n"

    yield f"event: content_block_stop\ndata: {json.dumps({'type': 'content_block_stop', 'index': 0})}\n\n"
    yield f"event: message_delta\ndata: {json.dumps({'type': 'message_delta', 'delta': {'stop_reason': 'end_turn'}})}\n\n"
    yield f"event: message_stop\ndata: {json.dumps({'type': 'message_stop'})}\n\n"
    yield f"data: [DONE]\n\n"

@api.post("/v1/messages")
async def handle_anthropic_messages(request: Request):
    body = await request.json()
    requested_model = body.get("model", "claude-peryl")
    target_proxy_model = resolve_model(requested_model)

    is_deep_research = body.get("deep_research", False) or requested_model == "claude-peryl-deep-research"
    enable_web_search = body.get("enable_web_search", False)

    messages = body.get("messages", [])
    last_user_prompt = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            last_user_prompt = format_message_content(m)
            break

    if is_deep_research:
        return StreamingResponse(
            stream_deep_research(last_user_prompt or "General Research", target_model=target_proxy_model),
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
            stream_openai_to_anthropic(openai_payload, clean_headers, requested_model=requested_model),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}
        )
    else:
        async with httpx.AsyncClient(timeout=180.0) as client:
            res = await client.post(HACKCLUB_URL, json=openai_payload, headers=clean_headers)
            data = res.json()
            if res.status_code != 200:
                return JSONResponse(status_code=res.status_code, content=data)

            content_text = ""
            if "choices" in data and len(data["choices"]) > 0:
                content_text = data["choices"][0].get("message", {}).get("content", "")

            anthropic_response = {
                "id": data.get("id", f"msg_peryl_{os.urandom(8).hex()}"),
                "type": "message",
                "role": "assistant",
                "model": requested_model,
                "content": [{"type": "text", "text": content_text}],
                "stop_reason": "end_turn",
                "usage": {
                    "input_tokens": data.get("usage", {}).get("prompt_tokens", 0),
                    "output_tokens": data.get("usage", {}).get("completion_tokens", 0)
                }
            }
            return JSONResponse(content=anthropic_response)

# --- OpenAI Compatible Proxy Endpoint ---
@api.post("/v1/chat/completions")
async def handle_openai_chat_completions(request: Request):
    body = await request.json()
    requested_model = body.get("model", "claude-peryl")
    target_proxy_model = resolve_model(requested_model)

    payload = dict(body)
    payload["model"] = target_proxy_model

    clean_headers = {
        "Authorization": f"Bearer {HACKCLUB_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "ClaudePeryl-Desktop/1.0",
        "Accept": "*/*"
    }

    if body.get("stream", False):
        async def stream_openai_native():
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=10.0)) as client:
                    async with client.stream("POST", HACKCLUB_URL, json=payload, headers=clean_headers) as response:
                        if response.status_code != 200:
                            err_bytes = await response.aread()
                            yield f"data: {json.dumps({'error': err_bytes.decode('utf-8', errors='replace')})}\n\n"
                            return
                        async for line in response.aiter_lines():
                            if line:
                                yield f"{line}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(
            stream_openai_native(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"}
        )
    else:
        async with httpx.AsyncClient(timeout=180.0) as client:
            res = await client.post(HACKCLUB_URL, json=payload, headers=clean_headers)
            return JSONResponse(status_code=res.status_code, content=res.json())

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

try:
    from PyQt6.QtCore import QUrl
    from PyQt6.QtGui import QIcon
    from PyQt6.QtWidgets import QApplication, QMainWindow
    from PyQt6.QtWebEngineWidgets import QWebEngineView
    HAS_PYQT6 = True
except ImportError:
    HAS_PYQT6 = False

if HAS_PYQT6:
    class MainWindow(QMainWindow):
        def __init__(self):
            super().__init__()
            self.setWindowTitle("Claude Peryl Desktop")
            self.resize(1200, 800)
            
            icon_path = os.path.join(STATIC_DIR, "logo.png")
            if os.path.exists(icon_path):
                self.setWindowIcon(QIcon(icon_path))

            self.browser = QWebEngineView()
            self.setCentralWidget(self.browser)
            
            if wait_for_backend():
                self.browser.setUrl(QUrl("http://127.0.0.1:3000/"))
            else:
                print("Warning: Backend server connection timed out.")

if __name__ == "__main__":
    if HAS_PYQT6 and os.environ.get("HEADLESS") != "1":
        backend_thread = threading.Thread(target=run_backend, daemon=True)
        backend_thread.start()

        app = QApplication(sys.argv)
        app.setDesktopFileName("claude-peryl.desktop")
        icon_path = os.path.join(STATIC_DIR, "logo.png")
        if os.path.exists(icon_path):
            app.setWindowIcon(QIcon(icon_path))

        window = MainWindow()
        window.show()
        sys.exit(app.exec())
    else:
        run_backend()
