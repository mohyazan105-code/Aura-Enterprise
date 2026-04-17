import os
import glob
import json
import traceback

class M8DevAgent:
    """
    M.8 DEV - Autonomous Developer Agent Framework
    
    This class handles the core logic for the built-in AI developer.
    It provides a strictly sandboxed environment for reading, writing, and modifying 
    code within the Action Aura project.
    """

    SYSTEM_PROMPT = """You are M.8 DEV, an elite autonomous software engineer and architect embedded natively into the Action Aura system.
You possess absolute mastery over all Python libraries, frameworks, and advanced software engineering paradigms.
You have been trained in advanced neural language generation, allowing you to reason precisely, logically, and creatively through complex coding challenges.

Your capabilities include:
1. Writing production-grade, highly optimized, and clean code.
2. Understanding complex system architectures and dependencies.
3. Reading, analyzing, and precisely modifying files within the provided workspace.

When you execute tasks:
- Think step-by-step before making any modifications.
- Handle edge cases, security, and performance.
- When given a task, you will loop between generating Thoughts, taking Actions (Tools), and observing Results until you complete the task.

AVAILABLE TOOLS:
- read_file(filepath: str) -> str
- list_directory(filepath: str) -> list
- replace_file_content(filepath: str, old_string: str, new_string: str) -> str
- write_to_file(filepath: str, content: str) -> str

Reply strictly following the ReAct JSON format to call tools, or return a final response when the task is done.
"""

    def __init__(self, workspace_root: str):
        self.workspace_root = workspace_root
        # In a real environment, this would hold the OpenAI/Gemini API config.
        # self.api_key = os.getenv("LLM_API_KEY") 

    def _resolve_path(self, filepath: str) -> str:
        """Ensure filepaths stay within the designated workspace root (Prevent path traversal)."""
        # Minimal sandbox enforcement for safety
        normalized_root = os.path.abspath(self.workspace_root)
        normalized_path = os.path.abspath(os.path.join(normalized_root, filepath))
        
        if not normalized_path.startswith(normalized_root):
            raise PermissionError(f"M.8 DEV Sandbox Violation: Access denied to {filepath}")
        return normalized_path

    # ─── TOOL REGISTRY ──────────────────────────────────────────────────────────

    def tool_read_file(self, filepath: str) -> str:
        try:
            path = self._resolve_path(filepath)
            if not os.path.exists(path):
                return f"Error: File '{filepath}' does not exist."
            with open(path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            return f"Error reading file: {str(e)}"

    def tool_list_directory(self, path: str) -> str:
        try:
            dir_path = self._resolve_path(path)
            if not os.path.isdir(dir_path):
                return f"Error: Directory '{path}' does not exist."
            files = os.listdir(dir_path)
            return json.dumps({"directory": path, "contents": files})
        except Exception as e:
            return f"Error listing directory: {str(e)}"

    def tool_write_to_file(self, filepath: str, content: str) -> str:
        try:
            path = self._resolve_path(filepath)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w', encoding='utf-8') as f:
                f.write(content)
            return f"Success: Wrote to '{filepath}'"
        except Exception as e:
            return f"Error writing file: {str(e)}"

    def tool_replace_file_content(self, filepath: str, old_string: str, new_string: str) -> str:
        try:
            path = self._resolve_path(filepath)
            if not os.path.exists(path):
                return f"Error: File '{filepath}' does not exist."
            
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            if old_string not in content:
                return "Error: old_string not found in file."
                
            updated_content = content.replace(old_string, new_string)
            
            with open(path, 'w', encoding='utf-8') as f:
                f.write(updated_content)
                
            return f"Success: Modified content in '{filepath}'"
        except Exception as e:
            return f"Error replacing content: {str(e)}"

    # ─── AGENT LOOP ──────────────────────────────────────────────────────────────

    def execute_task(self, prompt: str) -> str:
        """
        Main entry point for the M.8 DEV Agent.
        This framework is ready for LLM integration.
        """
        # 1. Initialize ReAct context with system prompt + user task
        context = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ]

        # 2. To activate M.8 DEV:
        #    Replace this simulation block with a while loop that continuously sends 
        #    `context` to your LLM of choice (e.g., GPT-4o, Claude-3.5, Gemini-1.5).
        #    The LLM will return a JSON specifying a tool call (e.g., read_file).
        #    You execute the tool here, append the tool's return string to `context`, 
        #    and pass it back to the LLM until it returns a final response string.
        
        # MOCK EXECUTION FOR NOW
        response_msg = (
            "M.8 DEV Core Framework initialized successfully. "
            "System prompt and tool registries (read_file, write_to_file, list_directory) are loaded. "
            "Please connect an LLM endpoints (OpenAI / Anthropic / Gemini API key) inside "
            "`api/builtit_agent.py` -> `execute_task()` to activate autonomous reasoning."
        )

        return response_msg

