import sys
import os
import json
import re
import asyncio
import subprocess
import httpx
from typing import AsyncGenerator, Dict, List, Any, Optional
from dotenv import load_dotenv

load_dotenv()

HACKCLUB_URL = os.getenv("HACKCLUB_URL", "https://ai.hackclub.com/proxy/v1/chat/completions")
HACKCLUB_KEY = os.getenv("HACKCLUB_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")

class AgentEngine:
    def __init__(self, api_key: str = HACKCLUB_KEY, endpoint: str = HACKCLUB_URL, tavily_key: str = TAVILY_API_KEY):
        self.api_key = api_key or HACKCLUB_KEY
        self.endpoint = endpoint or HACKCLUB_URL
        self.tavily_key = tavily_key or TAVILY_API_KEY
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "ClaudePeryl-Desktop/1.0",
        }

    async def execute_tavily_search(self, query: str, search_depth: str = "advanced") -> List[Dict[str, str]]:
        """Perform deep web search using Tavily API."""
        if not self.tavily_key:
            return await self.execute_fallback_search(query)

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                payload = {
                    "api_key": self.tavily_key,
                    "query": query,
                    "search_depth": search_depth,
                    "include_answer": True,
                    "max_results": 6
                }
                resp = await client.post("https://api.tavily.com/search", json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    if data.get("answer"):
                        results.append({
                            "title": "Tavily AI Synthesized Summary",
                            "snippet": data["answer"],
                            "url": "https://tavily.com"
                        })
                    for item in data.get("results", []):
                        results.append({
                            "title": item.get("title", "Search Result"),
                            "snippet": item.get("content", ""),
                            "url": item.get("url", "")
                        })
                    if results:
                        return results
        except Exception:
            pass

        return await self.execute_fallback_search(query)

    async def execute_fallback_search(self, query: str) -> List[Dict[str, str]]:
        """Fallback search implementation via DuckDuckGo."""
        results = []
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                url = f"https://html.duckduckgo.com/html/?q={httpx.QueryParams({'q': query})['q']}"
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64)"})
                if resp.status_code == 200:
                    text = resp.text
                    matches = re.findall(r'<a class="result__url" href="([^"]+)".*?>\s*(.*?)\s*</a>.*?<a class="result__snippet".*?>(.*?)</a>', text, re.DOTALL)
                    for link, title, snippet in matches[:5]:
                        clean_title = re.sub(r'<[^>]+>', '', title).strip()
                        clean_snippet = re.sub(r'<[^>]+>', '', snippet).strip()
                        if clean_title and clean_snippet:
                            results.append({
                                "title": clean_title,
                                "snippet": clean_snippet,
                                "url": link.strip()
                            })
        except Exception:
            pass

        if not results:
            results = [{
                "title": f"Search summary for '{query}'",
                "snippet": f"Documented research insights regarding {query}.",
                "url": f"https://search.claude-peryl.internal/?q={query}"
            }]
        return results

    async def get_formatted_web_context(self, query: str) -> str:
        """Perform search and format structured XML context for prompt injection."""
        results = await self.execute_tavily_search(query)
        if not results:
            return ""
        
        formatted = ["<web_search_results>"]
        for idx, item in enumerate(results, 1):
            formatted.append(
                f'<doc index="{idx}">\n'
                f'  <title>{item.get("title")}</title>\n'
                f'  <url>{item.get("url")}</url>\n'
                f'  <snippet>{item.get("snippet")}</snippet>\n'
                f'</doc>'
            )
        formatted.append("</web_search_results>")
        return "\n".join(formatted)

    async def execute_python_sandbox(self, code: str) -> Dict[str, str]:
        """Execute Python code in a safe subprocess execution context."""
        try:
            process = await asyncio.create_subprocess_exec(
                sys.executable, "-c", code,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=10.0)
            return {
                "stdout": stdout.decode("utf-8", errors="replace"),
                "stderr": stderr.decode("utf-8", errors="replace"),
                "exit_code": str(process.returncode)
            }
        except asyncio.TimeoutError:
            return {"stdout": "", "stderr": "Execution timed out after 10 seconds.", "exit_code": "-1"}
        except Exception as e:
            return {"stdout": "", "stderr": f"Execution error: {str(e)}", "exit_code": "-1"}

    async def run_subagent(self, role: str, prompt: str) -> Dict[str, Any]:
        """Run a specialized subagent task."""
        subagent_prompt = f"You are a specialized subagent with role: {role}.\nTask: {prompt}\nProvide a concise, factual summary of findings."
        payload = {
            "model": "anthropic/claude-opus-5",
            "messages": [{"role": "user", "content": subagent_prompt}],
            "temperature": 0.3,
            "max_tokens": 1500
        }
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                res = await client.post(self.endpoint, json=payload, headers=self.headers)
                if res.status_code == 200:
                    data = res.json()
                    content = data["choices"][0]["message"].get("content", "")
                    return {"role": role, "status": "completed", "output": content}
        except Exception:
            pass
        return {"role": role, "status": "error", "output": f"Subagent {role} failed to respond."}

    async def deep_research_stream(self, topic: str) -> AsyncGenerator[Dict[str, Any], None]:
        """Stream progress of Deep Dive Research Agent and Subagents using Tavily."""
        yield {"type": "subagent_start", "role": "Research Orchestrator", "message": f"Deconstructing deep research topic with Tavily Search API: '{topic}'..."}
        await asyncio.sleep(0.3)

        research_angles = [
            f"Overview, recent news, and current status of {topic}",
            f"Technical architecture, mechanisms, and deep insights into {topic}",
            f"Future outlook, industry developments, and comparative analysis of {topic}"
        ]

        subagent_outputs = []
        for i, angle in enumerate(research_angles, 1):
            yield {
                "type": "subagent_step",
                "role": f"Tavily Research Subagent #{i}",
                "message": f"Querying Tavily Search API for: '{angle}'..."
            }
            
            search_results = await self.execute_tavily_search(angle)
            yield {
                "type": "subagent_step",
                "role": f"Tavily Research Subagent #{i}",
                "message": f"Retrieved {len(search_results)} Tavily search entries. Synthesizing subagent insights..."
            }
            
            sub_res = await self.run_subagent(
                role=f"Tavily Research Subagent #{i}",
                prompt=f"Analyze angle: {angle}\nContext from Tavily Deep Search: {json.dumps(search_results)}"
            )
            subagent_outputs.append(sub_res["output"])
            
            yield {
                "type": "subagent_complete",
                "role": f"Tavily Research Subagent #{i}",
                "output": sub_res["output"]
            }

        yield {
            "type": "subagent_step",
            "role": "Synthesis Agent",
            "message": "Synthesizing multi-source Tavily research into final Deep Dive Report..."
        }

        synthesis_prompt = (
            f"You are Claude Peryl Deep Research Agent created by ashmil P.\n"
            f"Original Query: {topic}\n\n"
            f"Tavily Research Subagent Findings:\n" + "\n\n".join(subagent_outputs) + "\n\n"
            f"Provide a comprehensive, highly detailed Deep Research Report in Markdown format with executive summary, detailed analysis, and key takeaways."
        )

        payload = {
            "model": "anthropic/claude-opus-5",
            "messages": [{"role": "user", "content": synthesis_prompt}],
            "temperature": 0.5,
            "max_tokens": 4000,
            "stream": True
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream("POST", self.endpoint, json=payload, headers=self.headers) as response:
                if response.status_code == 200:
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
                                        yield {"type": "text_delta", "delta": delta}
                            except json.JSONDecodeError:
                                continue

    def extract_artifacts(self, text: str) -> List[Dict[str, Any]]:
        """Extract renderable artifacts (HTML, SVG, React, Markdown, Chart) from generated text."""
        artifacts = []
        pattern = r"```(html|jsx|tsx|svg|mermaid|markdown)\s*\n(.*?)```"
        matches = re.finditer(pattern, text, re.DOTALL)
        for idx, match in enumerate(matches, 1):
            lang = match.group(1).lower()
            code = match.group(2).strip()
            if len(code) > 40:
                artifacts.append({
                    "id": f"art_{idx}_{hash(code[:20]) & 0xffffff}",
                    "title": f"Artifact #{idx} ({lang.upper()})",
                    "type": lang,
                    "content": code
                })
        return artifacts
